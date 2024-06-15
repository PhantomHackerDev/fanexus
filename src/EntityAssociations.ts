import { Alias } from "@entities/Alias";
import { User } from "@entities/User";
import { Blog } from "@entities/Blog";
import { BlogPost } from "@entities/BlogPost";
import { BlogPost_Tag } from "@entities/BlogPost_Tag";
import { Gallery } from "@entities/Gallery";
import { Image } from "@entities/Image";
import { Tag } from "@entities/Tag";
import { AccessControlGroup } from "@entities/AccessControlGroup";
import { Community } from "@entities/Community";
import { CommunityMembershipRequest } from "@entities/CommunityMembershipRequest";
import { Comment } from "@entities/Comment";
import { Reaction } from "@entities/Reaction";
import { Follow } from "@entities/Follow";
import { Notification } from "@entities/Notification";
import { CommunityInvite } from "@entities/CommunityInvite";
import { CommunityRules } from "@entities/CommunityRules";
import { Blog_Tag } from "@entities/Blog_Tag";
import { Community_Tag } from "@entities/Community_Tag";
import { ModerationAction } from "@entities/ModerationAction";

BlogPost_Tag.belongsTo(BlogPost);
BlogPost_Tag.belongsTo(Tag);
Blog_Tag.belongsTo(Blog);
Blog_Tag.belongsTo(Tag);
Community_Tag.belongsTo(Community);
Community_Tag.belongsTo(Tag);

Blog.belongsToMany(Tag, { through: Blog_Tag });
Blog.belongsTo(AccessControlGroup, { as: "contentAccessControl" });
Blog.belongsTo(AccessControlGroup, { as: "commentsAccessControl" });
Blog.belongsTo(AccessControlGroup, { as: "followsAccessControl" });
Blog.belongsTo(AccessControlGroup, { as: "reactionsAccessControl" });
Blog.belongsTo(Image, { as: "avatar" });
Blog.belongsTo(Image, { as: "coverImage" });
Blog.hasMany(BlogPost);
Blog.hasMany(Follow, { foreignKey: "followBlogId" });
Blog.belongsTo(Alias);

Community.belongsTo(Image, { as: "avatar" });
Community.belongsTo(Image, { as: "coverImage" });
Community.belongsToMany(Tag, { through: Community_Tag });
Community.belongsTo(AccessControlGroup, { as: "contentAccessControl" });
Community.belongsTo(AccessControlGroup, { as: "commentsAccessControl" });
Community.belongsTo(AccessControlGroup, { as: "followsAccessControl" });
Community.belongsTo(AccessControlGroup, { as: "reactionsAccessControl" });
Community.belongsTo(AccessControlGroup, { as: "membersAccessControl" });
Community.belongsTo(AccessControlGroup, { as: "postingAccessControl" });
Community.hasMany(BlogPost);
Community.hasMany(Follow, { as: "follows", foreignKey: "followCommunityId" });
Community.belongsToMany(Alias, { through: "community_members", as: "members" });
Community.belongsToMany(Alias, {
    through: "community_moderators",
    as: "moderators"
});
Community.hasMany(CommunityMembershipRequest, { as: "membershipRequests" });
Community.hasMany(CommunityRules, { as: "communityRules" });

CommunityMembershipRequest.belongsTo(Community);
CommunityMembershipRequest.belongsTo(Alias);

Tag.belongsToMany(Blog, { through: Blog_Tag });
Tag.belongsToMany(Community, { through: Community_Tag });
Tag.belongsToMany(BlogPost, { through: { model: BlogPost_Tag } });

Alias.hasOne(Blog);
Alias.belongsTo(User);
Alias.belongsToMany(AccessControlGroup, {
    through: "AccessControlGroup_Alias",
    as: "memberOfAccessControlGroup"
});
Alias.belongsToMany(Community, {
    through: "community_members",
    as: "memberOfCommunity"
});
Alias.belongsToMany(Community, {
    through: "community_moderators",
    as: "moderatorOfCommunity"
});
Alias.belongsTo(Image, { as: "avatar" });
Alias.hasMany(CommunityMembershipRequest);
Alias.hasMany(Comment);
Alias.hasMany(Reaction);
Alias.hasMany(AccessControlGroup, { foreignKey: "belongsToAliasId" });
Alias.hasMany(Follow, { as: "follows", foreignKey: "AliasId" });

User.hasMany(Alias);
User.belongsToMany(AccessControlGroup, { through: "AccessControlGroup_User" });

