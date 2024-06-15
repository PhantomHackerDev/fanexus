import { Tag } from "../Entity/Tag";
import { Blog } from "../Entity/Blog";
import { Image } from "../Entity/Image";
import { Community } from "../Entity/Community";
import { runNeo4jQuery } from "../services/Neo4jService";
import { TagInterface } from "../Interface/TagInterface";
import { Sequelize, Op, Transaction } from "sequelize";
import { User } from "../Entity/User";
import { Follow } from "../Entity/Follow";
import { database as sequelize } from "../services/databaseService.js";

class TagController {
    public create(
        {
            name,
            synonyms = [],
            description,
            style,
            parentTags,
            childTags
        }: TagInterface,
        transaction: Transaction
    ): Promise<Tag> {
        if (!name) {
            throw new Error("Tag requires a name.");
        }

        const tag: Tag = Tag.build({
            name,
            description,
            style,
            synonyms: [...new Set([name].concat(synonyms))]
        });

        return Promise.all([
            tag.save({ transaction }),
            Promise.all(
                parentTags.map(parentName =>
                    Tag.findOrCreate({
                        where: { name: parentName },
                        transaction
                    }).then(([foundTag, created]) =>
                        created
                            ? foundTag.update(
                                  {
                                      synonyms: [parentName]
                                  },
                                  { transaction }
                              )
                            : foundTag
                    )
                )
            ),
            Promise.all(
                childTags.map(childName =>
                    Tag.findOrCreate({
                        where: { name: childName },
                        transaction
                    }).then(([foundTag, created]) =>
                        created
                            ? foundTag.update(
                                  {
                                      synonyms: [childName]
                                  },
                                  { transaction }
                              )
                            : foundTag
                    )
                )
            )
            // Promise.all(
            // synonyms.map(synonymName =>
            // Tag.findOrCreate({ where: { name: synonymName } }).then(
            // ([foundTag, created]) =>
            // created
            // ? foundTag.update({
            // synonyms: [synonymName]
            // })
            // : foundTag
            // )
            // )
            // )
        ]).then(
            ([
                newTag,
                parentTagObjects,
                childTagObjects
                // synonymTagObjects
            ]) => {
                return runNeo4jQuery(
                    [
                        `MERGE (newTag:Tag {name: $newTagName, sqlId: $newTagId})`,
                        ...Array.from(
                            { length: parentTags.length },
                            (_, index) =>
                                `MERGE (parentTag${index}:Tag {name: $parentTag${index}Name, sqlId: $parentTag${index}Id}) MERGE (parentTag${index})<-[:HAS_PARENT]-(newTag)`
                        ),
                        ...Array.from(
                            { length: childTags.length },
                            (_, index) =>
                                `MERGE (childTag${index}:Tag {name: $childTag${index}Name, sqlId: $childTag${index}Id}) MERGE (childTag${index})-[:HAS_PARENT]->(newTag)`
                        ),
                        // ...Array.from(
                        // { length: synonyms.length },
                        // (_, index) =>
                        // `MERGE (synonymTag${index}:Tag {name: $synonymTag${index}Name, sqlId: $synonymTag${index}Id}) MERGE (synonymTag${index})-[:SYNONYM]-(newTag)`
                        // ),
                        "RETURN newTag"
                    ].join(" "),
                    Object.assign(
                        {
                            newTagName: newTag.name,
                            newTagId: newTag.id
                        },
                        ...parentTagObjects.map((parentTag, index) => ({
                            [`parentTag${index}Name`]: parentTag.name,
                            [`parentTag${index}Id`]: parentTag.id
                        })),
                        ...childTagObjects.map((childTag, index) => ({
                            [`childTag${index}Name`]: childTag.name,
                            [`childTag${index}Id`]: childTag.id
                        }))
                        // ...synonymTagObjects.map((synonymTag, index) => ({
                        // [`synonymTag${index}Name`]: synonymTag.name,
                        // [`synonymTag${index}Id`]: synonymTag.id
                        // }))
                    )
                ).then(() => newTag);
            }
        );
    }

    public getTag(tagId: number): Promise<Tag> {
        return Promise.resolve(
            Tag.findOne({
                where: {
                    id: tagId
                }
            }).then((tag: Tag) => {
                return tag;
            })
        );
    }

