import { mockClient } from "aws-sdk-client-mock";
import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import {loginHandler} from "../handler/loginusers"
import {call} from "../utils/dynamodbLib"
import jwt from "jsonwebtoken"
import { mock } from "node:test";

jest.mock("../utils/dynamodbLib", () => ({
    call: jest.fn()
}));

jest.mock("jsonwebtoken", () => ({
    decode: jest.fn()
}));

const congitoMock = mockClient(CognitoIdentityProviderClient);

describe.only("loginHandler test cases", () => {
    beforeEach(() => {
        congitoMock.reset();
        (call as jest.Mock).mockReset();
        (jwt.decode as jest.Mock).mockReset();
    })
    //test case for missing username and pasword in request body 
    it("should return 400 if username and password are missing", async () => {
        const event:any = {
            body: JSON.stringify({username: "", password: ""})
        };
        //act
        const res = await loginHandler(event);
        //assert
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body)).toEqual({message:"username and password are required"})
    });
    //test case for cognito authentication failure
    it("should return 401 when cognito authentication fails", async () => {
        //arrange
        const event:any = {
            body: JSON.stringify({username: "testuser", password: "testpassword"})
        };
        congitoMock.on(InitiateAuthCommand).rejects(new Error("Authentication failed"));
        //act
        const res = await loginHandler(event);
        //assert
        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.body)).toEqual({message:"invalid username and password"})
    })

    //test case for db faailure 
    it("should return 401 when db operation fails", async () => {
        //arrange
        const event:any = {
            body: JSON.stringify({username:"testuser", password: "testpassword"})
        }
        congitoMock.on(InitiateAuthCommand).resolves({
            AuthenticationResult: { IdToken:"idtoken" , AccessToken:"accesstoken", RefreshToken:"refresh"}
        });
        (jwt.decode as jest.Mock).mockReturnValue({sub: "cognitoSub"});
        (call as jest.Mock).mockRejectedValue(new Error("DB operation failed"));
        //act
        const res =  await loginHandler(event);
        //assert
        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.body)).toEqual({message:"invalid username and password"})
    })

    //test case for successful login 
    it("should return 200 if username and password are valid", async () => {
        //arrange
        const event:any = {
            body: JSON.stringify({username:"sunil@gmail.com", password:"pass@123"})
        }
        congitoMock.on(InitiateAuthCommand).resolves({
            AuthenticationResult: { IdToken:"idtoken" , AccessToken:"accesstoken", RefreshToken:"refresh"}
        });
        (jwt.decode as jest.Mock).mockReturnValue({sub: "cognitoSub"});
        (call as jest.Mock).mockResolvedValue({Items: [{ userId: "1"}] 
        })
        //act
        const res = await loginHandler(event);
        //assert
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({
            message: "login succccessful",
            accessToken: "accesstoken",
            idToken: "idtoken", 
            refreshToken: "refresh",
            user: {userId: "1"}                     
        })
    })
});
