"use strict";

module.exports = {
    up: (queryInterface, Sequelize) =>
        queryInterface.addColumn("Communities", "requireApproval", {
            type: Sequelize.DataTypes.BOOLEAN
        }),

    down: (queryInterface, Sequelize) =>
        queryInterface.removeColumn("Communities", "requireApproval")
};
