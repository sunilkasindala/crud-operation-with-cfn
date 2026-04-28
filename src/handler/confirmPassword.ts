import {
    CognitoIdentityProviderClient,
    ConfirmForgotPasswordCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { AppConfig } from "../utils/appConfig";
import { log } from "../utils/logger"

const cognitoClient = new CognitoIdentityProviderClient({
    region: AppConfig.AWS_REGION
})

export const confirmPassword = async (event: any) => {
    try {
        log.info("confirm password api is triggered")
        const body = JSON.parse(event.body)
        const { username, otp, newPassword } = body;

        if (!username || !otp || !newPassword) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "username , otp and newpassword are required"
                })
            }
        }
        // confirm forgot password api call
        const command = new ConfirmForgotPasswordCommand({
            ClientId: AppConfig.COGNITO_CLIENT_ID,
            Username: username,
            ConfirmationCode: otp,
            Password: newPassword
        })
        // call the cognito api 
        const response = await cognitoClient.send(command)
        log.info("response from confirm password api" + JSON.stringify(response))

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "password is reset successfully"
            })
        }

    } catch (err) {
        log.info("error in confirm password api" + JSON.stringify(err))
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "error in confirm password api: " + JSON.stringify(err)
            })
        }
    }
}