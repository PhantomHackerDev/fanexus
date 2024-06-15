import express, { Response } from "express";
import { BlogController } from "../../Controller/BlogController";
import { Blog } from "../../Entity/Blog";
import { ErrorReportService } from "../../services/ErrorReportService";
import { auth, AuthRequest } from "../../Authorization/auth";
import { User } from "../../Entity/User";
import { Alias } from "../../Entity/Alias";
import { Image } from "../../Entity/Image";
import { Follow } from "../../Entity/Follow";
import { Tag } from "../../Entity/Tag";
import { Reaction } from "../../Entity/Reaction";
import { AccessControlGroupController } from "../../Controller/AccessControlGroupController";
import { BlogPostController } from "../../Controller/BlogPostController";
import { CommentsController } from "../../Controller/CommentsController";
import { AuthService } from "../../services/AuthService";
import { BlogPost, orders } from "../../Entity/BlogPost";
import { FollowController } from "../../Controller/FollowController";
import { StatusCodes } from "http-status-codes";
import { Sequelize, Op, ProjectionAlias, OrderItem } from "sequelize";
import { database as sequelize } from "../../services/databaseService.js";
import { tagFunctions } from "../../Controller/shared/TagFunctions";

const blogRouter = express.Router();

blogRouter.get(
    "/:blogIdentifier/:id(id)?/:order(liked|commented|reblogged|score|id|undefined)?/:noReblogs(no-reblogs)?/:page(\\d+)?",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        sequelize
            .transaction(transaction => {
                // TODO ACCESSCONTROL AND PAGINATION
                const page: number = req.params.page
                    ? Number(req.params.page)
                    : 1;
                const user: User = req.user;
                const UserId = Number(req.user.id);
                const AliasId = req.currentAlias;
                const order = req.params.order as
                    | undefined
                    | keyof typeof orders;

                return Promise.all([
                    BlogController.getBlog(
                        req.params.blogIdentifier,
                        req.currentAlias,
                        !!req.params.id,
                        transaction
                    ),
                    FollowController.getRelevantTagIdsForAlias(
                        AliasId,
                        user.isMinor,
                        transaction
                    )
                ]).then(([blog, { blocks: blockedTagIds }]) => {
                    if (!blog) {
                        return Promise.reject({
                            status: StatusCodes.NOT_FOUND,
                            message: "blog with that id does not exist"
                        });
                    }

                    const conditions = {
                        UserId,
                        gettingAsUser: user,
                        AliasId,
                        BlogId: blog.id,
                        blockedTagIds
                    };
                    return Promise.all([
                        BlogPost.getBlogPosts(
                            {
                                ...conditions,
                                ...(order && { order }),
                                page,
                                blockedTagIds,
                                excludeEmptyReblogs: !!req.params.noReblogs
                            },
                            transaction
                        ),
                        Tag.getTagsCount(conditions, transaction),
                        AuthService.userHasEditPermissionsForEntity(
                            blog,
                            user,
                            transaction
                        ),
                        blog.getAlias().then((alias: Alias) => {
                            return alias.getUser();
                        })
                    ]).then(
                        ([
                            results,
                            tagCounts,
                            userHasEditPermissions,
                            blogUser
                        ]) => {
                            let jsonBlog = blog.toJSON();
                            // @ts-ignore
                            jsonBlog.Tags = blog.Tags.map(blogTag => {
                                return tagFunctions.getDisplayTag(
                                    blogTag,
                                    "Blog_Tag"
                                );
                            });

                            return res.send({
                                ...jsonBlog,
                                ...results,
                                tagCounts,
                                page,
                                type: "blog",
                                links: blog.links,
                                userHasEditPermissions,
                                blogUserEmail: user.moderator
                                    ? blogUser.email
                                    : undefined
                            });
                        }
                    );
                });
            })
            .catch(e => {
                console.error(e);
                return res.status(e.status || StatusCodes.BAD_REQUEST).send(e);
            })
);

