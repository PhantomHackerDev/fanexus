import express from "express";
import { auth, AuthRequest } from "../../Authorization/auth";
import { Response } from "express";
import { StatusCodes } from "http-status-codes";
import { EmailController } from "@controllers/EmailController";
import { Alias } from "@entities/Alias";

const userReportRouter = express.Router();

userReportRouter.post("/", [auth], (req: AuthRequest, res: Response) => {
    return Alias.findByPk(req.currentAlias)
        .then((currentAlias: Alias) => {
            return EmailController.sendEmail(
                // @ts-ignore
                process.env.REPORT_EMAIL_DESTINATION,
                req.body.content,
                "User report: " +
                    currentAlias.name +
                    " - " +
                    req.body.violationCategory
            ).then(() => {
                return res.send("Report sent successfully");
            });
        })
        .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e));
});

export { userReportRouter };
