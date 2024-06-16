import { EmailController } from "@controllers/EmailController";
import { Alias } from "@entities/Alias";
import { ModerationAction } from "@entities/ModerationAction";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import express, { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { auth, AuthRequest, currentSessions } from "../../Authorization/auth";
import { AccessControlGroupController } from "../../Controller/AccessControlGroupController";
import { AliasController } from "../../Controller/AliasController";
import { BlogController } from "../../Controller/BlogController";
import { SignupKey } from "../../Entity/SignupKey";
import { User } from "../../Entity/User";
import { database as sequelize } from "../../services/databaseService.js";
import { getDefaultImageLink } from "../../services/ImageService";
const userRouter = express.Router();

/*userRouter.get(
    "/db/userDBreset",
    ({}, res: Response): Promise<Response> => {
        // `force: true` will drop the table if it exists
        return User.sync({ force: true })
            .then((): void => {
                User.create({
                    email: "test@test.com",
                    password: "test"
                });
            })
            .then(
                (): Response => {
                    return res.send("test user created");
                }
            )
            .catch(e => res.send(e));
    }
);*/

userRouter.post(
    "/",
    async (req: Request, res: Response): Promise<Response> =>
        // Create a new user
        sequelize
            .transaction(t =>
                SignupKey.findOne({
                    where: {
                        key: req.body.key,
                        email: req.body.email
                    },
                    transaction: t
                }).then(signupKey => {
                    if (!signupKey) {
                        return Promise.reject("The access key was not found");
                    }
                    const user: User = User.build(
                        (({ email, password }) => ({ email, password }))(
                            req.body
                        )
                    );
                    if (req.body.ageCheck) {
                        user.isMinor = true;
                        const selectedDateString: string =
                            req.body.selectedDate;
                        const dateOfBirthString = selectedDateString
                            .split(".")
                            .reverse()
                            .join("-");
                        const dateOfBirth = new Date(dateOfBirthString);
                        user.dateOfBirth = dateOfBirth;
                    } else {
                        user.isMinor = false;
                    }
                    return user.save({ transaction: t }).then(savedUser => {
                        const promises: Promise<any>[] = [];
                        const name = req.body.name || "No name";

                        promises.push(signupKey.destroy({ transaction: t }));
                        // TODO change default image
                        promises.push(
                            AliasController.createAlias(
                                name,
                                getDefaultImageLink(),
                                savedUser,
                                {
                                    src: getDefaultImageLink(),
                                    name: "default Image",
                                    alt: "default Image"
                                },
                                t
                            ).then(alias => {
                                let aliasRelatedPromises: Promise<any>[] = [];
                                aliasRelatedPromises.push(
                                    BlogController.createUniqueLink(
                                        name,
                                        undefined,
                                        t
                                    ).then((link: string) =>
                                        BlogController.createBlog(
                                            {
                                                alias: alias.id,
                                                name,
                                                link,
                                                links: [],
                                                tags: [],
                                                description:
                                                    "Autocreated blog. Edit me, show your stuff!",
                                                coverImage: {
                                                    src: getDefaultImageLink()
                                                },
                                                avatar: {
                                                    src: getDefaultImageLink()
                                                },
                                                hideFromSearchResults: false
                                            },
                                            t
                                        )
                                    )
                                );
                                aliasRelatedPromises.push(
                                    AccessControlGroupController.createAccessControlGroup(
                                        {
                                            accessControlSetting: "full",
                                            isDefault: true,
                                            belongsToAlias: alias.id,
                                            name: "Open book"
                                        },
                                        alias.id,
                                        t
                                    )
                                );

                                return Promise.all(aliasRelatedPromises);
                            })
                        );
                        return Promise.all(promises).then(() => {
                            return res
                                .status(StatusCodes.CREATED)
                                .send({ savedUser });
                        });
                    });
                })
            )
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e.stack))
);

userRouter.post("/:userId(\\d+)", auth, (req: AuthRequest, res) => {
    const user: User = req.user;
    let userId = Number(req.params.userId);
    console.log(user);
    console.log(user.id);
    console.log(userId);

    if (!(user.id === userId)) {
        res.send("cheeky are we");
        return;
    }

    return bcrypt
        .compare(req.body.password, user.password)
        .then(match => {
            if (match) {
                if (req.body.newPassword) {
                    if (req.body.newPassword === req.body.newPasswordAgain)
                        user.password = req.body.newPassword;
                }
                return user.save().then(savedUser => {
                    res.send(savedUser);
                });
            } else {
                res.status(StatusCodes.UNAUTHORIZED).send("wrong password");
            }
        })
        .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e));
});

