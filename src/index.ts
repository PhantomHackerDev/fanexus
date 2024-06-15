import dotenv from "dotenv";
dotenv.config();

import "module-alias/register";
import "./EntityAssociations";
import "@services/ServerService";

process.on("unhandledRejection", (reason: any, promise) => {
    console.warn(
        "Unhandled promise rejection:",
        promise,
        "reason:",
        reason.stack || reason
    );
});

// Make all type errors produce a nonempty response.
declare global {
    interface TypeError {
        toJSON: () => { message: string; name: string; stack: string };
    }
}
TypeError.prototype.toJSON = function () {
    return {
        message: this.message,
        name: this.name,
        stack: this.stack
    };
};
