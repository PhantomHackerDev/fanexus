"use strict";

module.exports = {
    up: (queryInterface, Sequelize) =>
        queryInterface.sequelize.transaction(transaction =>
            Promise.all([
                queryInterface.sequelize.query(
                    'ALTER TABLE "BP_comment_ACG" DROP CONSTRAINT "BP_comment_ACG_AccessControlGroupId_fkey"',
                    { transaction }
                ),
                queryInterface.sequelize.query(
                    'ALTER TABLE "BP_comment_ACG" DROP CONSTRAINT "BP_comment_ACG_BlogPostId_fkey"',
                    { transaction }
                ),
                queryInterface.sequelize.query(
                    'ALTER TABLE "BP_view_ACG" DROP CONSTRAINT "BP_view_ACG_AccessControlGroupId_fkey"',
                    { transaction }
                ),
                queryInterface.sequelize.query(
                    'ALTER TABLE "BP_view_ACG" DROP CONSTRAINT "BP_view_ACG_BlogPostId_fkey"',
                    { transaction }
                )
            ]).then(() =>
                Promise.all([
                    queryInterface.sequelize.query(
                        'ALTER TABLE "BP_comment_ACG" ADD CONSTRAINT "BP_comment_ACG_AccessControlGroupId_fkey" FOREIGN KEY ("AccessControlGroupId") REFERENCES "AccessControlGroups" (id) ON DELETE CASCADE',
                        { transaction }
                    ),
                    queryInterface.sequelize.query(
                        'ALTER TABLE "BP_comment_ACG" ADD CONSTRAINT "BP_comment_ACG_BlogPostId_fkey" FOREIGN KEY ("BlogPostId") REFERENCES "BlogPosts" (id) ON DELETE CASCADE',
                        { transaction }
                    ),
                    queryInterface.sequelize.query(
                        'ALTER TABLE "BP_view_ACG" ADD CONSTRAINT "BP_view_ACG_AccessControlGroupId_fkey" FOREIGN KEY ("AccessControlGroupId") REFERENCES "AccessControlGroups" (id) ON DELETE CASCADE',
                        { transaction }
                    ),
                    queryInterface.sequelize.query(
                        'ALTER TABLE "BP_view_ACG" ADD CONSTRAINT "BP_view_ACG_BlogPostId_fkey" FOREIGN KEY ("BlogPostId") REFERENCES "BlogPosts" (id) ON DELETE CASCADE',
                        { transaction }
                    )
                ])
            )
        ),

    down: (queryInterface, Sequelize) =>
        queryInterface.sequelize.transaction(transaction =>
            Promise.all([
                queryInterface.sequelize.query(
                    'ALTER TABLE "BP_comment_ACG" DROP CONSTRAINT "BP_comment_ACG_AccessControlGroupId_fkey"',
                    { transaction }
                ),
                queryInterface.sequelize.query(
                    'ALTER TABLE "BP_comment_ACG" DROP CONSTRAINT "BP_comment_ACG_BlogPostId_fkey"',
                    { transaction }
                ),
                queryInterface.sequelize.query(
                    'ALTER TABLE "BP_view_ACG" DROP CONSTRAINT "BP_view_ACG_AccessControlGroupId_fkey"',
                    { transaction }
                ),
                queryInterface.sequelize.query(
                    'ALTER TABLE "BP_view_ACG" DROP CONSTRAINT "BP_view_ACG_BlogPostId_fkey"',
                    { transaction }
                )
            ]).then(() =>
                Promise.all([
                    queryInterface.sequelize.query(
                        'ALTER TABLE "BP_comment_ACG" ADD CONSTRAINT "BP_comment_ACG_AccessControlGroupId_fkey" FOREIGN KEY ("AccessControlGroupId") REFERENCES "AccessControlGroups" (id)',
                        { transaction }
                    ),
                    queryInterface.sequelize.query(
                        'ALTER TABLE "BP_comment_ACG" ADD CONSTRAINT "BP_comment_ACG_BlogPostId_fkey" FOREIGN KEY ("BlogPostId") REFERENCES "BlogPosts" (id)',
                        { transaction }
                    ),
                    queryInterface.sequelize.query(
                        'ALTER TABLE "BP_view_ACG" ADD CONSTRAINT "BP_view_ACG_AccessControlGroupId_fkey" FOREIGN KEY ("AccessControlGroupId") REFERENCES "AccessControlGroups" (id)',
                        { transaction }
                    ),
                    queryInterface.sequelize.query(
                        'ALTER TABLE "BP_view_ACG" ADD CONSTRAINT "BP_view_ACG_BlogPostId_fkey" FOREIGN KEY ("BlogPostId") REFERENCES "BlogPosts" (id)',
                        { transaction }
                    )
                ])
            )
        )
};
