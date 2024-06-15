import express, { Response } from "express";
import {
    Op,
    FindOptions,
    ProjectionAlias,
    OrderItem,
    Transaction
} from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { StatusCodes } from "http-status-codes";

import { auth, AuthRequest } from "../../Authorization/auth";
import { ErrorReportService } from "@services/ErrorReportService";
import { database as sequelize } from "@services/databaseService.js";
import { AuthService } from "@services/AuthService";
import { CommunityController } from "@controllers/CommunityController";
import { FollowController } from "@controllers/FollowController";
import { NotificationController } from "@controllers/NotificationController";
import { tagFunctions } from "@controllers/shared/TagFunctions";
import { User } from "@entities/User";
import { Alias } from "@entities/Alias";
import { Blog } from "@entities/Blog";
import { Community } from "@entities/Community";
import { CommunityInvite } from "@entities/CommunityInvite";
import { Image } from "@entities/Image";
import { CommunityMembershipRequest } from "@entities/CommunityMembershipRequest";
import { BlogPost, orders } from "@entities/BlogPost";
import { Tag } from "@entities/Tag";
import { AccessControlGroup } from "@entities/AccessControlGroup";

const communityRouter = express.Router();

communityRouter.get(
    "/:communityIdentifier/:id(id)?/:order(liked|commented|reblogged|score|id|undefined)?/:noReblogs(no-reblogs)?/:page(\\d+)?",
    auth,
    (req: AuthRequest, res): Promise<any> =>
        sequelize
            .transaction(transaction => {
                const page: number = req.params.page
                    ? Number(req.params.page)
                    : 1;
                const user = req.user;
                const gettingAsUser = req.user;
                const UserId = Number(req.user.id);
                const AliasId = req.currentAlias;
                const order = req.params.order as
                    | undefined
                    | keyof typeof orders;

                return CommunityController.getCommunity(
                    req.params.communityIdentifier,
                    req.currentAlias,
                    !!req.params.id,
                    transaction
                ).then((community: Community) => {
                    if (!community) {
                        return Promise.reject({
                            status: 404,
                            message: "community with that id does not exist"
                        });
                    }
                    if (community.showMinors === false && user.isMinor) {
                        return Promise.reject({
                            status: 404,
                            message: "community does not allow minors"
                        });
                    }
                    const conditions = {
                        UserId,
                        gettingAsUser,
                        AliasId,
                        CommunityId: community.id,
                        excludeEmptyReblogs: !!req.params.noReblogs
                    };
                    return FollowController.getRelevantTagIdsForAlias(
                        AliasId,
                        user.isMinor,
                        transaction
                    ).then(tagIds => {
                        return Promise.all([
                            BlogPost.getBlogPosts(
                                {
                                    ...conditions,
                                    ...(order && { order }),
                                    page,
                                    blockedTagIds: tagIds.blocks
                                },
                                transaction
                            ),
                            Tag.getTagsCount(conditions, transaction),
                            AuthService.userHasEditPermissionsForEntity(
                                community,
                                user,
                                transaction
                            )
                        ]).then(
                            ([results, tagCounts, userHasEditPermissions]) => {
                                let jsonCommunity = community.toJSON();
                                // @ts-ignore
                                jsonCommunity.Tags = community.Tags.map(
                                    CommunityTag => {
                                        return tagFunctions.getDisplayTag(
                                            CommunityTag,
                                            "Community_Tag"
                                        );
                                    }
                                );

                                res.send({
                                    ...jsonCommunity,
                                    ...results,
                                    tagCounts,
                                    page,
                                    type: "community",
                                    links: community.links,
                                    userHasEditPermissions
                                });
                            }
                        );
                    });
                });
            })
            .catch((error: any) => {
                console.error(error);
                res.status(error.status || StatusCodes.BAD_REQUEST).send(
                    ErrorReportService.getEnvError(
                        error.message || error,
                        "community_fetch_fail"
                    )
                );
            })
);

communityRouter.get(
    "/:communityIdentifier/:id(id)?/tags/:tagNames/:order(liked|commented|reblogged|score|id|undefined)?/:noReblogs(no-reblogs)?/:page(\\d+)?",
    auth,
    (req: AuthRequest, res): Promise<any> =>
        sequelize
            .transaction(transaction => {
                const page: number = req.params.page
                    ? Number(req.params.page)
                    : 1;
                const user = req.user;
                const gettingAsUser = req.user;
                const promises: Promise<any>[] = [];
                const UserId = Number(req.user.id);
                const AliasId = req.currentAlias;
                const order = req.params.order as
                    | undefined
                    | keyof typeof orders;

                console.log(req.params);

                return CommunityController.getCommunity(
                    req.params.communityIdentifier,
                    req.currentAlias,
                    !!req.params.id,
                    transaction
                ).then((community: Community) => {
                    if (!community) {
                        return Promise.reject({
                            status: 404,
                            message: "community with that id does not exist"
                        });
                    }

                    let userHasEditPermissions: boolean;
                    promises.push(
                        AuthService.userHasEditPermissionsForEntity(
                            community,
                            user,
                            transaction
                        ).then(hasPermissions => {
                            userHasEditPermissions = hasPermissions;
                        })
                    );

                    const conditions = {
                        UserId,
                        gettingAsUser,
                        AliasId,
                        CommunityId: community.id,
                        tagNames: JSON.parse(req.params.tagNames)
                    };

                    return FollowController.getRelevantTagIdsForAlias(
                        AliasId,
                        user.isMinor,
                        transaction
                    ).then(tagIds => {
                        return Promise.all([
                            BlogPost.getBlogPosts(
                                {
                                    ...conditions,
                                    ...(order && { order }),
                                    page,
                                    blockedTagIds: tagIds.blocks,
                                    excludeEmptyReblogs: !!req.params.noReblogs
                                },
                                transaction
                            ),
                            Tag.getTagsCount(conditions, transaction),
                            ...promises
                        ]).then(([results, tagCounts]) => {
                            let jsonCommunity = community.toJSON();
                            // @ts-ignore
                            jsonCommunity.Tags = community.Tags.map(
                                CommunityTag => {
                                    return tagFunctions.getDisplayTag(
                                        CommunityTag,
                                        "Community_Tag"
                                    );
                                }
                            );
                            res.send({
                                ...jsonCommunity,
                                ...results,
                                tagCounts,
                                page,
                                type: "community",
                                links: community.links,
                                userHasEditPermissions
                            });
                        });
                    });
                });
            })
            .catch((error: any) => {
                console.error(error);
                res.status(error.status || StatusCodes.BAD_REQUEST).send(
                    ErrorReportService.getEnvError(
                        error.message || error,
                        "community_fetch_fail"
                    )
                );
            })
);

communityRouter.get(
    "/:communityId/:id(id)?/followedBy",
    auth,
    (req: AuthRequest, res): void => {
        try {
            const communityIdentifier = req.params.communityIdentifier;
            const isNumber = !isNaN(Number(communityIdentifier));
            const whereCondition = {
                [Op.or]: [
                    { link: communityIdentifier },
                    ...(isNumber ? [{ id: communityIdentifier }] : [])
                ]
            };
            const matchIdAttribute: ProjectionAlias = [
                Sequelize.literal(
                    `"Community"."id"=${sequelize.escape(communityIdentifier)}`
                ),
                "matchId"
            ];
            const orderItem: OrderItem = [
                Sequelize.col("matchId"),
                req.params.id ? "DESC" : "ASC"
            ];
            Community.findOne({
                where: whereCondition,
                include: [
                    {
                        model: Alias,
                        as: "followedBy",
                        attributes: ["id", "name", "avatarId"]
                    }
                ],
                attributes: {
                    include: isNumber ? [matchIdAttribute] : []
                },
                order: [...(isNumber ? [orderItem] : [])]
            }).then((community: Community): void => {
                res.send(community);
            });
        } catch (e) {
            res.send(e);
        }
    }
);

// Create community
communityRouter.post(
    "",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        sequelize
            .transaction(transaction =>
                CommunityController.createCommunity(
                    {
                        alias: req.currentAlias,
                        ...req.body
                    },
                    transaction
                ).then(community => res.send(community))
            )
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e))
);

