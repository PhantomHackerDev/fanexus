import { Follow } from "@entities/Follow.js";
import {
    FindAndCountOptions,
    Op,
    ProjectionAlias,
    Sequelize,
    Transaction
} from "sequelize";
import { AccessControlGroup } from "../Entity/AccessControlGroup";
import { Alias } from "../Entity/Alias";
import { Blog } from "../Entity/Blog";
import { BlogPost } from "../Entity/BlogPost";
import { Comment } from "../Entity/Comment";
import { Community } from "../Entity/Community";
import { Image } from "../Entity/Image";
import { Reaction } from "../Entity/Reaction";
import { sanitizeContents } from "../Entity/shared/sanitizeHTML";
import { tagFunctions } from "../Entity/shared/TagFunctions";
import { Tag } from "../Entity/Tag";
import { User } from "../Entity/User";
import { database as sequelize } from "./databaseService.js";

interface BlogPostConditionsInterface {
    UserId: number;
    AliasId: number;
    gettingAsUser: User;
    BlogId?: number;
    blogPostId?: number;
    CommunityId?: number;
    likedById?: string;
    tagNames?: string[];
    userFeed?: boolean;
    excludeEmptyReblogs?: boolean;
    order?: keyof typeof orders;
    orderDirection?: string;
    page?: number;
    isSearch?: boolean;
}

export interface GetBlogPostsInterface extends BlogPostConditionsInterface {
    followedTagIds?: number[];
    blockedTagIds?: number[];
    searchedTagsIdArrays?: number[][];
}

export interface FindAndCountBlogPostsInterface
    extends BlogPostConditionsInterface {
    searchedIdsSQLArrays?: string[];
    followTagIdsSQLArray?: string;
    blockedTagIdsSQLArray?: string;
    offset: number;
    includedCommunityIds: number[];
    inaccessibleCommunityIds: number[];
    includedBlogIds: number[];
    inaccessibleBlogIds: number[];
    inaccessibleAliasIds: number[];
    allWhitelists: number[];
    whitelistGroupIds: number[];
    blacklistGroupIds: number[];
}

const limit = 8;

const commentAttributes = (UserId: number, AliasId: number) => {
    const commentUserHasEditPermissions = (
        referenceName: string
    ): ProjectionAlias[] =>
        UserId
            ? [
                  [
                      Sequelize.literal(
                          `EXISTS (SELECT 1 FROM "Aliases" WHERE "Aliases"."UserId"=${Number(
                              UserId
                          )} AND "Aliases"."id"="${referenceName}"."AliasId")`
                      ),
                      "userHasEditPermissions"
                  ]
              ]
            : [];
    const commentUserLiked = (referenceName: string): ProjectionAlias[] =>
        AliasId
            ? [
                  [
                      Sequelize.literal(
                          `EXISTS (SELECT 1 FROM "Reactions" WHERE "Reactions"."type"=${
                              Reaction.REACTION_TYPE.like
                          } AND "Reactions"."AliasId"=${Number(
                              AliasId
                          )} AND "Reactions"."CommentId"="${referenceName}"."id")`
                      ),
                      "userLiked"
                  ]
              ]
            : [];
    const commentComments = (referenceName: string): ProjectionAlias[] => [
        [
            Sequelize.literal(
                `(SELECT COUNT("CommentComment"."id") FROM "Comments" AS "CommentComment" WHERE "CommentComment"."parentCommentId"="${referenceName}"."id")`
            ),
            "numComments"
        ]
    ];
    const commentLikes = (referenceName: string): ProjectionAlias[] => [
        [
            Sequelize.literal(
                `(SELECT COUNT ("Reactions"."id") FROM "Reactions" WHERE "Reactions"."type"=${Reaction.REACTION_TYPE.like} AND "Reactions"."CommentId"="${referenceName}"."id")`
            ),
            "numLikes"
        ]
    ];
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

    const commentIncludeAttributes = (referenceName: string) => [
        ...commentUserHasEditPermissions(referenceName),
        ...commentUserLiked(referenceName),
        ...commentComments(referenceName),
        ...commentLikes(referenceName)
    ];

    const lastCommentIncludeAttributes = (referenceName: string) => [
        ...commentIncludeAttributes(referenceName),
        ...commentHasChildComments(referenceName)
    ];

    return {
        commentIncludeAttributes,
        lastCommentIncludeAttributes
    };
};

const commentAliasInclude = () => ({
    model: Alias,
    attributes: ["id", "name", "avatarId"],
    include: [
        {
            model: Image,
            as: "avatar",
            attributes: ["id", "src", "name", "alt", "identifier", "context"]
        },
        {
            model: Blog,
            attributes: ["id", "link"]
        }
    ]
});

const commentAccessConditionsForAlias = (AliasId: number) => (
    referenceName: string
) => [
    // Any of current user's aliases not blocking any blog belonging to the comment's alias
    Sequelize.literal(`NOT EXISTS (
                            SELECT 1 FROM "Aliases" AS "currentAlias"
                            INNER JOIN "Aliases" AS "currentAliases"
                                ON "currentAlias"."UserId"="currentAliases"."UserId"
                            INNER JOIN "Follows"
                                ON "currentAliases"."id"="Follows"."AliasId"
                            INNER JOIN "Blogs" AS "commenterBlogs"
                                ON "Follows"."followBlogId"="commenterBlogs"."id"
                            INNER JOIN "Aliases" AS "commenterAliases"
                                ON "commenterAliases"."id"="commenterBlogs"."AliasId"
                            INNER JOIN "Aliases" AS "commenterAlias"
                                ON "commenterAlias"."UserId"="commenterAliases"."UserId"
                            WHERE "currentAlias"."id"=${Number(AliasId)}
                                AND "commenterAlias"."id"="${referenceName}"."AliasId"
                                AND "Follows"."followType" = 0)`),
    // Any of comment author's aliases not blocking any blog belonging to an alias of the current user
    Sequelize.literal(`NOT EXISTS (
                            SELECT 1 FROM "Aliases" AS "commenterAlias"
                            INNER JOIN "Aliases" AS "commenterAliases"
                                ON "commenterAlias"."UserId"="commenterAliases"."UserId"
                            INNER JOIN "Follows"
                                ON "commenterAliases"."id"="Follows"."AliasId"
                            INNER JOIN "Blogs" AS "currentBlogs"
                                ON "Follows"."followBlogId"="currentBlogs"."id"
                            INNER JOIN "Aliases" AS "currentAliases"
                                ON "currentBlogs"."AliasId"="currentAliases"."id"
                            INNER JOIN "Aliases" AS "currentAlias"
                                ON "currentAlias"."UserId"="currentAliases"."UserId"
                            WHERE "currentAlias"."id"=${Number(AliasId)}
                                AND "commenterAlias"."id"="${referenceName}"."AliasId"
                                AND "Follows"."followType" = 0)`),
    // viewer alias is minor and comment author is blocking minors
    Sequelize.literal(
        `NOT EXISTS (SELECT 1 FROM "Aliases" AS "AuthorAlias" JOIN "Aliases" AS "ViewerAlias" ON "ViewerAlias"."id"=${Number(
            AliasId
        )} WHERE "AuthorAlias"."id"="${referenceName}"."AliasId" AND "AuthorAlias"."showMinors"=FALSE AND "ViewerAlias"."isMinor" = TRUE)`
    ),
    // blogpost author is minor and viewer is blocking minors
    Sequelize.literal(
        `NOT EXISTS (SELECT 1 FROM "Aliases" AS "AuthorAlias" JOIN "Aliases" AS "ViewerAlias" ON "ViewerAlias"."id"=${Number(
            AliasId
        )} WHERE "AuthorAlias"."id"="${referenceName}"."AliasId" AND "AuthorAlias"."isMinor"=TRUE AND "ViewerAlias"."showMinors"=FALSE)`
    )
];

