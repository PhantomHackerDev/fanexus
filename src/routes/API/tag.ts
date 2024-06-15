import express from "express";
import { Tag } from "../../Entity/Tag";
import { TagController } from "../../Controller/TagController";
import { ErrorReportService } from "../../services/ErrorReportService";
import {
    auth,
    isSuperTagWrangler,
    AuthRequest
} from "../../Authorization/auth";
import { Alias } from "../../Entity/Alias";
import { BlogPost, orders } from "../../Entity/BlogPost";
import { Blog } from "../../Entity/Blog";
import { Community } from "../../Entity/Community";
import { database as sequelize } from "../../services/databaseService.js";
import { QueryTypes } from "sequelize";
import { Response } from "express";
import { FollowController } from "../../Controller/FollowController";
import { StatusCodes } from "http-status-codes";

const tagRouter = express.Router();
interface foundSynonymTagInterface {
    id: number;
    synonyms: string[];
    displaySynonym: string;
    name: string;
}
tagRouter.get(
    "/:tagSynonym?",
    auth,
    (req: AuthRequest, res: Response): Promise<Response> => {
        const tagsQuery: Promise<Tag[]> = req.params.tagSynonym
            ? sequelize.query(
                  `SELECT DISTINCT "Tag".*, CHAR_LENGTH(CASE WHEN name ILIKE :tagSynonymPart THEN name ELSE s END) AS length FROM "Tags" AS "Tag", unnest(CASE WHEN synonyms <> '{}' THEN synonyms ELSE '{null}' END) AS s WHERE s ILIKE :tagSynonymPart OR name ILIKE :tagSynonymPart ORDER BY length LIMIT 10`,
                  {
                      replacements: {
                          tagSynonymPart: `%${req.params.tagSynonym
                              .replace("\\", "\\\\")
                              .replace("%", "\\%")
                              .replace("_", "\\_")}%`
                      },
                      type: QueryTypes.SELECT
                  }
              )
            : Tag.findAll();

        return tagsQuery
            .then(
                (tags): Response<foundSynonymTagInterface[]> => {
                    const result = tags.flatMap(
                        ({ id, name, synonyms, isLocked }) =>
                            [name]
                                .concat(synonyms ? synonyms : [])
                                .filter(synonym =>
                                    synonym
                                        .toUpperCase()
                                        .includes(
                                            req.params.tagSynonym.toUpperCase()
                                        )
                                )
                                .map(synonym => ({
                                    id,
                                    synonyms,
                                    displaySynonym: synonym,
                                    name,
                                    isLocked
                                }))
                    );
                    return res.send(result);
                }
            )
            .catch(e => {
                return res.send(e);
            });
    }
);

tagRouter.get(
    "/:tagName/info",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        TagController.getTagInfo(req.params.tagName, req.currentAlias)
            .then(result => {
                if (!result.tag) {
                    return Promise.reject({
                        status: 404,
                        message: "Tag not found."
                    });
                }
                return res.send(result);
            })
            .catch(e =>
                res
                    .status(e.status || StatusCodes.BAD_REQUEST)
                    .send(e.message || e)
            )
);

tagRouter.get(
    "/:tagSynonym/followedBy",
    auth,
    (req: AuthRequest, res: Response): Promise<Response> => {
        const tagsQuery: Promise<Tag[]> = sequelize.query(
            `SELECT * FROM "Tags" AS "Tag", unnest(synonyms) AS s WHERE s ILIKE :tagSynonymPart LIMIT 10`,
            {
                replacements: {
                    tagSynonymPart: "%" + req.params.tagSynonym + "%"
                },
                type: QueryTypes.SELECT
            }
        );

        return tagsQuery
            .then(tags =>
                Promise.all(
                    tags.map(
                        (tag): Promise<Tag> =>
                            Tag.findOne({
                                where: { id: tag.id },
                                include: [
                                    {
                                        model: Alias,
                                        as: "followedBy",
                                        attributes: ["id", "name", "avatarId"]
                                    }
                                ]
                            })
                    )
                )
            )
            .then((resultTags: Tag[]) => res.send(resultTags))
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e));
    }
);

