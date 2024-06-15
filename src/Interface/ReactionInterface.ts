import { Reaction } from "../Entity/Reaction";

export interface ReactionInterface {
    type: keyof typeof Reaction.REACTION_TYPE;
    alias: number;
    blogPost?: number | string;
    comment?: number | string;
}