const commentIncludesForUser = (UserId: number, AliasId: number) => {
    const { lastCommentIncludeAttributes } = commentAttributes(UserId, AliasId);
    const commentAccessConditions = commentAccessConditionsForAlias(AliasId);

    return (referenceName: string) => ({
        model: Comment,
        where: {
            [Op.and]: commentAccessConditions(referenceName)
        },
        required: false,
        include: [commentAliasInclude()],
        attributes: {
            include: lastCommentIncludeAttributes(referenceName)
        }
    });
};

const blogPostAttributes = (
    UserId: number,
    AliasId: number,
    followTagIdsSQLArray?: string
): ProjectionAlias[] => {
    const blogPostUserHasEditPermissions: ProjectionAlias[] = UserId
        ? [
              [
                  Sequelize.literal(
                      `EXISTS (SELECT 1 FROM "Aliases" WHERE "Aliases"."UserId"=${Number(
                          UserId
                      )} AND "Aliases"."id"="BlogPost"."AliasId")`
                  ),
                  "userHasEditPermissions"
              ]
          ]
        : [];
    const blogPostUserLiked: ProjectionAlias[] = AliasId
        ? [
              [
                  Sequelize.literal(
                      `EXISTS (SELECT 1 FROM "Reactions" WHERE "Reactions"."type"=${
                          Reaction.REACTION_TYPE.like
                      } AND "Reactions"."AliasId"=${Number(
                          AliasId
                      )} AND ("Reactions"."BlogPostId"="BlogPost"."id" OR EXISTS (SELECT 1 FROM "BlogPost_Reblog" WHERE "BlogPost_Reblog"."ReblogId"="Reactions"."reblogRootId" AND "BlogPost_Reblog"."BlogPostId"="BlogPost"."id")))`
                  ),
                  "userLiked"
              ]
          ]
        : [];
    const numFollowedTags: ProjectionAlias[] = followTagIdsSQLArray
        ? [
              [
                  Sequelize.literal(
                      `(SELECT COUNT ("BlogPost_Tag"."TagId") FROM "BlogPost_Tag" AS "BlogPost_Tag" WHERE "BlogPost_Tag"."BlogPostId"="BlogPost"."id" AND "BlogPost_Tag"."TagId" IN ${followTagIdsSQLArray})`
                  ),
                  "numFollowedTags"
              ]
          ]
        : [];
    const hasCommentPermissions: ProjectionAlias[] = AliasId
        ? [
              [
                  Sequelize.literal(`
            NOT EXISTS (SELECT 1 FROM "AccessControlGroup_Alias" INNER JOIN "BP_comment_ACG" ON "AccessControlGroup_Alias"."AccessControlGroupId"="BP_comment_ACG"."AccessControlGroupId" INNER JOIN "AccessControlGroups" ON "AccessControlGroups"."id"="BP_comment_ACG"."AccessControlGroupId" WHERE "BP_comment_ACG"."BlogPostId"="BlogPost"."id" AND "AccessControlGroup_Alias"."AliasId"=${Number(
                AliasId
            )} AND "AccessControlGroups"."accessControlSetting" = ${
                      AccessControlGroup.ACCESS_CONTROL_SETTINGS.specificExclude
                  })
            AND NOT EXISTS(SELECT 1 FROM ( SELECT EXISTS ( SELECT 1 FROM "AccessControlGroup_Alias" WHERE "AccessControlGroup_Alias"."AliasId" = ${Number(
                AliasId
            )} AND "AccessControlGroup_Alias"."AccessControlGroupId" = "BP_comment_ACG"."AccessControlGroupId" ) AS "AliasInCACG", "BP_comment_ACG"."BlogPostId" AS "BlogPostId" FROM "BP_comment_ACG" INNER JOIN "AccessControlGroups" ON "AccessControlGroups"."id" = "BP_comment_ACG"."AccessControlGroupId" WHERE "BP_comment_ACG"."BlogPostId" = "BlogPost"."id" AND "AccessControlGroups"."accessControlSetting" = ${
                      AccessControlGroup.ACCESS_CONTROL_SETTINGS.specificInclude
                  } ) AS "AliasACGCResults" GROUP BY "AliasACGCResults"."BlogPostId" HAVING BOOL_OR("AliasACGCResults"."AliasInCACG") = false )
            AND NOT EXISTS ( SELECT 1 FROM "Communities" INNER JOIN "AccessControlGroups" ON "AccessControlGroups"."id" = "Communities"."commentsAccessControlId" WHERE "BlogPost"."CommunityId" = "Communities"."id" AND "AccessControlGroups"."accessControlSetting" = ${
                AccessControlGroup.ACCESS_CONTROL_SETTINGS.members
            } AND NOT EXISTS ( SELECT 1 FROM "community_members" WHERE "community_members"."AliasId" = ${Number(
                      AliasId
                  )} AND "community_members"."CommunityId" = "Communities"."id" ))
            AND NOT EXISTS ( SELECT 1 FROM ( SELECT EXISTS ( SELECT 1 FROM "community_members" WHERE "community_members"."AliasId" = ${Number(
                AliasId
            )} AND "community_members"."CommunityId" = "BlogPost"."CommunityId" ) AS "AliasInCommunity", "BP_comment_ACG"."BlogPostId" AS "BlogPostId" FROM "BP_comment_ACG" INNER JOIN "AccessControlGroups" ON "AccessControlGroups"."id" = "BP_comment_ACG"."AccessControlGroupId" WHERE "BP_comment_ACG"."BlogPostId" = "BlogPost"."id" AND "AccessControlGroups"."accessControlSetting" = ${
                      AccessControlGroup.ACCESS_CONTROL_SETTINGS.members
                  } ) AS "AliasACGResults" GROUP BY "AliasACGResults"."BlogPostId" HAVING BOOL_OR("AliasACGResults"."AliasInCommunity") = false )
                      
              AND NOT EXISTS(
                        SELECT "subsACG"."followsBlog","subsACG"."isBlogOwner" FROM(
                              SELECT EXISTS(
                                SELECT 1 FROM "Follows" WHERE "Follows"."followBlogId" = "BlogPost"."BlogId" AND "Follows"."AliasId" = ${Number(
                                    AliasId
                                )}
                                ) 
                              AS "followsBlog",
                              EXISTS(
                                SELECT 1 FROM "Blogs" WHERE "Blogs"."AliasId" = ${Number(
                                    AliasId
                                )} AND "Blogs"."id" = "BlogPost"."BlogId"
                                ) 
                              AS "isBlogOwner",
                              "BP_comment_ACG"."BlogPostId" FROM "BP_comment_ACG" INNER JOIN "AccessControlGroups" ON "AccessControlGroups"."id" = "BP_comment_ACG"."AccessControlGroupId" WHERE "BP_comment_ACG"."BlogPostId" = "BlogPost"."id" AND "AccessControlGroups"."accessControlSetting" = ${
                                  AccessControlGroup.ACCESS_CONTROL_SETTINGS
                                      .subscribers
                              }                                  
                        )
                        AS "subsACG"
                        GROUP BY "subsACG"."followsBlog","subsACG"."isBlogOwner" HAVING BOOL_OR("subsACG"."followsBlog") = false AND NOT "subsACG"."isBlogOwner"
                    )
                     
               
        `),
                  "hasCommentPermissions"
              ]
          ]
        : [];

    const hasReactPermissions: ProjectionAlias[] = AliasId
        ? [
              [
                  Sequelize.literal(
                      `NOT EXISTS ( SELECT 1 FROM "Communities" INNER JOIN "AccessControlGroups" ON "AccessControlGroups"."id" = "Communities"."reactionsAccessControlId" WHERE "BlogPost"."CommunityId" = "Communities"."id" AND "AccessControlGroups"."accessControlSetting" = 
                        ${AccessControlGroup.ACCESS_CONTROL_SETTINGS.members}  
                        AND NOT EXISTS ( SELECT 1 FROM "community_members" WHERE "community_members"."AliasId" = ${Number(
                            AliasId
                        )} AND "community_members"."CommunityId" = "Communities"."id" ))`
                  ),
                  "hasReactPermissions"
              ]
          ]
        : [];

    return [
        ...blogPostUserHasEditPermissions,
        ...blogPostUserLiked,
        ...numFollowedTags,
        ...hasCommentPermissions,
        ...hasReactPermissions
    ];
};

