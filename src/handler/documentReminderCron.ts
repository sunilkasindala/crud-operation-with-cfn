import "../utils/tracing"
import { log } from "../utils/logger";
import { AppConfig } from "../utils/appConfig";
import { call } from "../utils/dynamodbLib"
import { SendMessageCommand, SQS } from "@aws-sdk/client-sqs";

const sqs = new SQS({});

export const documentReminder = async () => {
    try {
        log.info("Document reminder cron started");

        const result = await getUsersWithPendingDocuments();
        const users = result.Items || [];

        log.info(`total users found ${users.length}`)

        await Promise.all(users.map((user:any)=>triggerForEmail(user)));

    } catch (error) {
        log.error("Error in document reminder cron" + JSON.stringify(error));
    }
}

const getUsersWithPendingDocuments = async () =>{
    const params = {
        TableName: AppConfig.USER_TABLE,
        IndexName: "documentSubmitted-userId-index",
        KeyConditionExpression: "#doc = :val",
        ExpressionAttributeNames: {
            "#doc": "documentSubmitted",
        },
        ExpressionAttributeValues: {
            ":val": "false",
        },
    }
    return await call("query",params)
}

const triggerForEmail = async (user: any) => { 
    const message = {
        type: "DOCUMENT_REMINDER",
        email: user.email,
        name: user.name
    };
    try {
        await sqs.send(
            new SendMessageCommand({
                QueueUrl: process.env.NOTIFICATION_QUEUE_URL,
                MessageBody: JSON.stringify(message)
            })
        );
        log.info(`Notification message sent to SQS for ${user.email}`);
    } catch (err) {
        log.error("Failed to send SQS message:" + JSON.stringify(err));

    }
};
