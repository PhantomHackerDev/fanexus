import express from "express";
import {
    NotificationController,
    pendingCountRequests
} from "../../Controller/NotificationController";
import { Notification } from "../../Entity/Notification";
import { auth, AuthRequest } from "../../Authorization/auth";
import { Response } from "express";
import { sanitizeContents } from "../../Entity/shared/sanitizeHTML";
import { StatusCodes } from "http-status-codes";

const notificationRouter = express.Router();

const updateIsSeen = (notifications: Notification[]): Promise<Notification[]> =>
    Promise.all(
        notifications.map(notification => notification.update({ isSeen: true }))
    );

const sanitizedNotifications = (notifications: Notification[]): any[] =>
    notifications.map(notification => {
        const notificationData: any = notification.toJSON();
        return Object.assign(
            notificationData,
            ...[
                "targetBlogPost",
                "sourceComment",
                "targetComment",
                "sourceReblog"
            ].map(attribute => {
                const attributeData = notificationData[attribute]?.content;
                return (
                    attributeData && {
                        [attribute]: {
                            ...notificationData[attribute],
                            content: sanitizeContents(attributeData)
                        }
                    }
                );
            })
        );
    });

notificationRouter.get(
    "",
    auth,
    (req: AuthRequest, res: Response): Promise<any> =>
        NotificationController.index(req.currentAlias)
            .then((notifications: Notification[]): Notification[] => {
                res.send(sanitizedNotifications(notifications));
                return notifications;
            })
            .then(updateIsSeen)
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e))
);

notificationRouter.get(
    "/new",
    auth,
    (req: AuthRequest, res: Response): Promise<any> =>
        NotificationController.index(req.currentAlias, true)
            .then((notifications: Notification[]): Notification[] => {
                res.send(sanitizedNotifications(notifications));
                return notifications;
            })
            .then(updateIsSeen)
            .catch(e => res.status(StatusCodes.BAD_REQUEST).send(e))
);

notificationRouter.get(
    "/new/count",
    auth,
    (req: AuthRequest, res: Response): Promise<Response> => {
        return Notification.count({
            where: { targetAliasId: req.currentAlias, isSeen: false }
        })
            .then((count: number) => {
                return res.send({ count });
            })
            .catch(e => {
                return res.status(StatusCodes.BAD_REQUEST).send(e);
            });
    }
);

notificationRouter.get(
    "/new/count/watch",
    auth,
    (req: AuthRequest, res): pendingCountRequests => {
        return NotificationController.watch(req.currentAlias, res);
    }
);

notificationRouter.get(
    "/new/count/unwatch",
    auth,
    (req: AuthRequest, res): Response => {
        const unwatched = NotificationController.unwatch(req.currentAlias);
        return res.send(unwatched);
    }
);

export { notificationRouter };
