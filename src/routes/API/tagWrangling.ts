import express from "express";
import {
    auth,
    isSuperTagWrangler,
    AuthRequest
} from "../../Authorization/auth";
import { database as sequelize } from "../../services/databaseService.js";
import { Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ModerationAction } from "../../Entity/ModerationAction";

const tagWranglingRouter = express.Router();

tagWranglingRouter.post(
    "/",
    [auth, isSuperTagWrangler],
    (req: AuthRequest, res: Response) => {
        let receivingTagId = req.body.receivingTagId;
        let donorTagId = req.body.donorTagId;
        return sequelize
            .transaction(transaction => {
                return Promise.all([
                    sequelize.query(
                        `UPDATE "BlogPost_Tag" SET "TagId" = ${Number(
                            receivingTagId
                        )} WHERE "BlogPost_Tag"."TagId" = ${Number(
                            donorTagId
                        )};`,
                        { transaction }
                    ),
                    sequelize.query(
                        `UPDATE "Blog_Tag" SET "TagId" = ${Number(
                            receivingTagId
                        )} WHERE "Blog_Tag"."TagId" = ${Number(donorTagId)};`,
                        { transaction }
                    ),
                    sequelize.query(
                        `UPDATE "Community_Tag" SET "TagId" = ${Number(
                            receivingTagId
                        )} WHERE "Community_Tag"."TagId" = ${Number(
                            donorTagId
                        )};`,
                        { transaction }
                    ),
                    ModerationAction.create({
                        AliasId: req.currentAlias,
                        reason: "Reassigning tags",
                        details: {
                            receivingTagId: Number(receivingTagId),
                            donorTagId: Number(donorTagId)
                        },
                        transaction
                    })
                ]).then(() => {
                    return res.send("success");
                });
            })
            .catch(e =>
                res
                    .status(e.status || StatusCodes.BAD_REQUEST)
                    .send(e.message || e)
            );
    }
);

export { tagWranglingRouter };
