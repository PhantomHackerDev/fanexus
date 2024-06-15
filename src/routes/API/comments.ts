import express from "express";
import { CommentsController } from "../../Controller/CommentsController";
import { User } from "../../Entity/User";
import { Alias } from "../../Entity/Alias";
import { Blog } from "../../Entity/Blog";
import { BlogPost } from "../../Entity/BlogPost";
import { Image } from "../../Entity/Image";
import { ModerationAction } from "../../Entity/ModerationAction";
import { auth, AuthRequest } from "../../Authorization/auth";
import { ErrorReportService } from "../../services/ErrorReportService";
import { ReactionController } from "../../Controller/ReactionController";
import { Reaction } from "../../Entity/Reaction";
import { Comment } from "../../Entity/Comment";
import { Notification } from "../../Entity/Notification";
import { AuthService } from "../../services/AuthService";
import { Response } from "express";
// import { Op, Sequelize } from "sequelize";
import { StatusCodes } from "http-status-codes";
import { database as sequelize } from "../../services/databaseService.js";

const commentsRouter = express.Router();

commentsRouter.get("/:commentId/", auth, (req: AuthRequest, res: Response) =>
    sequelize
        .transaction(transaction => {
            const id: string = req.params.commentId;
            const user: User = req.user;
            const AliasId = req.currentAlias;
            return CommentsController.getComment(
                id,
                user,
                AliasId,
                transaction
            ).then(comment => {
                if (!comment) {
                    res.send(
                        ErrorReportService.getEnvError(
                            "Does not exist or no view permissions",
                            "entity_does_not_exist_or_alias_has_no_view_permissions"
                        )
                    );
                    return;
                }
                res.send(comment);
            });
        })
        .catch(error => {
            res.send(
                ErrorReportService.getEnvError(error, "comment_fetch_fail")
            );
        })
);

commentsRouter.post("/", auth, (req: AuthRequest, res: Response) =>
    sequelize
        .transaction(transaction => {
            const user: User = req.user;
            const aliasId = req.body.alias;
            return user
                .hasAlias(req.body.alias, { transaction })
                .then(hasAlias => {
                    if (false === hasAlias) {
                        res.send(
                            ErrorReportService.getEnvError(
                                "User does not have the alias you are trying to create the comment with",
                                "commentCreate_fail_wrongAlias"
                            )
                        );
                        return;
                    }
                    return AuthService.userHasCommentingPermissions(
                        aliasId,
                        user,
                        req.body.blogPost,
                        req.body.parentComment,
                        transaction
                    ).then(hasCommentingPermissions => {
                        if (false === hasCommentingPermissions) {
                            res.send(
                                ErrorReportService.getEnvError(
                                    "No permissions",
                                    "commentCreate_fail_noPermissions"
                                )
                            );
                            return;
                        }
                        return CommentsController.createComment(
                            {
                                content: req.body.content,
                                alias: req.body.alias,
                                blogPost: req.body.blogPost,
                                parentComment: req.body.parentComment,
                                user
                            },
                            transaction
                        ).then(createdComment => {
                            // @ts-ignore
                            return CommentsController.getComment(
                                createdComment.id,
                                user,
                                aliasId,
                                transaction
                            ).then(comment => {
                                // the purpose of this is to get includes, is there a better way to do this? TODO
                                res.send(comment);
                                return comment;
                            });
                        });
                    });
                });
        })
        .catch(e => {
            console.log(e);
            res.send(ErrorReportService.getEnvError(e, "comment_create_error"));
        })
);

commentsRouter.post(
    "/:commentId",
    auth,
    (req: AuthRequest, res: Response): Promise<Response> =>
        sequelize
            .transaction(transaction => {
                const user: User = req.user;
                const AliasId = req.currentAlias;
                return CommentsController.getComment(
                    req.params.commentId,
                    user,
                    AliasId,
                    transaction
                ).then((comment: Comment) =>
                    AuthService.userHasEditPermissionsForEntity(
                        comment,
                        user,
                        transaction
                    ).then(hasPermissions => {
                        if (!hasPermissions) {
                            return res.send(
                                ErrorReportService.getEnvError(
                                    "No permissions",
                                    "no_permissions"
                                )
                            );
                        }
                        return CommentsController.updateComment(
                            comment,
                            {
                                content: req.body.content,
                                user
                            },
                            transaction
                        ).then(result => res.send(result));
                    })
                );
            })
            .catch(e => {
                return res.send(
                    ErrorReportService.getEnvError(e, "comment_edit_error")
                );
            })
);

