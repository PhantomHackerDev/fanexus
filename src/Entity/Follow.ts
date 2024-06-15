import {
    Model,
    Table,
    Column,
    PrimaryKey,
    DataType,
    ForeignKey,
    CreatedAt,
    UpdatedAt,
    BelongsTo
} from "sequelize-typescript";
import {
    BelongsToGetAssociationMixin,
    Association,
    DataTypes,
    Transaction
} from "sequelize";
import { WhereAttributeHash } from "sequelize";

import { runNeo4jQuery } from "../services/Neo4jService";
import { database as sequelize } from "../services/databaseService.js";
import { Alias } from "./Alias";
import { User } from "./User";
import { Blog } from "./Blog";
import { Community } from "./Community";
import { Tag } from "./Tag";

type ValueOf<T> = T[keyof T];

@Table
class Follow extends Model {
    public static FOLLOW_TYPES = {
        block: 0,
        follow: 1
    } as const;
    @PrimaryKey @Column public id: string;
    @Column(DataType.NUMBER) public followType: ValueOf<
        typeof Follow.FOLLOW_TYPES
    >;
    @ForeignKey(() => Alias) @Column public AliasId: number;
    @BelongsTo(() => Alias) public Alias?: Alias;
    @ForeignKey(() => Blog) @Column public followBlogId: number;
    @BelongsTo(() => Blog) public followBlog?: Blog;
    @ForeignKey(() => Community) @Column public followCommunityId: number;
    @BelongsTo(() => Community) public followCommunity?: Community;
    @ForeignKey(() => Tag) @Column public followTagId: number;
    @BelongsTo(() => Tag) public followTag?: Tag;
    @ForeignKey(() => Alias) @Column public followAliasId: number;
    @BelongsTo(() => Alias) public followAlias?: Alias;

    public getAlias!: BelongsToGetAssociationMixin<Alias>;

    @Column @CreatedAt public readonly createdAt!: Date;
    @Column @UpdatedAt public readonly updatedAt!: Date;

    public static associations: {
        User: Association<Follow, User>;
        Blog: Association<Follow, Blog>;
        Community: Association<Follow, Community>;
        Tag: Association<Follow, Tag>;
        Alias: Association<Follow, Alias>;
    };

    // deprecated
    public static findOrCreateWithNeo4j(
        followObject: WhereAttributeHash,
        entity: string,
        entityId: number,
        transaction: Transaction
    ): Promise<[Follow, boolean]> {
        return Promise.all([
            this.findOrCreate({ where: followObject, transaction }),
            runNeo4jQuery(
                "MATCH (a:Alias {sqlId: $aliasSqlIdParam}), " +
                    "(e {sqlId: $entitySqlIdParam}) " +
                    "WHERE $entityLabel IN LABELS(e) " +
                    "MERGE (a)-[f:FOLLOWS]->(e) " +
                    "RETURN f",
                {
                    aliasSqlIdParam: followObject.AliasId,
                    entitySqlIdParam: entityId,
                    entityLabel:
                        entity.charAt(0).toUpperCase() + entity.slice(1)
                }
            )
        ]).then(([result]) => {
            return result;
        });
    }

    // deprecated
    public static destroyWithNeo4j(
        destroyCondition: WhereAttributeHash,
        aliasId: number,
        entityId: number,
        entityLabel: string
    ): Promise<number> {
        return Promise.all([
            this.destroy({ where: destroyCondition }),
            runNeo4jQuery(
                "MATCH (:Alias {sqlId: $aliasId})-[f:FOLLOWS]->" +
                    "(e {sqlId: $entityId}) " +
                    "WHERE $entityLabel IN LABELS(e) " +
                    "DELETE f",
                { aliasId, entityLabel, entityId }
            )
        ]).then(([destroyed]: [number, any]) => destroyed);
    }
}

Follow.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        followType: {
            allowNull: false,
            type: DataTypes.INTEGER
        }
    },
    {
        sequelize,
        modelName: "Follow"
    }
);

export { Follow };
