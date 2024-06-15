import { ReactionInterface } from "../Interface/ReactionInterface";
import { Reaction } from "@entities/Reaction";
import { ErrorReportService } from "../services/ErrorReportService";
import { Alias } from "@entities/Alias";
import { BlogPost } from "@entities/BlogPost";
import { Comment } from "@entities/Comment";
import { Notification } from "@entities/Notification";
import { User } from "@entities/User";
import { Op, Transaction } from "sequelize";
import { NotificationController } from "@controllers/NotificationController";

class ReactionController {
    public createReactionOnComment(
        reactionParams: ReactionInterface,
        transaction: Transaction
    ) {
        if (!reactionParams.alias) {
            throw new Error("Alias is missing.");
        }
        if (!(reactionParams.type in Reaction.REACTION_TYPE)) {
            return Promise.reject(
                ErrorReportService.getEnvError(
                    "Wrong reaction type",
                    "reaction_create_error"
                ) as string
            );
        }
        const reactionType = Reaction.REACTION_TYPE[reactionParams.type];
        return Reaction.findOrCreate({
            where: {
                type: reactionType,
                AliasId: reactionParams.alias,
                CommentId: this.getNumber(reactionParams.comment)
            },
            transaction
        }).then(([reaction, created]: [Reaction, boolean]):
            | Promise<Reaction>
            | Reaction => {
            if (created) {
                return this.createNotification(
                    reactionParams.alias,
                    reaction.likedId,
                    reaction.likedEntity,
                    undefined,
                    transaction
                ).then(() => reaction);
            } else {
                return reaction;
            }
        });
    }

    public createReactionOnBlogPost(
        reactionParams: ReactionInterface,
        transaction: Transaction
    ) {
        if (!reactionParams.alias) {
            throw new Error("Alias is missing.");
        }
        if (!(reactionParams.type in Reaction.REACTION_TYPE)) {
            return Promise.reject(
                ErrorReportService.getEnvError(
                    "Wrong reaction type",
                    "reaction_create_error"
                ) as string
            );
        }

        return BlogPost.findByPk(reactionParams.blogPost, {
            include: [
                {
                    model: BlogPost,
                    as: "r"
                }
            ],
            transaction
        }).then(blogPost => {
            const reblogRootId =
                blogPost &&
                blogPost.r.length &&
                Math.min(...blogPost.r.map(({ id }) => id));
            const sameAuthor =
                blogPost?.AliasId ===
                blogPost?.r.find(({ id }) => id === reblogRootId)?.AliasId;

            const reactionType = Reaction.REACTION_TYPE[reactionParams.type];
            const BlogPostId = this.getNumber(reactionParams.blogPost);
            return Reaction.findOrCreate({
                where: {
                    type: reactionType,
                    AliasId: reactionParams.alias,
                    BlogPostId,
                    reblogRootId: reblogRootId || BlogPostId
                },
                transaction
            }).then(([reaction, created]: [Reaction, boolean]):
                | Promise<Reaction>
                | Reaction => {
                if (created && blogPost) {
                    const isReblog: boolean = !!(
                        reblogRootId && reblogRootId !== blogPost.id
                    );
                    return Promise.all([
                        this.createNotification(
                            reactionParams.alias,
                            reaction.likedId,
                            reaction.likedEntity,
                            isReblog,
                            transaction
                        ),
                        ...(isReblog && !sameAuthor
                            ? [
                                  this.createNotification(
                                      reactionParams.alias,
                                      reblogRootId as number,
                                      reaction.likedEntity,
                                      undefined,
                                      transaction
                                  )
                              ]
                            : [])
                    ]).then(() => reaction);
                } else {
                    return reaction;
                }
            });
        });
    }

    public removeReaction(
        reaction: Reaction,
        alias: Alias | number,
        user: User
    ): Promise<any> {
        const aliasId = typeof alias === "number" ? alias : alias.id;
        const userAliasIds = user.AliasIds;
        if (
            userAliasIds.includes(aliasId) &&
            userAliasIds.includes(reaction.AliasId)
        ) {
            return Promise.all([
                reaction.destroy(),
                Notification.destroy({
                    where: {
                        type: ["like", "like-reblog"],
                        sourceAliasId: aliasId,
                        ...(reaction.BlogPostId
                            ? {
                                  targetBlogPostId: [
                                      reaction.BlogPostId,
                                      reaction.reblogRootId
                                  ]
                              }
                            : {}),
                        ...(reaction.CommentId
                            ? { targetCommentId: reaction.CommentId }
                            : {})
                    }
                })
            ]);
        } else {
            return Promise.resolve();
        }
    }

    public getAlreadyLikedByUser(
        entity: { blogPost?: string; comment?: string },
        user: User
    ): Promise<boolean | Reaction> {
        /*let aliasId:number;
        if(alias instanceof Alias){
            aliasId = alias.id
        }else{
            aliasId = alias;
        }*/
        let aliasIds = user.AliasIds;
        if (typeof entity.blogPost !== "undefined") {
            return Reaction.findOne({
                where: {
                    AliasId: aliasIds,
                    [Op.or]: [
                        { BlogPostId: entity.blogPost },
                        { reblogRootId: entity.blogPost }
                    ],
                    type: 1
                }
            }).then((findResults: any) => {
                if (findResults) {
                    return findResults;
                } else {
                    return false;
                }
            });
        } else if (typeof entity.comment !== "undefined") {
            return Reaction.findOne({
                where: {
                    AliasId: aliasIds,
                    CommentId: entity.comment,
                    type: 1
                }
            }).then((findResults: any) => {
                if (findResults) {
                    return findResults;
                } else {
                    return false;
                }
            });
        } else {
            throw new Error("Entity undefined.");
        }
    }

    private getNumber(
        entity: string | number | BlogPost | Comment | undefined
    ): number | null {
        if (!entity) {
            return null;
        } else {
            if (typeof entity === "number") {
                return entity;
            } else if (typeof entity === "string") {
                return Number(entity);
            } else {
                return entity.id;
            }
        }
    }

    public createNotification(
        aliasId: number,
        liked: number,
        likedEntity: string,
        reblog = false,
        transaction: Transaction
    ): Promise<any> {
        let getTargetAliasId: Promise<number>;
        if (likedEntity === "blogPost") {
            getTargetAliasId = BlogPost.findByPk(liked, { transaction }).then(
                (blogPost: BlogPost): number => {
                    return blogPost.AliasId;
                }
            );
        } else {
            getTargetAliasId = Comment.findByPk(liked, { transaction }).then(
                (comment: Comment): number => {
                    return comment.AliasId;
                }
            );
        }
        return NotificationController.create(
            aliasId,
            getTargetAliasId,
            "like",
            {
                ...(likedEntity === "comment" && {
                    targetCommentId: liked
                }),
                ...(likedEntity === "blogPost" && {
                    targetBlogPostId: liked
                })
            },
            reblog,
            transaction
        );
    }
}

const controller = new ReactionController();
export { controller as ReactionController };
