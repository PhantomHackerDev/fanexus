import {
    CreateAccessControlGroupInterface,
    EditAccessControlGroupInterface
} from "../Interface/AccessControlGroupInterface";
import { AccessControlGroup } from "../Entity/AccessControlGroup";
import { ErrorReportService } from "../services/ErrorReportService";
import { Image } from "../Entity/Image";
import { Alias } from "../Entity/Alias";
import { Blog } from "../Entity/Blog";
import { Community } from "../Entity/Community";
import { Op, Sequelize } from "sequelize";
import { BlogPost } from "../Entity/BlogPost";
import { Transaction } from "sequelize";

type ValueOf<T> = T[keyof T];
type AccessControlSetting = ValueOf<
    typeof AccessControlGroup.ACCESS_CONTROL_SETTINGS
>;

class AccessControlGroupController {
    public createAccessControlGroup(
        {
            accessControlSetting,
            belongsToAlias,
            isDefault,
            name,
            aliases = []
        }: CreateAccessControlGroupInterface,
        createdByAlias: number | Alias,
        transaction: Transaction
    ): Promise<AccessControlGroup> {
        if (
            !accessControlSetting ||
            !(
                accessControlSetting in
                AccessControlGroup.ACCESS_CONTROL_SETTINGS
            )
        ) {
            throw new Error(
                ErrorReportService.getEnvError(
                    "Wrong access control setting",
                    "accessControlGroup.setting.error"
                ) as string
            );
        }
        const accessControlSettingValue: AccessControlSetting =
            AccessControlGroup.ACCESS_CONTROL_SETTINGS[accessControlSetting];
        return AccessControlGroup.create(
            {
                accessControlSetting: accessControlSettingValue,
                name,
                belongsToAliasId: belongsToAlias,
                isDefault
            },
            { transaction }
        ).then(accessControlGroup => {
            if (
                accessControlSetting ===
                AccessControlGroup.ACCESS_CONTROL_SETTINGS.specificInclude
            ) {
                return Promise.all(
                    aliases
                        .map(alias =>
                            accessControlGroup.addAlias(
                                alias,
                                undefined,
                                transaction
                            )
                        )
                        .concat(
                            !aliases.includes(createdByAlias)
                                ? accessControlGroup.addAlias(
                                      createdByAlias,
                                      false,
                                      transaction
                                  )
                                : []
                        )
                ).then(() => accessControlGroup);
            } else if (
                accessControlSetting ===
                AccessControlGroup.ACCESS_CONTROL_SETTINGS.specificExclude
            ) {
                return Promise.all(
                    aliases
                        .filter(alias => alias !== belongsToAlias)
                        .map(alias =>
                            accessControlGroup.addAlias(
                                alias,
                                undefined,
                                transaction
                            )
                        )
                ).then(() => accessControlGroup);
            }
            return accessControlGroup;
        });
    }

    public editAccessControlGroup(
        accessControlGroup: AccessControlGroup,
        {
            accessControlSetting,
            isDefault,
            name
        }: EditAccessControlGroupInterface,
        transaction: Transaction
    ) {
        if (
            !accessControlSetting ||
            !(
                accessControlSetting in
                AccessControlGroup.ACCESS_CONTROL_SETTINGS
            )
        ) {
            return Promise.reject(
                Error(
                    ErrorReportService.getEnvError(
                        "Wrong access control setting",
                        "accessControlGroup.setting.error"
                    )
                )
            );
        }
        const accessControlSettingValue: AccessControlSetting =
            AccessControlGroup.ACCESS_CONTROL_SETTINGS[accessControlSetting];
        accessControlGroup.accessControlSetting = accessControlSettingValue;
        accessControlGroup.name = name || accessControlGroup.name;
        accessControlGroup.isDefault =
            typeof isDefault === "boolean"
                ? isDefault
                : accessControlGroup.isDefault;

        const promises: Promise<any>[] = [];
        if (
            accessControlSetting ===
                AccessControlGroup.ACCESS_CONTROL_SETTINGS.specificInclude ||
            accessControlSetting ===
                AccessControlGroup.ACCESS_CONTROL_SETTINGS.specificExclude
        ) {
            if (
                accessControlGroup.belongsToAliasId &&
                accessControlSetting ===
                    AccessControlGroup.ACCESS_CONTROL_SETTINGS.specificInclude
            ) {
                promises.push(
                    accessControlGroup.addAlias(
                        accessControlGroup.belongsToAliasId,
                        false,
                        transaction
                    )
                );
            }
            if (
                accessControlGroup.belongsToAliasId &&
                accessControlSetting ===
                    AccessControlGroup.ACCESS_CONTROL_SETTINGS.specificExclude
            ) {
                promises.push(
                    accessControlGroup.removeAlias(
                        accessControlGroup.belongsToAliasId,
                        false,
                        transaction
                    )
                );
            }
        }
        return Promise.all(promises).then(() =>
            accessControlGroup.save({ transaction })
        );
    }

