import { Blog } from "@entities/Blog";
import {
    BlogPostInterface,
    CreateBlogPostInterface
} from "../Interface/BlogPostInterface";
import { Alias } from "@entities/Alias";
import { Tag } from "@entities/Tag";
import { BlogPost } from "@entities/BlogPost";
import { Image } from "@entities/Image";
import { Comment } from "@entities/Comment";
import { Reaction } from "@entities/Reaction";
import { Community } from "@entities/Community";
import { AccessControlGroupController } from "./AccessControlGroupController";
import { CommentsController } from "./CommentsController";
import { User } from "@entities/User";
import { Notification } from "@entities/Notification";
import { ModerationAction } from "@entities/ModerationAction";
import { AccessControlGroup } from "@entities/AccessControlGroup";
import { Model } from "sequelize-typescript";
import { AuthService } from "@services/AuthService";
import { Transaction } from "sequelize";
import { NotificationController } from "@controllers/NotificationController";
import { tagFunctions } from "./shared/TagFunctions";

class BlogPostController {
    public createBlogPost(
        blogPostParams: CreateBlogPostInterface,
        user: User,
        transaction: Transaction
    ): Promise<BlogPost> {
        const aliasParam = blogPostParams.alias;
        const community = blogPostParams.community;
        const content = blogPostParams.content;
        return BlogPost.create(
            {
                content,
                hideFromSearchResults: blogPostParams.hideFromSearchResults
            },
            { transaction }
        )
            .then((blogPost: BlogPost) => {
                return blogPost;
            })
            .then((blogPost: BlogPost) => {
                const promises: Promise<any>[] = [];

                if (blogPostParams.tagDisplays) {
                    promises.push(
                        blogPost.setTagsWithDisplayNames(
                            blogPostParams.tagDisplays,
                            transaction
                        )
                    );
                } else if (blogPostParams.tags) {
                    promises.push(
                        blogPost.setTagsWithNeo4j(
                            blogPostParams.tags,
                            transaction
                        )
                    );
                }

                if (blogPostParams.tagNames) {
                    promises.push(
                        this.setTags(
                            blogPost,
                            blogPostParams.tagNames,
                            transaction
                        )
                    );
                }

                if (community) {
                    promises.push(
                        blogPost.setCommunity(community, { transaction })
                    );
                } else {
                    promises.push(
                        Blog.findOne({
                            where: {
                                AliasId: aliasParam
                            },
                            transaction
                        }).then(blog => {
                            if (blog) {
                                return blogPost.setBlog(blog.id, {
                                    transaction
                                });
                            }
                        })
                    );
                }
                promises.push(blogPost.setAlias(aliasParam, { transaction }));

                if (
                    typeof blogPostParams.contentAccessControl !== "undefined"
                ) {
                    promises.push(
                        AccessControlGroupController.createAccessControlGroup(
                            blogPostParams.contentAccessControl,
                            aliasParam,
                            transaction
                        ).then(result => {
                            return blogPost.setAccessControlGroup(result, {
                                transaction
                            });
                        })
                    );
                }

                let privacyGroupsPromises: Promise<any>[] = [];
                blogPostParams.viewingPrivacyGroups?.forEach(
                    viewingPrivacyGroupId => {
                        privacyGroupsPromises.push(
                            AccessControlGroup.findByPk(
                                viewingPrivacyGroupId
                            ).then(acg => {
                                return AuthService.userHasEditPermissionsForEntity(
                                    acg,
                                    user,
                                    transaction
                                ).then(hasPermissions => {
                                    if (false === hasPermissions) {
                                        return;
                                    }
                                    if (acg) {
                                        return blogPost.addViewingAccessControlGroup(
                                            acg,
                                            { transaction }
                                        );
                                    }
                                });
                            })
                        );
                    }
                );
                blogPostParams.commentingPrivacyGroups?.forEach(
                    commentingPrivacyGroupId => {
                        privacyGroupsPromises.push(
                            AccessControlGroup.findByPk(
                                commentingPrivacyGroupId
                            ).then(acg => {
                                return AuthService.userHasEditPermissionsForEntity(
                                    acg,
                                    user,
                                    transaction
                                ).then(hasPermissions => {
                                    if (false === hasPermissions) {
                                        return;
                                    }
                                    if (acg) {
                                        return blogPost.addCommentingAccessControlGroup(
                                            acg,
                                            { transaction }
                                        );
                                    }
                                });
                            })
                        );
                    }
                );

                promises.push(...privacyGroupsPromises);

                const reblogParam = blogPostParams.reblogOfBlogPost;
                if (reblogParam) {
                    promises.push(
                        blogPost
                            .setReblogOfBlogPost(
                                blogPostParams.reblogOfBlogPost,
                                { transaction }
                            )
                            .then(() =>
                                BlogPost.findByPk(reblogParam, {
                                    include: [
                                        {
                                            model: BlogPost,
                                            as: "r"
                                        }
                                    ],
                                    transaction
                                }).then(reblogOrigin => {
                                    if (reblogOrigin) {
                                        const reblogChainBlogPostIds = reblogOrigin.r
                                            .map(({ id }) => id)
                                            .concat(
                                                reblogOrigin.content.trim()
                                                    .length ||
                                                    !reblogOrigin.r.length
                                                    ? reblogParam
                                                    : []
                                            );
                                        const reblogRootId = Math.min(
                                            ...reblogChainBlogPostIds
                                        );
                                        const isReblog: boolean =
                                            reblogRootId !==
                                            Number(reblogParam);
                                        const sameAuthor: boolean =
                                            reblogOrigin.AliasId ===
                                            reblogOrigin.r.find(
                                                ({ id }) => id === reblogRootId
                                            )?.AliasId;
                                        return Promise.all([
                                            blogPost.setR(
                                                reblogChainBlogPostIds,
                                                { transaction }
                                            ),
                                            this.createNotification(
                                                aliasParam,
                                                reblogParam,
                                                blogPost.id,
                                                isReblog,
                                                transaction
                                            ),
                                            ...(isReblog && !sameAuthor
                                                ? [
                                                      this.createNotification(
                                                          aliasParam,
                                                          reblogRootId,
                                                          blogPost.id,
                                                          undefined,
                                                          transaction
                                                      )
                                                  ]
                                                : [])
                                        ]);
                                    }
                                })
                            )
                    );
                }

                return Promise.all(promises).then(() => {
                    return blogPost.save({ transaction });
                });
            });
    }