communityRouter.post(
    "/:communityId",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        sequelize
            .transaction(transaction => {
                const user: User = req.user;
                const alias = req.body.alias;
                const communityId = req.params.communityId;
                return Community.findByPk(communityId, { transaction }).then(
                    (community: Community) => {
                        return AuthService.userHasEditPermissionsForEntity(
                            community,
                            user,
                            transaction
                        ).then(hasPermissions => {
                            if (!hasPermissions) {
                                return res
                                    .status(StatusCodes.BAD_REQUEST)
                                    .send(
                                        ErrorReportService.getEnvError(
                                            "No permissions",
                                            "no_permissions"
                                        )
                                    );
                            }
                            return CommunityController.updateCommunity(
                                community,
                                req.body,
                                alias,
                                transaction
                            ).then(updatedCommunity =>
                                res.send(updatedCommunity)
                            );
                        });
                    }
                );
            })
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e))
);

communityRouter.get(
    "/mycommunities/list",
    auth,
    (req: AuthRequest, res): void => {
        try {
            Community.findAll({
                where: Sequelize.literal(
                    `(SELECT EXISTS (SELECT 1 FROM "community_members" WHERE "community_members"."AliasId"=${req.currentAlias} AND "community_members"."CommunityId"="Community"."id"))`
                ),
                attributes: {
                    include: [
                        [
                            Sequelize.literal(
                                '(SELECT COUNT (*) FROM "community_members" WHERE "CommunityId"="Community"."id")'
                            ),
                            "membersCount"
                        ]
                    ]
                },
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
                        model: Image,
                        as: "coverImage",
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
            })
                .then((communities: Community[]) => {
                    communities.forEach(community =>
                        community.sanitizeContents()
                    );
                    res.send(communities);
                    return communities;
                })
                .catch(e => {
                    res.send(
                        ErrorReportService.getEnvError(
                            e,
                            "fetch_my_communities_fail"
                        )
                    );
                });
        } catch (e) {
            res.status(StatusCodes.BAD_REQUEST).send(e);
        }
    }
);

/*communityRouter.post('/:communityId(\\d+)/tags/add', auth, (req:AuthRequest, res): void => {
    try{
        const user: User = req.user;

        CommunityController.getCommunity(req.params.communityId, req.currentAlias).then(community => {
            if (!community) {
                return Promise.reject("Community with that id does not exist");
            }
            const promises:any = [];
            let userHasEditPermissions:boolean;
            promises.push(AuthService.userHasEditPermissionsForEntity(community, user).then(hasPermissions => {
                userHasEditPermissions = hasPermissions;
            }));
            return Promise.all(promises).then(() => {
                if (false === userHasEditPermissions){
                    res.send(ErrorReportService.getEnvError("No permissions", 'no_permissions'));
                    return;
                }
                return CommunityController.addTags(community, req.body.tags).then(tagsPromises => {
                    res.send("Tags added");
                    return tagsPromises
                })
            })
        }).catch(error => {
            res.send(ErrorReportService.getEnvError(error, "community_tags_add_fail"));
        });

    }catch(error) {
        res.send(ErrorReportService.getEnvError(error, "community_tags_add_fail"));
    };
});*/

/*communityRouter.post('/:communityId(\\d+)/tags/remove', auth, (req:AuthRequest, res:Response) => {
    try{
        const user: User = req.user;

        CommunityController.getCommunity(req.params.communityId, req.currentAlias).then(community => {
            if (!community) {
                return Promise.reject("Community with that id does not exist");
            }
            const promises:any = [];
            let userHasEditPermissions:boolean;
            promises.push(AuthService.userHasEditPermissionsForEntity(community, user).then(hasPermissions => {
                userHasEditPermissions = hasPermissions;
            }));
            return Promise.all(promises).then(() => {
                if (false === userHasEditPermissions){
                    res.send(ErrorReportService.getEnvError("No permissions", 'no_permissions'));
                    return;
                }
                return CommunityController.removeTags(community, req.body.tags).then(tagsPromises => {
                    res.send("Tags removed");
                    return tagsPromises
                })
            })
        }).catch(error => {
            res.send(ErrorReportService.getEnvError(error, "blog_tags_remove_fail"));
        });

    }catch(error) {
        res.send(ErrorReportService.getEnvError(error, "blog_tags_remove_fail"));
    };
});*/

communityRouter.patch(
    "/:communityId/tags",
    auth,
    (req: AuthRequest, res): Promise<void> =>
        sequelize.transaction(transaction =>
            Community.findByPk(Number(req.params.communityId), { transaction })
                .then(community => {
                    if (community) {
                        return CommunityController.setTags(
                            community,
                            req.body.tags,
                            transaction
                        );
                    }
                })
                .then(() => {
                    res.send("Tags edited.");
                })
        )
);

communityRouter.post(
    "/:communityId(\\d+)/moderators/add",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        sequelize
            .transaction(transaction => {
                const user: User = req.user;
                return Community.findOne({
                    where: {
                        id: req.params.communityId
                    },
                    include: [
                        {
                            model: Alias,
                            attributes: ["id", "name", "avatarId"],
                            as: "moderators",
                            through: {
                                attributes: []
                            }
                        }
                    ],
                    attributes: {
                        include: [
                            [
                                Sequelize.fn(
                                    "COUNT",
                                    Sequelize.col("moderators.id")
                                ),
                                "moderatorCount"
                            ]
                        ]
                    },
                    group: ["Community.id"],
                    includeIgnoreAttributes: false,
                    transaction
                } as FindOptions).then(community => {
                    if (!community) {
                        return Promise.reject(
                            "Community with that id does not exist"
                        );
                    }
                    return AuthService.userHasEditPermissionsForEntity(
                        community,
                        user,
                        transaction
                    ).then(hasPermissions => {
                        if (
                            !hasPermissions &&
                            Number(community.getDataValue("moderatorCount"))
                        ) {
                            return Promise.reject(
                                "User has no permission to add moderators."
                            );
                        }
                        return CommunityController.addModerators(
                            community,
                            req.body.moderators,
                            transaction
                        ).then(() => res.send("Moderators added"));
                    });
                });
            })
            .catch(error => {
                console.log(error);
                return res.send(
                    ErrorReportService.getEnvError(
                        error,
                        "community_moderators_add_fail"
                    )
                );
            })
);

communityRouter.post(
    "/:communityId(\\d+)/moderators/remove",
    auth,
    (req: AuthRequest, res: Response) =>
        sequelize
            .transaction(transaction => {
                const user: User = req.user;

                return CommunityController.getCommunity(
                    req.params.communityId,
                    req.currentAlias,
                    undefined,
                    transaction
                ).then(community => {
                    if (!community) {
                        return Promise.reject(
                            "Community with that id does not exist"
                        );
                    }
                    const promises: any = [];
                    let userHasEditPermissions: boolean;
                    promises.push(
                        AuthService.userHasEditPermissionsForEntity(
                            community,
                            user,
                            transaction
                        ).then(hasPermissions => {
                            userHasEditPermissions = hasPermissions;
                        })
                    );
                    return Promise.all(promises).then(() => {
                        if (false === userHasEditPermissions) {
                            res.send(
                                ErrorReportService.getEnvError(
                                    "No permissions",
                                    "no_permissions"
                                )
                            );
                            return;
                        }
                        return CommunityController.removeModerators(
                            community,
                            req.body.moderators,
                            transaction
                        ).then(moderatorPromises => {
                            res.send("Moderators removed");
                            return moderatorPromises;
                        });
                    });
                });
            })
            .catch(error => {
                res.send(
                    ErrorReportService.getEnvError(
                        error,
                        "community_moderators_remove_fail"
                    )
                );
            })
);

