"use strict";

module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.addColumn("Users", "suspended", {
                type: Sequelize.DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            }),
            queryInterface.addColumn("Users", "suspendedAt", {
                type: Sequelize.DataTypes.DATE,
                allowNull: true
            })
        ]);
    },

    down: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.removeColumn("Users", "suspended"),
            queryInterface.removeColumn("Users", "suspendedAt")
        ]);
    }
};
