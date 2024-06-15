import { Model } from "sequelize-typescript";
import { DataTypes } from "sequelize";
import { database as sequelize } from "../services/databaseService.js";

export class ModerationAction extends Model {}

ModerationAction.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        AliasId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        details: {
            type: DataTypes.JSON,
            allowNull: false
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    },
    {
        sequelize,
        modelName: "ModerationAction"
    }
);
