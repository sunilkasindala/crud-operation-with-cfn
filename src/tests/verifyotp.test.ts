import { mockClient } from "aws-sdk-client-mock"
import { log } from "../utils/logger"
import { CognitoIdentityProviderClient, RespondToAuthChallengeCommand } from "@aws-sdk/client-cognito-identity-provider"
import { verifyOtp } from "../handler/verifyOtp"
import { verifyAuth } from "../handler/verifyAuthChallenge"

jest.mock("../utils/logger", () => ({
    log: { info: jest.fn(), error: jest.fn() }
}))

const congitoMock = mockClient(CognitoIdentityProviderClient);

describe.only("verifyotp test cases", () => {
    beforeEach(() => {
        congitoMock.reset();
        (log.info as jest.Mock).mockClear();
        (log.error as jest.Mock).mockClear();
    })
    it("should return 400 if the fields are missing", async () => {
        //arrange 
        const event: any = {
            body: JSON.stringify({
                username: "sunil123"
                //not sent the file for making it throw the error 
            })
        }
        //act 
        const res = await verifyOtp(event)
        //assert
        expect(res.statusCode).toBe(400)
        expect(JSON.parse(res.body).message).toBe("username, otp and session are required")
    })
    it("should return 200 when OTP is correct", async () => {
        congitoMock.on(RespondToAuthChallengeCommand).resolves({
            AuthenticationResult: {
                IdToken: "id-token",
                AccessToken: "access-token",
                RefreshToken: "refresh-token"
            }
        });
        //arrange
        const event: any = {
            body: JSON.stringify({
                username: "user1",
                otp: "123456",
                session: "session123"
            })
        };
        //act 
        const res = await verifyOtp(event);
        //assert
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).message).toBe("Login successful");
        expect(JSON.parse(res.body).idToken).toBe("id-token");
    });
    it("should return 400 when OTP verification fails", async () => {
        congitoMock.on(RespondToAuthChallengeCommand).resolves({
            ChallengeName: "CUSTOM_CHALLENGE",
            Session: "new-session"
        });
        //arrange
        const event: any = {
            body: JSON.stringify({
                username: "user1",
                otp: "000000",
                session: "session123"
            })
        };
        //act 
        const res = await verifyOtp(event);
        //assert
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).message).toBe("OTP verification failed or additional challenge required")
        expect(JSON.parse(res.body).challengeName).toBe("CUSTOM_CHALLENGE")
    });
    it("should return 401 when an error occurs", async () => {
        // forcing aws to throw error 
        congitoMock.on(RespondToAuthChallengeCommand).rejects(
            new Error("Simulated AWS failure")
        );
        //arrange 
        const event: any = {
            body: JSON.stringify({
                username: "user1",
                otp: "123456",
                session: "session123"
            })
        };

        //act 
        const res = await verifyOtp(event);
        //assert
        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.body).message).toBe("Invalid OTP");
        expect(log.error).toHaveBeenCalledWith(
            "OTP verification failed:",
            expect.any(Error)
        );
    });
})