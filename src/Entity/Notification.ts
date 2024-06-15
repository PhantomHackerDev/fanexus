import {
    Model,
    Table,
    Column,
    PrimaryKey,
    ForeignKey,
    CreatedAt,
    UpdatedAt,
    BelongsTo
} from "sequelize-typescript";
import { DataTypes } from "sequelize";
import { Alias } from "./Alias";
import { database as sequelize } from "../services/databaseService.js";

@Table
class Notification extends Model {
    @PrimaryKey @Column public id: string;

    @ForeignKey(() => Alias) @Column public targetAliasId: number;
    @BelongsTo(() => Alias) public targetAlias: Alias;
    @ForeignKey(() => Alias) @Column public sourceAliasId: number;
    @BelongsTo(() => Alias) public sourceAlias: Alias;

    @Column public isSeen: boolean;

    public targetBlogPostId: number;
    public targetCommentId: number;
    public targetCommunityId: number;

    public type: string;

    @Column @CreatedAt public readonly createdAt!: Date;
    @Column @UpdatedAt public readonly updatedAt!: Date;

    public static associations: {};
}

Notification.init(
    {
        isSeen: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        type: {
            type: DataTypes.TEXT,
            allowNull: false
        }
    },
    {
        sequelize,
        modelName: "Notification"
    }
);

export { Notification };
