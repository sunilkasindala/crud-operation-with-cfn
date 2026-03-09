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
      if(!IsmfaEnabled){
        log.info("MFA disabled. Issuing tokens directly.");
        event.response.issueTokens = true;
        event.response.failAuthentication = false;
        return event;
      }
      //if MFA enabled -> then generate otp 
      event.response.issueTokens = false;
      event.response.failAuthentication = false;
      event.response.challengeName = "CUSTOM_CHALLENGE";
      return event;
    }

    //Step 3: After OTP success → issue tokens
    if (
      lastChallenge &&
      lastChallenge.challengeName === "CUSTOM_CHALLENGE" &&
      lastChallenge.challengeResult === true
    ) {
      log.info("OTP verified. Issuing tokens");

      event.response.issueTokens = true;
      event.response.failAuthentication = false;
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

// export const handler = async (event: any) => {
//     try {
//         log.info('define auth trigger is called')
//         const session = event.request.session || [];
//         const lastChallenge = session[session.length - 1];

//         // Step 0 → Start SRP
//         if (session.length === 0) {
//             event.response = {
//                 challengeName: "SRP_A",
//                 issueTokens: false,
//                 failAuthentication: false,
//             };
//         }

//         // Step 1 → Password verification
//         else if (
//             lastChallenge.challengeName === "SRP_A" &&
//             lastChallenge.challengeResult === true
//         ) {
//             event.response = {
//                 challengeName: "PASSWORD_VERIFIER",
//                 issueTokens: false,
//                 failAuthentication: false,
//             };
//         }

//         // Step 2 → Password correct → trigger OTP
//         else if (
//             lastChallenge.challengeName === "PASSWORD_VERIFIER" &&
//             lastChallenge.challengeResult === true
//         ) {
//             event.response = {
//                 challengeName: "CUSTOM_CHALLENGE",
//                 issueTokens: false,
//                 failAuthentication: false,
//             };
//         }

//         // Step 3 → OTP correct → issue tokens
//         else if (
//             lastChallenge.challengeName === "CUSTOM_CHALLENGE" &&
//             lastChallenge.challengeResult === true
//         ) {
//             event.response = {
//                 issueTokens: true,
//                 failAuthentication: false,
//             };
//         }

//         else {
//             event.response = {
//                 issueTokens: false,
//                 failAuthentication: true,
//             };
//         }

//         return event;

//     } catch (err) {
//         log.info('error in define auth lambda' + JSON.stringify(err))
//     }
// };