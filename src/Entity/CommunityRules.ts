import {
    BelongsTo,
    Column,
    CreatedAt,
    Model,
    PrimaryKey,
    Table,
    UpdatedAt
} from "sequelize-typescript";
import {
    database as sequelize,
    textAreaMax
} from "../services/databaseService.js";
import { Association, DataTypes } from "sequelize";
import { Community } from "./Community";

@Table
class CommunityRules extends Model {
    @PrimaryKey @Column public id!: number;
    @Column public name!: string;
    @Column public description: string;

    @BelongsTo(() => Community)
    public community: Community;

    @Column @CreatedAt public readonly createdAt!: Date;
    @Column @UpdatedAt public readonly updatedAt!: Date;

    public static associations: {
        communityRules: Association<CommunityRules, Community>;
    };
}

CommunityRules.init(
    {
        name: {
            allowNull: false,
            type: DataTypes.TEXT
        },
        description: {
            allowNull: false,
            type: DataTypes.TEXT,
            validate: {
                isByteLength: {
                    max: textAreaMax,
                    msg: `Description must be of length within ${textAreaMax}`
                }
            }
        }
    },
    {
        sequelize,
        modelName: "CommunityRules"
    }
);

export { CommunityRules };