const tagCondition = (
    tagNames: string[],
    searchedIdsSQLArrays: string[] = []
) => ({
    tagNamesCondition: tagNames.map(tagName =>
        Sequelize.literal(
            `EXISTS (SELECT 1 FROM "Tags" INNER JOIN "BlogPost_Tag" ON "Tags"."name"=${sequelize.escape(
                tagName
            )} AND "Tags"."id"="BlogPost_Tag"."TagId" WHERE "BlogPost_Tag"."BlogPostId"="BlogPost"."id")`
        )
    ),
    tagIdsSearchCondition: searchedIdsSQLArrays.map(searchedIdsSQLArray =>
        Sequelize.literal(
            `EXISTS (SELECT 1 FROM "Tags" INNER JOIN "BlogPost_Tag" ON "Tags"."id" IN ${searchedIdsSQLArray} AND "Tags"."id"="BlogPost_Tag"."TagId" WHERE "BlogPost_Tag"."BlogPostId"="BlogPost"."id")`
        )
    )
});

const newsFeedScoreLiteral = (AliasId: number): ProjectionAlias => [
    Sequelize.literal(
        `score_newsfeed_posts("BlogPost"."id", ${Number(
            AliasId
        )}, "BlogPost"."BlogId", "BlogPost"."CommunityId", "BlogPost"."createdAt"::timestamp with time zone )`
    ),
    "newsfeed_score"
];

const blogPostStatsForAlias = (AliasId: number) => (
    identifier: string,
    sortOrder?: string
): ProjectionAlias[] => [
    [
        Sequelize.literal(
            `(SELECT COUNT("Comments"."id") FROM "Comments" WHERE "Comments"."rootBlogPostId"="${identifier}"."id")`
        ),
        "numComments"
    ],
    [
        Sequelize.literal(
            `(SELECT COUNT ("Reactions"."id") FROM "Reactions" WHERE "Reactions"."type"=${Reaction.REACTION_TYPE.like} AND "Reactions"."reblogRootId"="${identifier}"."id")`
        ),
        "numLikes"
    ],
    [
        Sequelize.literal(
            `(SELECT COUNT ("BlogPost_Reblog"."BlogPostId") FROM "BlogPost_Reblog" WHERE "BlogPost_Reblog"."ReblogId"="${identifier}"."id")`
        ),
        "numReblogs"
    ],
    ...(sortOrder === "score" || sortOrder === "undefined"
        ? [newsFeedScoreLiteral(AliasId)]
        : [])
];

const permissionsConditionsForUser = (
    AliasId: number,
    gettingAsUser: User,
    blockedTagIdsSQLArray?: string
) => (referenceName: string) => [
    // current alias blocked tag or its descendants which is on blogpost
    ...(blockedTagIdsSQLArray
        ? [
              Sequelize.literal(
                  `NOT EXISTS( SELECT 1 FROM "BlogPost_Tag" WHERE "BlogPost_Tag"."TagId" IN ${blockedTagIdsSQLArray} AND "BlogPost_Tag"."BlogPostId" = "${referenceName}"."id")`
              )
          ]
        : [
              Sequelize.literal(
                  `NOT EXISTS (SELECT 1 FROM "Follows" INNER JOIN "BlogPost_Tag" ON "Follows"."followTagId"="BlogPost_Tag"."TagId" WHERE "Follows"."AliasId"=${Number(
                      AliasId
                  )} AND "BlogPost_Tag"."BlogPostId"="${referenceName}"."id" AND "Follows"."followType" = 0)`
              )
          ])
];

