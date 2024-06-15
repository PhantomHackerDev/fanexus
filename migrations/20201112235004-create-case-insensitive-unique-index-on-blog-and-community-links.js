"use strict";

const updateDuplicates = (queryInterface, transaction, iterations) => {
    console.log("function: updateDuplicates", iterations);
    return Promise.all([
        queryInterface.sequelize.query(
            `UPDATE "Blogs" SET "link"='sorry${iterations}' || "link" WHERE EXISTS (SELECT 1 FROM "Blogs" AS "otherBlog" WHERE UPPER("Blogs"."link")=UPPER("otherBlog"."link") AND "Blogs"."id" < "otherBlog"."id")`,
            { transaction }
        ),
        queryInterface.sequelize.query(
            `UPDATE "Communities" SET "link"='sorry${iterations}' || "link" WHERE EXISTS (SELECT 1 FROM "Communities" AS "otherCommunity" WHERE UPPER("Communities"."link")=UPPER("otherCommunity"."link") AND "Communities"."id" < "otherCommunity"."id")`,
            { transaction }
        )
    ]).then(
        () =>
            iterations > 1 &&
            updateDuplicates(queryInterface, transaction, iterations - 1)
    );
};

const createIndices = (queryInterface, iterations = 1) => {
    console.log("function: createIndices", iterations);
    return queryInterface.sequelize
        .transaction(transaction =>
            updateDuplicates(queryInterface, transaction, iterations).then(() =>
                Promise.all([
                    queryInterface.sequelize.query(
                        'DROP INDEX IF EXISTS blog_link_index;CREATE UNIQUE INDEX blog_link_index ON "Blogs" (UPPER(link))',
                        { transaction }
                    ),
                    queryInterface.sequelize.query(
                        'DROP INDEX IF EXISTS community_link_index;CREATE UNIQUE INDEX community_link_index ON "Communities" (UPPER(link))',
                        { transaction }
                    )
                ])
            )
        )
        .catch(e => {
            console.log("in catch");
            console.log(e);
            return createIndices(queryInterface, iterations + 1);
        });
};

module.exports = {
    up: (queryInterface, Sequelize) => createIndices(queryInterface),

    down: (queryInterface, Sequelize) =>
        Promise.all([
            queryInterface.sequelize.query(
                "DROP INDEX IF EXISTS blog_link_index"
            ),
            queryInterface.sequelize.query(
                "DROP INDEX IF EXISTS community_link_index"
            )
        ])
};
