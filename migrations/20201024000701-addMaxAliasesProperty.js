"use strict";

module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.addColumn("Users", "maxAllowedAliases", {
                type: Sequelize.DataTypes.INTEGER,
                allowNull: true,
                defaultValue: 3
            })
        ]).then(
            queryInterface.sequelize.query(
                'UPDATE "Users" SET "maxAllowedAliases"=3',
                {
                    type: Sequelize.QueryTypes.UPDATE
                }
            )
        );
    },

    down: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.removeColumn("Users", "maxAllowedAliases")
        ]);
    }
};
