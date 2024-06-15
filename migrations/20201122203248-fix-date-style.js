"use strict";

module.exports = {
    up: (queryInterface, Sequelize) =>
        queryInterface.sequelize.query(`SET DateStyle TO 'ISO, DMY'`),

    down: (queryInterface, Sequelize) =>
        queryInterface.sequelize.query(`SET DateStyle TO 'ISO, MDY'`)
};
