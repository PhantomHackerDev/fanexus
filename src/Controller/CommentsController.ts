import { Op, ProjectionAlias, Sequelize, Transaction } from "sequelize";

import { CommentInterface } from "../Interface/CommentInterface";
import { Comment } from "@entities/Comment";
import { ErrorReportService } from "../services/ErrorReportService";
import { Alias } from "@entities/Alias";
import { BlogPost } from "@entities/BlogPost";
import { Image } from "@entities/Image";
import { Reaction } from "@entities/Reaction";
import { AuthService } from "../services/AuthService";
import { User } from "@entities/User";
import { Blog } from "@entities/Blog";
import { NotificationController } from "@controllers/NotificationController";

class CommentsController {
    public createComment(
        commentParams: CommentInterface,
        transaction: Transaction
    ): Promise<Comment> {
        const alias = commentParams.alias;
        if (!alias) {
            throw new Error("A comment must have an alias");
        }
        return Comment.create(
            {
                content: commentParams.content
            },
            { transaction }
        )
            .then((comment: Comment) => {
                return comment;
            })
            .then(
                (comment: Comment): Promise<Comment> => {
                    const promises: Promise<any>[] = [];
                    promises.push(comment.setAlias(alias, { transaction }));
                    let entity: "blogPost" | "comment";
                    let id: number;
                    let reblogRoot: number;
                    let sameAuthor: boolean;

                    if (commentParams.blogPost) {
                        const blogPostParam = Number(commentParams.blogPost);
                        promises.push(
                            BlogPost.findByPk(commentParams.blogPost, {
                                include: [
                                    {
                                        model: BlogPost,
                                        as: "r"
                                    }
                                ]
                            }).then(blogPost => {
                                if (blogPost) {
                                    const reblogRootId = Math.min(
                                        ...blogPost.r
                                            .map(
                                                ({ id: rebloggedId }) =>
                                                    rebloggedId
                                            )
                                            .concat(blogPostParam)
                                    );

                                    entity = "blogPost";
                                    reblogRoot = reblogRootId;
                                    id = blogPostParam;
                                    sameAuthor =
                                        blogPost.AliasId ===
                                        blogPost.r.find(
                                            ({ id: reblogOrigin }) =>
                                                reblogOrigin === reblogRootId
                                        )?.AliasId;

                                    return Promise.all([
                                        comment.setBlogPost(reblogRootId, {
                                            transaction
                                        }),
                                        comment.setRootBlogPost(reblogRootId, {
                                            transaction
                                        })
                                    ]);
                                }
                            })
                        );
                        // TODO blogpost run add comment
                    }
                    if (commentParams.parentComment) {
                        promises.push(
                            comment.setParentComment(
                                commentParams.parentComment,
                                { transaction }
                            )
                        );
                        entity = "comment";
                        id = commentParams.parentComment;
                        promises.push(
                            Comment.findByPk(commentParams.parentComment).then(
                                parentComment =>
                                    parentComment &&
                                    comment.setRootBlogPost(
                                        parentComment.rootBlogPostId,
                                        { transaction }
                                    )
                            )
                        );
                    }

                    return Promise.all(promises)
                        .then(() => comment.save({ transaction }))
                        .then(
                            (savedComment: Comment): Promise<Comment> => {
                                return Promise.all([
                                    this.createNotification(
                                        savedComment,
                                        alias,
                                        entity,
                                        id,
                                        id !== reblogRoot,
                                        transaction
                                    ),
                                    ...(entity === "blogPost" &&
                                    id !== reblogRoot &&
                                    !sameAuthor
                                        ? [
                                              this.createNotification(
                                                  savedComment,
                                                  alias,
                                                  entity,
                                                  reblogRoot,
                                                  undefined,
                                                  transaction
                                              )
                                          ]
                                        : [])
                                ]).then(() => {
                                    return savedComment;
                                });
                            }
                        );
                }
            )
            .catch(e => {
                console.error(e.stack);
                throw new Error(
                    ErrorReportService.getEnvError(
                        e,
                        "commentCreate_fail"
                    ) as string
                );
            });
    }

