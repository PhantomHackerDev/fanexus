import { CommunityInterface } from "../Interface/CommunityInterface";
import { AccessControlGroupInterface } from "../Interface/AccessControlGroupInterface";
import { ImageInterface } from "../Interface/ImageInterface";
import { Community } from "../Entity/Community";
import { Image } from "../Entity/Image";
import { ImageController } from "./ImageController";
import { AccessControlGroupController } from "./AccessControlGroupController";
import { User } from "../Entity/User";
import { Alias } from "../Entity/Alias";
import { ErrorReportService } from "../services/ErrorReportService";
import { AccessControlGroup } from "../Entity/AccessControlGroup";
import { Tag } from "../Entity/Tag";
import { BlogPost } from "../Entity/BlogPost";
import { CommunityMembershipRequest } from "../Entity/CommunityMembershipRequest";
import { Sequelize, Op, ProjectionAlias, OrderItem } from "sequelize";
import { database as sequelize } from "../services/databaseService.js";
import { tagFunctions } from "./shared/TagFunctions";
import { CommunityRulesInterface } from "../Interface/CommunityRulesInterface";
import { CommunityRules } from "../Entity/CommunityRules";
import { Follow } from "../Entity/Follow";
import { TagDisplayInterface } from "../Interface/TagDisplayInterface";
import { Transaction } from "sequelize";

export interface CreateCommunityInterface {
    alias: number;
    name: string;
    description: string;
    tagNames: string[];
    avatar?: ImageInterface;
    coverImage?: ImageInterface;
    link: string;
    links: string[];
    rules: { name: string; description: string }[];
    showMinors: boolean;
    hideFromSearchResults: boolean;
    requireApproval: boolean;
    contentAccessControl: AccessControlGroupInterface;
    commentsAccessControl: AccessControlGroupInterface;
    reactionsAccessControl: AccessControlGroupInterface;
    followsAccessControl: AccessControlGroupInterface;
    membersAccessControl: AccessControlGroupInterface;
    postingAccessControl: AccessControlGroupInterface;
    tagDisplays?: TagDisplayInterface[];
}

