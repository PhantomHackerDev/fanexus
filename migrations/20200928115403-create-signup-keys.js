"use strict";

module.exports = {
    up: (queryInterface, Sequelize) =>
        queryInterface.sequelize.transaction(t =>
            queryInterface.createTable("SignupKeys", {
                id: {
                    type: Sequelize.DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                email: {
                    type: Sequelize.DataTypes.TEXT,
                    allowNull: false
                },
                key: {
                    type: Sequelize.DataTypes.TEXT,
                    allowNull: false
                },
                createdAt: Sequelize.DataTypes.DATE,
                updatedAt: Sequelize.DataTypes.DATE
            })
        ),

    down: (queryInterface, Sequelize) => queryInterface.dropTable("SignupKeys")
};