blogRouter.get(
    "/:blogIdentifier/:id(id)?/tags/:tagNames/:order(liked|commented|reblogged|score|id|undefined)?/:noReblogs(no-reblogs)?/:page(\\d+)?",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        sequelize
            .transaction(transaction => {
                const user: User = req.user;
                const UserId = Number(req.user.id);
                const gettingAsUser = req.user;
                const AliasId = req.currentAlias;
                const order = req.params.order as
                    | undefined
                    | keyof typeof orders;
                const page: number = req.params.page
                    ? Number(req.params.page)
                    : 1;

                return BlogController.getBlog(
                    req.params.blogIdentifier,
                    req.currentAlias,
                    !!req.params.id,
                    transaction
                ).then(blog => {
                    if (!blog) {
                        return Promise.reject({
                            status: 404,
                            message: "blog with that id does not exist"
                        });
                    }

                    const conditions = {
                        UserId,
                        gettingAsUser,
                        AliasId,
                        BlogId: blog.id,
                        tagNames: JSON.parse(req.params.tagNames)
                    };
                    return FollowController.getRelevantTagIdsForAlias(
                        AliasId,
                        user.isMinor,
                        transaction
                    ).then(tagResults => {
                        return Promise.all([
                            BlogPost.getBlogPosts(
                                {
                                    ...conditions,
                                    ...(order && { order }),
                                    page,
                                    blockedTagIds: tagResults.blocks,
                                    excludeEmptyReblogs: !!req.params.noReblogs
                                },
                                transaction
                            ),
                            Tag.getTagsCount(conditions, transaction),
                            AuthService.userHasEditPermissionsForEntity(
                                blog,
                                user,
                                transaction
                            )
                        ]).then(
                            ([results, tagCounts, userHasEditPermissions]) => {
                                if (!results) {
                                    return Promise.reject(
                                        ErrorReportService.getEnvError(
                                            "Does not exist or no view permissions",
                                            "entity_does_not_exist_or_alias_has_no_view_permissions"
                                        )
                                    );
                                }

                                let jsonBlog = blog.toJSON();
                                // @ts-ignore
                                jsonBlog.Tags = blog.Tags.map(blogTag => {
                                    return tagFunctions.getDisplayTag(
                                        blogTag,
                                        "Blog_Tag"
                                    );
                                });
                                // TODO: standardize pages
                                return res.send({
                                    ...jsonBlog,
                                    ...results,
                                    tagCounts,
                                    page,
                                    type: "blog",
                                    links: blog.links,
                                    userHasEditPermissions
                                });
                            }
                        );
                    });
                });
            })
            .catch(e => {
                console.error(e);
                return res
                    .status(e.status || StatusCodes.BAD_REQUEST)
                    .send(e.message || e);
            })
);

blogRouter.get(
    "/:blogIdentifier/:id(id)?/followedBy",
    auth,
    (req: AuthRequest, res): Promise<Response> => {
        const blogIdentifier = req.params.blogIdentifier;
        const isNumber = !isNaN(Number(blogIdentifier));
        const whereIdentifierCondition = {
            [Op.or]: [
                { link: blogIdentifier },
                ...(isNumber ? [{ id: blogIdentifier }] : [])
            ]
        };
        const matchIdAttribute: ProjectionAlias = [
            Sequelize.literal(
                `"Blog"."id"=${sequelize.escape(blogIdentifier)}`
            ),
            "matchId"
        ];
        const orderItem: OrderItem = [
            Sequelize.col("matchId"),
            req.params.id ? "DESC" : "ASC"
        ];
        return Blog.findOne({
            where: whereIdentifierCondition,
            include: [
                {
                    model: Alias,
                    attributes: ["id", "name", "avatarId"],
                    as: "followedBy",
                    include: [
                        {
                            model: Blog,
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
                        }
                    ],
                    through: {
                        where: {
                            followType: Follow.FOLLOW_TYPES.follow
                        }
                    }
                }
            ],
            attributes: {
                include: isNumber ? [matchIdAttribute] : []
            },
            order: [...(isNumber ? [orderItem] : [])]
        })
            .then(blog => {
                if (blog) {
                    blog.sanitizeContents();
                    res.send(blog);
                    return Promise.resolve(blog);
                }
                return Promise.reject({
                    status: StatusCodes.NOT_FOUND,
                    note: "Blog not found."
                });
            })
            .catch(e =>
                res
                    .status(e.status || StatusCodes.BAD_REQUEST)
                    .send(e.note || e)
            );
    }
);

