"use strict";

module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.addIndex(
                "BlogPosts",
                [
                    {
                        attribute: "BlogId"
                    }
                ],
                {
                    name: 'blog_post_blog_id_idx',
                    unique: false
                }
            ),
            queryInterface.addIndex(
                "BlogPosts",
                [
                    {
                        attribute: "CommunityId"
                    }
                ],
                {
                    name: 'blog_post_community_id_idx',
                    unique: false
                }
            ),
            queryInterface.addIndex(
                "BlogPosts",
                [
                    {
                        attribute: "createdAt"
                    }
                ],
                {
                    name: 'blog_post_created_idx',
                    unique: false
                }
            )
        ]);
    },

    down: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.removeIndex("BlogPosts", "blog_post_created_idx"),            
            queryInterface.removeIndex("BlogPosts", "blog_post_community_id_idx"),            
            queryInterface.removeIndex("BlogPosts", "blog_post_blog_id_idx")
        ]);
    }
};
