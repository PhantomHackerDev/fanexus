import express from "express";
import { auth, AuthRequest } from "../../Authorization/auth";
import { AccessControlGroupController } from "../../Controller/AccessControlGroupController";
import { ErrorReportService } from "../../services/ErrorReportService";
import { AccessControlGroup } from "../../Entity/AccessControlGroup";
import { Response } from "express";
import { StatusCodes } from "http-status-codes";
import { database as sequelize } from "../../services/databaseService.js";

const accessControlRouter = express.Router();

const addRoutes = () => {
    accessControlRouter.get("/my", auth, getMyAccessControlGroups);
    accessControlRouter.get(
        "/:accessControlId(\\d+)",
        auth,
        getAccessControlGroup
    );
    accessControlRouter.put("/", auth, createAccessControlGroup);
    accessControlRouter.post(
        "/:accessControlId(\\d+)",
        auth,
        updateAccessControlGroup
    );
    accessControlRouter.delete(
        "/:accessControlId",
        auth,
        deleteAccessControlGroup
    );
    accessControlRouter.post(
        "/:accessControlId(\\d+)/addAliases",
        auth,
        addAliasesToAccessControlGroup
    );
    accessControlRouter.post(
        "/:accessControlId(\\d+)/removeAliases",
        auth,
        removeAliasesFromAccessControlGroup
    );
    accessControlRouter.post(
        "/:accessControlId(\\d+)/addAccessControlGroup",
        auth,
        addAccessControlGroupInclusion
    );
    accessControlRouter.post(
        "/:accessControlId(\\d+)/removeAccessControlGroup",
        auth,
        removeAccessControlGroupInclusion
    );
};

type AuthRouteHandler = (req: AuthRequest, res: Response) => Promise<any>;

export const getMyAccessControlGroups: AuthRouteHandler = (req, res) => {
    const aliasId = req.currentAlias;
    return AccessControlGroupController.getAliasPrivacyGroups(aliasId, true)
        .then(acgs => {
            res.send(acgs);
        })
        .catch(error => {
            res.status(StatusCodes.BAD_REQUEST).send(
                ErrorReportService.getEnvError(
                    error,
                    "accessControl_fetch_for_alias_fail"
                )
            );
        });
};

const deleteAccessControlGroup: AuthRouteHandler = (req, res) => {
    sequelize
        .transaction(transaction => {
            const accessControlId = req.params.accessControlId;
            return AccessControlGroupController.getAccessControlGroup(
                accessControlId,
                req.currentAlias,
                undefined,
                transaction
            ).then((acg: AccessControlGroup) => {
                return Promise.all([
                    acg
                        .getBelongsToAccessControlGroups({ transaction })
                        .then(belongsToAcgs =>
                            belongsToAcgs.map(belongsToAcg =>
                                Promise.all([
                                    AccessControlGroupController.removeContainsAccessControlGroup(
                                        belongsToAcg,
                                        acg,
                                        transaction
                                    ),
                                    acg.removeBelongsToAccessControlGroup(
                                        belongsToAcg,
                                        { transaction }
                                    )
                                ])
                            )
                        ),
                    acg.update({ userDeleted: true }, { transaction })
                ]).then(() => {
                    res.send("Deleted");
                });
            });
            // it was temporarily decided to hide acg instead of delete them because of what happens to blogposts with the privacy group, currently it will keep everything as is
            /*

            promises.push(new Promise((resolve, reject) => {
                let removeContainsPromises: Promise<any>[] = [];
                acg.getContainsAccessControlGroups().then(containsAcgs => {
                    containsAcgs.forEach(containsAcg => {
                        removeContainsPromises.push(AccessControlGroupController.removeContainsAccessControlGroup(acg, containsAcg));
                        removeContainsPromises.push(containsAcg.removeBelongsToAccessControlGroup(acg));
                    });
                    return Promise.all(removeContainsPromises).then(() => {resolve()})
                })
            })
            );

            return Promise.all(promises).then(()=> {
                return acg.destroy().then(()=>{
                    res.send("Deleted")
                })
            })*/
        })
        .catch(error => {
            res.status(StatusCodes.BAD_REQUEST).send(
                ErrorReportService.getEnvError(
                    error,
                    "accessControl_delete_fail"
                )
            );
        })};

