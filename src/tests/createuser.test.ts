process.env.NOTIFICATION_QUEUE_URL = "test-queue";
process.env.USERS_TABLE = "test-users-table";

const sqsSendMock = jest.fn().mockResolvedValue({});
const snsSendMock = jest.fn().mockResolvedValue({});

jest.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: jest.fn(() => ({ send: sqsSendMock })),
  SendMessageCommand: jest.fn()
}));

jest.mock("@aws-sdk/client-sns", () => ({
  SNSClient: jest.fn(() => ({ send: snsSendMock })),
  PublishCommand: jest.fn()
}));

jest.mock("uuid", () => ({ v4: () => "test-uuid" }));

// Add mock for Cognito
const cognitoSendMock = jest.fn().mockResolvedValue({});
jest.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: jest.fn(() => ({ send: cognitoSendMock })),
  AdminCreateUserCommand: jest.fn(),
  AdminSetUserPasswordCommand: jest.fn()
}));

// Mock AWS X-Ray to avoid issues
jest.mock("aws-xray-sdk-core", () => ({
  captureAWSv3Client: jest.fn((client) => client),
  captureHTTPsGlobal: jest.fn()
}));

import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { createuser } from "../handler/createUsers";
import { log, setAwsRequestIdForLogger } from "../utils/logger";
import { captureHTTPsGlobal } from "aws-xray-sdk-core";

const ddbMock = mockClient(DynamoDBDocumentClient);

