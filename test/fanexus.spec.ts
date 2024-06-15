import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { mockReq, mockRes } from "sinon-express-mock";

chai.use(sinonChai);
chai.use(chaiAsPromised);

import { config } from "dotenv";

config();

import {
    createAccessControlGroup,
    getMyAccessControlGroups,
    getAccessControlGroup,
    updateAccessControlGroup,
    addAliasesToAccessControlGroup,
    removeAliasesFromAccessControlGroup,
    addAccessControlGroupInclusion,
    removeAccessControlGroupInclusion
} from "@routes/accessControlGroup";
import { User } from "@entities/User";
import "../src/EntityAssociations";

const setupNewPrivacyGroup = () => {
    const createReq = mockReq({
        body: {
            accessControlSetting: 1,
            name: "New privacy group",
            isDefault: true,
            belongsToAliasId: 1
        },
        user: User.build(),
        token: "token",
        currentAlias: 1
    });
    const createRes = mockRes();
    return createAccessControlGroup(createReq, createRes).then(() => {
        return createRes.send.getCall(0).args[0];
    });
};

const tryRemovalWithAlias = (
    privacyGroup1: AccessControlGroup,
    privacyGroup2: AccessControlGroup,
    aliasId: number
) => {
    const removeInclusionReq = mockReq({
        params: {
            accessControlId: privacyGroup1.id
        },
        body: {
            removeAccessControlIds: privacyGroup2.id
        },
        user: User.build(),
        token: "token",
        currentAlias: aliasId
    });
    const removeInclusionRes = mockRes();
    return removeAccessControlGroupInclusion(
        removeInclusionReq,
        removeInclusionRes
    ).then(() => {
        return expect(removeInclusionRes.status).not.to.be.called;
    });
};

const tryGettingWithAlias = (
    privacyGroup: AccessControlGroup,
    aliasId: number
) => {
    const getReq = mockReq({
        params: {
            accessControlId: privacyGroup.id
        },
        user: User.build(),
        token: "token",
        currentAlias: aliasId
    });
    const getRes = mockRes();
    return getAccessControlGroup(getReq, getRes).then(
        () => getRes.send.getCall(0).args[0]
    );
};

