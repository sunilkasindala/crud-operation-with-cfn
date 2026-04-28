import "../utils/tracing"
import { log } from "../utils/logger"
import { AppConfig } from "../utils/appConfig"
import AWSXRay from "aws-xray-sdk-core"
import {
  CognitoIdentityProviderClient,
  RespondToAuthChallengeCommand
} from "@aws-sdk/client-cognito-identity-provider";

const cognitoClient = AWSXRay.captureAWSv3Client(
    new CognitoIdentityProviderClient({
        region: AppConfig.AWS_REGION
    })
)

export const selectMfa = async (event:any) => {
    try {
        log.info("user has to select the mfa type")
        const body = JSON.parse(event.body)
        const {username , session , mfaType , isChangingMfa } = body

        if(!username || !session || !mfaType || !isChangingMfa === undefined){
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message:"username, session, mfaType and isChangingMfa are required"
                })
            }
        }

        const command = new RespondToAuthChallengeCommand({
            ClientId: AppConfig.COGNITO_CLIENT_ID,
            ChallengeName: "CUSTOM_CHALLENGE",
            Session: session,
            ChallengeResponses:{
                USERNAME: username,
                ANSWER: mfaType
            },
            ClientMetadata:{
                mfaType: mfaType,
                mfaReselect: isChangingMfa ? "true" : "false"
            }
        })

        const response = await cognitoClient.send(command)
        log.info("response from the mfa method"+JSON.stringify(response))

        return {
            statusCode: 200,
            body: JSON.stringify({
                message : "MFA is selected successfully",
                session: response.Session
            })
        }

    }catch(err){
        log.info("error in selecting mfa type"+JSON.stringify(err))
    }
}
