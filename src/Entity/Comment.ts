import { BelongsTo, HasMany, Model } from "sequelize-typescript";
import {
    Association,
    DataTypes,
    BelongsToGetAssociationMixin,
    BelongsToSetAssociationMixin,
    HasManyAddAssociationMixin,
    HasManyGetAssociationsMixin,
    HasManyHasAssociationMixin,
    HasManyRemoveAssociationMixin
} from "sequelize";
import { Alias } from "./Alias";
import { User } from "./User";
import {
    database as sequelize,
    textAreaMax
} from "../services/databaseService.js";
import { BlogPost } from "./BlogPost";
import { EngagementStatsInterface } from "../Interface/EngagementStatsInterface";
import {
    Column,
    CreatedAt,
    UpdatedAt,
    ForeignKey,
    PrimaryKey,
    Table
} from "sequelize-typescript";
import { sanitizeContents } from "./shared/sanitizeHTML";
import { Neo4jFunctions } from "./shared/Neo4jFunctions";

@Table
class Comment extends Model {
    // TODO this model creates duplicate comment relationship, when one is realistically needed, but for now, i dont think it matters
    @PrimaryKey @Column public id!: number;
    @Column public content!: string;

    @ForeignKey(() => Alias) @Column public AliasId: number;
    public getAlias!: BelongsToGetAssociationMixin<Alias>;
    public setAlias!: BelongsToSetAssociationMixin<Alias, number>;

    @BelongsTo(() => User)
    public User: User;

    @Column @CreatedAt public readonly createdAt!: Date;
    @Column @UpdatedAt public readonly updatedAt!: Date;

    @BelongsTo(() => BlogPost, "blog_post")
    public BlogPost: BlogPost;
    @ForeignKey(() => BlogPost) @Column public BlogPostId: number;
    public getBlogPost!: BelongsToGetAssociationMixin<BlogPost>;
    public setBlogPost!: BelongsToSetAssociationMixin<BlogPost, number>;

    @HasMany(() => Comment, "child_comments")
    public childComments: Comment[];
    public getChildComments!: HasManyGetAssociationsMixin<Comment>;
    public addChildComment!: HasManyAddAssociationMixin<Comment, number>;
    public removeChildComment!: HasManyRemoveAssociationMixin<Comment, number>;
    public hasComment!: HasManyHasAssociationMixin<Comment, number>;

    @BelongsTo(() => Comment, "parent_comment")
    public parentComment: Comment;
    @ForeignKey(() => Comment) @Column public parentCommentId: number;
    public getParentComment!: BelongsToGetAssociationMixin<Comment>;
    public setParentComment!: BelongsToSetAssociationMixin<Comment, number>;

    public engagementStats!: EngagementStatsInterface;
    public userHasEditPermissions!: boolean;
    public userLiked!: boolean;

    @BelongsTo(() => BlogPost, "root_blog_post")
    public rootBlogPostId!: number;
    public rootBlogPost!: BlogPost;
    public getRootBlogPost!: BelongsToGetAssociationMixin<BlogPost>;
    public setRootBlogPost!: BelongsToSetAssociationMixin<BlogPost, number>;

    public numLikes: number;
    public numComments: number;
    public numReblogs: number;

    public sanitizeContents(): void {
        this.content = sanitizeContents(this.content);
    }

    public static associations: {
        alias: Association<Comment, Alias>;
        blogPost: Association<Comment, BlogPost>;
        rootBlogPost: Association<Comment, BlogPost>;
        childComments: Association<Comment, Comment>;
        parentComment: Association<Comment, Comment>;
    };

    // deprecated
    private setNeo4j(
        associated: number | { id: number },
        associationName: string,
        associatedLabel?: string
    ): Promise<void> {
        console.log("in setneo4j");
        return Neo4jFunctions.setNeo4j(
            this.id,
            "Comment",
            associated,
            associationName,
            associatedLabel
        );
    }

    // deprecated
    public setAliasWithNeo4j(alias: number | Alias): Promise<any> {
        return Promise.all([
            this.setAlias(alias),
            this.setNeo4j(alias, "Alias")
        ]);
    }

    // deprecated
    public setBlogPostWithNeo4j(blogPost: number | BlogPost): Promise<any> {
        return Promise.all([
            this.setBlogPost(blogPost),
            this.setNeo4j(blogPost, "BlogPost")
        ]);
    }

    // deprecated
    public setParentCommentWithNeo4j(comment: number | Comment): Promise<any> {
        // console.log("Setting parentcomment");
        return Promise.all([
            this.setParentComment(comment),
            this.setNeo4j(comment, "Parent_Comment", "Comment")
        ]);
    }
}

Comment.init(
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
        }
    },
    {
        sequelize,
        modelName: "Comment"
    }
);

export { Comment };
