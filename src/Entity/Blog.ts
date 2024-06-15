import {
    DataTypes,
    Association,
    BelongsToManySetAssociationsMixin,
    BelongsToManyGetAssociationsMixin,
    BelongsToSetAssociationMixin,
    BelongsToManyAddAssociationMixin,
    BelongsToManyHasAssociationMixin,
    BelongsToManyRemoveAssociationMixin,
    BelongsToGetAssociationMixin,
    HasManyAddAssociationMixin,
    HasManyGetAssociationsMixin,
    HasManyRemoveAssociationMixin,
    HasManyHasAssociationMixin,
    Transaction
} from "sequelize";
import {
    database as sequelize,
    textAreaMax
} from "../services/databaseService.js";
import { BlogPost } from "./BlogPost";
import { Blog_Tag } from "./Blog_Tag";
import { Tag } from "./Tag";
import { Alias } from "./Alias";
import { Image } from "./Image";
import {
    BelongsTo,
    HasMany,
    PrimaryKey,
    Column,
    CreatedAt,
    UpdatedAt,
    Table,
    Model,
    DataType,
    BelongsToMany
} from "sequelize-typescript";
import { AccessControlGroup } from "./AccessControlGroup";
import { sanitizeContents } from "./shared/sanitizeHTML";
import { tagFunctions } from "./shared/TagFunctions";
import { runNeo4jQuery } from "../services/Neo4jService";
import { Follow } from "./Follow";
import { TagDisplayInterface } from "../Interface/TagDisplayInterface";
import { TagController } from "../Controller/TagController";

@Table
class Blog extends Model {
    @PrimaryKey @Column public id!: number;
    @Column public name!: string;
    @Column public link!: string;
    @Column(DataType.ARRAY(DataType.STRING)) public links!: string[];
    @Column public description: string;
    @Column @CreatedAt public readonly createdAt!: Date;
    @Column @UpdatedAt public readonly updatedAt!: Date;
    public readonly type: string = "blog";

    /*public getLinks(){
        if(typeof this.links === "object"){
            const returnLinks:string[] = [];
            this.links.forEach(linkObjectString => {
                returnLinks.push(JSON.parse(linkObjectString))
            });
            return returnLinks
        }
        return this.links;
    }*/

    @BelongsTo(() => Image, "avatarId")
    public avatar: Image;

    @BelongsTo(() => Image, "coverImageId")
    public coverImage: Image;

    public setCoverImage!: BelongsToSetAssociationMixin<Image, number>;
    public getCoverImage!: BelongsToGetAssociationMixin<Image>;

    public getAvatar!: BelongsToGetAssociationMixin<Image>;
    public setAvatar!: BelongsToSetAssociationMixin<Image, number>;

    // getBlogPosts
    @HasMany(() => BlogPost)
    public BlogPosts!: BlogPost[];
    public getBlogPosts!: HasManyGetAssociationsMixin<BlogPost>;
    public addBlogPost!: HasManyAddAssociationMixin<BlogPost, number>;
    public hasBlogPost!: HasManyHasAssociationMixin<BlogPost, number>;
    public removeBlogPost!: HasManyRemoveAssociationMixin<BlogPost, number>;

    @HasMany(() => Follow)
    public Follows!: Follow[];

    @BelongsToMany(() => Tag, { through: "Blog_Tag" })
    public Tags!: Tag[];
    public getTags!: BelongsToManyGetAssociationsMixin<Tag>;
    public addTag!: BelongsToManyAddAssociationMixin<Tag, number>;
    public setTags!: BelongsToManySetAssociationsMixin<Tag, number>;
    public removeTag!: BelongsToManyRemoveAssociationMixin<Tag, number>;
    public hasTag!: BelongsToManyHasAssociationMixin<Tag, number>;

    public AliasId!: number;
    public Alias: Alias;
    public getAlias!: BelongsToGetAssociationMixin<Alias>;
    public setAlias!: BelongsToSetAssociationMixin<Alias, number>;

    @BelongsTo(() => AccessControlGroup, "contentAccessControl")
    public contentAccessControl: AccessControlGroup;
    public getContentAccessControl!: BelongsToGetAssociationMixin<
        AccessControlGroup
    >;
    public setContentAccessControl!: BelongsToSetAssociationMixin<
        AccessControlGroup,
        number
    >;

    @BelongsTo(() => AccessControlGroup, "commentsAccessControl")
    public commentsAccessControl: AccessControlGroup;
    public getCommentsAccessControl!: BelongsToGetAssociationMixin<
        AccessControlGroup
    >;
    public setCommentsAccessControl!: BelongsToSetAssociationMixin<
        AccessControlGroup,
        number
    >;

