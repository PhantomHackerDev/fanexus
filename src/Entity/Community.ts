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
    HasManyAddAssociationMixin,
    HasManyGetAssociationsMixin,
    HasManyHasAssociationMixin,
    HasManyRemoveAssociationMixin,
    HasManySetAssociationsMixin,
    Transaction
} from "sequelize";
import {
    BelongsTo,
    BelongsToMany,
    Column,
    CreatedAt,
    DataType,
    HasMany,
    Model,
    PrimaryKey,
    Table,
    UpdatedAt
} from "sequelize-typescript";
import { TagController } from "../Controller/TagController";
import { TagDisplayInterface } from "../Interface/TagDisplayInterface";
import { database as sequelize } from "../services/databaseService.js";
import { runNeo4jQuery } from "../services/Neo4jService";
import { AccessControlGroup } from "./AccessControlGroup";
import { Alias } from "./Alias";
import { BlogPost } from "./BlogPost";
import { CommunityMembershipRequest } from "./CommunityMembershipRequest";
import { CommunityRules } from "./CommunityRules";
import { Community_Tag } from "./Community_Tag";
import { Follow } from "./Follow";
import { Image } from "./Image";
import { sanitizeContents } from "./shared/sanitizeHTML";
import { tagFunctions } from "./shared/TagFunctions";
import { Tag } from "./Tag";

@Table
class Community extends Model {
    @PrimaryKey @Column public id!: number;
    @Column public name!: string;
    @Column public link!: string;
    @Column(DataType.ARRAY(DataType.STRING)) public links!: string[];
    @Column public description: string;
    @Column @CreatedAt public readonly createdAt!: Date;
    @Column @UpdatedAt public readonly updatedAt!: Date;
    public readonly type: string = "community";

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

    @HasMany(() => CommunityRules)
    public communityRules!: BlogPost[];
    public setCommunityRules!: HasManySetAssociationsMixin<
        CommunityRules,
        number
    >;
    public getCommunityRules!: HasManyGetAssociationsMixin<CommunityRules>;
    public addCommunityRule!: HasManyAddAssociationMixin<
        CommunityRules,
        number
    >;
    public hasCommunityRule!: HasManyHasAssociationMixin<
        CommunityRules,
        number
    >;
    public removeCommunityRules!: HasManyRemoveAssociationMixin<
        CommunityRules,
        number
    >;

    @BelongsToMany(() => Tag, { through: "Community_Tag" })
    public Tags!: Tag[];
    public getTags!: BelongsToManyGetAssociationsMixin<Tag>;
    public addTag!: BelongsToManyAddAssociationMixin<Tag, number>;
    public setTags!: BelongsToManySetAssociationsMixin<Tag, number>;
    public removeTag!: BelongsToManyRemoveAssociationMixin<Tag, number>;
    public hasTag!: BelongsToManyHasAssociationMixin<Tag, number>;

    @HasMany(() => CommunityMembershipRequest)
    public getMembershipRequests!: HasManyGetAssociationsMixin<
        CommunityMembershipRequest
    >;
    public addMembershipRequest!: HasManyAddAssociationMixin<
        CommunityMembershipRequest,
        number
    >;
    public hasMembershipRequest!: HasManyHasAssociationMixin<
        CommunityMembershipRequest,
        number
    >;

    @HasMany(() => Follow, "follows")
    public follows: Follow[];
    @BelongsToMany(() => Alias, "community_members")
    public members: Alias[];
    public getMembers!: BelongsToManyGetAssociationsMixin<Alias>;
    public addMember!: BelongsToManyAddAssociationMixin<Alias, number>;
    public setMembers!: BelongsToManySetAssociationsMixin<Alias, number>;
    public removeMember!: BelongsToManyRemoveAssociationMixin<Alias, number>;
    public hasMember!: BelongsToManyHasAssociationMixin<Alias, number>;
    public memberCount: string;

    @BelongsToMany(() => Alias, "community_moderators")
    public moderators: Alias[];
    public getModerators!: BelongsToManyGetAssociationsMixin<Alias>;
    public addModerator!: BelongsToManyAddAssociationMixin<Alias, number>;
    public setModerators!: BelongsToManySetAssociationsMixin<Alias, number>;
    public removeModerator!: BelongsToManyRemoveAssociationMixin<Alias, number>;
    public hasModerator!: BelongsToManyHasAssociationMixin<Alias, number>;
    public moderatorCount: string;

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

    @BelongsTo(() => AccessControlGroup, "membersAccessControl")
    public membersAccessControl: AccessControlGroup;
    public getMembersAccessControl!: BelongsToGetAssociationMixin<
        AccessControlGroup
    >;
    public setMembersAccessControl!: BelongsToSetAssociationMixin<
        AccessControlGroup,
        number
    >;

    @BelongsTo(() => AccessControlGroup, "postingAccessControl")
    public postingAccessControl: AccessControlGroup;
    public getPostingAccessControl!: BelongsToGetAssociationMixin<
        AccessControlGroup
    >;
    public setPostingAccessControl!: BelongsToSetAssociationMixin<
        AccessControlGroup,
        number
    >;

    public showMinors: boolean;
    public hideFromSearchResults: boolean;
    public requireApproval: boolean;
    public hasViewMembersPermission: boolean;

