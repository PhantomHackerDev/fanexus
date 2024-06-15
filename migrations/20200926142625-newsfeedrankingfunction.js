"use strict";

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION score_newsfeed_posts(blogPostId int, aliasId int, blogId int, communityId int, createdAt timestamp  with time zone)
    returns bigint
    language plpgsql
    as
    $$
    declare
       score integer;
       numLikes integer;
       numComments integer;
       numReblogs integer;
       isDirectBlogFollow integer;
       isDirectCommunityFollow integer;
       hoursSinceCreation bigint;
    begin
    SELECT COUNT ("Reactions"."id") into numLikes FROM "Reactions" WHERE "Reactions"."type"=1 AND "Reactions"."BlogPostId"=blogPostId;
    SELECT COUNT("Comments"."id") into numComments FROM "Comments" WHERE "Comments"."BlogPostId"=blogPostId;
    SELECT COUNT ("Reblog"."id") into numReblogs FROM "BlogPosts" AS "Reblog" WHERE "Reblog"."reblogOfBlogPostId"=blogPostId;
    SELECT COUNT ("Follows"."id") into isDirectBlogFollow FROM "Follows" WHERE "Follows"."AliasId"=aliasId AND "Follows"."followBlogId"=blogId AND "Follows"."followType" = 1;
    SELECT COUNT ("Follows"."id") into isDirectCommunityFollow FROM "Follows" WHERE "Follows"."AliasId"=aliasId AND "Follows"."followCommunityId"=communityId AND "Follows"."followType" = 1;
    SELECT (EXTRACT(EPOCH FROM (now()::timestamp with time zone - createdAt))/60/60) into hoursSinceCreation;
       return ((12 + numLikes+numComments+numReblogs + (isDirectBlogFollow*100) + (isDirectCommunityFollow*50))*1000/(12 + hoursSinceCreation));
    end;
    $$`);
    },

    down: (queryInterface, Sequelize) => {
        return Promise.resolve();
        /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    }
};
