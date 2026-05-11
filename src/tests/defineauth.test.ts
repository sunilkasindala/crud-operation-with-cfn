import { log } from "../utils/logger"
import { authChallenge } from "../handler/defineAuthChallenge"

jest.mock("../utils/logger", () => ({
    log: { info: jest.fn(), error: jest.fn() }
}))

describe("defineAuthChallenge test cases", () => {
    beforeEach(() => {
        (log.info as jest.Mock).mockClear();
        (log.error as jest.Mock).mockClear();
    })
    it("should move to password verifier challenge after SRP_A", async () => {
        //arrange
        const event: any = {
            request: {
                session: [
                    { challengeName: "SRP_A" }
                ],
                userAttributes: {},
                clientMetadata: {}
            },
            response: {}
        }
        //act 
        const result = await authChallenge(event);
        //assert
        expect(result.response.challengeName).toBe("PASSWORD_VERIFIER");
        expect(result.response.issueTokens).toBe(false);
        expect(result.response.failAuthentication).toBe(false);
    })
    it("should directly issue tokens after password verfiifcation --> if mfa is disabled", async () => {
        //arrange
        const event: any = {
            request: {
                session: [
                    { challengeName: "PASSWORD_VERIFIER", challengeResult: true }
                ],
                userAttributes: { "custom:mfaEnabled": "false" },
                clientMetadata: {}
            },
            response: {}
        }
        //act 
        const res = await authChallenge(event);
        //assert
        expect(res.response.issueTokens).toBe(true);
        expect(res.response.failAuthentication).toBe(false);
    })
    it("should move to custom challenge after successfful password verfification --> if mfa enabled", async () => {
        //arrange
        const event: any = {
            request: {
                session: [
                    { challengeName: "PASSWORD_VERIFIER", challengeResult: true }
                ],
                userAttributes: { "custom:mfaEnabled": "true" },
                clientMetadata: {},
            },
            response: {}
        }
        //act 
        const res = await authChallenge(event);
        //assert
        expect(res.response.challengeName).toBe("CUSTOM_CHALLENGE");
        expect(res.response.issueTokens).toBe(false);
        expect(res.response.failAuthentication).toBe(false);

    })
    it("should move to custom challenge after user selects mfa type", async () => {
        //arrange
        const event: any = {
            request: {
                session: [
                    { challengeName: "CUSTOM_CHALLENGE", challengeResult: true, challengeMetadata: "SELECT_MFA" }
                ],
                userAttributes: { "custom:mfaEnabled": "true" },
                clientMetadata: {},
            },
            response: {}
        }
        //act 
        const res = await authChallenge(event);
        //assert
        expect(res.response.challengeName).toBe("CUSTOM_CHALLENGE");
        expect(res.response.issueTokens).toBe(false);
        expect(res.response.failAuthentication).toBe(false);
    })
    it("should move to custom challenge for mfa reselect after otp success", async () => {
        //arrange 
        const event: any = {
            request: {
                session: [
                    { challengeName: "CUSTOM_CHALLENGE", challengeResult: true, challengeMetadata: "OTP_CHALLENGE" }
                ],
                userAttributes: {},
                clientMetadata: { mfaReselect: "true" }
            },
            response: {}
        }
        //act 
        const res = await authChallenge(event)
        //assert 
        expect(res.response.challengeName).toBe("CUSTOM_CHALLENGE")
        expect(res.response.issueTokens).toBe(false)
        expect(res.response.failAuthentication).toBe(false)
    })
    it("should retry custom challenge after otp failure with less than 3 attempts", async () => {
        const event: any = {
            request: {
                session: [
                    { challengeName: "CUSTOM_CHALLENGE", challengeResult: false, challengeMetadata: "OTP_CHALLENGE" }
                ],
                userAttributes: {},
                clientMetadata: {},
            },
            response: {}
        }
        //act 
        const res = await authChallenge(event)
        //assert 
        expect(res.response.challengeName).toBe("CUSTOM_CHALLENGE")
        expect(res.response.issueTokens).toBe(false)
        expect(res.response.failAuthentication).toBe(false)
    })
    it("should fail authentication after more than 3 otp failed attempts", async () => {
        //arrange
        const event: any = {
            request: {
                session: [
                    { challengeName: "CUSTOM_CHALLENGE", challengeResult: false, challengeMetadata: "OTP_CHALLENGE" },
                    { challengeName: "CUSTOM_CHALLENGE", challengeResult: false, challengeMetadata: "OTP_CHALLENGE" },
                    { challengeName: "CUSTOM_CHALLENGE", challengeResult: false, challengeMetadata: "OTP_CHALLENGE" },
                    { challengeName: "CUSTOM_CHALLENGE", challengeResult: false, challengeMetadata: "OTP_CHALLENGE" }
                ],
                userAttributes: {},
                clientMetadata: {}
            },
            response: {}
        }
        //act 
        const res = await authChallenge(event)
        //assert
        expect(res.response.issueTokens).toBe(false)
        expect(res.response.failAuthentication).toBe(true)
    })
    it("should issue tokens after otp is verified successfully", async () => {
        //arrange
        const event: any = {
            request: {
                session: [
                    { challengeName: "CUSTOM_CHALLENGE", challengeResult: true, challengeMetadata: "OTP_CHALLENGE" }
                ],
                userAttributes: {},
                clientMetadata: {}
            },
            response: {}
        }
        //act
        const res = await authChallenge(event)
        //assert
        expect(res.response.issueTokens).toBe(true)
        expect(res.response.failAuthentication).toBe(false)
    })
    it('should fail authentication for unmatched challenge state', async () => {
        //arrange 
        const event: any = {
            request: {
                session: [
                    { challengeName: "UNMATCHED_CHALLENGE", challengeResult: true }
                ],
                userAttributes: {},
                clientMetadata: {},
            },
            response: {}

        }
        //act 
        const res = await authChallenge(event)
        //assert
        expect(res.response.issueTokens).toBe(false)
        expect(res.response.failAuthentication).toBe(true)
    })
    it("should catch error and log it when an error occurs", async () => {
        // Mock log.info to throw an error on first call
        (log.info as jest.Mock).mockImplementation(() => {
            throw new Error("Simulated error");
        });

        const event: any = {
            request: {
                session: [{ challengeName: "SRP_A" }],
                userAttributes: {},
                clientMetadata: {}
            },
            response: {}
        };

        // Expect the function to throw
        try {
            await authChallenge(event);
            fail("Should have thrown an error");
        } catch (error: any) {
            // Verify error was thrown
            expect(error.message).toBe("Simulated error");
            // Verify that log.error was called with the error message
            expect(log.error).toHaveBeenCalled();
            expect(log.error).toHaveBeenCalledWith(
                expect.stringContaining("Error in DefineAuthChallenge")
            );
        }
    });
})