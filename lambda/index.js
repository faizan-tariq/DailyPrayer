const Alexa = require('ask-sdk-core');
const moment = require('moment-timezone');
const requiredPermissions = ['alexa::alerts:reminders:skill:readwrite'];
const axios = require('axios');

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Take care, Allah Haafiz';
        return handlerInput.responseBuilder
            .speak(speakOutput).addAudioPlayerStopDirective()
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say setup or listen! If you have not yet schedule prayer notifications for today then say setup or if you want to listen Azaan then say listen. How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const pauseIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.PauseIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You cannot pause Azaan. Say Alexa, cancel to quit';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say setup or listen. Which would you like to try?';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const ListenRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(handlerInput.requestEnvelope) === 'listenIntent';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .addAudioPlayerPlayDirective('REPLACE_ALL', 'https://www.islamcan.com/audio/adhan/azan12.mp3', 0, 0, null, null)
            .getResponse();
    }
};


const SetupRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(handlerInput.requestEnvelope) === 'setupIntent';
    },
    async handle(handlerInput) {
        const {responseBuilder, serviceClientFactory, requestEnvelope} = handlerInput;
        const reminderApiClient = serviceClientFactory.getReminderManagementServiceClient();
        const { permissions } = requestEnvelope.context.System.user;
    
        if(!permissions) {
            return responseBuilder
            .speak('Please go to Alexa mobile app to grant reminders permission. This will allow me to create and edit reminders for daily prayer notifications.')
            .withAskForPermissionsConsentCard(requiredPermissions)
            .getResponse();
        } else {
            let {deviceId} = requestEnvelope.context.System.device;
            const upsServiceClient = serviceClientFactory.getUpsServiceClient();
            const usertimeZone = await upsServiceClient.getSystemTimeZone(deviceId);
            var url = "http://api.aladhan.com/v1/timingsByAddress?address=72712";

            var timings = [];            
            const response = await axios.get(url);
            const body = response.data.data.timings;
            timings.push(body.Fajr);
            timings.push(body.Dhuhr);
            timings.push(body.Asr);
            timings.push(body.Maghrib);
            timings.push(body.Isha);

            const currentDataTime = moment().tz(usertimeZone);
            for (var index in timings ) {
                const hour = timings[index].split(':')[0];
                const minute = timings[index].split(':')[1];
                const reminderRequest = {
                  requestTime: currentDataTime.format('YYYY-MM-DDTHH:mm:ss'),
                  trigger: {
                        type: "SCHEDULED_ABSOLUTE",
                        scheduledTime: currentDataTime.set({
                            hour: hour,
                            minute: minute,
                            second: '00'
                        }).format('YYYY-MM-DDTHH:mm:ss'),
                        timeZoneId : usertimeZone
                  },
                  alertInfo: {
                        spokenInfo: {
                            content: [{
                                locale: "en-US", 
                                text: "its prayer time."
                            }]
                        }
                    },
                    pushNotification: {                            
                         status: "ENABLED"
                    }
                }
                try {
                   const {alertToken} = await reminderApiClient.createReminder(reminderRequest);
                } catch(err) {
                    console.error(err);
                }
            }
            
            return responseBuilder
                .speak('Asalam-oo-alaikum! You will hear Az-aan daily 5 times a day according to Bentonville timezone.')
                .getResponse();
        }
    }
};


exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler, SetupRequestHandler, ListenRequestHandler, HelpIntentHandler, CancelAndStopIntentHandler, pauseIntentHandler
    )
    .withApiClient(new Alexa.DefaultApiClient())
    .lambda();
