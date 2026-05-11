import {
    SNSClient,
    PublishCommand
} from "@aws-sdk/client-sns";

import { AppConfig } from "../utils/appConfig"
import { log } from "../utils/logger"
import { call } from "../utils/dynamodbLib"

const sns = new SNSClient({ region: AppConfig.AWS_REGION })

export const forgotUsername = async (event: any) => {
    try {
        log.info("forgot username api is triggered")
        const body = JSON.parse(event.body)
        const { mobile_no } = body;

        if (!mobile_no) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "mobile_no is required"
                })
            }
        }

        //query the user table with mobile number to get the username
        const result = await call("query", {
            TableName: AppConfig.USER_TABLE,
            IndexName: "mobile-index",
            KeyConditionExpression: "#mobile = :mobile",
            ExpressionAttributeNames: {
                "#mobile": "mobile_no"
            },
            ExpressionAttributeValues: {
                ":mobile": mobile_no
            }
        })

        //if user is not found return error 
        if (!result.Items || result.Items.length === 0) {
            log.info(`No user found with mobile number: ${mobile_no}`)
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: "No user found with the provided mobile number"
                })
            }
        }

        const user = result.Items[0]
        const email = user.email

        log.info(`User found for mobile number ${mobile_no}. Sending username to email: ${email}`)

        log.info(`Username to be sent via SMS: ${user.email}`)
        //send the username to the user's mobile number using sns
        await sns.send(
            new PublishCommand({
                PhoneNumber: mobile_no,
                Message: `Your username associated with mobile number ${mobile_no} is: ${user.email}`
            })
        )

        log.info("username is successfully sent to the user's mobile via SMS")

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "if the given mobile number is registered then you will shortly recieve your username"
            })
        }

    } catch (err) {
        log.error("error in forgot username api" + JSON.stringify(err))
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Internal server error"
            })
        }
    }
}