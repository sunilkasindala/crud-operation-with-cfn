import "../utils/tracing"
import {
  CognitoUser,
  CognitoUserPool,
  AuthenticationDetails
} from "amazon-cognito-identity-js"

import { AppConfig } from "../utils/appConfig"
import { log } from "../utils/logger"

export const authLogin = async (event: any) => {
  log.info('triggerd custom auth login api')

  const body = JSON.parse(event.body)
  const { username, password } = body

  if (!username || !password) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "username and password required" })
    }
  }

  const poolData: any = {
    UserPoolId: AppConfig.USER_POOL_ID,
    ClientId: AppConfig.COGNITO_CLIENT_ID
  }
  log.info('check whether pooldata is having correct id or not' + JSON.stringify(poolData))

  const userPool = new CognitoUserPool(poolData)
  log.info('getting the users' + JSON.stringify(userPool))

  const authenticationDetails = new AuthenticationDetails({
    Username: username,
    Password: password
  })

  const cognitoUser = new CognitoUser({
    Username: username,
    Pool: userPool
  })

  return new Promise((resolve) => {
    //set the custom auth 
    cognitoUser.setAuthenticationFlowType("CUSTOM_AUTH")

    cognitoUser.authenticateUser(authenticationDetails, {

      onSuccess: (result) => {
        resolve({
          statusCode: 200,
          body: JSON.stringify({
            message: "Login successful",
            idToken: result.getIdToken().getJwtToken(),
            accessToken: result.getAccessToken().getJwtToken(),
            refreshToken: result.getRefreshToken().getToken()
          })
        })
      },

      customChallenge: () => {
        resolve({
          statusCode: 200,
          body: JSON.stringify({
            message: "select mfa method",
            session: (cognitoUser as any).Session
          })
        })
      },

      onFailure: (err) => {
        resolve({
          statusCode: 401,
          body: JSON.stringify({
            message: "Login failed",
            error: err.message
          })
        })
      }
    })
  })
}



