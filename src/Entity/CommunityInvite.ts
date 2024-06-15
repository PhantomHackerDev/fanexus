import { Model } from "sequelize-typescript";
import { database as sequelize } from "../services/databaseService.js";
import { Community } from "./Community";
import { AccessControlGroup } from "./AccessControlGroup";
import { Transaction } from "sequelize";

class CommunityInvite extends Model {
    public id: number;

    public CommunityId: number;
    public inviterId: number;
    public invitedId: number;

    public accept(transaction: Transaction): Promise<string> {
        return Community.findByPk(this.CommunityId, {
            include: [
                {
                    model: AccessControlGroup,
                    as: "membersAccessControl"
                }
            ],
            transaction
        })
            .then(
                (community: Community): Promise<any> => {
                    if (!community) {
                        return Promise.reject("Invalid community ID.");
                    }
                    return community.createMembershipRequest(
                        this.invitedId,
                        transaction
                    );
                }
            )
            .then(response => {
                return this.destroy({ transaction }).then(() => {
                    return response;
                });
            });
    }
}

CommunityInvite.init(
    {},
    {
        sequelize,
        modelName: "CommunityInvite"
    }
);

export { CommunityInvite };