    public updateBlogPost(
        blogPost: BlogPost,
        blogPostParameters: BlogPostInterface,
        transaction: Transaction
    ): Promise<BlogPost> {
        if (typeof blogPostParameters.content !== "undefined") {
            blogPost.content = blogPostParameters.content;
        }
        if (typeof blogPostParameters.hideFromSearchResults !== "undefined") {
            blogPost.hideFromSearchResults =
                blogPostParameters.hideFromSearchResults;
        }

        const promises: Promise<any>[] = [];

        if (blogPostParameters.tagDisplays) {
            promises.push(
                blogPost.setTagsWithDisplayNames(
                    blogPostParameters.tagDisplays,
                    transaction
                )
            );
        }

        if (blogPostParameters.tagNames) {
            promises.push(
                this.setTags(blogPost, blogPostParameters.tagNames, transaction)
            );
        }

        if (blogPostParameters.commentingPrivacyGroups) {
            // TODO possible security issue, in theory able to assign other peoples privacy groups, though it doesnt display aliases that belong to it
            promises.push(
                blogPost.setCommentingAccessControlGroups(
                    blogPostParameters.commentingPrivacyGroups,
                    { transaction }
                )
            );
        }
        if (blogPostParameters.viewingPrivacyGroups) {
            promises.push(
                blogPost.setViewingAccessControlGroups(
                    blogPostParameters.viewingPrivacyGroups,
                    { transaction }
                )
            );
        }

        return Promise.all(promises).then(() => {
            return blogPost.save({ transaction });
        });
    }