userRouter.post("/findEmail", auth, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user.moderator && !req.user.admin && !req.user.superadmin) {
            return res
                .status(StatusCodes.UNAUTHORIZED)
                .send("Only an moderator can use this endpoint");
        }

        if (!req.body.aliasId) {
            return res
                .status(StatusCodes.BAD_REQUEST)
                .send("You must provide the alias id.");
        }

        if (isNaN(Number(req.body.aliasId))) {
            return res
                .status(StatusCodes.BAD_REQUEST)
                .send("Alias Id must be a number.");
        }

        const { aliasId } = req.body;
        const alias: Alias | null = await Alias.findOne({
            where: {
                id: aliasId
            }
        });
        if (alias) {
            const user: User | null = await User.findOne({
                where: {
                    id: alias.UserId
                }
            });
            if (user) {
                if (
                    user.admin ||
                    user.superadmin ||
                    (user.moderator && !(req.user.superadmin || req.user.admin))
                ) {
                    return res
                        .status(StatusCodes.FORBIDDEN)
                        .send(
                            `User is a moderator, seek information elsewhere`
                        );
                }

                await ModerationAction.create({
                    AliasId: req.currentAlias,
                    reason: "Find email for alias",
                    details: {
                        action: "search",
                        item: "user",
                        alias: {
                            id: alias.id,
                            name: alias.name
                        }
                    },
                    createdAt: new Date()
                });

                return res
                    .status(StatusCodes.OK)
                    .send(`Email for Alias ${alias.name}: ${user.email}`);
            }
            return res
                .status(StatusCodes.INTERNAL_SERVER_ERROR)
                .send(`No user found for alias with Id ${aliasId}`);
        } else {
            return res
                .status(StatusCodes.INTERNAL_SERVER_ERROR)
                .send(`No alias with Id ${aliasId}`);
        }
    } catch (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(error);
    }
});

userRouter.post(
    "/adminSuspend",
    auth,
    async (req: AuthRequest, res: Response) => {
        try {
            if (
                !req.user.moderator &&
                !req.user.admin &&
                !req.user.superadmin
            ) {
                return res
                    .status(StatusCodes.UNAUTHORIZED)
                    .send("Only a moderator can use this endpoint");
            }

            if (!req.body.email) {
                return res
                    .status(StatusCodes.BAD_REQUEST)
                    .send("You must provide the email of the user to suspend.");
            }

            return User.findOne({ where: { email: req.body.email } }).then(
                async affectedUser => {
                    if (!affectedUser) {
                        return res
                            .status(StatusCodes.INTERNAL_SERVER_ERROR)
                            .send("User with that email does not exist.");
                    }

                    if (affectedUser.superadmin || affectedUser.admin) {
                        return res
                            .status(StatusCodes.FORBIDDEN)
                            .send(
                                "Unable to suspend an administrator, request assistance"
                            );
                    } else if (
                        affectedUser.moderator &&
                        !(req.user.admin || req.user.superadmin)
                    ) {
                        return res
                            .status(StatusCodes.FORBIDDEN)
                            .send(
                                "Only an administrator can suspend a moderator, request assistance"
                            );
                    }

                    const userTokens = affectedUser.tokens;
                    affectedUser.tokens = [];
                    userTokens?.forEach(t => {
                        currentSessions.delete(t);
                    });

                    affectedUser.suspended = true;
                    affectedUser.suspendedAt = new Date();

                    // TODO update account suspension email text
                    await affectedUser.save().then(() => {
                        // return EmailController.sendEmail(
                        //     affectedUser.email,
                        //     `
                        //     Your Fanexus account has been suspended.
                        //     `,
                        //     "Fanexus account suspended",
                        //     "noreply@fanexus.net"
                        // );
                    });
                    await ModerationAction.create({
                        AliasId: req.currentAlias,
                        reason: req.body.reason || "Suspend user account",
                        details: {
                            action: "suspend",
                            item: "user",
                            userEmail: affectedUser.email
                        },
                        createdAt: new Date()
                    });

                    return res
                        .status(StatusCodes.OK)
                        .send("Suspended user account.");
                }
            );
        } catch (error) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(error);
        }
    }
);

