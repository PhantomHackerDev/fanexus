"use strict";

module.exports = {
    up: (queryInterface, Sequelize) =>
        queryInterface.changeColumn("Tags", "synonyms", {
            type: Sequelize.DataTypes.ARRAY(Sequelize.DataTypes.TEXT),
            defaultValue: []
        }),

    down: (queryInterface, Sequelize) =>
        queryInterface.changeColumn("Tags", "synonyms", {
            type: Sequelize.DataTypes.ARRAY(Sequelize.DataTypes.String),
            defaultValue: []
        })
};