export const getAccessControlGroup: AuthRouteHandler = (req, res) =>
    sequelize
        .transaction(transaction => {
            const accessControlId = req.params.accessControlId;
            return Promise.all([
                AccessControlGroupController.getAccessControlRelatedEntity(
                    accessControlId,
                    transaction
                ),
                AccessControlGroupController.getAccessControlGroup(
                    accessControlId,
                    req.currentAlias,
                    undefined,
                    transaction
                )
            ]).then(([origin, accessControlGroup]) => {
                return res.send({
                    ...accessControlGroup.toJSON(),
                    origin
                });
            });
        })
        .catch(error => {
            console.log(error);
            res.status(StatusCodes.BAD_REQUEST).send(
                ErrorReportService.getEnvError(
                    error,
                    "accessControl_fetch_fail"
                )
            );
        });

export const createAccessControlGroup: AuthRouteHandler = (req, res) =>
    sequelize
        .transaction(transaction => {
            let name: string = req.body.name;
            let isDefault: boolean = req.body.isDefault;
            let accessControlSetting: keyof typeof AccessControlGroup["ACCESS_CONTROL_SETTINGS"] =
                req.body.accessControlSetting;

            return AccessControlGroupController.createAccessControlGroup(
                {
                    accessControlSetting,
                    name,
                    isDefault,
                    belongsToAlias: req.currentAlias
                },
                req.currentAlias,
                transaction
            ).then(acg => {
                return res.send(acg);
            });
        })
        .catch(error => {
            return res
                .status(StatusCodes.BAD_REQUEST)
                .send(
                    ErrorReportService.getEnvError(
                        error,
                        "accessControl_create_fail"
                    )
                );
        });

export const updateAccessControlGroup: AuthRouteHandler = (req, res) =>
    sequelize
        .transaction(transaction => {
            const accessControlId = req.params.accessControlId;
            console.log(accessControlId);
            return AccessControlGroupController.getAccessControlGroup(
                accessControlId,
                req.currentAlias,
                undefined,
                transaction
            ).then(accessControlGroup => {
                return AccessControlGroupController.editAccessControlGroup(
                    accessControlGroup,
                    {
                        accessControlSetting: req.body.accessControlSetting,
                        name: req.body.name,
                        isDefault: req.body.isDefault
                    },
                    transaction
                ).then((editedAccessControlGroup: any) => {
                    return res.send(editedAccessControlGroup);
                });
            });
        })
        .catch((error: any) => {
            console.error(error);
            res.status(StatusCodes.BAD_REQUEST).send(
                ErrorReportService.getEnvError(
                    error,
                    "accessControl_fetch_fail"
                )
            );
        });

export const addAliasesToAccessControlGroup: AuthRouteHandler = (req, res) =>
    sequelize
        .transaction(transaction => {
            const accessControlId = Number(req.params.accessControlId);
            const aliases = req.body.aliases;
            return AccessControlGroupController.addAliasesToAccessControlGroup(
                accessControlId,
                req.currentAlias,
                aliases,
                undefined,
                transaction
            ).then(() => {
                return AccessControlGroupController.addAliasesToRelatedAccessControlGroups(
                    accessControlId,
                    req.currentAlias,
                    aliases,
                    undefined,
                    transaction
                ).then(() => {
                    return res.send("aliases added");
                });
            });
        })
        .catch(error => {
            console.error(error);
            return res
                .status(StatusCodes.BAD_REQUEST)
                .send(
                    ErrorReportService.getEnvError(
                        error,
                        "accessControl_fetch_fail"
                    )
                );
        });

