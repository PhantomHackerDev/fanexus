"use strict";

module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.addColumn("Blogs", "hideFromSearchResults", {
                type: Sequelize.DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: false
            }),
            queryInterface.addColumn("BlogPosts", "hideFromSearchResults", {
                type: Sequelize.DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: false
            })
        ]);
    },

    down: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.removeColumn("Blogs", "hideFromSearchResults"),
            queryInterface.removeColumn("BlogPosts", "hideFromSearchResults")
        ]);
    }
};
