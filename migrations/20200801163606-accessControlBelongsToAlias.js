"use strict";

module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.addColumn(
                "AccessControlGroups",
                "belongsToAliasId",
                {
                    type: Sequelize.DataTypes.INTEGER,
                    allowNull: true,
                    references: { model: "Aliases", key: "id" }
                }
            ),
            queryInterface.addColumn("AccessControlGroups", "name", {
                type: Sequelize.DataTypes.STRING,
                allowNull: true
            }),
            queryInterface.addColumn("AccessControlGroups", "isDefault", {
                type: Sequelize.DataTypes.BOOLEAN,
                defaultValue: false
            })
        ]);
    },

    down: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.removeColumn(
                "AccessControlGroups",
                "belongsToAliasId"
            ),
            queryInterface.removeColumn("AccessControlGroups", "name"),
            queryInterface.removeColumn("AccessControlGroups", "isDefault")
        ]);
    }
};
