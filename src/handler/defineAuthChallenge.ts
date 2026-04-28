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
      log.info("Password verified.");
      const IsmfaEnabled = event.request.userAttributes["custom:mfaEnabled"] === "true";
      // If MFA disabled → directly issue tokens
      if (!IsmfaEnabled) {
        log.info("MFA disabled. Issuing tokens directly.");
        event.response.issueTokens = true;
        event.response.failAuthentication = false;
        return event;
      }
      //if MFA enabled -> then ask user to select MFA 
      log.info("MFA is enabled -> asking user to select Mfa type")
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
      log.info("selected mfa type --> move to otp");

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
        log.info("user is reslecting the mfa type -> asking user to select mfa type again")
        event.response.issueTokens = false;
        event.response.failAuthentication = false;
        event.response.challengeName = "CUSTOM_CHALLENGE"
        return event;
      }
      // now otp is success issue tokens 
      log.info("otp is success issuing tokens")
      event.response.issueTokens = true;
      event.response.failAuthentication = false;
      return event;
    }
    // //step 4: if otp is success --> then issue tokens 
    // if(
    //   lastChallenge && 
    //   lastChallenge.challengeName === "CUSTOM_CHALLENGE" &&
    //   lastChallenge.challengeResult === true &&
    //   lastChallenge.challengeMetadata === "OTP_CHALLENGE"
    // ){
    //   log.info("OTP verified issuing tokens")

    //   event.response.issueTokens = true;
    //   event.response.failAuthentication = false;
    //   return event;
    // }

    //Step 4.1: After OTP failure OR resend → retry challenge
    if (
      lastChallenge &&
      lastChallenge.challengeName === "CUSTOM_CHALLENGE" &&
      lastChallenge.challengeResult === false
    ) {
      log.info("OTP incorrect or resend triggered. Retrying challenge");
      //count the number of attempts from the session
      const failedAttempts = session.filter((challenge:any) => 
        challenge.challengeName === "CUSTOM_CHALLENGE" &&
        challenge.challengeResult === false
      ).length;
      log.info("failed otp attempts:" + failedAttempts);

      //count the number of resend attempts
      if(failedAttempts > 3){
        log.info("maximaum otp attempts reached -> failing authentication");
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
    log.info("Authentication failed");
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
    return event;

  } catch (err) {
    log.error("Error in DefineAuthChallenge " + JSON.stringify(err));
    throw err;
  }
};
