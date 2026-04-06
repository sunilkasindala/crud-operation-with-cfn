import { AppConfig } from "./appConfig";
import { log } from "./logger"
import { call } from "./dynamodbLib"

export const saveOtpRecord = async (userId: string) => {
    try {
        log.info("Saving OTP record for user")
        const now = Date.now();
        //get the existing record 
        const existing = await call("get", {
            TableName: AppConfig.OTP_TABLE,
            Key: {
                userId: userId
            }
        })
        let resendCount = 0;
        let lastResendTime = now;

        if (existing.Item) {
            resendCount = existing.Item.resendCount || 0; // get the existing resend count
            lastResendTime = existing.Item.lastResendTime || now; // get the existing last resend time
        }
        //save the record into our database with ttl of 1 hour and also store the resend count and last resend time for cooldown management
        await call("put", {
            TableName: AppConfig.OTP_TABLE,
            Item: {
                userId,
                otpCreatedAt: now,
                lastResendTime,
                resendCount,
                ttl: Math.floor(now / 1000) + 3600 // set TTL for 1 hour 
            }
        })

    }catch(err){
        log.error("Error saving OTP record: " + JSON.stringify(err))
        throw err;
    }
}