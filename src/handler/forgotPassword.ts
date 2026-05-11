import {
    CognitoIdentityProviderClient,
    ForgotPasswordCommand
} from "@aws-sdk/client-cognito-identity-provider";

import { AppConfig } from "../utils/appConfig";
import { log } from "../utils/logger"

const cognitoClient = new CognitoIdentityProviderClient({
    region: AppConfig.AWS_REGION
})

export const forgotPassword = async (event:any) => {
    try{
        log.info("forgot password api is triggered")
        const body = JSON.parse(event.body)
        const { username } = body;
        
        if(!username){
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "username is required"
                })
            }
        }
        //calling the forgot password api 
        const command = new ForgotPasswordCommand({
            ClientId: AppConfig.COGNITO_CLIENT_ID,
            Username: username
        })

        const response = await cognitoClient.send(command)
        log.info("response from forgot password api" + JSON.stringify(response))

        return {
            statusCode: 200,
            body: JSON.stringify({
                message:"OTP is sent via cognito"
            })
        }

    }catch(err){
        log.info("error in forgot password api"+JSON.stringify(err))
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "error in forgot password api:" + JSON.stringify(err)
            })
        }
    }
}