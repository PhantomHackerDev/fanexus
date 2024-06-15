"use strict";

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.query(`
      UPDATE "BlogPost_Tag" SET "displaySynonym" = "Tags"."name" FROM "Tags" WHERE "Tags"."id" = "BlogPost_Tag"."TagId";
      ALTER TABLE "BlogPost_Tag" DROP CONSTRAINT "BlogPost_Tag_pkey";
      ALTER TABLE "BlogPost_Tag" ADD CONSTRAINT "BlogPost_Tag_pkey" PRIMARY KEY ("TagId", "BlogPostId", "displaySynonym");
      UPDATE "Blog_Tag" SET "displaySynonym" = "Tags"."name" FROM "Tags" WHERE "Tags"."id" = "Blog_Tag"."TagId";
      ALTER TABLE "Blog_Tag" DROP CONSTRAINT "Blog_Tag_pkey";
      ALTER TABLE "Blog_Tag" ADD CONSTRAINT "Blog_Tag_pkey" PRIMARY KEY ("TagId", "BlogId", "displaySynonym");
      UPDATE "Community_Tag" SET "displaySynonym" = "Tags"."name" FROM "Tags" WHERE "Tags"."id" = "Community_Tag"."TagId";
      ALTER TABLE "Community_Tag" DROP CONSTRAINT "Community_Tag_pkey";
      ALTER TABLE "Community_Tag" ADD CONSTRAINT "Community_Tag_pkey" PRIMARY KEY ("TagId", "CommunityId", "displaySynonym");
    `);
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.query(`
      ALTER TABLE "BlogPost_Tag" DROP CONSTRAINT "BlogPost_Tag_pkey";
      ALTER TABLE "BlogPost_Tag" ADD CONSTRAINT "BlogPost_Tag_pkey" PRIMARY KEY ("TagId", "BlogPostId");
      
      ALTER TABLE "Blog_Tag" DROP CONSTRAINT "Blog_Tag_pkey";
      ALTER TABLE "Blog_Tag" ADD CONSTRAINT "Blog_Tag_pkey" PRIMARY KEY ("TagId", "BlogId");
      
      ALTER TABLE "Community_Tag" DROP CONSTRAINT "Community_Tag_pkey";
      ALTER TABLE "Community_Tag" ADD CONSTRAINT "Community_Tag_pkey" PRIMARY KEY ("CommunityId", "BlogPostId");
    `);
    }
};
