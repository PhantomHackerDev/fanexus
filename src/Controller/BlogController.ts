import { Blog } from "../Entity/Blog";
import { Image } from "../Entity/Image";
import { BlogInterface, UpdateBlogInterface } from "../Interface/BlogInterface";
import { AccessControlGroupInterface } from "../Interface/AccessControlGroupInterface";
import { ImageController } from "./ImageController";
import { AccessControlGroupController } from "./AccessControlGroupController";
import { Alias } from "../Entity/Alias";
import { User } from "../Entity/User";
import { AccessControlGroup } from "../Entity/AccessControlGroup";
import { Tag } from "../Entity/Tag";
import { BlogPost } from "../Entity/BlogPost";
import { Sequelize, Op, ProjectionAlias, OrderItem } from "sequelize";
import { database as sequelize } from "../services/databaseService.js";
import { tagFunctions } from "./shared/TagFunctions";
import { Follow } from "../Entity/Follow";
import { Transaction } from "sequelize";
import { TagDisplayInterface } from "../Interface/TagDisplayInterface";

class BlogController {
    public createBlog(
        blogParams: BlogInterface,
        transaction: Transaction
    ): Promise<Blog> {
        if (typeof blogParams.alias === "undefined") {
            return Promise.reject("Blog must have an alias");
        }
        const alias = blogParams.alias;
        return Blog.create(
            {
                name: blogParams.name,
                link: blogParams.link,
                links: blogParams.links,
                description: blogParams.description,
                hideFromSeachResults: blogParams.hideFromSearchResults
            },
            { transaction }
        )
            .then((blog: Blog) => {
                return blog;
            })
            .then((blog: Blog) => {
                const promises: Promise<any>[] = [];

                if (typeof alias !== "undefined") {
                    promises.push(blog.setAlias(alias, { transaction }));
                }

                if (blogParams.avatar instanceof Image) {
                    promises.push(
                        blog.setAvatar(blogParams.avatar, { transaction })
                    );
                } else if (typeof blogParams.avatar !== "undefined") {
                    promises.push(
                        ImageController.createImage(
                            blogParams.avatar,
                            undefined,
                            transaction
                        ).then(async avatar => {
                            blog.setAvatar(avatar, { transaction });
                        })
                    );
                }
                if (blogParams.coverImage instanceof Image) {
                    promises.push(
                        blog.setCoverImage(blogParams.coverImage, {
                            transaction
                        })
                    );
                } else if (typeof blogParams.coverImage !== "undefined") {
                    promises.push(
                        ImageController.createImage(
                            blogParams.coverImage,
                            undefined,
                            transaction
                        ).then(async coverImage => {
                            blog.setCoverImage(coverImage, { transaction });
                        })
                    );
                }

                promises.push(
                    AccessControlGroupController.createAccessControlGroup(
                        {
                            accessControlSetting: "full",
                            isDefault: true,
                            belongsToAlias: alias,
                            name: "Open book"
                        },
                        alias,
                        transaction
                    ).then(defaultAcg => {
                        return Promise.all([
                            blog.setReactionsAccessControl(defaultAcg, {
                                transaction
                            }),
                            blog.setFollowsAccessControl(defaultAcg, {
                                transaction
                            }),
                            blog.setCommentsAccessControl(defaultAcg, {
                                transaction
                            }),
                            blog.setContentAccessControl(defaultAcg, {
                                transaction
                            })
                        ]);
                    })
                );

                return Promise.all(promises).then(
                    (): Promise<Blog> => {
                        return blog.save({ transaction });
                    }
                );
            });
    }

