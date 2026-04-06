import "../utils/tracing"
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"
import { log } from "../utils/logger"
import {saveOtpRecord} from "../utils/otphelper"

const EMAIL_SOURCE = "sunil.kasindala@hyniva.com";
const ses = new SESClient({ region: process.env.AWS_REGION })

export const createAuth = async (event: any) => {
    try {
        log.info("createauth challenge is triggered")
        const session = event.request.session ||[];
        log.info("Session in create auth challenge: " + JSON.stringify(session))
        //only if challenge is correct then it enters into this logic 
        if (event.request.challengeName === "CUSTOM_CHALLENGE") {

            const otp = Math.floor(100000 + Math.random() * 900000).toString()
            log.info("generated otp" + JSON.stringify(otp))

            const userId = event.request.userAttributes.sub;
            const email = event.request.userAttributes.email;

            const result = await saveOtpRecord(userId)
            log.info("OTP record saved: " + JSON.stringify(result))

            //store the otp securely 
            event.response.privateChallengeParameters = {
                answer: otp
            }
            log.info('set the private challenge parameters', event.response.privateChallengeParameters.answer)

            event.response.publicChallengeParameters = {
            email: event.request.userAttributes.email
            }

            event.response.challengeMetadata = "OTP_CHALLENGE"
            
            await ses.send(
                new SendEmailCommand({
                    Source: EMAIL_SOURCE,
                    Destination: {
                        ToAddresses: [email],
                    },
                    Message: {
                        Subject: {Data: "Your OTP Code" },
                        Body: {
                            Text: {
                                Data: `Your OTP is ${otp}. It is valid for a short time.`,
                            },
                        },
                    },
                })
            );
            log.info("OTP email sent")
        }
        return event;


    } catch (err) {
        log.error("Error in CreateAuthChallenge" + JSON.stringify(err));
        throw err;
    }
}