    public getOrCreateTag(name: string, transaction: Transaction) {
        return Tag.findOne({
            where: {
                [Op.or]: [
                    Sequelize.where(
                        Sequelize.fn("LOWER", Sequelize.col("name")),
                        Sequelize.fn("LOWER", name)
                    ),
                    Sequelize.literal(
                        `LOWER(${sequelize.escape(
                            name
                        )}) = ANY(LOWER(synonyms::text)::text[])`
                    )
                ]
            },
            transaction
        }).then(foundTag =>
            foundTag
                ? {
                      ...(foundTag.toJSON() as Tag),
                      displaySynonym: name
                  }
                : Tag.create({ name }, { transaction }).then(tag =>
                      Promise.all([
                          tag.update(
                              {
                                  synonyms: [name]
                              },
                              { transaction }
                          ),
                          runNeo4jQuery(
                              "MERGE (t:Tag {name: $name}) RETURN t",
                              { name }
                          ).then(() =>
                              runNeo4jQuery(
                                  "MATCH (t: Tag {name: $name}) SET t += {name: $name, sqlId: $id} RETURN t",
                                  { name, id: tag.id }
                              )
                          )
                      ]).then(([updatedTag]) => updatedTag)
                  )
        );
    }

    public getTagInfo(tagName: string, currentAlias: number): Promise<any> {
        return Promise.all([
            Tag.findOne({
                where: {
                    name: tagName
                },
                attributes: {
                    include: [
                        [
                            Sequelize.literal(
                                `(SELECT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${currentAlias} AND "Follows"."followTagId"="Tag"."id"  AND "Follows"."followType" = ${Follow.FOLLOW_TYPES.follow}))`
                            ),
                            "aliasFollowing"
                        ],
                        [
                            Sequelize.literal(
                                `(SELECT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${currentAlias} AND "Follows"."followTagId"="Tag"."id"  AND "Follows"."followType" = ${Follow.FOLLOW_TYPES.block}))`
                            ),
                            "aliasBlocking"
                        ]
                    ]
                }
            }),
            runNeo4jQuery(
                `MATCH (tag:Tag {name: $tagName})-[:HAS_PARENT]->(parent:Tag)
                RETURN parent.name`,
                { tagName }
            ).then(({ records }) =>
                records.map(result => result.get("parent.name"))
            ),
            runNeo4jQuery(
                `MATCH (tag:Tag {name: $tagName})<-[:HAS_PARENT]-(child:Tag)
                RETURN child.name`,
                { tagName }
            ).then(({ records }) =>
                records.map(result => result.get("child.name"))
            ),
            runNeo4jQuery(
                `MATCH p=(tag:Tag {name: $tagName})-[:HAS_PARENT*]->(tag)
                RETURN nodes(p)`,
                { tagName }
            ).then(({ records }) =>
                records.map(result =>
                    result
                        .get("nodes(p)")
                        .map(
                            ({
                                properties
                            }: {
                                properties: { name: string };
                            }) => properties.name
                        )
                )
            )
        ]).then(([tag, parentTags, childTags, loops]) => ({
            tag,
            parentTags,
            childTags,
            loops
        }));
    }

    public getTagDetailed(
        tagId: number | string,
        currentAlias: number
    ): Promise<Tag> {
        return Tag.findDetailed(tagId, currentAlias);
    }

    public findTag(tagName: string): Promise<Tag[]> {
        return Promise.resolve(
            Tag.findAll({
                where: {
                    name: {
                        [Op.iLike]: `%${tagName}%`
                    }
                }
            }).then((tags: Tag[]) => {
                return tags;
            })
        );
    }

