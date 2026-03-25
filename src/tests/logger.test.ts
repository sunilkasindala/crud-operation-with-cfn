import { log, setAwsRequestIdForLogger } from "../utils/logger";
import pino from 'pino';

// Mock pino to control the logger
jest.mock('pino', () => {
  const mockChild = jest.fn();
  const mockLogger = {
    child: mockChild,
    info: jest.fn(),
    error: jest.fn(),
  };
  mockChild.mockReturnValue(mockLogger); // child returns another logger
  return jest.fn(() => mockLogger);
});

describe("Logger Utility - setAwsRequestIdForLogger", () => {
  let mockChild: jest.MockedFunction<any>;

  beforeEach(() => {
    // Reset the mock
    mockChild = (pino as jest.MockedFunction<typeof pino>)().child;
    mockChild.mockClear();
  });

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

    // Check that parentLogger.child was called with the expected object
    expect(mockChild).toHaveBeenCalledWith({
      AmznTraceId: "trace-id-123",
      awsRequestId: "aws-request-456",
      logSource: "mobile-app",
      logGroupName: "log-group",
      logStreamName: "log-stream",
      headers: { "X-Amzn-Trace-Id": "trace-id-123" }
    });

    // Check that log is now the child logger
    expect(log).toBeDefined();
    expect(typeof log.child).toBe("function");
  });

  it("should handle missing headers and context", () => {
    const event: any = {};
    const context: any = {};

    setAwsRequestIdForLogger(event, context);

    // Check that parentLogger.child was called with nulls/defaults
    expect(mockChild).toHaveBeenCalledWith({
      AmznTraceId: null,
      awsRequestId: null,
      logSource: "web", // default
      logGroupName: null,
      logStreamName: null,
      headers: undefined
    });

    expect(log).toBeDefined();
    expect(typeof log.child).toBe("function");
  });
});