describe("Access control groups", () => {
    it("can be created", () => {
        const req = mockReq({
            body: {
                accessControlSetting: 1,
                name: "friends",
                isDefault: true,
                belongsToAliasId: 1
            },
            user: User.build(),
            token: "token",
            currentAlias: 1
        });
        const res = mockRes();

        return createAccessControlGroup(req, res).then(() =>
            expect(res.send).to.have.been.calledWith(sinon.match.has("id"))
        );
    });

    it("can be retrieved", () => {
        const testName = `friends${Math.floor(Math.random() * 100000)}`;
        const createReq = mockReq({
            body: {
                accessControlSetting: 1,
                name: testName,
                isDefault: true,
                belongsToAliasId: 1
            },
            user: User.build(),
            token: "token",
            currentAlias: 1
        });
        const createRes = mockRes();
        return createAccessControlGroup(createReq, createRes).then(() => {
            const getReq = mockReq({
                user: User.build(),
                token: "token",
                currentAlias: 1
            });
            const getRes = mockRes();
            return getMyAccessControlGroups(getReq, getRes).then(() => {
                const myPrivacyGroups = getRes.send.getCall(0).args[0];
                return expect(
                    myPrivacyGroups.map(
                        (privacyGroup: AccessControlGroup) =>
                            (privacyGroup.toJSON() as any).name
                    )
                ).to.include(testName);
            });
        });
    });

    it("can be retrieved by ID", () => {
        const createReq = mockReq({
            body: {
                accessControlSetting: 1,
                name: "New privacy group",
                isDefault: true,
                belongsToAliasId: 1
            },
            user: User.build(),
            token: "token",
            currentAlias: 1
        });
        const createRes = mockRes();
        return createAccessControlGroup(createReq, createRes).then(() => {
            const accessControlId = createRes.send.getCall(0).args[0].id;
            const getReq = mockReq({
                params: {
                    accessControlId
                },
                user: User.build(),
                token: "token",
                currentAlias: 1
            });
            const getRes = mockRes();
            return getAccessControlGroup(getReq, getRes).then(() => {
                return expect(getRes.status).not.to.be.called;
            });
        });
    });

    it("can update", () => {
        const createReq = mockReq({
            body: {
                accessControlSetting: 1,
                name: "New privacy group",
                isDefault: true,
                belongsToAliasId: 1
            },
            user: User.build(),
            token: "token",
            currentAlias: 1
        });
        const createRes = mockRes();
        return createAccessControlGroup(createReq, createRes).then(() => {
            const accessControlId = createRes.send.getCall(0).args[0].id;
            const updateParams = {
                accessControlSetting: 2,
                name: "New access control group",
                isDefault: false
            };
            const updateReq = mockReq({
                params: { accessControlId },
                body: updateParams,
                user: User.build(),
                token: "token",
                currentAlias: 1
            });
            const updateRes = mockRes();
            return updateAccessControlGroup(updateReq, updateRes).then(() => {
                expect(updateRes.status).not.to.be.called;
                const updatedPrivacyGroup = updateRes.send.getCall(0).args[0];
                return expect(updatedPrivacyGroup.toJSON()).to.include(
                    updateParams
                );
            });
        });
    });

    it("can add aliases", () => {
        return setupNewPrivacyGroup()
            .then(newPrivacyGroup => {
                const addAliasReq = mockReq({
                    params: {
                        accessControlId: newPrivacyGroup.id
                    },
                    body: {
                        aliases: [1, 2]
                    },
                    user: User.build(),
                    token: "token",
                    currentAlias: 1
                });
                const addAliasRes = mockRes();
                return addAliasesToAccessControlGroup(
                    addAliasReq,
                    addAliasRes
                ).then(() => {
                    expect(addAliasRes.status).not.to.be.called;
                    return newPrivacyGroup;
                });
            })
            .then(newPrivacyGroup => {
                const getReq = mockReq({
                    params: {
                        accessControlId: newPrivacyGroup.id
                    },
                    user: User.build(),
                    token: "token",
                    currentAlias: 1
                });
                const getRes = mockRes();
                return getAccessControlGroup(getReq, getRes).then(() => {
                    const myPrivacyGroup = getRes.send.getCall(0).args[0];
                    return expect(
                        myPrivacyGroup.Aliases.map(
                            ({ id }: { id: number }) => id
                        )
                    ).to.include.members([1, 2]);
                });
            });
    });

    it("can add and remove aliases", () => {
        return setupNewPrivacyGroup()
            .then(newPrivacyGroup => {
                const addAliasReq = mockReq({
                    params: {
                        accessControlId: newPrivacyGroup.id
                    },
                    body: {
                        aliases: [1, 2]
                    },
                    user: User.build(),
                    token: "token",
                    currentAlias: 1
                });
                const addAliasRes = mockRes();
                return addAliasesToAccessControlGroup(
                    addAliasReq,
                    addAliasRes
                ).then(() => {
                    expect(addAliasRes.status).not.to.be.called;
                    return newPrivacyGroup;
                });
            })
            .then(newPrivacyGroup => {
                const getReq = mockReq({
                    params: {
                        accessControlId: newPrivacyGroup.id
                    },
                    user: User.build(),
                    token: "token",
                    currentAlias: 1
                });
                const getRes = mockRes();
                return getAccessControlGroup(getReq, getRes)
                    .then(() => {
                        const myPrivacyGroup = getRes.send.getCall(0).args[0];
                        return expect(
                            myPrivacyGroup.Aliases.map(
                                ({ id }: { id: number }) => id
                            )
                        ).to.include.members([1, 2]);
                    })
                    .then(() => newPrivacyGroup);
            })
            .then(newPrivacyGroup => {
                const removeAliasReq = mockReq({
                    params: {
                        accessControlId: newPrivacyGroup.id
                    },
                    body: {
                        aliases: [1]
                    },
                    user: User.build(),
                    token: "token",
                    currentAlias: 1
                });
                const removeAliasRes = mockRes();
                return removeAliasesFromAccessControlGroup(
                    removeAliasReq,
                    removeAliasRes
                )
                    .then(() => {
                        return expect(removeAliasRes.status).not.to.be.called;
                    })
                    .then(() => newPrivacyGroup);
            })
            .then(newPrivacyGroup => {
                const getReq = mockReq({
                    params: {
                        accessControlId: newPrivacyGroup.id
                    },
                    user: User.build(),
                    token: "token",
                    currentAlias: 1
                });
                const getRes = mockRes();
                return getAccessControlGroup(getReq, getRes).then(() => {
                    const myPrivacyGroup = getRes.send.getCall(0).args[0];
                    return expect(
                        myPrivacyGroup.Aliases.map(
                            ({ id }: { id: number }) => id
                        )
                    ).not.to.include(1);
                });
            });
    });

    it("can add or remove contained access control groups", () => {
        return Promise.all([
            setupNewPrivacyGroup(),
            setupNewPrivacyGroup()
        ]).then(([newPrivacyGroup1, newPrivacyGroup2]) => {
            const addInclusionReq = mockReq({
                params: {
                    accessControlId: newPrivacyGroup1.id
                },
                body: {
                    addAccessControlIds: newPrivacyGroup2.id
                },
                user: User.build(),
                token: "token",
                currentAlias: 1
            });
            const addInclusionRes = mockRes();
            return addAccessControlGroupInclusion(
                addInclusionReq,
                addInclusionRes
            )
                .then(() => {
                    return expect(addInclusionRes.status).not.to.be.called;
                })
                .then(() => {
                    const getReq = mockReq({
                        params: {
                            accessControlId: newPrivacyGroup1.id
                        },
                        user: User.build(),
                        token: "token",
                        currentAlias: 1
                    });
                    const getRes = mockRes();
                    return getAccessControlGroup(getReq, getRes).then(() => {
                        const myPrivacyGroup = getRes.send.getCall(0).args[0];
                        return expect(
                            myPrivacyGroup.containsAccessControlGroups.map(
                                ({ id }: { id: number }) => id
                            )
                        ).to.include(newPrivacyGroup2.id);
                    });
                })
                .then(() =>
                    tryRemovalWithAlias(newPrivacyGroup1, newPrivacyGroup2, 2)
                )
                .then(() =>
                    tryGettingWithAlias(
                        newPrivacyGroup1,
                        1
                    ).then(privacyGroup =>
                        expect(
                            privacyGroup.containsAccessControlGroups.map(
                                ({ id }: { id: number }) => id
                            )
                        ).to.include(newPrivacyGroup2.id)
                    )
                )
                .then(() =>
                    tryRemovalWithAlias(newPrivacyGroup1, newPrivacyGroup2, 1)
                )
                .then(() =>
                    tryGettingWithAlias(
                        newPrivacyGroup1,
                        1
                    ).then(privacyGroup =>
                        expect(
                            privacyGroup.containsAccessControlGroups.map(
                                ({ id }: { id: number }) => id
                            )
                        ).not.to.include(newPrivacyGroup2.id)
                    )
                );
        });
    });
});