class CommunityController {
    public getCommunity(
        communityIdentifier: string,
        currentAlias: number,
        id = false,
        transaction: Transaction
    ): Promise<Community> {
        // TODO check access control
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
            id ? "DESC" : "ASC"
        ];
        return Community.findOne({
            where: whereCondition,
            include: [
                {
                    model: AccessControlGroup,
                    as: "contentAccessControl"
                },
                {
                    model: AccessControlGroup,
                    as: "commentsAccessControl"
                },
                {
                    model: AccessControlGroup,
                    as: "reactionsAccessControl"
                },
                {
                    model: AccessControlGroup,
                    as: "followsAccessControl"
                },
                {
                    model: AccessControlGroup,
                    as: "membersAccessControl"
                },
                {
                    model: AccessControlGroup,
                    as: "postingAccessControl"
                },
                {
                    model: CommunityRules,
                    as: "communityRules"
                },
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
                },
                {
                    model: Tag,
                    attributes: ["id", "name", "style"],
                    // weird flex but supposedly this is the kosher way of not including the join table
                    through: { attributes: ["displaySynonym"] }
                },
                {
                    model: BlogPost,
                    limit: 8
                    // @ts-ignore

                    // where: {CommunityId: 1}

                    // include: [{all:true}]
                }
            ],
            attributes: {
                include: [
                    [
                        Sequelize.literal(
                            `(SELECT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${currentAlias} AND "Follows"."followCommunityId"="Community"."id" AND "Follows"."followType" = ${Follow.FOLLOW_TYPES.follow}))`
                        ),
                        "aliasFollowing"
                    ],
                    [
                        Sequelize.literal(
                            `(SELECT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${currentAlias} AND "Follows"."followCommunityId"="Community"."id" AND "Follows"."followType" = ${Follow.FOLLOW_TYPES.block}))`
                        ),
                        "aliasBlocking"
                    ],
                    [
                        Sequelize.literal(
                            `(SELECT EXISTS (SELECT 1 FROM "community_members" WHERE "community_members"."AliasId"=${currentAlias} AND "community_members"."CommunityId"="Community"."id"))`
                        ),
                        "aliasIsMember"
                    ],
                    [
                        Sequelize.literal(
                            `EXISTS (SELECT 1 FROM "CommunityMembershipRequests" WHERE "CommunityMembershipRequests"."AliasId"=${currentAlias} AND "CommunityMembershipRequests"."CommunityId"="Community"."id" AND "CommunityMembershipRequests"."status"=${CommunityMembershipRequest.REQUEST_STATUSES.pending})`
                        ),
                        "membershipPending"
                    ],
                    ...(isNumber ? [matchIdAttribute] : []),
                    [
                        Sequelize.literal(
                            `(SELECT COUNT("moderator"."id") FROM "Aliases" AS "moderator" INNER JOIN "community_moderators" ON "moderator"."id"="community_moderators"."AliasId" WHERE "community_moderators"."CommunityId"="Community"."id")`
                        ),
                        "moderatorCount"
                    ],
                    [
                        Sequelize.literal(
                            `NOT EXISTS ( SELECT 1 FROM  "AccessControlGroups" WHERE "AccessControlGroups"."id" = "Community"."membersAccessControlId" AND "AccessControlGroups"."accessControlSetting" = ${
                                AccessControlGroup.ACCESS_CONTROL_SETTINGS
                                    .members
                            } AND NOT EXISTS ( SELECT 1 FROM "community_members" WHERE "community_members"."AliasId" = ${Number(
                                currentAlias
                            )} AND "community_members"."CommunityId" = "Community"."id" ))
               
        `
                        ),
                        "hasViewMembersPermission"
                    ]
                ]
            },
            order: [...(isNumber ? [orderItem] : [])],
            transaction
        }).then((community: Community): Community | Promise<never> => {
            if (!community) {
                return Promise.reject({
                    status: 404,
                    message: "Community not found"
                });
            }
            community.sanitizeContents();
            return community;
        });
    }

    public createCommunity(
        {
            alias,
            name,
            avatar,
            coverImage,
            tagNames = [],
            link,
            links = [],
            description = "",
            showMinors = true,
            requireApproval,
            hideFromSearchResults = false,
            contentAccessControl,
            commentsAccessControl,
            reactionsAccessControl,
            followsAccessControl,
            membersAccessControl,
            postingAccessControl,
            rules = [],
            tagDisplays = []
        }: CreateCommunityInterface,
        transaction: Transaction
    ): Promise<Community> {
        const promises: Promise<any>[] = [
            Community.create(
                {
                    name,
                    link,
                    links,
                    description,
                    showMinors,
                    hideFromSearchResults,
                    requireApproval
                },
                { transaction }
            ),
            AccessControlGroupController.createAccessControlGroup(
                contentAccessControl,
                alias,
                transaction
            ),
            AccessControlGroupController.createAccessControlGroup(
                commentsAccessControl,
                alias,
                transaction
            ),
            AccessControlGroupController.createAccessControlGroup(
                reactionsAccessControl,
                alias,
                transaction
            ),
            AccessControlGroupController.createAccessControlGroup(
                followsAccessControl,
                alias,
                transaction
            ),
            AccessControlGroupController.createAccessControlGroup(
                membersAccessControl,
                alias,
                transaction
            ),
            AccessControlGroupController.createAccessControlGroup(
                postingAccessControl,
                alias,
                transaction
            ),
            ...rules.map(({ name: n, description: d }) =>
                CommunityRules.create(
                    { name: n, description: d },
                    { transaction }
                )
            ),
            ...(avatar
                ? [ImageController.createImage(avatar, undefined, transaction)]
                : []),
            ...(coverImage
                ? [
                      ImageController.createImage(
                          coverImage,
                          undefined,
                          transaction
                      )
                  ]
                : [])
        ];
        return Promise.all(promises).then(
            ([
                community,
                contentAccessControlResult,
                followsAccessControlResult,
                reactionsAccessControlResult,
                commentsAccessControlResult,
                membersAccessControlResult,
                postingAccessControlResult,
                ...otherResults
            ]: any[]): Promise<Community> => {
                const coverImageResult: any = coverImage && otherResults.pop();
                const avatarResult: any = avatar && otherResults.pop();
                return Promise.all([
                    community.addMember(alias, { transaction }),
                    community.setCommunityRules(otherResults, { transaction }),
                    ...(avatarResult
                        ? [community.setAvatar(avatarResult, { transaction })]
                        : []),
                    ...(coverImageResult
                        ? [
                              community.setCoverImage(coverImageResult, {
                                  transaction
                              })
                          ]
                        : []),
                    this.setTags(community, tagNames, transaction),
                    community.setTagsWithDisplayNames(tagDisplays, transaction),
                    community.addModerator(alias, { transaction }),
                    community.setContentAccessControl(
                        contentAccessControlResult,
                        { transaction }
                    ),
                    community.setFollowsAccessControl(
                        followsAccessControlResult,
                        { transaction }
                    ),
                    community.setReactionsAccessControl(
                        reactionsAccessControlResult,
                        { transaction }
                    ),
                    community.setCommentsAccessControl(
                        commentsAccessControlResult,
                        { transaction }
                    ),
                    community.setMembersAccessControl(
                        membersAccessControlResult,
                        { transaction }
                    ),
                    community.setPostingAccessControl(
                        postingAccessControlResult,
                        { transaction }
                    )
                ]).then(() => community.save({ transaction }));
            }
        );
    }

    public updateCommunity(
        community: Community,
        communityParams: CommunityInterface,
        moderator: Alias | number,
        transaction: Transaction
    ) {
        return community.hasModerator(moderator).then(isValidModerator => {
            if (isValidModerator) {
                if (typeof communityParams.name !== "undefined") {
                    community.name = communityParams.name;
                }
                if (typeof communityParams.link !== "undefined") {
                    community.link = communityParams.link;
                }
                if (typeof communityParams.links !== "undefined") {
                    community.links = communityParams.links;
                }
                if (typeof communityParams.description !== "undefined") {
                    community.description = communityParams.description;
                }
                if (typeof communityParams.showMinors !== "undefined") {
                    community.showMinors = communityParams.showMinors;
                }
                if (
                    typeof communityParams.hideFromSearchResults !== "undefined"
                ) {
                    community.hideFromSearchResults =
                        communityParams.hideFromSearchResults;
                }
                if (typeof communityParams.requireApproval !== "undefined") {
                    community.requireApproval = communityParams.requireApproval;
                }
                const promises: Promise<void | AccessControlGroup>[] = [];

                if (typeof communityParams.rules !== "undefined") {
                    const rulesPromises: Promise<any>[] = [];
                    let rules: CommunityRules[] = [];
                    communityParams.rules?.forEach(
                        (rule: CommunityRulesInterface) => {
                            rulesPromises.push(
                                CommunityRules.create(
                                    {
                                        name: rule.name,
                                        description: rule.description
                                    },
                                    { transaction }
                                ).then(newRule => {
                                    rules.push(newRule);
                                })
                            );
                        }
                    );

                    promises.push(
                        Promise.all(rulesPromises).then(() => {
                            community.setCommunityRules(rules, { transaction });
                        })
                    );
                }

                if (communityParams.avatar instanceof Image) {
                    promises.push(
                        community.setAvatar(communityParams.avatar, {
                            transaction
                        })
                    );
                } else if (typeof communityParams.avatar !== "undefined") {
                    promises.push(
                        ImageController.createImage(
                            communityParams.avatar,
                            undefined,
                            transaction
                        ).then(avatar => {
                            community.setAvatar(avatar, { transaction });
                        })
                    );
                }
                if (communityParams.coverImage instanceof Image) {
                    promises.push(
                        community.setCoverImage(communityParams.coverImage, {
                            transaction
                        })
                    );
                } else if (typeof communityParams.coverImage !== "undefined") {
                    promises.push(
                        ImageController.createImage(
                            communityParams.coverImage,
                            undefined,
                            transaction
                        ).then(coverImage => {
                            community.setCoverImage(coverImage, {
                                transaction
                            });
                        })
                    );
                }

                if (
                    typeof communityParams.contentAccessControl !== "undefined"
                ) {
                    const contentAccessControlParam: AccessControlGroupInterface =
                        communityParams.contentAccessControl;
                    promises.push(
                        community
                            .getContentAccessControl({ transaction })
                            .then(contentAccessControl => {
                                return AccessControlGroupController.editAccessControlGroup(
                                    contentAccessControl,
                                    contentAccessControlParam,
                                    transaction
                                );
                            })
                    );
                }
                if (
                    typeof communityParams.commentsAccessControl !== "undefined"
                ) {
                    const commentsAccessControlParam: AccessControlGroupInterface =
                        communityParams.commentsAccessControl;
                    promises.push(
                        community
                            .getCommentsAccessControl()
                            .then(commentsAccessControl => {
                                return AccessControlGroupController.editAccessControlGroup(
                                    commentsAccessControl,
                                    commentsAccessControlParam,
                                    transaction
                                );
                            })
                    );
                }
                if (
                    typeof communityParams.reactionsAccessControl !==
                    "undefined"
                ) {
                    const reactionsAccessControlParam: AccessControlGroupInterface =
                        communityParams.reactionsAccessControl;
                    promises.push(
                        community
                            .getReactionsAccessControl({ transaction })
                            .then(reactionsAccessControl => {
                                return AccessControlGroupController.editAccessControlGroup(
                                    reactionsAccessControl,
                                    reactionsAccessControlParam,
                                    transaction
                                );
                            })
                    );
                }
                if (
                    typeof communityParams.followsAccessControl !== "undefined"
                ) {
                    const followsAccessControlParam: AccessControlGroupInterface =
                        communityParams.followsAccessControl;
                    promises.push(
                        community
                            .getFollowsAccessControl({ transaction })
                            .then(followsAccessControl => {
                                return AccessControlGroupController.editAccessControlGroup(
                                    followsAccessControl,
                                    followsAccessControlParam,
                                    transaction
                                );
                            })
                    );
                }
                if (
                    typeof communityParams.membersAccessControl !== "undefined"
                ) {
                    const membersAccessControlParam: AccessControlGroupInterface =
                        communityParams.membersAccessControl;
                    promises.push(
                        community
                            .getMembersAccessControl({ transaction })
                            .then(membersAccessControl => {
                                return AccessControlGroupController.editAccessControlGroup(
                                    membersAccessControl,
                                    membersAccessControlParam,
                                    transaction
                                );
                            })
                    );
                }
                if (
                    typeof communityParams.postingAccessControl !== "undefined"
                ) {
                    const postingAccessControlParam: AccessControlGroupInterface =
                        communityParams.postingAccessControl;
                    promises.push(
                        community
                            .getPostingAccessControl({ transaction })
                            .then(postingAccessControl => {
                                return AccessControlGroupController.editAccessControlGroup(
                                    postingAccessControl,
                                    postingAccessControlParam,
                                    transaction
                                );
                            })
                    );
                }

                if (communityParams.tagDisplays) {
                    promises.push(
                        community.setTagsWithDisplayNames(
                            communityParams.tagDisplays,
                            transaction
                        )
                    );
                }

                if (communityParams.tagNames) {
                    promises.push(
                        this.setTags(
                            community,
                            communityParams.tagNames,
                            transaction
                        )
                    );
                }

                return Promise.all(promises).then(() => {
                    return community.save({ transaction });
                });
            } else {
                return Promise.reject(
                    ErrorReportService.getEnvError(
                        "Alias used is not a moderator of the community",
                        "community_edit_alias_not_moderator"
                    )
                );
                // throw new Error(ErrorReportService.getEnvError("Alias used is not a moderator of the community", "community_edit_alias_not_moderator"))
            }
        });
    }

    public addTags(
        community: Community,
        tagParams: (number | Tag)[],
        transaction: Transaction
    ): Promise<void> {
        return tagFunctions.addTags(community, tagParams, transaction);
    }

    public removeTags(
        community: Community,
        tagParams: (number | Tag)[],
        transaction: Transaction
    ): Promise<void> {
        return tagFunctions.removeTags(community, tagParams, transaction);
    }

    // deprecated
    public setTags(
        community: Community,
        tagNames: string[],
        transaction: Transaction
    ): Promise<void> {
        return Promise.all(
            tagNames.map((tagName: string) =>
                Tag.findOrCreateWithNeo4j(tagName, transaction)
            )
        ).then((tags: Tag[]) => community.setTagsWithNeo4j(tags, transaction));
    }

    public setTagsWithDisplaysWithNeo4j(
        community: Community,
        tags: TagDisplayInterface[],
        transaction: Transaction
    ): Promise<void> {
        return community.setTagsWithNeo4j(tags, transaction);
    }

    public addModerators(
        community: Community,
        aliasParams: number[] | Alias[],
        transaction: Transaction
    ) {
        const aliases: Alias[] = [];
        const aliasPromises: any = [];
        aliasParams.forEach((aliasParam: number | Alias) => {
            if (aliasParam instanceof Alias) {
                aliases.push(aliasParam);
            } else
                aliasPromises.push(
                    Alias.findByPk(aliasParam, { transaction })
                        .then((alias: Alias) => {
                            aliases.push(alias);
                        })
                        .catch(() => {
                            throw Error("alias with that id does not exist");
                        })
                );
        });

        return Promise.all(aliasPromises).then(() => {
            // TODO some fancy tag logic
            const promises: any = [];
            aliases.forEach(alias => {
                promises.push(community.addModerator(alias, { transaction }));
            });
            return Promise.all(promises);
        });
    }

    public removeModerators(
        community: Community,
        aliasParams: number[] | Alias[],
        transaction: Transaction
    ) {
        const aliases: Alias[] = [];
        const aliasPromises: any = [];
        aliasParams.forEach((aliasParam: number | Alias) => {
            if (aliasParam instanceof Alias) {
                aliases.push(aliasParam);
            } else
                aliasPromises.push(
                    Alias.findByPk(aliasParam, { transaction })
                        .then((alias: Alias) => {
                            aliases.push(alias);
                        })
                        .catch(() => {
                            throw Error("alias with that id does not exist");
                        })
                );
        });

        return Promise.all(aliasPromises).then(() => {
            // TODO some fancy tag logic
            const promises: any = [];
            aliases.forEach(alias => {
                promises.push(
                    community.removeModerator(alias, { transaction })
                );
            });
            return Promise.all(promises);
        });
    }

    public getMembershipRequests(
        community: Community,
        transaction: Transaction
    ) {
        return CommunityMembershipRequest.findAll({
            where: {
                CommunityId: community.id,
                status: 1
            },
            include: [
                {
                    model: Alias,
                    attributes: ["id", "name", "avatarId"],
                    include: [
                        {
                            model: Image
                        }
                    ]
                }
            ],
            transaction
        });
    }

    public createMembershipRequest(
        community: Community,
        alias: number,
        transaction: Transaction
    ): Promise<any> {
        return CommunityMembershipRequest.create(
            {
                status: CommunityMembershipRequest.REQUEST_STATUSES.pending,
                AliasId: alias,
                CommunityId: community.id
            },
            { transaction }
        );
    }

    public acceptMembershipRequest(
        community: Community,
        membershipRequest: CommunityMembershipRequest,
        transaction: Transaction
    ): Promise<(CommunityMembershipRequest | void)[]> {
        membershipRequest.status =
            CommunityMembershipRequest.REQUEST_STATUSES.accepted;

        return Promise.all([
            membershipRequest.save({ transaction }),
            community.addMember(membershipRequest.AliasId, { transaction })
        ]);
    }

    public rejectMembershipRequest(
        membershipRequest: CommunityMembershipRequest,
        transaction: Transaction
    ): Promise<CommunityMembershipRequest> {
        membershipRequest.status =
            CommunityMembershipRequest.REQUEST_STATUSES.rejected;

        return membershipRequest.save({ transaction });
    }

    public checkIfUserIsModerator(
        community: Community,
        user: User,
        alias: Alias
    ): Promise<boolean> {
        const hasAliasPromise = user.hasAlias(alias);
        const hasModeratorPromise = community.hasModerator(alias);
        return Promise.all([hasAliasPromise, hasModeratorPromise]).then(
            ([hasAlias, hasModerator]) => hasAlias && hasModerator
        );
    }
}

const controller = new CommunityController();
export { controller as CommunityController };