    public updateBlog(
        blogParameters: UpdateBlogInterface,
        transaction: Transaction
    ): Promise<Blog> {
        const accessControlGroupNames: (keyof UpdateBlogInterface)[] = [
            "contentAccessControl",
            "commentsAccessControl",
            "reactionsAccessControl",
            "followsAccessControl"
        ];
        return Promise.all([
            Promise.all([
                ...(blogParameters.avatar
                    ? [
                          ImageController.createImage(
                              blogParameters.avatar,
                              undefined,
                              transaction
                          )
                      ]
                    : []),
                ...(blogParameters.coverImage
                    ? [
                          ImageController.createImage(
                              blogParameters.coverImage,
                              undefined,
                              transaction
                          )
                      ]
                    : [])
            ]),
            Blog.findOne({
                include: [
                    {
                        model: Alias,
                        attributes: ["id", "name", "avatarId"],
                        required: true,
                        include: [
                            {
                                model: User,
                                required: true,
                                include: [
                                    {
                                        model: Alias,
                                        where: {
                                            id: blogParameters.alias
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                ],
                where: {
                    id: blogParameters.blogId
                },
                transaction
            }).then(blog => {
                if (!blog) {
                    return Promise.reject(
                        "Blog does not exist or does not belong to alias"
                    );
                }
                return Promise.all([
                    blog.update(
                        (({
                            name,
                            link,
                            links,
                            description,
                            hideFromSearchResults
                        }) => ({
                            name,
                            link: link || null,
                            links,
                            description,
                            hideFromSearchResults
                        }))(blogParameters),
                        { transaction }
                    ),
                    ...accessControlGroupNames.map(accessControlParam =>
                        AccessControlGroup.update(
                            {
                                accessControlSetting:
                                    AccessControlGroup.ACCESS_CONTROL_SETTINGS[
                                        (blogParameters[
                                            accessControlParam
                                        ] as AccessControlGroupInterface)
                                            .accessControlSetting as keyof typeof AccessControlGroup.ACCESS_CONTROL_SETTINGS
                                    ]
                            },
                            {
                                where: {
                                    id:
                                        blog[
                                            `${accessControlParam}Id` as keyof Blog
                                        ]
                                },
                                transaction
                            }
                        )
                    ),
                    ...(blogParameters.tagNames
                        ? [
                              this.setTags(
                                  blog,
                                  blogParameters.tagNames,
                                  transaction
                              )
                          ]
                        : []),
                    ...(blogParameters.tagDisplays
                        ? [
                              blog.setTagsWithDisplayNames(
                                  blogParameters.tagDisplays,
                                  transaction
                              )
                          ]
                        : [])
                ] as Promise<any>[]);
            })
        ]).then(([createdImages, [blog]]) => {
            console.log(createdImages);
            const newCoverImage =
                blogParameters.coverImage && createdImages.pop();
            const newAvatar = blogParameters.avatar && createdImages.pop();
            let aliasAvatarPromises: Promise<any>[] = [];
            const createAliasImage: Promise<Image | undefined> = newAvatar
                ? ImageController.createImage(newAvatar, "alias", transaction)
                : Promise.resolve(undefined);
            aliasAvatarPromises.push(
                createAliasImage.then(createdAliasAvatar => {
                    return Alias.update(
                        {
                            avatarId:
                                createdAliasAvatar && createdAliasAvatar.id,
                            name: blogParameters.name,
                            showMinors: blogParameters.showMinors
                        },
                        {
                            where: {
                                id: blog.AliasId
                            },
                            transaction
                        }
                    );
                })
            );
            return Promise.all([
                blog.update(
                    {
                        avatarId: newAvatar && newAvatar.id,
                        coverImageId: newCoverImage && newCoverImage.id
                    },
                    { transaction }
                ),
                aliasAvatarPromises
            ]).then(() => blog);
        });
    }

    public getBlog(
        blogIdentifier: number | string,
        currentAlias: number,
        id = false,
        transaction: Transaction
    ): Promise<Blog> {
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
            id ? "DESC" : "ASC"
        ];
        return Blog.findOne({
            where: whereIdentifierCondition,
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
                        }
                    ]
                },
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
                    model: BlogPost
                    // include: [{all:true}]
                }
            ],
            attributes: {
                include: [
                    [
                        Sequelize.literal(
                            `(SELECT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${currentAlias} AND "Follows"."followBlogId"="Blog"."id" AND "Follows"."followType" = ${Follow.FOLLOW_TYPES.follow}))`
                        ),
                        "aliasFollowing"
                    ],
                    [
                        Sequelize.literal(
                            `(SELECT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${currentAlias} AND "Follows"."followBlogId"="Blog"."id" AND "Follows"."followType" = ${Follow.FOLLOW_TYPES.block}))`
                        ),
                        "aliasBlocking"
                    ],
                    ...(isNumber ? [matchIdAttribute] : [])
                ]
            },
            order: [...(isNumber ? [orderItem] : [])],
            transaction
        }).then(
            (blog: Blog): Blog => {
                if (blog) {
                    blog.sanitizeContents();
                }
                return blog;
            }
        );
    }

    public findBlog(blogIdentifier: string): Promise<Blog[]> {
        const findBlogString = blogIdentifier
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_");
        const iLikeMatch = `%${findBlogString}%`;
        return Blog.findAll({
            where: {
                [Op.or]: [
                    ...(!isNaN(Number(blogIdentifier))
                        ? [
                              {
                                  id: Number(blogIdentifier)
                              }
                          ]
                        : []),
                    {
                        name: {
                            [Op.iLike]: iLikeMatch
                        }
                    },
                    {
                        link: {
                            [Op.iLike]: iLikeMatch
                        }
                    },
                    {
                        description: {
                            [Op.iLike]: iLikeMatch
                        }
                    }
                ]
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
        });
    }

    public createUniqueLink(
        link: string,
        numberSuffix: number | undefined,
        transaction: Transaction
    ): Promise<string> {
        const resultLink = `${link}${numberSuffix ? numberSuffix : ""}`;
        return Blog.count({
            where: {
                link: resultLink
            },
            transaction
        }).then(count => {
            if (count) {
                return this.createUniqueLink(
                    link,
                    numberSuffix ? ++numberSuffix : 1,
                    transaction
                );
            } else {
                return resultLink;
            }
        });
    }

    public addTags(
        blog: Blog,
        tagParams: (number | Tag)[],
        transaction: Transaction
    ): Promise<void> {
        return tagFunctions.addTags(blog, tagParams, transaction);
    }

    public removeTags(
        blog: Blog,
        tagParams: number[] | Tag[],
        transaction: Transaction
    ): Promise<void> {
        return tagFunctions.removeTags(blog, tagParams, transaction);
    }

    // deprecated
    public setTags(
        blog: Blog,
        tagNames: string[],
        transaction: Transaction
    ): Promise<void> {
        return Promise.all(
            tagNames.map((tagName: string) =>
                Tag.findOrCreateWithNeo4j(tagName, transaction)
            )
        ).then((tags: Tag[]) => blog.setTagsWithNeo4j(tags, transaction));
    }

    // deprecated
    public setTagsWithDisplaysWithNeo4j(
        blog: Blog,
        tags: TagDisplayInterface[],
        transaction: Transaction
    ): Promise<void> {
        return blog.setTagsWithNeo4j(tags, transaction);
    }
}
const controller = new BlogController();
export { controller as BlogController };
