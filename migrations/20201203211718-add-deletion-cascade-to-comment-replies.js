"use strict";

module.exports = {
    up: (queryInterface, Sequelize) =>
        queryInterface.sequelize.transaction(transaction =>
            Promise.all([
                queryInterface.sequelize.query(
                    'DELETE FROM "Comments" WHERE "BlogPostId" IS NULL AND "parentCommentId" IS NULL',
                    { transaction }
                ),
                queryInterface.sequelize.query(
                    'ALTER TABLE "Comments" DROP CONSTRAINT IF EXISTS "Comments_parentCommentId_fkey"; ALTER TABLE "Comments" ADD CONSTRAINT "Comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "Comments" ("id") ON DELETE CASCADE ON UPDATE CASCADE',
                    { transaction }
                )
            ])
        ),

    down: (queryInterface, Sequelize) =>
        queryInterface.sequelize.query(
            'ALTER TABLE "Comments" DROP CONSTRAINT IF EXISTS "Comments_parentCommentId_fkey"; ALTER TABLE "Comments" ADD CONSTRAINT "Comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "Comments" ("id") ON DELETE SET NULL ON UPDATE CASCADE'
        )
};
