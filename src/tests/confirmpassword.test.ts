import { log } from "../utils/logger"
import { confirmPassword } from "../handler/confirmPassword"
import { mockClient } from "aws-sdk-client-mock"
import {
    CognitoIdentityProviderClient,
    ConfirmForgotPasswordCommand
} from "@aws-sdk/client-cognito-identity-provider";

jest.mock("../utils/logger", () => ({
    log: {info: jest.fn() , error: jest.fn()}
}))

const cognitoMock = mockClient(
    CognitoIdentityProviderClient
)

describe("confirmpassword test cases", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        cognitoMock.reset();
    })
    it("should return 400 if the fields are missing", async () => {
        //arrange 
        const event: any = {
            body: JSON.stringify({
                username: "sunil123@test.com" //remainig fields leave it for throwing error 
            })
        }
        //act
        const result = await confirmPassword(event)
        //assert
        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).message).toBe("username , otp and newpassword are required")
    })
    it("should return 200 if the password is set successfully", async () => {
        //arrange 
        const event: any = {
            body: JSON.stringify({
                username: "snil123@test.com",
                otp: "123456",
                newPassword: "sunil@123"
            })
        }
        //act 
        const result = await confirmPassword(event)
        //assert
        expect(result.statusCode).toBe(200)
        expect(JSON.parse(result.body).message).toBe("password is reset successfully")
    })
    it("should return 500 if the catch block throws any error", async () => {
        cognitoMock.on(ConfirmForgotPasswordCommand).rejects(new Error("Cognito failed"))

        //arrange 
        const event: any = {
            body: JSON.stringify({
                username: "sunil123@test.com",
                otp: "123456",
                newPassword: "sunil@123"
            })
        }
        //act
        const result = await confirmPassword(event)
        //assert
        expect(result.statusCode).toBe(500)
        expect(JSON.parse(result.body).message).toBe("error in confirm password api:{}")
    })
})
