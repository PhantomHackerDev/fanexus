import {
    BelongsTo,
    Model,
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    PrimaryKey,
    ForeignKey,
    DataType
} from "sequelize-typescript";
import {
    Association,
    DataTypes,
    BelongsToGetAssociationMixin,
    BelongsToSetAssociationMixin
} from "sequelize";
import { database as sequelize } from "../services/databaseService.js";
import { Alias } from "./Alias";
import { Comment } from "./Comment";
import { BlogPost } from "./BlogPost";

type ValueOf<T> = T[keyof T];

@Table
class Reaction extends Model {
    public static REACTION_TYPE = {
        like: 1
    } as const;

    @PrimaryKey @Column public id!: number;
    @Column public content!: string;
    @Column(DataType.NUMBER) public type!: ValueOf<
        typeof Reaction.REACTION_TYPE
    >;

    @ForeignKey(() => Alias) @Column public AliasId: number;
    public getAlias!: BelongsToGetAssociationMixin<Alias>;
    public setAlias!: BelongsToSetAssociationMixin<Alias, number>;

    @Column @CreatedAt public readonly createdAt!: Date;
    @Column @UpdatedAt public readonly updatedAt!: Date;

    @BelongsTo(() => BlogPost) public BlogPost: BlogPost;
    @ForeignKey(() => BlogPost) @Column public BlogPostId: number;
    public getBlogPost!: BelongsToGetAssociationMixin<BlogPost>;
    public setBlogPost!: BelongsToSetAssociationMixin<
        BlogPost,
        number | string
    >;

    public reblogRootId: number;

    @BelongsTo(() => Comment) public Comment: Comment;
    @ForeignKey(() => Comment) @Column public CommentId: number;
    public getComment!: BelongsToGetAssociationMixin<Comment>;
    public setComment!: BelongsToSetAssociationMixin<Comment, number | string>;

    public static associations: {
        alias: Association<Reaction, Alias>;
        blogPost: Association<Reaction, BlogPost>;
        comment: Association<Reaction, Comment>;
    };

    public get likedEntity(): "blogPost" | "comment" {
        if (this.BlogPostId) {
            return "blogPost";
        } else {
            return "comment";
        }
    }

    public get likedId(): number {
        return this.BlogPostId || this.CommentId;
    }

    // deprecated
    public destroyWithNeo4j(): Promise<void> {
        return Promise.all([this.destroy()]).then(() => {
            return undefined;
        });
    }
}

Reaction.init(
    {
        type: {
            allowNull: false,
            type: DataTypes.SMALLINT
        }
    },
    {
        sequelize,
        modelName: "Reaction"
    }
);

export { Reaction };
