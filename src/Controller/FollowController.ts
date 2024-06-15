import { WhereAttributeHash } from "sequelize";
import { Transaction } from "sequelize";

import { Follow } from "@entities/Follow";
import { Notification } from "@entities/Notification";
import { Blog } from "@entities/Blog";
import { AliasController } from "./AliasController";
import { TagController } from "./TagController";
import { NotificationController } from "@controllers/NotificationController";

const isValidType = (
    typeString: string
): typeString is keyof typeof Follow.FOLLOW_TYPES => {
    return typeString in Follow.FOLLOW_TYPES;
};

function getSelfAndChildren(tagId: number) {
    console.log("Getting children for tag " + tagId);
    return Promise.all([TagController.getAllDescendants(tagId)]).then(
        children => {
            return [].concat.apply([tagId], children);
        }
    );
}

class FollowController {
    public create(
        entity: string,
        id: string | number,
        type: string,
        AliasId: number,
        transaction: Transaction
    ): Promise<[Follow, boolean]> {
        if (!isValidType(type)) {
            throw new Error("Invalid follow type");
        }

        const followObject: WhereAttributeHash = { AliasId };
        this.setAssociation(followObject, entity, Number(id));
        followObject.followType = Follow.FOLLOW_TYPES[type];

        return Follow.findOrCreate({ where: followObject, transaction }).then(
            ([follow]) => {
                if (
                    (entity === "blog" || entity === "alias") &&
                    follow.followType === Follow.FOLLOW_TYPES.follow
                ) {
                    return this.createNotification(
                        AliasId,
                        entity,
                        Number(id),
                        transaction
                    ).then(() => [follow]);
                }
                return [follow];
            }
        );
    }

    public destroy(
        entity: string,
        id: string,
        type: string,
        AliasId: number
    ): Promise<any> {
        if (!isValidType(type)) {
            throw new Error("Invalid follow type");
        }

        const destroyCondition: WhereAttributeHash = { AliasId };
        this.setAssociation(destroyCondition, entity, Number(id));
        destroyCondition.followType = Follow.FOLLOW_TYPES[type];

        return Promise.all([
            Follow.destroy({ where: destroyCondition }),
            Notification.destroy({
                where: {
                    type: "follow",
                    sourceAliasId: AliasId,
                    targetAliasId: Number(id)
                }
            })
        ]);
    }

    private setAssociation(
        condition: WhereAttributeHash,
        entity: string,
        id: number
    ): void {
        switch (entity) {
            case "blog":
                condition.followBlogId = id;
                break;
            case "community":
                condition.followCommunityId = id;
                break;
            case "tag":
                condition.followTagId = id;
                break;
            case "alias":
                condition.followAliasId = id;
                break;
        }
    }

    public async getRelevantTagIdsForAlias(
        aliasId: number,
        blocksNSFW = false,
        transaction: Transaction
    ): Promise<any> {
        if (typeof process.env.NSFW_TAG_ID === "undefined") {
            throw new Error("NSFW_TAG_ID must be defined in .env");
        }
        return Promise.all([
            AliasController.findAllWhereFollowesTags(aliasId, transaction)
                .then(followTags =>
                    Promise.all(
                        followTags.map(({ followTagId }) =>
                            getSelfAndChildren(followTagId)
                        )
                    )
                )
                .then(followTagIds => followTagIds.flat()),
            AliasController.findAllWhereBlocksTags(aliasId, transaction)
                .then(blockTags =>
                    Promise.all(
                        blockTags
                            .map(({ followTagId }) => followTagId)
                            .concat(
                                blocksNSFW || aliasId === 0
                                    ? Number(process.env.NSFW_TAG_ID)
                                    : []
                            )
                            .map(blockedTagId =>
                                getSelfAndChildren(blockedTagId)
                            )
                    )
                )
                .then(blockedTagIds => blockedTagIds.flat())
        ]).then(([follows, blocks]) => ({ follows, blocks }));
    }

    public createNotification(
        sourceAlias: number,
        entity: "blog" | "alias",
        id: number,
        transaction: Transaction
    ): Promise<any> {
        const getTargetAliasId: Promise<number> =
            entity === "blog"
                ? Blog.findByPk(id, { transaction }).then(
                      (blog: Blog): number => {
                          return blog.AliasId;
                      }
                  )
                : Promise.resolve(id);
        return NotificationController.create(
            sourceAlias,
            getTargetAliasId,
            "follow",
            undefined,
            undefined,
            transaction
        );
    }
}

const controller = new FollowController();
export { controller as FollowController };