import { Transaction } from "sequelize";

import { database as sequelize } from "@services/databaseService.js";
import { AccessControlGroupController } from "@controllers/AccessControlGroupController";
import { AccessControlGroup } from "@entities/AccessControlGroup";

const useNewPrivacyGroup = (
    callback: (
        privacyGroup: AccessControlGroup,
        transaction: Transaction
    ) => void
) =>
    sequelize.transaction(transaction =>
        AccessControlGroupController.createAccessControlGroup(
            {
                accessControlSetting: 1,
                belongsToAlias: 1,
                isDefault: true,
                name: "Test access control group",
                aliases: [1]
            },
            1,
            transaction
        ).then(createdGroup => callback(createdGroup, transaction))
    );

describe("AccessControlGroup controller", () => {
    it("returns an access control group form createAccessControlGroup", () =>
        sequelize
            .transaction(transaction =>
                AccessControlGroupController.createAccessControlGroup(
                    {
                        accessControlSetting: 1,
                        belongsToAlias: 1,
                        isDefault: true,
                        name: "Test access control group",
                        aliases: [1]
                    },
                    1,
                    transaction
                )
            )
            .then(accessControlGroup => {
                return expect(accessControlGroup).to.be.an.instanceof(
                    AccessControlGroup
                );
            }));

    it("can get related entity", () =>
        sequelize.transaction(transaction =>
            AccessControlGroupController.createAccessControlGroup(
                {
                    accessControlSetting: 1,
                    belongsToAlias: 1,
                    isDefault: true,
                    name: "Test access control group",
                    aliases: [1]
                },
                1,
                transaction
            ).then(
                createdGroup =>
                    expect(
                        AccessControlGroupController.getAccessControlRelatedEntity(
                            createdGroup.id,
                            transaction
                        )
                    ).to.be.fulfilled
            )
        ));

    it("can get access control group", () =>
        sequelize.transaction(transaction =>
            AccessControlGroupController.createAccessControlGroup(
                {
                    accessControlSetting: 1,
                    belongsToAlias: 1,
                    isDefault: true,
                    name: "Test access control group",
                    aliases: [1]
                },
                1,
                transaction
            ).then(
                createdGroup =>
                    expect(
                        AccessControlGroupController.getAccessControlGroup(
                            createdGroup.id,
                            1,
                            undefined,
                            transaction
                        )
                    ).to.be.fulfilled
            )
        ));

    it("can edit access control group", () =>
        useNewPrivacyGroup((createdGroup, transaction) => {
            return expect(
                AccessControlGroupController.editAccessControlGroup(
                    createdGroup,
                    {
                        accessControlSetting: 2,
                        name: "new name",
                        isDefault: false
                    },
                    transaction
                )
            ).to.be.fulfilled;
        }));

    it("can add aliases to access control group", () =>
        useNewPrivacyGroup((createdGroup, transaction) => {
            return expect(
                AccessControlGroupController.addAliasesToAccessControlGroup(
                    createdGroup.id,
                    1,
                    [1, 2],
                    undefined,
                    transaction
                )
            ).to.be.fulfilled;
        }));

    it("can add aliases to related access control group", () =>
        useNewPrivacyGroup((createdGroup, transaction) => {
            return expect(
                AccessControlGroupController.addAliasesToRelatedAccessControlGroups(
                    createdGroup.id,
                    1,
                    [1, 2],
                    undefined,
                    transaction
                )
            ).to.be.fulfilled;
        }));

    it("can remove aliases from access control group", () =>
        useNewPrivacyGroup((createdGroup, transaction) => {
            return expect(
                AccessControlGroupController.removeAliasesFromAccessControlGroup(
                    createdGroup.id,
                    1,
                    [1, 2],
                    undefined,
                    transaction
                )
            ).to.be.fulfilled;
        }));

    it("can remove aliases to related access control group", () =>
        useNewPrivacyGroup((createdGroup, transaction) => {
            return expect(
                AccessControlGroupController.removeAliasesFromRelatedAccessControlGroups(
                    createdGroup.id,
                    1,
                    [1, 2],
                    undefined,
                    transaction
                )
            ).to.be.fulfilled;
        }));

    it("can add access control group containment", () =>
        sequelize.transaction(transaction =>
            Promise.all([
                AccessControlGroupController.createAccessControlGroup(
                    {
                        accessControlSetting: 1,
                        belongsToAlias: 1,
                        isDefault: true,
                        name: "Test access control group 1",
                        aliases: [1]
                    },
                    1,
                    transaction
                ),
                AccessControlGroupController.createAccessControlGroup(
                    {
                        accessControlSetting: 1,
                        belongsToAlias: 1,
                        isDefault: true,
                        name: "Test access control group 2",
                        aliases: [1]
                    },
                    1,
                    transaction
                )
            ]).then(([createdGroup1, createdGroup2]) => {
                return expect(
                    AccessControlGroupController.addContainsAccessControlGroup(
                        createdGroup1,
                        createdGroup2,
                        1,
                        transaction
                    )
                ).to.be.fulfilled;
            })
        ));
});