    public addAliasesToAccessControlGroup(
        accessControlGroupId: number | string,
        currentAlias: number,
        aliasIds: number[],
        isDirect = true,
        transaction: Transaction
    ) {
        return this.getAccessControlGroup(
            accessControlGroupId,
            currentAlias,
            undefined,
            transaction
        )
            .then(accessControlGroup => {
                return Promise.all(
                    aliasIds.map(aliasId => {
                        if (
                            accessControlGroup.accessControlSetting ===
                            AccessControlGroup.ACCESS_CONTROL_SETTINGS
                                .specificExclude
                        ) {
                            return Alias.findByPk(aliasId, {
                                transaction
                            }).then(alias => {
                                if (alias) {
                                    return Promise.all([
                                        accessControlGroup.addAlias(
                                            alias.id,
                                            isDirect,
                                            transaction
                                        ),
                                        alias.getUser().then(user => {
                                            return accessControlGroup
                                                .addUser(user, {
                                                    transaction
                                                })
                                                .catch(error => {
                                                    // this complains if you add 2 aliases from same user for specific exclude,
                                                    // because you try to add the same user twice, but that causes no problems AFAIK
                                                    console.log(error);
                                                });
                                        })
                                    ]);
                                }
                            });
                        } else {
                            return accessControlGroup.addAlias(
                                aliasId,
                                isDirect,
                                transaction
                            );
                        }
                    })
                );
            })
            .catch(error => {
                return Promise.reject(error);
            });
    }

    public removeAliasesFromAccessControlGroup(
        accessControlGroupId: number | string,
        currentAlias: number,
        aliasIds: number[],
        isDirect = true,
        transaction: Transaction
    ) {
        return this.getAccessControlGroup(
            accessControlGroupId,
            currentAlias,
            undefined,
            transaction
        )
            .then(accessControlGroup => {
                return Promise.all(
                    aliasIds.map(aliasId => {
                        const promise: Promise<any> =
                            accessControlGroup.accessControlSetting ===
                            AccessControlGroup.ACCESS_CONTROL_SETTINGS
                                .specificExclude
                                ? Alias.findByPk(aliasId, { transaction }).then(
                                      alias => {
                                          if (!alias) {
                                              return Promise.reject(
                                                  `One of the aliaes does not exist: ${alias}`
                                              );
                                          }
                                          return Promise.all([
                                              accessControlGroup.removeAlias(
                                                  alias,
                                                  isDirect,
                                                  transaction
                                              ),
                                              alias.getUser().then(user => {
                                                  return accessControlGroup.removeUser(
                                                      user,
                                                      { transaction }
                                                  );
                                              })
                                          ]);
                                      }
                                  )
                                : accessControlGroup.removeAlias(
                                      aliasId,
                                      isDirect,
                                      transaction
                                  );
                        return promise;
                    })
                );
            })
            .catch(error => {
                return Promise.reject(error);
            });
    }

