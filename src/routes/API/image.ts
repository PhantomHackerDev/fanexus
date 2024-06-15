import express from "express";
import { MediaserverService } from "../../services/MediaserverService";
import { StatusCodes } from "http-status-codes";

const imageRouter = express.Router();

const imageUploadPromise = (image: any) =>
    MediaserverService.uploadImageFromTmpFile(
        image.tempFilePath
    ).then((identifier: string) => MediaserverService.getImage(identifier));

imageRouter.post("/upload", (req: any, res) => {
    // console.log(req.files);
    const image = req.files.image;
    const promise: Promise<any> = Array.isArray(image)
        ? Promise.all(image.map(imageUploadPromise))
        : imageUploadPromise(image);
    return promise
        .then(
            link => res.send(link)
            // console.log(MediaserverService.getImageWithAccessToken(link.baseUrl));
        )
        .catch(err => res.status(StatusCodes.BAD_REQUEST).send(err));
});

export { imageRouter };
