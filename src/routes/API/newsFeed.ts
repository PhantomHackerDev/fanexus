import express from "express";
import { BlogPost, orders } from "../../Entity/BlogPost";
import { ErrorReportService } from "../../services/ErrorReportService";
import { Blog } from "../../Entity/Blog";
import { Community } from "../../Entity/Community";
import { Image } from "../../Entity/Image";
import { Tag } from "../../Entity/Tag";
import { Response } from "express";
import { auth, AuthRequest } from "../../Authorization/auth";
import { Sequelize } from "sequelize";
import { Op } from "sequelize";
import { FollowController } from "../../Controller/FollowController";
import { database as sequelize } from "../../services/databaseService.js";
const newsFeedRouter = express.Router();

function getRandomInt(): number {
    return Math.floor(Math.random() * Math.floor(Number.MAX_SAFE_INTEGER));
}

const first = 1;
const second = 2;
const third = 3;
const defaultFollowedTagIds = [first, second, third];

newsFeedRouter.get(
    "/:order(liked|commented|reblogged|id|undefined)?/:noReblogs(no-reblogs)?/:page",
    auth,
    async (req: AuthRequest, res): Promise<Response> =>
        sequelize
            .transaction(transaction => {
                const currentAlias = req.currentAlias;
                const gettingAsUser = req.user;
                const UserId = Number(req.user.id);
                let order = req.params.order as undefined | keyof typeof orders;
                const page: number = req.params.page
                    ? Number(req.params.page)
                    : 1;
                let followedTagIds: number[] = [0];
                let blockedTagIds: number[] = [0];
                // DEFAULT FOLLOWED TAGS FOR USERS THAT ARENT LOGGED IN
                if (currentAlias === 0) {
                    followedTagIds = defaultFollowedTagIds;
                }

                return FollowController.getRelevantTagIdsForAlias(
                    currentAlias,
                    req.user.isMinor,
                    transaction
                ).then(relevantTagsResult => {
                    followedTagIds = followedTagIds.concat(
                        relevantTagsResult.follows
                    );
                    blockedTagIds = blockedTagIds.concat(
                        relevantTagsResult.blocks
                    );
                    let followTagIdsSQLArray = followedTagIds
                        ? "(" + followedTagIds.join(",") + ")"
                        : "(NULL)";
                    let blockedTagIdsSQLArray = blockedTagIds
                        ? "(" + blockedTagIds.join(",") + ")"
                        : "(NULL)";
                    const promises: Promise<any>[] = [
                        Blog.findAll({
                            limit: 5,
                            where: {
                                [Op.and]: [
                                    Sequelize.literal(
                                        `(SELECT NOT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${currentAlias} AND "Follows"."followBlogId"="Blog"."id"))`
                                    ),
                                    // viewer alias blocked blog
                                    Sequelize.literal(
                                        `NOT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${Number(
                                            currentAlias
                                        )} AND "Follows"."followBlogId"="Blog"."id" AND "Follows"."followType" = 0)`
                                    ),
                                    // viewer alias blocked blog author
                                    Sequelize.literal(
                                        `NOT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${Number(
                                            currentAlias
                                        )} AND "Follows"."followAliasId"="Blog"."AliasId" AND "Follows"."followType" = 0)`
                                    ),
                                    // blog author blocked viewer alias
                                    Sequelize.literal(
                                        `NOT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"="Blog"."AliasId" AND "Follows"."followAliasId"=${Number(
                                            currentAlias
                                        )} AND "Follows"."followType" = 0)`
                                    ),
                                    // blogpost author is minor and viewer is blocking minors
                                    Sequelize.literal(
                                        `NOT EXISTS (SELECT 1 FROM "Aliases" AS "AuthorAlias" JOIN "Aliases" AS "ViewerAlias" ON "ViewerAlias"."id"=${Number(
                                            currentAlias
                                        )} WHERE "AuthorAlias"."id"="Blog"."AliasId" AND "AuthorAlias"."isMinor"=TRUE AND "ViewerAlias"."showMinors"=FALSE)`
                                    ),
                                    // viewer alias blocked tag or its descendants which is on blog
                                    Sequelize.literal(
                                        `NOT EXISTS( SELECT 1 FROM "Blog_Tag" WHERE "Blog_Tag"."TagId" IN ${blockedTagIdsSQLArray} AND "Blog_Tag"."BlogId" = "Blog"."id")`
                                    ),
                                    // viewer alias following at least one tag on blog
                                    Sequelize.literal(
                                        `EXISTS( SELECT 1 FROM "Blog_Tag" WHERE "Blog_Tag"."TagId" IN ${followTagIdsSQLArray} AND "Blog_Tag"."BlogId" = "Blog"."id")`
                                    ),
                                    // Exclude those hidden from search results in newsfeed and search by tag
                                    Sequelize.literal(
                                        '"Blog"."hideFromSearchResults" = FALSE'
                                    )
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
                                    where: {
                                        id: { [Op.in]: followedTagIds }
                                    },
                                    // weird flex but supposedly this is the kosher way of not including the join table
                                    through: { attributes: [] }
                                }
                            ],
                            attributes: {
                                include: [
                                    [
                                        Sequelize.literal(
                                            `(SELECT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${currentAlias} AND "Follows"."followBlogId"="Blog"."id"))`
                                        ),
                                        "aliasFollowing"
                                    ]
                                ]
                            },
                            transaction
                        }).then(blogResults =>
                            blogResults.map(blogResult => ({
                                ...blogResult.toJSON(),
                                type: "blog"
                            }))
                        ),
                        Community.findAll({
                            limit: 5,
                            where: {
                                [Op.and]: [
                                    // dont suggest if already a member, as in, following either by blocking or following
                                    Sequelize.literal(
                                        `(SELECT NOT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${currentAlias} AND "Follows"."followCommunityId"="Community"."id"))`
                                    ),
                                    // dont show if viewer alias blocked tag or its descendants which is on community
                                    Sequelize.literal(
                                        `NOT EXISTS( SELECT 1 FROM "Community_Tag" WHERE "Community_Tag"."TagId" IN ${blockedTagIdsSQLArray} AND "Community_Tag"."CommunityId" = "Community"."id")`
                                    ),
                                    // viewer alias following at least one tag on community
                                    Sequelize.literal(
                                        `EXISTS( SELECT 1 FROM "Community_Tag" WHERE "Community_Tag"."TagId" IN ${followTagIdsSQLArray} AND "Community_Tag"."CommunityId" = "Community"."id")`
                                    )
                                ],
                                hideFromSearchResults: false,
                                ...(gettingAsUser
                                    ? gettingAsUser.isMinor
                                        ? { showMinors: true }
                                        : {}
                                    : {})
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
                                },
                                {
                                    model: Tag,
                                    attributes: ["id", "name", "style"],
                                    where: {
                                        id: { [Op.in]: followedTagIds }
                                    },
                                    // weird flex but supposedly this is the kosher way of not including the join table
                                    through: { attributes: [] }
                                }
                            ],
                            attributes: {
                                include: [
                                    [
                                        Sequelize.literal(
                                            `(SELECT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${currentAlias} AND "Follows"."followCommunityId"="Community"."id"))`
                                        ),
                                        "aliasFollowing"
                                    ],
                                    [
                                        Sequelize.literal(
                                            `(SELECT EXISTS (SELECT 1 FROM "community_members" WHERE "community_members"."AliasId"=${currentAlias} AND "community_members"."CommunityId"="Community"."id"))`
                                        ),
                                        "aliasIsMember"
                                    ]
                                ]
                            },
                            transaction
                        }).then(communityResults =>
                            communityResults.map(communityResult => ({
                                ...communityResult.toJSON(),
                                type: "community"
                            }))
                        ),
                        BlogPost.getBlogPosts(
                            {
                                UserId,
                                gettingAsUser,
                                AliasId: currentAlias,
                                userFeed: true,
                                order,
                                page,
                                followedTagIds,
                                blockedTagIds,
                                excludeEmptyReblogs: !!req.params.noReblogs
                            },
                            transaction
                        )
                    ];

                    return Promise.all(promises).then(
                        ([blogs, communities, { BlogPosts, count }]) =>
                            res.send({
                                currentAlias,
                                suggestions: blogs.concat(communities),
                                BlogPosts,
                                count
                            })
                    );
                });
            })
            .catch(e => {
                console.log(e);
                return res.send(
                    ErrorReportService.getEnvError(e, "newsfeed_fetch_fail")
                );
            })
);
newsFeedRouter.get("/:page/mock", async (req, res) => {
    // mock

    const responseObject = {
        page: req.params.page,
        blogPosts: [
            {
                id: getRandomInt(),
                origin: {
                    type: "blog",
                    id: getRandomInt(),
                    name: "The batcave daily",
                    link: "/blog/thebatcavedaily"
                },
                alias: {
                    name: "blog name",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                    id: getRandomInt()
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
                        id: getRandomInt(),
                        name: "batman",
                        style: "background-color: black; font-weight:bold" // Tags should ideally be styled by the tagmaker but this is a security risk
                    },
                    {
                        id: getRandomInt(),
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
                commentsPreview: [
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    },
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    },
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    }
                ]
            },
            {
                id: 1,
                origin: {
                    type: "blog",
                    id: 90,
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
                        id: getRandomInt(),
                        name: "batman",
                        style: "background-color: black; font-weight:bold" // Tags should ideally be styled by the tagmaker but this is a security risk
                    },
                    {
                        id: getRandomInt(),
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
                commentsPreview: [
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    },
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    },
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    }
                ]
            },
            {
                id: 1,
                origin: {
                    type: "blog",
                    id: 90,
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
                        id: getRandomInt(),
                        name: "batman",
                        style: "background-color: black; font-weight:bold" // Tags should ideally be styled by the tagmaker but this is a security risk
                    },
                    {
                        id: getRandomInt(),
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
                commentsPreview: [
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    },
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    },
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    }
                ]
            },
            {
                id: getRandomInt(),
                origin: {
                    type: "community",
                    name: "Gotham caffee",
                    id: 93,
                    link: "/community/gothamcaffee"
                },
                alias: {
                    name: "Batman lover",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                    id: getRandomInt()
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
                        id: getRandomInt(),
                        name: "batman",
                        style: "background-color: black; font-weight:bold" // Tags should ideally be styled by the tagmaker but this is a security risk
                    },
                    {
                        id: getRandomInt(),
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
                commentsPreview: [
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    },
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    },
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    }
                ]
            },
            {
                id: getRandomInt(),
                origin: {
                    type: "blog",
                    id: 94,
                    name: "DankDungeon",
                    link: "/blog/DankDungeon"
                },
                alias: {
                    name: "50shadesOfWayne",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                    id: 1003
                },
                content:
                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum",
                image: null,
                gallery: [],
                tags: [
                    {
                        id: getRandomInt(),
                        name: "batman",
                        style: "background-color: black; font-weight:bold" // Tags should ideally be styled by the tagmaker but this is a security risk
                    },
                    {
                        id: getRandomInt(),
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
                commentsPreview: [
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    },
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    },
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    }
                ]
            },
            {
                id: getRandomInt(),
                origin: {
                    type: "blog",
                    id: 94,
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
                        id: getRandomInt(),
                        name: "batman",
                        style: "background-color: black; font-weight:bold" // Tags should ideally be styled by the tagmaker but this is a security risk
                    },
                    {
                        id: getRandomInt(),
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
                commentsPreview: [
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    },
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    },
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    }
                ]
            },
            {
                id: getRandomInt(),
                origin: {
                    type: "community",
                    id: 95,
                    name: "Gotham caffee",
                    link: "/community/gothamcaffee"
                },
                alias: {
                    name: "Batman lover",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                    id: getRandomInt()
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
                        id: getRandomInt(),
                        name: "batman",
                        style: "background-color: black; font-weight:bold" // Tags should ideally be styled by the tagmaker but this is a security risk
                    },
                    {
                        id: getRandomInt(),
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
                commentsPreview: [
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    },
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    },
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    }
                ]
            },
            {
                id: getRandomInt(),
                origin: {
                    type: "blog",
                    id: getRandomInt(),
                    name: "DankDungeon",
                    link: "/blog/DankDungeon"
                },
                alias: {
                    name: "50shadesOfWayne",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                    id: 1003
                },
                content:
                    "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum",
                image: null,
                gallery: [],
                tags: [
                    {
                        id: getRandomInt(),
                        name: "batman",
                        style: "background-color: black; font-weight:bold" // Tags should ideally be styled by the tagmaker but this is a security risk
                    },
                    {
                        id: getRandomInt(),
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
                commentsPreview: [
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    },
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    },
                    {
                        id: getRandomInt(),
                        content:
                            "Lorem Ipsum is simply dummy text of the printing and typesetting industry.<img src = 'https://i.pinimg.com/originals/2b/52/7d/2b527dfbe670cd5a746425eb30e2740d.jpg'><br> Lorem Ipsum",
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: getRandomInt()
                        }
                    }
                ]
            }
        ],
        suggestions: [
            {
                type: "blog",
                id: getRandomInt(),
                avatar: {
                    name: "Some blogname",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png"
                },
                description:
                    "Lorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsum"
            },
            {
                type: "community",
                id: getRandomInt(),
                avatar: {
                    name: "some community name",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png"
                },
                description:
                    "Lorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsum"
            },
            {
                type: "blog",
                id: getRandomInt(),
                avatar: {
                    name: "Some blogname",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png"
                },
                description:
                    "Lorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsum"
            },
            {
                type: "community",
                id: getRandomInt(),
                avatar: {
                    name: "some community name",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png"
                },
                description:
                    "Lorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsum"
            },
            {
                type: "blog",
                id: getRandomInt(),
                avatar: {
                    name: "Some blogname",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png"
                },
                description:
                    "Lorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsum"
            },
            {
                type: "community",
                id: getRandomInt(),
                avatar: {
                    name: "some community name",
                    image:
                        "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png"
                },
                description:
                    "Lorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsumLorem ipsummmm"
            }
        ]
    };
    res.send(responseObject);
});

export { newsFeedRouter };