describe.only('test cases', () => {
  beforeEach(() => {
    ddbMock.reset();
    sqsSendMock.mockClear();
    snsSendMock.mockClear();
    cognitoSendMock.mockClear();
  });

  describe.only('createuser lambda function', () => {
    //test case for missing fields
    it('should return 400 if the required fields are missing', async () => {
      //arrange
      const event: any = {
        body: JSON.stringify({ email: "sunil@gmail.com" })

      }
      //act
      const res = await createuser(event)
      //assert
      expect(res.statusCode).toBe(400)
      const response = JSON.parse(res.body)
      expect(response.message).toBe("name, email, mobile_no and password are required");

    })
    //test case for invalid email format
    it('should return 400 if email format is invalid', async () => {
      //arrange
      const event: any = {
        body: JSON.stringify({
          name: "sunil",
          email: "invalid-email",
          mobile_no: "+918328465116",
          password: "password123"
        })
      }
      //act
      const res = await createuser(event)

      //assert
      expect(res.statusCode).toBe(400)
      const response = JSON.parse(res.body)
      expect(response.message).toBe("Invalid email")
    })
    //test case for invalid mobile_no
    it('should return 400 if mobile_no is invalid', async () => {
      //arrange
      const event: any = {
        body: JSON.stringify({
          name: 'sunil',
          email: 'sunil316@gmail.com',
          mobile_no: "+2378698056591",
          password: "password123"
        })
      }
      //act
      const res = await createuser(event)
      //assert
      expect(res.statusCode).toBe(400)
      const response = JSON.parse(res.body)
      expect(response.message).toBe('Invalid mobile number')
    })
    //test case for checking existing email
    it('should return 400 if email already exists', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [{ email: "sunil@test.com" }]
      });
      //arrange
      const event: any = {
        body: JSON.stringify({
          name: "sunil",
          email: "sunil@gmail.com",
          mobile_no: "+918328465116",
          password: "password123"
        })
      }
      //act
      const res = await createuser(event)
      //assert
      expect(res.statusCode).toBe(400)
      const response = JSON.parse(res.body)
      expect(response.message).toBe('Email already exists')
    })
    //test case for checking existing mobile_no
    it('should return 400 if mobile_no already exists', async () => {
      ddbMock
        .on(QueryCommand)
        .resolvesOnce({ Items: [] }) // email check
        .resolvesOnce({ Items: [{ mobile_no: "+919999999999" }] });

      //arrange
      const event: any = {
        body: JSON.stringify({
          name: "sunil",
          email: "sunil@gmail.com",
          mobile_no: "+919999999999",
          password: "password123"
        })
      }
      //act
      const res = await createuser(event)

      //assert
      expect(res.statusCode).toBe(400)
      const response = JSON.parse(res.body)
      expect(response.message).toBe('Mobile already exists')
    })
    //test case for creating the user and mocking 
    it('return 201 if the user is created', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });
      ddbMock.on(PutCommand).resolves({})
      // Mock Cognito responses
      cognitoSendMock.mockResolvedValueOnce({
        User: {
          Attributes: [{ Name: "sub", Value: "test-sub" }]
        }
      }); // AdminCreateUserCommand
      cognitoSendMock.mockResolvedValueOnce({}); // AdminSetUserPasswordCommand
      //arrange
      const event: any = {
        body: JSON.stringify({ name: "naveen", email: "naveen@gmail.com", mobile_no: "+918328465116", password: "password123" })
      }
      //act 
      const result = await createuser(event)
      //assert
      expect(result.statusCode).toBe(201)
      const response = JSON.parse(result.body)
      expect(response.message).toBe('User created successfully')
    })

    it('should return 500 if it throws error', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })
      ddbMock.on(PutCommand).rejects(new Error('DB error'))
      // Mock Cognito to succeed so we reach DB error
      cognitoSendMock.mockResolvedValueOnce({
        User: {
          Attributes: [{ Name: "sub", Value: "test-sub" }]
        }
      });
      cognitoSendMock.mockResolvedValueOnce({});
      //arrange
      const event: any = {
        body: JSON.stringify({ name: "naveen", email: "naveen@gmail.com", mobile_no: "+918328465116", password: "password123" })
      }

      //act 
      const result = await createuser(event)
      //assert
      expect(result.statusCode).toBe(500)
      const response = JSON.parse(result.body)
      expect(response.message).toBe("Internal server error")
    })
    it("should trigger both SQS and SNS when QUEUE_URL and mobile_no are present", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });
      ddbMock.on(PutCommand).resolves({});
      // Mock Cognito
      cognitoSendMock.mockResolvedValueOnce({
        User: {
          Attributes: [{ Name: "sub", Value: "test-sub" }]
        }
      });
      cognitoSendMock.mockResolvedValueOnce({});

      process.env.NOTIFICATION_QUEUE_URL = "test-queue";

      const event: any = {
        body: JSON.stringify({ name: "sunil", email: "sunil@gmail.com", mobile_no: "+919999999999", password: "password123" })
      };

      const result = await createuser(event);
      console.log("result",result)
      expect(result.statusCode).toBe(201);
      const response = JSON.parse(result.body);
      expect(response.message).toBe("User created successfully");

      //Confirm triggers were called
      expect(sqsSendMock).toHaveBeenCalled();
      expect(snsSendMock).toHaveBeenCalled();
    });
    it("should log error if SQS send fails", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });
      ddbMock.on(PutCommand).resolves({});
      // Mock Cognito to succeed
      cognitoSendMock.mockResolvedValueOnce({
        User: {
          Attributes: [{ Name: "sub", Value: "test-sub" }]
        }
      });
      cognitoSendMock.mockResolvedValueOnce({});

      // Make SQS send fail
      sqsSendMock.mockRejectedValueOnce(new Error("SQS failed"));

      process.env.NOTIFICATION_QUEUE_URL = "test-queue";

      // Spy on log.error
      const logSpy = jest.spyOn(log, "error").mockImplementation(() => { }); // mock implementation to suppress actual logging

      const event: any = {
        body: JSON.stringify({ name: "sunil", email: "sunil@gmail.com", mobile_no: "+919999999999", password: "password123" })
      };

      await createuser(event);

      // Check that log.error was called for SQS
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send SQS message")
      );

      // Restore spy
      logSpy.mockRestore();
    });
    it("should log error if SNS publish fails", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });
      ddbMock.on(PutCommand).resolves({});
      // Mock Cognito to succeed
      cognitoSendMock.mockResolvedValueOnce({
        User: {
          Attributes: [{ Name: "sub", Value: "test-sub" }]
        }
      });
      cognitoSendMock.mockResolvedValueOnce({});

      // Make SNS send fail
      snsSendMock.mockRejectedValueOnce(new Error("SNS failed"));

      process.env.NOTIFICATION_QUEUE_URL = "test-queue";

      // Spy on log.error
      const logSpy = jest.spyOn(log, "error").mockImplementation(() => { });

      const event: any = {
        body: JSON.stringify({ name: "sunil", email: "sunil@gmail.com", mobile_no: "+919999999999", password: "password123" })
      };

      await createuser(event);

      // Check that log.error was called for SNS
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("failed to send sns message")
      );

      logSpy.mockRestore();
    });
  });
});

describe("Logger Utility - setAwsRequestIdForLogger", () => {
  it("should set child logger with proper context", () => {
    // Mock a fake event and context
    const event: any = {
      headers: {
        "X-Amzn-Trace-Id": "trace-id-123"
      },
      logSource: "mobile-app"
    };

    const context: any = {
      awsRequestId: "aws-request-456",
      logGroupName: "log-group",
      logStreamName: "log-stream"
    };

    // Call the function
    setAwsRequestIdForLogger(event, context);

    // Check that log object exists and has child function
    expect(log).toBeDefined();
    expect(typeof log.child).toBe("function"); // since child returns a logger
  });

  it("should handle missing headers and context", () => {
    const event: any = {};
    const context: any = {};

    setAwsRequestIdForLogger(event, context);

    expect(log).toBeDefined();
    expect(typeof log.child).toBe("function");
  });
});