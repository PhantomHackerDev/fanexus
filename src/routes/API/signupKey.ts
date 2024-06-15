import express from "express";
import crypto from "crypto";
import { auth, AuthRequest } from "../../Authorization/auth";
import { SignupKey } from "../../Entity/SignupKey";
import { User } from "../../Entity/User";
import { StatusCodes } from "http-status-codes";
import { EmailController } from "../../Controller/EmailController";
export const signupKeyRouter = express.Router();

signupKeyRouter.post("/", auth, (req: AuthRequest, res) => {
    if (!req.user.moderator) {
        return res.status(StatusCodes.FORBIDDEN).send("User must be moderator");
    }

    return Promise.all([
        SignupKey.count({
            where: {
                email: req.body.email
            }
        }),
        User.count({
            where: {
                email: req.body.email
            }
        })
    ])
        .then(([signups, users]) => {
            if (signups || users) {
                return Promise.reject(
                    "This user has already signed up or given a key."
                );
            } else {
                return SignupKey.create({
                    email: req.body.email,
                    key: crypto.randomBytes(20).toString("hex")
                }).then(createdSignup => {
                    return EmailController.sendEmail(
                        req.body.email,
                        `
Greetings from Fanexus!<br>

Congratulations, your account has been approved for our beta! Please follow the link below to proceed to the website:<br>

<a href ="https://${process.env.SITE_URL}/?key=${createdSignup.key}">https://${process.env.SITE_URL}/?key=${createdSignup.key}</a><br>

This activation link is single-use and only meant for you. Don't share it with others!<br>

If you run into any bugs, you can report them on our Discord beta server or over <a href ="https://beta.fanexus.net/community/Fanexus-Feedback">[here]</a>.<br>

To get you started, we recommend you to read the <a href="https://beta.fanexus.net/community/Fanexus-Staff/post/366">welcome post</a> and the <a href="https://beta.fanexus.net/community/Fanexus-Staff/post/1168">curating your space guide</a>.<br>

Welcome to Fanexus, we hope you have an amazing time!<br>
                            `,
                        `Welcome to Fanexus`,
                        "noreply@fanexus.net"
                    ).then(() => {
                        return createdSignup;
                    });
                });
            }
        })
        .then(newKey => res.send(newKey))
        .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e));
});

signupKeyRouter.get("/", auth, (req: AuthRequest, res) => {
    if (!req.user.moderator) {
        return res.status(StatusCodes.FORBIDDEN).send("User must be moderator");
    }

    return SignupKey.findAll()
        .then(results => res.send(results))
        .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e));
});