communityRouter.get(
    "/:communityId/moderators/:page?",
    auth,
    (req: AuthRequest, res) => {
        const filterBy = req.query.filterBy ? req.query.filterBy : "";
        let aliasId = req.currentAlias;
        let userAliasIds = req.user.AliasIds;
        let userAliasIdsSQLArray = "(" + userAliasIds.join(",") + ")";
        return Alias.findAll({
            where: {
                name: {
                    [Op.iLike]:
                        "%" +
                        filterBy
                            .replace("\\", "\\\\")
                            .replace("%", "\\%")
                            .replace("_", "\\_") +
                        "%"
                },
                [Op.and]: [
                    // only look in a community
                    Sequelize.literal(`EXISTS (
                    SELECT 1 FROM "community_moderators"
                        WHERE "community_moderators"."CommunityId"=${req.params.communityId}
                        AND "community_moderators"."AliasId"="Alias"."id")`),
                    // viewer not blocking any result aliases
                    Sequelize.literal(`NOT EXISTS (
                    SELECT 1 FROM "Follows"
                    INNER JOIN "Users"
                        ON "Users"."id"="Alias"."UserId"
                    FULL OUTER JOIN "Aliases" AS "AliasUserAllAliases"
                        ON "AliasUserAllAliases"."UserId"="Users"."id"
                        WHERE "Follows"."AliasId"=${aliasId}
                        AND "Follows"."followAliasId"="AliasUserAllAliases"."id"
                        AND "Follows"."followType" = 0)`),
                    // found alias not blocking any of viewer aliases
                    Sequelize.literal(`NOT EXISTS (
                    SELECT 1 FROM "Follows"
                        WHERE "Follows"."AliasId"="Alias"."id"
                        AND "Follows"."followAliasId" IN ${userAliasIdsSQLArray}
                        AND "Follows"."followType" = 0)`),
                    // Community members visibility setting is set to members only, viewer must be a member
                    Sequelize.literal(
                        `NOT EXISTS ( SELECT 1 FROM  "AccessControlGroups" INNER JOIN "Communities" ON "Communities"."id" = ${
                            req.params.communityId
                        }  WHERE "AccessControlGroups"."id" = "Communities"."membersAccessControlId" AND "AccessControlGroups"."accessControlSetting" = ${
                            AccessControlGroup.ACCESS_CONTROL_SETTINGS.members
                        } AND NOT EXISTS ( SELECT 1 FROM "community_members" WHERE "community_members"."AliasId" = ${Number(
                            aliasId
                        )} AND "community_members"."CommunityId" = ${
                            req.params.communityId
                        } ))
               
        `
                    ),
                    // viewer alias is blocking minors and found alias is minor
                    Sequelize.literal(
                        `NOT EXISTS (SELECT 1 FROM "Aliases" AS "ViewerAlias" WHERE "ViewerAlias"."id"=${aliasId} AND "Alias"."isMinor"=TRUE AND "ViewerAlias"."showMinors"=FALSE)`
                    ),
                    // viewer alias is minor and foundalias is blocking minors
                    Sequelize.literal(
                        `NOT EXISTS (SELECT 1 FROM "Aliases" AS "ViewerAlias" WHERE "ViewerAlias"."id"=${aliasId} AND "ViewerAlias"."isMinor"=TRUE AND "Alias"."showMinors"=FALSE)`
                    )
                ]
            },
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
            ],
            limit: 50
        })
            .then(members => {
                res.send(members);
                return members;
            })
            .catch(error => {
                console.log(error);
                res.send(
                    ErrorReportService.getEnvError(
                        error,
                        "community_moderators_fetch_fail"
                    )
                );
            });
    }
);

communityRouter.get(
    "/:communityId/members/:page?",
    auth,
    (req: AuthRequest, res) => {
        const filterBy = req.query.filterBy ? req.query.filterBy : "";
        let aliasId = req.currentAlias;
        let userAliasIds = req.user.AliasIds;
        let userAliasIdsSQLArray = "(" + userAliasIds.join(",") + ")";
        return Alias.findAll({
            where: {
                name: {
                    [Op.iLike]:
                        "%" +
                        filterBy
                            .replace("\\", "\\\\")
                            .replace("%", "\\%")
                            .replace("_", "\\_") +
                        "%"
                },
                [Op.and]: [
                    // only look in a community
                    Sequelize.literal(`EXISTS (
                        SELECT 1 FROM "community_members"
                            WHERE "community_members"."CommunityId"=${req.params.communityId}
                            AND "community_members"."AliasId"="Alias"."id")`),
                    // viewer not blocking any result aliases
                    Sequelize.literal(`NOT EXISTS (
                        SELECT 1 FROM "Follows"
                        INNER JOIN "Users"
                            ON "Users"."id"="Alias"."UserId"
                        FULL OUTER JOIN "Aliases" AS "AliasUserAllAliases"
                            ON "AliasUserAllAliases"."UserId"="Users"."id"
                            WHERE "Follows"."AliasId"=${aliasId}
                            AND "Follows"."followAliasId"="AliasUserAllAliases"."id"
                            AND "Follows"."followType" = 0)`),
                    // found alias not blocking any of viewer aliases
                    Sequelize.literal(`NOT EXISTS (
                        SELECT 1 FROM "Follows"
                            WHERE "Follows"."AliasId"="Alias"."id"
                            AND "Follows"."followAliasId" IN ${userAliasIdsSQLArray}
                            AND "Follows"."followType" = 0)`),

                    // community has view members permissions set to members only and alias is not a member
                    Sequelize.literal(
                        `NOT EXISTS ( SELECT 1 FROM  "AccessControlGroups" INNER JOIN "Communities" ON "Communities"."id" = ${
                            req.params.communityId
                        }  WHERE "AccessControlGroups"."id" = "Communities"."membersAccessControlId" AND "AccessControlGroups"."accessControlSetting" = ${
                            AccessControlGroup.ACCESS_CONTROL_SETTINGS.members
                        } AND NOT EXISTS ( SELECT 1 FROM "community_members" WHERE "community_members"."AliasId" = ${Number(
                            aliasId
                        )} AND "community_members"."CommunityId" = ${
                            req.params.communityId
                        } ))
               
        `
                    ),
                    // viewer alias is blocking minors and found alias is minor
                    Sequelize.literal(
                        `NOT EXISTS (SELECT 1 FROM "Aliases" AS "ViewerAlias" WHERE "ViewerAlias"."id"=${aliasId} AND "Alias"."isMinor"=TRUE AND "ViewerAlias"."showMinors"=FALSE)`
                    ),
                    // viewer alias is minor and foundalias is blocking minors
                    Sequelize.literal(
                        `NOT EXISTS (SELECT 1 FROM "Aliases" AS "ViewerAlias" WHERE "ViewerAlias"."id"=${aliasId} AND "ViewerAlias"."isMinor"=TRUE AND "Alias"."showMinors"=FALSE)`
                    )
                ]
            },
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
            ],
            limit: 50
        })
            .then(members => {
                res.send(members);
                return members;
            })
            .catch(error => {
                console.log(error);
                res.send(
                    ErrorReportService.getEnvError(
                        error,
                        "community_moderators_fetch_fail"
                    )
                );
            });
    }
);

communityRouter.post(
    "/:communityId(\\d+)/members/requests/create",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        sequelize
            .transaction(transaction => {
                const user: User = req.user;
                return Community.findOne({
                    where: {
                        id: req.params.communityId
                    },
                    include: [
                        {
                            model: Alias,
                            as: "members",
                            attributes: ["id", "name", "avatarId"],
                            through: {
                                attributes: []
                            }
                        }
                    ],
                    attributes: {
                        include: [
                            [
                                Sequelize.fn(
                                    "COUNT",
                                    Sequelize.col("members.id")
                                ),
                                "memberCount"
                            ]
                        ]
                    },
                    group: ["Community.id"],
                    includeIgnoreAttributes: false,
                    transaction
                } as FindOptions).then(community => {
                    if (!community) {
                        return Promise.reject(
                            "Community with that id does not exist"
                        );
                    }
                    return AuthService.userHasViewPermissionForEntity(
                        community,
                        user,
                        transaction
                    ).then(hasPermissions => {
                        if (!hasPermissions) {
                            return Promise.reject("No permissions");
                        }
                        if (
                            community.requireApproval &&
                            Number(community.getDataValue("memberCount"))
                        ) {
                            return CommunityController.createMembershipRequest(
                                community,
                                req.currentAlias,
                                transaction
                            ).then(membershipRequest =>
                                res.send(membershipRequest)
                            );
                        } else {
                            return Promise.all([
                                community.addMember(req.currentAlias, {
                                    transaction
                                }),
                                FollowController.create(
                                    "community",
                                    community.id,
                                    "follow",
                                    req.currentAlias,
                                    transaction
                                ),
                                community.getModerators({ transaction })
                            ]).then((response: any[]) => {
                                // tslint:disable-next-line:no-magic-numbers
                                if (response && response[2]) {
                                    // force disable tslint because of
                                    // tslint:disable-next-line:no-magic-numbers
                                    const moderatorAliasIds: number[] = response[2].map(
                                        (x: any) => x.id
                                    );
                                    return Promise.all(
                                        moderatorAliasIds.map(id =>
                                            NotificationController.create(
                                                req.currentAlias,
                                                Promise.resolve(id),
                                                "join",
                                                {
                                                    targetCommunityId:
                                                        community.id
                                                },
                                                undefined,
                                                transaction
                                            )
                                        )
                                    ).then(() => {
                                        return res.send("Joined community");
                                    });
                                }
                            });
                        }
                    });
                });
            })
            .catch(e => res.send(e.stack))
);

