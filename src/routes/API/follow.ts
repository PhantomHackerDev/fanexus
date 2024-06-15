import express from "express";
import { auth, AuthRequest } from "../../Authorization/auth";
import { Follow } from "../../Entity/Follow";
import { FollowController } from "../../Controller/FollowController";
import { Response } from "express";
import { database as sequelize } from "../../services/databaseService.js";
import { StatusCodes } from "http-status-codes";

const followRouter = express.Router();

followRouter.put("/:entity/:id/", auth, (req: AuthRequest, res: Response) =>
    sequelize.transaction(transaction =>
        FollowController.create(
            req.params.entity,
            req.params.id,
            "follow",
            req.currentAlias,
            transaction
        )
            .then(([follow]) => res.send(follow))
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e))
    )
);

followRouter.delete(
    "/:entity/:id/",
    auth,
    async (req: AuthRequest, res: Response) =>
        FollowController.destroy(
            req.params.entity,
            req.params.id,
            "follow",
            req.currentAlias
        )
            .then(() => res.send("Unfollowed"))
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e))
);

const blockRouter = express.Router();

blockRouter.put("/:entity/:id/", auth, (req: AuthRequest, res: Response) =>
    sequelize.transaction(transaction =>
        FollowController.create(
            req.params.entity,
            req.params.id,
            "block",
            req.currentAlias,
            transaction
        )
            .then(([follow]: [Follow, boolean]) => res.send(follow))
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e))
    )
);

blockRouter.delete(
    "/:entity/:id/",
    auth,
    async (req: AuthRequest, res: Response) =>
        FollowController.destroy(
            req.params.entity,
            req.params.id,
            "block",
            req.currentAlias
        )
            .then(() => res.send("Unblocked"))
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e))
);

export { followRouter };
export { blockRouter };
