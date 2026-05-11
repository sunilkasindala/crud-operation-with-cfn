import { log } from "../utils/logger"
import { CognitoUser, CognitoUserPool, AuthenticationDetails } from "amazon-cognito-identity-js"
import { authLogin } from "../handler/customAuthlogin"

jest.mock("amazon-cognito-identity-js", () => {
    return {
        CognitoUserPool: jest.fn(),
        AuthenticationDetails: jest.fn(),
        CognitoUser: jest.fn()
    };
});

jest.mock("../utils/logger", () => ({
    log: { info: jest.fn(), error: jest.fn() }
}))

describe("customAuth test cases", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it("should return 400 if the fields are missing", async () => {
        //arrange
        const event: any = {
            body: JSON.stringify({
                username: "sunil12"
            })
        }
        //act 
        const result: any = await authLogin(event)
        //assert
        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).message).toBe("username and password required")
    })
    it("should return 200 on successful login", async () => {
        const mockAuthenticate = jest.fn((authDetails, callbacks) => {
            callbacks.onSuccess({
                getIdToken: () => ({ getJwtToken: () => "id-token" }),
                getAccessToken: () => ({ getJwtToken: () => "access-token" }),
                getRefreshToken: () => ({ getToken: () => "refresh-token" })
            });
        });

        (CognitoUser as any).mockImplementation(() => ({
            setAuthenticationFlowType: jest.fn(),
            authenticateUser: mockAuthenticate
        }));
        //arrange 
        const event: any = {
            body: JSON.stringify({
                username: "user1",
                password: "pass123"
            })
        };
        //act 
        const result: any = await authLogin(event);
        //assert
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body).message).toBe("Login successful");
        expect(JSON.parse(result.body).idToken).toBe("id-token");
    });
    it("should return 200 and session for custom challenge", async () => {
        const mockUser = {
            Session: "session-123",
            setAuthenticationFlowType: jest.fn(),
            authenticateUser: jest.fn((authDetails, callbacks) => {
                callbacks.customChallenge();
            })
        };

        (CognitoUser as any).mockImplementation(() => mockUser);

        const event: any = {
            body: JSON.stringify({
                username: "user1",
                password: "pass123"
            })
        };
        //act
        const result: any = await authLogin(event);
        //assert
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body).message).toBe("select mfa method");
        expect(JSON.parse(result.body).session).toBe("session-123");
    });
    it("should return 401 on login failure", async () => {
        const mockAuthenticate = jest.fn((authDetails, callbacks) => {
            callbacks.onFailure({ message: "Invalid credentials" });
        });

        (CognitoUser as any).mockImplementation(() => ({
            setAuthenticationFlowType: jest.fn(),
            authenticateUser: mockAuthenticate
        }));
        //arrange
        const event: any = {
            body: JSON.stringify({
                username: "user1",
                password: "wrongpass"
            })
        };
        //act
        const result: any = await authLogin(event);
        //assert
        expect(result.statusCode).toBe(401);
        expect(JSON.parse(result.body).message).toBe("Login failed");
        expect(JSON.parse(result.body).error).toBe("Invalid credentials");
    });
})


