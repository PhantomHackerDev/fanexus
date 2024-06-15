"use strict";

module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all(
            [
                queryInterface.addColumn("Users", "tagWrangler", {
                    type: Sequelize.DataTypes.BOOLEAN,
                    allowNull: true,
                    defaultValue: false
                })
            ],
            queryInterface.addColumn("Users", "superTagWrangler", {
                type: Sequelize.DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: false
            })
        );
    },

    down: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.removeColumn("Users", "tagWrangler"),
            queryInterface.removeColumn("Users", "superTagWrangler")
        ]);
    }
};
