import {
    Model,
    Table,
    Column,
    PrimaryKey,
    ForeignKey,
    CreatedAt,
    UpdatedAt
} from "sequelize-typescript";
import { Association, DataTypes } from "sequelize";
import { database as sequelize, tagMax } from "@services/databaseService.js";
import { Tag } from "./Tag";
import { BlogPost } from "./BlogPost";

@Table
class BlogPost_Tag extends Model {
    public static FOLLOW_TYPES = {
        block: 0,
        follow: 1
    } as const;
    @ForeignKey(() => Tag) @PrimaryKey @Column public TagId: string;
    @ForeignKey(() => BlogPost) @PrimaryKey @Column public BlogPostId: string;

    @Column public displaySynonym!: Date;
    @Column @CreatedAt public readonly createdAt!: Date;
    @Column @UpdatedAt public updatedAt!: Date;

    public static associations: {
        Tag: Association<Tag, BlogPost_Tag>;
        BlogPost: Association<BlogPost, BlogPost_Tag>;
    };
}

BlogPost_Tag.init(
    {
        TagId: {
            type: DataTypes.INTEGER,
            primaryKey: true
        },
        BlogPostId: {
            type: DataTypes.INTEGER,
            primaryKey: true
        },
        displaySynonym: {
            type: DataTypes.TEXT,
            validate: {
                isByteLength: {
                    max: tagMax,
                    msg: `Display synonym must be of length within ${tagMax}`
                }
            }
        }
    },
    {
        sequelize,
        modelName: "BlogPost_Tag",
        freezeTableName: true
    }
);

export { BlogPost_Tag };
