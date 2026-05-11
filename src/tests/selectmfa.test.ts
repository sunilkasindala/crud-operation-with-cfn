import { log } from "../utils/logger";

import { selectMfa } from "../handler/selectMfaType";

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

const cognitoMock = mockClient(
    CognitoIdentityProviderClient
);

describe("selectMfa test cases", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        cognitoMock.reset();
    });

    it("should return 400 when required fields are missing", async () => {
        // arrange
        const event: any = {
            body: JSON.stringify({
                username: "sunil"
            })
        };
        // act
        const result: any = await selectMfa(event);
        // assert
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message)
            .toBe(
                "username, session, mfaType and isChangingMfa are required"
            );
    });
    it("should select MFA successfully", async () => {
        // mock cognito response
        cognitoMock
            .on(RespondToAuthChallengeCommand)
            .resolves({
                Session: "new-session"
            });
        // arrange
        const event: any = {
            body: JSON.stringify({
                username: "sunil@test.com",
                session: "old-session",
                mfaType: "EMAIL",
                isChangingMfa: true
            })
        };
        // act
        const result: any = await selectMfa(event);
        // assert
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body).message)
            .toBe("MFA is selected successfully");
        expect(JSON.parse(result.body).session)
            .toBe("new-session");
    });

    it("should call Cognito with correct payload", async () => {

        cognitoMock
            .on(RespondToAuthChallengeCommand)
            .resolves({
                Session: "new-session"
            });

        // arrange
        const event: any = {
            body: JSON.stringify({
                username: "sunil@test.com",
                session: "old-session",
                mfaType: "SMS",
                isChangingMfa: false
            })
        };

        // act
        await selectMfa(event);

        // assert
        const calls = cognitoMock.commandCalls(
            RespondToAuthChallengeCommand
        );
        expect(calls.length).toBe(1);
        expect(calls[0].args[0].input)
            .toMatchObject({
                ChallengeName: "CUSTOM_CHALLENGE",
                Session: "old-session",
                ChallengeResponses: {
                    USERNAME: "sunil@test.com",
                    ANSWER: "SMS"
                },
                ClientMetadata: {
                    mfaType: "SMS",
                    mfaReselect: "false"
                }
            });
    });
    it("should handle Cognito errors", async () => {
        // mock failure
        cognitoMock
            .on(RespondToAuthChallengeCommand)
            .rejects(new Error("Cognito failed"));

        // arrange
        const event: any = {
            body: JSON.stringify({
                username: "sunil@test.com",
                session: "old-session",
                mfaType: "EMAIL",
                isChangingMfa: true
            })
        };

        // act
        const result: any = await selectMfa(event);

        // assert
        expect(log.info).toHaveBeenCalled();

        // this works only if you return 500 from catch block
        expect(result.statusCode).toBe(500);

        expect(JSON.parse(result.body).message)
            .toBe("Internal server error");
    });
});