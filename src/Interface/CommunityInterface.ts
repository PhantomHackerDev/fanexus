import { Image } from "../Entity/Image";
import { Alias } from "../Entity/Alias";
import { ImageInterface } from "./ImageInterface";
import { AccessControlGroupInterface } from "./AccessControlGroupInterface";
import { Tag } from "../Entity/Tag";
import { TagDisplayInterface } from "./TagDisplayInterface";

interface CommunityInterface {
    name?: string;
    link?: string;
    links?: string[];
    rules?: CommunityInterface[];
    description?: string;
    avatar?: Image | ImageInterface;
    coverImage?: Image | ImageInterface;
    members?: Alias[] | number[];
    moderators?: Alias[] | number[];
    tags?: Tag[] | number[];
    tagNames?: string[];
    contentAccessControl?: AccessControlGroupInterface;
    commentsAccessControl?: AccessControlGroupInterface;
    reactionsAccessControl?: AccessControlGroupInterface;
    followsAccessControl?: AccessControlGroupInterface;
    membersAccessControl?: AccessControlGroupInterface;
    postingAccessControl?: AccessControlGroupInterface;
    alias?: Alias | number;
    showMinors?: boolean;
    hideFromSearchResults?: boolean;
    requireApproval?: boolean;
    tagDisplays?: TagDisplayInterface[];
}
export { CommunityInterface };
