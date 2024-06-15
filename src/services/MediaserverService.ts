import crypto from "crypto";
import http from "http";

// @ts-ignore
import Imbo = require("imboclient");

class MediaserverService {
    private imboUserId = "root";
    private privateKey = "6jxz31DT87G9EfxNe2wBNIzRDiiT-aXH0i4jt4_reiU";
    private publicKey = "root";
    private image = "testimage";
    private client = new Imbo.Client({
        hosts: "https://media.fanexus.net",
        user: "root",
        publicKey: "root",
        privateKey: "6jxz31DT87G9EfxNe2wBNIzRDiiT-aXH0i4jt4_reiU"
    });

    private query: string[] = [];

    public uploadImageFromTmpFile(path: string) {
        const imagePromise = new Promise((resolve, reject) => {
            this.client.addImage(path, (err: any, imageIdentifier: any) => {
                if (err) {
                    return reject(err);
                    // return console.error('An error occured: ' + err);
                }
                return resolve(imageIdentifier);
                // console.log('Image added! Image identifier: ' + imageIdentifier);
                // console.log('Size of image: ' + body.width + 'x' + body.height);
            });
        });

        return imagePromise;
    }

    public uploadImageFromLink(url: string) {
        const imagePromise = new Promise((resolve, reject) => {
            this.client.addImageFromUrl(
                url,
                (err: any, imageIdentifier: any) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(imageIdentifier);
                }
            );
        });

        return imagePromise;
    }

    public getImageWithAccessToken(image: string) {
        let imageURI = image;
        let hasURIparams = false;
        if (this.imboUserId !== this.publicKey) {
            const queryKey = "publicKey=" + this.publicKey;
            this.query.push(queryKey);
            imageURI = image + "?" + this.query.join("&");
            hasURIparams = true;
        }
        const token = crypto
            .createHmac("sha256", this.privateKey)
            .update(imageURI)
            .digest("hex");

        imageURI = hasURIparams
            ? imageURI + "&accessToken=" + token
            : imageURI + "?accessToken=" + token;
        return imageURI;
    }

    public getImage(identifier: string) {
        const imageUrl = this.client.getImageUrl(identifier);
        return {
            baseUrl: imageUrl.baseUrl,
            accessUrl: imageUrl.toString(),
            imageIdentifier: imageUrl.imageIdentifier
        };
    }

    public getThumbnailWithAccessToken(identifier: string) {
        const imageUrl = this.client.getImageUrl(identifier).thumbnail();
        return String(imageUrl);
        // return this.getImageWithAccessToken(imageUrl.baseUrl);
    }

    public generate_HMAC() {
        // for demo only, not used
        if (this.imboUserId !== this.publicKey) {
            this.query.push("publicKey=" + this.publicKey);
        }

        const getImageURI =
            "link/users/" +
            this.imboUserId +
            "/images/" +
            this.image +
            "?" +
            this.query.join("&");

        const token = crypto
            .createHmac("sha256", this.privateKey)
            .update(getImageURI)
            .digest("hex");

        return token;
    }

    public generate_write_HMAC() {
        // For demo only, not used
        const method = "POST";
        const date = new Date();
        const timestamp = date.toJSON();
        const postImageURI =
            "https://media.fanexus.net/" +
            this.imboUserId +
            "/images/" +
            this.image;
        const postImagePath =
            "/users/" + this.imboUserId + "/images/" + this.image;
        const data = [method, postImageURI, this.publicKey, timestamp].join(
            "|"
        );

        const signature = crypto
            .createHmac("sha256", this.privateKey)
            .update(data)
            .digest("hex");

        const options = {
            hostname: "media.fanexus.net",
            port: 80,
            path: postImagePath,
            method: "POST",
            headers: {
                "X-Imbo-PublicKey": this.publicKey,
                "X-Imbo-Authenticate-Signature": signature,
                "X-Imbo-Authenticate-Timestamp": timestamp,
                "Content-Type": "application/json",
                "Content-Length": data.length
            }
        };

        const req = http.request(options, res => {
            console.log(res);

            res.on("data", d => {
                process.stdout.write(d);
            });
        });

        req.on("error", error => {
            console.error("error");
            console.error(error);
        });

        req.on("response", response => {
            console.error("res");
            console.error(response);
        });

        req.write(data);
        req.end();

        return signature;
    }
}

const service = new MediaserverService();
export { service as MediaserverService };
