"use strict";

module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.addColumn("BlogPost_Tag", "displaySynonym", {
                type: Sequelize.DataTypes.TEXT
            }),
            queryInterface.addColumn("Blog_Tag", "displaySynonym", {
                type: Sequelize.DataTypes.TEXT
            }),
            queryInterface.addColumn("Community_Tag", "displaySynonym", {
                type: Sequelize.DataTypes.TEXT
            })
        ]);
    },

    down: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.removeColumn("BlogPost_Tag", "displaySynonym"),
            queryInterface.removeColumn("Blog_Tag", "displaySynonym"),
            queryInterface.removeColumn("Community_Tag", "displaySynonym")
        ]);
    }
};
