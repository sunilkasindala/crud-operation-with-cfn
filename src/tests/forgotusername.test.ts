import { log } from "../utils/logger"
import { forgotUsername } from "../handler/forgotUsername"
import { mockClient } from "aws-sdk-client-mock";
import { call } from "../utils/dynamodbLib";
import {
    SNSClient,
    PublishCommand
} from "@aws-sdk/client-sns";
import { forgotPassword } from "../handler/forgotPassword";

jest.mock("../utils/logger", () => ({
    log: {info: jest.fn() , error: jest.fn()}
}))

jest.mock("../utils/dynamodbLib", () => ({
    call: jest.fn()
}))

const snsMock = mockClient(SNSClient)

describe("forgotusername test cases", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        snsMock.reset();
    })
    it("should return 400 if the fileds are missing", async () => {
        //arrange
        const event: any = {
            body: JSON.stringify({
                mobile_no: "" //empty for throwing the error
            })
        }
        //act 
        const result = await forgotUsername(event)
        //assert
        expect(result.statusCode).toBe(400)
        expect(JSON.parse(result.body).message).toBe("mobile_no is required")
    })
    it("should return 404 if user is not found return error ", async () => {
        // snsMock.on(PublishCommand).rejects("db failed")
        (call as jest.Mock).mockResolvedValue({
        Items: []
        })
        //arrange 
        const event: any = {
            body: JSON.stringify({
                mobile_no: "+918328465116"
            })
        }
        //act 
        const result = await forgotUsername(event)
        //assert
        expect(result.statusCode).toBe(404)
        expect(JSON.parse(result.body).message).toBe("No user found with the provided mobile number")
    })
    it("should send username successfully through SNS", async () => {
        (call as jest.Mock).mockResolvedValue({
            Items: [
                {
                    username: "sunil123"
                }
            ]
        })
        snsMock.on(PublishCommand).resolves({
            MessageId: "123"
        })
        //arrange 
        const event: any = {
            body: JSON.stringify({
                mobile_no: "+918328465116"
            })
        }
        //act
        const result = await forgotUsername(event)
        //assert
        expect(result.statusCode).toBe(200)
        expect(JSON.parse(result.body).message).toBe("if the given mobile number is registered then you will shortly recieve your username")
        const calls = snsMock.commandCalls(
            PublishCommand
        );
        expect(calls.length).toBe(1);
    })
    it("should publish correct SNS payload", async () => {
        (call as jest.Mock).mockResolvedValue({
            Items: [
                {
                    username: "sunil123"
                }
            ]
        })
        snsMock.on(PublishCommand).resolves({
            MessageId: "123"
        })
        //arrange
        const event:any = {
            body: JSON.stringify({
                mobile_no: "+918328465116"
            })
        }
        //act 
        const result = await forgotUsername(event);
        //assert
        const calls = snsMock.commandCalls(
            PublishCommand
        )
        expect(calls[0].args[0].input)
            .toMatchObject({
                PhoneNumber: "+918328465116"
            })
    })
    it("should handle SNS error", async () => {
        (call as jest.Mock).mockResolvedValue({
            Items:{
                username: "sunil123"
            }
        })
        snsMock.on(PublishCommand)
            .rejects(new Error("SNS failed"));

        //arrange 
        const event: any = {
            body: JSON.stringify({
                mobile_no: "+918328465116"
            })
        }
        //act
        const result = await forgotUsername(event)
        //assert
        expect(result.statusCode).toBe(500)
        expect(log.error).toHaveBeenCalled()
    })
    it("should handle database errors", async () => {
        (call as jest.Mock).mockRejectedValue(
            new Error("DB failed")
        );
        //arrange 
        const event:any = {
            body: JSON.stringify({
                mobile_no: "+918328465116"
            })
        }
        //act 
        const result = await forgotUsername(event)
        //assert
        expect(result.statusCode).toBe(500)
        expect(log.error).toHaveBeenCalled()
    })
})