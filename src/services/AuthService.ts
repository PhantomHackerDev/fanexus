import { Blog } from "../Entity/Blog";
import { Community } from "../Entity/Community";
import { BlogPost } from "../Entity/BlogPost";
import { User } from "../Entity/User";
import { Comment } from "../Entity/Comment";
import { AccessControlGroup } from "../Entity/AccessControlGroup";
import { Sequelize } from "sequelize-typescript";
import { Transaction } from "sequelize";

class AuthService {
    public static userHasEditPermissionsForEntity(
        entity:
            | Blog
            | Community
            | BlogPost
            | Comment
            | AccessControlGroup
            | null,
        user: User,
        transaction: Transaction
    ): Promise<boolean> {
        // TODO make editpermissions and deletepermissions separate
        if (user.loggedInAsAnonymous === false) {
            return Promise.resolve(false);
        } else if (user.moderator || user.admin || user.superadmin) {
            return Promise.resolve(true);
        } else if (entity instanceof Blog) {
            return user.hasAlias(entity.AliasId, { transaction });
        } else if (entity instanceof BlogPost) {
            if (user.moderator || user.admin || user.superadmin) {
                return Promise.resolve(true);
            }
            if (entity.CommunityId) {
                let isModerator = false;
                let hasAlias = false;
                const promises: Promise<any>[] = [];
                promises.push(
                    entity.getCommunity({ transaction }).then(community => {
                        return this.userIsCommunityModerator(
                            user,
                            community,
                            transaction
                        ).then(isCommunityModerator => {
                            isModerator = isCommunityModerator;
                            return Promise.resolve(true);
                        });
                    })
                );
                promises.push(
                    user
                        .hasAlias(entity.AliasId, { transaction })
                        .then(userHasAlias => {
                            hasAlias = userHasAlias;
                        })
                );

                return Promise.all(promises).then(() => {
                    return Promise.resolve(isModerator || hasAlias);
                });
            } else if (entity.BlogId) {
                let blogOwner = false;
                let hasAlias = false;
                const promises: Promise<any>[] = [];
                promises.push(
                    entity.getBlog({ transaction }).then(blog => {
                        return user
                            .hasAlias(blog.AliasId, { transaction })
                            .then(hasBlogAlias => {
                                blogOwner = hasBlogAlias;
                                return hasBlogAlias;
                            });
                    })
                );
                promises.push(
                    user
                        .hasAlias(entity.AliasId, { transaction })
                        .then(userHasAlias => {
                            hasAlias = userHasAlias;
                        })
                );
                return Promise.all(promises).then(() => {
                    return Promise.resolve(blogOwner || hasAlias);
                });
            } else {
                return user.hasAlias(entity.AliasId, { transaction });
            }
        } else if (entity instanceof Comment) {
            return Promise.all([
                user.hasAlias(entity.AliasId, { transaction }),
                user.hasAlias(entity.rootBlogPost.AliasId, { transaction })
            ]).then(
                ([isAuthor, isBlogPostAuthor]) => isAuthor || isBlogPostAuthor
            );
        } else if (entity instanceof Community) {
            return this.userIsCommunityModerator(
                user,
                entity,
                transaction
            ).then(isModerator => {
                return Promise.resolve(isModerator);
            });
        } else if (entity instanceof AccessControlGroup) {
            return Promise.resolve(
                user.AliasIds.includes(entity.belongsToAliasId)
            );
        } else {
            return Promise.resolve(true);
        }
    }

