"use strict";

module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.addColumn("Communities", "hideFromSearchResults", {
                type: Sequelize.DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: false
            }),
            queryInterface.addColumn("Communities", "showMinors", {
                type: Sequelize.DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: false
            })
        ]);
    },

    down: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.removeColumn("Communities", "hideFromSearchResults"),
            queryInterface.removeColumn("Communities", "showMinors")
        ]);
    }
};