    public getAccessControlGroup(
        accessControlGroupId: number | string,
        AliasId: number,
        directOnly = true,
        transaction: Transaction
    ) {
        console.log(accessControlGroupId);
        const aliasRelationConditionsAllowed = [true].concat(
            directOnly ? [] : false
        );
        const whereCondition = {
            "$Aliases->AccessControlGroup_Alias.isDirectMember$": {
                [Op.in]: aliasRelationConditionsAllowed
            }
        };
        console.log(whereCondition);
        return AccessControlGroup.findOne({
            where: {
                id: accessControlGroupId,
                belongsToAliasId: AliasId
            },
            include: [
                {
                    model: Alias,
                    as: "Aliases",
                    attributes: {
                        include: [
                            [
                                Sequelize.literal(
                                    `(SELECT "isDirectMember" FROM "AccessControlGroup_Alias" WHERE "AccessControlGroup_Alias"."AliasId"="Aliases"."id" AND "AccessControlGroup_Alias"."AccessControlGroupId"=${accessControlGroupId})`
                                ),
                                "isDirectMember"
                            ]
                        ],
                        exclude: [
                            "UserId",
                            "isMinor",
                            "showMinors",
                            "createdAt",
                            "updatedAt"
                        ]
                    },
                    where: whereCondition,
                    required: false,
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
                },
                {
                    model: Alias,
                    attributes: ["id", "name", "avatarId"],
                    as: "belongsToAlias"
                },
                {
                    model: AccessControlGroup,
                    as: "containsAccessControlGroups",
                    include: [
                        {
                            model: Alias,
                            as: "Aliases",
                            attributes: ["id"]
                        }
                    ]
                },
                {
                    model: AccessControlGroup,
                    as: "belongsToAccessControlGroups",
                    include: [
                        {
                            model: Alias,
                            as: "Aliases",
                            attributes: ["id"]
                        }
                    ]
                }
            ],
            transaction
        }).then(accessControlGroup => {
            if (!accessControlGroup) {
                return Promise.reject("AccessControlGroup not found");
            }
            return accessControlGroup;
        });
    }

    public getAccessControlRelatedEntity(
        accessId: number | string,
        transaction: Transaction
    ): Promise<any> {
        return Promise.all([
            Blog.findOne({
                where: {
                    [Op.or]: [
                        { contentAccessControlId: accessId },
                        { commentsAccessControlId: accessId },
                        { followsAccessControlId: accessId },
                        { reactionsAccessControlId: accessId }
                    ]
                },
                transaction
            }),
            Community.findOne({
                where: {
                    [Op.or]: [
                        { contentAccessControlId: accessId },
                        { commentsAccessControlId: accessId },
                        { followsAccessControlId: accessId },
                        { reactionsAccessControlId: accessId },
                        { membersAccessControlId: accessId },
                        { postingAccessControlId: accessId }
                    ]
                },
                transaction
            }),
            BlogPost.findOne({
                where: {
                    [Op.or]: [{ AccessControlGroupId: accessId }]
                },
                transaction
            })
        ]).then(([blog, community, blogPost]) => {
            if (blog) {
                blog.setDataValue("type", "blog");
                return blog;
            }
            if (community) {
                community.setDataValue("type", "community");
                return community;
            }
            if (blogPost) {
                blogPost.setDataValue("type", "blogPost");
                return blogPost;
            }
        });
    }

    public addAliasesToRelatedAccessControlGroups(
        accessControlGroupId: number,
        currentAlias: number,
        aliasIds: number[],
        aliasesAddedToAcgIds: number[] = [],
        transaction: Transaction
    ): Promise<any> {
        return this.getAccessControlGroup(
            accessControlGroupId,
            currentAlias,
            undefined,
            transaction
        ).then(accessControlGroup => {
            if (!accessControlGroup.belongsToAccessControlGroups.length) {
                return;
            } else {
                return Promise.all(
                    accessControlGroup.belongsToAccessControlGroups
                        .filter(
                            ({ id }: { id: number }) =>
                                !aliasesAddedToAcgIds.includes(id)
                        )
                        .map(({ id }: { id: number }) =>
                            Promise.all([
                                this.addAliasesToAccessControlGroup(
                                    id,
                                    currentAlias,
                                    aliasIds,
                                    false,
                                    transaction
                                ),
                                this.addAliasesToRelatedAccessControlGroups(
                                    id,
                                    currentAlias,
                                    aliasIds,
                                    aliasesAddedToAcgIds.concat(id),
                                    transaction
                                )
                            ])
                        )
                );
            }
        });
    }