commentsRouter.delete(
    "/:commentId",
    auth,
    (req: AuthRequest, res: Response): Promise<Response> =>
        sequelize
            .transaction(transaction => {
                const user: User = req.user;
                const AliasId = req.currentAlias;
                return CommentsController.getComment(
                    req.params.commentId,
                    user,
                    AliasId,
                    transaction
                ).then((comment: Comment) =>
                    AuthService.userHasEditPermissionsForEntity(
                        comment,
                        user,
                        transaction
                    ).then(hasPermissions => {
                        if (!hasPermissions) {
                            return res.send(
                                ErrorReportService.getEnvError(
                                    "No permissions",
                                    "no_permissions"
                                )
                            );
                        }
                        return CommentsController.updateComment(
                            comment,
                            {
                                content: " ",
                                user
                            },
                            transaction
                        ).then(deleted => {
                            if (deleted) {
                                return Promise.all([
                                    Notification.destroy({
                                        where: {
                                            sourceCommentId:
                                                req.params.commentId
                                        }
                                    })
                                ]).then(() => res.send("Deleted"));
                            } else {
                                if (req.user.moderator) {
                                    const commentIncludeAttributes = () => [
                                        {
                                            model: Alias,
                                            attributes: [
                                                "id",
                                                "name",
                                                "avatarId"
                                            ],
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
                                                    model: Blog,
                                                    attributes: ["id", "link"]
                                                }
                                            ]
                                        }
                                    ];
                                    const includedComment = (
                                        relation: string
                                    ) => ({
                                        model: Comment,
                                        as: relation,
                                        include: commentIncludeAttributes()
                                    });
                                    const includedCommentWithChild = (
                                        childInclude: ReturnType<
                                            typeof includedComment
                                        >
                                    ) => {
                                        const includeObject = includedComment(
                                            "childComments"
                                        );
                                        return {
                                            ...includeObject,
                                            include: [
                                                childInclude,
                                                ...includeObject.include
                                            ]
                                        };
                                    };
                                    return (
                                        Comment.findOne({
                                            where: {
                                                id: req.params.commentId
                                            },
                                            include: [
                                                {
                                                    model: Alias,
                                                    attributes: [
                                                        "id",
                                                        "name",
                                                        "avatarId"
                                                    ],
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
                                                            model: Blog,
                                                            attributes: [
                                                                "id",
                                                                "link"
                                                            ]
                                                        }
                                                    ]
                                                },
                                                includedComment(
                                                    "parentComment"
                                                ),
                                                includedCommentWithChild(
                                                    includedComment(
                                                        "childComments"
                                                    )
                                                ),
                                                {
                                                    model: BlogPost,
                                                    as: "rootBlogPost"
                                                }
                                            ]
                                        })
                                            // tslint:disable-next-line:no-shadowed-variable
                                            .then(comment => {
                                                if (!comment) {
                                                    return Promise.reject(
                                                        "Comment not found."
                                                    );
                                                }
                                                return Promise.all([
                                                    ModerationAction.create({
                                                        AliasId:
                                                            req.currentAlias,
                                                        reason: req.body.reason,
                                                        details: {
                                                            action: "delete",
                                                            item: "comment",
                                                            comment: comment.toJSON()
                                                        }
                                                    }),
                                                    // comment.destroy(),
                                                    Notification.destroy({
                                                        where: {
                                                            sourceCommentId:
                                                                req.params
                                                                    .commentId
                                                        }
                                                    })
                                                ]);
                                            })
                                            .then(([moderationAction]) =>
                                                res.send(moderationAction)
                                            )
                                    );
                                } else {
                                    return res.send("Not deleted");
                                }
                            }
                        });
                    })
                );
            })
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e))
);

commentsRouter.post(
    "/:commentId/like",
    auth,
    async (req: AuthRequest, res: Response) =>
        sequelize
            .transaction(transaction => {
                const id = req.params.commentId;
                const alias = req.body.alias;
                const user: User = req.user;
                if (typeof id === "undefined") {
                    throw new Error("Missing comment ID.");
                }
                return user.hasAlias(alias).then(hasAlias => {
                    if (false === hasAlias) {
                        res.send(
                            ErrorReportService.getEnvError(
                                "User does not have the alias you are trying to like with",
                                "commentLike_fail_wrongAlias"
                            )
                        );
                        return;
                    } else {
                        return ReactionController.createReactionOnComment(
                            {
                                type: "like",
                                comment: id,
                                alias
                            },
                            transaction
                        ).then(reaction => {
                            res.send(reaction);
                            return reaction;
                        });
                    }
                });
            })
            .catch(e => {
                res.send(
                    ErrorReportService.getEnvError(e, "comment_like_error")
                );
            })
);

commentsRouter.post(
    "/:commentId/unlike",
    auth,
    (req: AuthRequest, res: Response) => {
        try {
            const id = req.params.commentId;
            const alias = req.body.alias;
            const user: User = req.user;
            return user
                .hasAlias(alias)
                .then(hasAlias => {
                    if (false === hasAlias) {
                        return res.send(
                            ErrorReportService.getEnvError(
                                "User does not have the alias you are trying to unlike with",
                                "commentUnLike_fail_wrongAlias"
                            )
                        );
                    } else {
                        return ReactionController.getAlreadyLikedByUser(
                            { comment: id },
                            user
                        ).then(existingReaction => {
                            if (existingReaction instanceof Reaction) {
                                return ReactionController.removeReaction(
                                    existingReaction,
                                    alias,
                                    user
                                ).then((removeReactionResult: any) => {
                                    return res.send(removeReactionResult);
                                });
                            } else {
                                return res.send("Not already liked");
                            }
                        });
                    }
                })
                .catch(e => {
                    res.send(
                        ErrorReportService.getEnvError(
                            e,
                            "comment_unlike_error"
                        )
                    );
                });
        } catch (e) {
            res.send(ErrorReportService.getEnvError(e, "comment_unlike_error"));
        }
    }
);

commentsRouter.get(
    "/:commentId/mock",
    async (req: AuthRequest, res: Response) => {
        // mock
        const responseObject = {
            id: req.params.commentId,
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
                                    dateCreated: "01-24-2019, 07:21",
                                    dateUpdated: "01-26-2019, 12:21",
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
                                            dateCreated: "01-24-2019, 07:21",
                                            dateUpdated: "01-26-2019, 12:21",
                                            comments: [
                                                {
                                                    id: 7,
                                                    content:
                                                        "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                                                    alias: {
                                                        name: "batboy",
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
                                                        name: "joker",
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
                                    dateCreated: "01-24-2019, 07:21",
                                    dateUpdated: "01-26-2019, 12:21",
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
        };
        res.send(responseObject);
    }
);

export { commentsRouter };
