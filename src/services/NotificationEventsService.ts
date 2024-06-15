import { app } from "@services/ServerService";
import { Notification } from "@entities/Notification";

app.on("accept-member", ({ community, aliasId, sourceAliasId }: any) => {
    Notification.create({
        sourceAliasId,
        targetAliasId: aliasId,
        type: "accept-member",
        targetCommunityId: community.id
    });
});
