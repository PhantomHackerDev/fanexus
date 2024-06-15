import { Blog } from "../Entity/Blog";
import { Community } from "../Entity/Community";
import { AccessControlGroupInterface } from "./AccessControlGroupInterface";
import { TagDisplayInterface } from "./TagDisplayInterface";

interface BlogPostInterface {
    content: string;
    blog?: Blog | number;
    community?: Community | number;
    tags?: number[];
    tagNames?: string[];
    contentAccessControl?: AccessControlGroupInterface;
    reblogOfBlogPost?: number;
    viewingPrivacyGroups?: number[];
    commentingPrivacyGroups?: number[];
    hideFromSearchResults?: boolean;
    tagDisplays?: TagDisplayInterface[];
}

interface CreateBlogPostInterface extends BlogPostInterface {
    alias: number;
    shareTo?: ShareToInterface;
    tagDisplays?: TagDisplayInterface[];
}

interface ShareToInterface {
    blogs: number[];
    communities: number[];
}

export { BlogPostInterface, CreateBlogPostInterface, ShareToInterface };