blogRouter.get(
    "/:blogId/followedBy/count",
    auth,
    (req: AuthRequest, res): Promise<Response> => {
        return Follow.count({
            where: {
                followBlogId: req.params.blogId,
                followType: Follow.FOLLOW_TYPES.follow
            }
        })
            .then(
                (count: number): Response => {
                    return res.send({ count });
                }
            )
            .catch(e => {
                return res.status(StatusCodes.BAD_REQUEST).send(e);
            });
    }
);

blogRouter.get(
    "/:blogIdentifier/likes/count",
    auth,
    (req: AuthRequest, res): Promise<Response> => {
        const AliasId = req.currentAlias;
        return Reaction.count({
            where: { type: Reaction.REACTION_TYPE.like, AliasId }
        })
            .then((count: number) => {
                return res.send({ count });
            })
            .catch(e => {
                return res.status(StatusCodes.BAD_REQUEST).send(e);
            });
    }
);

blogRouter.get(
    "/:blogIdentifier/likes/blogPosts/:order(liked|commented|reblogged|score|id|undefined)?/:page(\\d)?",
    auth,
    (req: AuthRequest, res) =>
        sequelize
            .transaction(transaction => {
                const UserId = Number(req.user.id);
                const AliasId = req.currentAlias;
                const gettingAsUser = req.user;
                const order = req.params.order as
                    | undefined
                    | keyof typeof orders;
                const conditions = {
                    UserId,
                    AliasId,
                    gettingAsUser,
                    likedById: req.params.blogIdentifier
                };

                return FollowController.getRelevantTagIdsForAlias(
                    AliasId,
                    gettingAsUser.isMinor,
                    transaction
                ).then(relevantTags => {
                    return Promise.all([
                        BlogPost.getBlogPosts(
                            {
                                ...conditions,
                                ...(order && { order }),
                                page: Number(req.params.page) || 1,
                                blockedTagIds: relevantTags.blocks
                            },
                            transaction
                        ),
                        Tag.getTagsCount(conditions, transaction)
                    ]).then(([results, tagCounts]) => {
                        res.send({ ...results, tagCounts });
                    });
                });
            })
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e))
);

blogRouter.get(
    "/:blogIdentifier/likes/blogPosts/tags/:tagNames/:order(liked|commented|reblogged|score|id|undefined)?/:page(\\d)?",
    auth,
    (req: AuthRequest, res) =>
        sequelize
            .transaction(transaction => {
                const UserId = Number(req.user.id);
                const AliasId = req.currentAlias;
                const gettingAsUser = req.user;
                const tagNames =
                    req.params.tagNames && JSON.parse(req.params.tagNames);
                const order = req.params.order as
                    | undefined
                    | keyof typeof orders;
                const conditions = {
                    UserId,
                    gettingAsUser,
                    AliasId,
                    likedById: req.params.blogIdentifier,
                    ...(tagNames && { tagNames })
                };

                return FollowController.getRelevantTagIdsForAlias(
                    AliasId,
                    req.user.isMinor,
                    transaction
                ).then(tagResults => {
                    return Promise.all([
                        BlogPost.getBlogPosts(
                            {
                                ...conditions,
                                ...(order && { order }),
                                page: Number(req.params.page) || 1,
                                blockedTagIds: tagResults.blocks
                            },
                            transaction
                        ),
                        Tag.getTagsCount(conditions, transaction)
                    ]).then(([results, tagCounts]) =>
                        res.send({ ...results, tagCounts })
                    );
                });
            })
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e))
);

