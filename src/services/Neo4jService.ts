import neo4j from "neo4j-driver";

if (!process.env.GRAPH_DB_URL) {
    throw new Error("GRAPH_DB_URL needs to be defined in .env");
}

const graphDBUser: string = process.env.GRAPH_DB_USER
    ? process.env.GRAPH_DB_USER
    : "";
const graphDBPassword: string = process.env.GRAPH_DB_PASSWORD
    ? process.env.GRAPH_DB_PASSWORD
    : "";
export const driver: typeof neo4j.Driver = neo4j.driver(
    process.env.GRAPH_DB_URL,
    neo4j.auth.basic(graphDBUser, graphDBPassword)
);

function runNeo4jQuery(query: string, params: any) {
    const session = driver.session();
    console.log(query, params);
    const resultPromise = session.run(query, params);
    return resultPromise
        .catch(e => {
            console.error(e);
            return Promise.reject(e);
        })
        .finally(() => {
            // console.log("finallyed in neo4jservice");
            return session.close();
        });
}

export { driver as neo4jDriver, runNeo4jQuery };
/*
const session = driver.session();

session
    .run('MERGE (james:Person {name : $nameParam}) RETURN james.name AS name', {
        nameParam: 'James'
    })
    .then(result => {
        result.records.forEach(record => {
            console.log(record.get('name'))
        })
    })
    .catch(error => {
        console.log(error)
    })
    .finally(() => session.close());

// Close the driver when application exits.
driver.close();*/