userRouter.post(
    "/login",
    async (req: Request, res: Response): Promise<Response> => {

        console.log(req.body);
        
        // Login a registered user
        try {
            const { email, password } = req.body;
            const user: User = await User.findByCredentials(email, password);
            if (!user) {
                return res.status(StatusCodes.UNAUTHORIZED).send({
                    error: "Login failed! Check authentication credentials."
                });
            }

            if (user.suspended) {
                return res.status(StatusCodes.FORBIDDEN).send({
                    error: "Login failed. This account is suspended."
                });
            }

            const token: string = await user.generateAuthToken();
            const userData = {
                email: user.email,
                id: user.id,
                aliases: user.Aliases,
                moderator: user.moderator,
                tagWrangler: user.tagWrangler,
                superTagWrangler: user.superTagWrangler
            };

            // res.send(user)
            return res.send({ userData, token });
        } catch (error) {
            console.log(error);
            return res.status(StatusCodes.BAD_REQUEST).send(error);
        }
    }
);

userRouter.get(
    "/me",
    auth,
    (req: AuthRequest, res: Response): Response => {
        // View logged in user profile
        return res.send(req.user);
    }
);

userRouter.post(
    "/me/logout",
    auth,
    async (req: AuthRequest, res: Response): Promise<Response> => {
        // Log user out of the application
        try {
            let currentTokens = req.user.tokens;
            if (!currentTokens) {
                return res.send("success");
            }
            currentTokens = currentTokens.filter((token: string) => {
                return token !== req.token;
            });
            req.user.tokens = currentTokens;
            await req.user.save();
            currentSessions.delete(req.token);
            return res.send("success");
        } catch (error) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(error);
        }
    }
);

userRouter.post(
    "/me/logoutall",
    auth,
    async (req: AuthRequest, res: Response): Promise<Response> => {
        // Log user out of all devices
        try {
            req.user.tokens = null;
            await req.user.save();
            return res.send("success");
        } catch (error) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(error);
        }
    }
);

userRouter.post(
    "/adminPasswordReset",
    auth,
    async (req: AuthRequest, res: Response) => {
        // Log user out of all devices
        try {
            if (!req.user.admin) {
                return res
                    .status(StatusCodes.BAD_REQUEST)
                    .send("Only an admin can use this endpoint");
            }

            return User.findOne({ where: { email: req.body.email } }).then(
                affectedUser => {
                    if (!affectedUser) {
                        return res
                            .status(StatusCodes.BAD_REQUEST)
                            .send("user with that email does not exist");
                    }
                    affectedUser.password = req.body.password;
                    return affectedUser.save().then(() => {
                        return res.send("Password changed");
                    });
                }
            );
        } catch (error) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(error);
        }
    }
);

userRouter.post(
    "/requestPasswordReset",
    async (req: Request, res: Response) => {
        // Login a registered user
        try {
            const { email } = req.body;
            const user: User | null = await User.findOne({
                where: { email }
            });
            if (!user) {
                // Don't send an error back... we don't want to reveal this
                // return res.status(StatusCodes.UNAUTHORIZED).send({
                //     error: "Email doesnt use Fanexus"
                // });
                return res.send("Password reset link sent to email.");
            }

            user.emailChangeRequested = true;
            user.emailChangeKey = crypto.randomBytes(20).toString("hex");
            user.save().then(() => {
                return EmailController.sendEmail(
                    user.email,
                    `
Hello there! <br> 
A request to reset the password has been received <br>
Go to the link below if it was you, or ignore this email otherwise <br>
<a href ="https://${process.env.SITE_URL}/password-reset?resetKey=${user.emailChangeKey}">https://${process.env.SITE_URL}/password-reset?resetKey=${user.emailChangeKey}</a><br>
`,
                    "Fanexus password reset request",
                    "noreply@fanexus.net"
                ).then(() => {
                    return res.send("Password reset link sent to email.");
                });
            });
        } catch (error) {
            console.log(error);
            return res.status(StatusCodes.BAD_REQUEST).send(error);
        }
    }
);

userRouter.post("/resetPassword", async (req: AuthRequest, res: Response) => {
    // Log user out of all devices
    try {
        const { resetKey, password } = req.body;
        return User.findOne({
            where: { emailChangeKey: resetKey, emailChangeRequested: true }
        }).then(affectedUser => {
            if (!affectedUser) {
                return res
                    .status(StatusCodes.BAD_REQUEST)
                    .send("Key isnt valid");
            }
            affectedUser.emailChangeRequested = false;
            affectedUser.password = password;
            return affectedUser.save().then(() => {
                return res.send("Password changed");
            });
        });
    } catch (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(error);
    }
});

export { userRouter };
