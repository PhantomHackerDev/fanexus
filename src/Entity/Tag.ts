import {
    Sequelize,
    DataTypes,
    Association,
    ProjectionAlias,
    Op,
    FindOptions,
    Transaction
} from "sequelize";
import {
    database as sequelize,
    tagMax,
    textAreaMax
} from "../services/databaseService.js";
import { QueryResult } from "neo4j-driver";
import { runNeo4jQuery } from "../services/Neo4jService";
import {
    DataType,
    Column,
    CreatedAt,
    UpdatedAt,
    Table,
    Model,
    BelongsToMany,
    HasMany
} from "sequelize-typescript";
import { Community } from "./Community";
import { Blog } from "./Blog";
import { Follow } from "./Follow";
import { BlogPost, GetBlogPostsInterface } from "./BlogPost";
import { Reaction } from "./Reaction";
import { BlogPost_Tag } from "./BlogPost_Tag";

@Table
class Tag extends Model {
    @Column public id!: number;
    @Column public name!: string;
    @Column(DataType.ARRAY(DataType.TEXT)) public synonyms!: string[];
    @Column public description!: string;
    @Column public style!: string;
    @Column public graphId!: number;
    @Column public displaySynonym!: string;
    @Column public isLocked!: boolean;

    @BelongsToMany(() => Community, { through: "Community_Tag" })
    public Communities: Community[];

    @BelongsToMany(() => Blog, { through: "Blog_Tag" })
    public Blogs: Blog[];

    @BelongsToMany(() => BlogPost, { through: "BlogPost_Tag" })
    public BlogPosts: BlogPost[];

    @HasMany(() => BlogPost_Tag)
    public BlogPost_Tag: BlogPost_Tag;

    @Column @CreatedAt public readonly createdAt!: Date;
    @Column @UpdatedAt public readonly updatedAt!: Date;

    public parentTags: Tag[];
    public childTags: Tag[];

    public Blog_Tag: Tag;
    public Community_Tag: Tag;

    public synonymSelected!: string;

    public static associations: {
        Communities: Association<Tag, Community>;
        Blogs: Association<Tag, Blog>;
    };

    public static findOrCreateWithNeo4j(
        name: string,
        transaction: Transaction
    ): Promise<Tag> {
        return this.findOrCreate({ where: { name }, transaction }).then(
            ([tag, created]) => {
                if (created) {
                    return runNeo4jQuery(
                        "MERGE (t:Tag {sqlId: $id, name: $name}) RETURN t",
                        { id: tag.id, name }
                    ).then(() => tag);
                }
                return tag;
            }
        );
    }

    public static findDetailed(
        tagId: number | string,
        currentAlias: number
    ): Promise<Tag> {
        return this.findByPk(tagId, {
            attributes: {
                include: [
                    [
                        Sequelize.literal(
                            `(SELECT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${currentAlias} AND "Follows"."followTagId"="Tag"."id"  AND "Follows"."followType" = ${Follow.FOLLOW_TYPES.follow}))`
                        ),
                        "aliasFollowing"
                    ],
                    [
                        Sequelize.literal(
                            `(SELECT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${currentAlias} AND "Follows"."followTagId"="Tag"."id"  AND "Follows"."followType" = ${Follow.FOLLOW_TYPES.block}))`
                        ),
                        "aliasBlocking"
                    ]
                ]
            }
        }).then(
            (tag: Tag): Promise<Tag> => {
                const parentQuery: Promise<QueryResult> = runNeo4jQuery(
                    "MATCH (tag:Tag {sqlId: $sqlIdParam})-[:HAS_PARENT]->(parent:Tag) " +
                        "RETURN parent.sqlId",
                    { sqlIdParam: Number(tagId) }
                );
                const childQuery: Promise<QueryResult> = runNeo4jQuery(
                    "MATCH (tag:Tag {sqlId: $sqlIdParam})<-[:HAS_PARENT]-(child:Tag) " +
                        "RETURN child.sqlId",
                    { sqlIdParam: Number(tagId) }
                );
                return Promise.all([parentQuery, childQuery])
                    .then(
                        ([parentQueryResult, childQueryResult]: [
                            QueryResult,
                            QueryResult
                        ]): Promise<[Tag[], Tag[]]> => {
                            const parentTagSql = this.getSqlFromNeo4j(
                                parentQueryResult,
                                "parent"
                            );
                            const childTagSql = this.getSqlFromNeo4j(
                                childQueryResult,
                                "child"
                            );
                            return Promise.all([parentTagSql, childTagSql]);
                        }
                    )
                    .then(
                        ([parentSqlResult, childSqlResult]: [
                            Tag[],
                            Tag[]
                        ]): Tag => {
                            tag.parentTags = parentSqlResult;
                            tag.childTags = childSqlResult;
                            return tag;
                        }
                    );
            }
        );
    }

