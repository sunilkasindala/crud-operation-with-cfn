import { CognitoIdentityProviderClient, RespondToAuthChallengeCommand } from "@aws-sdk/client-cognito-identity-provider";
import { AppConfig } from "../utils/appConfig"
import { log } from "../utils/logger"
import AWSXRay from "aws-xray-sdk-core"
import { call } from "../utils/dynamodbLib";

const cognitoClient = AWSXRay.captureAWSv3Client(
    new CognitoIdentityProviderClient({
        region: AppConfig.AWS_REGION
    })
)

export const resendOtp = async (event: any) => {
    try {
        log.info("resend otp api is triggered")

        const body = JSON.parse(event.body);
        const { username, session } = body;

        if (!username || !session) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "username and session are required"
                })
            }
        }
        //fetch the user details from db using email to get the userId (cognito sub)
        const userData = await call("query", {
            TableName: AppConfig.USER_TABLE,
            IndexName: "email-index",
            KeyConditionExpression: "#email = :email",
            ExpressionAttributeNames: { "#email": "email" },
            ExpressionAttributeValues: { ":email": username }
        });

        const userId = userData.Items[0].cognitoSub;
        log.info("User ID for resend OTP: " + userId)

        const otpData = await call("get", {
            TableName: AppConfig.OTP_TABLE,
            Key: {
                userId
            }
        })

        const now = Date.now(); // current timestamp in milliseconds

        const lastResendTime = otpData.Item.lastResendTime || 0; // default to 0 if not set
        const resendCount = otpData.Item.resendCount || 0; // default to 0 if not set

        //cooldown check 
        if (now - lastResendTime < 30000) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Please wait before requesting a new OTP. You can request a new OTP after 30 seconds."
                })
            }
        }
        //max 3 resends attempts allowed
        if (resendCount > 3) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Maximum resend attempts reached for the user. Please try again later."
                })
            }
        }
        //update the db     
        await call("update", {
            TableName: AppConfig.OTP_TABLE,
            Key: { userId },
            UpdateExpression:
                "SET lastResendTime = :now, resendCount = resendCount + :inc",
            ExpressionAttributeValues: {
                ":now": now,
                ":inc": 1
            }
        });

        const command = new RespondToAuthChallengeCommand({
            ClientId: AppConfig.COGNITO_CLIENT_ID,
            ChallengeName: "CUSTOM_CHALLENGE",
            Session: session,

            ChallengeResponses: {
                USERNAME: username,
                ANSWER: "resend" // dummy answer to trigger resend of OTP
            },
            ClientMetadata: {
                resend: "true"
            }
        })
        const response = await cognitoClient.send(command)

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "OTP resent successfully",
                session: response.Session
            })
        }
    } catch(err){
        log.info("error in resending otp"+JSON.stringify(err))
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Internal server error"
            })
        }
    }
}