export const orders = {
    id: Sequelize.col("id"),
    liked: Sequelize.col(`numLikes`),
    commented: Sequelize.col(`numComments`),
    reblogged: Sequelize.col(`numReblogs`),
    numFollowedTags: Sequelize.col(`numFollowedTags`),
    score: Sequelize.col("newsfeed_score"),
    undefined: Sequelize.col("newsfeed_score")
};

async function getRelevantCommunities(
    CurrentUser: User,
    AliasId: number,
    followedOnly: boolean
): Promise<{
    inaccessibleCommunities: Map<number, Community>;
    includedCommunities: Map<number, Community>;
}> {
    let inaccessibleComms = new Map<number, Community>();
    let includedComms = new Map<number, Community>();

    // Return communities that are inaccessible (e.g. members only & user is not member), and communities the user follows
    if (!AliasId) {
        // Anonymous user, no follows and treat as minor
        const fetchResult = await Community.findAll({
            include: [
                {
                    model: AccessControlGroup,
                    as: "contentAccessControl"
                }
            ]
        });
        fetchResult.forEach((community: Community) => {
            if (
                // If access control is member only, it's inaccessible
                community.contentAccessControl.accessControlSetting ===
                AccessControlGroup.ACCESS_CONTROL_SETTINGS.members
            ) {
                inaccessibleComms.set(community.id, community);
            } else if (!community.showMinors) {
                inaccessibleComms.set(community.id, community);
            }
        });
    } else {
        const fetchResult = await Community.findAll({
            include: [
                {
                    model: Alias,
                    as: "members",
                    where: {
                        id: AliasId
                    },
                    required: false
                },
                {
                    model: AccessControlGroup,
                    as: "contentAccessControl"
                },
                {
                    model: Follow,
                    as: "follows",
                    where: {
                        AliasId
                    },
                    required: false
                }
            ]
        });
        fetchResult.forEach((community: Community) => {
            if (
                // If access control is member only and the alias isn't a member, it's inaccessible
                community.contentAccessControl.accessControlSetting ===
                    AccessControlGroup.ACCESS_CONTROL_SETTINGS.members &&
                // We only fetch "members" that are the current alias, so this will have 0 or 1 element
                !(community.members.length > 0)
            ) {
                inaccessibleComms.set(community.id, community);
            } else if (CurrentUser.isMinor && !community.showMinors) {
                // If user is a minor and community doesn't allow minors, it's inaccessible
                inaccessibleComms.set(community.id, community);
            } else if (community.follows.length > 0) {
                // We only fetch follows from the current alias so there will be 0 or 1 follow
                const follow = community.follows[0];
                // If it's followed put it in the followed list
                if (follow.followType === Follow.FOLLOW_TYPES.follow) {
                    includedComms.set(community.id, community);
                }
                // If alias blocks community, it's inaccessible
                // NOTE: not currently possible to block a community in the UI
                else {
                    inaccessibleComms.set(community.id, community);
                }
            } else if (!followedOnly) {
                // Include unfollowed communities that are accessible if we don't only want followed blogs
                includedComms.set(community.id, community);
            }
        });
    }

    return {
        inaccessibleCommunities: inaccessibleComms,
        includedCommunities: includedComms
    };
}

async function getRelevantBlogs(
    CurrentUser: User,
    AliasId: number,
    followedOnly: boolean
): Promise<{
    inaccessibleBlogs: Map<number, Blog>;
    includedBlogs: Map<number, Blog>;
}> {
    let inaccessibleBlogs = new Map<number, Blog>();
    let includedBlogs = new Map<number, Blog>();

    if (!AliasId) {
        // Anonymous user, no follows and treat as minor
        const fetchResult = await Blog.findAll({
            include: [
                {
                    model: Alias
                },
                {
                    model: AccessControlGroup,
                    as: "contentAccessControl"
                }
            ]
        });
        fetchResult.forEach((blog: Blog) => {
            // Hide from minors is on the alias, not the blog
            if (!blog.Alias.showMinors) {
                inaccessibleBlogs.set(blog.id, blog);
            } else if (
                blog.contentAccessControl.accessControlSetting ===
                AccessControlGroup.ACCESS_CONTROL_SETTINGS.subscribers
            ) {
                inaccessibleBlogs.set(blog.id, blog);
            } else if (!followedOnly) {
                // Include other accessible blogs if we don't only care about follows
                includedBlogs.set(blog.id, blog);
            }
        });
    } else {
        const fetchResult = await Blog.findAll({
            include: [
                {
                    model: Alias,
                    include: [
                        {
                            model: Follow,
                            as: "follows",
                            // The blog belongs to this alias
                            include: [
                                {
                                    model: Blog,
                                    as: "followBlog",
                                    where: {
                                        AliasId
                                    }
                                }
                            ],
                            where: {
                                // The follow type is a block
                                followType: Follow.FOLLOW_TYPES.block
                            },
                            required: false
                        }
                    ]
                },
                {
                    model: AccessControlGroup,
                    as: "contentAccessControl"
                },
                {
                    model: Follow,
                    as: "Follows",
                    where: {
                        // Is a follow from this alias
                        AliasId
                    },
                    required: false
                }
            ]
        });
        fetchResult.forEach((blog: Blog) => {
            // Hide from minors is on the alias, not the blog
            if (CurrentUser.isMinor && !blog.Alias.showMinors) {
                inaccessibleBlogs.set(blog.id, blog);
            } else if (blog.Alias.follows.length > 0) {
                // Owner of this blog blocks the current alias's blog
                inaccessibleBlogs.set(blog.id, blog);
            } else if (
                blog.contentAccessControl.accessControlSetting ===
                    AccessControlGroup.ACCESS_CONTROL_SETTINGS.subscribers &&
                // We only fetch "followers" & "targets" that are the current alias, so this will have 0 or 1 element
                blog.Follows.length > 0
            ) {
                const follow = blog.Follows[0];
                if (
                    follow.followType === Follow.FOLLOW_TYPES.follow &&
                    follow.AliasId === AliasId
                ) {
                    includedBlogs.set(blog.id, blog);
                } else {
                    inaccessibleBlogs.set(blog.id, blog);
                }
            } else if (blog.Follows.length > 0) {
                const follow = blog.Follows[0];
                if (follow.followType === Follow.FOLLOW_TYPES.follow) {
                    // Include followed blogs
                    includedBlogs.set(blog.id, blog);
                } else {
                    // If it's not a follow, it's a block
                    inaccessibleBlogs.set(blog.id, blog);
                }
            } else if (!followedOnly) {
                // Include other accessible blogs if we don't only care about follows
                includedBlogs.set(blog.id, blog);
            }
        });
    }

    // Return blogs that are inaccessible, and blogs the user follows
    return {
        inaccessibleBlogs,
        includedBlogs
    };
}

