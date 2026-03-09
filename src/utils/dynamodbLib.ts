import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb"
import AWSXRay from "aws-xray-sdk-core"

const client = AWSXRay.captureAWSv3Client(
    new DynamoDBClient({})
)
const docClient = DynamoDBDocumentClient.from(client)

const commandMap: Record<string, any> = {
    scan: ScanCommand,
    put: PutCommand,
    update: UpdateCommand,
    delete: DeleteCommand,
    query: QueryCommand,
    get: GetCommand
}
type DynamoDBParams = any;

export const call = async (action: string, params: DynamoDBParams): Promise<any> => {
    const command = commandMap[action]

    if (!command) {
        throw new Error(`Invalid DynamoDB action: ${action}`)
    }
    const cmd = new command(params)
    return await docClient.send(cmd)
}