    public update(
        tag: Tag,
        {
            name,
            description,
            style,
            synonyms = [],
            parentTags,
            childTags,
            isLocked
        }: TagInterface,
        transaction: Transaction
    ): Promise<Tag> {
        return Promise.all([
            tag.update(
                {
                    name,
                    description,
                    style,
                    isLocked
                },
                { transaction }
            ),
            runNeo4jQuery(
                `MATCH (t:Tag {sqlId: $id}) SET t += { name: $name } RETURN t`,
                { id: tag.id, name }
            )
        ])
            .then(([updatedTag]) =>
                Promise.all([
                    updatedTag.update(
                        {
                            description,
                            style,
                            synonyms: [...new Set([name].concat(synonyms))]
                        },
                        { transaction }
                    ),
                    Promise.all(
                        parentTags.map(parentName =>
                            Tag.findOrCreate({
                                where: { name: parentName },
                                transaction
                            }).then(([foundTag, created]) =>
                                created
                                    ? foundTag.update(
                                          {
                                              synonyms: [parentName]
                                          },
                                          { transaction }
                                      )
                                    : foundTag
                            )
                        )
                    ),
                    Promise.all(
                        childTags.map(childName =>
                            Tag.findOrCreate({
                                where: { name: childName },
                                transaction
                            }).then(([foundTag, created]) =>
                                created
                                    ? foundTag.update(
                                          {
                                              synonyms: [childName]
                                          },
                                          { transaction }
                                      )
                                    : foundTag
                            )
                        )
                    )
                    // Promise.all(
                    // synonyms.map(synonymName =>
                    // Tag.findOrCreate({
                    // where: { name: synonymName },
                    // transaction
                    // }).then(([foundTag, created]) =>
                    // created
                    // ? foundTag.update(
                    // {
                    // synonyms: [synonymName]
                    // },
                    // { transaction }
                    // )
                    // : foundTag
                    // )
                    // )
                    // )
                ])
            )
            .then(
                ([
                    newTag,
                    parentTagObjects,
                    childTagObjects
                    // synonymTagObjects
                ]) => {
                    return runNeo4jQuery(
                        [
                            `MATCH (newTag:Tag {sqlId: $newTagId})`,
                            ...Array.from(
                                { length: parentTags.length },
                                (_, index) =>
                                    `MERGE (parentTag${index}:Tag {name: $parentTag${index}Name, sqlId: $parentTag${index}Id}) MERGE (parentTag${index})<-[:HAS_PARENT]-(newTag)`
                            ),
                            ...Array.from(
                                { length: childTags.length },
                                (_, index) =>
                                    `MERGE (childTag${index}:Tag {name: $childTag${index}Name, sqlId: $childTag${index}Id}) MERGE (childTag${index})-[:HAS_PARENT]->(newTag)`
                            ),
                            // ...Array.from(
                            // { length: synonyms.length },
                            // (_, index) =>
                            // `MERGE (synonymTag${index}:Tag {name: $synonymTag${index}Name, sqlId: $synonymTag${index}Id}) MERGE (synonymTag${index})-[:SYNONYM]-(newTag)`
                            // ),
                            "WITH newTag",
                            "OPTIONAL MATCH (newTag)-[pr:HAS_PARENT]->(p:Tag) WHERE NOT p.name IN $parentTagsParam",
                            "OPTIONAL MATCH (newTag)<-[cr:HAS_PARENT]-(c:Tag) WHERE NOT c.name IN $childTagsParam",
                            // "OPTIONAL MATCH (newTag)-[sr:SYNONYM]-(s:Tag) WHERE NOT s.name IN $synonymTagsParam",
                            "DELETE pr",
                            "DELETE cr",
                            // "DELETE sr",
                            "RETURN newTag"
                        ].join(" "),
                        Object.assign(
                            {
                                newTagId: newTag.id,
                                parentTagsParam: parentTags,
                                childTagsParam: childTags
                                // synonymTagsParam: synonyms
                            },
                            ...parentTagObjects.map((parentTag, index) => ({
                                [`parentTag${index}Name`]: parentTag.name,
                                [`parentTag${index}Id`]: parentTag.id
                            })),
                            ...childTagObjects.map((childTag, index) => ({
                                [`childTag${index}Name`]: childTag.name,
                                [`childTag${index}Id`]: childTag.id
                            }))
                            // ...synonymTagObjects.map((synonymTag, index) => ({
                            // [`synonymTag${index}Name`]: synonymTag.name,
                            // [`synonymTag${index}Id`]: synonymTag.id
                            // }))
                        )
                    ).then(() => newTag);
                }
            );
    }

