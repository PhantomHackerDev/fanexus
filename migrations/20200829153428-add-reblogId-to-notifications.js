"use strict";

module.exports = {
    up: (queryInterface, Sequelize) =>
        queryInterface.addColumn("Notifications", "sourceReblogId", {
            type: Sequelize.DataTypes.INTEGER
        }),

    down: (queryInterface, Sequelize) =>
        queryInterface.removeColumn("Notifications", "sourceReblogId")
};
