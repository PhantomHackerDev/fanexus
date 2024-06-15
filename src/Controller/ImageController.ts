import { ImageInterface } from "../Interface/ImageInterface";
import { Image } from "../Entity/Image";
import { MediaserverService } from "../services/MediaserverService";
import { Transaction } from "sequelize";

class ImageController {
    public createImage(
        imageParams: ImageInterface,
        context = "",
        transaction: Transaction
    ) {
        const image = Image.build({
            name: imageParams.name,
            src: imageParams.src,
            alt: imageParams.alt,
            identifier: imageParams.identifier,
            context
        });

        const promises: Promise<any>[] = [];
        console.log(image.identifier);
        if (!image.identifier) {
            // assume image not uploaded directly but created from link -> create imbo link

            promises.push(
                MediaserverService.uploadImageFromLink(image.src).then(
                    (imageIdentifier: any) => {
                        image.identifier = imageIdentifier;
                        const imboSrc = MediaserverService.getImage(
                            imageIdentifier
                        );
                        image.src = imboSrc.baseUrl;
                    }
                )
            );
        }
        return Promise.all(promises).then(() => {
            return image.save({ transaction });
        });
    }

    public createDefaultImage(context = "", transaction: Transaction) {
        const image = Image.build({
            name: "defaultName",
            src:
                "http://media.fanexus.net/users/root/images/c658eb93-dd50-4033-b47e-c29ce9f8b737",
            alt: "default image",
            identifier: "c658eb93-dd50-4033-b47e-c29ce9f8b737",
            context
        });
        return image.save({ transaction });
    }
}

const controller = new ImageController();
export { controller as ImageController };