async function getRelevantUsers(
    CurrentUser: User,
    AliasId: number
): Promise<{
    inaccessibleAuthors: Map<number, Alias>;
}> {
    const inaccessibleAuthors = new Map<number, Alias>();

    if (!AliasId) {
        // No blocks to calculate and treat as minor
        const fetchResults = await Alias.findAll({});
        fetchResults.forEach((alias: Alias) => {
            if (!alias.showMinors) {
                inaccessibleAuthors.set(alias.id, alias);
            }
        });
    } else {
        const fetchResults = await User.findAll({
            include: [
                {
                    model: Alias,
                    include: [
                        {
                            model: Follow,
                            as: "follows",
                            where: {
                                [Op.and]: [
                                    {
                                        followType: Follow.FOLLOW_TYPES.block
                                    },
                                    {
                                        followAliasId: AliasId
                                    }
                                ]
                            },
                            required: false
                        }
                    ]
                }
            ]
        });

        const currentAlias = CurrentUser.Aliases.find(a => a.id === AliasId);
        if (!currentAlias) {
            throw new Error("Unable to fetch data about current alias");
        }
        fetchResults.forEach((user: User) => {
            let alreadyBlocked = false;
            user.Aliases.forEach((alias: Alias) => {
                if (CurrentUser.isMinor && !alias.showMinors) {
                    inaccessibleAuthors.set(alias.id, alias);
                } else if (!currentAlias.showMinors && alias.isMinor) {
                    inaccessibleAuthors.set(alias.id, alias);
                } else if (!alreadyBlocked && alias.follows.length > 0) {
                    // NOTE: it also doesn't seem possible to block an alias through the UI
                    // Blocking a user via their blog blocks the blog
                    user.Aliases.forEach(a => {
                        inaccessibleAuthors.set(a.id, a);
                    });
                    alreadyBlocked = true;
                }
            });
        });
    }

    // Return inaccessible post authors, e.g. blocking minors and author is minor
    return {
        inaccessibleAuthors
    };
}

async function getUserRelevantAcgs(
    UserId: number,
    AliasId: number
): Promise<{ whitelistedFor: number[]; blacklistedFrom: number[] }> {
    const user = await User.findOne({
        include: [
            {
                model: AccessControlGroup
            },
            {
                model: Alias,
                include: [
                    {
                        model: AccessControlGroup,
                        as: "memberOfAccessControlGroup"
                    }
                ],
                where: {
                    id: AliasId
                }
            }
        ],
        where: {
            id: UserId
        }
    });

    if (user) {
        let userAcg = user.get("AccessControlGroups") as AccessControlGroup[];
        let aliasAcg = user.Aliases[0].get(
            "memberOfAccessControlGroup"
        ) as AccessControlGroup[];
        let acgs = userAcg.concat(aliasAcg);
        return {
            whitelistedFor: acgs
                .filter(
                    group =>
                        group.accessControlSetting ===
                        AccessControlGroup.ACCESS_CONTROL_SETTINGS
                            .specificInclude
                )
                .map(group => group.id),
            blacklistedFrom: acgs
                .filter(
                    group =>
                        group.accessControlSetting ===
                        AccessControlGroup.ACCESS_CONTROL_SETTINGS
                            .specificExclude
                )
                .map(group => group.id)
        };
    }

    return { whitelistedFor: [], blacklistedFrom: [] };
}

async function allWhitelistIds(): Promise<number[]> {
    return await AccessControlGroup.findAll({
        where: {
            accessControlSetting:
                AccessControlGroup.ACCESS_CONTROL_SETTINGS.specificInclude
        }
    }).then(results => {
        return results.map(r => r.id);
    });
}