    // DEPRECATED, use direct SQL for speed
    public static userHasViewPermissionForEntity(
        entity:
            | Blog
            | Community
            | BlogPost
            | Comment
            | AccessControlGroup
            | null,
        user: User,
        transaction: Transaction
    ) {
        if (user.superadmin || user.admin || user.moderator) {
            return Promise.resolve(true);
        } else if (entity instanceof Blog) {
            /*
             * disallow if
             * alias blocked blog
             * blog blocked viewer
             * AFTER PRIVACY GROUP REFACTOR ON BLOGS
             * blog settings is set to subscribers, which the viewer is not
             * blog settings is set to whitelist, which the alias is not in
             * blog settings is set to blacklist, which the alias is in
             * */

            return AuthService.gateKeepersLetThrough([
                AuthService.userHasSecurityGroupPermissions(
                    user,
                    entity.contentAccessControl,
                    entity,
                    transaction
                ),
                AuthService.usersArentBlocked()
            ]);
        } else if (entity instanceof BlogPost) {
            /*
             * disallow if:
             * users blocked blog or blog author
             * author blocked viewer
             * community is open and blocked
             * contains tags that are blocked
             * privacy groups is a whitelist in which alias is not
             * privacy group is a blacklist in which user is
             * privacy groups is set to subscribers/members only, which alias is not
             * community is set to content members only, which alias is not
             *
             * NEW block condition - block tag coming from certain blog only?
             *
             * */
            if (entity.BlogId) {
                return entity
                    .getBlog({
                        include: [
                            {
                                model: AccessControlGroup,
                                as: "contentAccessControl"
                            }
                        ]
                    })
                    .then(blog => {
                        /*AuthService.userHasSecurityGroupPermissions(user, blog.contentAccessControl, entity).then(result => {console.log("blogsec");console.log(result)})
                    AuthService.userHasSecurityGroupPermissions(user, entity.AccessControlGroup, entity).then(result => {console.log("entitysec");console.log(result)})*/
                        return AuthService.gateKeepersLetThrough([
                            AuthService.userHasSecurityGroupPermissions(
                                user,
                                blog.contentAccessControl,
                                entity,
                                transaction
                            ),
                            AuthService.userHasSecurityGroupPermissions(
                                user,
                                entity.AccessControlGroup,
                                entity,
                                transaction
                            ),
                            AuthService.usersArentBlocked()
                        ]);
                    });
            } else if (entity.CommunityId) {
                return entity.getCommunity().then(community => {
                    return AuthService.gateKeepersLetThrough([
                        AuthService.userHasSecurityGroupPermissions(
                            user,
                            community.contentAccessControl,
                            entity,
                            transaction
                        ),
                        AuthService.userHasSecurityGroupPermissions(
                            user,
                            entity.AccessControlGroup,
                            entity,
                            transaction
                        )
                    ]);
                });
            } else {
                // orphan post?
                return AuthService.userHasSecurityGroupPermissions(
                    user,
                    entity.AccessControlGroup,
                    entity,
                    transaction
                );
            }
        } else if (entity instanceof Comment) {
            /**
             * disallow if
             * viewer alias blocking comment creator
             * comment creator blocking any of viewer aliases
             */
            /**
             * author
             */
            return AuthService.usersArentBlocked();
        } else if (entity instanceof Community) {
            return AuthService.gateKeepersLetThrough([
                AuthService.userHasSecurityGroupPermissions(
                    user,
                    entity.contentAccessControl,
                    entity,
                    transaction
                )
            ]);
        } else {
            return Promise.resolve(true);
        }
    }

    public static gateKeepersLetThrough(promises: Promise<boolean>[]) {
        return Promise.all(promises).then(results => {
            return results.every(Boolean);
        });
    }

    // deprecated
    public static usersArentBlocked() {
        return Promise.resolve(true);
    }

