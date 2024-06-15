"use strict";

module.exports = {
    up: (queryInterface, Sequelize) =>
        queryInterface.createTable("ModerationActions", {
            id: {
                type: Sequelize.DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            AliasId: {
                type: Sequelize.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "Aliases",
                    key: "id"
                }
            },
            reason: {
                type: Sequelize.DataTypes.TEXT,
                allowNull: true
            },
            details: {
                type: Sequelize.DataTypes.JSON,
                allowNull: false
            },
            createdAt: Sequelize.DataTypes.DATE,
            updatedAt: Sequelize.DataTypes.DATE
        }),

    down: (queryInterface, Sequelize) =>
        queryInterface.dropTable("ModerationActions")
};
