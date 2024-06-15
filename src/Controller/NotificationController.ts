import { WhereAttributeHash, Op, Sequelize, Transaction } from "sequelize";

import { Notification } from "@entities/Notification";
import { User } from "@entities/User";
import { Alias } from "@entities/Alias";
import { Blog } from "@entities/Blog";
import { BlogPost } from "@entities/BlogPost";
import { Comment } from "@entities/Comment";
import { Community } from "@entities/Community";
import { Response } from "express";
import { io, currentSessions } from "@services/SocketService";

export type pendingCountRequests = Map<number, { res: Response }>;
const updateCountRequests: pendingCountRequests = new Map();
const watchNotificationResponseTime = 10000; // 10 seconds

class NotificationController {
    public index(aliasId: number, newOnly?: boolean): Promise<Notification[]> {
        const whereConditions: WhereAttributeHash = {
            targetAliasId: aliasId,
            ...(newOnly ? { isSeen: false } : {})
        };
        if (newOnly) {
            whereConditions.isSeen = false;
        }

        return Notification.findAll({
            where: whereConditions,
            include: [
                {
                    model: Alias,
                    as: "sourceAlias",
                    include: [
                        {
                            model: Blog
                        }
                    ],
                    where: {
                        [Op.and]: [
                            // User has blocked sourceAlias
                            Sequelize.literal(
                                `NOT EXISTS (SELECT 1 FROM "Follows" INNER JOIN "Blogs" ON "Follows"."followBlogId"="Blogs"."id" INNER JOIN "Aliases" AS "sourceAliases" ON "Blogs"."AliasId"="sourceAliases"."id" INNER JOIN "Aliases" AS "sourceAliasRow" ON "sourceAliases"."UserId"="sourceAliasRow"."UserId" INNER JOIN "Aliases" as "userAliases" ON "Follows"."AliasId"="userAliases"."id" INNER JOIN "Aliases" AS "userAlias" ON "userAliases"."UserId"="userAlias"."UserId" WHERE "userAlias"."id"=${Number(
                                    aliasId
                                )} AND "sourceAliasRow"."id"="sourceAlias"."id" AND "Follows"."followType"=0)`
                            ),
                            // sourceAlias has blocked user
                            Sequelize.literal(
                                `NOT EXISTS (SELECT 1 FROM "Follows" INNER JOIN "Blogs" ON "Follows"."followBlogId"="Blogs"."id" INNER JOIN "Aliases" AS "userAliases" ON "Blogs"."AliasId"="userAliases"."id" INNER JOIN "Aliases" AS "userAlias" ON "userAliases"."UserId"="userAlias"."UserId" INNER JOIN "Aliases" AS "sourceAliases" ON "Follows"."AliasId"="sourceAliases"."id" INNER JOIN "Aliases" as "sourceAliasRow" ON "sourceAliases"."UserId"="sourceAliasRow"."UserId" WHERE "sourceAliasRow"."id"="sourceAlias"."id" AND "userAlias"."id"=${Number(
                                    aliasId
                                )} AND "Follows"."followType"=0)`
                            )
                        ]
                    }
                },
                {
                    model: BlogPost,
                    as: "targetBlogPost",
                    include: [
                        {
                            model: Blog
                        },
                        {
                            model: Community
                        }
                    ]
                },
                {
                    model: BlogPost,
                    as: "sourceReblog",
                    include: [
                        {
                            model: Blog
                        },
                        {
                            model: Community
                        }
                    ]
                },
                {
                    model: Comment,
                    as: "targetComment",
                    include: [
                        {
                            model: BlogPost,
                            as: "rootBlogPost",
                            include: [
                                {
                                    model: Blog
                                },
                                {
                                    model: Community
                                }
                            ]
                        }
                    ]
                },
                {
                    model: Community,
                    as: "targetCommunity"
                },
                {
                    model: Comment,
                    as: "sourceComment"
                }
            ],
            order: [["id", "DESC"]]
        });
    }

    public watch(aliasId: number, res: Response<any>): pendingCountRequests {
        setTimeout(() => {
            const currentValue = updateCountRequests.get(aliasId);
            const currentRequest = currentValue && currentValue.res;
            if (res === currentRequest && updateCountRequests.delete(aliasId)) {
                res.send({});
            }
        }, watchNotificationResponseTime);
        return updateCountRequests.set(aliasId, { res });
    }

    public unwatch(aliasId: number): boolean {
        const aliasEntry = updateCountRequests.get(aliasId);
        console.log(aliasEntry);
        if (aliasEntry) {
            aliasEntry.res.send(false);
        }
        return updateCountRequests.delete(aliasId);
    }

    public sendCount(
        userId: number,
        aliasId: number
    ): Promise<any> | undefined {
        const sockets = currentSessions.get(userId);
        console.log("sending count", sockets && sockets.length);
        if (sockets) {
            return Notification.count({
                where: { targetAliasId: aliasId, isSeen: false }
            }).then((count: number) => {
                return sockets.map(socket =>
                    io.to(socket.id).emit("activity", { aliasId, count })
                );
            });
        }
    }

    public create(
        sourceAliasId: number,
        getTargetAliasIdPromise: Promise<number>,
        type: string,
        {
            targetBlogPostId,
            targetCommentId,
            targetCommunityId,
            sourceCommentId,
            sourceReblogId
        }: {
            targetBlogPostId?: number;
            targetCommentId?: number;
            targetCommunityId?: number;
            sourceCommentId?: number;
            sourceReblogId?: number;
        } = {},
        reblog = false,
        transaction: Transaction
    ): Promise<any> {
        return getTargetAliasIdPromise.then((targetAliasId): any => {
            if (targetAliasId !== sourceAliasId) {
                return Notification.create(
                    {
                        sourceAliasId,
                        targetAliasId,
                        type: `${type}${reblog ? "-reblog" : ""}`,
                        targetBlogPostId,
                        targetCommentId,
                        targetCommunityId,
                        sourceCommentId,
                        sourceReblogId
                    },
                    { transaction }
                ).then(() =>
                    User.findOne({
                        include: [
                            {
                                model: Alias,
                                attributes: ["id", "name", "avatarId"],
                                where: {
                                    id: targetAliasId
                                }
                            }
                        ]
                    }).then(
                        user => user && this.sendCount(user.id, targetAliasId)
                    )
                );
            } else {
                return false;
            }
        });
    }
}

const controller = new NotificationController();
export { controller as NotificationController };