blogRouter.get(
    "/:blogIdentifier/likes/comments",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        sequelize
            .transaction(transaction => {
                const user: User = req.user;
                const AliasId = req.currentAlias;
                return Blog.findOne({
                    where: isNaN(Number(req.params.blogIdentifier))
                        ? { link: req.params.blogIdentifier }
                        : { id: req.params.blogIdentifier },
                    include: [
                        {
                            model: Alias,
                            attributes: ["id", "name", "avatarId"],
                            include: [
                                {
                                    model: Reaction
                                }
                            ]
                        }
                    ],
                    transaction
                })
                    .then((blog: Blog) =>
                        Promise.all(
                            blog.Alias.Reactions.filter(
                                reaction => reaction.CommentId
                            ).map(reaction =>
                                CommentsController.getComment(
                                    reaction.CommentId,
                                    user,
                                    AliasId,
                                    transaction
                                )
                            )
                        )
                    )
                    .then(comments =>
                        Promise.all(
                            comments.map(comment =>
                                BlogPostController.getBlogPost(
                                    comment.rootBlogPostId,
                                    user,
                                    AliasId,
                                    transaction
                                ).then(blogPost => ({
                                    ...blogPost.toJSON(),
                                    showComment: comment
                                }))
                            )
                        )
                    )
                    .then(BlogPosts => {
                        return res.send({ BlogPosts });
                    });
            })
            .catch(e => {
                return res.status(StatusCodes.BAD_REQUEST).send(e);
            })
);

blogRouter.post(
    "/:blogId(\\d+)/accessControl/addAliases",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        sequelize
            .transaction(transaction => {
                const user: User = req.user;
                return BlogController.getBlog(
                    req.params.blogId,
                    req.currentAlias,
                    undefined,
                    transaction
                ).then(blog => {
                    if (!blog) {
                        return Promise.reject(
                            "blog with that id does not exist"
                        );
                    }
                    return blog.getAlias({ transaction }).then(alias => {
                        return user
                            .hasAlias(alias, { transaction })
                            .then(hasAlias => {
                                if (!hasAlias) {
                                    return Promise.reject(
                                        "User does not have this alias"
                                    );
                                }
                                return AccessControlGroupController.addAliasesToAccessControlGroup(
                                    req.body.accessControlGroupId,
                                    req.currentAlias,
                                    req.body.aliases,
                                    undefined,
                                    transaction
                                ).then(promises => {
                                    return Promise.all(promises).then(() => {
                                        return res.send(
                                            "Access control updated"
                                        );
                                    });
                                });
                            });
                    });
                });
            })
            .catch(error =>
                res
                    .status(StatusCodes.BAD_REQUEST)
                    .send(
                        ErrorReportService.getEnvError(
                            error,
                            "blog_accessControl_addAliases_fail"
                        )
                    )
            )
);

blogRouter.post(
    "/:blogId(\\d+)/accessControl/removeAliases",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        sequelize
            .transaction(transaction => {
                const user: User = req.user;
                return BlogController.getBlog(
                    req.params.blogId,
                    req.currentAlias,
                    undefined,
                    transaction
                ).then(blog => {
                    if (!blog) {
                        return Promise.reject(
                            "blog with that id does not exist"
                        );
                    }
                    return blog.getAlias({ transaction }).then(alias => {
                        return user
                            .hasAlias(alias, { transaction })
                            .then(hasAlias => {
                                if (!hasAlias) {
                                    return Promise.reject(
                                        "User does not have this alias"
                                    );
                                }
                                return AccessControlGroupController.removeAliasesFromAccessControlGroup(
                                    req.body.accessControlGroupId,
                                    req.currentAlias,
                                    req.body.aliases,
                                    undefined,
                                    transaction
                                ).then(promises =>
                                    Promise.all(promises).then(() =>
                                        res.send("Access control updated")
                                    )
                                );
                            });
                    });
                });
            })
            .catch(error =>
                res
                    .status(StatusCodes.BAD_REQUEST)
                    .send(
                        ErrorReportService.getEnvError(
                            error,
                            "blog_accessControl_addAliases_fail"
                        )
                    )
            )
);