    public static userHasSecurityGroupPermissions(
        user: User,
        accessControlGroup: AccessControlGroup,
        entity: Blog | Community | BlogPost,
        transaction: Transaction
    ) {
        if (!accessControlGroup) {
            return Promise.resolve(true);
        }
        const promises: any = [];
        if (
            accessControlGroup.accessControlSetting ===
            AccessControlGroup.ACCESS_CONTROL_SETTINGS.full
        ) {
            return Promise.resolve(true);
        } else if (
            accessControlGroup.accessControlSetting ===
            AccessControlGroup.ACCESS_CONTROL_SETTINGS.members
        ) {
            if (entity instanceof Community) {
                return user.getAliases({ transaction }).then(aliases => {
                    let isCommunityMember = false;
                    aliases.forEach(alias => {
                        promises.push(
                            entity
                                .hasMember(alias, { transaction })
                                .then(hasMember => {
                                    if (hasMember) {
                                        isCommunityMember = true;
                                    }
                                })
                        );
                    });
                    return Promise.all(promises).then(() => {
                        return Promise.resolve(isCommunityMember);
                    });
                });
            } else {
                // non communities should not have secgroup set to members
                return Promise.resolve(true);
            }
        } else if (
            accessControlGroup.accessControlSetting ===
            AccessControlGroup.ACCESS_CONTROL_SETTINGS.subscribers
        ) {
            // TODO followers/subscribers
            return Promise.resolve(true);
        } else if (
            accessControlGroup.accessControlSetting ===
            AccessControlGroup.ACCESS_CONTROL_SETTINGS.specificInclude
        ) {
            return user.getAliases({ transaction }).then(aliases => {
                let isSpecificGroupMember = false;
                aliases.forEach(alias => {
                    promises.push(
                        accessControlGroup
                            .hasAlias(alias, { transaction })
                            .then(hasAlias => {
                                if (hasAlias) {
                                    isSpecificGroupMember = true;
                                }
                            })
                    );
                });
                return Promise.all(promises).then(() => {
                    return Promise.resolve(isSpecificGroupMember);
                });
            });
        } else if (
            accessControlGroup.accessControlSetting ===
            AccessControlGroup.ACCESS_CONTROL_SETTINGS.specificExclude
        ) {
            return user.getAliases({ transaction }).then(aliases => {
                let isSpecificGroupMember = false;
                aliases.forEach(alias => {
                    promises.push(
                        accessControlGroup
                            .hasAlias(alias, { transaction })
                            .then(hasAlias => {
                                if (hasAlias) {
                                    isSpecificGroupMember = true;
                                }
                            })
                    );
                });
                return Promise.all(promises).then(() => {
                    return Promise.resolve(!isSpecificGroupMember);
                });
            });
        } else {
            return Promise.resolve(true);
        }
    }

    public static userIsCommunityModerator(
        user: User,
        community: Community,
        transaction: Transaction
    ): Promise<boolean> {
        if (user.moderator || user.admin || user.superadmin) {
            return Promise.resolve(true);
        }
        return Promise.all([
            user.getAliases({ transaction }),
            community.getModerators({ transaction })
        ]).then(([userAliases, communityModerators]) =>
            userAliases.some(({ id: userAliasId }) =>
                communityModerators.map(({ id }) => id).includes(userAliasId)
            )
        );
    }

    public static userHasPostPermissionForEntity() {
        // TODO refactor with securityGroups
        return Promise.resolve(true);
    }

    public static getEntitiesAliasCanPostTo(aliasId: number) {
        let eligibleBlogs: Blog[] = [];
        let eligibleCommunities: Community[] = [];

        let promises: Promise<any>[] = [];

        console.log("before alias getblogpromise");
        promises.push(
            Blog.findOne({ where: { AliasId: aliasId } }).then(aliasBlog => {
                if (aliasBlog) {
                    eligibleBlogs.push(aliasBlog);
                }
            })
        );
        promises.push(
            Community.findAll({
                where: Sequelize.literal(
                    `(SELECT EXISTS (SELECT 1 FROM "community_members" WHERE "community_members"."AliasId"=${aliasId} AND "community_members"."CommunityId"="Community"."id"))`
                ),
                include: [
                    {
                        model: AccessControlGroup,
                        as: "postingAccessControl"
                    }
                ]
            }).then(communities => {
                communities.forEach(community => {
                    if (
                        community.postingAccessControl.accessControlSetting ===
                            AccessControlGroup.ACCESS_CONTROL_SETTINGS.full ||
                        community.postingAccessControl.accessControlSetting ===
                            AccessControlGroup.ACCESS_CONTROL_SETTINGS
                                .members ||
                        community.postingAccessControl.accessControlSetting ===
                            AccessControlGroup.ACCESS_CONTROL_SETTINGS
                                .subscribers
                        // TODO SECURITY GROUPS REFACTOR
                    ) {
                        eligibleCommunities.push(community);
                    }
                });
            })
        );

        return Promise.all(promises).then(() => {
            let res = {
                eligibleBlogs,
                eligibleCommunities
            };
            return res;
        });
    }