const findAndCountAllObject = (
    {
        UserId, // For getting userHasEditPermissions
        gettingAsUser,
        AliasId, // for getting userLiked
        blogPostId, // for getting a single blog post by ID
        BlogId, // Condition on belonging to blog
        CommunityId, // Condition on belonging to community
        likedById, // Condition on being liked by a blog, specified by ID or link
        userFeed = false, // Condition on having a tag, or belonging to a blog or community the alias has followed
        excludeEmptyReblogs = false,
        order = userFeed ? "score" : "id",
        orderDirection = "DESC",
        isSearch = false,
        followTagIdsSQLArray,
        tagNames = [],
        searchedIdsSQLArrays,
        blockedTagIdsSQLArray,
        offset,
        includedCommunityIds,
        inaccessibleCommunityIds,
        includedBlogIds,
        inaccessibleBlogIds,
        inaccessibleAliasIds,
        allWhitelists,
        whitelistGroupIds,
        blacklistGroupIds
    }: FindAndCountBlogPostsInterface,
    transaction: Transaction
): FindAndCountOptions => {
    const commentIncludes = commentIncludesForUser(UserId, AliasId);
    const blogPostStats = blogPostStatsForAlias(AliasId);
    const blogPostIncludeAttributes = blogPostAttributes(
        UserId,
        AliasId,
        followTagIdsSQLArray
    );
    const { tagIdsSearchCondition, tagNamesCondition } = tagCondition(
        tagNames,
        searchedIdsSQLArrays
    );
    const permissionsConditions = permissionsConditionsForUser(
        AliasId,
        gettingAsUser,
        blockedTagIdsSQLArray
    );

    return {
        include: [
            {
                model: Alias,
                attributes: ["id", "name", "avatarId"],
                include: [
                    {
                        model: Blog
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
                    }
                ]
            },
            {
                model: AccessControlGroup,
                as: "viewingAccessControlGroups"
            },
            {
                model: BlogPost,
                as: "r",
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
                                model: Blog
                            }
                        ]
                    },
                    {
                        model: Tag,
                        attributes: ["id", "name", "style"],
                        // weird flex but supposedly this is the kosher way of not including the join table
                        through: {
                            attributes: [
                                "TagId",
                                "BlogPostId",
                                "displaySynonym"
                            ]
                        }
                    },
                    commentIncludes("r->Comments")
                ],
                attributes: {
                    include: blogPostStats("r", order)
                },
                where: {
                    [Op.and]: [
                        // Doesn't include a blocked tag
                        ...permissionsConditions("BlogPost"),
                        // Not authored by an inaccessible user
                        inaccessibleAliasIds.length > 0
                            ? {
                                  AliasId: {
                                      [Op.notIn]: inaccessibleAliasIds
                                  }
                              }
                            : {},
                        // Not in an inaccessible community
                        inaccessibleCommunityIds.length > 0
                            ? {
                                  [Op.or]: [
                                      {
                                          CommunityId: {
                                              [Op.notIn]: inaccessibleCommunityIds
                                          }
                                      },
                                      {
                                          CommunityId: null
                                      }
                                  ]
                              }
                            : {},
                        // Not in an inaccessible blog
                        inaccessibleBlogIds.length > 0
                            ? {
                                  [Op.or]: [
                                      {
                                          BlogId: {
                                              [Op.notIn]: inaccessibleBlogIds
                                          }
                                      },
                                      {
                                          BlogId: null
                                      }
                                  ]
                              }
                            : {},
                        // Check access control on the post
                        AliasId
                            ? {
                                  [Op.and]: [
                                      // Whitelist condition

                                      allWhitelists.length > 0
                                          ? {
                                                [Op.or]: [
                                                    // Post doesn't have a whitelist
                                                    Sequelize.literal(
                                                        `NOT EXISTS (SELECT 1 FROM "BP_view_ACG" WHERE "r"."id" = "BP_view_ACG"."BlogPostId" AND "BP_view_ACG"."AccessControlGroupId" IN (${allWhitelists.join(
                                                            ","
                                                        )}))`
                                                    ),
                                                    whitelistGroupIds.length > 0
                                                        ? // Post has a whitelist and the user is on it
                                                          Sequelize.literal(
                                                              `EXISTS (SELECT 1 FROM "BP_view_ACG" WHERE "r"."id" = "BP_view_ACG"."BlogPostId" AND "BP_view_ACG"."AccessControlGroupId" IN (${whitelistGroupIds.join(
                                                                  ","
                                                              )}))`
                                                          )
                                                        : // User isn't on any whitelists
                                                          {}
                                                ]
                                            }
                                          : // System has no whitelists
                                            {},
                                      // Blacklist condition
                                      blacklistGroupIds.length > 0
                                          ? Sequelize.literal(
                                                `NOT EXISTS (SELECT 1 FROM "BP_view_ACG" WHERE "r"."id" = "BP_view_ACG"."BlogPostId" AND "BP_view_ACG"."AccessControlGroupId" IN (${blacklistGroupIds.join(
                                                    ","
                                                )}))`
                                            )
                                          : // User isn't on any blacklists
                                            {}
                                  ]
                              }
                            : // Anon user can't see anything with a whitelist
                            allWhitelistIds.length > 0
                            ? Sequelize.literal(
                                  `NOT EXISTS (SELECT 1 FROM "BP_view_ACG" WHERE "BlogPost"."id" = "BP_view_ACG"."BlogPostId" AND "BP_view_ACG"."AccessControlGroupId" IN (${allWhitelists.join(
                                      ","
                                  )}))`
                              )
                            : {}
                    ]
                },
                required: false
            },
            {
                model: Tag,
                attributes: ["id", "name", "style"],
                // weird flex but supposedly this is the kosher way of not including the join table
                through: {
                    attributes: ["TagId", "BlogPostId", "displaySynonym"]
                }
            },
            commentIncludes("Comments")
        ],
        attributes: {
            include: [
                ...blogPostIncludeAttributes,
                ...blogPostStats("BlogPost", order)
            ]
        },
        where: {
            ...(blogPostId ? { id: blogPostId } : {}),
            ...(BlogId ? { BlogId } : {}),
            ...(CommunityId ? { CommunityId } : {}),
            ...(userFeed && (order === "score" || order === "undefined")
                ? {
                      createdAt: {
                          [Op.gte]: Sequelize.literal("NOW() - INTERVAL '7d'")
                      }
                  }
                : {}),
            // If my isMinor is true, I cannot see post from Alias.showMinors = false
            ...(gettingAsUser.isMinor
                ? {
                      AliasId: {
                          [Op.notIn]: Sequelize.literal(
                              `(SELECT "Aliases"."id" FROM "Aliases" WHERE "Aliases"."showMinors"=FALSE)`
                          )
                      }
                  }
                : {}),
            // If my showMinor is false, I cannot see post from Alias.isMinor = true
            ...(AliasId
                ? [
                      Sequelize.literal(
                          `NOT EXISTS (SELECT 1 FROM "Aliases" AS "AuthorAlias" JOIN "Aliases" AS "ViewerAlias" ON "ViewerAlias"."id"=${Number(
                              AliasId
                          )} WHERE "AuthorAlias"."id"="BlogPost"."AliasId" AND "AuthorAlias"."isMinor"=TRUE AND "ViewerAlias"."showMinors"=FALSE)`
                      )
                  ]
                : {}),
            ...(AliasId
                ? {
                      [Op.and]: [
                          // If there's an entry in the follows table with AliasId 1 and followAliasId 2 with a follow type of 0 (block), Alias 1 should never see posts made by Alias 2.
                          {
                              AliasId: {
                                  [Op.notIn]: Sequelize.literal(
                                      `(SELECT "Follows"."followAliasId" FROM "Follows" WHERE "Follows"."followType"=0 AND "Follows"."AliasId"=${Number(
                                          AliasId
                                      )})`
                                  )
                              }
                          },
                          // Setting the access control on a post to followers only is not being respected, the post shows up anyway
                          {
                              AliasId: {
                                  [Op.in]: Sequelize.literal(
                                      `(SELECT "AliasId" FROM "Follows" 
                                            INNER JOIN "AccessControlGroups" ON "AccessControlGroups"."belongsToAliasId" = "Follows"."AliasId"
                                        WHERE "AccessControlGroups"."accessControlSetting" = ${
                                            AccessControlGroup
                                                .ACCESS_CONTROL_SETTINGS
                                                .subscribers
                                        } AND "Follows"."followAliasId" = ${Number(
                                          AliasId
                                      )})`
                                  )
                              }
                          }
                      ]
                  }
                : {}),
            ...(likedById
                ? [
                      Sequelize.literal(
                          `EXISTS (SELECT 1 FROM "Reactions" INNER JOIN "Blogs" ON "Reactions"."AliasId"="Blogs"."AliasId" WHERE "Reactions"."type"=${
                              Reaction.REACTION_TYPE.like
                          } AND "Reactions"."BlogPostId"="BlogPost"."id" AND (${
                              !isNaN(Number(likedById))
                                  ? `"Blogs"."id"=${Number(likedById)} OR `
                                  : ""
                          }"Blogs"."link"=${sequelize.escape(likedById)}))`
                      )
                  ]
                : {}),
            // Exclude those hidden from search results in newsfeed, search by tag, and from guests
            ...(isSearch || userFeed || AliasId === 0
                ? {
                      hideFromSearchResults: false
                  }
                : {}),
            // Exclude reblogs with no content
            ...(excludeEmptyReblogs || isSearch
                ? {
                      reblogOfBlogPostId: null
                  }
                : {}),
            // Origin is accessible, if it exists
            [Op.or]: [
                {
                    reblogOfBlogPostId: null
                },
                Sequelize.literal(`"r"."id" IS NOT NULL`)
            ],
            [Op.and]: [
                // Doesn't include a blocked tag
                ...permissionsConditions("BlogPost"),
                // Not authored by an inaccessible user
                inaccessibleAliasIds.length > 0
                    ? {
                          AliasId: {
                              [Op.notIn]: inaccessibleAliasIds
                          }
                      }
                    : {},
                // Not in an inaccessible community
                inaccessibleCommunityIds.length > 0
                    ? {
                          [Op.or]: [
                              {
                                  CommunityId: {
                                      [Op.notIn]: inaccessibleCommunityIds
                                  }
                              },
                              {
                                  CommunityId: null
                              }
                          ]
                      }
                    : {},
                // Not in an inaccessible blog
                inaccessibleBlogIds.length > 0
                    ? {
                          [Op.or]: [
                              {
                                  BlogId: {
                                      [Op.notIn]: inaccessibleBlogIds
                                  }
                              },
                              {
                                  BlogId: null
                              }
                          ]
                      }
                    : {},
                userFeed || isSearch
                    ? {
                          [Op.or]: [
                              ...(userFeed
                                  ? // User feed
                                    [
                                        // In a followed community
                                        {
                                            CommunityId: {
                                                [Op.in]: includedCommunityIds
                                            }
                                        },
                                        // In a followed blog
                                        {
                                            BlogId: {
                                                [Op.in]: includedBlogIds
                                            }
                                        },
                                        // Has a followed tag
                                        Sequelize.literal(
                                            `EXISTS (SELECT 1 FROM "Tags" INNER JOIN "BlogPost_Tag" ON "Tags"."id" IN ${followTagIdsSQLArray} AND "Tags"."id"="BlogPost_Tag"."TagId" WHERE "BlogPost_Tag"."BlogPostId"="BlogPost"."id")`
                                        )
                                    ]
                                  : // Has a searched tag
                                    tagIdsSearchCondition)
                          ]
                      }
                    : {},
                AliasId
                    ? allWhitelists.length > 0
                        ? {
                              [Op.or]: [
                                  // Post doesn't have a whitelist
                                  Sequelize.literal(
                                      `NOT EXISTS (SELECT 1 FROM "BP_view_ACG" WHERE "BlogPost"."id" = "BP_view_ACG"."BlogPostId" AND "BP_view_ACG"."AccessControlGroupId" IN (${allWhitelists.join(
                                          ","
                                      )}))`
                                  ),
                                  whitelistGroupIds.length > 0
                                      ? // Post has a whitelist and the user is on it
                                        Sequelize.literal(
                                            `EXISTS (SELECT 1 FROM "BP_view_ACG" WHERE "BlogPost"."id" = "BP_view_ACG"."BlogPostId" AND "BP_view_ACG"."AccessControlGroupId" IN (${whitelistGroupIds.join(
                                                ","
                                            )}))`
                                        )
                                      : // User isn't on any whitelists
                                        {}
                              ]
                          }
                        : // System has no whitelists
                          {}
                    : // Anon user can't see anything with a whitelist
                    allWhitelistIds.length > 0
                    ? Sequelize.literal(
                          `NOT EXISTS (SELECT 1 FROM "BP_view_ACG" WHERE "BlogPost"."id" = "BP_view_ACG"."BlogPostId" AND "BP_view_ACG"."AccessControlGroupId" IN (${allWhitelists.join(
                              ","
                          )}))`
                      )
                    : {},
                AliasId
                    ? blacklistGroupIds.length > 0
                        ? Sequelize.literal(
                              `NOT EXISTS (SELECT 1 FROM "BP_view_ACG" WHERE "BlogPost"."id" = "BP_view_ACG"."BlogPostId" AND "BP_view_ACG"."AccessControlGroupId" IN (${blacklistGroupIds.join(
                                  ","
                              )}))`
                          )
                        : // User isn't on any blacklists
                          {}
                    : {}
            ]
        },
        order: [[orders[order], orderDirection]],
        ...(limit && { limit }),
        ...(offset && { offset }),
        subQuery: false,
        distinct: true, // This is needed to fix the counts, see https://github.com/sequelize/sequelize/issues/4042
        transaction
    };
};

