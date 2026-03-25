import "../utils/tracing"
import { updateMfastatus } from "../utils/cognitohelper";

import { log } from "../utils/logger"

export const enableMFA = async (event: any) => {
    try {
        log.info('entered into enable mfa')

        //extract sub from token 
        log.info("FULL EVENT:" + JSON.stringify(event, null, 2));

        const sub = event.requestContext.authorizer.jwt.claims.sub;
        log.info('extracted sub id from token', sub)

        const body = JSON.parse(event.body || {});

        if ("mfaEnabled" in body) {
            const { mfaEnabled } = body

            if (typeof mfaEnabled !== "boolean") {
                return {
                    statusCode: 400,
                    body: JSON.stringify({
                        message: "mfaEnabled must be true or false"
                    })
                };
            }
            await updateMfastatus(sub, mfaEnabled)
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: `MFA is ${mfaEnabled ? 'enabled' : 'disabled'} successfully`
                })
            }

        }
    } catch (err) {
        log.error('error in updating the mfa status' + JSON.stringify(err))
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "internal server error"
            })
        }
    }
}