"use strict";

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable("CommunityInvites", {
            id: {
                type: Sequelize.DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            CommunityId: {
                type: Sequelize.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "Communities",
                    key: "id"
                }
            },
            inviterId: {
                type: Sequelize.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "Aliases",
                    key: "id"
                }
            },
            invitedId: {
                type: Sequelize.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "Aliases",
                    key: "id"
                }
            },
            createdAt: Sequelize.DataTypes.DATE,
            updatedAt: Sequelize.DataTypes.DATE
        });
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.dropTable("CommunityInvites");
    }
};
