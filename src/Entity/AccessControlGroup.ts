import {
    Model,
    Table,
    Column,
    PrimaryKey,
    DataType,
    BelongsToMany
} from "sequelize-typescript";
import {
    BelongsToManyAddAssociationMixin,
    BelongsToManyGetAssociationsMixin,
    BelongsToManyRemoveAssociationMixin,
    BelongsToManySetAssociationsMixin,
    BelongsToManyHasAssociationMixin,
    Association,
    DataTypes,
    BelongsToGetAssociationMixin,
    BelongsToSetAssociationMixin,
    Transaction
} from "sequelize";
import { Alias } from "./Alias";
import { database as sequelize } from "../services/databaseService.js";
import { User } from "./User";
import { Blog } from "./Blog";

type ValueOf<T> = T[keyof T];

@Table
class AccessControlGroup extends Model {
    public static ACCESS_CONTROL_SETTINGS = {
        full: 1,
        subscribers: 2,
        members: 3,
        specificInclude: 4,
        specificExclude: 5,
        1: 1,
        2: 2,
        3: 3,
        4: 4,
        5: 5
    } as const;
    @PrimaryKey @Column public id: number;
    @Column(DataType.NUMBER) public accessControlSetting: ValueOf<
        typeof AccessControlGroup.ACCESS_CONTROL_SETTINGS
    >;

    public name: string;
    public isDefault: boolean;
    public userDeleted: boolean;

    public Aliases: Alias[];
    public getAliases: BelongsToManyGetAssociationsMixin<Alias>;
    // public addAlias: BelongsToManyAddAssociationMixin<Alias, number>;
    // public removeAlias: BelongsToManyRemoveAssociationMixin<Alias, number>;
    public hasAlias: BelongsToManyHasAssociationMixin<Alias, number>;
    public setAliases: BelongsToManySetAssociationsMixin<Alias, number[]>;

    public getUsers: BelongsToManyGetAssociationsMixin<User>;
    public addUser: BelongsToManyAddAssociationMixin<User, number>;
    public removeUser: BelongsToManyRemoveAssociationMixin<User, number>;
    public HasUser: BelongsToManyHasAssociationMixin<User, number>;
    public setUsers: BelongsToManySetAssociationsMixin<User, number[]>;

    public belongsToAliasId: number;
    public belongsToAlias: Alias;
    public getBelongsToAlias: BelongsToGetAssociationMixin<Alias>;
    public setBelongsToAlias: BelongsToSetAssociationMixin<Alias, number>;

    @BelongsToMany(() => AccessControlGroup, "ACG_has_ACG")
    public containsAccessControlGroups: AccessControlGroup[];
    public getContainsAccessControlGroups: BelongsToManyGetAssociationsMixin<
        AccessControlGroup
    >;
    public addContainsAccessControlGroup: BelongsToManyAddAssociationMixin<
        AccessControlGroup,
        number
    >;
    public removeContainsAccessControlGroup: BelongsToManyRemoveAssociationMixin<
        AccessControlGroup,
        number
    >;

    @BelongsToMany(() => AccessControlGroup, "ACG_blngsT_ACG")
    public belongsToAccessControlGroups: AccessControlGroup[];
    public getBelongsToAccessControlGroups: BelongsToManyGetAssociationsMixin<
        AccessControlGroup
    >;
    public addBelongsToAccessControlGroup: BelongsToManyAddAssociationMixin<
        AccessControlGroup,
        number
    >;
    public removeBelongsToAccessControlGroup: BelongsToManyRemoveAssociationMixin<
        AccessControlGroup,
        number
    >;

    public static associations: {
        alias: Association<AccessControlGroup, Alias>;
        Aliases: Association<AccessControlGroup, Alias>;
        user: Association<AccessControlGroup, User>;
        blog: Association<Blog, AccessControlGroup>;
        accessControlGroup: Association<AccessControlGroup, AccessControlGroup>;
    };

    public addAlias(
        alias: number | Alias,
        isDirectMember = true,
        transaction: Transaction
    ) {
        let aliasId = alias instanceof Alias ? alias.id : alias;
        // INSERT INTO "AccessControlGroup_Alias" ("createdAt","updatedAt","AliasId","AccessControlGroupId")
        // VALUES ('2020-08-01 19:56:39.719 +00:00','2020-08-01 19:56:39.719 +00:00',3,5) RETURNING *;
        return sequelize.query(
            `
        INSERT INTO "AccessControlGroup_Alias" ("createdAt","updatedAt","AliasId","AccessControlGroupId", "isDirectMember")
        SELECT current_timestamp,current_timestamp,:aliasId,:AccessControlGroupId, :isDirectMember
        WHERE NOT EXISTS (SELECT 1 FROM "AccessControlGroup_Alias"
        WHERE ("AccessControlGroup_Alias"."AliasId"=':aliasId' AND "AccessControlGroup_Alias"."AccessControlGroupId"=':AccessControlGroupId'))
        RETURNING *;`,
            {
                replacements: {
                    aliasId,
                    AccessControlGroupId: this.id,
                    isDirectMember
                },
                transaction
            }
        );
    }
    public removeAlias(
        alias: number | Alias,
        isDirectMember = true,
        transaction: Transaction
    ) {
        let aliasId = alias instanceof Alias ? alias.id : alias;
        // DELETE FROM "AccessControlGroup_Alias" WHERE "AccessControlGroupId" = 5 AND "AliasId" IN (2)
        return sequelize.query(
            `
        DELETE FROM "AccessControlGroup_Alias" WHERE "AccessControlGroupId" = :AccessControlGroupId AND "AliasId" IN (:aliasId) AND "isDirectMember"=:isDirectMember;`,
            {
                replacements: {
                    aliasId,
                    AccessControlGroupId: this.id,
                    isDirectMember
                },
                transaction
            }
        );
    }
}

AccessControlGroup.init(
    {
        accessControlSetting: {
            type: DataTypes.SMALLINT,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        isDefault: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        userDeleted: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false
        }
    },
    {
        sequelize,
        modelName: "AccessControlGroup"
    }
);

export { AccessControlGroup };
