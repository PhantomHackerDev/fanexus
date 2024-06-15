import express from "express";
const dbFixturesRouter = express.Router();

/*import { database as sequelize } from "../../services/databaseService.js";

import { User } from "../../Entity/User";
import { runNeo4jQuery } from "../../services/Neo4jService";
import { AliasController } from "../../Controller/AliasController";
import { ImageController } from "../../Controller/ImageController";
import { MediaserverService } from "../../services/MediaserverService";
import { auth } from "../../Authorization/auth";*/
// import {Tag} from '../../Entity/Tag';

/*dbFixturesRouter.get("/fixturesLoad/initProd", async ({}, res) =>
    sequelize.transaction(transaction =>
        sequelize
            .sync({ force: true })
            .then(
                (): Promise<void> => {
                    return runNeo4jQuery(
                        "MATCH (nodes) DETACH DELETE nodes",
                        {}
                    ).then((): void => {
                        return undefined;
                    });
                }
            )
            .then(
                (): Promise<void> => {
                    return runNeo4jQuery("CREATE INDEX ON :Tag(sqlId)", {})
                        .catch((e): void => {
                            console.log(e);
                        })
                        .then((): void => {
                            return undefined;
                        });
                }
            )
            .then(
                (): Promise<void> => {
                    return runNeo4jQuery(
                        "CREATE CONSTRAINT unique_tag_name ON (t:Tag) ASSERT t.name IS UNIQUE",
                        {}
                    )
                        .catch((e): void => {
                            console.log(e);
                        })
                        .then((): void => {
                            return undefined;
                        });
                }
            )
            .then(async () => {
                const user1 = await User.create(
                    {
                        email: "ChadThunder@Cock.com",
                        password: "StaceyThunderCunt"
                    },
                    { transaction }
                );

                // const tag1 = await TagController.create({
                // name: 'Fanexus', style: 'background-color: black; font-weight:bold', synonyms: ['Fanexus', 'Awesomeness'], parentTags: [], childTags: [], description: ''
                // });
                // const tag2 = await TagController.create({
                // name: 'Dev', style: 'background-color: black; font-weight:bold', synonyms: ['Dev', 'Admin'], parentTags: [], childTags: [], description: ''
                // });
                // const tag3 = await TagController.create({
                // name: 'Batman', style: 'background-color: black; font-weight:bold', synonyms: ['Batman', 'Bruce Wayne'], parentTags: [], childTags: [], description: ''
                // });
                return ImageController.createImage(
                    {
                        src:
                            "https://i.kym-cdn.com/news_feeds/icons/mobile/000/031/546/9f5.jpg",
                        name: "Chad",
                        alt: "Chad"
                    },
                    undefined,
                    transaction
                ).then(image =>
                    AliasController.createAlias(
                        "ChadThunderCock",
                        "https://i.kym-cdn.com/news_feeds/icons/mobile/000/031/546/9f5.jpg",
                        user1,
                        image,
                        transaction
                    )
                );

                res.send("success");
            })
    )
);*/
/*dbFixturesRouter.get('/fixturesLoad', async (req, res, next) => {
    sequelize.sync({force:true}).then((): Promise<void> => {
        return runNeo4jQuery('MATCH (nodes) DETACH DELETE nodes', {})
            .then((): void => { return undefined; });
    }).then((): Promise<void> => {
        return runNeo4jQuery('CREATE INDEX ON :Tag(sqlId)', {})
            .catch((e): void => { console.log(e) })
            .then((): void => { return undefined; });
    }).then((): Promise<void> => {
        return runNeo4jQuery('CREATE CONSTRAINT unique_tag_name ON (t:Tag) ASSERT t.name IS UNIQUE', {})
            .catch((e): void => { console.log(e) })
            .then((): void => { return undefined; });
    }).then(async () => {
        try {

                    const promises = [];

            const tag1 = await TagController.create({
                name: 'DC', style: 'background-color: black; font-weight:bold', synonyms: ['DC', 'Detective comics']
            });
            const tag2 = await TagController.create({
                name: 'Batman', style: 'background-color: black; font-weight:bold', synonyms: ['Batman', 'Bruce Wayne']
            });
            const tag3 = await TagController.create({
                name: 'Joker', style: 'background-color: purple; font-weight:bold', synonyms: ['Joker']
            });

            TagController.addParentTag(tag2, tag1);
            TagController.addParentTag(tag3, tag1);

            const tags = [tag1, tag2, tag3];

            const user1 = await User.create({
                email: 'test@test.com',
                password: 'test'
            });
            interface AliasData {
                name: string;
                imageURL: string;
            }

            const aliases: Alias[] = await Promise.all([
                {
                    name: 'batman',
                    imageURL: 'https://webcomicms.net/sites/default/files/clipart/129224/batman-icon-129224-6523819.png',
                },
                {
                    name: 'joker',
                    imageURL: 'https://toppng.com/uploads/preview/joker-smile-picture-free-windows-joker-icon-11553541523i1hwccrokv.png',
                },
                {
                    name: 'Bane',
                    imageURL: 'https://toppng.com/uploads/preview/joker-smile-picture-free-windows-joker-icon-11553541523i1hwccrokv.png',
                }
            ].map(async (aliasObject: AliasData) => {
                return await AliasController.createAlias(aliasObject.name, aliasObject.imageURL, user1);
            }));

            const user2 = await User.create({
                email: 'test2@test.com',
                password: 'test'
            });

            const blog1 = await BlogController.createBlog({
                name: "Gotham daily",
                link: "Gotham_City",
                links: ["https://www.facebook.com/GOTHAMonFOX/", "https://twitter.com/hashtag/gothamcity"],
                description: "The latest and <b>GREATEST</b> news on your favourite disfunctional city",
                alias: aliases[0],
                tags: [tags[1].id]
            });
            await  BlogController.createBlog({
                alias: aliases[1],
                name:"alias 2 default blog",
                link:undefined,
                links: [],
                tags: [],
                description: "Autocreated blog. Edit me, show your stuff!",
                coverImage: {src: getDefaultImageLink()},
                avatar: {src: getDefaultImageLink()}
            });
            await  BlogController.createBlog({
                alias: aliases[2],
                name:"alias 3 blog default",
                link:undefined,
                links: [],
                tags: [],
                description: "Autocreated blog. Edit me, show your stuff!",
                coverImage: {src: getDefaultImageLink()},
                avatar: {src: getDefaultImageLink()}
            });


            for(let i = 0; i < 5; i++) {
                BlogPostController.createBlogPost({
                    content: "Batman is a fictional superhero appearing in American comic books published by DC Comics. The character was created by artist Bob Kane and writer Bill Finger,[2][3] and first appeared in Detective Comics #27 in 1939. Originally named the \"Bat-Man,\" the character is also referred to by such epithets as the Caped Crusader, the Dark Knight, and the World's Greatest Detective.[6]\n" +
                    "\n" +
                    "Batman's secret identity is Bruce Wayne, a wealthy American playboy, philanthropist, and owner of Wayne Enterprises. Batman originated from an incident in Bruce's childhood; after witnessing the murder of his parents Dr. Thomas Wayne and Martha Wayne, he swore vengeance against criminals, an oath tempered by a sense of justice. Bruce trains himself physically and intellectually and crafts a bat-inspired persona to fight crime.[7] ",
                    alias: aliases[0].id,
                    blog: blog1.id,
                    tags: [tag1.id, tag2.id, tag3.id]
                }).then(blogPost1 => {
                    CommentsController.createComment({
                        content: "test comment",
                        alias: aliases[0].id,
                        blogPost: blogPost1
                    }).then(comment1 => {
                        const comment2 = CommentsController.createComment({
                            content: "test reply comment",
                            alias: aliases[1].id,
                            parentComment: comment1
                        });

                        ReactionController.createReaction({
                            type: "like",
                            alias: aliases[0].id,
                            comment: comment1.id
                        })
                        ReactionController.createReaction({
                            type: "like",
                            alias: aliases[0].id,
                            blogPost: blogPost1.id

                        });

                    });
                });
            }

            BlogPostController.createBlogPost({
                content: "Batman is a fictional superhero appearing in American comic books published by DC Comics. The character was created by artist Bob Kane and writer Bill Finger,[2][3] and first appeared in Detective Comics #27 in 1939. Originally named the \"Bat-Man,\" the character is also referred to by such epithets as the Caped Crusader, the Dark Knight, and the World's Greatest Detective.[6]\n" +
                    "\n" +
                    "Batman's secret identity is Bruce Wayne, a wealthy American playboy, philanthropist, and owner of Wayne Enterprises. Batman originated from an incident in Bruce's childhood; after witnessing the murder of his parents Dr. Thomas Wayne and Martha Wayne, he swore vengeance against criminals, an oath tempered by a sense of justice. Bruce trains himself physically and intellectually and crafts a bat-inspired persona to fight crime.[7] ",
                alias: aliases[0].id,
                blog: blog1.id,
                tags: [tag1.id, tag2.id, tag3.id],
                reblogOfBlogPost: 1
            });

            const image1 = await ImageController.createImage({
                src: "https://vignette.wikia.nocookie.net/crysis/images/f/fb/Crynet_nanosuit.jpg",
                name: "Nanosuit",
                alt: "Awesome nanosuit"
            });

            const image2 = await ImageController.createImage({
                src: "https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/Batman_%28DC_Rebirth_version%29.png/220px-Batman_%28DC_Rebirth_version%29.png",
                name: "batsuit",
                alt: "a suit less awesome than the nanosuit"
            });

            const image3 = await ImageController.createImage({
                src: "https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/Batman_%28DC_Rebirth_version%29.png/220px-Batman_%28DC_Rebirth_version%29.png",
                name: "aliasImage",
                alt: "a suit less awesome than the nanosuit"
            });

            // test of sequelize association mixin
            aliases.forEach(alias => {
                alias.setUser(user1.id);
                alias.setAvatar(image3)
            });

            blog1.setAvatar(image1);
            blog1.setCoverImage(image2);

                    const accessControlGroup = await AccessControlGroup.create({
                        accessControlSetting: AccessControlGroup.ACCESS_CONTROL_SETTINGS.specificInclude
                    });

            const accessControlGroup1 = await AccessControlGroup.create({
                accessControlSetting: AccessControlGroup.ACCESS_CONTROL_SETTINGS.full
            });
            const accessControlGroup2 = await AccessControlGroup.create({
                accessControlSetting: AccessControlGroup.ACCESS_CONTROL_SETTINGS.full
            });
            const accessControlGroup3 = await AccessControlGroup.create({
                accessControlSetting: AccessControlGroup.ACCESS_CONTROL_SETTINGS.full
            });
            const accessControlGroup4 = await AccessControlGroup.create({
                accessControlSetting: AccessControlGroup.ACCESS_CONTROL_SETTINGS.full
            });

            await accessControlGroup1.addAlias(aliases[0]);
            await accessControlGroup1.addUser(user1);

            await accessControlGroup.save();

                    await blog1.setContentAccessControl(accessControlGroup1);
                    await blog1.setCommentsAccessControl(accessControlGroup2);
                    await blog1.setReactionsAccessControl(accessControlGroup3);
                    await blog1.setFollowsAccessControl(accessControlGroup4);

            await blog1.save();

            const communityAvatar = await ImageController.createImage({
                src: "https://vignette.wikia.nocookie.net/mountandblade/images/1/15/Harlaus.jpg/revision/latest/top-crop/width/360/height/360?cb=20170303233208",
                name: "Harlaus",
                alt: "Our glorious leader"
            });

            const communityCover = await ImageController.createImage({
                src: "https://encrypted-tbn0.gstatic.com/images?q=tbn%3AANd9GcQGcC1bbNt2SiG0t3sWkoqGBulHZPMYsrCZC8oVAC0AjyfRv9Yy&usqp=CAU",
                name: "Butter",
                alt: "The lifeblood of our kingdom"
            });

            const community1 = CommunityController.createCommunity({
                name: "Swadian feast community",
                link: "butterlords",
                links: ['http:/www.google.com', 'http:/www.taleworldsentertainment.com'],
                rules: [{name:'BUTTERLORDS ONLy', description: 'You MUST love butter in order to join'},
                    {name:'Feasts every monday, wednesday and saturday', description:'Especially if there is a siege going on, No exceptions'}],
                description: 'The group made to fest in the name of Glorious Harlaus',
                avatar: communityAvatar,
                coverImage: communityCover,
                tags: [tag1,tag2,tag3],
                members:[aliases[0]],
                moderators:[aliases[0]],
                contentAccessControl: {accessControlSetting: "full"},
                commentsAccessControl: {accessControlSetting:"full"},
                reactionsAccessControl: {accessControlSetting:"full"},
                followsAccessControl: {accessControlSetting:"full"},
                postingAccessControl: {accessControlSetting:"full"},
                membersAccessControl: {accessControlSetting:"full"}
            }).then(community => {
                for(let i = 0; i < 5; i++) {
                    BlogPostController.createBlogPost({
                        content: "Batman is a fictional superhero appearing in American comic books published by DC Comics. The character was created by artist Bob Kane and writer Bill Finger,[2][3] and first appeared in Detective Comics #27 in 1939. Originally named the \"Bat-Man,\" the character is also referred to by such epithets as the Caped Crusader, the Dark Knight, and the World's Greatest Detective.[6]\n" +
                        "\n" +
                        "Batman's secret identity is Bruce Wayne, a wealthy American playboy, philanthropist, and owner of Wayne Enterprises. Batman originated from an incident in Bruce's childhood; after witnessing the murder of his parents Dr. Thomas Wayne and Martha Wayne, he swore vengeance against criminals, an oath tempered by a sense of justice. Bruce trains himself physically and intellectually and crafts a bat-inspired persona to fight crime.[7] ",
                        alias: aliases[1].id,
                        community: community.id,
                        tags: [tag2.id]
                    }).then(blogPost1 => {
                        CommentsController.createComment({
                            content: "test comment",
                            alias: aliases[0].id,
                            blogPost: blogPost1
                        }).then(comment1 => {
                            const comment2 = CommentsController.createComment({
                                content: "test reply comment",
                                alias: aliases[1].id,
                                parentComment: comment1
                            });

                            ReactionController.createReaction({
                                type: "like",
                                alias: aliases[2].id,
                                comment: comment1.id
                            })
                            ReactionController.createReaction({
                                type: "like",
                                alias: aliases[1].id,
                                blogPost: blogPost1.id

                            });

                        });
                    });
                }
            });

            promises.push(community1);

            Promise.all(promises).then(() => {
                res.send('success');
            }).catch(e => {
                console.log(e.stack);
                res.send(e.stack);
            })


        }catch (e) {
            console.log(e.stack);
            res.send(e.stack);
        }
    }).catch((err:any) => {
        console.log(err.stack);
        res.send(err.stack);
    });
});
*/
/*dbFixturesRouter.get("/test", ({}, res) => {
    sequelize
        .sync({ force: true })
        .then((): any => {
            res.send("done");
        })
        .catch(() => {
            res.send("catch");
        });
    // const token = MediaserverService.uploadImage();
    MediaserverService.getImage("d5ddd7cb-14b9-4dd5-9549-bf87ce1e5fef");
    res.send('token');
});*/

/*dbFixturesRouter.post("/testACG", auth, async () => {
    return AuthService.userHasEditPermissionsForEntity("blog", user ).then((result) => {
        res.send(result)
    }).catch((e:any) => {
        console.log(e);
        res.send(e)
    })
});

dbFixturesRouter.post("/test/upload", (req: any, res) => {
    console.log(req.files);
    return MediaserverService.uploadImageFromTmpFile(
        req.files.image.tempFilePath
    );
    res.send(req.files);
});*/

export { dbFixturesRouter };
