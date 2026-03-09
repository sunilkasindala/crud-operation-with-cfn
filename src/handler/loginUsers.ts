import "../utils/tracing"
import {
    AuthFlowType,
    CognitoIdentityProviderClient,
    InitiateAuthCommand
} from "@aws-sdk/client-cognito-identity-provider";

import { AppConfig } from "../utils/appConfig";
import { log } from "../utils/logger"
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import jwt from "jsonwebtoken"
import { call } from "../utils/dynamodbLib";
import AWSXRay from "aws-xray-sdk-core"

const cognitoClient = AWSXRay.captureAWSv3Client(
    new CognitoIdentityProviderClient({
    region: AppConfig.AWS_REGION
})
)

export const loginHandler = async (
    event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

    log.info('login handler is called' + JSON.stringify(event))

    try {
        const { username, password } = event.body ? JSON.parse(event.body) : {};
        log.info('username is expected' + JSON.stringify(username))
        log.info('password is expected' + JSON.stringify(password))

        if (!username || !password) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "username and password are required"
                })
            }
        }
        const params = {
            AuthFlow: "USER_PASSWORD_AUTH" as AuthFlowType,
            ClientId: AppConfig.COGNITO_CLIENT_ID,
            AuthParameters: {
                USERNAME: username,
                PASSWORD: password
            }
        }

        const command = new InitiateAuthCommand(params) //verifies the user 
        const response = await cognitoClient.send(command)
        log.info('end' + JSON.stringify(response))

        const authResult = response.AuthenticationResult;
        log.info('auth' + JSON.stringify(authResult))
        
        //extract sub id from  the token 
        log.info('getting id token')
        const idToken:any = authResult?.IdToken;

        const decoded: any = jwt.decode(idToken)
        const cognitoSub = decoded.sub

        //get user by performig db operation 
        const dbResult = await getUserbyCognitoSub(cognitoSub)

        if(!dbResult.Items || dbResult.Items.length === 0){
            return {
                statusCode:404,
                body:JSON.stringify({
                    message:"user not found in the db"
                })
            }
        }
        const user = dbResult.Items[0]
        log.info('user details is retrieved successfully')

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "login succccessful",
                accessToken: authResult?.AccessToken,
                idToken: authResult?.IdToken,
                refreshToken: authResult?.RefreshToken,
                user
            })
        }

    } catch (err: any) {
        log.error('login failed' + JSON.stringify(err))
        return {
            statusCode: 401,
            body: JSON.stringify({
                message: "invalid username and password"
            })
        }
    }
}

const getUserbyCognitoSub = async (sub: string) => {
    const params = {
        TableName: AppConfig.USER_TABLE,
        IndexName: "cognito-index",
        KeyConditionExpression: "#cs = :cs",
        ExpressionAttributeNames: {
            "#cs": "cognitoSub"
        },
        ExpressionAttributeValues: {
            ":cs": sub
        }
    }
    return await call("query",params)
}

