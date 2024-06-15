"use strict";

module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.createTable("BP_view_ACG", {
                BlogPostId: {
                    type: Sequelize.DataTypes.INTEGER,
                    primaryKey: true,
                    references: {
                        model: "BlogPosts",
                        key: "id"
                    }
                },
                AccessControlGroupId: {
                    type: Sequelize.DataTypes.INTEGER,
                    primaryKey: true,
                    references: {
                        model: "AccessControlGroups",
                        key: "id"
                    }
                },
                createdAt: Sequelize.DataTypes.DATE,
                updatedAt: Sequelize.DataTypes.DATE
            }),
            queryInterface.createTable("BP_comment_ACG", {
                BlogPostId: {
                    type: Sequelize.DataTypes.INTEGER,
                    primaryKey: true,
                    references: {
                        model: "BlogPosts",
                        key: "id"
                    }
                },
                AccessControlGroupId: {
                    type: Sequelize.DataTypes.INTEGER,
                    primaryKey: true,
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
            queryInterface.dropTable("BP_view_ACG"),
            queryInterface.dropTable("BP_comment_ACG")
        ]);
    }
};
