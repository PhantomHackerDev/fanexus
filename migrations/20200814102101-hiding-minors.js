"use strict";

module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.addColumn("Aliases", "showMinors", {
                type: Sequelize.DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: true
            })
        ]);
    },

    down: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.removeColumn("Aliases", "showMinors")
        ]);
    }
};
