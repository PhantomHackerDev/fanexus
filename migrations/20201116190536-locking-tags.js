"use strict";

module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.addColumn("Tags", "isLocked", {
                type: Sequelize.DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: false
            })
        ]);
    },

    down: (queryInterface, Sequelize) => {
        return Promise.all([queryInterface.removeColumn("Tags", "isLocked")]);
    }
};
