import AWSXRay from 'aws-xray-sdk-core';
import https from 'https';
AWSXRay.captureHTTPsGlobal(https);

export {}
