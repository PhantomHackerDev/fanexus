import { DataTypes } from "sequelize";
import { database as sequelize } from "../services/databaseService.js";
import {
    Table,
    Model,
    Column,
    PrimaryKey,
    CreatedAt,
    UpdatedAt
} from "sequelize-typescript";
import { MediaserverService } from "../services/MediaserverService";

@Table
class Image extends Model {
    @PrimaryKey @Column public id!: number;
    @Column public src!: string;
    @Column public name!: string;
    @Column public alt!: string;
    @Column public identifier!: string;
    @Column public context!: string;

    @Column @CreatedAt public readonly createdAt!: Date;
    @Column @UpdatedAt public readonly updatedAt!: Date;
}

Image.init(
    {
        src: {
            allowNull: false,
            type: DataTypes.TEXT,
            get() {
                const src = this.getDataValue("src");
                const identifier = this.identifier;
                let returnSrc = src;

                if (identifier) {
                    returnSrc = MediaserverService.getImageWithAccessToken(src);

                    if (this.context === "alias") {
                        returnSrc = MediaserverService.getThumbnailWithAccessToken(
                            identifier
                        );
                    }
                }

                return returnSrc;
            }
        },
        name: {
            allowNull: true,
            type: DataTypes.STRING
        },
        alt: {
            allowNull: true,
            type: DataTypes.STRING
        },
        identifier: {
            allowNull: true,
            type: DataTypes.STRING
        },
        context: {
            allowNull: true,
            type: DataTypes.STRING
        }
    },
    {
        sequelize,
        modelName: "Image"
    }
);

export { Image };
