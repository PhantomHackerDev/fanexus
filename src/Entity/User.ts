import { DataTypes } from "sequelize";
import {
    Model,
    PrimaryKey,
    Column,
    CreatedAt,
    UpdatedAt,
    HasMany,
    DataType
} from "sequelize-typescript";
import { database as sequelize } from "../services/databaseService.js";
import {
    HasManyAddAssociationMixin,
    HasManyGetAssociationsMixin,
    HasManyHasAssociationMixin,
    Association
} from "sequelize";
import { Alias } from "./Alias";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Image } from "./Image";

class User extends Model {
    @PrimaryKey @Column public id!: number;
    @Column public email!: string;
    @Column public password!: string;
    @Column(DataType.ARRAY(DataType.STRING)) public tokens!: string[] | null;
    @Column public isMinor!: boolean;
    @Column public dateOfBirth!: Date;
    @Column public admin!: boolean;
    @Column public superadmin!: boolean;
    @Column public tagWrangler!: boolean;
    @Column public superTagWrangler!: boolean;
    @Column public moderator!: boolean;

    @Column @CreatedAt public readonly createdAt!: Date;
    @Column @UpdatedAt public readonly updatedAt!: Date;

    @Column public suspended!: boolean;
    @Column public suspendedAt: Date;

    @HasMany(() => Alias)
    public Aliases: Alias[];
    public AliasIds: number[] = [];
    public getAliases!: HasManyGetAssociationsMixin<Alias>;
    public addAlias!: HasManyAddAssociationMixin<Alias, number>;
    public hasAlias!: HasManyHasAssociationMixin<Alias, number>;

    public loggedInAsAnonymous?: boolean;
    public maxAllowedAliases: number;
    public emailChangeRequested?: boolean;
    public emailChangeKey?: string;
    public static associations: {
        aliases: Association<User, Alias>;
    };

    public async generateAuthToken(): Promise<string> {
        // TODO do with promise
        if (!process.env.JWT_KEY) {
            throw new Error("JWT_KEY needs to be defined in .env");
        }
        const user = this;
        const token: string = jwt.sign({ _id: user.id }, process.env.JWT_KEY);
        const currentTokens = user.tokens;
        if (!currentTokens) {
            throw new Error("Failed getting a token.");
        }
        currentTokens.push(token);
        user.tokens = currentTokens;
        await user.save();
        return token;
    }

    public static async findByCredentials(
        email: string,
        password: string
    ): Promise<User> {
        const user: User | null = await User.findOne({
            where: {
                email
            },
            include: [
                {
                    model: Alias,
                    include: [
                        {
                            model: Image,
                            as: "avatar",
                            attributes: [
                                "id",
                                "src",
                                "name",
                                "alt",
                                "identifier",
                                "context"
                            ]
                        }
                    ]
                }
            ]
        });
        if (!user) {
            throw new Error("Invalid email");
        }
        const isPasswordMatch: boolean = await bcrypt.compare(
            password,
            user.password
        );
        if (!isPasswordMatch) {
            throw new Error("Invalid password");
        }
        const aliasIdArray: number[] = [];
        user.Aliases?.forEach(alias => {
            aliasIdArray.push(alias.id);
        });
        user.setDataValue("AliasIds", aliasIdArray);
        user.AliasIds = aliasIdArray;

        return user;
    }
}
User.init(
    {
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        isMinor: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        admin: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        superadmin: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        moderator: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        dateOfBirth: {
            type: DataTypes.DATE,
            allowNull: true
        },
        maxAllowedAliases: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        tagWrangler: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        superTagWrangler: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        tokens: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true,
            get() {
                const tokens = this.getDataValue("tokens");
                if (tokens === null || tokens === undefined) {
                    return [];
                }
                return tokens;
            }
        },
        emailChangeRequested: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false
        },
        emailChangeKey: {
            type: DataTypes.STRING,
            allowNull: true
        },
        suspended: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        suspendedAt: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        }
    },
    {
        sequelize,
        modelName: "User"
        // options
    }
);

const bcryptSalt = 8;

User.beforeCreate(
    async (user: User): Promise<void> => {
        user.password = await bcrypt.hash(user.password, bcryptSalt);
    }
);

User.beforeUpdate(
    async (user: User): Promise<void> => {
        // TODO TEST THIS
        if (user.changed("password")) {
            user.password = await bcrypt.hash(user.password, bcryptSalt);
        }
    }
);

export { User };
