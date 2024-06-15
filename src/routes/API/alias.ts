import express from "express";
const aliasRouter = express.Router();
import { Alias } from "../../Entity/Alias";
import { Community } from "../../Entity/Community";
import { Tag } from "../../Entity/Tag";
import { auth, AuthRequest, setCurrentAlias } from "../../Authorization/auth";
import { AliasController, aliasCounts } from "../../Controller/AliasController";
import { Op } from "sequelize";
import { Image } from "../../Entity/Image";
import { User } from "../../Entity/User";
import { BlogController } from "../../Controller/BlogController";
import { Blog } from "../../Entity/Blog";
import { Follow } from "../../Entity/Follow";
import { ErrorReportService } from "../../services/ErrorReportService";
import { AuthService } from "../../services/AuthService";
import { BlogPost } from "../../Entity/BlogPost";
import { CommunityInvite } from "../../Entity/CommunityInvite";
import { Sequelize, FindOptions } from "sequelize";
import { Request, Response } from "express";
import { getDefaultImageLink } from "../../services/ImageService";
import { database as sequelize } from "../../services/databaseService.js";
import { StatusCodes } from "http-status-codes";

aliasRouter.post(
    "/",
    auth,
    async (req: AuthRequest, res): Promise<Response> =>
        sequelize
            .transaction(t => {
                if (req.user.AliasIds.length >= req.user.maxAllowedAliases) {
                    return Promise.reject(
                        "You are not allowed to create any more aliases"
                    );
                }
                return AliasController.createAlias(
                    req.body.name,
                    req.body.imageURL,
                    req.user,
                    req.body.avatar,
                    t
                ).then(alias =>
                    BlogController.createUniqueLink(
                        req.body.name,
                        undefined,
                        t
                    ).then((link: string) =>
                        BlogController.createBlog(
                            {
                                alias: alias.id,
                                name: req.body.name,
                                link,
                                links: [],
                                tags: [],
                                description:
                                    "Autocreated blog. Edit me, show your stuff!",
                                coverImage: { src: getDefaultImageLink() },
                                avatar: req.body.avatar.src.trim().length
                                    ? req.body.avatar
                                    : { src: getDefaultImageLink() },
                                hideFromSearchResults: false
                            },
                            t
                        ).then(() => res.send(alias))
                    )
                );
            })
            .catch(error => {
                console.error(error);
                return res.status(StatusCodes.BAD_REQUEST).send(error);
            })
);

aliasRouter.post(
    "/my/blog",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        sequelize
            .transaction(transaction => {
                // TODO this can be done better
                console.log("hi");
                const user: User = req.user;
                const aliasId = req.body.alias;
                return Blog.findOne({
                    where: { AliasId: aliasId },
                    include: [
                        {
                            model: BlogPost
                        }
                    ],
                    transaction
                }).then(blog => {
                    if (!blog) {
                        return Promise.reject("Blog not found.");
                    }
                    const promises: Promise<any>[] = [];
                    let userHasEditPermissions: boolean;
                    let fullBlog: Blog;
                    promises.push(
                        AuthService.userHasEditPermissionsForEntity(
                            blog,
                            user,
                            transaction
                        ).then(hasPermissions => {
                            userHasEditPermissions = hasPermissions;
                        })
                    );
                    promises.push(
                        BlogController.getBlog(
                            blog.id,
                            aliasId,
                            undefined,
                            transaction
                        ).then((fullBlogResult: Blog) => {
                            fullBlog = fullBlogResult;
                        })
                    );

                    return Promise.all(promises).then(() => {
                        if (false === userHasEditPermissions) {
                            return res
                                .status(StatusCodes.UNAUTHORIZED)
                                .send(
                                    ErrorReportService.getEnvError(
                                        "User has no permission to edit this",
                                        "blogEdit_noPermission"
                                    )
                                );
                        }
                        fullBlog.setDataValue(
                            "userHasEditPermissions",
                            userHasEditPermissions
                        );
                        return res.send(fullBlog);
                    });
                });
            })
            .catch(error => {
                console.log(error);
                res.status(StatusCodes.BAD_REQUEST).send(
                    ErrorReportService.getEnvError(
                        error,
                        "alias_blog_get_my_fail"
                    )
                );
            })
);