    public getBlogPost(
        blogPostId: number | string,
        user: User,
        aliasId: number,
        transaction: Transaction
    ): Promise<BlogPost> {
        const promises: Promise<void>[] = [];
        let numLikes = 0;
        let numReblogs = 0;
        let numComments = 0;
        let userLiked = false;
        let userHasEditPermissions = false;
        promises.push(
            Reaction.count({
                where: { BlogPostId: blogPostId },
                transaction
            }).then(countReactions => {
                numLikes = countReactions;
            })
        );
        if (user) {
            promises.push(
                Reaction.findOne({
                    where: { BlogPostId: blogPostId, AliasId: user.AliasIds },
                    transaction
                }).then(reaction => {
                    if (reaction) {
                        userLiked = true;
                    }
                })
            );
        }
        promises.push(
            BlogPost.count({
                where: { reblogOfBlogPostId: blogPostId },
                transaction
            }).then(reblogs => {
                numReblogs = reblogs;
            })
        );
        promises.push(
            Comment.count({
                where: { rootBlogPostId: blogPostId },
                transaction
            }).then(comments => {
                numComments = comments;
            })
        );

        return BlogPost.findOne({
            where: { id: blogPostId },
            include: [
                { model: Blog },
                { model: Community },
                {
                    model: Tag,
                    attributes: ["id", "name", "style"],
                    // weird flex but supposedly this is the kosher way of not including the join table
                    through: { attributes: [] }
                },
                {
                    model: Alias,
                    attributes: ["id", "name", "avatarId"],
                    include: [
                        {
                            model: Image,
                            as: "avatar",
                            attributes: [
                                "id",
                                "src",
                                "name",
                                "alt",
                                "identifier",
                                "context"
                            ]
                        }
                    ]
                },
                {
                    model: AccessControlGroup,
                    as: "AccessControlGroup"
                },
                {
                    model: AccessControlGroup,
                    as: "viewingAccessControlGroups"
                },
                {
                    model: AccessControlGroup,
                    as: "commentingAccessControlGroups"
                },
                {
                    model: Comment,
                    include: [
                        {
                            model: Alias,
                            attributes: ["id", "name", "avatarId"],
                            include: [
                                {
                                    model: Image,
                                    as: "avatar",
                                    attributes: [
                                        "id",
                                        "src",
                                        "name",
                                        "alt",
                                        "identifier",
                                        "context"
                                    ]
                                }
                            ]
                        },
                        {
                            model: Comment,
                            as: "childComments",
                            include: [
                                {
                                    model: Alias,
                                    attributes: ["id", "name", "avatarId"],
                                    include: [
                                        {
                                            model: Image,
                                            as: "avatar",
                                            attributes: [
                                                "id",
                                                "src",
                                                "name",
                                                "alt",
                                                "identifier",
                                                "context"
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    model: BlogPost,
                    as: "reblogOfBlogPost",
                    include: [
                        {
                            model: Alias,
                            attributes: ["id", "name", "avatarId"],
                            include: [
                                {
                                    model: Image,
                                    as: "avatar",
                                    attributes: [
                                        "id",
                                        "src",
                                        "name",
                                        "alt",
                                        "identifier",
                                        "context"
                                    ]
                                }
                            ]
                        },
                        { model: Blog },
                        { model: Community }
                    ]
                }
            ],
            transaction
        }).then((blogPost: BlogPost) => {
            if (!blogPost) {
                return Promise.reject("blog post does not exist");
            }

            if (user) {
                promises.push(
                    AuthService.userHasEditPermissionsForEntity(
                        blogPost,
                        user,
                        transaction
                    ).then(hasEditPermissions => {
                        userHasEditPermissions = hasEditPermissions;
                    })
                );
            }

            blogPost.sanitizeContents();
            const comments: Comment[] = [];
            blogPost.Comments.forEach(comment => {
                promises.push(
                    CommentsController.getComment(
                        comment.id,
                        user,
                        aliasId,
                        transaction
                    ).then(fullComment => {
                        comments.push(fullComment);
                    })
                );
            });
            // @ts-ignore
            return Promise.all(promises).then(() => {
                blogPost.setDataValue("Comments", comments);
                blogPost.setDataValue("userLiked", userLiked);
                blogPost.setDataValue(
                    "userHasEditPermissions",
                    userHasEditPermissions
                );
                blogPost.userHasEditPermissions = userHasEditPermissions;
                blogPost.setDataValue(
                    "viewingAccessControlGroups",
                    user
                        ? user.AliasIds.includes(blogPost.AliasId)
                            ? blogPost.viewingAccessControlGroups
                            : []
                        : []
                );
                blogPost.setDataValue(
                    "commentingAccessControlGroups",
                    user
                        ? user.AliasIds.includes(blogPost.AliasId)
                            ? blogPost.commentingAccessControlGroups
                            : []
                        : []
                );
                if (blogPost.Blog) {
                    blogPost.setDataValue("origin", {
                        type: "blog",
                        id: blogPost.Blog.id,
                        name: blogPost.Blog.name,
                        link: blogPost.Blog.link
                    });
                } else if (blogPost.Community) {
                    blogPost.setDataValue("origin", {
                        type: "community",
                        id: blogPost.Community.id,
                        name: blogPost.Community.name,
                        link: blogPost.Community.link
                    });
                }

                if (blogPost.reblogOfBlogPost) {
                    if (blogPost.reblogOfBlogPost.Blog) {
                        blogPost.reblogOfBlogPost.setDataValue("origin", {
                            type: "blog",
                            id: blogPost.reblogOfBlogPost.Blog.id,
                            name: blogPost.reblogOfBlogPost.Blog.name,
                            link: blogPost.reblogOfBlogPost.Blog.link
                        });
                    } else if (blogPost.reblogOfBlogPost.Community) {
                        blogPost.reblogOfBlogPost.setDataValue("origin", {
                            type: "community",
                            id: blogPost.reblogOfBlogPost.Community.id,
                            name: blogPost.reblogOfBlogPost.Community.name,
                            link: blogPost.reblogOfBlogPost.Community.link
                        });
                    }
                }
                blogPost.setDataValue("engagementStats", {
                    likes: numLikes,
                    // TODO engagementstats
                    comments: numComments,
                    reblogs: numReblogs,
                    bumps: 0
                });

                return blogPost;
            });
        });
    }

    public removeBlogPost(
        blogPostId: number,
        aliasId: number,
        transaction: Transaction
    ) {
        return BlogPost.findOne({
            where: { id: blogPostId },
            transaction
        }).then((blogPost: BlogPost) => {
            if (blogPost.AliasId !== aliasId) {
                return Promise.reject("Alias not owner of blogPost");
            } else {
                const promises: Promise<any>[] = [
                    blogPost.destroy({ transaction }),
                    ...(blogPost.reblogOfBlogPostId
                        ? [
                              Notification.destroy({
                                  where: {
                                      sourceReblogId: blogPost.id
                                  },
                                  transaction
                              })
                          ]
                        : [])
                ];
                return Promise.all(promises);
            }
        });
    }

    public moderatorRemoveBlogPost(
        blogPostId: number,
        AliasId: number,
        reason: string,
        transaction: Transaction
    ): Promise<ModerationAction> {
        return BlogPost.findOne({
            where: { id: blogPostId },
            include: [
                {
                    model: Blog
                },
                {
                    model: Community
                },
                {
                    model: BlogPost,
                    as: "r",
                    include: [
                        { model: Blog },
                        { model: Community },
                        {
                            model: Alias,
                            attributes: ["id", "name", "avatarId"],
                            include: [
                                {
                                    model: Image,
                                    as: "avatar",
                                    attributes: [
                                        "id",
                                        "src",
                                        "name",
                                        "alt",
                                        "identifier",
                                        "context"
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    model: BlogPost,
                    as: "reblogOfBlogPost",
                    include: [
                        { model: Blog },
                        { model: Community },
                        {
                            model: Alias,
                            attributes: ["id", "name", "avatarId"],
                            include: [
                                {
                                    model: Image,
                                    as: "avatar",
                                    attributes: [
                                        "id",
                                        "src",
                                        "name",
                                        "alt",
                                        "identifier",
                                        "context"
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    model: Tag,
                    attributes: ["id", "name", "style"],
                    // weird flex but supposedly this is the kosher way of not including the join table
                    through: { attributes: [] }
                },
                {
                    model: Alias,
                    attributes: ["id", "name", "avatarId"],
                    include: [
                        {
                            model: Image,
                            as: "avatar",
                            attributes: [
                                "id",
                                "src",
                                "name",
                                "alt",
                                "identifier",
                                "context"
                            ]
                        },
                        {
                            model: Blog
                        }
                    ]
                }
            ],
            transaction
        }).then(blogPost => {
            if (!blogPost) {
                return Promise.reject("No such blog post.");
            }
            const promises: Promise<any>[] = [
                ModerationAction.create({
                    AliasId,
                    reason,
                    details: {
                        action: "delete",
                        item: "blog-post",
                        blogPost: blogPost.toJSON()
                    },
                    transaction
                }),
                blogPost.destroy({ transaction }),
                ...(blogPost.reblogOfBlogPostId
                    ? [
                          Notification.destroy({
                              where: {
                                  sourceReblogId: blogPost.id
                              },
                              transaction
                          })
                      ]
                    : [])
            ];
            return Promise.all(promises).then(
                ([moderationAction]) => moderationAction
            );
        });
    }

    public addTags(
        blogPost: BlogPost,
        tagParams: (number | Tag)[],
        transaction: Transaction
    ): Promise<void> {
        return tagFunctions.addTags(blogPost, tagParams, transaction);
    }

    public removeTags(
        blogPost: BlogPost,
        tagParams: (number | Tag)[],
        transaction: Transaction
    ): Promise<void> {
        return tagFunctions.removeTags(blogPost, tagParams, transaction);
    }

    public setTags(
        blogPost: BlogPost,
        tagNames: string[],
        transaction: Transaction
    ): Promise<void> {
        return Promise.all(
            tagNames.map((tagName: string) =>
                Tag.findOrCreateWithNeo4j(tagName, transaction)
            )
        ).then((tags: Tag[]) => blogPost.setTagsWithNeo4j(tags, transaction));
    }

    public getCommunityBlogPosts(communityId: number, offset = 0) {
        return BlogPost.findAll({
            where: { CommunityId: communityId },
            limit: 8,
            offset,
            order: [["createdAt", "DESC"]]
        });
    }

    public getBlogBlogPosts(blogId: number, offset = 0) {
        return BlogPost.findAll({
            where: { BlogId: blogId },
            limit: 8,
            offset,
            order: [["createdAt", "DESC"]]
        });
    }

    // previously we copied tags from blog or community onto blogpost, but that was undesireable so this is dead code now
    public copyTags(
        promises: Promise<void>[],
        other: number | Blog | Community | undefined,
        model: typeof Model,
        blogPostTags: number[] | undefined
        // blogPost: BlogPost
    ): void {
        if (other) {
            const id: number = typeof other === "number" ? other : other.id;
            promises.push(
                Tag.findAll({
                    include: [
                        {
                            model,
                            where: {
                                id
                            },
                            through: { attributes: [] }
                        }
                    ]
                }).then(tags => {
                    const tagAddPromises: Promise<void>[] = [];
                    tags.forEach(tag => {
                        if (!blogPostTags || !blogPostTags.includes(tag.id)) {
                            tagAddPromises.push();
                        }
                    });
                    return Promise.all(tagAddPromises).then(() => undefined);
                })
            );
        }
    }

    public createNotification(
        aliasId: number,
        reblogOfBlogPostId: number,
        sourceReblogId: number,
        reblog = false,
        transaction: Transaction
    ): Promise<any> {
        const getTargetAliasId = BlogPost.findByPk(reblogOfBlogPostId, {
            transaction
        }).then((rebloggedPost: BlogPost): number => rebloggedPost.AliasId);
        return NotificationController.create(
            aliasId,
            getTargetAliasId,
            "reblog",
            { targetBlogPostId: reblogOfBlogPostId, sourceReblogId },
            reblog,
            transaction
        );
    }
}

export const blogPostsPerPage = 8;

const controller = new BlogPostController();
export { controller as BlogPostController };
