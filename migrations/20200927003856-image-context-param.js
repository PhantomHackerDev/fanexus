"use strict";

module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.addColumn("Images", "context", {
                type: Sequelize.DataTypes.STRING,
                allowNull: true
            })
        ]);
    },

    down: (queryInterface, Sequelize) => {
        return Promise.all([queryInterface.removeColumn("Images", "context")]);
    }
};