BlogPost.belongsTo(Blog);
BlogPost.belongsTo(Community);
BlogPost.belongsTo(Image);
BlogPost.belongsTo(Gallery);
BlogPost.belongsTo(Alias);
BlogPost.hasMany(Comment);
BlogPost.belongsToMany(Tag, { through: { model: BlogPost_Tag } });
BlogPost.hasMany(Reaction);
BlogPost.belongsTo(AccessControlGroup, { as: "AccessControlGroup" });
BlogPost.belongsTo(BlogPost, { as: "reblogOfBlogPost" });
BlogPost.belongsToMany(AccessControlGroup, {
    as: "viewingAccessControlGroups",
    through: "BP_view_ACG"
});
BlogPost.belongsToMany(AccessControlGroup, {
    as: "commentingAccessControlGroups",
    through: "BP_comment_ACG"
});
BlogPost.belongsToMany(BlogPost, {
    as: "r",
    through: "BlogPost_Reblog",
    otherKey: "ReblogId"
});

Gallery.hasMany(Image);

Image.belongsTo(Gallery);

AccessControlGroup.belongsToMany(Alias, {
    as: "Aliases",
    through: "AccessControlGroup_Alias"
});
AccessControlGroup.belongsToMany(User, { through: "AccessControlGroup_User" });
AccessControlGroup.belongsToMany(AccessControlGroup, {
    as: "containsAccessControlGroups",
    through: "ACG_has_ACG"
});
AccessControlGroup.belongsToMany(AccessControlGroup, {
    as: "belongsToAccessControlGroups",
    through: "ACG_blngsT_ACG"
});
AccessControlGroup.belongsTo(Alias, {
    as: "belongsToAlias",
    foreignKey: "belongsToAliasId"
});

Comment.belongsTo(BlogPost);
Comment.belongsTo(BlogPost, { as: "rootBlogPost" });
Comment.belongsTo(Alias);
Comment.belongsTo(Comment, { as: "parentComment" });
Comment.hasMany(Comment, {
    as: "childComments",
    foreignKey: "parentCommentId"
});
Comment.hasMany(Reaction);

Reaction.belongsTo(Comment);
Reaction.belongsTo(BlogPost);
Reaction.belongsTo(Alias);
Reaction.belongsTo(BlogPost, { as: "reblogRoot" });

Follow.belongsTo(Alias);
Follow.belongsTo(Blog, { as: "followBlog" });
Follow.belongsTo(Community, { as: "followCommunity" });
Follow.belongsTo(Tag, { as: "followTag" });
Follow.belongsTo(Alias, { as: "followAlias" });

Alias.belongsToMany(Blog, {
    as: "followBlog",
    through: { model: Follow, unique: false },
    otherKey: "followBlogId"
});
Alias.belongsToMany(Community, {
    as: "followCommunity",
    through: { model: Follow, unique: false },
    otherKey: "followCommunityId"
});
Alias.belongsToMany(Tag, {
    as: "followTag",
    through: { model: Follow, unique: false },
    otherKey: "followTagId"
});
Alias.belongsToMany(Alias, {
    as: "followAlias",
    through: { model: Follow, unique: false },
    otherKey: "followAliasId"
});

Blog.belongsToMany(Alias, {
    as: "followedBy",
    through: { model: Follow, unique: false },
    foreignKey: "followBlogId"
});
Community.belongsToMany(Alias, {
    as: "followedBy",
    through: { model: Follow, unique: false },
    foreignKey: "followCommunityId"
});
Tag.belongsToMany(Alias, {
    as: "followedBy",
    through: { model: Follow, unique: false },
    foreignKey: "followTagId"
});
Alias.belongsToMany(Alias, {
    as: "followedBy",
    through: { model: Follow, unique: false },
    foreignKey: "followAliasId"
});

Notification.belongsTo(Alias, {
    as: "targetAlias",
    foreignKey: "targetAliasId"
});
Notification.belongsTo(Alias, {
    as: "sourceAlias",
    foreignKey: "sourceAliasId"
});
Notification.belongsTo(BlogPost, { as: "targetBlogPost" });
Notification.belongsTo(Comment, { as: "targetComment" });
Notification.belongsTo(Community, { as: "targetCommunity" });
Notification.belongsTo(BlogPost, { as: "sourceReblog" });
Notification.belongsTo(Comment, { as: "sourceComment" });

CommunityInvite.belongsTo(Community);
CommunityInvite.belongsTo(Alias, { as: "inviter" });
CommunityInvite.belongsTo(Alias, { as: "invited" });

ModerationAction.belongsTo(Alias);
