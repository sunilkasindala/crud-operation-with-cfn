import "../utils/tracing"
import { log } from "../utils/logger"
import { AppConfig } from "../utils/appConfig";
import { call } from "../utils/dynamodbLib";

export const verifyAuth = async (event: any) => {
    try {
        log.info("VerifyAuth trigger invoked" + JSON.stringify(event))

        const metadata = event.request.challengeMetadata
        const selected = event.request.challengeAnswer;// this is the mfa type selected by the user 

        const isMfaReselect = (selected === "EMAIL" || selected === "SMS") 
        //step1 --> validate mfa selection
        if(metadata === "SELECT_MFA" || isMfaReselect){
            // if the user is selecting the mfa type for the first time or reselecting, we consider it as correct answer to trigger the resend flow in the next step
            if(selected === "EMAIL" || selected === "SMS"){
                event.response.answerCorrect = true;
            }else{
                event.response.answerCorrect = false; 
            }
            return event;
        }

        //step2 --> resend 
        const isResendOtp = event.request.clientMetadata?.resend === "true";
        log.info(`isResendOtp: ${isResendOtp}`)

        if(isResendOtp){
            log.info("Resend requested. Skipping OTP verification and triggering new OTP");
            event.response.answerCorrect = false;
            return event;
        }
        const userId = event.request.userAttributes.sub;
        log.info(`Processing OTP verification for userId: ${userId}`)

        const userOtp = event.request.challengeAnswer;
        
        //fetch the data from the otp table 
        const record = await call("get",{
            TableName: AppConfig.OTP_TABLE,
            Key: {
                userId
            }
        })

        if(!record.Item){
            log.info(`No OTP record found for userId: ${userId}`)
            event.response.answerCorrect = false;// no record found, treat as incorrect answer
            return event;
        }
        // const storedOtp = record.Item.otp;
        // log.info("Stored OTP from DB: " + storedOtp)

        const challengeOtp = event.request.privateChallengeParameters.answer;

        if (userOtp === challengeOtp) {
            log.info("OTP verified successfully");
            event.response.answerCorrect = true;
        } else {
            log.info("Invalid OTP entered");
            event.response.answerCorrect = false;
        }
        return event;
    } catch (err) {
    log.error("Error while verifying OTP:" + JSON.stringify(err));
    throw err;
}
}