/*blogRouter.post('/:blogId(\\d+)/tags/add', auth, async(req:AuthRequest, res): Promise<Response> => {
    const user: User = req.user;
    return BlogController.getBlog(req.params.blogId, req.currentAlias).then(blog => {
        if(!blog){
            return Promise.reject("blog with that id does not exist");
        }
        const promises:any = [];
        let userHasEditPermissions:boolean;
        promises.push(AuthService.userHasEditPermissionsForEntity(blog, user).then(hasPermissions => {
            userHasEditPermissions = hasPermissions;
        }));
        return Promise.all(promises).then(() => {
            if(false === userHasEditPermissions){
                return res.send(ErrorReportService.getEnvError("User has no permission to edit this", "blogEdit_noPermission"));
            }
            return BlogController.addTags(blog, req.body.tags).then(() => {
                return res.send("Tags added");
            })
        })

    }).catch(error => {
        console.error(error);
        return res.status(StatusCodes.BAD_REQUEST).send(ErrorReportService.getEnvError(error, "blog_tags_add_fail"));
    });
});*/

/*blogRouter.post('/:blogId(\\d+)/tags/remove', auth, async(req:AuthRequest, res): Promise<Response> => {
    const user: User = req.user;
    return BlogController.getBlog(req.params.blogId, req.currentAlias).then(blog => {
        if(!blog){
            return Promise.reject("blog with that id does not exist");
        }
        const promises:any = [];
        let userHasEditPermissions:boolean;
        promises.push(AuthService.userHasEditPermissionsForEntity(blog, user).then(hasPermissions => {
            userHasEditPermissions = hasPermissions;
        }));
        return Promise.all(promises).then(() => {
            if(false === userHasEditPermissions){
                return res.send(ErrorReportService.getEnvError("User has no permission to edit this", "blogEdit_noPermission"));
            }
            return BlogController.removeTags(blog, req.body.tags).then(() => {
                return res.send("Tags removed");
            })
        });
    }).catch(error =>
        res.status(StatusCodes.BAD_REQUEST).send(ErrorReportService.getEnvError(error, "blog_tags_remove_fail"))
    );
});*/

blogRouter.patch(
    "/:blogId/tags",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        sequelize
            .transaction(transaction =>
                Blog.findByPk(Number(req.params.blogId))
                    .then(blog =>
                        blog
                            ? BlogController.setTags(
                                  blog,
                                  req.body.tags,
                                  transaction
                              )
                            : Promise.reject("Blog with that ID not found.")
                    )
                    .then(() => res.send("Tags edited."))
            )
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e))
);

/*blogRouter.post('', auth, (req:AuthRequest, res:Response): Promise<Response> => {
    // deprecaated and wrong, only way to create a blog is to create new alias
    const user:User = req.user;
    return user.hasAlias(req.body.alias).then(hasAlias =>
        hasAlias || Promise.reject(ErrorReportService.getEnvError("User does not have the alias you are trying to create the blog with", "blogCreate_fail_wrongAlias"))
    ).then(() => BlogController.createBlog(
        {
            name: req.body.name,
            link: req.body.link,
            links: req.body.links,
            description: req.body.description,
            avatar: req.body.avatar,
            coverImage: req.body.coverImage,
            alias: req.body.alias,
            tags: req.body.tags,
            contentAccessControl: req.body.contentAccessControl,
            followsAccessControl: req.body.followsAccessControl,
            reactionsAccessControl: req.body.reactionsAccessControl,
            commentsAccessControl: req.body.commentsAccessControl,
            tagNames: req.body.tagNames,
            hideFromSearchResults: req.body.hideFromSearchResults
        }
    )).then((blog)=>{
        return res.send(blog);
    }).catch(e =>
        res.status(StatusCodes.BAD_REQUEST).send(e)
    );
});*/