    public addParentTag(tag1: Tag | number, tag2: Tag | number) {
        const fetchTagPromises: Promise<Tag>[] = [];
        if (typeof tag1 === "number") {
            fetchTagPromises.push(
                this.getTag(tag1).then(fetchedTag => {
                    tag1 = fetchedTag;
                    return tag1;
                })
            );
        }
        if (typeof tag2 === "number") {
            fetchTagPromises.push(
                this.getTag(tag2).then((fetchedTag: Tag) => {
                    tag2 = fetchedTag;
                    return tag2;
                })
            );
        }

        return Promise.all(fetchTagPromises).then(() => {
            if (typeof tag1 === "object" && typeof tag2 === "object") {
                return runNeo4jQuery(
                    "MATCH (t1:Tag{sqlId: $sqlIdTag1Param}), (t2:Tag{sqlId: $sqlIdTag2Param}) " +
                        "MERGE (t1)-[rel:HAS_PARENT]->(t2) " +
                        "RETURN t1,t2,rel",
                    {
                        sqlIdTag1Param: tag1.id,
                        sqlIdTag2Param: tag2.id
                    }
                ).catch(e => {
                    console.log(e);
                    throw new Error(e);
                });
            } else {
                throw Error(
                    "Error in adding parent tag, tags not instances of Tag"
                );
            }
        });
    }

    public removeParentTag(tag1: Tag | number, tag2: Tag | number) {
        const fetchTagPromises: Promise<Tag>[] = [];
        if (typeof tag1 === "number") {
            fetchTagPromises.push(
                this.getTag(tag1).then(fetchedTag => {
                    tag1 = fetchedTag;
                    return tag1;
                })
            );
        }
        if (typeof tag2 === "number") {
            fetchTagPromises.push(
                Promise.resolve(
                    Tag.findByPk(tag2).then((fetchedTag: Tag) => {
                        tag2 = fetchedTag;
                        return tag2;
                    })
                )
            );
        }

        return Promise.all(fetchTagPromises).then(() => {
            if (typeof tag1 === "object" && typeof tag2 === "object") {
                return runNeo4jQuery(
                    "MATCH (t1:Tag{sqlId: $sqlIdTag1Param})-[rel:HAS_PARENT]->(t2:Tag{sqlId: $sqlIdTag2Param}) " +
                        "DELETE rel " +
                        "RETURN t1,t2",
                    {
                        sqlIdTag1Param: tag1.id,
                        sqlIdTag2Param: tag2.id
                    }
                ).catch(e => {
                    console.log(e);
                    throw new Error(e);
                });
            } else {
                throw Error(
                    "Error in adding parent tag, tags not instances of Tag"
                );
            }
        });
    }

    public addChildTag(tag1: Tag | number, tag2: Tag | number) {
        return this.addParentTag(tag2, tag1);
    }

    public removeChildTag(tag1: Tag | number, tag2: Tag | number) {
        return this.removeParentTag(tag2, tag1);
    }

    public getAllDescendants(tagId: number | string) {
        return runNeo4jQuery(
            `MATCH (tag: Tag {sqlId: $id})<-[:HAS_PARENT*]-(children:Tag)` +
                // `MATCH p=(tag:Tag {sqlId: $id})-[:HAS_PARENT|SYNONYM*]-(children:Tag)
                // WITH p, nodes(p) AS ns, relationships(p) as rs, children
                // WHERE REDUCE(acc = [0, 1], r in rs |
                // [acc[0]+1, CASE WHEN
                // type(r)="SYNONYM" OR
                // endNode(r)=ns[acc[0]]
                // THEN acc[1] ELSE 0
                // END
                // ]
                // )[1]=1
                `RETURN children.sqlId`,
            { id: Number(tagId) }
        ).then(({ records }) =>
            records.map(record => record.get("children.sqlId"))
        );
    }

