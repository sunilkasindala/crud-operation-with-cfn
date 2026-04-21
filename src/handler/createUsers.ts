import "../utils/tracing"
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { log } from "../utils/logger"
import { AppConfig } from "../utils/appConfig";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns"
import { randomUUID } from "crypto"
import { isValidMobileNumber } from "../utils/validations";
import { isValidEmail } from "../utils/validations";
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand } from "@aws-sdk/client-cognito-identity-provider";
import AWSXRay from "aws-xray-sdk-core"

const cognitoClient = AWSXRay.captureAWSv3Client(
    new CognitoIdentityProviderClient({
    region: AppConfig.AWS_REGION
})
)

import { call } from "../utils/dynamodbLib";

const sqs = new SQSClient({ region: process.env.AWS_REGION });
const QUEUE_URL = process.env.NOTIFICATION_QUEUE_URL;
const sns = new SNSClient({ region: process.env.AWS_REGION });

export const createuser = async (
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {

    log.info("Create user handler called");

    try {
        const body = event.body ? JSON.parse(event.body) : {};

        const { name, email, mobile_no, password } = body;

        if (!name || !email || !mobile_no || !password) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "name, email, mobile_no and password are required"
                })
            };
        }

        if (!isValidEmail(email)) {
            return { statusCode: 400, body: JSON.stringify({ message: "Invalid email" }) };
        }

        if (!isValidMobileNumber(mobile_no)) {
            return { statusCode: 400, body: JSON.stringify({ message: "Invalid mobile number" }) };
        }

        // Check existing user in DB
        const existingUser = await checkExistingUser(body);
        if (existingUser.Items?.length > 0) {
            return { statusCode: 400, body: JSON.stringify({ message: "Email already exists" }) };
        }

        const existingMobile = await checkExistingMobile(body);
        if (existingMobile.Items?.length > 0) {
            return { statusCode: 400, body: JSON.stringify({ message: "Mobile already exists" }) };
        }
        // creating the user in cognito
        const createUserParams: any = {
            UserPoolId: AppConfig.USER_POOL_ID,
            Username: email,
            UserAttributes: [
                { Name: "email", Value: email },
                { Name: "email_verified", Value: "true" },
                { Name: "custom:mfaEnabled", Value: "false" },
                { Name: "phone_number", Value: mobile_no},
                { Name: "phone_number_verified", Value: "true"}
            ],
            MessageAction: "SUPPRESS"
        };

        const command = new AdminCreateUserCommand(createUserParams);
        const response = await cognitoClient.send(command);
        
        //extract sub 
        const cognitoSub = response.User?.Attributes?.find(
            attr => attr.Name === "sub"
        )?.Value;

        if (!cognitoSub) {
            throw new Error("Cognito sub not found");
        }

        log.info("Extracted cognitoSub: " + cognitoSub);

        // set the password for created user
        const setpass: any = {
            UserPoolId: AppConfig.USER_POOL_ID,
            Username: email,
            Password: password,
            Permanent: true
        }
        const cmd = new AdminSetUserPasswordCommand(setpass)
        const res = await cognitoClient.send(cmd)

        const userId = randomUUID();
        const params = {
            TableName: AppConfig.USER_TABLE,
            Item: {
                userId,
                name,
                email,
                mobile_no,
                documentSubmitted: "false",
                cognitoSub
            },
            ConditionExpression: "attribute_not_exists(userId)"
        };

        await call("put", params);

        if (QUEUE_URL) await triggerForEmailSend({ ...body, userId });
        if (mobile_no) await triggerForSmsSend({ ...body });

        return {
            statusCode: 201,
            body: JSON.stringify({
                message: "User created successfully"
            })
        };

    } catch (err) {
        log.error("Error creating user" + JSON.stringify(err));
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal server error" })
        };
    }
};


const checkExistingUser = async (body: any) => {
    //query on database using an idex on email
    const checkEmailparams = {
        TableName: AppConfig.USER_TABLE,
        IndexName: "email-index",
        KeyConditionExpression: "#email = :email",
        ExpressionAttributeNames: {
            "#email": "email"
        },
        ExpressionAttributeValues: {
            ":email": body.email
        }
    }
    //checks for email
    return await call('query', checkEmailparams)
}
const checkExistingMobile = async (body: any) => {
    const checkmobileparams = {
        TableName: AppConfig.USER_TABLE,
        IndexName: "mobile-index",
        KeyConditionExpression: "#mobile_no = :mobile_no",
        ExpressionAttributeNames: {
            "#mobile_no": "mobile_no"
        },
        ExpressionAttributeValues: {
            ":mobile_no": body.mobile_no
        }

    }
    return await call('query', checkmobileparams)
}

const triggerForEmailSend = async (body: any) => {
    const message = {
        type: "USER_CREATED",
        userId: body.userId,
        name: body.name,
        email: body.email,
        mobile_no: body.mobile_no
    };

    try {
        await sqs.send(
            new SendMessageCommand({
                QueueUrl: QUEUE_URL,
                MessageBody: JSON.stringify(message)
            })
        );
        log.info("Notification message sent to SQS");
    } catch (err) {
        log.error("Failed to send SQS message: " + JSON.stringify(err));
    }
}

const triggerForSmsSend = async (body: any) => {
    log.info("sms trigger started")
    const params = {
        Message: `Hello ${body.name}, your account has been created successfully.`,
        PhoneNumber: body.mobile_no
    }
    log.info("SNS Publish params: " + JSON.stringify(params));
    try {
        const response = await sns.send(
            new PublishCommand(params)
        );
        log.info("SNS publish response: " + JSON.stringify(response));
        log.info("sns successfully pushes the message to subscriber")
    } catch (err) {
        log.error("failed to send sns message" + JSON.stringify(err))
    }
}





