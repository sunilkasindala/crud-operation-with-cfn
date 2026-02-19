import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"
import { log } from "../utils/logger"
import { AppConfig } from "../utils/appConfig"

const EMAIL_SOURCE = "sunil.kasindala@hyniva.com";
const ses = new SESClient({ region: process.env.AWS_REGION })

export const createAuth = async (event: any) => {
    try {
        log.info("createauth challenge is triggered")
        //only if challenge is correct then it enters into this logic 
        if (event.request.challengeName === "CUSTOM_CHALLENGE") {

            const otp = Math.floor(100000 + Math.random() * 900000).toString()
            log.info("generated otp" + JSON.stringify(otp))

            //store the otp sescurely 
            event.response.privateChallengeParameters = {
                answer: otp
            }

            const email = event.request.userAttributes.email
            
            await ses.send(
                new SendEmailCommand({
                    Source: EMAIL_SOURCE,
                    Destination: {
                        ToAddresses: [email],
                    },
                    Message: {
                        Subject: { Data: "Your OTP Code" },
                        Body: {
                            Text: {
                                Data: `Your OTP is ${otp}. It is valid for a short time.`,
                            },
                        },
                    },
                })
            );
            log.info("otp email sent successfully")
        }
        return event;


    } catch (err) {
        log.error("Error in CreateAuthChallenge" + JSON.stringify(err));
        throw err;
    }


}