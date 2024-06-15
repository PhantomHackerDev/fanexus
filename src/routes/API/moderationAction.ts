import express from "express";
import { auth, AuthRequest } from "../../Authorization/auth";
import { ModerationAction } from "../../Entity/ModerationAction";
import { Alias } from "../../Entity/Alias";
import { User } from "../../Entity/User";
import { sanitizeContents } from "../../Entity/shared/sanitizeHTML";
import { StatusCodes } from "http-status-codes";

export const moderationActionRouter = express.Router();

moderationActionRouter.get("/", auth, (req: AuthRequest, res) => {
    if (!req.user.moderator) {
        return res.status(StatusCodes.FORBIDDEN).send("User must be moderator");
    }

    return ModerationAction.findAll({
        include: [
            {
                model: Alias,
                attributes: ["id", "name", "avatarId"]
            }
        ],
        order: [["id", "DESC"]]
    })
        .then(results =>
            res.send(
                results.map(result => {
                    const resultJSON: any = result.toJSON();
                    return {
                        ...resultJSON,
                        details: (details => ({
                            ...(details.blogPost &&
                                (blogPost => ({
                                    blogPost: {
                                        ...blogPost,
                                        content: sanitizeContents(
                                            blogPost.content
                                        ),
                                        ...(blogPost.reblogOfBlogPost &&
                                            (reblog => ({
                                                ...reblog,
                                                content: sanitizeContents(
                                                    reblog
                                                )
                                            }))(blogPost.reblogOfBlogPostt))
                                    }
                                }))(details.blogPost)),
                            ...(details.comment &&
                                (comment => ({
                                    comment: {
                                        ...comment,
                                        content: sanitizeContents(
                                            comment.content
                                        )
                                    }
                                }))(details.comment)),
                            ...(details.userEmail &&
                                (userEmail => ({
                                    userEmail
                                }))(details.userEmail))
                        }))(resultJSON.details)
                    };
                })
            )
        )
        .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e));
});