communityRouter.post(
    "/:communityId(\\d+)/members/requests/:page(\\d+)",
    auth,
    (req: AuthRequest, res: Response) =>
        sequelize
            .transaction(transaction => {
                const user: User = req.user;

                return CommunityController.getCommunity(
                    req.params.communityId,
                    req.currentAlias,
                    undefined,
                    transaction
                ).then(community => {
                    if (!community) {
                        return Promise.reject(
                            "Community with that id does not exist"
                        );
                    }

                    const promises: any = [];
                    let userHasEditPermissions: boolean;
                    promises.push(
                        AuthService.userHasEditPermissionsForEntity(
                            community,
                            user,
                            transaction
                        ).then(hasPermissions => {
                            userHasEditPermissions = hasPermissions;
                        })
                    );
                    return Promise.all(promises).then(() => {
                        if (false === userHasEditPermissions) {
                            res.send(
                                ErrorReportService.getEnvError(
                                    "No permissions",
                                    "no_permissions"
                                )
                            );
                            return;
                        }
                        return CommunityController.getMembershipRequests(
                            community,
                            transaction
                        ).then(membershipRequests => {
                            res.send(membershipRequests);
                        });
                    });
                });
            })
            .catch(e => {
                res.send(
                    ErrorReportService.getEnvError(
                        e,
                        "community_membershipRequest_get_fail"
                    )
                );
            })
);

communityRouter.post(
    "/:communityId(\\d+)/members/requests/accept",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        sequelize
            .transaction(transaction =>
                Promise.all([
                    CommunityController.getCommunity(
                        req.params.communityId,
                        req.currentAlias,
                        undefined,
                        transaction
                    ).then(community => {
                        if (!community) {
                            return Promise.reject(
                                "Community with that id does not exist"
                            );
                        }
                        return AuthService.userHasEditPermissionsForEntity(
                            community,
                            req.user,
                            transaction
                        ).then(hasPermissions => {
                            if (!hasPermissions) {
                                return Promise.reject(
                                    "User does not have permissions"
                                );
                            }
                            return community;
                        });
                    }),
                    CommunityMembershipRequest.findByPk(req.body.requestId, {
                        transaction
                    }).then(membershipRequest => {
                        if (!membershipRequest) {
                            return Promise.reject(
                                "Membership request with that id does not exist"
                            );
                        }
                        return membershipRequest;
                    })
                ]).then(([community, membershipRequest]) =>
                    Promise.all([
                        community
                            .addMember(membershipRequest.AliasId, {
                                transaction
                            })
                            .then(() =>
                                req.app.emit("accept-member", {
                                    community,
                                    aliasId: membershipRequest.AliasId,
                                    sourceAliasId: req.currentAlias
                                })
                            ),
                        membershipRequest.update(
                            {
                                status:
                                    CommunityMembershipRequest.REQUEST_STATUSES
                                        .accepted
                            },
                            { transaction }
                        ),
                        FollowController.create(
                            "community",
                            community.id,
                            "follow",
                            membershipRequest.AliasId,
                            transaction
                        )
                    ]).then(() => res.send("Member added"))
                )
            )
            .catch(e => res.send(e))
);

communityRouter.post(
    "/:communityId(\\d+)/members/requests/reject",
    auth,
    (req: AuthRequest, res: Response) =>
        sequelize
            .transaction(transaction => {
                const user: User = req.user;
                const requestId = req.body.requestId;

                return CommunityController.getCommunity(
                    req.params.communityId,
                    req.currentAlias,
                    undefined,
                    transaction
                ).then(community => {
                    if (!community) {
                        return Promise.reject(
                            "Community with that id does not exist"
                        );
                    }
                    const promises: any = [];
                    let userHasEditPermissions: boolean;
                    promises.push(
                        AuthService.userHasEditPermissionsForEntity(
                            community,
                            user,
                            transaction
                        ).then(hasPermissions => {
                            userHasEditPermissions = hasPermissions;
                        })
                    );
                    return Promise.all(promises).then(() => {
                        if (false === userHasEditPermissions) {
                            return res.send(
                                ErrorReportService.getEnvError(
                                    "No permissions",
                                    "no_permissions"
                                )
                            );
                        }
                        return CommunityMembershipRequest.findByPk(requestId, {
                            transaction
                        }).then(
                            (membershipRequest: CommunityMembershipRequest) =>
                                CommunityController.rejectMembershipRequest(
                                    membershipRequest,
                                    transaction
                                ).then(() => {
                                    return res.send("Request denied");
                                })
                        );
                    });
                });
            })
            .catch(e => {
                res.send(
                    ErrorReportService.getEnvError(
                        e,
                        "community_membershipRequest_accept_fail"
                    )
                );
            })
);

const removeMember = (
    id: number,
    community: Community,
    transaction: Transaction
): Promise<any> =>
    Promise.all([
        community.removeModerator(id, { transaction }),
        community.removeMember(id, { transaction })
    ]);

communityRouter.post(
    "/:communityId(\\d+)/members/remove",
    auth,
    (req: AuthRequest, res: Response): Promise<Response> =>
        sequelize
            .transaction(transaction => {
                const user: User = req.user;
                const removeMemberId: number = req.body.removeMemberId;
                return Community.findByPk(req.params.communityId, {
                    transaction
                })
                    .then(community => {
                        if (!community) {
                            return Promise.reject(
                                "Community with that id does not exist"
                            );
                        }
                        if (req.currentAlias === removeMemberId) {
                            return removeMember(
                                removeMemberId,
                                community,
                                transaction
                            );
                        } else {
                            return AuthService.userHasEditPermissionsForEntity(
                                community,
                                user,
                                transaction
                            ).then(hasPermissions => {
                                if (!hasPermissions) {
                                    return Promise.reject(
                                        ErrorReportService.getEnvError(
                                            "No permissions",
                                            "no_permissions"
                                        )
                                    );
                                }
                                return removeMember(
                                    removeMemberId,
                                    community,
                                    transaction
                                );
                            });
                        }
                    })
                    .then(() => res.send("Member removed"));
            })
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e))
);

communityRouter.post(
    "/:communityId(\\d+)/members/invites",
    auth,
    (req: AuthRequest, res): Promise<any> =>
        sequelize
            .transaction(transaction => {
                const currentAlias = Number(req.currentAlias);
                const user: User = req.user;
                const invitedAliasId = Number(req.body.invitedAliasId);
                const CommunityId = Number(req.params.communityId);

                if (!invitedAliasId) {
                    throw new Error("Invalid invited alias ID");
                }

                return Community.findByPk(CommunityId, { transaction })
                    .then(community => {
                        if (!community) {
                            throw new Error("Invalid community ID");
                        }

                        return AuthService.userHasViewPermissionForEntity(
                            community,
                            user,
                            transaction
                        );
                    })
                    .then((verified: boolean) => {
                        if (verified) {
                            return CommunityInvite.findOrCreate({
                                where: {
                                    CommunityId,
                                    inviterId: currentAlias,
                                    invitedId: invitedAliasId
                                },
                                transaction
                            });
                        } else {
                            return Promise.reject(
                                "The user is not a member of this community."
                            );
                        }
                    })
                    .then(() => {
                        return NotificationController.create(
                            currentAlias,
                            Promise.resolve(invitedAliasId),
                            "invite",
                            { targetCommunityId: CommunityId },
                            undefined,
                            transaction
                        );
                    })
                    .then(() => {
                        return res.send("Invitation sent.");
                    });
            })
            .catch(e => {
                console.log(e);
                return res.status(StatusCodes.BAD_REQUEST).send(e);
            })
);

communityRouter.get(
    "/:communityId(\\d+)/members/invites/accept",
    auth,
    (req: AuthRequest, res): Promise<any> =>
        sequelize
            .transaction(transaction => {
                const CommunityId = Number(req.params.communityId);
                const currentAlias = Number(req.currentAlias);

                return CommunityInvite.findAll({
                    where: {
                        CommunityId,
                        invitedId: currentAlias
                    },
                    transaction
                })
                    .then(invites => {
                        if (invites.length) {
                            return invites[0].accept(transaction);
                        } else {
                            return Promise.reject("The invite was not found.");
                        }
                    })
                    .then((result: string) => {
                        return res.send(result);
                    });
            })
            .catch(e => {
                return res.send(e);
            })
);

