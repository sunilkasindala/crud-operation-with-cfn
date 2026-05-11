import { log } from "../utils/logger"
import { createAuth } from "../handler/createAuthChallenge"
import { mockClient } from "aws-sdk-client-mock"
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns"

jest.mock("../utils/logger", () => ({
    log: { info: jest.fn(), error: jest.fn() }
}))

jest.mock("../utils/otphelper", () => ({
    saveOtpRecord: jest.fn()
}))

const sesMock = mockClient(SESClient);
const snsMock = mockClient(SNSClient);


describe.only("createAuthChallenge test cases", () => {
    beforeEach(() => {
        (log.info as jest.Mock).mockClear();
        (log.error as jest.Mock).mockClear();
        sesMock.reset();
        snsMock.reset();
    })
    it("should ask user to select MFA method after password verification", async () => {
        //arrange
        const event: any = {
            request: {
                challengeName: "CUSTOM_CHALLENGE",
                session: [{ challengeName: "PASSWORD_VERIFIER" }],
                userAttributes: {},
                clientMetadata: {}
            },
            response: {}
        }
        //act 
        const result = await createAuth(event)
        //assert
        expect(result.response.publicChallengeParameters.message).toBe("select MFA method: EMAIL OR SMS")
        expect(result.response.challengeMetadata).toBe("SELECT_MFA")
    })
    it("should send OTP via email after MFA selection", async () => {
        const saveOtpRecordMock = require("../utils/otphelper").saveOtpRecord;
        saveOtpRecordMock.mockResolvedValue({});

        sesMock.on(SendEmailCommand).resolves({});

        //arrange
        const event: any = {
            request: {
                challengeName: "CUSTOM_CHALLENGE",
                session: [{ challengeMetadata: "SELECT_MFA" }],
                clientMetadata: { mfaType: "email" },
                userAttributes: { sub: "user123", email: "test@gmail.com" }
            },
            response: {}
        }
        //act 
        const res = await createAuth(event)
        //assert
        expect(saveOtpRecordMock).toHaveBeenCalledWith("user123")
        expect(sesMock.commandCalls(SendEmailCommand)).toHaveLength(1)
        expect(res.response.challengeMetadata).toBe("OTP_CHALLENGE");

    })
    it("should send OTP via sms after MFA selection", async () => {
        const saveOtpRecordMock = require("../utils/otphelper").saveOtpRecord;
        saveOtpRecordMock.mockResolvedValue({});

        snsMock.on(PublishCommand).resolves({})

        //arrange
        const event: any = {
            request: {
                challengeName: "CUSTOM_CHALLENGE",
                session: [{ challengeMetadata: "SELECT_MFA" }],
                clientMetadata: { mfaType: "SMS" },
                userAttributes: { sub: "user123", phone_number: "+918328465116" }
            },
            response: {}
        }
        //act 
        const res = await createAuth(event)
        //assert
        expect(saveOtpRecordMock).toHaveBeenCalledWith("user123")
        expect(snsMock.commandCalls(PublishCommand)).toHaveLength(1)
        expect(res.response.challengeMetadata).toBe("OTP_CHALLENGE")

    })
    it("should return event when challengeName is not CUSTOM_CHALLENGE", async () => {
        const event: any = {
            request: {
                challengeName: "OTHER_CHALLENGE",  // Not CUSTOM_CHALLENGE
                session: [],
                userAttributes: {},
                clientMetadata: {}
            },
            response: {}
        };

        const result = await createAuth(event);

        expect(result).toBe(event);
        expect(result.response).toEqual({});
    });
    it("should catch error and log it when an error occurs", async () => {
        (log.info as jest.Mock).mockImplementation(() => {
            throw new Error("Simulated error");
        });

        const event: any = {
            request: {
                session: [{ challengeName: "CUSTOM_CHALLENGE" }],
                userAttributes: {},
                clientMetadata: {}
            },
            response: {}
        }
        //expect the function to throw
        try {
            await createAuth(event)
            fail("Should have thrown an error");
        } catch (error: any) {
            // Verify error was thrown
            expect(error.message).toBe("Simulated error");
            // Verify that log.error was called with the error message
            expect(log.error).toHaveBeenCalled();
            expect(log.error).toHaveBeenCalledWith(
                expect.stringContaining("error in create auth challenge")
            );
        }
    })
})