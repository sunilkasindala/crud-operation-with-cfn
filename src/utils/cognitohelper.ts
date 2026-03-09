import "../utils/tracing"
import {
    CognitoIdentityProviderClient,
    AdminUpdateUserAttributesCommand
} from "@aws-sdk/client-cognito-identity-provider";

import { AppConfig } from "../utils/appConfig";
import { log } from "../utils/logger"
import AWSXRay from "aws-xray-sdk-core"

const cognitoClient = AWSXRay.captureAWSv3Client(
    new CognitoIdentityProviderClient({
    region: AppConfig.AWS_REGION
})
)
export const updateMfastatus = async (username: string, status: boolean) => {
    try {
        log.info('check the device for mfa')
        const params: any = {
            UserPoolId: AppConfig.USER_POOL_ID,
            Username: username,
            UserAttributes: [
                {
                    Name: "custom:mfaEnabled",
                    Value: status ? "true" : "false"
                }
            ]
        }
        const command = new AdminUpdateUserAttributesCommand(params)
        const response = await cognitoClient.send(command)
        log.info('response from cognito'+JSON.stringify(response))


    } catch (err) {
        log.error('error while checking the mfa' + JSON.stringify(err))
    }
}