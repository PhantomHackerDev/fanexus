'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn("Users", "emailChangeRequested", {
        type: Sequelize.DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
      }),
      queryInterface.addColumn("Users", "emailChangeKey", {
        type: Sequelize.DataTypes.TEXT,
        allowNull: true
      })
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return Promise.all([
        queryInterface.removeColumn("Users", "emailChangeRequested"),
        queryInterface.removeColumn("Users", "emailChangeKey")
    ]);
  }
};