    public getAllDescendantsByName(tagName: string) {
        return Tag.findOne({
            where: {
                name: tagName
            }
        }).then(tag => {
            if (!tag) {
                return Promise.reject("Tag not found");
            }

            return runNeo4jQuery(
                `MERGE (tag:Tag {name: $name, sqlId: $id}) return tag`,
                {
                    name: tagName,
                    id: tag.id
                }
            )
                .then(() =>
                    runNeo4jQuery(
                        `MATCH (tag:Tag {name: $name})` +
                            `OPTIONAL MATCH (tag)<-[:HAS_PARENT*]-(children:Tag)` +
                            // OPTIONAL MATCH p = (tag)-[:HAS_PARENT|SYNONYM*]-(children:Tag)
                            // WITH p, nodes(p) AS ns, relationships(p) as rs, tag, children
                            // WHERE REDUCE(acc = [0, 1], r in rs |
                            // [acc[0]+1, CASE WHEN
                            // type(r)="SYNONYM" OR
                            // endNode(r)=ns[acc[0]]
                            // THEN acc[1] ELSE 0
                            // END
                            // ]
                            // )[1]=1
                            `RETURN tag.sqlId, children.sqlId`,
                        { name: tagName }
                    )
                )
                .then(({ records }) => {
                    const tagPairs: string[][] = records.map(record => [
                        record.get("children.sqlId"),
                        record.get("tag.sqlId")
                    ]);
                    const emptyArray: string[] = [];
                    const allTags: string[] = emptyArray.concat(...tagPairs);
                    return [...new Set(allTags.filter(tagItem => tagItem))];
                });
        });
    }

    public getBlogs(
        currentAlias: number,
        blockedTagIds: number[],
        searchedTagIdArrays: number[][],
        gettingAsUser: null | User = null
    ): Promise<Blog[]> {
        const blockedTagIdsSQLArray = blockedTagIds.length
            ? `(${blockedTagIds.join(",")})`
            : "(NULL)";
        const searchedTagIdsSQLArrays: string[] = searchedTagIdArrays.map(
            searchedTagIdArray =>
                searchedTagIdArray.length
                    ? `(${searchedTagIdArray.join(",")})`
                    : "(NULL)"
        );
        return Promise.resolve(
            Blog.findAll({
                where: {
                    [Op.and]: [
                        ...searchedTagIdsSQLArrays.map(searchedTagIDsSQLArray =>
                            Sequelize.literal(
                                `EXISTS (SELECT 1 FROM "Tags" INNER JOIN "Blog_Tag" ON "Tags"."id" IN ${searchedTagIDsSQLArray} AND "Tags"."id"="Blog_Tag"."TagId" WHERE "Blog_Tag"."BlogId" = "Blog"."id")`
                            )
                        ),
                        // viewer alias blocked blog
                        Sequelize.literal(
                            `NOT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${Number(
                                currentAlias
                            )} AND "Follows"."followBlogId"="Blog"."id" AND "Follows"."followType" = 0)`
                        ),
                        // viewer alias blocked blog author
                        Sequelize.literal(
                            `NOT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${Number(
                                currentAlias
                            )} AND "Follows"."followAliasId"="Blog"."AliasId" AND "Follows"."followType" = 0)`
                        ),
                        // blog author blocked viewer alias
                        Sequelize.literal(
                            `NOT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"="Blog"."AliasId" AND "Follows"."followAliasId"=${Number(
                                currentAlias
                            )} AND "Follows"."followType" = 0)`
                        ),
                        // blogpost author is minor and viewer is blocking minors
                        Sequelize.literal(
                            `NOT EXISTS (SELECT 1 FROM "Aliases" AS "AuthorAlias" JOIN "Aliases" AS "ViewerAlias" ON "ViewerAlias"."id"=${Number(
                                currentAlias
                            )} WHERE "AuthorAlias"."id"="Blog"."AliasId" AND "AuthorAlias"."isMinor"=TRUE AND "ViewerAlias"."showMinors"=FALSE)`
                        ),
                        // viewer is minor and blog author is blocking minors
                        ...(!(gettingAsUser && gettingAsUser.id) ||
                        gettingAsUser.isMinor
                            ? [
                                  Sequelize.literal(
                                      'NOT EXISTS (SELECT 1 FROM "Aliases" Where "Blog"."AliasId"="Aliases"."id" AND "Aliases"."showMinors"=false)'
                                  )
                              ]
                            : []),
                        // viewer alias blocked tag or its descendants which is on blog
                        Sequelize.literal(
                            `NOT EXISTS( SELECT 1 FROM "Blog_Tag" WHERE "Blog_Tag"."TagId" IN ${blockedTagIdsSQLArray} AND "Blog_Tag"."BlogId" = "Blog"."id")`
                        )
                    ],
                    hideFromSearchResults: false
                },
                include: [
                    {
                        model: Tag,
                        through: { attributes: ["displaySynonym"] }
                    },
                    {
                        model: Image,
                        as: "avatar"
                    },
                    {
                        model: Image,
                        as: "coverImage"
                    }
                ]
            })
        );
    }