aliasRouter.get("/my", auth, (req: AuthRequest, res):
    | Response
    | Promise<Response> => {
    if (req.user.getDataValue("loggedInAsAnonymous")) {
        return res
            .status(StatusCodes.UNAUTHORIZED)
            .send("You are not logged in.");
    }

    return Alias.findAll({
        where: {
            UserId: req.user.id
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
                    }
                ]
            }
        ],
        attributes: {
            include: aliasCounts
        },
        order: ["id"],
        distinct: true // Avoid duplicate data returned
    } as FindOptions)
        .then(aliases => {
            if (aliases.length) {
                let responseObject = {
                    aliases,
                    canCreateNewAlias:
                        // @ts-ignore
                        req.user.maxAllowedAliases > aliases.length
                };
                return res.send(responseObject);
            } else {
                return Promise.reject("You have no aliases yet");
            }
        })
        .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e));
});

aliasRouter.get(
    "/my/invites",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        CommunityInvite.findAll({
            where: {
                invitedId: req.currentAlias
            },
            include: [
                {
                    model: Community,
                    include: [
                        {
                            model: Image,
                            as: "avatar"
                        }
                    ]
                },
                {
                    model: Alias,
                    attributes: ["id", "name", "avatarId"],
                    as: "inviter",
                    include: [
                        {
                            model: Blog
                        }
                    ]
                }
            ]
        })
            .then(invites => res.send(invites))
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e))
);

aliasRouter.get(
    "/:id",
    auth,
    (req: AuthRequest, res): Promise<Response> => {
        return Alias.findOne({
            where: {
                id: req.params.id
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
                }
            ],
            attributes: {
                include: [
                    [
                        Sequelize.literal(
                            `(SELECT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${req.currentAlias} AND "Follows"."followAliasId"="Alias"."id"))`
                        ),
                        "aliasFollowing"
                    ]
                ],
                exclude: ["UserId", "isMinor", "showMinors"]
            }
        })
            .then(alias =>
                alias
                    ? res.send(alias)
                    : Promise.reject("No alias with that ID")
            )
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e));
    }
);

aliasRouter.get(
    "/:id/following",
    auth,
    (req: AuthRequest, res): Promise<Response> => {
        return Alias.findOne({
            where: {
                id: req.params.id
            },
            attributes: ["id", "name", "avatarId"],
            include: [
                {
                    model: Alias,
                    attributes: ["id", "name", "avatarId"],
                    as: "followAlias",
                    through: {
                        where: {
                            followType: Follow.FOLLOW_TYPES.follow
                        }
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
                        }
                    ]
                },
                {
                    model: Blog,
                    as: "followBlog",
                    through: {
                        where: {
                            followType: Follow.FOLLOW_TYPES.follow
                        }
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
                },
                {
                    model: Community,
                    as: "followCommunity",
                    through: {
                        where: {
                            followType: Follow.FOLLOW_TYPES.follow
                        }
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
                },
                {
                    model: Tag,
                    as: "followTag",
                    through: {
                        where: {
                            followType: Follow.FOLLOW_TYPES.follow
                        }
                    }
                }
            ]
        })
            .then(alias =>
                alias
                    ? res.send(alias)
                    : Promise.reject("No alias with that ID")
            )
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e));
    }
);

aliasRouter.get(
    "/:id/following/count",
    auth,
    (req: AuthRequest, res: Response): Promise<Response> => {
        return Follow.count({
            where: {
                AliasId: req.params.id,
                followType: Follow.FOLLOW_TYPES.follow
            }
        })
            .then((count: number) => res.send({ count }))
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e));
    }
);