    public static getSqlFromNeo4j(
        neo4jResult: QueryResult,
        key: string
    ): Promise<Tag[]> {
        const tagIds: number[] = [];
        neo4jResult.records.forEach(record => {
            tagIds.push(record.get(`${key}.sqlId`));
        });
        return this.findAll({ where: { id: tagIds } });
    }

    public static getTagsCount(
        {
            AliasId, // for condition on likes
            BlogId, // Condition on belonging to blog
            CommunityId, // Condition on belonging to community
            likedById, // Condition on being liked by a blog, specified by ID or link
            tagNames = [], // Condition on having tags
            userFeed = false // Condition on having a tag, or belonging to a blog or community the alias has followed
        }: GetBlogPostsInterface,
        transaction: Transaction
    ): Promise<Tag[]> {
        const countAttribute: ProjectionAlias = [
            Sequelize.fn("COUNT", Sequelize.col("BlogPosts.id")),
            "tagCount"
        ];
        return Tag.findAll({
            attributes: {
                include: [countAttribute]
            },
            include: [
                {
                    model: BlogPost,
                    attributes: [],
                    where: {
                        ...(BlogId ? { BlogId } : {}),
                        ...(CommunityId ? { CommunityId } : {}),
                        [Op.and]: [
                            ...tagNames.map(tagName =>
                                Sequelize.literal(
                                    `EXISTS (SELECT 1 FROM "Tags" INNER JOIN "BlogPost_Tag" ON "Tags"."name"=${sequelize.escape(
                                        tagName
                                    )} AND "Tags"."id"="BlogPost_Tag"."TagId" WHERE "BlogPost_Tag"."BlogPostId"="BlogPosts"."id")`
                                )
                            ),
                            ...(likedById
                                ? [
                                      Sequelize.literal(
                                          `EXISTS (SELECT 1 FROM "Reactions" INNER JOIN "Blogs" ON "Reactions"."AliasId"="Blogs"."AliasId" WHERE "Reactions"."type"=${
                                              Reaction.REACTION_TYPE.like
                                          } AND "Reactions"."BlogPostId"="BlogPosts"."id" AND (${
                                              !isNaN(Number(likedById))
                                                  ? `"Blogs"."id"=${Number(
                                                        likedById
                                                    )} OR `
                                                  : ""
                                          }"Blogs"."link"=${sequelize.escape(
                                              likedById
                                          )}))`
                                      )
                                  ]
                                : [])
                        ],
                        ...(AliasId && userFeed
                            ? {
                                  [Op.or]: [
                                      Sequelize.literal(
                                          `EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${Number(
                                              AliasId
                                          )} AND "Follows"."BlogId"="BlogPosts"."BlogId"`
                                      ),
                                      Sequelize.literal(
                                          `EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${Number(
                                              AliasId
                                          )} AND "Follows"."CommunityId"="BlogPosts"."CommunityId"`
                                      ),
                                      Sequelize.literal(
                                          `EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${Number(
                                              AliasId
                                          )} INNER JOIN "BlogPost_Tag" ON "Follows.TagId"="BlogPost_Tag"."TagId" WHERE "BlogPost_Tag"."BlogPostId"="BlogPosts"."id"`
                                      )
                                  ]
                              }
                            : {})
                    }
                }
            ],
            group: ["Tag.id"],
            includeIgnoreAttributes: false, // see: https://github.com/sequelize/sequelize/issues/6711
            transaction
        } as FindOptions);
    }
}

Tag.init(
    {
        name: {
            type: DataTypes.TEXT,
            allowNull: false,
            unique: { name: "unique-tag-name", msg: "Tag name must be unique" },
            validate: {
                isByteLength: {
                    max: tagMax,
                    msg: `Tag name must be of length with ${tagMax}`
                }
            }
        },
        synonyms: {
            type: DataTypes.ARRAY(DataTypes.TEXT),
            defaultValue: [],
            allowNull: false,
            validate: {
                synonymsLength(synonyms: string[]) {
                    if (
                        synonyms.some(
                            synonym =>
                                Buffer.byteLength(synonym, "utf8") > tagMax
                        )
                    ) {
                        throw new Error(
                            `All synonyms must have length at most ${tagMax}`
                        );
                    }
                }
            }
            /*get(){
            const synonyms = this.getDataValue('synonyms');
            if(synonyms === null || synonyms === undefined){
                return [];
            }
            return synonyms;
        }*/
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
            validate: {
                isByteLength: {
                    max: textAreaMax,
                    msg: `Description must be of length within ${textAreaMax}`
                }
            }
        },
        style: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        graphId: {
            type: DataTypes.INTEGER,
            allowNull: true // set this to false for prod
        },
        parentTags: {
            type: DataTypes.VIRTUAL
        },
        childTags: {
            type: DataTypes.VIRTUAL
        },
        isLocked: {
            type: DataTypes.BOOLEAN
        }
    },
    {
        sequelize,
        modelName: "Tag"
    }
);

export { Tag };