    public getCommunities(
        currentAlias: number,
        blockedTagIds: number[],
        searchedTagIdArrays: number[][],
        gettingAsUser: null | User = null,
        transaction: Transaction
    ): Promise<Community[]> {
        const blockedTagIdsSQLArray = blockedTagIds.length
            ? `(${blockedTagIds.join(",")})`
            : "(NULL)";
        const searchedTagIdsSQLArrays: string[] = searchedTagIdArrays.map(
            searchedTagIdArray =>
                searchedTagIdArray.length
                    ? `(${searchedTagIdArray.join(",")})`
                    : "(NULL)"
        );
        return Promise.resolve(
            Community.findAll({
                where: {
                    [Op.and]: [
                        ...searchedTagIdsSQLArrays.map(searchedTagIdsSQLArray =>
                            Sequelize.literal(
                                `EXISTS (SELECT 1 FROM "Tags" INNER JOIN "Community_Tag" ON "Tags"."id" IN ${searchedTagIdsSQLArray} AND "Tags"."id"="Community_Tag"."TagId" WHERE "Community_Tag"."CommunityId" = "Community"."id")`
                            )
                        ),
                        // dont show if blocked
                        Sequelize.literal(
                            `(SELECT NOT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${currentAlias} AND "Follows"."followCommunityId"="Community"."id" AND "Follows"."followType"=${Follow.FOLLOW_TYPES.block}))`
                        ),
                        // dont show communities with blocked tags
                        Sequelize.literal(
                            `(SELECT NOT EXISTS (SELECT 1 FROM "Follows" WHERE "Follows"."AliasId"=${currentAlias} AND "Follows"."followCommunityId"="Community"."id" AND "Follows"."followType"=${Follow.FOLLOW_TYPES.block}))`
                        ),
                        // dont show if one tag in community is blocked
                        Sequelize.literal(
                            `NOT EXISTS( SELECT 1 FROM "Community_Tag" WHERE "Community_Tag"."TagId" IN ${blockedTagIdsSQLArray} AND "Community_Tag"."CommunityId" = "Community"."id")`
                        )
                    ],
                    hideFromSearchResults: false,
                    ...(!(gettingAsUser && gettingAsUser.id) ||
                    gettingAsUser.isMinor
                        ? { showMinors: true }
                        : {})
                },
                include: [
                    {
                        model: Tag,
                        through: { attributes: [] }
                    },
                    {
                        model: Image,
                        as: "avatar"
                    },
                    {
                        model: Image,
                        as: "coverImage"
                    }
                ],
                transaction
            })
        );
    }

    public deleteTag(tagId: number): Promise<any> {
        return Promise.resolve(
            Tag.findByPk(tagId).then(tag => {
                if (!tag) {
                    return Promise.reject({
                        status: 404,
                        message: "Tag not found."
                    });
                }
                return sequelize
                    .transaction(transaction =>
                        tag.destroy({ transaction }).then(() => {
                            return runNeo4jQuery(
                                "MATCH(n:Tag {sqlId:$tagId}) DELETE n",
                                { tagId }
                            ).then(r => {
                                return Promise.resolve(r);
                            });
                        })
                    )
                    .catch(e => {
                        return Promise.reject(e);
                    });
            })
        );
    }

    public filterLockedTags(tags: string[]): Promise<string[]> {
        let filteredTags: string[] = [];
        let tagPromises: Promise<any>[] = [];

        tags.forEach(tagName => {
            tagPromises.push(
                Promise.resolve(
                    Tag.findOne({ where: { name: tagName } }).then(foundTag => {
                        if (foundTag) {
                            if (foundTag.isLocked) {
                                // do nothing
                            } else {
                                filteredTags.push(tagName);
                            }
                        } else {
                            filteredTags.push(tagName);
                        }
                    })
                )
            );
        });
        return Promise.all(tagPromises).then(() => {
            return Promise.resolve(filteredTags);
        });
    }
}

const controller = new TagController();
export { controller as TagController };
