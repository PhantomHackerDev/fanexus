interface TagInterface {
    name: string;
    synonyms: string[];
    parentTags: string[];
    childTags: string[];
    description: string;
    style: string;
    graphId?: number;
    isLocked?: boolean;
}
export { TagInterface };