blogRouter.post(
    "/:blogId",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        sequelize
            .transaction(transaction =>
                BlogController.updateBlog(
                    {
                        alias: req.currentAlias,
                        blogId: req.params.blogId,
                        ...req.body
                    },
                    transaction
                ).then(blog => res.send(blog))
            )
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e))
);

blogRouter.get(
    "/:blogIdentifier/find",
    auth,
    (req: AuthRequest, res): Promise<Response> => {
        return BlogController.findBlog(req.params.blogIdentifier)
            .then(blogs => res.send(blogs))
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e));
    }
);

blogRouter.post("/mock", async (req: AuthRequest, res: Response) => {
    try {
        const alias = req.body.alias;
        const name = req.body.name;
        const link = req.body.link;
        const links = req.body.links;
        const description = req.body.description;
        // TODO images and gallery
        const tags = req.body.tags;
        const subscriptionApproval = req.body.subscriptionApproval;
        const contentVisibility = req.body.contentVisibility;
        const commentsPermissions = req.body.commentsPermissions;
        // TODO check likes and follows with claire
        const likesVisibility = req.body.likesVisibility;
        const followVisibility = req.body.followVisibility;

        if (
            alias &&
            name &&
            link &&
            links &&
            description &&
            tags &&
            subscriptionApproval &&
            contentVisibility &&
            commentsPermissions &&
            likesVisibility &&
            followVisibility
        ) {
            res.status(StatusCodes.CREATED).send({ id: 123 });
        } else {
            res.status(StatusCodes.BAD_REQUEST).send("bad data");
        }
    } catch {
        res.status(StatusCodes.BAD_REQUEST).send("bad data");
    }
});

blogRouter.post("/:blogId/mock", async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.blogId;
        const alias = req.body.alias;
        // TODO images and gallery
        // TODO check likes and follows with claire

        if (id && alias) {
            res.status(StatusCodes.CREATED).send({ id: 123 });
        } else {
            res.status(StatusCodes.BAD_REQUEST).send("bad data");
        }
    } catch {
        res.status(StatusCodes.BAD_REQUEST).send("bad data");
    }
});

blogRouter.delete(
    "/:blogId",
    (req: AuthRequest, res): Response => {
        const id = req.params.blogId;
        const alias = req.body.alias;

        if (id && alias) {
            return res.send({ id });
        } else {
            return res.status(StatusCodes.BAD_REQUEST).send("bad data");
        }
    }
);

blogRouter.get(
    "/:blogId(\\d+)/:page(\\d+)?/mock",
    async (req: AuthRequest, res: Response) => {
        const page = req.params.page ? req.params.page : 1;

        const responseObject = {
            id: req.params.blogId,
            page,
            name: "the batcave daily",
            link: "/blog/thebatcavedaily",
            type: "blog",
            links: [
                {
                    link: "https://twitter.com/hashtag/batman",
                    text: "my twitter"
                },
                {
                    link: "https://www.instagram.com/gothamonfox",
                    text: "my insta"
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
                name: "Blog avatar",
                image: "https://avatarfiles.alphacoders.com/186/186960.jpg"
            },
            coverPhoto: {
                name: "Cover photo",
                image:
                    "https://www.f-covers.com/cover/batman-looking-at-gotham-city-facebook-cover-timeline-banner-for-fb.jpg"
            },
            description:
                "The latest and hottest takes on the current happenings of the Gotham city",
            blogPosts: [
                {
                    id: 68,
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
    }
);

export { blogRouter };