function getFormattedOrigin(
    blogId: number,
    communityId: number,
    blogs: Map<number, Blog>,
    communities: Map<number, Community>
): {
    type: string;
    id: number;
    name: string;
    link: string;
} {
    if (blogId) {
        const blog = blogs.get(blogId);
        if (blog) {
            return {
                type: "blog",
                id: blogId,
                name: blog.name,
                link: blog.link
            };
        }

        return {
            type: "blog",
            id: blogId,
            name: "Unknown blog",
            link: ""
        };

        // throw new Error(`No blog with id ${blogId}`);
    } else if (communityId) {
        const community = communities.get(communityId);
        if (community) {
            return {
                type: "community",
                id: communityId,
                name: community.name,
                link: community.link
            };
        }

        return {
            type: "community",
            id: blogId,
            name: "Unknown Community",
            link: ""
        };

        // throw new Error(`No community with id ${communityId}`);
    }

    // This shouldn't be possible
    throw new Error(`No community or blog id for blog post`);
}

const formatResponseForUser = (
    gettingAsUser: User,
    blogs: Map<number, Blog>,
    communities: Map<number, Community>
) => ({ rows, count }: { rows: BlogPost[]; count: number }) => ({
    BlogPosts: rows.map(blogPostResult =>
        ((blogPost: BlogPost) => ({
            ...blogPost,
            content: sanitizeContents(blogPost.content),
            /*hideFromSearchResults: blogPost.hideFromSearchResults,*/
            viewingAccessControlGroups:
                gettingAsUser && gettingAsUser.id
                    ? gettingAsUser.AliasIds.includes(blogPost.AliasId)
                        ? blogPost.viewingAccessControlGroups
                        : []
                    : [],
            commentingAccessControlGroups:
                gettingAsUser && gettingAsUser.id
                    ? gettingAsUser.AliasIds.includes(blogPost.AliasId)
                        ? blogPost.commentingAccessControlGroups
                        : []
                    : [],
            Comments: blogPost.Comments.map(comment => ({
                ...comment,
                content: sanitizeContents(comment.content),
                engagementStats: {
                    likes: comment.numLikes,
                    comments: comment.numComments
                }
                // Potentially required hack, remove if you see it after 06032021 because the smoothbrain dev forgot
                // childComments: []
            })),
            ...(blogPost.reblogOfBlogPost && {
                reblogOfBlogPost: {
                    ...blogPost.reblogOfBlogPost,
                    content: sanitizeContents(
                        blogPost.reblogOfBlogPost.content
                    ),
                    origin: getFormattedOrigin(
                        blogPost.reblogOfBlogPost.BlogId,
                        blogPost.reblogOfBlogPost.CommunityId,
                        blogs,
                        communities
                    )
                }
            }),
            reblogChain: blogPost.r.map(reblog => ({
                ...reblog,
                content: sanitizeContents(reblog.content),
                Comments: reblog.Comments.map(comment => ({
                    ...comment,
                    content: sanitizeContents(comment.content),
                    engagementStats: {
                        likes: comment.numLikes,
                        comments: comment.numComments
                    }
                    /*childComments: comment.childComments.map(childComment => ({
                        ...childComment,
                        content: sanitizeContents(childComment.content),
                        engagementStats: {
                            likes: childComment.numLikes,
                            comments: childComment.numComments
                        },
                        childComments: childComment.childComments.map(
                            childChildComment => ({
                                ...childChildComment,
                                content: sanitizeContents(
                                    childChildComment.content
                                ),
                                engagementStats: {
                                    likes: childChildComment.numLikes,
                                    comments: childChildComment.numComments
                                }
                            })
                        )
                    }))*/
                })),
                origin: getFormattedOrigin(
                    reblog.BlogId,
                    reblog.CommunityId,
                    blogs,
                    communities
                ),
                engagementStats: {
                    likes: reblog.numLikes,
                    comments: reblog.numComments,
                    reblogs: reblog.numReblogs,
                    bumps: 0
                }
            })),
            origin: getFormattedOrigin(
                blogPost.BlogId,
                blogPost.CommunityId,
                blogs,
                communities
            ),
            engagementStats: {
                likes: blogPost.numLikes,
                comments: blogPost.numComments,
                reblogs: blogPost.numReblogs,
                bumps: 0
            },
            Tags: blogPost.Tags.map(blogPostTag => {
                return tagFunctions.getDisplayTag(blogPostTag, "BlogPost_Tag");
            })
        }))(blogPostResult.toJSON() as BlogPost)
    ),
    count
});

