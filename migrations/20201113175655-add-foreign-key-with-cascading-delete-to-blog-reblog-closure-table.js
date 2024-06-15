"use strict";

module.exports = {
    up: (queryInterface, Sequelize) =>
        queryInterface.sequelize.transaction(transaction =>
            queryInterface.sequelize
                .query(
                    'DELETE FROM "BlogPost_Reblog" WHERE NOT EXISTS (SELECT 1 FROM "BlogPosts" WHERE "BlogPosts"."id"="BlogPost_Reblog"."BlogPostId") OR NOT EXISTS (SELECT 1 FROM "BlogPosts" WHERE "BlogPosts"."id"="BlogPost_Reblog"."ReblogId")',
                    { transaction }
                )
                .then(() =>
                    Promise.all([
                        queryInterface.sequelize.query(
                            'ALTER TABLE "BlogPost_Reblog" ADD CONSTRAINT "BlogPost_Reblog_BlogPost_fkey" FOREIGN KEY ("BlogPostId") REFERENCES "BlogPosts" (id) ON DELETE CASCADE',
                            { transaction }
                        ),
                        queryInterface.sequelize.query(
                            'ALTER TABLE "BlogPost_Reblog" ADD CONSTRAINT "BlogPost_Reblog_Reblog_fkey" FOREIGN KEY ("ReblogId") REFERENCES "BlogPosts" (id) ON DELETE CASCADE',
                            { transaction }
                        )
                    ])
                )
        ),

    down: (queryInterface, Sequelize) =>
        queryInterface.sequelize.transaction(transaction =>
            Promise.all([
                queryInterface.sequelize.query(
                    'ALTER TABLE "BlogPost_Reblog" DROP CONSTRAINT "BlogPost_Reblog_BlogPost_fkey"',
                    { transaction }
                ),
                queryInterface.sequelize.query(
                    'ALTER TABLE "BlogPost_Reblog" DROP CONSTRAINT "BlogPost_Reblog_Reblog_fkey"',
                    { transaction }
                )
            ])
        )
};
