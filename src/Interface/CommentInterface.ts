import { User } from "../Entity/User";

export interface CommentInterface {
    content?: string;
    alias?: number;
    blogPost?: string | number;
    parentComment?: number;
    user: User;
}
