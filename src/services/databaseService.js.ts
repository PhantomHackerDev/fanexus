import pg = require("pg");
delete (pg as any).native;

import { Sequelize } from "sequelize";
if (!process.env.DB_URL) {
    throw new Error("DB_URL needs to be defined in .env");
}
const dbUrl = process.env.DB_URL;

const sequelizeInstance = () => {
    // if (process.env.NODE_ENV === "test") {
    // if (!process.env.DB_URL_TEST) {
    // throw new Error("DB_URL_TEST needs to be defined in .env");
    // }
    // return new Sequelize(process.env.DB_URL_TEST);
    // } else {
    return new Sequelize(dbUrl);
    // }
};

const database = sequelizeInstance();

export { database };
export const textAreaMax = 128 * 1024; // tslint:disable-line:no-magic-numbers
export const tagMax = 512;
