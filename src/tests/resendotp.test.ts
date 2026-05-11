import { log } from "../utils/logger";
import { resendOtp } from "../handler/ResendOtp";
import { call } from "../utils/dynamodbLib";

import { mockClient } from "aws-sdk-client-mock";

import {
    CognitoIdentityProviderClient,
    RespondToAuthChallengeCommand
} from "@aws-sdk/client-cognito-identity-provider";

jest.mock("../utils/logger", () => ({
    log: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

jest.mock("../utils/dynamodbLib", () => ({
    call: jest.fn()
}));

const cognitoMock = mockClient(
    CognitoIdentityProviderClient
);

describe("resendOtp test cases", () => {

    beforeEach(() => {
        jest.clearAllMocks();
        cognitoMock.reset();
    });

    it("should return 400 when username or session is missing", async () => {

        // arrange
        const event: any = {
            body: JSON.stringify({
                username: "sunil123"
            })
        };

        // act
        const result: any = await resendOtp(event);

        // assert
        expect(result.statusCode).toBe(400);

        expect(JSON.parse(result.body).message)
            .toBe("username and session are required");
    });

    it("should return 400 when resend is requested within cooldown period", async () => {

        // arrange
        (call as jest.Mock)

            // query user
            .mockResolvedValueOnce({
                Items: [
                    {
                        cognitoSub: "user123"
                    }
                ]
            })

            // get otp data
            .mockResolvedValueOnce({
                Item: {
                    lastResendTime: Date.now(),
                    resendCount: 1
                }
            });

        const event: any = {
            body: JSON.stringify({
                username: "sunil@test.com",
                session: "session123"
            })
        };

        // act
        const result: any = await resendOtp(event);

        // assert
        expect(result.statusCode).toBe(400);

        expect(JSON.parse(result.body).message)
            .toContain("Please wait before requesting a new OTP");
    });

    it("should return 400 when resend attempts exceed limit", async () => {

        // arrange
        (call as jest.Mock)

            // query user
            .mockResolvedValueOnce({
                Items: [
                    {
                        cognitoSub: "user123"
                    }
                ]
            })

            // get otp data
            .mockResolvedValueOnce({
                Item: {
                    lastResendTime: 0,
                    resendCount: 4
                }
            });

        const event: any = {
            body: JSON.stringify({
                username: "sunil@test.com",
                session: "session123"
            })
        };

        // act
        const result: any = await resendOtp(event);

        // assert
        expect(result.statusCode).toBe(400);

        expect(JSON.parse(result.body).message)
            .toContain("Maximum resend attempts reached");
    });

    it("should resend OTP successfully", async () => {

        // arrange
        (call as jest.Mock)

            // query user
            .mockResolvedValueOnce({
                Items: [
                    {
                        cognitoSub: "user123"
                    }
                ]
            })

            // get otp data
            .mockResolvedValueOnce({
                Item: {
                    lastResendTime: 0,
                    resendCount: 0
                }
            })

            // update otp data
            .mockResolvedValueOnce({});

        cognitoMock
            .on(RespondToAuthChallengeCommand)
            .resolves({
                Session: "new-session"
            });

        const event: any = {
            body: JSON.stringify({
                username: "sunil@test.com",
                session: "old-session"
            })
        };

        // act
        const result: any = await resendOtp(event);

        // assert
        expect(result.statusCode).toBe(200);

        expect(JSON.parse(result.body).message)
            .toBe("OTP resent successfully");

        expect(JSON.parse(result.body).session)
            .toBe("new-session");

        expect(call).toHaveBeenCalledTimes(3);
    });

    it("should call cognito with correct resend payload", async () => {

        // arrange
        (call as jest.Mock)

            .mockResolvedValueOnce({
                Items: [
                    {
                        cognitoSub: "user123"
                    }
                ]
            })

            .mockResolvedValueOnce({
                Item: {
                    lastResendTime: 0,
                    resendCount: 0
                }
            })

            .mockResolvedValueOnce({});

        cognitoMock
            .on(RespondToAuthChallengeCommand)
            .resolves({
                Session: "new-session"
            });

        const event: any = {
            body: JSON.stringify({
                username: "sunil@test.com",
                session: "old-session"
            })
        };

        // act
        await resendOtp(event);

        // assert
        const calls = cognitoMock.commandCalls(
            RespondToAuthChallengeCommand
        );

        expect(calls.length).toBe(1);

        expect(calls[0].args[0].input).toMatchObject({
            ChallengeName: "CUSTOM_CHALLENGE",
            Session: "old-session",
            ChallengeResponses: {
                USERNAME: "sunil@test.com",
                ANSWER: "resend"
            },
            ClientMetadata: {
                resend: "true"
            }
        });
    });
    it("should handle database errors", async () => {
        // arrange
        (call as jest.Mock)
            .mockRejectedValue(
                new Error("DB failure")
            );
        const event: any = {
            body: JSON.stringify({
                username: "sunil@test.com",
                session: "session123"
            })
        };
        // act
        const result: any = await resendOtp(event);
        // assert
        expect(log.info).toHaveBeenCalled();
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).message)
            .toBe("Internal server error");
    });
});