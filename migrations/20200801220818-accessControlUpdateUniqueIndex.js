"use strict";

module.exports = {
    //CREATE UNIQUE INDEX "AccessControlGroup_Alias_pkey" ON "AccessControlGroup_Alias" USING btree ("AliasId", "AccessControlGroupId", "isDirectMember");
    up: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.query(`
    UPDATE "AccessControlGroup_Alias" SET "isDirectMember" = true;
    ALTER TABLE "AccessControlGroup_Alias" ALTER COLUMN "isDirectMember" TYPE bool;
    ALTER TABLE "AccessControlGroup_Alias" ALTER COLUMN "isDirectMember" SET NOT NULL;
    ALTER TABLE "AccessControlGroup_Alias" DROP CONSTRAINT "AccessControlGroup_Alias_pkey";
    ALTER TABLE "AccessControlGroup_Alias" ADD CONSTRAINT "AccessControlGroup_Alias_pkey" PRIMARY KEY ("AliasId", "AccessControlGroupId", "isDirectMember");
    `);
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.query(`
    ALTER TABLE "AccessControlGroup_Alias" DROP CONSTRAINT "AccessControlGroup_Alias_pkey";
    ALTER TABLE "AccessControlGroup_Alias" ALTER COLUMN "isDirectMember" DROP NOT NULL;
    ALTER TABLE "AccessControlGroup_Alias" ADD CONSTRAINT "AccessControlGroup_Alias_pkey" PRIMARY KEY ("AliasId", "AccessControlGroupId");
    `);
    }
};
