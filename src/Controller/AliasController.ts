import { User } from "../Entity/User";
import { Alias } from "../Entity/Alias";
import { Image } from "../Entity/Image";
import { ImageController } from "./ImageController";
import { ImageInterface } from "../Interface/ImageInterface";
import { Follow } from "../Entity/Follow";
import { Reaction } from "../Entity/Reaction";
import { Op } from "sequelize";
import { FollowController } from "./FollowController";
import { Sequelize, ProjectionAlias, Transaction } from "sequelize";
import { database as sequelize } from "../services/databaseService.js";

export const aliasCounts: ProjectionAlias[] = [
    [
        Sequelize.literal(
            `(SELECT COUNT ("Follows"."id") FROM "Follows" WHERE "Follows"."AliasId"="Alias"."id" AND "Follows"."followType"=${Follow.FOLLOW_TYPES.follow})`
        ),
        "followingCount"
    ],
    [
        Sequelize.literal(
            `(SELECT COUNT ("Follows"."id") FROM "Follows" INNER JOIN "Blogs" ON "Follows"."followBlogId"="Blogs"."id" WHERE "Blogs"."AliasId"="Alias"."id" AND "Follows"."followType"=${Follow.FOLLOW_TYPES.follow})`
        ),
        "followedByCount"
    ],
    [
        Sequelize.literal(
            `(SELECT COUNT ("Reactions"."id") FROM "Reactions" WHERE "Reactions"."AliasId"="Alias"."id" AND "Reactions"."type"=${Reaction.REACTION_TYPE.like})`
        ),
        "likesCount"
    ],
    [
        Sequelize.literal(
            `(SELECT COUNT ("Notifications"."id") FROM "Notifications" WHERE "Notifications"."targetAliasId"="Alias"."id" AND "Notifications"."isSeen"=false)`
        ),
        "activitiesCount"
    ],
    [
        Sequelize.literal(
            `(SELECT COUNT ("CommunityInvites"."id") FROM "CommunityInvites" WHERE "CommunityInvites"."invitedId"="Alias"."id")`
        ),
        "invitesCount"
    ]
];

class AliasController {
    public createAlias(
        name: string,
        image: string,
        user: User,
        avatar: Image | ImageInterface,
        transaction: Transaction
    ): Promise<Alias> {
        return Alias.create(
            {
                name,
                imageURL: image,
                UserId: user.id,
                isMinor: user.isMinor
            },
            { transaction }
        )
            .then(alias => {
                return alias;
            })
            .then(alias => {
                const promises: any[] = [];
                if (avatar instanceof Image) {
                    promises.push(alias.setAvatar(avatar, { transaction }));
                } else if (avatar && avatar.src) {
                    promises.push(
                        ImageController.createImage(
                            avatar,
                            "alias",
                            transaction
                        ).then(async createdAvatar => {
                            alias.setAvatar(createdAvatar, { transaction });
                        })
                    );
                } else {
                    promises.push(
                        ImageController.createDefaultImage(
                            "alias",
                            transaction
                        ).then(async createdAvatar => {
                            alias.setAvatar(createdAvatar, { transaction });
                        })
                    );
                }

                return Promise.all(promises).then(() => {
                    return alias.save({ transaction }).then(savedAlias => {
                        // TODO set tags that are autoliked
                        // @ts-ignore
                        let defaultFollowedBlogs = process.env.DEFAUTL_FOLLOWED_BLOGS_ID.split(
                            ","
                        );
                        console.log(defaultFollowedBlogs);
                        let followPromises: Promise<any>[] = [];
                        defaultFollowedBlogs.forEach(
                            (defaultBlogId: string) => {
                                followPromises.push(
                                    FollowController.create(
                                        "blog",
                                        defaultBlogId,
                                        "follow",
                                        savedAlias.id,
                                        transaction
                                    )
                                );
                            }
                        );
                        // @ts-ignore
                        let defaultCommunityMemberships = process.env.DEFAULT_COMMUNITIES_ID.split(
                            ","
                        );
                        defaultCommunityMemberships.forEach(
                            (defaultCommunityId: string) => {
                                followPromises.push(
                                    sequelize.query(
                                        `INSERT INTO "community_members" ("createdAt", "updatedAt", "CommunityId", "AliasId") VALUES(now(),now(), ${defaultCommunityId}, ${savedAlias.id});`,
                                        { transaction }
                                    )
                                );
                                followPromises.push(
                                    FollowController.create(
                                        "community",
                                        defaultCommunityId,
                                        "follow",
                                        savedAlias.id,
                                        transaction
                                    )
                                );
                            }
                        );
                        // @ts-ignore
                        let defaultCommunityFollows = process.env.DEFAULT_FOLLOWED_COMMUNITIES_ID.split(
                            ","
                        );
                        defaultCommunityFollows.forEach(
                            (defaultCommunityFollowId: string) => {
                                followPromises.push(
                                    FollowController.create(
                                        "community",
                                        defaultCommunityFollowId,
                                        "follow",
                                        savedAlias.id,
                                        transaction
                                    )
                                );
                            }
                        );
                        return Promise.all(followPromises).then(() => {
                            return savedAlias;
                        });
                    });
                });
            });
        // return alias.save();
    }

    public findAllWhereFollowesTags(aliasId: number, transaction: Transaction) {
        return Follow.findAll({
            where: {
                AliasId: aliasId,
                followTagId: {
                    [Op.ne]: null
                },
                followType: Follow.FOLLOW_TYPES.follow
            },
            transaction
        });
    }

    public findAllWhereBlocksTags(aliasId: number, transaction: Transaction) {
        return Follow.findAll({
            where: {
                AliasId: aliasId,
                followTagId: {
                    [Op.ne]: null
                },
                followType: Follow.FOLLOW_TYPES.block
            },
            transaction
        });
    }
}

const controller = new AliasController();
export { controller as AliasController };
