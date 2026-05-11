import { log } from "../utils/logger"
import { forgotPassword } from "../handler/forgotPassword"
import { mockClient } from "aws-sdk-client-mock"
import {
    CognitoIdentityProviderClient,
    ForgotPasswordCommand
} from "@aws-sdk/client-cognito-identity-provider";

jest.mock("../utils/logger", () => ({
    log: {info: jest.fn(), error: jest.fn() }
}))

const cognitoMock = mockClient(
    CognitoIdentityProviderClient
);

describe("forgotpassword test cases", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        cognitoMock.reset();
    })
    it("should return 400 if the fields are missing", async () => {
        //arrange
        const event:any  = {
            body: JSON.stringify({
                username: "" // make it empty so that it fails 
            })
        }
        //act
        const result = await forgotPassword(event)
        //assert
        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).message).toBe("username is required")
    })
    it("should return 200 if the otp is sent successfully", async () => {
        //arrange 
        const event: any  = {
            body: JSON.stringify({
                username: "sunil123@test.com"
            })
        }
        //act 
        const result = await forgotPassword(event)
        //assert
        expect(result.statusCode).toBe(200)
        expect(JSON.parse(result.body).message).toBe("OTP is sent via cognito")
    })
    it("should return 500 if the cogntio throws error", async () => {
        cognitoMock.on(ForgotPasswordCommand).rejects(new Error("Cognito failed"));
        //arrange 
        const event:any = {
            body: JSON.stringify({
                username: "sunil123@test.com"
            })
        }
        //act 
        const result = await forgotPassword(event)
        //assert
        expect(result.statusCode).toBe(500)
        expect(JSON.parse(result.body).message).toBe("error in forgot password api:{}")
    })
})