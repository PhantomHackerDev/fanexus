"use strict";

module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.addColumn(
                "AccessControlGroup_Alias",
                "isDirectMember",
                { type: Sequelize.DataTypes.BOOLEAN }
            ),
            queryInterface.addColumn(
                "AccessControlGroup_User",
                "isDirectMember",
                { type: Sequelize.DataTypes.BOOLEAN }
            ),
            queryInterface.createTable("ACG_has_ACG", {
                id: {
                    type: Sequelize.DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                AccessControlGroupId: {
                    type: Sequelize.DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: "AccessControlGroups",
                        key: "id"
                    }
                },
                containsAccessControlGroupId: {
                    type: Sequelize.DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: "AccessControlGroups",
                        key: "id"
                    }
                },
                createdAt: Sequelize.DataTypes.DATE,
                updatedAt: Sequelize.DataTypes.DATE
            }),
            queryInterface.createTable("ACG_blngsT_ACG", {
                id: {
                    type: Sequelize.DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                AccessControlGroupId: {
                    type: Sequelize.DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: "AccessControlGroups",
                        key: "id"
                    }
                },
                belongsToAccessControlGroupId: {
                    type: Sequelize.DataTypes.INTEGER,
                    allowNull: false,
                    references: {
                        model: "AccessControlGroups",
                        key: "id"
                    }
                },
                createdAt: Sequelize.DataTypes.DATE,
                updatedAt: Sequelize.DataTypes.DATE
            })
        ]);
    },

    down: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.dropTable("ACG_blngsT_ACG"),
            queryInterface.dropTable("ACG_has_ACG"),
            queryInterface.removeColumn(
                "AccessControlGroup_Alias",
                "isDirectMember"
            ),
            queryInterface.removeColumn(
                "AccessControlGroup_User",
                "isDirectMember"
            )
        ]);
    }
};