aliasRouter.get(
    "/:id/blocking",
    auth,
    (req: AuthRequest, res): Promise<Response> => {
        return Alias.findOne({
            where: {
                id: req.params.id
            },
            attributes: ["id", "name", "avatarId"],
            include: [
                {
                    model: Alias,
                    attributes: ["id", "name", "avatarId"],
                    as: "followAlias",
                    through: {
                        where: {
                            followType: Follow.FOLLOW_TYPES.block
                        }
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
                        }
                    ]
                },
                {
                    model: Blog,
                    as: "followBlog",
                    through: {
                        where: {
                            followType: Follow.FOLLOW_TYPES.block
                        }
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
                },
                {
                    model: Community,
                    as: "followCommunity",
                    through: {
                        where: {
                            followType: Follow.FOLLOW_TYPES.block
                        }
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
                },
                {
                    model: Tag,
                    as: "followTag",
                    through: {
                        where: {
                            followType: Follow.FOLLOW_TYPES.block
                        }
                    }
                }
            ]
        })
            .then(alias =>
                alias
                    ? res.send(alias)
                    : Promise.reject("No alias with that ID")
            )
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e));
    }
);

aliasRouter.get(
    "/:id/followedBy",
    auth,
    (req: AuthRequest, res: Response): Promise<Response> => {
        return Alias.findOne({
            where: {
                id: req.params.id
            },
            attributes: ["id", "name", "avatarId"],
            include: [
                {
                    model: Alias,
                    as: "followedBy",
                    attributes: ["id", "name", "avatarId"]
                }
            ]
        })
            .then(alias =>
                alias
                    ? res.send(alias)
                    : Promise.reject("No alias with that ID")
            )
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e));
    }
);

aliasRouter.post(
    "/findLike",
    auth,
    (req: AuthRequest, res: Response): Promise<Response> => {
        let context = req.body.context ? req.body.context : { context: "" };
        let aliasId = req.currentAlias;
        let userAliasIds = req.user.AliasIds;
        let userAliasIdsSQLArray = "(" + userAliasIds.join(",") + ")";
        return Alias.findAll({
            where: {
                name: {
                    [Op.iLike]:
                        "%" +
                        req.body.aliasPart
                            .replace("\\", "\\\\")
                            .replace("%", "\\%")
                            .replace("_", "\\_") +
                        "%"
                },
                [Op.and]: [
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

                    // alias part of community being searched for
                    ...(context.context === "community"
                        ? [
                              Sequelize.literal(`EXISTS (
                            SELECT 1 FROM "community_members"
                                WHERE "community_members"."CommunityId"=${context.id}
                                AND "community_members"."AliasId"=${aliasId})`)
                          ]
                        : []),
                    // exclude those already a member if trying to find aliases to invite to community
                    ...(context.context === "community"
                        ? [
                              Sequelize.literal(`NOT EXISTS (
                            SELECT 1 FROM "community_members"
                                WHERE "community_members"."CommunityId"=${context.id}
                                AND "community_members"."AliasId"="Alias"."id")`)
                          ]
                        : [])
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
                }
            ],
            limit: 10
        })
            .then(aliases => res.send(aliases))
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e));
    }
);

aliasRouter.post("/findLike/mock", async (req: Request, res: Response) => {
    try {
        const aliasPart = req.body.aliasPart;
        if (!aliasPart) {
            res.status(StatusCodes.BAD_REQUEST).send("bad data");
        }

        const responseObject = {
            aliases: [
                {
                    name: aliasPart + "boy",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                    id: 111
                },
                {
                    name: aliasPart + "girl",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                    id: 222
                },
                {
                    name: aliasPart + "they",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                    id: 222
                },
                {
                    name: "xXx_" + aliasPart + "SlayerxXx",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                    id: 333
                }
            ]
        };
        res.send(responseObject);
    } catch (error) {
        res.status(StatusCodes.BAD_REQUEST).send(error);
    }
});

aliasRouter.patch(
    "/set/:id",
    auth,
    (req: AuthRequest, res): Response => {
        try {
            if (req.user.AliasIds.includes(Number(req.params.id))) {
                setCurrentAlias(req, res, Number(req.params.id));
                return res.send(`Set alias to ${req.params.id}`);
            } else {
                return res
                    .status(StatusCodes.NOT_FOUND)
                    .send("You do not have that alias.");
            }
        } catch (e) {
            return res.status(StatusCodes.BAD_REQUEST).send(e);
        }
    }
);

export { aliasRouter };
