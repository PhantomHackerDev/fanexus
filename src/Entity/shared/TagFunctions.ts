import { Tag } from "../Tag";
import { runNeo4jQuery } from "../../services/Neo4jService";
import { Transaction } from "sequelize";
import { TagDisplayInterface } from "../../Interface/TagDisplayInterface";

interface Neo4jQueryParams {
    [key: string]: string | string[] | number;
}

type TagProcessFunction = (
    tag: Tag | number,
    transaction: { transaction: Transaction }
) => Promise<void>;
type TagsProcessFunction = (
    tags: (Tag | number)[] | undefined
) => Promise<void>;
interface Taggable {
    addTag: TagProcessFunction;
    removeTag: TagProcessFunction;
    setTags: TagsProcessFunction;
    id: number;
}

type ProcessTagFunction = (
    taggable: Taggable,
    tag: Tag | number | TagDisplayInterface,
    nodeLabel: string,
    transaction: Transaction
) => Promise<any>;

type ProcessTagsFunction = (
    taggable: Taggable,
    tag: (Tag | number | TagDisplayInterface)[] | undefined,
    nodeLabel: string,
    transaction: Transaction
) => Promise<void>;

const addTagWithNeo4j: ProcessTagFunction = (
    taggable,
    tag,
    nodeLabel,
    transaction: Transaction
) => {
    return Promise.all([
        taggable.addTag(typeof tag === "number" ? tag : tag.id, {
            transaction
        }),
        runNeo4jQuery(
            "MATCH (e {sqlId: $entitySqlIdParam}), " +
                "(t:Tag {sqlId: $tagSqlIdParam}) " +
                "WHERE $nodeLabel IN LABELS(e) " +
                "MERGE (e)-[:HAS_TAG]->(t) " +
                "RETURN e",
            {
                nodeLabel,
                entitySqlIdParam: taggable.id,
                tagSqlIdParam: typeof tag === "number" ? tag : tag.id
            }
        )
    ]);
};

const removeTagWithNeo4j: ProcessTagFunction = (
    taggable,
    tag,
    nodeLabel,
    transaction: Transaction
) =>
    Promise.all([
        taggable.removeTag(typeof tag === "number" ? tag : tag.id, {
            transaction
        }),
        runNeo4jQuery(
            "MATCH (e {sqlId: $entitySqlIdParam})-[r:HAS_TAG]->" +
                "(:Tag {sqlId: $tagSqlIdParam}) " +
                "WHERE $nodeLabel IN LABELS(e) " +
                "DELETE r",
            {
                nodeLabel,
                entitySqlIdParam: taggable.id,
                tagSqlIdParam: typeof tag === "number" ? tag : tag.id
            }
        )
    ]);

// DEPRECATED
const setTagsWithNeo4j: ProcessTagsFunction = (
    taggable,
    tags,
    nodeLabel,
    transaction
) => {
    const promises: Promise<void>[] = [];
    // @ts-ignore
    promises.push(taggable.setTagsWithDisplayNames(tags, transaction));

    if (tags) {
        let neo4jQuery = `MATCH (e:${nodeLabel} {sqlId: $entitySqlIdParam}) `;
        let mergeQuery = "";
        const neo4jParams: Neo4jQueryParams = {
            entitySqlIdParam: taggable.id
        };

        tags.forEach((tag: Tag | number | TagDisplayInterface, index): void => {
            neo4jQuery += `MATCH (t${index}:Tag {sqlId: $tag${index}SqlIdParam}) `;
            mergeQuery += `MERGE (e)-[:HAS_TAG]->(t${index}) `;
            neo4jParams[`tag${index}SqlIdParam`] =
                typeof tag === "number" ? tag : tag.id;
        });

        neo4jQuery += mergeQuery;
        neo4jQuery += "RETURN e";

        promises.push(
            runNeo4jQuery(neo4jQuery, neo4jParams).then((): void => {
                return undefined;
            })
        );
    }
    return Promise.all(promises).then((): void => {
        return undefined;
    });
};

// @ts-ignore
const setTags: ProcessTagsFunction = (taggable, tags, transaction) => {
    const promises: Promise<void>[] = [];
    // @ts-ignore
    promises.push(taggable.setTagsWithDisplayNames(tags, transaction));
    return Promise.all(promises).then((): void => {
        return undefined;
    });
};

const getDisplayTag = (tag: Tag, relation: keyof Tag) => {
    return {
        id: tag.id,
        name: tag.name,
        style: tag.style,
        // @ts-ignore
        displaySynonym: tag[relation]
            ? tag[relation].displaySynonym
                ? tag[relation].displaySynonym
                : tag.name
            : tag.name
    };
};

const tagFunctions = {
    addTagWithNeo4j,
    removeTagWithNeo4j,
    setTagsWithNeo4j,
    getDisplayTag
};

export { tagFunctions };
