"use strict";

const reblogChain = (blogPost, queryInterface, Sequelize, transaction) => {
    if (blogPost && blogPost.reblogOfBlogPostId) {
        return queryInterface.sequelize
            .query('SELECT * FROM "BlogPosts" WHERE "id"=:id', {
                replacements: { id: blogPost.reblogOfBlogPostId },
                type: Sequelize.QueryTypes.SELECT,
                transaction
            })
            .then(([reblog]) =>
                reblogChain(
                    reblog,
                    queryInterface,
                    Sequelize,
                    transaction
                ).then(reblogChainResult =>
                    reblogChainResult.concat(
                        reblog.content.trim().length ||
                            !reblogChainResult.length
                            ? reblog.id
                            : []
                    )
                )
            );
    } else {
        return Promise.resolve([]);
    }
};

module.exports = {
    up: (queryInterface, Sequelize) =>
        queryInterface.sequelize.transaction(t =>
            queryInterface
                .createTable(
                    "BlogPost_Reblog",
                    {
                        BlogPostId: {
                            type: Sequelize.DataTypes.INTEGER,
                            allowNull: false
                        },
                        ReblogId: {
                            type: Sequelize.DataTypes.INTEGER,
                            allowNull: false
                        },
                        createdAt: Sequelize.DataTypes.DATE,
                        updatedAt: Sequelize.DataTypes.DATE
                    },
                    { transaction: t }
                )
                .then(() =>
                    queryInterface.sequelize.query(
                        'SELECT * FROM "BlogPosts" WHERE "reblogOfBlogPostId" IS NOT NULL',
                        {
                            type: Sequelize.QueryTypes.SELECT,
                            transaction: t
                        }
                    )
                )
                .then(blogPosts =>
                    Promise.all(
                        blogPosts.map(blogPost =>
                            reblogChain(
                                blogPost,
                                queryInterface,
                                Sequelize,
                                t
                            ).then(reblogIds =>
                                queryInterface.bulkInsert(
                                    "BlogPost_Reblog",
                                    reblogIds.map(reblogId => ({
                                        BlogPostId: blogPost.id,
                                        ReblogId: reblogId,
                                        createdAt: new Date(),
                                        updatedAt: new Date()
                                    })),
                                    { transaction: t }
                                )
                            )
                        )
                    )
                )
        ),

    down: (queryInterface, Sequelize) =>
        queryInterface.dropTable("BlogPost_Reblog")
};
