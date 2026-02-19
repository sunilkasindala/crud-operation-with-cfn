import {log} from "../utils/logger"

export const verifyAuth = async(event:any) => {
    log.info('verify auth is triggered')

    const userOtp = event.request.challengeAnswer;

    const challengeOtp = event.request.privateChallengeParameters.answer

    if(userOtp === challengeOtp){
        event.response.answerCorrect = true
    }else{
        event.response.answerCorrect = false 
    }
    return event;
}
