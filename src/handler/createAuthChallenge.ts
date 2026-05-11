import "../utils/tracing"
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns"
import { log } from "../utils/logger"
import { saveOtpRecord } from "../utils/otphelper"

const EMAIL_SOURCE = "sunil.kasindala@hyniva.com";
const ses = new SESClient({ region: process.env.AWS_REGION })
const sns = new SNSClient({ region: process.env.AWS_REGION })

export const createAuth = async (event: any) => {
    try {
        log.info("CreateAuthChallenge trigger invoked")

        if (event.request.challengeName === "CUSTOM_CHALLENGE") {
            const session = event.request.session || [];
            log.info(`Session in CreateAuthChallenge: ${JSON.stringify(session)}`)
            const lastChallenge = session[session.length - 1];
            log.info(`Last challenge: ${JSON.stringify(lastChallenge)}`)

            //STEP 1 -> ASK SELECT MFA
            if (lastChallenge?.challengeName === "PASSWORD_VERIFIER") {
                log.info("step1: asking user to select MFA method")

                event.response.publicChallengeParameters = {
                    message: "select MFA method: EMAIL OR SMS"
                };

                event.response.privateChallengeParameters = {
                    step: "SELECT_MFA"
                }

                event.response.challengeMetadata = "SELECT_MFA"
                return event;
            }
            const isResendOtp = event.request.clientMetadata?.resend === "true";
            log.info("isResend flag in create auth challenge: " + isResendOtp)

            const isReselectMfa = event.request.clientMetadata?.mfaReselect === "true";
            log.info("isReselect flag in create auth challenge: " + isReselectMfa)

            //step2 ->  AFTER SELECT -> SEND OTP
            if (lastChallenge.challengeMetadata === "SELECT_MFA" || isResendOtp || isReselectMfa) {
                log.info("step2:MFA selected. Generating and sending OTP")
                
                const selectedMFA = event.request.clientMetadata?.mfaType?.toUpperCase();
                log.info("selectedMFA: " + selectedMFA)

                const otp = Math.floor(100000 + Math.random() * 900000).toString()
                log.info("generated otp" + JSON.stringify(otp))

                const userId = event.request.userAttributes.sub;
                const email = event.request.userAttributes.email;
                const mobile_no = event.request.userAttributes.phone_number


                const result = await saveOtpRecord(userId)
                log.info(`OTP record saved for userId: ${userId}`)

                //store the otp securely 
                event.response.privateChallengeParameters = {
                    answer: otp
                }
                log.info("Private challenge parameters set with OTP")

                event.response.publicChallengeParameters = {
                    destination: selectedMFA === "SMS" ? mobile_no : email
                }

                event.response.challengeMetadata = "OTP_CHALLENGE"

                //send otp to email
                if (selectedMFA === "EMAIL") {
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
                    return event
                }
                if (selectedMFA === "SMS") {
                    await sns.send(
                        new PublishCommand({
                            PhoneNumber: mobile_no,
                            Message: `your otp is ${otp}`
                        })
                    )
                    log.info("OTP sent via SMS successfully")
                    return event
                }
            }
        }
       return event;
    } catch (err) {
        log.error("error in create auth challenge" + JSON.stringify(err))
        throw err;
     }  
}
