import express from "express";
import { auth, AuthRequest } from "../../Authorization/auth";
import { User } from "../../Entity/User";
import { Alias } from "../../Entity/Alias";
import { Blog } from "../../Entity/Blog";
import { BlogPost } from "../../Entity/BlogPost";
import { BlogPostController } from "../../Controller/BlogPostController";
import { ErrorReportService } from "../../services/ErrorReportService";
import { ReactionController } from "../../Controller/ReactionController";
import { Reaction } from "../../Entity/Reaction";
import { AuthService } from "../../services/AuthService";
import { Response } from "express";
import { ShareToInterface } from "../../Interface/BlogPostInterface";
import { Community } from "../../Entity/Community";
import { FollowController } from "../../Controller/FollowController";
import { StatusCodes } from "http-status-codes";
import { database as sequelize } from "../../services/databaseService.js";

const blogPostRouter = express.Router();

blogPostRouter.get("/:blogPostId", auth, (req: AuthRequest, res: Response) =>
    sequelize
        .transaction(transaction => {
            const blogPostId = Number(req.params.blogPostId);
            const gettingAsUser: User = req.user;
            const UserId = gettingAsUser.id;
            const AliasId = req.currentAlias;
            return FollowController.getRelevantTagIdsForAlias(
                AliasId,
                gettingAsUser.isMinor,
                transaction
            ).then(tagIds => {
                return BlogPost.getBlogPosts(
                    {
                        UserId,
                        gettingAsUser,
                        AliasId,
                        blogPostId,
                        blockedTagIds: tagIds.blocks
                    },
                    transaction
                ).then(results => {
                    res.send(results.BlogPosts[0]);
                });
            });
        })
        .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e))
);

blogPostRouter.post(
    "",
    auth,
    (req: AuthRequest, res: Response): Promise<any> =>z
);

blogPostRouter.post("/:blogPostId", auth, (req: AuthRequest, res: Response) =>
    sequelize
        .transaction(transaction => {
            const id = req.params.blogPostId;
            const user: User = req.user;
            const alias = req.body.alias;
            const promises: any = [];
            return BlogPostController.getBlogPost(
                id,
                user,
                alias,
                transaction
            ).then(blogPost => {
                return Promise.all(promises)
                    .then(() => {
                        if (false === blogPost.userHasEditPermissions) {
                            res.send(
                                ErrorReportService.getEnvError(
                                    "User has no permission to edit this",
                                    "noPermission"
                                )
                            );
                            return;
                        }
                        return BlogPostController.updateBlogPost(
                            blogPost,
                            {
                                content: req.body.content,
                                tagNames: req.body.tagNames,
                                hideFromSearchResults:
                                    req.body.hideFromSearchResults,
                                tagDisplays: req.body.tagDisplays,
                                viewingPrivacyGroups:
                                    req.body.viewingPrivacyGroups,
                                commentingPrivacyGroups:
                                    req.body.commentingPrivacyGroups
                            },
                            transaction
                        );
                    })
                    .then((updatedRes: BlogPost) => {
                        return BlogPostController.getBlogPost(
                            updatedRes.id,
                            user,
                            alias,
                            transaction
                        ).then(
                            (updatedBlogPost: BlogPost): BlogPost => {
                                res.send(updatedBlogPost);
                                return updatedBlogPost;
                            }
                        );
                    });
            });
        })
        .catch(error => {
            console.log(error);
            res.send(
                ErrorReportService.getEnvError(error, "blogPost_edit_fail")
            );
        })
);

blogPostRouter.post(
    "/:blogPostId/like",
    auth,
    (req: AuthRequest, res: Response): Promise<Response> =>
        sequelize
            .transaction(transaction => {
                const blogPost = req.params.blogPostId;
                const alias = req.currentAlias;
                if (!blogPost) {
                    throw new Error("Blog Post ID is missing.");
                }
                return ReactionController.createReactionOnBlogPost(
                    {
                        type: "like",
                        blogPost,
                        alias
                    },
                    transaction
                ).then(reaction => res.send(reaction));
            })
            .catch(e => {
                console.error(e);
                return res
                    .status(StatusCodes.BAD_REQUEST)
                    .send(
                        ErrorReportService.getEnvError(e, "blogPost_like_error")
                    );
            })
);

