import { runNeo4jQuery } from "../../services/Neo4jService";

type SetNeo4jFunction = (
    id: number,
    nodeLabel: string,
    associated: number | { id: number },
    associationName: string,
    associatedLabel?: string
) => Promise<void>;

const setNeo4j: SetNeo4jFunction = (
    id,
    nodeLabel,
    associated,
    associationName,
    associatedLabel
) => {
    if (!associatedLabel) {
        associatedLabel = associationName;
    }
    return runNeo4jQuery(
        "MATCH (n {sqlId: $id}) " +
            "WHERE $nodeLabel IN LABELS(n) " +
            "MATCH (a {sqlId: $associatedId}) " +
            "WHERE $associatedLabel IN LABELS(a) " +
            "CALL apoc.create.relationship(n, $relationshipLabel, {}, a) " +
            "YIELD rel RETURN rel",
        {
            id,
            nodeLabel,
            associatedId:
                typeof associated === "number" ? associated : associated.id,
            associatedLabel,
            relationshipLabel: `HAS_${associationName.toUpperCase()}`
        }
    ).then((): void => {
        return undefined;
    });
};

const Neo4jFunctions = { setNeo4j };
export { Neo4jFunctions };