export const removeAliasesFromAccessControlGroup: AuthRouteHandler = (
    req,
    res
) =>
    sequelize
        .transaction(transaction => {
            const accessControlId = Number(req.params.accessControlId);
            const aliasIds = req.body.aliases;
            return AccessControlGroupController.removeAliasesFromAccessControlGroup(
                accessControlId,
                req.currentAlias,
                aliasIds,
                undefined,
                transaction
            ).then((editedAccessControlGroup: any) => {
                return AccessControlGroupController.removeAliasesFromRelatedAccessControlGroups(
                    accessControlId,
                    req.currentAlias,
                    aliasIds,
                    undefined,
                    transaction
                ).then(() => {
                    return res.send(editedAccessControlGroup);
                });
            });
        })
        .catch((error: any) => {
            console.log(error);
            return res
                .status(StatusCodes.BAD_REQUEST)
                .send(
                    ErrorReportService.getEnvError(
                        error,
                        "accessControl_fetch_fail"
                    )
                );
        });

export const addAccessControlGroupInclusion: AuthRouteHandler = (req, res) =>
    sequelize
        .transaction(transaction => {
            const accessControlId = Number(req.params.accessControlId);
            const addAccessControlIds: number[] = req.body.addAccessControlIds;

            const acgids = [accessControlId].concat(addAccessControlIds);

            return AccessControlGroup.findAll({
                where: { id: acgids, belongsToAliasId: req.currentAlias },
                transaction
            }).then(acgs => {
                let acgSettings = acgs.map(acg => acg.accessControlSetting);
                if (
                    acgSettings.includes(
                        AccessControlGroup.ACCESS_CONTROL_SETTINGS
                            .specificInclude
                    ) &&
                    acgSettings.includes(
                        AccessControlGroup.ACCESS_CONTROL_SETTINGS
                            .specificExclude
                    )
                ) {
                    // this is sufficient as it also checks the acg being added to
                    return res
                        .status(StatusCodes.INTERNAL_SERVER_ERROR)
                        .send("can not mix allowlist and denylist");
                }
                const accessControlGroup = acgs.find(
                    ({ id }) => id === accessControlId
                );
                if (!accessControlGroup) {
                    return Promise.reject("Privacy group not found.");
                }
                acgs.splice(acgs.indexOf(accessControlGroup), 1);
                return Promise.all(
                    acgs.map(acg =>
                        Promise.all([
                            AccessControlGroupController.addContainsAccessControlGroup(
                                accessControlGroup,
                                acg,
                                req.currentAlias,
                                transaction
                            ),
                            acg.addBelongsToAccessControlGroup(
                                accessControlGroup,
                                {
                                    transaction
                                }
                            )
                        ])
                    )
                ).then(() => {
                    return res.send("success");
                });
            });
        })
        .catch((e: any) => {
            console.log(e);
            res.status(StatusCodes.BAD_REQUEST).send(e);
        });

export const removeAccessControlGroupInclusion: AuthRouteHandler = (req, res) =>
    sequelize
        .transaction(transaction => {
            const accessControlId = Number(req.params.accessControlId);
            const removeAccessControlIds: number[] =
                req.body.removeAccessControlIds;

            const acgids = [accessControlId].concat(removeAccessControlIds);

            return AccessControlGroup.findAll({
                where: { id: acgids, belongsToAliasId: req.currentAlias },
                transaction
            }).then(acgs => {
                const accessControlGroup = acgs.find(
                    acg => acg.id === accessControlId
                );
                if (!accessControlGroup) {
                    return Promise.reject("Privacy group not found.");
                }
                acgs.splice(acgs.indexOf(accessControlGroup), 1);
                let addPromises: Promise<any>[] = [];

                acgs.forEach((acg: AccessControlGroup) => {
                    addPromises.push(
                        AccessControlGroupController.removeContainsAccessControlGroup(
                            accessControlGroup,
                            acg,
                            transaction
                        )
                    );
                    addPromises.push(
                        acg.removeBelongsToAccessControlGroup(
                            accessControlGroup,
                            { transaction }
                        )
                    );
                });
                return Promise.all(addPromises).then(() => {
                    res.send("success");
                });
            });
        })
        .catch((e: any) => {
            console.log(e);
            res.send(e);
        });

addRoutes();

export { accessControlRouter };