blogPostRouter.post(
    "/:blogPostId/unlike",
    auth,
    (req: AuthRequest, res: Response) => {
        const id = req.params.blogPostId;
        const alias = req.currentAlias;
        const user: User = req.user;
        return ReactionController.getAlreadyLikedByUser({ blogPost: id }, user)
            .then(existingReaction => {
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
            })
            .catch(e => {
                res.send(
                    ErrorReportService.getEnvError(e, "blogPost_unlike_error")
                );
            });
    }
);

/*const modifyBlogPostTags = (req: AuthRequest, res: Response, responseString: string, method: (blogPost: BlogPost, tag: Tag) => Promise<void>): Promise<any> => {
    const user = req.user;
    return BlogPost.findByPk(req.params.blogPostId).then((blogPost): Promise<any> => {
        if(!blogPost) {
            return Promise.reject(Error("BlogPost not found."));
        }

        return AuthService.userHasEditPermissionsForEntity(blogPost, user).then(hasPermissions => {
            if(hasPermissions) {
                return Promise.all(req.body.tags.map((tagId: string) =>
                    Tag.findByPk(Number(tagId))
                )).then(tagObjects =>
                    tagObjects.filter(tag => tag).map(
                        (foundTag: Tag) => method(blogPost, foundTag)
                    )
                ).then(() =>
                    res.send(`${responseString} tags.`)
                );
            } else {
                return res.status(StatusCodes.FORBIDDEN).send("User does not have tag edit permissions.");
            }
        });

    }).catch((e) => {
        console.log(e);
        return res.send(ErrorReportService.getEnvError(e, "blogPost_modifyTag_error"));
    });
}

blogPostRouter.put('/:blogPostId/tags', auth, (req:AuthRequest, res): Promise<any> =>
    modifyBlogPostTags(req, res, "Added", (blogPost, tag): Promise<void> => {
        return blogPost.addTagWithNeo4j(tag);
    })
);

blogPostRouter.delete('/:blogPostId/tags', auth, (req:AuthRequest, res): Promise<any> =>
    modifyBlogPostTags(req, res, "Removed", (blogPost, tag): Promise<void> => {
        return blogPost.removeTagWithNeo4j(tag);
    })
);*/

blogPostRouter.patch(
    "/:blogPostId/tags",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        sequelize.transaction(transaction =>
            BlogPost.findByPk(Number(req.params.blogPostId))
                .then(blogPost => {
                    if (blogPost) {
                        return BlogPostController.setTags(
                            blogPost,
                            req.body.tags,
                            transaction
                        );
                    }
                })
                .then(() => res.send("Tags edited."))
        )
);

blogPostRouter.delete("/:blogPostId", auth, (req: AuthRequest, res: Response) =>
    sequelize
        .transaction(transaction => {
            const id = req.params.blogPostId;
            const { user, currentAlias: alias } = req;
            return BlogPostController.getBlogPost(
                id,
                user,
                alias,
                transaction
            ).then(blogPost => {
                if (blogPost.userHasEditPermissions) {
                    return BlogPostController.removeBlogPost(
                        blogPost.id,
                        alias,
                        transaction
                    ).then(deleted => {
                        return res.send(deleted);
                    });
                } else if (user.moderator) {
                    // userHasEditPermissions must be false to arrive here
                    return BlogPostController.moderatorRemoveBlogPost(
                        blogPost.id,
                        alias,
                        req.body.reason,
                        transaction
                    ).then(moderationAction => res.send(moderationAction));
                } else {
                    return res
                        .status(StatusCodes.FORBIDDEN)
                        .send(
                            ErrorReportService.getEnvError(
                                "User has no permission to edit this",
                                "noPermission"
                            )
                        );
                }
            });
        })
        .catch(error => {
            console.log(error);
            res.send(
                ErrorReportService.getEnvError(error, "blogPost_delete_fail")
            );
        })
);

