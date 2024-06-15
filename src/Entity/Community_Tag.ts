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
import { Community } from "./Community";

@Table
class Community_Tag extends Model {
    public static FOLLOW_TYPES = {
        block: 0,
        follow: 1
    } as const;
    @ForeignKey(() => Tag) @PrimaryKey @Column public TagId: string;
    @ForeignKey(() => Community) @PrimaryKey @Column public CommunityId: string;

    @Column public displaySynonym!: Date;
    @Column @CreatedAt public readonly createdAt!: Date;
    @Column @UpdatedAt public updatedAt!: Date;

    public static associations: {
        Tag: Association<Tag, Community_Tag>;
        Community: Association<Community, Community_Tag>;
    };
}

Community_Tag.init(
    {
        TagId: {
            type: DataTypes.INTEGER,
            primaryKey: true
        },
        CommunityId: {
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
        modelName: "Community_Tag",
        freezeTableName: true
    }
);

export { Community_Tag };
