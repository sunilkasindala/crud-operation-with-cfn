import "../utils/tracing"
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"

import { call } from "../utils/dynamodbLib"

import { log, getSegment } from "../utils/logger"
import { AppConfig } from "../utils/appConfig";


export const getuser = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const segment = getSegment();
    const subsegment = segment?.addNewSubsegment(`query SES template`);
    log.info("EVENT RECEIVED:");
    try {
        log.info('GetUser request received');

        const userId = event.queryStringParameters?.userId

        log.info("UserId extracted from query parameters")

        if (!userId) {
            log.warn('GetUser request failed - missing userId',);
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Missing userId" })
            }
        }
        const params = {
            TableName: AppConfig.USER_TABLE,
            Key: {
                userId
            }
        }

        const result = await call('get', params)

        log.info('User fetched successfully from DynamoDB')
        subsegment?.close()
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "data is retrieved successfully", data: result.Item })

        }

    } catch (err) {
        log.info("Failed to fetch user" + JSON.stringify(err));
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "internal server error", err})
        };
    }

}

export const scanusers = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const segment = getSegment();
    const subsegment = segment?.addNewSubsegment(`query SES template`);
    try {
        log.info('ScanUsers request received');

        const params = {
            TableName: AppConfig.USER_TABLE,
            FilterExpression: "#name = :n AND #email = :e",
            ExpressionAttributeNames: {
                "#name": "name",
                "#email": "email"
            },
            ExpressionAttributeValues: {
                ":n": "sunil",
                ":e": "sunil@gmail.com"
            }
        }
        const result = await call('scan', params)

        if (!result) {
            log.warn('No users found for scan request');
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'there is no data available to fetch' })
            }
        }

        log.info("Scan completed successfully")
        subsegment?.close();
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "got the items from the dynamodb", result })
        }


    } catch (err) {
        log.info("Failed to scan users" + JSON.stringify(err));
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "internal server error" })
        }
    }
}

