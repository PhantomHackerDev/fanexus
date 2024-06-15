import { Image } from "../Entity/Image";
import { ImageInterface } from "./ImageInterface";
import { AccessControlGroupInterface } from "./AccessControlGroupInterface";
import { TagDisplayInterface } from "./TagDisplayInterface";

export interface BlogInterface {
    name?: string;
    link?: string;
    links?: string[];
    description?: string;
    avatar?: Image | ImageInterface;
    coverImage?: Image | ImageInterface;
    alias: number;
    tags?: number[];
    tagNames?: string[];
    showMinors?: boolean;
    hideFromSearchResults?: boolean;
}

export interface UpdateBlogInterface extends BlogInterface {
    contentAccessControl: AccessControlGroupInterface;
    commentsAccessControl: AccessControlGroupInterface;
    reactionsAccessControl: AccessControlGroupInterface;
    followsAccessControl: AccessControlGroupInterface;
    blogId: string;
    tagDisplays?: TagDisplayInterface[];
}
