import "aws-sdk-client-mock-jest";
import { log } from "../utils/logger";
import { handler } from "../handler/notification";
import { mockClient } from "aws-sdk-client-mock";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const sesMock = mockClient(SESClient);

jest.mock("../utils/logger", () => ({
    log: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
}));

const getSQSEvent = (body: any) => ({
    Records: [
        {
            body: JSON.stringify(body)
        }
    ]
});

describe("notification test cases", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sesMock.reset();   //
    });

    it("should send email for USER_CREATED", async () => {
        sesMock.on(SendEmailCommand).resolves({
            MessageId: "123"
        });

        const event = getSQSEvent({
            type: "USER_CREATED",
            email: "test@mail.com",
            name: "Sunil"
        });

        await handler(event as any, {} as any, () => { });

        expect(sesMock).toHaveReceivedCommand(SendEmailCommand);

        expect(sesMock).toHaveReceivedCommandWith(SendEmailCommand, {
            Destination: {
                ToAddresses: ["test@mail.com"]
            }
        });
    });
    it("should send email for USER_UPDATED", async () => {
        sesMock.on(SendEmailCommand).resolves({
            MessageId: "123"
        })
        const event = getSQSEvent({
            type: "USER_UPDATED",
            email: "test@gmail.com",
            name: "sunil"
        })

        await handler(event as any, {} as any, () => { });

        expect(sesMock).toHaveReceivedCommand(SendEmailCommand)
    })
    it("should send email for DOCUMENT_REMINDER", async () => {
        sesMock.on(SendEmailCommand).resolves({
            MessageId: "123"
        })
        const event = getSQSEvent({
            type: "DOCUMENT_REMINDER",
            email: "test@gmail.com",
            name: "sunil"
        })

        await handler(event as any, {} as any, () => { })

        expect(sesMock).toHaveReceivedCommand(SendEmailCommand)
    })
    it("should log warning for unknown type", async () => {
        const event = getSQSEvent({
            type: "UNKNOWN_TYPE",
            email: "test@mail.com"
        });

        await handler(event as any, {} as any, () => { });

        expect(log.warn).toHaveBeenCalledWith(
            { type: "UNKNOWN_TYPE" },
            "Unknown message type received from SQS"
        );
    });
    it("should log error and throw when JSON parsing fails", async () => {
        const event = {
            Records: [
                {
                    body: "invalid-json"
                }
            ]
        };

        await expect(handler(event as any, {} as any, () => { }))
            .rejects.toThrow();

        expect(log.error).toHaveBeenCalledWith(
            expect.objectContaining({ err: expect.anything() }),
            "Failed to process SQS message"
        );
    });
});