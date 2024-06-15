import {
    DataTypes,
    Association,
    BelongsToGetAssociationMixin,
    BelongsToSetAssociationMixin
} from "sequelize";
import { database as sequelize } from "../services/databaseService.js";
import {
    Table,
    Model,
    PrimaryKey,
    ForeignKey,
    Column,
    CreatedAt,
    UpdatedAt,
    DataType
} from "sequelize-typescript";
import { Community } from "./Community";
import { Alias } from "./Alias";

type ValueOf<T> = T[keyof T];

@Table
class CommunityMembershipRequest extends Model {
    public static REQUEST_STATUSES = {
        rejected: 0,
        pending: 1,
        accepted: 2
    } as const;
    @PrimaryKey @Column public id!: number;
    @Column(DataType.NUMBER) public status!: ValueOf<
        typeof CommunityMembershipRequest.REQUEST_STATUSES
    >;

    @ForeignKey(() => Alias) @Column public AliasId!: number;

    public getCommunity!: BelongsToGetAssociationMixin<Community>;
    public setCommunity!: BelongsToSetAssociationMixin<Community, number>;

    public getAlias!: BelongsToGetAssociationMixin<Alias>;
    public setAlias!: BelongsToSetAssociationMixin<Alias, number>;

    @Column @CreatedAt public readonly createdAt!: Date;
    @Column @UpdatedAt public readonly updatedAt!: Date;

    public static associations: {
        community: Association<Community, CommunityMembershipRequest>;
        alias: Association<Alias, CommunityMembershipRequest>;
    };
}

CommunityMembershipRequest.init(
    {
        status: {
            allowNull: true,
            type: DataTypes.SMALLINT
        }
    },
    {
        sequelize,
        modelName: "CommunityMembershipRequest"
    }
);

export { CommunityMembershipRequest };
