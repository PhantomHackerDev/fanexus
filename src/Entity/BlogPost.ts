import {
    Sequelize,
    DataTypes,
    Association,
    BelongsToGetAssociationMixin,
    BelongsToSetAssociationMixin,
    BelongsToManyGetAssociationsMixin,
    BelongsToManySetAssociationsMixin,
    BelongsToManyAddAssociationMixin,
    BelongsToManyRemoveAssociationMixin,
    BelongsToManyHasAssociationMixin,
    HasManyAddAssociationMixin,
    HasManyGetAssociationsMixin,
    HasManyRemoveAssociationMixin,
    Transaction
} from "sequelize";
import {
    database as sequelize,
    textAreaMax
} from "../services/databaseService.js";

import { Blog } from "./Blog";
import { BlogPost_Tag } from "./BlogPost_Tag";
import { Alias } from "./Alias";
import { User } from "./User";
import { Tag } from "./Tag";
import { Comment } from "./Comment";
import { Reaction } from "./Reaction";
import { Community } from "./Community";
import { EngagementStatsInterface } from "../Interface/EngagementStatsInterface";
import { AccessControlGroup } from "./AccessControlGroup";
import {
    Model,
    Column,
    CreatedAt,
    UpdatedAt,
    ForeignKey,
    BelongsTo,
    Table,
    PrimaryKey,
    BelongsToMany
} from "sequelize-typescript";

import { sanitizeContents } from "./shared/sanitizeHTML";
import { runNeo4jQuery } from "../services/Neo4jService";
import { tagFunctions } from "./shared/TagFunctions";
import { Neo4jFunctions } from "./shared/Neo4jFunctions";
import { TagDisplayInterface } from "../Interface/TagDisplayInterface";
import { TagController } from "../Controller/TagController";

import getBlogPosts from "../services/getBlogPosts";

export const orders = {
    id: "id",
    liked: Sequelize.col(`numLikes`),
    commented: Sequelize.col(`numComments`),
    reblogged: Sequelize.col(`numReblogs`),
    numFollowedTags: Sequelize.col(`numFollowedTags`),
    score: Sequelize.col("newsfeed_score"),
    undefined: Sequelize.col("newsfeed_score")
};

export interface GetBlogPostsInterface {
    UserId?: number;
    AliasId?: number;
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
    limit?: number;
    offset?: number;
    gettingAsUser?: User;
    isSearch?: boolean;
    followedTagIds?: number[];
    blockedTagIds?: number[];
    searchedTagsIdArrays?: number[][];
}

@Table
class BlogPost extends Model {
    @PrimaryKey @Column public id!: number;
    @Column public content!: string;

    @Column @CreatedAt public readonly createdAt!: Date;
    @Column @UpdatedAt public readonly updatedAt!: Date;
    public readonly type: string = "blogPost";

    @ForeignKey(() => Blog) @Column public BlogId: number;
    @BelongsTo(() => Blog) public Blog!: Blog;
    public getBlog!: BelongsToGetAssociationMixin<Blog>;
    public setBlog!: BelongsToSetAssociationMixin<Blog, number>;

    @BelongsTo(() => BlogPost, "reblog_of_blogPost")
    public reblogOfBlogPostId: number;
    public reblogOfBlogPost: BlogPost;
    public getReblogOfBlogPost!: BelongsToGetAssociationMixin<BlogPost>;
    public setReblogOfBlogPost!: BelongsToSetAssociationMixin<BlogPost, number>;

    public r: BlogPost[];
    public setR: BelongsToSetAssociationMixin<BlogPost, number[]>;

    @ForeignKey(() => Community) @Column public CommunityId: number;
    @BelongsTo(() => Community) public Community: Community;
    public getCommunity!: BelongsToGetAssociationMixin<Community>;
    public setCommunity!: BelongsToSetAssociationMixin<Community, number>;

    @ForeignKey(() => Alias) @Column public AliasId: number;
    public getAlias!: BelongsToGetAssociationMixin<Alias>;
    public setAlias!: BelongsToSetAssociationMixin<Alias, number>;

    @BelongsTo(() => User) public User: User;

    @BelongsToMany(() => Tag, { through: "BlogPost_Tag" })
    public Tags!: Tag[];
    public getTags!: BelongsToManyGetAssociationsMixin<Tag>;
    public addTag!: BelongsToManyAddAssociationMixin<Tag, number>;
    public setTags!: BelongsToManySetAssociationsMixin<Tag, number>;
    public removeTag!: BelongsToManyRemoveAssociationMixin<Tag, number>;
    public hasTag!: BelongsToManyHasAssociationMixin<Tag, number>;

    public setTagsWithDisplayNames(
        tags: TagDisplayInterface[],
        transaction: Transaction
    ): Promise<any> {
        return BlogPost_Tag.destroy({
            where: {
                BlogPostId: this.id
            },
            transaction
        })
            .then(() =>
                Promise.all(
                    tags
                        .filter(({ id }) => id < 0)
                        .map(tag =>
                            TagController.getOrCreateTag(
                                tag.displaySynonym,
                                transaction
                            )
                        )
                )
            )
            .then(createdTags =>
                Promise.all(
                    tags
                        .filter(({ id }) => id > 0)
                        .concat(createdTags)
                        .map(tag => {
                            BlogPost_Tag.create(
                                {
                                    TagId: tag.id,
                                    BlogPostId: this.id,
                                    displaySynonym:
                                        tag.displaySynonym || tag.name
                                },
                                { transaction }
                            );
                        })
                )
            );
    }

    public Comments: Comment[];
    public getComments!: HasManyGetAssociationsMixin<Comment>;
    public addComment!: HasManyAddAssociationMixin<Comment, number>;
    public removeComment!: HasManyRemoveAssociationMixin<Comment, number>;

