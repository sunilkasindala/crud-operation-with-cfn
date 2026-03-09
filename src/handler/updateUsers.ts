import "../utils/tracing"
import {APIGatewayProxyEvent,APIGatewayProxyResult} from "aws-lambda"
import {call} from "../utils/dynamodbLib"
import {log,getSegment} from "../utils/logger"
import { AppConfig } from "../utils/appConfig";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { SNSClient,PublishCommand } from "@aws-sdk/client-sns";

const sqs = new SQSClient({ region: process.env.AWS_REGION });
const QUEUE_URL = process.env.NOTIFICATION_QUEUE_URL
const sns = new SNSClient({ region:process.env.AWS_REGION });

export const updateuser = async(event:APIGatewayProxyEvent):Promise<APIGatewayProxyResult> => {
    const segment = getSegment();
    const subsegment = segment?.addNewSubsegment(`query SES template`);

    try{
        const body = event.body ?JSON.parse(event.body) :{};
        const {userId, name , email , mobile_no} = body;

        
        log.info("parsed from body userId")
        log.info("parsed from body name")
        log.info("parsed from body email")
        log.info("parsed from body mobile_no")

        const params = {
            TableName:AppConfig.USER_TABLE,
            Key:{userId},
            UpdateExpression:"SET #name = :name , #email = :email",
            ExpressionAttributeNames:{
                "#name" : "name",
                "#email" : "email"
            },
            ExpressionAttributeValues:{
                ":name" : name,
                ":email" : email
            },
            ReturnValues:"ALL_NEW"
        }

        const response = await call('update',params)
        log.info("user is updated successfully"+JSON.stringify(response))
        
        if(QUEUE_URL)  await triggerForEmailSend(body)
        
        log.info(`mobile_no is present (${mobile_no}), triggering SNS SMS`);
        if(mobile_no) await triggerForSmsSend(body)
        log.info("sns message is successfully sent ")
        
        subsegment?.close();
        return {
            statusCode : 200,
            body:JSON.stringify({message:"user details updated successfully"})
        }

    }catch(err){
        log.error("cannot update the user"+JSON.stringify(err))
        return {
            statusCode : 500,
            body:JSON.stringify({message:"internal server error"})
        }
    }
}

const triggerForEmailSend = async(body:any) =>{
      const message = {
                type: "USER_UPDATED",
                userId: body.userId,
                name: body.name,
                email: body.email
            }
            try {
                await sqs.send(
                    new SendMessageCommand({
                        QueueUrl: QUEUE_URL,
                        MessageBody:JSON.stringify(message)
                    })
                )
            log.info("Notification message sent to SQS")
            }catch(err){
                log.error("Failed to send SQS message: " + JSON.stringify(err));
            }
}

const triggerForSmsSend = async(body:any) => {
    const params = {
        Message:`Hi ${body.name} successfully updated the user`,
        PhoneNumber: body.mobile_no
    }
    try {
        const response = await sns.send(
            new PublishCommand(params)
        )
        log.info("sns publish respose"+JSON.stringify(response))
    }catch(err){
        log.error("failed to send sns message" + JSON.stringify(err))
    }
}
