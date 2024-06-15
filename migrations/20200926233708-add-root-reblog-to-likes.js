"use strict";

const getRootReblog = (blogPostId, queryInterface, Sequelize, transaction) =>
    queryInterface.sequelize
        .query(
            `SELECT * FROM "BlogPost_Reblog"
    WHERE "BlogPost_Reblog"."BlogPostId"=:blogPostId`,
            {
                type: Sequelize.QueryTypes.SELECT,
                replacements: {
                    blogPostId
                },
                transaction
            }
        )
        .then(reblogs =>
            Math.min(...reblogs.map(({ ReblogId }) => ReblogId), blogPostId)
        );

module.exports = {
    up: (queryInterface, Sequelize) =>
        queryInterface.sequelize.transaction(t =>
            queryInterface
                .addColumn(
                    "Reactions",
                    "reblogRootId",
                    {
                        type: Sequelize.DataTypes.INTEGER
                    },
                    { transaction: t }
                )
                .then(() =>
                    queryInterface.sequelize
                        .query(
                            `SELECT * FROM "Reactions" WHERE "Reactions"."type"=1
          AND "Reactions"."BlogPostId" IS NOT NULL`,
                            {
                                type: Sequelize.QueryTypes.SELECT,
                                transaction: t
                            }
                        )
                        .then(reactions =>
                            Promise.all(
                                reactions.map(reaction =>
                                    getRootReblog(
                                        reaction.BlogPostId,
                                        queryInterface,
                                        Sequelize,
                                        t
                                    ).then(reblogRootId =>
                                        queryInterface.sequelize.query(
                                            `UPDATE "Reactions" SET "reblogRootId"=:reblogRootId
                WHERE "id"=:id`,
                                            {
                                                type:
                                                    Sequelize.QueryTypes.SELECT,
                                                replacements: {
                                                    id: reaction.id,
                                                    reblogRootId
                                                },
                                                transaction: t
                                            }
                                        )
                                    )
                                )
                            )
                        )
                )
        ),

    down: (queryInterface, Sequelize) =>
        queryInterface.removeColumn("Reactions", "reblogRootId")
};
