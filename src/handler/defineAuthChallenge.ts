import { log } from "../utils/logger"

export const authChallenge = async (event:any) => {
    try{
    log.info('define auth challege trigger')

    const session = event.request.session || []

    log.info("session"+JSON.stringify(session))
    //if user is attempting more than 3 times then it fails authentication 
    if(session.length >= 3 &&
        session[session.length -1].challengeResult === false
    ){
        event.response.issueTokens = false;
        event.response.failAuthentication = true;
    }
    //if last challenge was successfull
    else if(session.length >0 &&
        session[session.length - 1].challengeResult === true
    ){
        event.response.issueTokens = true;
        event.response.failAuthentication = false;
    }
    //first login or retry
    else{
        event.response.issueTokens = false;
        event.response.failAuthentication = false;
        event.response.challengeName = "CUSTOM_CHALLENGE"
    }
    return event;

    }catch (err) {
        log.error("Error in CreateAuthChallenge"+JSON.stringify(err));
        throw err;
    }
}

