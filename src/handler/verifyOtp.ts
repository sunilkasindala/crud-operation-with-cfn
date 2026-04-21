import "../utils/tracing"
import {
  CognitoIdentityProviderClient,
  RespondToAuthChallengeCommand
} from "@aws-sdk/client-cognito-identity-provider";

import { AppConfig } from "../utils/appConfig";
import { log } from "../utils/logger";

import AWSXRay from "aws-xray-sdk-core"

const cognitoClient = AWSXRay.captureAWSv3Client(
    new CognitoIdentityProviderClient({
    region: AppConfig.AWS_REGION
})
)

export const verifyOtp = async (event: any) => {
  try {
    const body = JSON.parse(event.body);

    const { username, otp, session} = body;

    if (!username || !otp || !session) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "username, otp and session are required"
        })
      };
    }

    const command = new RespondToAuthChallengeCommand({
      ClientId: AppConfig.COGNITO_CLIENT_ID,
      ChallengeName: "CUSTOM_CHALLENGE",
      Session: session,
      ChallengeResponses: {
        USERNAME: username,
        ANSWER: otp,
      }
    });

    const response = await cognitoClient.send(command);

    if (response.AuthenticationResult) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Login successful",
          idToken: response.AuthenticationResult.IdToken,
          accessToken: response.AuthenticationResult.AccessToken,
          refreshToken: response.AuthenticationResult.RefreshToken
        })
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "OTP verification failed or additional challenge required",
        challengeName: response.ChallengeName,
        session: response.Session
      })
    };

  } catch (error: any) {
    log.error("OTP verification failed:", error);

    return {
      statusCode: 401,
      body: JSON.stringify({
        message: "Invalid OTP"
      })
    };
  }
};