    @BelongsTo(() => AccessControlGroup, "followsAccessControl")
    public followsAccessControl: AccessControlGroup;
    public getFollowsAccessControl!: BelongsToGetAssociationMixin<
        AccessControlGroup
    >;
    public setFollowsAccessControl!: BelongsToSetAssociationMixin<
        AccessControlGroup,
        number
    >;

    @BelongsTo(() => AccessControlGroup, "reactionsAccessControl")
    public reactionsAccessControl: AccessControlGroup;
    public getReactionsAccessControl!: BelongsToGetAssociationMixin<
        AccessControlGroup
    >;
    public setReactionsAccessControl!: BelongsToSetAssociationMixin<
        AccessControlGroup,
        number
    >;

    public userHasEditPermissions: boolean;
    @Column public hideFromSearchResults: boolean;

    public static associations: {
        alias: Association<Blog, Alias>;
        tags: Association<Tag, Blog>;
        blogPosts: Association<BlogPost, Blog>;
        avatar: Association<Blog, Image>;
        coverImage: Association<Blog, Image>;
        contentAccessControl: Association<Blog, AccessControlGroup>;
        commentsAccessControl: Association<Blog, AccessControlGroup>;
        followsAccessControl: Association<Blog, AccessControlGroup>;
        reactionsAccessControl: Association<Blog, AccessControlGroup>;
        follows: Association<Follow, Blog>;
    };

    // deprecated
    public addTagWithNeo4j(
        tag: number | Tag,
        transaction: Transaction
    ): Promise<void> {
        return tagFunctions.addTagWithNeo4j(this, tag, "Blog", transaction);
    }

    // deprecated
    public removeTagWithNeo4j(
        tag: number | Tag,
        transaction: Transaction
    ): Promise<void> {
        return tagFunctions.removeTagWithNeo4j(this, tag, "Blog", transaction);
    }

    // deprecated
    public setTagsWithNeo4j(
        tags: (number | Tag | TagDisplayInterface)[] | undefined,
        transaction: Transaction
    ): Promise<void> {
        return tagFunctions.setTagsWithNeo4j(this, tags, "Blog", transaction);
    }

    // DEPRECATED
    public setAliasWithNeo4j(
        alias: number | Alias,
        transaction: Transaction
    ): Promise<any> {
        return Promise.all([
            this.setAlias(alias, { transaction }),
            runNeo4jQuery(
                "MATCH (b:Blog {sqlId: $blogSqlIdParam}), " +
                    "(a:Alias {sqlId: $aliasSqlIdParam}) " +
                    "MERGE (b)-[:HAS_ALIAS]->(a) " +
                    "RETURN b",
                {
                    blogSqlIdParam: this.id,
                    aliasSqlIdParam:
                        typeof alias === "number" ? alias : alias.id
                }
            )
        ]);
    }

    public sanitizeContents(): void {
        this.description = sanitizeContents(this.description);
        this.links = this.links.map(link => sanitizeContents(link));
    }

    public setTagsWithDisplayNames(
        tags: TagDisplayInterface[],
        transaction: Transaction
    ): Promise<any> {
        return Blog_Tag.destroy({
            where: {
                BlogId: this.id
            },
            transaction
        })
            .then(() =>
                Promise.all(
                    tags
                        .filter(({ id }) => id < 0)
                        .map(tag =>
                            TagController.getOrCreateTag(
                                tag.displaySynonym,
                                transaction
                            )
                        )
                )
            )
            .then(createdTags =>
                Promise.all(
                    tags
                        .filter(({ id }) => id > 0)
                        .concat(createdTags)
                        .map(tag =>
                            Blog_Tag.create(
                                {
                                    TagId: tag.id,
                                    BlogId: this.id,
                                    displaySynonym: tag.displaySynonym
                                        ? tag.displaySynonym
                                        : tag.name
                                },
                                { transaction }
                            )
                        )
                )
            );
    }
}

Blog.init(
    {
        name: {
            allowNull: false,
            type: DataTypes.STRING
        },
        link: {
            unique: true,
            allowNull: true,
            type: DataTypes.STRING
        },
        links: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true
        },
        description: {
            allowNull: false,
            type: DataTypes.TEXT,
            validate: {
                isByteLength: {
                    max: textAreaMax,
                    msg: `Description must be of length within ${textAreaMax}`
                }
            }
        },
        hideFromSearchResults: {
            allowNull: false,
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    },
    {
        sequelize,
        modelName: "Blog"
    }
);

export { Blog };
