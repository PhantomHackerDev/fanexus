import {
    Association,
    BelongsToGetAssociationMixin,
    BelongsToManyAddAssociationMixin,
    BelongsToManyGetAssociationsMixin,
    BelongsToManyHasAssociationMixin,
    BelongsToManyRemoveAssociationMixin,
    BelongsToManySetAssociationsMixin,
    BelongsToSetAssociationMixin,
    DataTypes,
    HasOneGetAssociationMixin,
    HasOneSetAssociationMixin
} from "sequelize";
import {
    BelongsTo,
    BelongsToMany,
    Column,
    ForeignKey,
    HasMany,
    Model,
    PrimaryKey,
    Table
} from "sequelize-typescript";
import { AliasInterface } from "../Interface/AliasInterface";
import { database as sequelize } from "../services/databaseService.js";
import { Blog } from "./Blog";
import { Community } from "./Community";
import { Follow } from "./Follow";
import { Image } from "./Image";
import { Reaction } from "./Reaction";
import { User } from "./User";

@Table
class Alias extends Model implements AliasInterface {
    @PrimaryKey @Column public id: number;
    @Column public name!: string;
    @Column public isMinor!: boolean;
    @Column public showMinors!: boolean;

    @ForeignKey(() => User) @Column public UserId: number;
    public getUser!: BelongsToGetAssociationMixin<User>;
    public setUser!: BelongsToSetAssociationMixin<User, number>;

    public getBlog!: HasOneGetAssociationMixin<Blog>;
    public setBlog!: HasOneSetAssociationMixin<Blog, number>;

    public Reactions: Reaction[];

    @BelongsTo(() => Image, "avatarId")
    public avatar: Image;

    @ForeignKey(() => Image) @Column public avatarId: number;
    public getAvatar!: BelongsToGetAssociationMixin<Image>;
    public setAvatar!: BelongsToSetAssociationMixin<Image, number>;

    @HasMany(() => Follow, "follows")
    public follows: Follow[];

    @BelongsToMany(() => Community, "community_members")
    public getMemberOfCommunity!: BelongsToManyGetAssociationsMixin<Community>;
    public addMemberOfCommunity!: BelongsToManyAddAssociationMixin<
        Community,
        number
    >;
    public setMemberOfCommunities!: BelongsToManySetAssociationsMixin<
        Community,
        number
    >;
    public removeMemberOfCommunity!: BelongsToManyRemoveAssociationMixin<
        Community,
        number
    >;
    public hasMemberOfCommunity!: BelongsToManyHasAssociationMixin<
        Community,
        number
    >;

    @BelongsToMany(() => Community, "community_moderators")
    public getModeratorOfCommunity!: BelongsToManyGetAssociationsMixin<
        Community
    >;
    public addModeratorOfCommunity!: BelongsToManyAddAssociationMixin<
        Community,
        number
    >;
    public setModeratorsOfCommunities!: BelongsToManySetAssociationsMixin<
        Community,
        number
    >;
    public removeModeratorOfCommunity!: BelongsToManyRemoveAssociationMixin<
        Community,
        number
    >;
    public hasModeratorOfCommunity!: BelongsToManyHasAssociationMixin<
        Community,
        number
    >;

    public static associations: {
        avatar: Association<Alias, Image>;
        memberOfCommunity: Association<Community, Alias>;
        moderatorOfCommunity: Association<Community, Alias>;
    };
}

Alias.init(
    {
        name: {
            allowNull: false,
            type: DataTypes.STRING
        },
        isMinor: {
            allowNull: true,
            type: DataTypes.BOOLEAN
        },
        showMinors: {
            allowNull: true,
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    },
    {
        sequelize,
        modelName: "Alias"
    }
);
/*const Alias = database.define('Alias', {
    name: {
        allowNull: false,
        type: Sequelize.STRING
    }
});*/

export { Alias };