tagRouter.get(
    "/:tagNames/blogPosts/:page(\\d+)?/:order(liked|commented|reblogged|score|id|undefined)?/:page(\\d)?",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        sequelize
            .transaction(transaction => {
                // This is the "search bar"
                const UserId = Number(req.user.id);
                const AliasId = req.currentAlias;
                const gettingAsUser = req.user;
                const order = req.params.order as
                    | undefined
                    | keyof typeof orders;
                let tagNames = JSON.parse(req.params.tagNames);
                const conditions = {
                    UserId,
                    gettingAsUser,
                    AliasId,
                    tagNames
                };

                return Promise.all([
                    FollowController.getRelevantTagIdsForAlias(
                        AliasId,
                        gettingAsUser.isMinor,
                        transaction
                    ),
                    ...tagNames.map((tagName: string) =>
                        TagController.getAllDescendantsByName(tagName)
                    )
                ]).then(
                    ([{ blocks: blockedTagIds }, ...searchedTagsIdArrays]) => {
                        // console.log(searchedTagsIdArrays);

                        return Promise.all([
                            BlogPost.getBlogPosts(
                                {
                                    ...conditions,
                                    ...(order && { order }),
                                    page: Number(req.params.page) || 1,
                                    isSearch: true,
                                    blockedTagIds,
                                    searchedTagsIdArrays
                                },
                                transaction
                            ),
                            Tag.getTagsCount(conditions, transaction)
                        ]).then(([results, tagCounts]) =>
                            res.send({ ...results, tagCounts })
                        );
                    }
                );
            })
            .catch(e => {
                console.error(e);
                return res.status(StatusCodes.BAD_REQUEST).send(e);
            })
);

tagRouter.get(
    "/:tagNames/blogs/:page(\\d+)?",
    auth,
    (req: AuthRequest, res): Promise<Response> =>
        sequelize
            .transaction(transaction =>
                Promise.all([
                    FollowController.getRelevantTagIdsForAlias(
                        req.currentAlias,
                        req.user.isMinor,
                        transaction
                    ),
                    ...JSON.parse(req.params.tagNames).map((tagName: string) =>
                        TagController.getAllDescendantsByName(tagName)
                    )
                ]).then(([{ blocks: blockedTagIds }, ...searchTagIdArrays]) =>
                    TagController.getBlogs(
                        req.currentAlias,
                        blockedTagIds,
                        searchTagIdArrays,
                        req.user
                    ).then((blogs: Blog[]) => res.send(blogs))
                )
            )
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e))
);

tagRouter.get(
    "/:tagNames/communities/:page(\\d+)?",
    auth,
    (req: AuthRequest, res) =>
        sequelize
            .transaction(transaction =>
                Promise.all([
                    FollowController.getRelevantTagIdsForAlias(
                        req.currentAlias,
                        req.user.isMinor,
                        transaction
                    ),
                    ...JSON.parse(req.params.tagNames).map((tagName: string) =>
                        TagController.getAllDescendantsByName(tagName)
                    )
                ]).then(([{ blocks: blockedTagIds }, ...searchTagIdArrays]) => {
                    return TagController.getCommunities(
                        req.currentAlias,
                        blockedTagIds,
                        searchTagIdArrays,
                        req.user,
                        transaction
                    ).then((communities: Community[]) => {
                        return res.send(communities);
                    });
                })
            )
            .catch(e => {
                console.log(e);
                return res.status(StatusCodes.BAD_REQUEST).send(e);
            })
);

tagRouter.get(
    "/id/:id",
    auth,
    (req: AuthRequest, res: Response): Promise<Response> =>
        TagController.getTagDetailed(req.params.id, req.currentAlias)
            .then(tag => res.send(tag))
            .catch(e =>
                res
                    .status(StatusCodes.BAD_REQUEST)
                    .send(
                        ErrorReportService.getEnvError(
                            e,
                            "tag_detailedView_fail"
                        )
                    )
            )
);

tagRouter.get(
    "/id/:id/followedBy",
    auth,
    (req: AuthRequest, res: Response): Promise<Response> =>
        Tag.findOne({
            where: { id: req.params.id },
            include: [
                {
                    model: Alias,
                    as: "followedBy",
                    attributes: ["id", "name", "avatarId"]
                }
            ]
        })
            .then(tag => res.send(tag))
            .catch(e =>
                res.send(
                    ErrorReportService.getEnvError(e, "tag_detailedView_fail")
                )
            )
);