    public removeAliasesFromRelatedAccessControlGroups(
        accessControlGroupId: number,
        currentAlias: number,
        aliasIds: number[],
        aliasesRemovedFromAcgIds: number[] = [],
        transaction: Transaction
    ): Promise<any> {
        return this.getAccessControlGroup(
            accessControlGroupId,
            currentAlias,
            undefined,
            transaction
        ).then(accessControlGroup => {
            if (!accessControlGroup.belongsToAccessControlGroups.length) {
                return;
            } else {
                return Promise.all(
                    accessControlGroup.belongsToAccessControlGroups
                        .filter(
                            ({ id }) => !aliasesRemovedFromAcgIds.includes(id)
                        )
                        .map(({ id }) =>
                            Promise.all([
                                this.removeAliasesFromAccessControlGroup(
                                    id,
                                    currentAlias,
                                    aliasIds,
                                    false,
                                    transaction
                                ),
                                this.removeAliasesFromRelatedAccessControlGroups(
                                    id,
                                    currentAlias,
                                    aliasIds,
                                    aliasesRemovedFromAcgIds.concat(id),
                                    transaction
                                )
                            ])
                        )
                );
            }
        });
    }

    public addContainsAccessControlGroup(
        acg1: AccessControlGroup,
        acg2: AccessControlGroup,
        currentAlias: number,
        transaction: Transaction
    ) {
        return acg2.getAliases({ transaction }).then(aliases => {
            const aliasIds = aliases.map(alias => alias.id);
            return Promise.all([
                acg1.addContainsAccessControlGroup(acg2, {
                    transaction
                }),
                this.addAliasesToAccessControlGroup(
                    acg1.id,
                    currentAlias,
                    aliasIds,
                    false,
                    transaction
                )
            ]);
        });
    }

    public removeContainsAccessControlGroup(
        acg1: AccessControlGroup,
        acg2: AccessControlGroup,
        transaction: Transaction
    ) {
        let removePromise = new Promise(resolve => {
            return Promise.all([
                acg1.getContainsAccessControlGroups({ transaction }),
                acg2.getAliases({ transaction })
            ]).then(([acgs, aliasesInRemoveAcg]) => {
                // dont count aliases in the group to be removed
                acgs = acgs.filter(acg => acg.id !== acg2.id);

                return Promise.all(
                    acgs.map(acg => acg.getAliases({ transaction }))
                ).then(([aliasesInContainedAcgs]) => {
                    aliasesInContainedAcgs = aliasesInContainedAcgs
                        ? aliasesInContainedAcgs
                        : [];
                    let aliasesInContainedAcgsIds = aliasesInContainedAcgs.map(
                        aICACG => aICACG.id
                    );
                    let aliasesToRemove = aliasesInRemoveAcg.filter(
                        a => !aliasesInContainedAcgsIds.includes(a.id)
                    );
                    return Promise.all(
                        aliasesToRemove.map(aliasToRemove =>
                            acg1.removeAlias(aliasToRemove, false, transaction)
                        )
                    ).then(() => {
                        let removeRelationsPromises: Promise<any>[] = [];
                        removeRelationsPromises.push(
                            acg1.removeContainsAccessControlGroup(acg2, {
                                transaction
                            })
                        );
                        removeRelationsPromises.push(
                            acg2.removeBelongsToAccessControlGroup(acg1, {
                                transaction
                            })
                        );
                        return resolve(Promise.all(removeRelationsPromises));
                    });
                });
            });
        });

        return removePromise;
    }

    public getAliasPrivacyGroups(
        aliasId: number,
        hideDeleted?: boolean
    ): Promise<AccessControlGroup[]> {
        let whereOptions = {
            belongsToAliasId: aliasId,
            ...(hideDeleted ? { userDeleted: false } : {})
        };
        return AccessControlGroup.findAll({ where: whereOptions });
    }
}

const controller = new AccessControlGroupController();
export { controller as AccessControlGroupController };