    public static userHasCommentingPermissions(
        aliasId: number,
        user: User,
        blogPostId: number,
        commentId: number,
        transaction: Transaction
    ) {
        let getBlogpostsPromises: Promise<any>[] = [];
        let useBlogPostId = blogPostId;
        if (!blogPostId) {
            getBlogpostsPromises.push(
                Comment.findByPk(commentId, { transaction }).then(
                    (comment: Comment) => {
                        useBlogPostId = comment.rootBlogPostId;
                    }
                )
            );
        }
        return Promise.all(getBlogpostsPromises).then(() => {
            return BlogPost.getBlogPosts(
                {
                    UserId: user.id,
                    gettingAsUser: user,
                    AliasId: aliasId,
                    blogPostId: useBlogPostId
                },
                transaction
            ).then(blogPosts => {
                return blogPosts.BlogPosts[0].hasCommentPermissions;
            });
        });
    }

    public static getBlogSQLAccessPermissions(currentAlias: number) {
        return [
            // viewer alias blocked blog
            Sequelize.literal(
                `NOT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${currentAlias} AND "Follows"."followBlogId"="Blog"."id" AND "Follows"."followType" = 0)`
            ),
            // viewer alias blocked any blog author users alias
            Sequelize.literal(`NOT EXISTS (
                            SELECT 1 FROM "Follows"
                            FULL OUTER JOIN "Aliases" AS "BlogAuthorAlias"
                                ON "BlogAuthorAlias"."id"="Blog"."AliasId"
                            INNER JOIN "Users"
                                ON "Users"."id"="BlogAuthorAlias"."UserId"
                            FULL OUTER JOIN "Aliases" AS "BlogAuthorAliases"
                                ON "BlogAuthorAliases"."UserId"="Users"."id"
                                WHERE "Follows"."AliasId"=${currentAlias}
                                AND "Follows"."followAliasId"="BlogAuthorAliases"."id"
                                AND "Follows"."followType" = 0)`),
            // blog author blocked any viewers user alias
            Sequelize.literal(`NOT EXISTS (
                            SELECT 1 FROM "Follows"
                            FULL OUTER JOIN "Aliases" AS "ViewerAlias"
                                ON "ViewerAlias"."id"=${currentAlias}
                            INNER JOIN "Users"
                                ON "Users"."id"="ViewerAlias"."UserId"
                            FULL OUTER JOIN "Aliases" AS "ViewerUserAliases"
                                ON "ViewerUserAliases"."UserId"="Users"."id"
                                WHERE "Follows"."AliasId"="Blog"."AliasId"
                                AND "Follows"."followAliasId"="ViewerUserAliases"."id"
                                AND "Follows"."followType" = 0)`),
            // viewer alias is minor and blogpost author is blocking minors
            Sequelize.literal(
                `NOT EXISTS (SELECT 1 FROM "Aliases" AS "AuthorAlias" JOIN "Aliases" AS "ViewerAlias" ON "ViewerAlias"."id"=${currentAlias} WHERE "AuthorAlias"."id"="Blog"."AliasId" AND "AuthorAlias"."showMinors"=FALSE AND "ViewerAlias"."isMinor" = TRUE)`
            ),
            // blogpost author is minor and viewer is blocking minors
            Sequelize.literal(
                `NOT EXISTS (SELECT 1 FROM "Aliases" AS "AuthorAlias" JOIN "Aliases" AS "ViewerAlias" ON "ViewerAlias"."id"=${currentAlias} WHERE "AuthorAlias"."id"="Blog"."AliasId" AND "AuthorAlias"."isMinor"=TRUE AND "ViewerAlias"."showMinors"=FALSE)`
            )
        ];
    }
}

export { AuthService };
