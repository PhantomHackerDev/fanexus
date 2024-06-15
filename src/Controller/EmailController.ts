import AWS from "aws-sdk";
class EmailController {
    public sendEmail(
        emailTo: string,
        content: string,
        title: string,
        source?: string
    ) {
        AWS.config.update({
            accessKeyId: process.env.AWSACCESSKEYID,
            secretAccessKey: process.env.AWSSECRETACCESSKEY,
            region: "us-west-2"
        });
        let emailParams = {
            Destination: {
                ToAddresses: [emailTo]
            },
            Message: {
                Body: {
                    Html: {
                        Charset: "UTF-8",
                        Data: content
                    }
                },
                Subject: {
                    Charset: "UTF-8",
                    Data: title
                }
            },
            Source: source ? source : "noreply@fanexus.net"
        };
        const ses = new AWS.SES({ apiVersion: "2010-12-01" });
        return new Promise((resolve, reject) => {
            ses.sendEmail(emailParams, (err: any, data: any) => {
                if (err) {
                    console.log(err, err.stack);
                    return reject(err);
                } else {
                    return resolve(data);
                }
            });
        });
    }
}

const controller = new EmailController();
export { controller as EmailController };
