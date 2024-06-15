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
import { database as sequelize, tagMax } from "../services/databaseService.js";
import { Tag } from "./Tag";

import { Blog } from "./Blog";

@Table
class Blog_Tag extends Model {
    public static FOLLOW_TYPES = {
        block: 0,
        follow: 1
    } as const;
    @ForeignKey(() => Tag) @PrimaryKey @Column public TagId: string;
    @ForeignKey(() => Blog) @PrimaryKey @Column public BlogId: string;

    @Column public displaySynonym!: Date;
    @Column @CreatedAt public readonly createdAt!: Date;
    @Column @UpdatedAt public updatedAt!: Date;

    public static associations: {
        Tag: Association<Tag, Blog_Tag>;
        BlogPost: Association<Blog, Blog_Tag>;
    };
}

Blog_Tag.init(
    {
        TagId: {
            type: DataTypes.INTEGER,
            primaryKey: true
        },
        BlogId: {
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
        modelName: "Blog_Tag",
        freezeTableName: true
    }
);

export { Blog_Tag };
