
const fs = require('fs');
exports.handler = function(context, event, callback) {
   //The Asset must be marked as Private
   try {
     const response  = new Twilio.twiml.VoiceResponse();
     const assets = Runtime.getAssets();
     let assetPath = event.Flow || "/DefaultCallFlow";
     let state = event.State || "Execute";
     console.log("assetPath " + assetPath);
     if(assets[assetPath] && assets[assetPath].path){
          const assetRawText = fs.readFileSync(assets[assetPath].path, 'utf8');
          const assetData = JSON.parse(assetRawText)
        switch(state){
          case "Execute":
            if(assetData.greetingSay) {
              response.say(assetData.greetingSay);
            }
            if(assetData.greetingPlay) {
              response.play(assetData.greetingPlay);
            }
            response.redirect("/ExecuteFlow?Flow=" + encodeURIComponent(Flow) +"&State=Dial&Dial=1&Number=1");
            break;
          case "Dial":
            let Dial = event.Dial;
            let Number = event.Number;
            if(Dial && Number && assetData.dial && assetData.dial["dial" + Dial]){
              let dialData = assetData.dial["dial" + Dial];
              
              if(dialData.numbers){
               let numbers = dialData.numbers.split(/,\s?/);
               
               let dialOptions = {
                 timeout: dialData.timeout || 5,
                 timeLimit: dialData.timeLimit || 3600,
                 trim: dialData.trim || "trim-silence" 
               };
               if(dialData.record){
                 dialOptions.record = dialData.recordType || "record-from-answer-dual";
                 dialOptions.recordingStatusCallback = "/ExecuteFlow?Flow=" + encodeURIComponent(Flow) +"&State=DialRecordStatus&Dial=1&Number=1"
               }
               const dial = response.dial(dialOptions);
               
               let numberOptions = {};
                 //if there was a whisper
                 if(dialData.url){
                   numberOptions.url = "/ExecuteFlow?Flow=" + encodeURIComponent(Flow) +"&State=DialUrl&Dial="+ Dial + "&Number=" + Number;
                   numberOptions.method = "POST";
                 }
                 numberOptions.statusCallbackEvent = "answered, completed";
                 numberOptions.statusCallback = "/ExecuteFlow?Flow=" + encodeURIComponent(Flow) +"&State=DialStatus&Dial="+ Dial + "&Number=" + Number;
                 numberOptions.statusCallbackMethod = 'POST';
               
               if(dialData.simulring){
                  numbers.forEach((number) => {
                    if(number.startsWith("sip:")){
                      dial.sip(numberOptions, number);
                    }else{
                      dial.number(numberOptions, number);     
                    }
                  });
               }else{
                 let dialNumber = numbers[Number-1];
                 
                 if(number.startsWith("sip:")){
                    dial.sip(numberOptions, dialNumber);
                  }else{
                    dial.number(numberOptions, dialNumber);     
                  }
                 
               }
              }
              
            }else{
              if(assetData.voicemail.enabled){
                
              }else{
                response.say("Goodbye");
                response.hangup();
              }
            }
            break;
          case "Record":
            let timeout = 10;
            let transcribe = false;
            let playBeep = false;
            let maxLength = 300;
            let trim = "trim-silence";
            
            let transcribeCallback = null;
            
            if(assetData.voicemail.timeout){
              timeout = assetData;
            }
            
            if(assetData.voicemail.transcribe){
              transcribe = assetData.voicemail.transcribe;
              transcribeCallback = "/ExecuteFlow?Flow=" + encodeURIComponent(Flow) +"&State=RecordTranscribe";
            }
            
            if(assetData.voicemail.playBeep){
              playBeep = assetData.voicemail.playBeep;
            }
            
            if(assetData.voicemail.maxLength){
                maxLength = assetData.voicemail.maxLength;
            }
            
            if(assetData.voicemail.trim){
              trim = assetData.voicemail.trim;
            }
            
            response.record({
              action: "/RecordAction",
              timeout: timeout,
              transcribe: transcribe,
              maxLength: maxLength,
              recordingStatusCallback: "/ExecuteFlow?Flow=State=RecordStatus",
              recordingStatusCallbackEvent: "completed, absent",
              trim: trim
          })
            break;
          case "DialStatus":
            break;
          case "RecordStatus":
            break;
        }
     }
     else{
       response.say("Call Flow is Missing Unable to continue. " + assetPath);
       response.say("Goodbye.");
       response.hangup();    
     }
      
      return callback(null, response);
      
  } catch (error) {
    // In the event of an error, return a 500 error and the error message
    console.error(error);
    return callback(error);
  }
  
};