    public static associations: {
        tags: Association<Tag, Community>;
        blogPosts: Association<BlogPost, Community>;
        avatar: Association<Community, Image>;
        coverImage: Association<Community, Image>;
        membershipRequests: Association<Community, CommunityMembershipRequest>;
        contentAccessControl: Association<Community, AccessControlGroup>;
        commentsAccessControl: Association<Community, AccessControlGroup>;
        followsAccessControl: Association<Community, AccessControlGroup>;
        reactionsAccessControl: Association<Community, AccessControlGroup>;
        membersAccessControl: Association<Community, AccessControlGroup>;
        postingAccessControl: Association<Community, AccessControlGroup>;
        members: Association<Community, Alias>;
        communityRules: Association<CommunityRules, Community>;
        // moderators: Association<Community, Alias>,
    };

    // deprecated
    public addTagWithNeo4j(
        tag: number | Tag,
        transaction: Transaction
    ): Promise<void> {
        return tagFunctions.addTagWithNeo4j(
            this,
            tag,
            "Community",
            transaction
        );
    }

    // deprecated
    public removeTagWithNeo4j(
        tag: number | Tag,
        transaction: Transaction
    ): Promise<void> {
        return tagFunctions.removeTagWithNeo4j(
            this,
            tag,
            "Community",
            transaction
        );
    }

    // deprecated
    public setTagsWithNeo4j(
        tags: (number | Tag | TagDisplayInterface)[] | undefined,
        transaction: Transaction
    ): Promise<void> {
        return tagFunctions.setTagsWithNeo4j(
            this,
            tags,
            "Community",
            transaction
        );
    }

    public setTagsWithDisplayNames(
        tags: TagDisplayInterface[],
        transaction: Transaction
    ): Promise<any> {
        return Community_Tag.destroy({
            where: {
                CommunityId: this.id
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
                            Community_Tag.create(
                                {
                                    TagId: tag.id,
                                    CommunityId: this.id,
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

    // Deprecated
    public addMemberWithNeo4j(
        alias: number | Alias,
        transaction: Transaction
    ): Promise<any> {
        return Promise.all([
            this.addMember(alias, { transaction }),
            runNeo4jQuery(
                "MATCH (c:Community {sqlId: $communitySqlIdParam}), " +
                    "(a:Alias {sqlId: $aliasSqlIdParam}) " +
                    "MERGE (a)-[:IS_MEMBER_OF]->(c) " +
                    "RETURN a",
                {
                    communitySqlIdParam: this.id,
                    aliasSqlIdParam:
                        typeof alias === "number" ? alias : alias.id
                }
            )
        ]);
    }

    public addMemberIfNotMember(
        memberId: number,
        transaction: Transaction
    ): Promise<void> {
        return this.hasMember(memberId, { transaction }).then(
            (present): void | Promise<void> => {
                if (!present) {
                    return this.addMember(memberId, { transaction });
                }
                return undefined;
            }
        );
    }

    // deprecated
    public removeMemberWithNeo4j(
        alias: number | Alias,
        transaction: Transaction
    ): Promise<void> {
        const promises: Promise<void>[] = [];

        promises.push(this.removeMember(alias, { transaction }));
        promises.push(
            runNeo4jQuery(
                "MATCH (:Community {sqlId: $communityId})<-[r:IS_MEMBER_OF]" +
                    "-(:Alias {sqlId: $aliasSqlIdParam}) " +
                    "DELETE r",
                {
                    communityId: this.id,
                    aliasSqlIdParam:
                        typeof alias === "number" ? alias : alias.id
                }
            ).then((): void => {
                return undefined;
            })
        );

        return Promise.all(promises).then((): void => {
            return undefined;
        });
    }

    public createMembershipRequest(
        alias: number | Alias,
        transaction: Transaction
    ): Promise<string> {
        const aliasId: number = typeof alias === "number" ? alias : alias.id;
        if (
            this.membersAccessControl.accessControlSetting ===
            AccessControlGroup.ACCESS_CONTROL_SETTINGS.full
        ) {
            return this.addMemberIfNotMember(aliasId, transaction).then(() => {
                return "You have accepted the invite and joined the community.";
            });
        } else {
            return CommunityMembershipRequest.create(
                {
                    status: CommunityMembershipRequest.REQUEST_STATUSES.pending,
                    aliasId,
                    communityId: this.id
                },
                { transaction }
            )
                .then(membershipRequest => {
                    return this.addMembershipRequest(membershipRequest, {
                        transaction
                    }).then(() => {
                        return membershipRequest.save({ transaction });
                    });
                })
                .then(() => {
                    return "You have accepted the invite and requested to join the community.";
                });
        }
    }

    public sanitizeContents(): void {
        this.description = sanitizeContents(this.description);
        this.links =
            this.links && this.links.map(link => sanitizeContents(link));
    }
}

Community.init(
    {
        name: {
            allowNull: false,
            type: DataTypes.TEXT
        },
        link: {
            unique: true,
            allowNull: false,
            type: DataTypes.TEXT,
            validate: {
                notEmpty: true
            }
        },
        links: {
            type: DataTypes.ARRAY(DataTypes.TEXT),
            allowNull: true
        },
        description: {
            allowNull: false,
            type: DataTypes.TEXT
        },
        hideFromSearchResults: {
            allowNull: false,
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        showMinors: {
            allowNull: false,
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        requireApproval: {
            allowNull: false,
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    },
    {
        sequelize,
        modelName: "Community"
    }
);

export { Community };
