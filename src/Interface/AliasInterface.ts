import { Image } from "../Entity/Image";
import { ImageInterface } from "./ImageInterface";

interface AliasInterface {
    id?: number;
    name?: string;
    imageURL?: string;
    avatar?: Image | ImageInterface;
    showMinors?: boolean;
}
export { AliasInterface };
