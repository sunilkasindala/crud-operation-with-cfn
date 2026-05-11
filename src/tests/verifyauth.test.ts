import { log } from "../utils/logger"
import { verifyAuth } from "../handler/verifyAuthChallenge"
import { AppConfig } from "../utils/appConfig"


jest.mock("../utils/logger", () => ({
    log: { info: jest.fn(), error: jest.fn() }
}))

jest.mock("../utils/dynamodbLib", () => ({
    call: jest.fn()
}))

describe("verifyauthchallenge test cases", () => {
    beforeEach(() => {
        (log.info as jest.Mock).mockClear();
        (log.error as jest.Mock).mockClear();
    })
    it("should accept valid MFA selection", async () => {
        //arrange 
        const event: any = {
            request: {
                challengeMetadata: "SELECT_MFA",
                challengeAnswer: "EMAIL",
                userAttributes: {},
                clientMetadata: {}
            },
            response: {}
        }
        //act 
        const res = await verifyAuth(event)
        //assert
        expect(res.response.answerCorrect).toBe(true)
    })
    it("should reject invalid MFA rejection", async () => {
        //arrange
        const event: any = {
            request: {
                challengeMetadata: "SELECT_MFA",
                challengeAnswer: "INVALID",
                userAttributes: {},
                clientMetadata: {},
            },
            response: {}
        }
        //act 
        const res = await verifyAuth(event)
        //assert
        expect(res.response.answerCorrect).toBe(false)
    })
    it("should accept reselecting the mfa type for otp generation", async () => {
        //arrange
        const event: any = {
            request: {
                challengeMetadata: "OTP_CHALLENGE",
                challengeAnswer: "SMS",
                userAttributes: {},
                clientMetadata: {},
            },
            response: {}
        }
        //act
        const res = await verifyAuth(event)
        //assert
        expect(res.response.answerCorrect).toBe(true)
    })
    it("should handle otp resend", async () => {
        //arrange
        const event: any = {
            request: {
                challengeMetadata: "OTP_CHALLENGE",
                challengeAnswer: "123456",
                userAttributes: {},
                clientMetadata: { resend: "true" }
            },
            response: {}
        }
        //act 
        const res = await verifyAuth(event)
        //assert
        expect(res.response.answerCorrect).toBe(false)
    })
    it("should reject otp when no record found in DB", async () => {
        const callMock = require("../utils/dynamodbLib").call;
        callMock.mockResolvedValue({ Item: null })
        //arrange
        const event: any = {
            request: {
                challengeMetadata: "OTP_CHALLENGE",
                challengeAnswer: "123456",
                userAttributes: { sub: "user123" },
                clientMetadata: {}
            },
            response: {}
        }
        //act 
        const res = await verifyAuth(event)
        //assert
        expect(callMock).toHaveBeenCalledWith("get", {
            TableName: AppConfig.OTP_TABLE,
            Key: { userId: "user123" }
        });
        expect(res.response.answerCorrect).toBe(false)
    })
    it("should verify otp when user enters correct otp", async () => {
        const callMock = require("../utils/dynamodbLib").call;
        callMock.mockResolvedValue({
            Item: { userId: "user123", otp: "123456" }
        });
        //arrange
        const event: any = {
            request: {
                challengeMetadata: "OTP_CHALLENGE",
                challengeAnswer: "123456",  // Correct OTP
                userAttributes: { sub: "user123" },
                privateChallengeParameters: { answer: "123456" }
            },
            response: {}
        };
        //act
        const result = await verifyAuth(event);
        //assert
        expect(callMock).toHaveBeenCalledWith("get", {
            TableName: AppConfig.OTP_TABLE,
            Key: { userId: "user123" }
        });
        expect(result.response.answerCorrect).toBe(true);
    })
    it("shoud reject otp when user enters incorrect OTP", async () => {
        const callMock = require("../utils/dynamodbLib").call;
        callMock.mockResolvedValue({
            Item: { userId: "user123", otp: "123456" }
        });

        const event: any = {
            request: {
                challengeMetadata: "OTP_CHALLENGE",
                challengeAnswer: "653423",
                userAttributes: { sub: "user123"  },
                privateChallengeParameters: { answer: "123456" }
            },
            response: {}
        }
        //act 
        const result = await verifyAuth(event)
        //assert
        expect(callMock).toHaveBeenCalledWith("get", {
            TableName: AppConfig.OTP_TABLE,
            Key: { userId: "user123" }
        });
        expect(result.response.answerCorrect).toBe(false);
    })
    it("should catch error and log it when an error occurs", async () => {
        // Mock log.info to throw an error on first call
        (log.info as jest.Mock).mockImplementation(() => {
            throw new Error("Simulated error");
        });

        const event: any = {
            request: {
                session: [{ challengeName: "OTP_CHALLENGE" }],
                userAttributes: {},
                clientMetadata: {}
            },
            response: {}
        };

        // Expect the function to throw
        try {
            await verifyAuth(event);
            fail("Should have thrown an error");
        } catch (error: any) {
            // Verify error was thrown
            expect(error.message).toBe("Simulated error");
            // Verify that log.error was called with the error message
            expect(log.error).toHaveBeenCalled();
            expect(log.error).toHaveBeenCalledWith(
                expect.stringContaining("Error while verifying OTP")
            );
        }
    })
})