tagRouter.put(
    "/:tagName",
    auth,
    (req: AuthRequest, res: Response): Promise<Response> => {
        let filterTagPromises: Promise<any>[] = [];
        let filteredTagParents = req.body.parentTags;
        let filteredTagChildren = req.body.childTags;
        if (false === (req.user.tagWrangler || req.user.superTagWrangler)) {
            filterTagPromises.push(
                TagController.filterLockedTags(req.body.parentTags).then(
                    filteredParents => {
                        filteredTagParents = filteredParents;
                    }
                )
            );
            filterTagPromises.push(
                TagController.filterLockedTags(req.body.childTags).then(
                    filteredChildren => {
                        filteredTagChildren = filteredChildren;
                    }
                )
            );
        }

        return Promise.all(filterTagPromises)
            .then(() => {
                return sequelize.transaction(transaction =>
                    TagController.create(
                        {
                            name: req.params.tagName,
                            style: req.body.style,
                            synonyms: req.body.synonyms,
                            parentTags: filteredTagParents,
                            childTags: filteredTagChildren,
                            description: req.body.description
                        },
                        transaction
                    ).then((tag: Tag) => res.send(tag))
                );
            })
            .catch(e =>
                res
                    .status(StatusCodes.BAD_REQUEST)
                    .send(
                        ErrorReportService.getEnvError(
                            e,
                            "tag_detailedView_fail"
                        )
                    )
            );
    }
);

tagRouter.patch(
    "/:tagName",
    auth,
    (req: AuthRequest, res: Response): Promise<Response> => {
        let filterTagPromises: Promise<any>[] = [];
        let filteredTagParents = req.body.parentTags;
        let filteredTagChildren = req.body.childTags;
        if (false === (req.user.tagWrangler || req.user.superTagWrangler)) {
            filterTagPromises.push(
                TagController.filterLockedTags(req.body.parentTags).then(
                    filteredParents => {
                        filteredTagParents = filteredParents;
                    }
                )
            );
            filterTagPromises.push(
                TagController.filterLockedTags(req.body.childTags).then(
                    filteredChildren => {
                        filteredTagChildren = filteredChildren;
                    }
                )
            );
        }
        return Promise.all(filterTagPromises)
            .then(() => {
                return sequelize.transaction(transaction =>
                    Tag.findOne({
                        where: { name: req.params.tagName },
                        transaction
                    }).then(tag => {
                        if (!tag) {
                            return Promise.reject({
                                status: 404,
                                message: "Tag not found."
                            });
                        }
                        if (
                            tag.isLocked &&
                            false ===
                                (req.user.tagWrangler ||
                                    req.user.superTagWrangler)
                        ) {
                            return Promise.reject({
                                status: 401,
                                message:
                                    "The tag is locked and you are not tag wrangler or supertagwrangler"
                            });
                        }

                        return TagController.update(
                            tag,
                            {
                                name: req.body.name,
                                style: req.body.style,
                                synonyms: req.body.synonyms,
                                parentTags: filteredTagParents,
                                childTags: filteredTagChildren,
                                description: req.body.description,
                                isLocked:
                                    req.user.tagWrangler ||
                                    req.user.superTagWrangler
                                        ? req.body.isLocked
                                        : tag.isLocked
                            },
                            transaction
                        ).then(updatedTag => res.send(updatedTag));
                    })
                );
            })
            .catch(e =>
                res
                    .status(e.status || StatusCodes.BAD_REQUEST)
                    .send(e.message || e)
            );
    }
);

tagRouter.delete(
    "/:tagId",
    [auth, isSuperTagWrangler],
    (req: AuthRequest, res: Response) => {
        return TagController.deleteTag(Number(req.params.tagId))
            .then(() => {
                return res.send("tag deleted");
            })
            .catch(e =>
                res
                    .status(e.status || StatusCodes.BAD_REQUEST)
                    .send(e.message || e)
            );
    }
);

export { tagRouter };
