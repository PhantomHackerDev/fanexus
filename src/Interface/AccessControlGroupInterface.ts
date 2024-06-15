import { AccessControlGroup } from "../Entity/AccessControlGroup";
import { Alias } from "../Entity/Alias";

interface AccessControlGroupInterface {
    accessControlSetting: keyof typeof AccessControlGroup["ACCESS_CONTROL_SETTINGS"];
    belongsToAlias?: number | Alias;
    isDefault: boolean;
    name: string;
}

export interface EditAccessControlGroupInterface
    extends AccessControlGroupInterface {
    aliases?: (Alias | number[])[];
}

export interface CreateAccessControlGroupInterface
    extends AccessControlGroupInterface {
    aliases?: (Alias | number)[];
}
export { AccessControlGroupInterface };