    public getReactions!: HasManyGetAssociationsMixin<Reaction>;
    public addReaction!: HasManyAddAssociationMixin<Reaction, number>;
    public removeReaction!: HasManyRemoveAssociationMixin<Reaction, number>;

    public AccessControlGroup: AccessControlGroup;
    public getAccessControlGroup!: BelongsToGetAssociationMixin<
        AccessControlGroup
    >;
    public setAccessControlGroup!: BelongsToSetAssociationMixin<
        AccessControlGroup,
        number
    >;

    public engagementStats!: EngagementStatsInterface;
    public origin!: any;
    public userLiked!: boolean;
    public userHasEditPermissions!: boolean;
    @Column public hideFromSearchResults: boolean;

    public numLikes: number;
    public numComments: number;
    public numReblogs: number;

    public hasCommentPermissions: boolean;
    public hasReactPermissions: boolean;

    @BelongsToMany(() => AccessControlGroup, "BP_view_ACG")
    public viewingAccessControlGroups: AccessControlGroup[];
    public getViewingAccessControlGroups: BelongsToManyGetAssociationsMixin<
        AccessControlGroup
    >;
    public addViewingAccessControlGroup: BelongsToManyAddAssociationMixin<
        AccessControlGroup,
        number
    >;
    public removeViewingAccessControlGroup: BelongsToManyRemoveAssociationMixin<
        AccessControlGroup,
        number
    >;
    public setViewingAccessControlGroups: BelongsToManySetAssociationsMixin<
        AccessControlGroup,
        number
    >;

    @BelongsToMany(() => AccessControlGroup, "BP_comment_ACG")
    public commentingAccessControlGroups: AccessControlGroup[];
    public getCommentingAccessControlGroups: BelongsToManyGetAssociationsMixin<
        AccessControlGroup
    >;
    public addCommentingAccessControlGroup: BelongsToManyAddAssociationMixin<
        AccessControlGroup,
        number
    >;
    public removeCommentingAccessControlGroup: BelongsToManyRemoveAssociationMixin<
        AccessControlGroup,
        number
    >;
    public setCommentingAccessControlGroups: BelongsToManySetAssociationsMixin<
        AccessControlGroup,
        number
    >;

    public static getBlogPosts = getBlogPosts;

    // deprecated
    public setBlogWithNeo4j(
        blog: number | Blog,
        transaction: Transaction
    ): Promise<any> {
        return Promise.all([
            this.setBlog(blog, { transaction }),
            this.setNeo4j(blog, "Blog")
        ]);
    }

    // deprecated
    public setCommunityWithNeo4j(
        community: number | Community,
        transaction: Transaction
    ): Promise<any> {
        return Promise.all([
            this.setCommunity(community, { transaction }),
            this.setNeo4j(community, "Community")
        ]);
    }

    // deprecated
    public setAliasWithNeo4j(
        alias: number | Alias,
        transaction: Transaction
    ): Promise<any> {
        return Promise.all([
            this.setAlias(alias, { transaction }),
            this.setNeo4j(alias, "Alias")
        ]);
    }

    // deprecated
    private setNeo4j(
        associated: number | { id: number } | undefined,
        associationName: string
    ): Promise<void> {
        if (associated) {
            return Neo4jFunctions.setNeo4j(
                this.id,
                "BlogPost",
                associated,
                associationName
            );
        } else {
            return Promise.resolve(undefined);
        }
    }

    public addTagWithNeo4j(
        tag: number | Tag,
        transaction: Transaction
    ): Promise<void> {
        return tagFunctions.addTagWithNeo4j(this, tag, "BlogPost", transaction);
    }

    // DEPRECATED
    public setTagsWithNeo4j(
        tags: (number | Tag)[],
        transaction: Transaction
    ): Promise<void> {
        return tagFunctions.setTagsWithNeo4j(
            this,
            tags,
            "BlogPost",
            transaction
        );
    }

    public setTagsWithDisplaysWithNeo4j(
        tags: TagDisplayInterface[],
        transaction: Transaction
    ): Promise<void> {
        return tagFunctions.setTagsWithNeo4j(
            this,
            tags,
            "BlogPost",
            transaction
        );
    }

    public removeTagWithNeo4j(
        tag: number | Tag,
        transaction: Transaction
    ): Promise<void> {
        return tagFunctions.removeTagWithNeo4j(
            this,
            tag,
            "BlogPost",
            transaction
        );
    }

    public sanitizeContents(): void {
        this.content = sanitizeContents(this.content);
    }

    // deprecated
    public destroyWithNeo4j(transaction: Transaction): Promise<void> {
        return Promise.all([
            this.destroy({ transaction }),
            runNeo4jQuery("MATCH (bp:BlogPost {sqlId: $id}) DETACH DELETE bp", {
                id: this.id
            })
        ]).then((): void => {
            return undefined;
        });
    }

    public static associations: {
        blog: Association<BlogPost, Blog>;
        community: Association<BlogPost, Community>;
        alias: Association<BlogPost, Alias>;
        tags: Association<Tag, BlogPost>;
        comments: Association<Comment, BlogPost>;
        reactions: Association<Reaction, BlogPost>;
        accessControlGroup: Association<BlogPost, AccessControlGroup>;
        reblogOfBlogPost: Association<BlogPost, BlogPost>;
    };
}
BlogPost.init(
    {
        content: {
            allowNull: false,
            type: DataTypes.TEXT,
            validate: {
                isByteLength: {
                    max: textAreaMax,
                    msg: `Content must be of length within ${textAreaMax}`
                }
            }
        },
        hideFromSearchResults: {
            allowNull: false,
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    },
    {
        sequelize,
        modelName: "BlogPost"
    }
);

export { BlogPost };
