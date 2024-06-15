import { Tag } from "../../Entity/Tag";
import { Transaction } from "sequelize";

type TagParam = number | Tag;
type SetTagFunction = (
    tagParam: TagParam,
    transaction: Transaction
) => Promise<void>;

interface Taggable {
    addTagWithNeo4j: SetTagFunction;
    removeTagWithNeo4j: SetTagFunction;
}

type ProcessFunction = (
    tagParams: TagParam[],
    tagFunction: SetTagFunction,
    transaction: Transaction
) => Promise<any>;

type TagFunction = (
    taggable: Taggable,
    tagParams: TagParam[],
    transaction: Transaction
) => Promise<void>;

const processTags: ProcessFunction = (
    tagParams,
    processFunction,
    transaction
): Promise<any> =>
    Promise.all(
        tagParams.map(tagParam => processFunction(tagParam, transaction))
    );

const addTags: TagFunction = (taggable, tagParams, transaction) => {
    return processTags(
        tagParams,
        tagParam => {
            return taggable.addTagWithNeo4j(tagParam, transaction);
        },
        transaction
    );
};

const removeTags: TagFunction = (taggable, tagParams, transaction) => {
    return processTags(
        tagParams,
        tagParam => {
            return taggable.removeTagWithNeo4j(tagParam, transaction);
        },
        transaction
    );
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
    addTags,
    removeTags,
    getDisplayTag
};

export { tagFunctions };
