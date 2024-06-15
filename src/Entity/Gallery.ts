import { Model } from "sequelize";
import { database as sequelize } from "../services/databaseService.js";

class Gallery extends Model {}

Gallery.init(
    {},
    {
        sequelize,
        modelName: "Gallery"
    }
);

export { Gallery };
