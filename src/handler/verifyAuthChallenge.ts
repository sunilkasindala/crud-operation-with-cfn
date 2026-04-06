import "../utils/tracing"
import { log } from "../utils/logger"
import { AppConfig } from "../utils/appConfig";
import { call } from "../utils/dynamodbLib";

export const verifyAuth = async (event: any) => {
    try {
        log.info('verify auth is triggered')

        const isResend = event.request.clientMetadata?.resend === "true";
        log.info("verify auth is triggered, isResend: " + isResend)

        if(isResend){
            log.info("Resend flow - skipping OTP verification to issue a new OTP");
            event.response.answerCorrect = false;
            return event;
        }
        const userId = event.request.userAttributes.sub;
        log.info("User ID from request: " + userId)

        const userOtp = event.request.challengeAnswer;
        
        //fetch the data from the otp table 
        const record = await call("get",{
            TableName: AppConfig.OTP_TABLE,
            Key: {
                userId
            }
        })

        if(!record.Item){
            log.info("No record found for user: " + userId)
            event.response.answerCorrect = false;// no record found, treat as incorrect answer
            return event;
        }
        // const storedOtp = record.Item.otp;
        // log.info("Stored OTP from DB: " + storedOtp)

        const challengeOtp = event.request.privateChallengeParameters.answer;

        if (userOtp === challengeOtp) {
            event.response.answerCorrect = true;
        } else {
            event.response.answerCorrect = false;
        }
        return event;
    } catch (err) {
        log.info('error while verifying the otp' + JSON.stringify(err))
    }
}