export default (
    {
        UserId,
        gettingAsUser,
        AliasId,
        followedTagIds = [],
        blockedTagIds = [],
        blogPostId,
        BlogId,
        CommunityId,
        likedById,
        userFeed = false,
        excludeEmptyReblogs,
        isSearch,
        order,
        orderDirection,
        tagNames,
        searchedTagsIdArrays = [],
        page = 1
    }: GetBlogPostsInterface,
    transaction: Transaction
): Promise<{ BlogPosts: any[]; count: number }> => {
    const followTagIdsSQLArray = followedTagIds.length
        ? `(${followedTagIds.join(",")})`
        : "(NULL)";
    const blockedTagIdsSQLArray = blockedTagIds.length
        ? `(${blockedTagIds.join(",")})`
        : "(NULL)";
    const searchedIdsSQLArrays: string[] = searchedTagsIdArrays.map(
        searchedTagIdArray =>
            searchedTagIdArray.length
                ? `(${searchedTagIdArray.join(",")})`
                : "(NULL)"
    );

    const offset = (page - 1) * limit;
    console.log("GETTING BLOGPOSTS");

    const communityResult = 0;
    const blogResult = 1;
    const aliasResult = 2;
    const userAcgResult = 3;
    const whitelistResult = 4;

    return Promise.all([
        getRelevantCommunities(gettingAsUser, AliasId, userFeed),
        getRelevantBlogs(gettingAsUser, AliasId, userFeed),
        getRelevantUsers(gettingAsUser, AliasId),
        getUserRelevantAcgs(UserId, AliasId),
        allWhitelistIds()
    ]).then(values => {
        const relevantCommunities = values[communityResult];
        const excludedCommunities = relevantCommunities.inaccessibleCommunities;
        const includedCommunities = relevantCommunities.includedCommunities;
        const includedCommunityIds = Array.from(includedCommunities.keys());
        const inaccessibleCommunityIds = Array.from(excludedCommunities.keys());

        const relevantBlogs = values[blogResult];
        const excludedBlogs = relevantBlogs.inaccessibleBlogs;
        const includedBlogs = relevantBlogs.includedBlogs;
        const includedBlogIds = Array.from(includedBlogs.keys());
        const inaccessibleBlogIds = Array.from(excludedBlogs.keys());

        const excludedAuthors = values[aliasResult].inaccessibleAuthors;
        const inaccessibleAliasIds = Array.from(excludedAuthors.keys());

        const whitelistGroupIds = values[userAcgResult].whitelistedFor;
        const blacklistGroupIds = values[userAcgResult].blacklistedFrom;
        const allWhitelists = values[whitelistResult];

        return Promise.resolve(
            BlogPost.findAndCountAll(
                findAndCountAllObject(
                    {
                        UserId, // For getting userHasEditPermissions
                        gettingAsUser,
                        AliasId, // for getting userLiked
                        blogPostId, // for getting a single blog post by ID
                        BlogId, // Condition on belonging to blog
                        CommunityId, // Condition on belonging to community
                        likedById, // Condition on being liked by a blog, specified by ID or link
                        userFeed, // Condition on having a tag, or belonging to a blog or community the alias has followed
                        excludeEmptyReblogs,
                        order,
                        orderDirection,
                        isSearch,
                        followTagIdsSQLArray,
                        tagNames,
                        searchedIdsSQLArrays,
                        blockedTagIdsSQLArray,
                        offset,
                        includedCommunityIds,
                        inaccessibleCommunityIds,
                        includedBlogIds,
                        inaccessibleBlogIds,
                        inaccessibleAliasIds,
                        allWhitelists,
                        whitelistGroupIds,
                        blacklistGroupIds
                    },
                    transaction
                )
            )
        ).then(
            formatResponseForUser(
                gettingAsUser,
                includedBlogs,
                includedCommunities
            )
        );
    });
};
