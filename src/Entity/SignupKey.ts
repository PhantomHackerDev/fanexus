import { Model } from "sequelize-typescript";
import { DataTypes } from "sequelize";
import { database as sequelize } from "../services/databaseService.js";

export class SignupKey extends Model {
    public key: string;
}

SignupKey.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        email: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        key: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    },
    {
        sequelize,
        modelName: "SignupKey"
    }
);
