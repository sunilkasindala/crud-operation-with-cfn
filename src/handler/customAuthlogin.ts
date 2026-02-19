import {
    AuthFlowType,
    CognitoIdentityProviderClient,
    InitiateAuthCommand
} from "@aws-sdk/client-cognito-identity-provider";

import { log } from "../utils/logger"

import { AppConfig } from "../utils/appConfig"

const cognitoClient = new CognitoIdentityProviderClient({
    region: AppConfig.AWS_REGION
})

export const authLogin = async (event: any) => {
    try {
        log.info("custom auth login is triggered")

        const body = event.body ? JSON.parse(event.body) : {};

        const username = body.username
        log.info('data from the body')
        if (!username) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "username is required field"
                })
            }
        }
        const params = {
            AuthFlow: "CUSTOM_AUTH" as AuthFlowType,
            ClientId: AppConfig.COGNITO_CLIENT_ID,
            AuthParameters: {
                USERNAME: username
                
            }
        }

        const command = new InitiateAuthCommand(params)
        const response = await cognitoClient.send(command)
        log.info('response from the cognito')
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "OTP sent",
                session: response.Session,
                challengeName: response.ChallengeName
            })
        };
        log.info('custom_auth login api is successful')

    } catch (err) {
        log.error('login failed' + JSON.stringify(err))
        return {
            statusCode: 401,
            body: JSON.stringify({
                message: "invalid username"
            })
        }
    }

}