    public getComment(
        id: number | string,
        user: User,
        aliasId: number,
        transaction: Transaction
    ): Promise<Comment> {
        const commentAccessConditions = (
            AliasId: number,
            referenceName: string
        ) => {
            return [
                // Viewer not blocking any aliases of comment author
                Sequelize.literal(`NOT EXISTS (
                            SELECT 1 FROM "Follows"
                            FULL OUTER JOIN "Aliases" AS "CommentAuthorAlias"
                                ON "CommentAuthorAlias"."id"="${referenceName}"."AliasId"
                            INNER JOIN "Users"
                                ON "Users"."id"="CommentAuthorAlias"."UserId"
                            FULL OUTER JOIN "Aliases" AS "CommentAuthorUserAliases"
                                ON "CommentAuthorUserAliases"."UserId"="Users"."id"
                                WHERE "Follows"."AliasId"=${AliasId}
                                AND "Follows"."followAliasId"="CommentAuthorUserAliases"."id"
                                AND "Follows"."followType" = 0)`),
                // Comment author not blocking any of viewer aliases
                Sequelize.literal(`NOT EXISTS (
                            SELECT 1 FROM "Follows"
                            FULL OUTER JOIN "Aliases" AS "ViewerAlias"
                                ON "ViewerAlias"."id"=${AliasId}
                            INNER JOIN "Users"
                                ON "Users"."id"="ViewerAlias"."UserId"
                            FULL OUTER JOIN "Aliases" AS "ViewerUserAliases"
                                ON "ViewerUserAliases"."UserId"="Users"."id"
                                WHERE "Follows"."AliasId"="${referenceName}"."AliasId"
                                AND "Follows"."followAliasId"="ViewerUserAliases"."id"
                                AND "Follows"."followType" = 0)`),
                // viewer alias is minor and comment author is blocking minors
                Sequelize.literal(
                    `NOT EXISTS (SELECT 1 FROM "Aliases" AS "AuthorAlias" JOIN "Aliases" AS "ViewerAlias" ON "ViewerAlias"."id"=${AliasId} WHERE "AuthorAlias"."id"="${referenceName}"."AliasId" AND "AuthorAlias"."showMinors"=FALSE AND "ViewerAlias"."isMinor" = TRUE)`
                ),
                // blogpost author is minor and viewer is blocking minors
                Sequelize.literal(
                    `NOT EXISTS (SELECT 1 FROM "Aliases" AS "AuthorAlias" JOIN "Aliases" AS "ViewerAlias" ON "ViewerAlias"."id"=${AliasId} WHERE "AuthorAlias"."id"="${referenceName}"."AliasId" AND "AuthorAlias"."isMinor"=TRUE AND "ViewerAlias"."showMinors"=FALSE)`
                )
            ];
        };

        const commentHasChildComments = (
            referenceName: string
        ): ProjectionAlias[] => [
            [
                Sequelize.literal(
                    `EXISTS (SELECT 1 FROM "Comments" WHERE "Comments"."parentCommentId"="${referenceName}".id )`
                ),
                "hasChildComments"
            ]
        ];
        const lastCommentIncludeAttributes = (referenceName: string) => [
            ...commentHasChildComments(referenceName)
        ];

        const promises: any = [];
        let userLiked = false;
        let numComments = 0;
        if (user) {
            promises.push(
                Reaction.findOne({
                    where: { CommentId: id, AliasId: user.AliasIds },
                    transaction
                }).then(reaction => {
                    if (reaction) {
                        userLiked = true;
                    }
                })
            );
        }
        return Comment.findOne({
            // TODO some configurable function for depth maybe ?
            where: {
                id,
                [Op.and]: [...commentAccessConditions(aliasId, "Comment")]
            },
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
                        },
                        {
                            model: Blog,
                            attributes: ["id", "link"]
                        }
                    ]
                },
                {
                    model: Comment,
                    as: "parentComment",
                    where: {
                        [Op.and]: [
                            ...commentAccessConditions(aliasId, "parentComment")
                        ]
                    },
                    required: false,
                    include: [
                        {
                            model: BlogPost,
                            as: "rootBlogPost"
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
                                    model: Blog,
                                    attributes: ["id", "link"]
                                }
                            ]
                        }
                    ]
                },
                {
                    model: Comment,
                    as: "childComments",
                    where: {
                        [Op.and]: [
                            ...commentAccessConditions(aliasId, "childComments")
                        ]
                    },
                    required: false,
                    include: [
                        {
                            model: BlogPost,
                            as: "rootBlogPost"
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
                                    model: Blog,
                                    attributes: ["id", "link"]
                                }
                            ]
                        },
                        {
                            model: Comment,
                            as: "childComments",
                            where: {
                                [Op.and]: [
                                    ...commentAccessConditions(
                                        aliasId,
                                        "childComments->childComments"
                                    )
                                ]
                            },
                            attributes: {
                                include: lastCommentIncludeAttributes(
                                    "childComments->childComments"
                                )
                            },
                            required: false,
                            include: [
                                {
                                    model: BlogPost,
                                    as: "rootBlogPost"
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
                                            model: Blog,
                                            attributes: ["id", "link"]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    model: BlogPost,
                    as: "rootBlogPost"
                }
            ],
            transaction
        }).then((comment: Comment) => {
            if (user) {
                promises.push(
                    this.setUserHasEditPermissions(comment, user, transaction)
                );
            }
            if (comment.parentComment) {
                promises.push(
                    this.setEngagementStats(
                        comment.parentComment,
                        undefined,
                        transaction
                    )
                );
            }
            comment.childComments.forEach(childComment => {
                numComments++;
                promises.push(
                    this.setEngagementStats(
                        childComment,
                        undefined,
                        transaction
                    )
                );
                if (user) {
                    promises.push(
                        this.setUserHasEditPermissions(
                            childComment,
                            user,
                            transaction
                        )
                    );
                    promises.push(
                        this.setUserLiked(childComment, user, transaction)
                    );
                }
                childComment.childComments.forEach(grandchildComment => {
                    promises.push(
                        this.setEngagementStats(
                            grandchildComment,
                            undefined,
                            transaction
                        )
                    );
                    if (user) {
                        numComments++;
                        promises.push(
                            this.setUserHasEditPermissions(
                                grandchildComment,
                                user,
                                transaction
                            )
                        );
                        promises.push(
                            this.setUserLiked(
                                grandchildComment,
                                user,
                                transaction
                            )
                        );
                    }
                });
            });
            promises.push(
                this.setEngagementStats(
                    comment.parentComment,
                    undefined,
                    transaction
                )
            );
            if (user) {
                promises.push(
                    this.setUserHasEditPermissions(
                        comment.parentComment,
                        user,
                        transaction
                    )
                );
                promises.push(
                    this.setUserLiked(comment.parentComment, user, transaction)
                );
            }
            promises.push(
                promises.push(
                    this.setEngagementStats(comment, numComments, transaction)
                )
            );
            return Promise.all(promises).then(() => {
                comment.setDataValue("userLiked", userLiked);
                comment.sanitizeContents();
                return comment;
            });
        });
    }

    public updateComment(
        comment: Comment,
        commentParams: CommentInterface,
        transaction: Transaction
    ): Promise<Comment> {
        if (typeof commentParams.content !== "undefined") {
            comment.content = commentParams.content;
        }

        return comment.save({ transaction });
    }

    public setEngagementStats(
        comment: Comment,
        numComments = 0,
        transaction: Transaction
    ) {
        if (comment) {
            let numLikes = 0;
            const promises: any = [];
            promises.push(
                Reaction.count({
                    where: { CommentId: comment.id },
                    transaction
                }).then(countReactions => {
                    numLikes = countReactions;
                })
            );
            if (numComments === 0) {
                promises.push(
                    Comment.count({
                        where: { parentCommentId: comment.id }
                    }).then(countChildComments => {
                        numComments = countChildComments;
                    })
                );
            }
            return Promise.all(promises).then(() => {
                comment.setDataValue("engagementStats", {
                    likes: numLikes,
                    // TODO engagementstats
                    comments: numComments
                });
                return comment;
            });
        } else return Promise.resolve(comment);
    }
    public setUserLiked(
        comment: Comment,
        user: User,
        transaction: Transaction
    ) {
        if (user && comment) {
            let userLiked = false;
            return Reaction.findOne({
                where: { CommentId: comment.id, AliasId: user.AliasIds },
                transaction
            }).then(reaction => {
                if (reaction) {
                    userLiked = true;
                }
                comment.setDataValue("userLiked", userLiked);
                return comment;
            });
        } else {
            return Promise.resolve(comment);
        }
    }
    public setUserHasEditPermissions(
        comment: Comment,
        user: User,
        transaction: Transaction
    ) {
        if (comment) {
            const promises: any = [];
            let userHasEditPermissions = false;
            promises.push(
                AuthService.userHasEditPermissionsForEntity(
                    comment,
                    user,
                    transaction
                ).then(hasPermission => {
                    userHasEditPermissions = hasPermission;
                })
            );
            return Promise.all(promises).then(() => {
                comment.setDataValue(
                    "userHasEditPermissions",
                    userHasEditPermissions
                );
                return comment;
            });
        } else return Promise.resolve(comment);
    }
    public createNotification(
        savedComment: Comment,
        aliasId: number,
        entity: "comment" | "blogPost",
        id: number,
        reblog = false,
        transaction: Transaction
    ): Promise<void> {
        let getTargetAliasId: Promise<number>;
        if (entity === "comment") {
            getTargetAliasId = Comment.findByPk(id, { transaction }).then(
                (comment: Comment): number => {
                    return comment.AliasId;
                }
            );
        } else {
            getTargetAliasId = BlogPost.findByPk(id, { transaction }).then(
                (blogPost: BlogPost): number => {
                    return blogPost.AliasId;
                }
            );
        }
        return NotificationController.create(
            aliasId,
            getTargetAliasId,
            "comment",
            {
                sourceCommentId: savedComment.id,
                ...(entity === "comment" && { targetCommentId: id }),
                ...(entity === "blogPost" && { targetBlogPostId: id })
            },
            reblog,
            transaction
        );
    }
}

const controller = new CommentsController();
export { controller as CommentsController };
