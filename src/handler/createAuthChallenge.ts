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
        log.info("createauth challenge is triggered")

        if (event.request.challengeName === "CUSTOM_CHALLENGE") {
            const session = event.request.session || [];
            log.info("Session in create auth challenge: " + JSON.stringify(session))
            const lastchallenge = session[session.length - 1];
            log.info("last challenge in create auth challenge:" + JSON.stringify(lastchallenge))

            //STEP 1 -> ASK SELECT MFA
            if (lastchallenge?.challengeName === "PASSWORD_VERIFIER") {
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
            const isResend = event.request.clientMetadata?.resend === "true";
            log.info("isResend flag in create auth challenge: " + isResend)

            const isReselect = event.request.clientMetadata?.mfaReselect === "true";
            log.info("isReselect flag in create auth challenge: " + isReselect)

            //step2 ->  AFTER SELECT -> SEND OTP
            if (lastchallenge.challengeMetadata === "SELECT_MFA" || isResend || isReselect) {
                log.info("step2.1: user has selected the MFA method and now asking user to enter the OTP")
                
                const selectedMFA = event.request.clientMetadata?.mfaType?.toUpperCase();
                log.info("selectedMFA: " + selectedMFA)

                const otp = Math.floor(100000 + Math.random() * 900000).toString()
                log.info("generated otp" + JSON.stringify(otp))

                const userId = event.request.userAttributes.sub;
                const email = event.request.userAttributes.email;
                const mobile_no = event.request.userAttributes.phone_number


                const result = await saveOtpRecord(userId)
                log.info("OTP record saved")

                //store the otp securely 
                event.response.privateChallengeParameters = {
                    answer: otp
                }
                log.info('set the private challenge parameters', event.response.privateChallengeParameters.answer)

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
                    log.info("otp sent to sms succesffully")
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
