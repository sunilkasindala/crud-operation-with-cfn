import "../utils/tracing"
import { log } from "../utils/logger";

export const authChallenge = async (event: any) => {
  try {
    log.info("DefineAuthChallenge trigger " + JSON.stringify(event));

    const session = event.request.session || [];
    log.info("Session: " + JSON.stringify(session));

    const lastChallenge = session[session.length - 1];

    //Step 1: After SRP_A → move to PASSWORD_VERIFIER
    if (
      lastChallenge &&
      lastChallenge.challengeName === "SRP_A"
    ) {
      log.info("SRP_A received. Triggering PASSWORD_VERIFIER");

      event.response.issueTokens = false;
      event.response.failAuthentication = false;
      event.response.challengeName = "PASSWORD_VERIFIER";
      return event;
    }

    //Step 2: After password verification → trigger OTP
    if (
      lastChallenge &&
      lastChallenge.challengeName === "PASSWORD_VERIFIER" &&
      lastChallenge.challengeResult === true

    ) {
      log.info("Password verified successfully. Checking if MFA is enabled for the user.");

      const isMfaEnabled = event.request.userAttributes["custom:mfaEnabled"] === "true";
      // If MFA disabled → directly issue tokens
      if (!isMfaEnabled) {
        log.info("MFA disabled for user. Issuing tokens directly.");
        event.response.issueTokens = true;
        event.response.failAuthentication = false;
        return event;
      }
      //if MFA enabled -> then ask user to select MFA 
      log.info("MFA is enabled. Asking user to select MFA type")
      event.response.issueTokens = false;
      event.response.failAuthentication = false;
      event.response.challengeName = "CUSTOM_CHALLENGE";
      return event;
    }

    //Step 3: once user selected mfa type --> then move to otp  → issue tokens
    if (
      lastChallenge &&
      lastChallenge.challengeName === "CUSTOM_CHALLENGE" &&
      lastChallenge.challengeResult === true &&
      lastChallenge.challengeMetadata === "SELECT_MFA"
    ) {
      log.info("Selected MFA type. Moving to OTP challenge");

      event.response.issueTokens = false;
      event.response.failAuthentication = false;
      event.response.challengeName = "CUSTOM_CHALLENGE"
      return event;
    }
    //step 4: user is reselecting the mfa type or resending the otp
    if(
      lastChallenge &&
      lastChallenge.challengeName === "CUSTOM_CHALLENGE" &&
      lastChallenge.challengeResult === true &&
      lastChallenge.challengeMetadata === "OTP_CHALLENGE"
    )
    {
      const isMfaReselect = event.request.clientMetadata?.mfaReselect === "true";

      if(isMfaReselect){
        log.info("user is reselecting the mfa type -> asking user to select mfa type again")
        event.response.issueTokens = false;
        event.response.failAuthentication = false;
        event.response.challengeName = "CUSTOM_CHALLENGE"
        return event;
      }
      // now otp is success issue tokens 
      log.info("OTP verified successfully. Issuing tokens")
      event.response.issueTokens = true;
      event.response.failAuthentication = false;
      return event;
    }

    //Step 4.1: After OTP failure OR resend → retry challenge
    if (
      lastChallenge &&
      lastChallenge.challengeName === "CUSTOM_CHALLENGE" &&
      lastChallenge.challengeResult === false
    ) {
      log.info("OTP incorrect or resend triggered. Retrying OTP challenge");
      //count the number of attempts from the session
      const failedAttempts = session.filter((challenge:any) => 
        challenge.challengeName === "CUSTOM_CHALLENGE" &&
        challenge.challengeResult === false
      ).length;
      log.info(`Failed OTP attempts: ${failedAttempts}`);

      //count the number of resend attempts
      if(failedAttempts > 3){
        log.info(`Maximum OTP attempts reached (${failedAttempts}). Failing authentication`);
        event.response.issueTokens = false;
        event.response.failAuthentication = true;
        return event;
      }
      //retry otp
      event.response.issueTokens = false;
      event.response.failAuthentication = false;
      event.response.challengeName = "CUSTOM_CHALLENGE";
      return event;
    }

    //Fail otherwise
    log.info("Authentication failed. No valid challenge state matched");
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
    return event;

  } catch (err) {
    log.error("Error in DefineAuthChallenge " + JSON.stringify(err));
    throw err;
  }
};