communityRouter.get(
    "/:communityId(\\d+)/members/invites/reject",
    auth,
    (req: AuthRequest, res): Promise<any> => {
        const CommunityId = Number(req.params.communityId);
        const currentAlias = Number(req.currentAlias);

        return CommunityInvite.destroy({
            where: {
                CommunityId,
                invitedId: currentAlias
            }
        }).then(() => {
            return res.send("Invite rejected.");
        });
    }
);

communityRouter.get("/:communityId/:page?/mock", (req, res): void => {
    const page = req.params.page ? req.params.page : 1;

    const responseObject = {
        id: req.params.communityId,
        page,
        name: "The arkham caffee",
        link: "/community/arkhcaffee",
        type: "community",
        links: [
            {
                link: "https://twitter.com/hashtag/batman",
                text: "our twitter"
            },
            {
                link:
                    "https://www.researchgate.net/publication/323457818_An_Anarchist_Manifesto",
                text: "Group rules"
            }
        ],
        tags: [
            {
                id: 123,
                name: "batman",
                style: "background-color: black; font-weight:bold"
            },
            {
                id: 124,
                name: "gotham",
                style: "background-color: purple; font-weight:bold"
            },
            {
                id: 125,
                name: "JOKER",
                style: "background-color: black; font-weight:bold"
            },
            {
                id: 126,
                name: "DC",
                style: "background-color: purple; font-weight:bold"
            },
            {
                id: 127,
                name: "comics",
                style: "background-color: black; font-weight:bold"
            },
            {
                id: 128,
                name: "movies",
                style: "background-color: purple; font-weight:bold"
            }
        ],
        avatar: {
            name: "community avatar",
            image: "https://avatarfiles.alphacoders.com/186/186960.jpg"
        },
        coverPhoto: {
            name: "community cover photo",
            image:
                "https://www.f-covers.com/cover/batman-looking-at-gotham-city-facebook-cover-timeline-banner-for-fb.jpg"
        },
        description:
            "The latest and hottest takes on the current happenings of the Gotham city",
        blogPosts: [
            {
                id: 68,
                origin: {
                    type: "community",
                    id: 99,
                    name: "The arkham caffee",
                    link: "/community/arkhcaffee"
                },
                alias: {
                    name: "Alias name",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                    id: 1001
                },
                content:
                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum",
                image: {
                    src:
                        "https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg",
                    name: "gotham city"
                },
                gallery: [
                    {
                        src:
                            "https://www.bostonherald.com/wp-content/uploads/2019/04/0425-fea-bhr-L-gotham.jpg",
                        name: "galleryimagename1"
                    },
                    {
                        src:
                            "https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg",
                        name: "galleryimagename2"
                    }
                ],
                tags: [
                    {
                        id: 123,
                        name: "batman",
                        style: "background-color: black; font-weight:bold" // Tags should ideally be styled by the tagmaker but this is a security risk
                    },
                    {
                        id: 123,
                        name: "gotham",
                        style: "background-color: purple; font-weight:bold"
                    }
                ],
                engagementStats: {
                    likes: 12,
                    comments: 13,
                    reblogs: 2,
                    bumps: 3
                },
                dateCreated: "01-24-2019, 07:21",
                dateUpdated: "01-26-2019, 12:21",
                comments: [
                    {
                        id: 2,
                        content:
                            "Lorem Ipsum is simply dummy text of the printing <br><img src = 'https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png'> <br> and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Batboy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 111
                        },
                        engagementStats: {
                            likes: 12,
                            comments: 13
                        },
                        dateCreated: "01-24-2019, 07:21",
                        dateUpdated: "01-26-2019, 12:21",
                        comments: [
                            {
                                id: 3,
                                content:
                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                alias: {
                                    name: "joker",
                                    image:
                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                    id: 222
                                },
                                engagementStats: {
                                    likes: 4,
                                    comments: 5
                                },
                                dateCreated: "01-24-2019, 07:21",
                                dateUpdated: "01-26-2019, 12:21",
                                comments: [
                                    {
                                        id: 4,
                                        content:
                                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                        alias: {
                                            name: "joker",
                                            image:
                                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                            id: 222
                                        },
                                        engagementStats: {
                                            likes: 1,
                                            comments: 4
                                        },
                                        dateCreated: "01-24-2019, 07:21",
                                        dateUpdated: "01-26-2019, 12:21",
                                        comments: [
                                            {
                                                id: 5,
                                                content:
                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                alias: {
                                                    name: "batboy",
                                                    image:
                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                    id: 111
                                                },
                                                engagementStats: {
                                                    likes: 12,
                                                    comments: 3
                                                },
                                                dateCreated:
                                                    "01-24-2019, 07:21",
                                                dateUpdated:
                                                    "01-26-2019, 12:21",
                                                comments: [
                                                    {
                                                        id: 6,
                                                        content:
                                                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                        alias: {
                                                            name: "joker",
                                                            image:
                                                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                            id: 222
                                                        },
                                                        engagementStats: {
                                                            likes: 5,
                                                            comments: 2
                                                        },
                                                        dateCreated:
                                                            "01-24-2019, 07:21",
                                                        dateUpdated:
                                                            "01-26-2019, 12:21",
                                                        comments: [
                                                            {
                                                                id: 7,
                                                                content:
                                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                                alias: {
                                                                    name:
                                                                        "batboy",
                                                                    image:
                                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                                    id: 111
                                                                },
                                                                engagementStats: {
                                                                    likes: 1,
                                                                    comments: 0
                                                                },
                                                                dateCreated:
                                                                    "01-24-2019, 07:21",
                                                                dateUpdated:
                                                                    "01-26-2019, 12:21",
                                                                comments: [] as any
                                                            },
                                                            {
                                                                id: 8,
                                                                content:
                                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                                alias: {
                                                                    name:
                                                                        "joker",
                                                                    image:
                                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                                    id: 102
                                                                },
                                                                engagementStats: {
                                                                    likes: 2,
                                                                    comments: 0
                                                                },
                                                                dateCreated:
                                                                    "01-24-2019, 07:21",
                                                                dateUpdated:
                                                                    "01-26-2019, 12:21",
                                                                comments: []
                                                            }
                                                        ]
                                                    }
                                                ]
                                            },
                                            {
                                                id: 4,
                                                content:
                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                alias: {
                                                    name: "joker",
                                                    image:
                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                    id: 102
                                                },
                                                engagementStats: {
                                                    likes: 12,
                                                    comments: 13
                                                },
                                                dateCreated:
                                                    "01-24-2019, 07:21",
                                                dateUpdated:
                                                    "01-26-2019, 12:21",
                                                comments: []
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                id: 4,
                                content:
                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                alias: {
                                    name: "joker",
                                    image:
                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                    id: 102
                                },
                                engagementStats: {
                                    likes: 12,
                                    comments: 13
                                },
                                dateCreated: "01-24-2019, 07:21",
                                dateUpdated: "01-26-2019, 12:21",
                                comments: []
                            }
                        ]
                    },
                    {
                        id: 21,
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Batboy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 111
                        },
                        engagementStats: {
                            likes: 2,
                            comments: 0
                        },
                        dateCreated: "01-24-2019, 07:21",
                        dateUpdated: "01-26-2019, 12:21",
                        comments: []
                    },
                    {
                        id: 22,
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "joker",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 222
                        },
                        engagementStats: {
                            likes: 0,
                            comments: 0
                        },
                        dateCreated: "01-24-2019, 07:21",
                        dateUpdated: "01-26-2019, 12:21",
                        comments: []
                    }
                ]
            },
            {
                id: 111,
                origin: {
                    type: "community",
                    id: 98,
                    name: "The arkham caffee",
                    link: "/community/arkhcaffee"
                },
                alias: {
                    name: "Batboy",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                    id: 504
                },
                content:
                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum",
                image: {
                    src:
                        "https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg",
                    name: "gotham city"
                },
                gallery: [
                    {
                        src:
                            "https://www.bostonherald.com/wp-content/uploads/2019/04/0425-fea-bhr-L-gotham.jpg",
                        name: "galleryimagename1"
                    },
                    {
                        src:
                            "https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg",
                        name: "galleryimagename2"
                    }
                ],
                tags: [
                    {
                        id: 123,
                        name: "batman",
                        style: "background-color: black; font-weight:bold" // Tags should ideally be styled by the tagmaker but this is a security risk
                    },
                    {
                        id: 123,
                        name: "gotham",
                        style: "background-color: purple; font-weight:bold"
                    }
                ],
                engagementStats: {
                    likes: 12,
                    comments: 13,
                    reblogs: 2,
                    bumps: 3
                },
                dateCreated: "01-24-2019, 07:21",
                dateUpdated: "01-26-2019, 12:21",
                comments: [
                    {
                        id: 2,
                        content:
                            "Lorem Ipsum is simply dummy text of the printing <br><img src = 'https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png'> <br> and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Batboy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 111
                        },
                        engagementStats: {
                            likes: 12,
                            comments: 13
                        },
                        dateCreated: "01-24-2019, 07:21",
                        dateUpdated: "01-26-2019, 12:21",
                        comments: [
                            {
                                id: 3,
                                content:
                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                alias: {
                                    name: "joker",
                                    image:
                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                    id: 222
                                },
                                engagementStats: {
                                    likes: 4,
                                    comments: 5
                                },
                                dateCreated: "01-24-2019, 07:21",
                                dateUpdated: "01-26-2019, 12:21",
                                comments: [
                                    {
                                        id: 4,
                                        content:
                                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                        alias: {
                                            name: "joker",
                                            image:
                                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                            id: 222
                                        },
                                        engagementStats: {
                                            likes: 1,
                                            comments: 4
                                        },
                                        dateCreated: "01-24-2019, 07:21",
                                        dateUpdated: "01-26-2019, 12:21",
                                        comments: [
                                            {
                                                id: 5,
                                                content:
                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                alias: {
                                                    name: "batboy",
                                                    image:
                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                    id: 111
                                                },
                                                engagementStats: {
                                                    likes: 12,
                                                    comments: 3
                                                },
                                                dateCreated:
                                                    "01-24-2019, 07:21",
                                                dateUpdated:
                                                    "01-26-2019, 12:21",
                                                comments: [
                                                    {
                                                        id: 6,
                                                        content:
                                                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                        alias: {
                                                            name: "joker",
                                                            image:
                                                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                            id: 222
                                                        },
                                                        engagementStats: {
                                                            likes: 5,
                                                            comments: 2
                                                        },
                                                        dateCreated:
                                                            "01-24-2019, 07:21",
                                                        dateUpdated:
                                                            "01-26-2019, 12:21",
                                                        comments: [
                                                            {
                                                                id: 7,
                                                                content:
                                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                                alias: {
                                                                    name:
                                                                        "batboy",
                                                                    image:
                                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                                    id: 111
                                                                },
                                                                engagementStats: {
                                                                    likes: 1,
                                                                    comments: 0
                                                                },
                                                                dateCreated:
                                                                    "01-24-2019, 07:21",
                                                                dateUpdated:
                                                                    "01-26-2019, 12:21",
                                                                comments: []
                                                            },
                                                            {
                                                                id: 8,
                                                                content:
                                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                                alias: {
                                                                    name:
                                                                        "joker",
                                                                    image:
                                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                                    id: 102
                                                                },
                                                                engagementStats: {
                                                                    likes: 2,
                                                                    comments: 0
                                                                },
                                                                dateCreated:
                                                                    "01-24-2019, 07:21",
                                                                dateUpdated:
                                                                    "01-26-2019, 12:21",
                                                                comments: []
                                                            }
                                                        ]
                                                    }
                                                ]
                                            },
                                            {
                                                id: 4,
                                                content:
                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                alias: {
                                                    name: "joker",
                                                    image:
                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                    id: 102
                                                },
                                                engagementStats: {
                                                    likes: 12,
                                                    comments: 13
                                                },
                                                dateCreated:
                                                    "01-24-2019, 07:21",
                                                dateUpdated:
                                                    "01-26-2019, 12:21",
                                                comments: []
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                id: 4,
                                content:
                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                alias: {
                                    name: "joker",
                                    image:
                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                    id: 102
                                },
                                engagementStats: {
                                    likes: 12,
                                    comments: 13
                                },
                                dateCreated: "01-24-2019, 07:21",
                                dateUpdated: "01-26-2019, 12:21",
                                comments: []
                            }
                        ]
                    },
                    {
                        id: 21,
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Batboy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 111
                        },
                        engagementStats: {
                            likes: 2,
                            comments: 0
                        },
                        dateCreated: "01-24-2019, 07:21",
                        dateUpdated: "01-26-2019, 12:21",
                        comments: []
                    },
                    {
                        id: 22,
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "joker",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 222
                        },
                        engagementStats: {
                            likes: 0,
                            comments: 0
                        },
                        dateCreated: "01-24-2019, 07:21",
                        dateUpdated: "01-26-2019, 12:21",
                        comments: []
                    }
                ]
            },
            {
                id: 222,
                origin: {
                    type: "community",
                    id: 99,
                    name: "The arkham caffee",
                    link: "/community/arkhcaffee"
                },
                alias: {
                    name: "Batgirl",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                    id: 5050
                },
                content:
                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum",
                image: {
                    src:
                        "https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg",
                    name: "gotham city"
                },
                gallery: [
                    {
                        src:
                            "https://www.bostonherald.com/wp-content/uploads/2019/04/0425-fea-bhr-L-gotham.jpg",
                        name: "galleryimagename1"
                    },
                    {
                        src:
                            "https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg",
                        name: "galleryimagename2"
                    }
                ],
                tags: [
                    {
                        id: 123,
                        name: "batman",
                        style: "background-color: black; font-weight:bold" // Tags should ideally be styled by the tagmaker but this is a security risk
                    },
                    {
                        id: 123,
                        name: "gotham",
                        style: "background-color: purple; font-weight:bold"
                    }
                ],
                engagementStats: {
                    likes: 12,
                    comments: 13,
                    reblogs: 2,
                    bumps: 3
                },
                dateCreated: "01-24-2019, 07:21",
                dateUpdated: "01-26-2019, 12:21",
                comments: [
                    {
                        id: 2,
                        content:
                            "Lorem Ipsum is simply dummy text of the printing <br><img src = 'https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png'> <br> and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Batboy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 111
                        },
                        engagementStats: {
                            likes: 12,
                            comments: 13
                        },
                        dateCreated: "01-24-2019, 07:21",
                        dateUpdated: "01-26-2019, 12:21",
                        comments: [
                            {
                                id: 3,
                                content:
                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                alias: {
                                    name: "joker",
                                    image:
                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                    id: 222
                                },
                                engagementStats: {
                                    likes: 4,
                                    comments: 5
                                },
                                dateCreated: "01-24-2019, 07:21",
                                dateUpdated: "01-26-2019, 12:21",
                                comments: [
                                    {
                                        id: 4,
                                        content:
                                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                        alias: {
                                            name: "joker",
                                            image:
                                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                            id: 222
                                        },
                                        engagementStats: {
                                            likes: 1,
                                            comments: 4
                                        },
                                        dateCreated: "01-24-2019, 07:21",
                                        dateUpdated: "01-26-2019, 12:21",
                                        comments: [
                                            {
                                                id: 5,
                                                content:
                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                alias: {
                                                    name: "batboy",
                                                    image:
                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                    id: 111
                                                },
                                                engagementStats: {
                                                    likes: 12,
                                                    comments: 3
                                                },
                                                dateCreated:
                                                    "01-24-2019, 07:21",
                                                dateUpdated:
                                                    "01-26-2019, 12:21",
                                                comments: [
                                                    {
                                                        id: 6,
                                                        content:
                                                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                        alias: {
                                                            name: "joker",
                                                            image:
                                                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                            id: 222
                                                        },
                                                        engagementStats: {
                                                            likes: 5,
                                                            comments: 2
                                                        },
                                                        dateCreated:
                                                            "01-24-2019, 07:21",
                                                        dateUpdated:
                                                            "01-26-2019, 12:21",
                                                        comments: [
                                                            {
                                                                id: 7,
                                                                content:
                                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                                alias: {
                                                                    name:
                                                                        "batboy",
                                                                    image:
                                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                                    id: 111
                                                                },
                                                                engagementStats: {
                                                                    likes: 1,
                                                                    comments: 0
                                                                },
                                                                dateCreated:
                                                                    "01-24-2019, 07:21",
                                                                dateUpdated:
                                                                    "01-26-2019, 12:21",
                                                                comments: []
                                                            },
                                                            {
                                                                id: 8,
                                                                content:
                                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                                alias: {
                                                                    name:
                                                                        "joker",
                                                                    image:
                                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                                    id: 102
                                                                },
                                                                engagementStats: {
                                                                    likes: 2,
                                                                    comments: 0
                                                                },
                                                                dateCreated:
                                                                    "01-24-2019, 07:21",
                                                                dateUpdated:
                                                                    "01-26-2019, 12:21",
                                                                comments: []
                                                            }
                                                        ]
                                                    }
                                                ]
                                            },
                                            {
                                                id: 4,
                                                content:
                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                alias: {
                                                    name: "joker",
                                                    image:
                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                    id: 102
                                                },
                                                engagementStats: {
                                                    likes: 12,
                                                    comments: 13
                                                },
                                                dateCreated:
                                                    "01-24-2019, 07:21",
                                                dateUpdated:
                                                    "01-26-2019, 12:21",
                                                comments: []
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                id: 4,
                                content:
                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                alias: {
                                    name: "joker",
                                    image:
                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                    id: 102
                                },
                                engagementStats: {
                                    likes: 12,
                                    comments: 13
                                },
                                dateCreated: "01-24-2019, 07:21",
                                dateUpdated: "01-26-2019, 12:21",
                                comments: []
                            }
                        ]
                    },
                    {
                        id: 21,
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Batboy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 111
                        },
                        engagementStats: {
                            likes: 2,
                            comments: 0
                        },
                        dateCreated: "01-24-2019, 07:21",
                        dateUpdated: "01-26-2019, 12:21",
                        comments: []
                    },
                    {
                        id: 22,
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "joker",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 222
                        },
                        engagementStats: {
                            likes: 0,
                            comments: 0
                        },
                        dateCreated: "01-24-2019, 07:21",
                        dateUpdated: "01-26-2019, 12:21",
                        comments: []
                    }
                ]
            },
            {
                id: 333,
                origin: {
                    type: "community",
                    id: 99,
                    name: "The arkham caffee",
                    link: "/community/arkhcaffee"
                },
                alias: {
                    name: "Catman",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                    id: 505
                },
                content:
                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum",
                image: {
                    src:
                        "https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg",
                    name: "gotham city"
                },
                gallery: [
                    {
                        src:
                            "https://www.bostonherald.com/wp-content/uploads/2019/04/0425-fea-bhr-L-gotham.jpg",
                        name: "galleryimagename1"
                    },
                    {
                        src:
                            "https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg",
                        name: "galleryimagename2"
                    }
                ],
                tags: [
                    {
                        id: 123,
                        name: "batman",
                        style: "background-color: black; font-weight:bold" // Tags should ideally be styled by the tagmaker but this is a security risk
                    },
                    {
                        id: 123,
                        name: "gotham",
                        style: "background-color: purple; font-weight:bold"
                    }
                ],
                engagementStats: {
                    likes: 12,
                    comments: 13,
                    reblogs: 2,
                    bumps: 3
                },
                dateCreated: "01-24-2019, 07:21",
                dateUpdated: "01-26-2019, 12:21",
                comments: [
                    {
                        id: 2,
                        content:
                            "Lorem Ipsum is simply dummy text of the printing <br><img src = 'https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png'> <br> and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Batboy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 111
                        },
                        engagementStats: {
                            likes: 12,
                            comments: 13
                        },
                        dateCreated: "01-24-2019, 07:21",
                        dateUpdated: "01-26-2019, 12:21",
                        comments: [
                            {
                                id: 3,
                                content:
                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                alias: {
                                    name: "joker",
                                    image:
                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                    id: 222
                                },
                                engagementStats: {
                                    likes: 4,
                                    comments: 5
                                },
                                dateCreated: "01-24-2019, 07:21",
                                dateUpdated: "01-26-2019, 12:21",
                                comments: [
                                    {
                                        id: 4,
                                        content:
                                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                        alias: {
                                            name: "joker",
                                            image:
                                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                            id: 222
                                        },
                                        engagementStats: {
                                            likes: 1,
                                            comments: 4
                                        },
                                        dateCreated: "01-24-2019, 07:21",
                                        dateUpdated: "01-26-2019, 12:21",
                                        comments: [
                                            {
                                                id: 5,
                                                content:
                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                alias: {
                                                    name: "batboy",
                                                    image:
                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                    id: 111
                                                },
                                                engagementStats: {
                                                    likes: 12,
                                                    comments: 3
                                                },
                                                dateCreated:
                                                    "01-24-2019, 07:21",
                                                dateUpdated:
                                                    "01-26-2019, 12:21",
                                                comments: [
                                                    {
                                                        id: 6,
                                                        content:
                                                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                        alias: {
                                                            name: "joker",
                                                            image:
                                                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                            id: 222
                                                        },
                                                        engagementStats: {
                                                            likes: 5,
                                                            comments: 2
                                                        },
                                                        dateCreated:
                                                            "01-24-2019, 07:21",
                                                        dateUpdated:
                                                            "01-26-2019, 12:21",
                                                        comments: [
                                                            {
                                                                id: 7,
                                                                content:
                                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                                alias: {
                                                                    name:
                                                                        "batboy",
                                                                    image:
                                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                                    id: 111
                                                                },
                                                                engagementStats: {
                                                                    likes: 1,
                                                                    comments: 0
                                                                },
                                                                dateCreated:
                                                                    "01-24-2019, 07:21",
                                                                dateUpdated:
                                                                    "01-26-2019, 12:21",
                                                                comments: []
                                                            },
                                                            {
                                                                id: 8,
                                                                content:
                                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                                alias: {
                                                                    name:
                                                                        "joker",
                                                                    image:
                                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                                    id: 102
                                                                },
                                                                engagementStats: {
                                                                    likes: 2,
                                                                    comments: 0
                                                                },
                                                                dateCreated:
                                                                    "01-24-2019, 07:21",
                                                                dateUpdated:
                                                                    "01-26-2019, 12:21",
                                                                comments: []
                                                            }
                                                        ]
                                                    }
                                                ]
                                            },
                                            {
                                                id: 4,
                                                content:
                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                alias: {
                                                    name: "joker",
                                                    image:
                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                    id: 102
                                                },
                                                engagementStats: {
                                                    likes: 12,
                                                    comments: 13
                                                },
                                                dateCreated:
                                                    "01-24-2019, 07:21",
                                                dateUpdated:
                                                    "01-26-2019, 12:21",
                                                comments: []
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                id: 4,
                                content:
                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                alias: {
                                    name: "joker",
                                    image:
                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                    id: 102
                                },
                                engagementStats: {
                                    likes: 12,
                                    comments: 13
                                },
                                dateCreated: "01-24-2019, 07:21",
                                dateUpdated: "01-26-2019, 12:21",
                                comments: []
                            }
                        ]
                    },
                    {
                        id: 21,
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Batboy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 111
                        },
                        engagementStats: {
                            likes: 2,
                            comments: 0
                        },
                        dateCreated: "01-24-2019, 07:21",
                        dateUpdated: "01-26-2019, 12:21",
                        comments: []
                    },
                    {
                        id: 22,
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "joker",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 222
                        },
                        engagementStats: {
                            likes: 0,
                            comments: 0
                        },
                        dateCreated: "01-24-2019, 07:21",
                        dateUpdated: "01-26-2019, 12:21",
                        comments: []
                    }
                ]
            },
            {
                id: 444,
                origin: {
                    type: "community",
                    id: 99,
                    name: "The arkham caffee",
                    link: "/community/arkhcaffee"
                },
                alias: {
                    name: "Officer Pebbles",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                    id: 506
                },
                content:
                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum",
                image: {
                    src:
                        "https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg",
                    name: "gotham city"
                },
                gallery: [
                    {
                        src:
                            "https://www.bostonherald.com/wp-content/uploads/2019/04/0425-fea-bhr-L-gotham.jpg",
                        name: "galleryimagename1"
                    },
                    {
                        src:
                            "https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg",
                        name: "galleryimagename2"
                    }
                ],
                tags: [
                    {
                        id: 123,
                        name: "batman",
                        style: "background-color: black; font-weight:bold" // Tags should ideally be styled by the tagmaker but this is a security risk
                    },
                    {
                        id: 123,
                        name: "gotham",
                        style: "background-color: purple; font-weight:bold"
                    }
                ],
                engagementStats: {
                    likes: 12,
                    comments: 13,
                    reblogs: 2,
                    bumps: 3
                },
                dateCreated: "01-24-2019, 07:21",
                dateUpdated: "01-26-2019, 12:21",
                comments: [
                    {
                        id: 2,
                        content:
                            "Lorem Ipsum is simply dummy text of the printing <br><img src = 'https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png'> <br> and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Batboy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 111
                        },
                        engagementStats: {
                            likes: 12,
                            comments: 13
                        },
                        dateCreated: "01-24-2019, 07:21",
                        dateUpdated: "01-26-2019, 12:21",
                        comments: [
                            {
                                id: 3,
                                content:
                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                alias: {
                                    name: "joker",
                                    image:
                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                    id: 222
                                },
                                engagementStats: {
                                    likes: 4,
                                    comments: 5
                                },
                                dateCreated: "01-24-2019, 07:21",
                                dateUpdated: "01-26-2019, 12:21",
                                comments: [
                                    {
                                        id: 4,
                                        content:
                                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                        alias: {
                                            name: "joker",
                                            image:
                                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                            id: 222
                                        },
                                        engagementStats: {
                                            likes: 1,
                                            comments: 4
                                        },
                                        dateCreated: "01-24-2019, 07:21",
                                        dateUpdated: "01-26-2019, 12:21",
                                        comments: [
                                            {
                                                id: 5,
                                                content:
                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                alias: {
                                                    name: "batboy",
                                                    image:
                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                    id: 111
                                                },
                                                engagementStats: {
                                                    likes: 12,
                                                    comments: 3
                                                },
                                                dateCreated:
                                                    "01-24-2019, 07:21",
                                                dateUpdated:
                                                    "01-26-2019, 12:21",
                                                comments: [
                                                    {
                                                        id: 6,
                                                        content:
                                                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                        alias: {
                                                            name: "joker",
                                                            image:
                                                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                            id: 222
                                                        },
                                                        engagementStats: {
                                                            likes: 5,
                                                            comments: 2
                                                        },
                                                        dateCreated:
                                                            "01-24-2019, 07:21",
                                                        dateUpdated:
                                                            "01-26-2019, 12:21",
                                                        comments: [
                                                            {
                                                                id: 7,
                                                                content:
                                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                                alias: {
                                                                    name:
                                                                        "batboy",
                                                                    image:
                                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                                    id: 111
                                                                },
                                                                engagementStats: {
                                                                    likes: 1,
                                                                    comments: 0
                                                                },
                                                                dateCreated:
                                                                    "01-24-2019, 07:21",
                                                                dateUpdated:
                                                                    "01-26-2019, 12:21",
                                                                comments: []
                                                            },
                                                            {
                                                                id: 8,
                                                                content:
                                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                                alias: {
                                                                    name:
                                                                        "joker",
                                                                    image:
                                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                                    id: 102
                                                                },
                                                                engagementStats: {
                                                                    likes: 2,
                                                                    comments: 0
                                                                },
                                                                dateCreated:
                                                                    "01-24-2019, 07:21",
                                                                dateUpdated:
                                                                    "01-26-2019, 12:21",
                                                                comments: []
                                                            }
                                                        ]
                                                    }
                                                ]
                                            },
                                            {
                                                id: 4,
                                                content:
                                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                alias: {
                                                    name: "joker",
                                                    image:
                                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                                    id: 102
                                                },
                                                engagementStats: {
                                                    likes: 12,
                                                    comments: 13
                                                },
                                                dateCreated:
                                                    "01-24-2019, 07:21",
                                                dateUpdated:
                                                    "01-26-2019, 12:21",
                                                comments: []
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                id: 4,
                                content:
                                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                alias: {
                                    name: "joker",
                                    image:
                                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                                    id: 102
                                },
                                engagementStats: {
                                    likes: 12,
                                    comments: 13
                                },
                                dateCreated: "01-24-2019, 07:21",
                                dateUpdated: "01-26-2019, 12:21",
                                comments: []
                            }
                        ]
                    },
                    {
                        id: 21,
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Batboy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 111
                        },
                        engagementStats: {
                            likes: 2,
                            comments: 0
                        },
                        dateCreated: "01-24-2019, 07:21",
                        dateUpdated: "01-26-2019, 12:21",
                        comments: []
                    },
                    {
                        id: 22,
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "joker",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 222
                        },
                        engagementStats: {
                            likes: 0,
                            comments: 0
                        },
                        dateCreated: "01-24-2019, 07:21",
                        dateUpdated: "01-26-2019, 12:21",
                        comments: []
                    }
                ]
            }
        ]
    };

    res.send(responseObject);
});

communityRouter.delete("/:communityId/mock", (req: AuthRequest, res): void => {
    try {
        const id = req.params.communityId;
        const alias = req.body.alias;

        if (id && alias) {
            res.send({ id });
        } else {
            res.status(StatusCodes.BAD_REQUEST).send("bad data");
        }
    } catch {
        res.status(StatusCodes.BAD_REQUEST).send("bad data");
    }
});

communityRouter.post("/rule/mock", (req: AuthRequest, res): void => {
    try {
        const alias = req.body.alias;
        const ruleName = req.body.ruleName;
        const description = req.body.description;
        const communityId = req.body.communityId;

        if (alias && ruleName && description && communityId) {
            res.status(StatusCodes.CREATED).send({ id: 123 });
        } else {
            res.status(StatusCodes.BAD_REQUEST).send("bad data");
        }
    } catch {
        res.status(StatusCodes.BAD_REQUEST).send("bad data");
    }
});

communityRouter.get(
    "/:communityId/members/:page?/mock",
    (req: AuthRequest, res): void => {
        const page = req.params.page ? req.params.page : 1;

        const responseObject = {
            page,
            members: [
                {
                    alias: {
                        name: "Batboy",
                        image:
                            "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                        id: 504
                    }
                },
                {
                    alias: {
                        name: "Annoying guy",
                        image:
                            "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                        id: 1002
                    }
                },
                {
                    alias: {
                        name: "Annoying guy",
                        image:
                            "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                        id: 1002
                    }
                },
                {
                    alias: {
                        name: "Batboy",
                        image:
                            "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                        id: 504
                    }
                },
                {
                    alias: {
                        name: "Annoying guy",
                        image:
                            "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                        id: 1002
                    }
                },
                {
                    alias: {
                        name: "Annoying guy",
                        image:
                            "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                        id: 1002
                    }
                },
                {
                    alias: {
                        name: "Batboy",
                        image:
                            "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                        id: 504
                    }
                },
                {
                    alias: {
                        name: "Annoying guy",
                        image:
                            "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                        id: 1002
                    }
                },
                {
                    alias: {
                        name: "Annoying guy",
                        image:
                            "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                        id: 1002
                    }
                }
            ]
        };

        res.send(responseObject);
    }
);

communityRouter.get(
    "/:communityId/members/requests/:page?/mock",
    (req: AuthRequest, res): void => {
        const page = req.params.page ? req.params.page : 1;

        const responseObject = {
            page,
            membershipRequests: [
                {
                    alias: {
                        name: "Batboy",
                        image:
                            "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                        id: 504
                    },
                    dateRequested: "2019-12-24T00:10:03.698Z"
                },
                {
                    alias: {
                        name: "Annoying guy",
                        image:
                            "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                        id: 1002
                    },
                    dateRequested: "2019-12-24T00:10:03.698Z"
                },
                {
                    alias: {
                        name: "Batboy",
                        image:
                            "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                        id: 504
                    },
                    dateRequested: "2019-12-24T00:10:03.698Z"
                },
                {
                    alias: {
                        name: "Annoying guy",
                        image:
                            "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                        id: 1002
                    },
                    dateRequested: "2019-12-24T00:10:03.698Z"
                },
                {
                    alias: {
                        name: "Batboy",
                        image:
                            "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                        id: 504
                    },
                    dateRequested: "2019-12-24T00:10:03.698Z"
                },
                {
                    alias: {
                        name: "Annoying guy",
                        image:
                            "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                        id: 1002
                    },
                    dateRequested: "2019-12-24T00:10:03.698Z"
                }
            ]
        };

        res.send(responseObject);
    }
);

communityRouter.post(
    "/:communityId/members/requests/reject/mock",
    (req: AuthRequest, res): void => {
        try {
            const alias = req.body.alias;
            const invitedUserId = req.body.invitedUserId;

            if (alias && invitedUserId) {
                res.send("Membership rejected");
            } else {
                res.status(StatusCodes.BAD_REQUEST).send("bad data");
            }
        } catch {
            res.status(StatusCodes.BAD_REQUEST).send("bad data");
        }
    }
);

communityRouter.post(
    "/:communityId/members/requests/create/mock",
    (req: AuthRequest, res): void => {
        try {
            const alias = req.body.alias;

            if (alias) {
                res.status(StatusCodes.CREATED).send("Request to join sent");
            } else {
                res.status(StatusCodes.BAD_REQUEST).send("bad data");
            }
        } catch {
            res.status(StatusCodes.BAD_REQUEST).send("bad data");
        }
    }
);

export { communityRouter };
