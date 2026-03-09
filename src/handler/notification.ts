import "../utils/tracing"
import { SQSHandler } from "aws-lambda";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { log } from "../utils/logger";

const EMAIL_SOURCE = "sunil.kasindala@hyniva.com";
const ses = new SESClient({ region: process.env.AWS_REGION });

export const handler: SQSHandler = async (event) => {
    for (const record of event.Records) {
        try {
            const message = JSON.parse(record.body);
            const toEmail = message.email

            switch (message.type) {
                case "USER_CREATED": {
                    log.info({ email: message.email }, "Sending USER_CREATED email");
                    const subject = "Account Created!"
                    const body = `Hi ${message.name}, your account has been created.`

                    const response = await SendSES(toEmail, subject, body)

                    log.info(
                        { messageId: response.MessageId },
                        "SES accepted USER_CREATED email"
                    );
                    break;
                }

                case "USER_UPDATED": {
                    log.info({ email: message.email }, "Sending USER_UPDATED email");

                    const subject = "User Updated Successfully"
                    const body = `Hello ${message.name}, your details have been updated successfully.`

                    const response = await SendSES(toEmail, subject, body)

                    log.info(
                        { messageId: response.MessageId },
                        "SES accepted USER_UPDATED email"
                    );
                    break;
                }
                case "DOCUMENT_REMINDER":{
                    log.info({email:message.email}, "sending documentSubmitted email")

                    const subject = "Users with document submitted"
                    const body = `hello ${message.name},you have not submitted your documents yet. Please submit them as soon as possible`

                    const response = await SendSES(toEmail, subject, body)

                    log.info(
                        {messageId: response.MessageId},
                        "SES accepted document_Submitted email"
                    );
                    break;
                }

                default:
                    log.warn(
                        { type: message.type },
                        "Unknown message type received from SQS"
                    );
            }
        } catch (err) {
            log.error({ err }, "Failed to process SQS message");
            throw err;
        }
    }
};

const SendSES = async (toEmail: string, subject: string, body: string) => {
    return await ses.send(
        new SendEmailCommand({
            Source: EMAIL_SOURCE,
            Destination: {
                ToAddresses: [toEmail],
            },
            Message: {
                Subject: { Data: subject },
                Body: {
                    Text: {
                        Data: body,
                    },
                },
            },
        })
    );
}