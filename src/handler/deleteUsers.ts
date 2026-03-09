import "../utils/tracing"
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"

import { call } from "../utils/dynamodbLib"

import { log, getSegment } from "../utils/logger"
import { AppConfig } from "../utils/appConfig";


export const deleteuser = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const segment = getSegment();
    const subsegment = segment?.addNewSubsegment(`query SES template`);
    try {
        log.info('DeleteUser request received');

        const userId = event.queryStringParameters?.userId
        log.info("UserId extracted from query parameters")

        if (!userId) {
            log.warn('DeleteUser request failed - missing userId');
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Missing userId" })
            }
        }

        const params = {
            TableName: AppConfig.USER_TABLE,
            Key: {
                userId
            },
            ReturnValues: "ALL_OLD"
        }

        const response = await call('delete', params)

        log.info("User deleted successfully from DynamoDB")
        subsegment?.close()
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "user is deleted successfully" })
        }
    } catch (err) {
        log.error("Failed to delete user" + JSON.stringify(err))
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "internal server error" })
        }
    }
}