blogPostRouter.post(
    "/sharing/getEligibleShareToEntitiesForAlias",
    auth,
    (req: AuthRequest, res: Response) => {
        try {
            const alias = req.body.alias;
            const user: User = req.user;
            return user
                .hasAlias(alias)
                .then(hasAlias => {
                    if (false === hasAlias) {
                        res.send(
                            ErrorReportService.getEnvError(
                                "User does not have the alias you are trying to unlike with",
                                "blogPostUnLike_fail_wrongAlias"
                            )
                        );
                        return;
                    } else {
                        return AuthService.getEntitiesAliasCanPostTo(
                            alias
                        ).then(resp => {
                            console.log(resp);
                            console.log("resp in blogpost router");
                            return res.send(resp);
                        });
                    }
                })
                .catch(e => {
                    res.send(
                        ErrorReportService.getEnvError(
                            e,
                            "blogPost_getEligibleShareToEntitiesForAlias_error"
                        )
                    );
                });
        } catch (e) {
            res.send(
                ErrorReportService.getEnvError(
                    e,
                    "blogPost_getEligibleShareToEntitiesForAlias_error"
                )
            );
        }
    }
);

blogPostRouter.get(
    "/:blogPostId/mock",
    async (req: AuthRequest, res: Response) => {
        // mock

        const responseObject = {
            id: req.params.blogPostId,
            origin: {
                type: "blog",
                id: 99,
                name: "The batcave daily",
                link: "/blog/thebatcavedaily"
            },
            alias: {
                name: "blog name",
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
                    id: 124,
                    name: "gotham",
                    style: "background-color: purple; font-weight:bold"
                },
                {
                    id: 125,
                    name: "batman",
                    style: "background-color: black; font-weight:bold"
                },
                {
                    id: 126,
                    name: "gotham",
                    style: "background-color: purple; font-weight:bold"
                },
                {
                    id: 127,
                    name: "batman",
                    style: "background-color: black; font-weight:bold"
                },
                {
                    id: 128,
                    name: "gotham",
                    style: "background-color: purple; font-weight:bold"
                },
                {
                    id: 129,
                    name: "batman",
                    style: "background-color: black; font-weight:bold"
                },
                {
                    id: 130,
                    name: "gotham",
                    style: "background-color: purple; font-weight:bold"
                },
                {
                    id: 131,
                    name: "batman",
                    style: "background-color: black; font-weight:bold"
                },
                {
                    id: 132,
                    name: "gotham",
                    style: "background-color: purple; font-weight:bold"
                },
                {
                    id: 133,
                    name: "batman",
                    style: "background-color: black; font-weight:bold"
                },
                {
                    id: 134,
                    name: "gotham",
                    style: "background-color: purple; font-weight:bold"
                },
                {
                    id: 135,
                    name: "batman",
                    style: "background-color: black; font-weight:bold"
                },
                {
                    id: 136,
                    name: "gotham",
                    style: "background-color: purple; font-weight:bold"
                },
                {
                    id: 137,
                    name: "batman",
                    style: "background-color: black; font-weight:bold"
                },
                {
                    id: 138,
                    name: "gotham",
                    style: "background-color: purple; font-weight:bold"
                },
                {
                    id: 139,
                    name: "batman",
                    style: "background-color: black; font-weight:bold"
                },
                {
                    id: 140,
                    name: "gotham",
                    style: "background-color: purple; font-weight:bold"
                },
                {
                    id: 141,
                    name: "batman",
                    style: "background-color: black; font-weight:bold"
                },
                {
                    id: 142,
                    name: "gotham",
                    style: "background-color: purple; font-weight:bold"
                },
                {
                    id: 143,
                    name: "gotham",
                    style: "background-color: purple; font-weight:bold"
                },
                {
                    id: 144,
                    name: "batman",
                    style: "background-color: black; font-weight:bold"
                },
                {
                    id: 145,
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
        };
        res.send(responseObject);
    }
);

export { blogPostRouter };
