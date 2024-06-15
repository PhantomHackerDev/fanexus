"use strict";

module.exports = {
    up: (queryInterface, Sequelize) =>
        queryInterface.sequelize.transaction(transaction =>
            Promise.all([
                queryInterface.sequelize.query(
                    'DELETE FROM "Reactions" WHERE "BlogPostId" IS NULL AND "CommentId" IS NULL',
                    { transaction }
                ),
                queryInterface.sequelize.query(
                    'ALTER TABLE "Reactions" DROP CONSTRAINT IF EXISTS "Reactions_BlogPostId_fkey"; ALTER TABLE "Reactions" ADD CONSTRAINT "Reactions_BlogPostId_fkey" FOREIGN KEY ("BlogPostId") REFERENCES "BlogPosts" ("id") ON DELETE CASCADE ON UPDATE CASCADE',
                    { transaction }
                ),
                queryInterface.sequelize.query(
                    'ALTER TABLE "Reactions" DROP CONSTRAINT IF EXISTS "Reactions_CommentId_fkey"; ALTER TABLE "Reactions" ADD CONSTRAINT "Reactions_CommentId_fkey" FOREIGN KEY ("CommentId") REFERENCES "Comments" ("id") ON DELETE CASCADE ON UPDATE CASCADE',
                    { transaction }
                )
            ])
        ),

    down: (queryInterface, Sequelize) =>
        queryInterface.sequelize.transaction(transaction =>
            Promise.all([
                queryInterface.sequelize.query(
                    'ALTER TABLE "Reactions" DROP CONSTRAINT IF EXISTS "Reactions_BlogPostId_fkey"; ALTER TABLE "Reactions" ADD CONSTRAINT "Reactions_BlogPostId_fkey" FOREIGN KEY ("BlogPostId") REFERENCES "BlogPosts" ("id") ON DELETE SET NULL ON UPDATE CASCADE',
                    { transaction }
                ),
                queryInterface.sequelize.query(
                    'ALTER TABLE "Reactions" DROP CONSTRAINT IF EXISTS "Reactions_CommentId_fkey"; ALTER TABLE "Reactions" ADD CONSTRAINT "Reactions_CommentId_fkey" FOREIGN KEY ("CommentId") REFERENCES "Comments" ("id") ON DELETE SET NULL ON UPDATE CASCADE',
                    { transaction }
                )
            ])
        )
};