/*process.env.NODE_ENV = "test";

import { config } from "dotenv";
config();

const chai = require("chai");
const expect = chai.expect;

import { database as sequelize } from "../src/services/databaseService.js";
import { runNeo4jQuery } from "../src/services/Neo4jService";
import { TagController } from "../src/Controller/TagController";
import { Tag } from "../src/Entity/Tag";
import { User } from "../src/Entity/User";
import { AliasController } from "../src/Controller/AliasController";
import { Alias } from "../src/Entity/Alias";
import { BlogController } from "../src/Controller/BlogController";
import { Blog } from "../src/Entity/Blog";
import { BlogPostController } from "../src/Controller/BlogPostController";
import { BlogPost } from "../src/Entity/BlogPost";
import { CommunityController } from "../src/Controller/CommunityController";
import { Community } from "../src/Entity/Community";
import { CommunityRules } from "../src/Entity/CommunityRules";
import { ImageController } from "../src/Controller/ImageController";
import { Image } from "../src/Entity/Image";
import { Follow } from "../src/Entity/Follow";
import { CommentsController } from "../src/Controller/CommentsController";
import { Comment } from "../src/Entity/Comment";
import { ReactionController } from "../src/Controller/ReactionController";
import { Reaction } from "../src/Entity/Reaction";
import { AccessControlGroup } from "../src/Entity/AccessControlGroup";
import { getDefaultImageLink } from "../src/services/ImageService";
import { CommunityInterface } from "../src/Interface/CommunityInterface";

Alias.belongsTo(Image, { as: "avatar" });
Alias.belongsTo(User);
Blog.belongsToMany(Tag, { through: "Blog_Tag" });
Blog.belongsTo(Alias);
Blog.belongsToMany(Tag, { through: "Blog_Tag" });
Blog.belongsTo(AccessControlGroup, { as: "contentAccessControl" });
Blog.belongsTo(AccessControlGroup, { as: "commentsAccessControl" });
Blog.belongsTo(AccessControlGroup, { as: "followsAccessControl" });
Blog.belongsTo(AccessControlGroup, { as: "reactionsAccessControl" });
Blog.belongsTo(Image, { as: "avatar" });
Blog.belongsTo(Image, { as: "coverImage" });
Follow.belongsTo(Alias);
Follow.belongsTo(Tag, { as: "followTag" });
BlogPost.belongsTo(Alias);
BlogPost.belongsToMany(Tag, { through: "BlogPost_Tag" });
BlogPost.belongsTo(Blog);
BlogPost.belongsTo(Community);
BlogPost.belongsTo(BlogPost, { as: "reblogOfBlogPost" });
Tag.belongsToMany(Blog, { through: "Blog_Tag" });
Tag.belongsToMany(Community, { through: "Community_Tag" });
Comment.belongsTo(BlogPost);
Comment.belongsTo(BlogPost, { as: "rootBlogPost" });
Comment.belongsTo(Alias);
Comment.belongsTo(Comment, { as: "parentComment" });
Comment.hasMany(Comment, { as: "childComments" });
Reaction.belongsTo(Alias);
Reaction.belongsTo(BlogPost);
Reaction.belongsTo(Comment);
AccessControlGroup.belongsToMany(Alias, {
    through: "AccessControlGroup_Alias"
});
AccessControlGroup.belongsToMany(User, { through: "AccessControlGroup_User" });
Community.belongsTo(Image, { as: "avatar" });
Community.belongsTo(Image, { as: "coverImage" });
Community.belongsToMany(Tag, { through: "Community_Tag" });
Community.belongsToMany(Alias, { through: "community_members", as: "members" });
Community.belongsToMany(Alias, {
    through: "community_moderators",
    as: "moderators"
});
Community.hasMany(CommunityRules, { as: "communityRules" });
Community.belongsTo(AccessControlGroup, { as: "contentAccessControl" });
Community.belongsTo(AccessControlGroup, { as: "commentsAccessControl" });
Community.belongsTo(AccessControlGroup, { as: "followsAccessControl" });
Community.belongsTo(AccessControlGroup, { as: "reactionsAccessControl" });
Community.belongsTo(AccessControlGroup, { as: "membersAccessControl" });
Community.belongsTo(AccessControlGroup, { as: "postingAccessControl" });

const createTags = (): Promise<Tag[]> => {
    const tags = [
        {
            name: "DC",
            style: "background-color: black; font-weight:bold",
            synonyms: ["DC", "Detective comics"]
        },
        {
            name: "Batman",
            style: "background-color: black; font-weight:bold",
            synonyms: ["Batman", "Bruce Wayne"]
        },
        {
            name: "Joker",
            style: "background-color: purple; font-weight:bold",
            synonyms: ["Joker"]
        }
    ];
    return Promise.all(
        tags.map(tag => {
            return Tag.create({
                name: tag.name,
                synonyms: tag.synonyms,
                style: tag.style
            }).then(tag => {
                return runNeo4jQuery(
                    "MERGE (t:Tag {name: $nameParam, synonyms: $synonymParams, sqlId: $sqlIdParam}) RETURN t",
                    {
                        nameParam: tag.name,
                        synonymParams: tag.synonyms,
                        sqlIdParam: tag.id
                    }
                ).then(() => {
                    return tag;
                });
            });
        })
    );
};

const createUser = (): Promise<User> => {
    return User.create({
        email: "test@test.com",
        password: "test"
    });
};

const createAliases = (user: User): Promise<Alias[]> => {
    const aliasData = [
        {
            name: "batman",
            imageURL:
                "https://webcomicms.net/sites/default/files/clipart/129224/batman-icon-129224-6523819.png" /*UserId: user1.id
        },
        {
            name: "joker",
            imageURL:
                "https://toppng.com/uploads/preview/joker-smile-picture-free-windows-joker-icon-11553541523i1hwccrokv.png" /*UserId: user1.id
        },
        {
            name: "Bane",
            imageURL:
                "https://toppng.com/uploads/preview/joker-smile-picture-free-windows-joker-icon-11553541523i1hwccrokv.png" /*UserId: user1.id
        }
    ];
    return Promise.all(
        aliasData.map(aliasDatum => {
            return Alias.create({
                name: aliasDatum.name,
                imageURL: aliasDatum.imageURL,
                UserId: user.id,
                isMinor: user.isMinor
            });
        })
    );
};

type CreateBlogFunction = (alias: Alias, tags: Tag[]) => Promise<Blog>;
const createBlog: CreateBlogFunction = (alias, tags) => {
    return Blog.create({
        name: "Gotham daily",
        link: "Gotham_city",
        links: [
            "https://www.facebook.com/GOTHAMonFOX/",
            "https://twitter.com/hashtag/gothamcity"
        ],
        description:
            "The latest and <b>GREATEST</b> news on your favourite disfunctional city",
        AliasId: alias.id
    }).then(blog => {
        blog.setTags(tags);
        return blog;
    });
};

const blogPostData = (alias: Alias, blog: Blog, tags: Tag[]) => {
    return {
        content:
            'Batman is a fictional superhero appearing in American comic books published by DC Comics. The character was created by artist Bob Kane and writer Bill Finger,[2][3] and first appeared in Detective Comics #27 in 1939. Originally named the "Bat-Man," the character is also referred to by such epithets as the Caped Crusader, the Dark Knight, and the World\'s Greatest Detective.[6]\n' +
            "\n" +
            "Batman's secret identity is Bruce Wayne, a wealthy American playboy, philanthropist, and owner of Wayne Enterprises. Batman originated from an incident in Bruce's childhood; after witnessing the murder of his parents Dr. Thomas Wayne and Martha Wayne, he swore vengeance against criminals, an oath tempered by a sense of justice. Bruce trains himself physically and intellectually and crafts a bat-inspired persona to fight crime.[7] ",
        alias: alias,
        blog: blog,
        tags: tags.map(tag => tag.id)
    };
};

const communityBlogPostData = (
    alias: Alias,
    community: Community,
    tags: Tag[]
) => {
    return {
        content:
            'Batman is a fictional superhero appearing in American comic books published by DC Comics. The character was created by artist Bob Kane and writer Bill Finger,[2][3] and first appeared in Detective Comics #27 in 1939. Originally named the "Bat-Man," the character is also referred to by such epithets as the Caped Crusader, the Dark Knight, and the World\'s Greatest Detective.[6]\n' +
            "\n" +
            "Batman's secret identity is Bruce Wayne, a wealthy American playboy, philanthropist, and owner of Wayne Enterprises. Batman originated from an incident in Bruce's childhood; after witnessing the murder of his parents Dr. Thomas Wayne and Martha Wayne, he swore vengeance against criminals, an oath tempered by a sense of justice. Bruce trains himself physically and intellectually and crafts a bat-inspired persona to fight crime.[7] ",
        alias: alias,
        community: community,
        tags: tags.map(tag => tag.id)
    };
};

const createBlogPost = (
    alias: Alias,
    blog: Blog,
    tags: Tag[]
): Promise<BlogPost> => {
    const creatingBlogPostData = blogPostData(alias, blog, tags);
    return BlogPost.create({
        content: creatingBlogPostData.content,
        aliasId: creatingBlogPostData.alias.id,
        blogId: creatingBlogPostData.blog.id
    }).then(blogPost => {
        blogPost.setTags(creatingBlogPostData.tags);
        return blogPost;
    });
};

const createComment = (alias: Alias, blogPost: BlogPost) => {
    return Comment.create({
        content: "test comment",
        aliasId: alias.id,
        blogPostId: blogPost.id
    });
};

const createImages = () => {
    return Promise.all([
        Image.create({
            src:
                "https://vignette.wikia.nocookie.net/crysis/images/f/fb/Crynet_nanosuit.jpg",
            name: "Nanosuit",
            alt: "Awesome nanosuit"
        }),
        Image.create({
            src:
                "https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/Batman_%28DC_Rebirth_version%29.png/220px-Batman_%28DC_Rebirth_version%29.png",
            name: "batsuit",
            alt: "a suit less awesome than the nanosuit"
        }),
        Image.create({
            src:
                "https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/Batman_%28DC_Rebirth_version%29.png/220px-Batman_%28DC_Rebirth_version%29.png",
            name: "aliasImage",
            alt: "a suit less awesome than the nanosuit"
        })
    ]);
};

const createCommunityAvatar = () => {
    return Image.create({
        src:
            "https://vignette.wikia.nocookie.net/mountandblade/images/1/15/Harlaus.jpg/revision/latest/top-crop/width/360/height/360?cb=20170303233208",
        name: "Harlaus",
        alt: "Our glorious leader"
    });
};

const createCommunityCover = () => {
    return Image.create({
        src:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn%3AANd9GcQGcC1bbNt2SiG0t3sWkoqGBulHZPMYsrCZC8oVAC0AjyfRv9Yy&usqp=CAU",
        name: "Butter",
        alt: "The lifeblood of our kingdom"
    });
};

const communityParams = (
    communityAvatar: Image,
    communityCover: Image,
    tags: Tag[],
    alias: Alias
): CommunityInterface => {
    return {
        name: "Swadian feast community",
        link: "butterlords2",
        links: [
            "http:/www.google.com",
            "http:/www.taleworldsentertainment.com"
        ],
        rules: [
            {
                name: "BUTTERLORDS ONLy",
                description: "You MUST love butter in order to join"
            },
            {
                name: "Feasts every monday, wednesday and saturday",
                description:
                    "Especially if there is a siege going on, No exceptions"
            }
        ],
        description: "The group made to fest in the name of Glorious Harlaus",
        avatar: communityAvatar,
        coverImage: communityCover,
        tags: tags,
        members: [alias],
        moderators: [alias],
        contentAccessControl: { accessControlSetting: "full" },
        commentsAccessControl: { accessControlSetting: "full" },
        reactionsAccessControl: { accessControlSetting: "full" },
        followsAccessControl: { accessControlSetting: "full" },
        postingAccessControl: { accessControlSetting: "full" },
        membersAccessControl: { accessControlSetting: "full" }
    };
};

const createCommunity = (): Promise<Community> => {
    return Community.create({
        name: "Swadian feast community",
        link: "butterlords",
        links: [
            "http:/www.google.com",
            "http:/www.taleworldsentertainment.com"
        ],
        description: "The group made to fest in the name of Glorious Harlaus"
    });
};

const createAccessControlGroups = () => {
    return Promise.all([
        AccessControlGroup.create({
            accessControlSetting:
                AccessControlGroup.ACCESS_CONTROL_SETTINGS.specificInclude
        }),
        AccessControlGroup.create({
            accessControlSetting:
                AccessControlGroup.ACCESS_CONTROL_SETTINGS.full
        }),
        AccessControlGroup.create({
            accessControlSetting:
                AccessControlGroup.ACCESS_CONTROL_SETTINGS.full
        }),
        AccessControlGroup.create({
            accessControlSetting:
                AccessControlGroup.ACCESS_CONTROL_SETTINGS.full
        }),
        AccessControlGroup.create({
            accessControlSetting:
                AccessControlGroup.ACCESS_CONTROL_SETTINGS.full
        })
    ]);
};

describe("Fanexus", () => {
    let tags: Tag[];
    let user: User;
    let aliases: Alias[];
    let blog: Blog;
    let blogPost: BlogPost;
    let comment: Comment;
    let images: Image[];
    let communityAvatar: Image;
    let communityCover: Image;
    let accessControlGroups: AccessControlGroup[];
    let community: Community;

    before(() => {
        return sequelize
            .sync({ force: true })
            .then(() => {
                return runNeo4jQuery("MATCH (nodes) DETACH DELETE nodes", {});
            })
            .then(() => {
                return createTags().then((createdTags: Tag[]): void => {
                    tags = createdTags;
                });
            })
            .then(() => {
                return createUser().then(
                    (createdUser: User): User => {
                        return (user = createdUser);
                    }
                );
            })
            .then(createdUser => {
                return createAliases(createdUser).then(
                    (createdAliases: Alias[]): void => {
                        aliases = createdAliases;
                    }
                );
            })
            .then(() => {
                return createBlog(aliases[0], [tags[1]]).then(
                    (createdBlog: Blog): void => {
                        blog = createdBlog;
                    }
                );
            })
            .then(() => {
                return createBlogPost(aliases[0], blog, tags).then(
                    (createdBlogPost: BlogPost): void => {
                        blogPost = createdBlogPost;
                    }
                );
            })
            .then(() => {
                return createComment(aliases[0], blogPost).then(
                    (createdComment: Comment): void => {
                        comment = createdComment;
                    }
                );
            })
            .then(() => {
                return createImages().then((createdImages: Image[]): void => {
                    images = createdImages;
                });
            })
            .then(() => {
                return createAccessControlGroups().then(
                    (
                        createdAccessControlGroups: AccessControlGroup[]
                    ): void => {
                        accessControlGroups = createdAccessControlGroups;
                    }
                );
            })
            .then(() => {
                return createCommunityAvatar().then(
                    (createdCommunityAvatar: Image): void => {
                        communityAvatar = createdCommunityAvatar;
                    }
                );
            })
            .then(() => {
                return createCommunityCover().then(
                    (createdCommunityCover: Image): void => {
                        communityCover = createdCommunityCover;
                    }
                );
            })
            .then(() => {
                return createCommunity().then(
                    (createdCommunity: Community): void => {
                        community = createdCommunity;
                    }
                );
            });
    });

    it("can create tags", () => {
        return TagController.create({
            name: "Wonder Woman",
            style: "background-color: black; font-weight:bold",
            synonyms: ["Wonder Woman"]
        })
            .then(tag => {
                expect(tag.id).to.be.a("number");
            })
            .catch(e => {
                console.log(e.stack);
                expect.fail("Tag creation failed.");
            });
    });

    it("can add parent tags", () => {
        return Promise.all([
            TagController.addParentTag(tags[1], tags[0]),
            TagController.addParentTag(tags[2], tags[0])
        ])
            .then(() => {
                return TagController.getAllDescendants(tags[0].id).then(
                    descendentIds => {
                        expect(descendentIds).to.include(tags[1].id);
                        expect(descendentIds).to.include(tags[2].id);
                    }
                );
            })
            .catch(e => {
                console.log(e.stack);
                expect.fail("Parent tag assignment failed.");
            });
    });

    it("can create aliases", () => {
        return AliasController.createAlias(
            "Superman",
            "https://toppng.com/uploads/preview/superman-party-theme-superman-party-decorations-superhero-superman-latinha-1156364813284sdpjw7jf.png",
            user
        )
            .then(alias => {
                expect(alias.id).to.be.a("number");
            })
            .catch(e => {
                console.log(e.stack);
                expect.fail("Alias creation failed.");
            });
    });

    it("can set User and Avatar on Aliases", () => {
        return Promise.all([
            aliases[0].setUser(user.id),
            aliases[0].setAvatar(images[2])
        ])
            .then(() => {
                return aliases[0].save();
            })
            .then((alias: Alias) => {
                expect(alias.UserId).to.equal(user.id);
                expect(alias.avatarId).to.equal(images[2].id);
            });
    });

    it("can create blogs", () => {
        return Promise.all([
            BlogController.createBlog({
                alias: aliases[1],
                name: "alias 2 default blog",
                link: undefined,
                links: [],
                tags: [],
                description: "Autocreated blog. Edit me, show your stuff!",
                coverImage: { src: getDefaultImageLink() },
                avatar: { src: getDefaultImageLink() }
            }),
            BlogController.createBlog({
                alias: aliases[2],
                name: "alias 3 blog default",
                link: undefined,
                links: [],
                tags: [],
                description: "Autocreated blog. Edit me, show your stuff!",
                coverImage: { src: getDefaultImageLink() },
                avatar: { src: getDefaultImageLink() }
            })
        ])
            .then((createdBlogs: Blog[]) => {
                expect(createdBlogs[0].id).to.be.a("number");
            })
            .catch(e => {
                console.log(e.stack);
                expect.fail("Blog creation failed.");
            });
    });

    it("can set Avatar and CoverImage on Blogs", () => {
        return Promise.all([
            blog.setAvatar(images[0]),
            blog.setCoverImage(images[1])
        ]);
    });

    it("can create blogPosts", () => {
        return BlogPostController.createBlogPost(
            blogPostData(aliases[0], blog, tags)
        )
            .then(createdBlogPost => {
                expect(createdBlogPost.id).to.be.a("number");
            })
            .catch(e => {
                console.log(e.stack);
                expect.fail("BlogPost creation failed.");
            });
    });

    it("can create reblog of BlogPosts", () => {
        const blogPostDataObject = {
            ...blogPostData(aliases[0], blog, tags),
            ...{ reblogOfBlogPost: 1 }
        };
        return BlogPostController.createBlogPost(blogPostDataObject)
            .then(createdBlogPost => {
                expect(createdBlogPost.reblogOfBlogPostId).to.equal(1);
            })
            .catch(e => {
                console.log(e.stack);
                expect.fail("Reblog of BlogPost creation failed.");
            });
    });

    it("can create comments on BlogPosts", () => {
        return CommentsController.createComment({
            content: "test comment",
            alias: aliases[0],
            blogPost: blogPost
        })
            .catch(e => {
                console.log(e.stack);
                expect.fail("Comment on BlogPost creation failed.");
            })
            .then((createdComment: Comment) => {
                expect(createdComment.BlogPostId).to.equal(blogPost.id);
            });
    });

    it("can create comments on Comments", () => {
        return CommentsController.createComment({
            content: "test reply comment",
            alias: aliases[0],
            parentComment: comment
        })
            .then((createdComment: Comment) => {
                expect(createdComment.parentCommentId).to.equal(comment.id);
            })
            .catch(e => {
                console.log(e.stack);
                expect.fail("Comment on Comment creation failed.");
            });
    });

    it("can create reactions on Comments", () => {
        return ReactionController.createReaction({
            type: "like",
            alias: aliases[0].id,
            comment: comment.id
        })
            .then((createdReaction: Reaction) => {
                expect(createdReaction.CommentId).to.equal(comment.id);
            })
            .catch(e => {
                console.log(e.stack);
                expect.fail("Reaction on Comment creation failed.");
            });
    });

    it("can create reactions on BlogPosts", () => {
        return ReactionController.createReaction({
            type: "like",
            alias: aliases[0].id,
            blogPost: blogPost.id
        })
            .then((createdReaction: Reaction) => {
                expect(createdReaction.BlogPostId).to.equal(blogPost.id);
            })
            .catch(e => {
                console.log(e.stack);
                expect.fail("Reaction on BlogPost creation failed.");
            });
    });

    it("can create Images", () => {
        return ImageController.createImage({
            src:
                "https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/Batman_%28DC_Rebirth_version%29.png/220px-Batman_%28DC_Rebirth_version%29.png",
            name: "aliasImage",
            alt: "a suit less awesome than the nanosuit"
        })
            .then((createdImage: Image) => {
                expect(createdImage.id).to.be.a("number");
            })
            .catch(e => {
                console.log(e.stack);
                expect.fail("Image creation failed.");
            });
    });

    it("can add aliases and users to AccessControlGroups", () => {
        return Promise.all([
            accessControlGroups[0].addAlias(aliases[0]),
            accessControlGroups[0].addUser(user)
        ])
            .then(() => {
                accessControlGroups[0].save();
            })
            .then(() => {
                return Promise.all([
                    accessControlGroups[0].getUsers().then((users: User[]) => {
                        expect(users.map(user => user.id)).to.include(user.id);
                    }),
                    accessControlGroups[0]
                        .getAliases()
                        .then((foundAliases: Alias[]) => {
                            expect(
                                foundAliases.map(alias => alias.id)
                            ).to.include(aliases[0].id);
                        })
                ]);
            });
    });

    it("can set access controls on Blogs", () => {
        return Promise.all([
            blog.setContentAccessControl(accessControlGroups[0]),
            blog.setCommentsAccessControl(accessControlGroups[0]),
            blog.setReactionsAccessControl(accessControlGroups[0]),
            blog.setFollowsAccessControl(accessControlGroups[0])
        ]).then(() => {
            return blog.save();
        });
    });

    it("can create Communities", () => {
        return CommunityController.createCommunity(
            communityParams(communityAvatar, communityCover, tags, aliases[0])
        )
            .then((community: Community) => {
                expect(community.id).to.be.a("number");
            })
            .catch(e => {
                console.error(e.stack);
                expect.fail("Failed to create community.");
            });
    });

    it("can create BlogPosts in Communinities", () => {
        return BlogPostController.createBlogPost(
            communityBlogPostData(aliases[1], community, [tags[1]])
        )
            .then((createdBlogPost: BlogPost) => {
                expect(createdBlogPost.CommunityId).to.equal(community.id);
            })
            .catch(e => {
                console.error(e.stack);
                expect.fail("Failed to create blogpost in community.");
            });
    });
});

process.on("unhandledRejection", (reason: any, promise) => {
    console.warn(
        "Unhandled promise rejection:",
        promise,
        "reason:",
        reason.stack || reason
    );
    expect.fail("Unhandled promise rejection");
});
*/
