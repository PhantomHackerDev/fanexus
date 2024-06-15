"use strict";

module.exports = {
    up: (queryInterface, Sequelize) =>
        queryInterface.sequelize.transaction(t =>
            Promise.all([
                queryInterface.addColumn(
                    "Notifications",
                    "type",
                    {
                        type: Sequelize.DataTypes.TEXT
                    },
                    { transaction: t }
                ),
                queryInterface.addColumn(
                    "Notifications",
                    "targetBlogPostId",
                    {
                        type: Sequelize.DataTypes.INTEGER
                    },
                    { transaction: t }
                ),
                queryInterface.addColumn(
                    "Notifications",
                    "targetCommentId",
                    {
                        type: Sequelize.DataTypes.INTEGER
                    },
                    { transaction: t }
                ),
                queryInterface.addColumn(
                    "Notifications",
                    "targetCommunityId",
                    {
                        type: Sequelize.DataTypes.INTEGER
                    },
                    { transaction: t }
                ),
                queryInterface.addColumn(
                    "Notifications",
                    "sourceCommentId",
                    {
                        type: Sequelize.DataTypes.INTEGER
                    },
                    { transaction: t }
                )
            ])
                .then(() =>
                    queryInterface.sequelize.query(
                        `ALTER TABLE "Notifications" ADD CONSTRAINT "hasTarget" CHECK
          (
            COALESCE("targetBlogPostId", "targetCommentId", "targetCommunityId") IS NOT NULL OR "type"='follow'
          )`,
                        { transaction: t }
                    )
                )
                .then(() =>
                    queryInterface.sequelize.query(
                        `UPDATE "Notifications"
          SET
          "type"="origin"->>'type',
          "targetBlogPostId"=
          CASE WHEN
          "origin"->>'type'='reblog' OR
          (
            ("origin"->>'type'='comment' OR "origin"->>'type'='like') AND "origin"->'target'->>'entity'='blogPost'
          )
          THEN CAST("origin"->'target'->>'id' AS INTEGER) END,
          "targetCommentId"=
          CASE WHEN
          ("origin"->>'type'='comment' OR "origin"->>'type'='like') AND
          "origin"->'target'->>'entity'='comment'
          THEN CAST("origin"->'target'->>'id' AS INTEGER) END,
          "targetCommunityId"=
          CASE WHEN
          "origin"->>'type'='invite'
          THEN CAST("origin"->'target'->>'id' AS INTEGER) END`,
                        { transaction: t }
                    )
                )
                .then(() =>
                    Promise.all([
                        queryInterface.removeColumn("Notifications", "origin", {
                            transaction: t
                        }),
                        queryInterface.removeColumn(
                            "Notifications",
                            "description",
                            { transaction: t }
                        )
                    ])
                )
        ),

    down: (queryInterface, Sequelize) =>
        queryInterface.sequelize.transaction(t =>
            Promise.all([
                queryInterface.addColumn(
                    "Notifications",
                    "origin",
                    {
                        type: Sequelize.DataTypes.JSON
                    },
                    { transaction: t }
                ),
                queryInterface.addColumn(
                    "Notifications",
                    "description",
                    {
                        type: Sequelize.DataTypes.JSON
                    },
                    { transaction: t }
                )
            ])
                .then(() =>
                    queryInterface.sequelize.query(
                        `UPDATE "Notifications"
          SET
          "origin"= jsonb_build_object('type', "type", 'target',
            jsonb_build_object('entity', CASE WHEN
              ("type"='comment' OR "type"='like') THEN
              CASE WHEN "targetBlogPostId" IS NOT NULL
              THEN 'blogpost'
              ELSE 'comment'
              END
              END,
              'id', COALESCE("targetBlogPostId", "targetCommentId", "targetCommunityId"))
          )`,
                        { transaction: t }
                    )
                )
                .then(() =>
                    Promise.all([
                        queryInterface.removeColumn("Notifications", "type", {
                            transaction: t
                        }),
                        queryInterface.removeColumn(
                            "Notifications",
                            "targetBlogPostId",
                            { transaction: t }
                        ),
                        queryInterface.removeColumn(
                            "Notifications",
                            "targetCommentId",
                            { transaction: t }
                        ),
                        queryInterface.removeColumn(
                            "Notifications",
                            "targetCommunityId",
                            { transaction: t }
                        ),
                        queryInterface.removeColumn(
                            "Notifications",
                            "sourceCommentId",
                            { transaction: t }
                        )
                    ])
                )
        )
};
