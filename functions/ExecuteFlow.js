const fs = require('fs');
exports.handler = function(context, event, callback) {
   //The Asset must be marked as Private
   try {
     const response  = new Twilio.twiml.VoiceResponse();
     const assets = Runtime.getAssets();
     let flow = event.Flow || "/DefaultCallFlow";
     let state = event.State || "Execute";
     //console.log("flow " + flow, "state " + state, "event", JSON.stringify(event));
     if(assets[flow] && assets[flow].path){
        const assetRawText = fs.readFileSync(assets[flow].path, 'utf8');
        try{
          const assetData = JSON.parse(assetRawText);
        }catch(ex){
          console.error("Error parsing asset json", ex);
          throw new Error('Error parsing asset json ' + flow + ", parse error: " + ex.message);
        }
        switch(state){
          case "Execute":
            if(assetData.greetingSay) {
              response.say(assetData.greetingSay);
            }
            if(assetData.greetingPlay) {
              response.play(assetData.greetingPlay);
            }
            response.redirect("/ExecuteFlow?Flow=" + encodeURIComponent(flow) +"&State=Dial&Dial=1&Number=1");
            return callback(null, response);
            break;
          case "Dial":
            let dial = event.Dial;
            let number = event.Number;
            if(dial && number && assetData.dial && assetData.dial["dial" + dial]){
              let dialData = assetData.dial["dial" + dial];
              
              if(dialData.numbers){
               let numbers = dialData.numbers.split(/,\s?/);
               
               let dialOptions = {
                 action: "/ExecuteFlow?Flow=" + encodeURIComponent(flow) +"&State=DialAction&Dial=" + dial + "&Number=" + number,
                 //method:"GET",
                 timeout: dialData.timeout || 5,
                 timeLimit: dialData.timeLimit || 3600,
                 trim: dialData.trim || "trim-silence" 
               };
               if(dialData.callerIdUseCalled){
                 dialOptions.callerId = event.To;
               }
               if(dialData.record){
                 dialOptions.record = dialData.recordType || "record-from-answer-dual";
                 //dialOptions.recordingStatusCallback = "/ExecuteFlow?Flow=" + encodeURIComponent(flow) +"&State=DialRecordStatus&Dial=1&Number=1";
               }
               const responseDial = response.dial(dialOptions);
               
               let numberOptions = {};
                 //if there was a whisper
                 if(dialData.url){
                   numberOptions.url = "/ExecuteFlow?Flow=" + encodeURIComponent(flow) +"&State=DialUrl&Dial="+ dial + "&Number=" + number;
                   numberOptions.method = "POST";
                 }
                                
               if(dialData.simulring){
                  numbers.forEach((dialNumber) => {
                    if(dialNumber.startsWith("sip:")){
                      responseDial.sip(numberOptions, dialNumber);
                    }else{
                      responseDial.number(numberOptions, dialNumber);     
                    }
                  });
               }else{
                 let dialNumber = numbers[number-1];
                 
                 if(dialNumber.startsWith("sip:")){
                    responseDial.sip(numberOptions, dialNumber);
                  }else{
                    responseDial.number(numberOptions, dialNumber);     
                  }
                 
               }
              }
              
            }else{
              if(assetData.voicemail && assetData.voicemail.enabled){
                let redirUrl = "/ExecuteFlow?Flow=" + encodeURIComponent(flow) +"&State=Record";
                console.log('Url' + redirUrl);
                response.redirect(redirUrl);
              }else{
                response.say("Goodbye");
                response.hangup();
              }
            }
            console.log(event, response);
            return callback(null, response);
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
              transcribeCallback = "/ExecuteFlow?Flow=" + encodeURIComponent(flow) +"&State=RecordTranscribe";
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
            
            if(assetData.voicemail.say){
              response.say(assetData.voicemail.say);
            }
            if(assetData.voicemail.play){
              response.play(assetData.voicemail.play);
            }
            response.record({
              action: "/ExecuteFlow?Flow="+ encodeURIComponent(flow) +"&State=RecordAction",
              timeout: timeout,
              transcribe: transcribe,
              maxLength: maxLength,
              recordingStatusCallback: "/ExecuteFlow?Flow="+ encodeURIComponent(flow) +"&State=RecordStatus",
              recordingStatusCallbackEvent: "completed, absent",
              trim: trim
            })
            return callback(null, response);
            break;
          case "DialAction":
            try {

              if(event.DialCallStatus === "completed"){
                let recordTextNotify = false;
                let recordTextNotifyNumbers = context.NOTIFY_SMS_TO_DEFAULT;
                let dial = parseInt(event.Dial,10);
                let number = parseInt(event.Number,10);
                if(dial && number && assetData.dial && assetData.dial["dial" + dial]){
                  let dialData = assetData.dial["dial" + dial];
                  if (dialData.recordTextNotify){
                    recordTextNotify = true;
                  }
                  if (dialData.smsNotifyNumbers){
                    recordTextNotifyNumbers = dialData.smsNotifyNumbers;
                  }
                }
                if(recordTextNotify){
                  
                  let dialRecordNotifyToNumbers = recordTextNotifyNumbers.split(/,\s?/);
                  
                  
                  const dialRecordNotifyFrom =  context.NOTIFY_SMS_FROM;
                  const client = process.env.getTwilioClient(); 
                  const getCalledNumberPromise = new Promise((resolve, reject) => {
                    
                    if(dialData.smsNotifyCalled){
                      client.calls(event.DialCallSid)
                      .fetch()
                      .then(
                        function(callLog){
                          console.log("Dial Action Call Log Call To "+  callLog.to + " " + event.DialCallSid);
                          resolve(callLog.to)
                        
                        },
                        function(){
                          console.log("Error Retriving Call Log " + event.DialCallSid);
                          resolve(null);
                        }
                      );
                    }else{
                      resolve(null);
                    } 
                  } );
                  
                  
                  getCalledNumberPromise().then(
                    function(dialedNumber){
                      let notifyBody = "Call Recorded From " + event.From + " To " + event.To + " duration " + event.DialCallDuration + " Callid " + event.DialCallSid + " " + event.RecordingUrl;  
                      
                      var sendDialActionTexts = [];
                      
                      if(dialedNumber){
                        dialRecordNotifyToNumbers.push(dialedNumber);
                      }
                      
                      dialRecordNotifyToNumbers.forEach((notifyToNumber) => {
                        console.log('DialAction Text Message Sending to ' + notifyToNumber);
                        sendDialActionTexts.push(client.messages.create({from: dialRecordNotifyFrom, body: notifyBody, to: notifyToNumber}));
                      }); 
                      
                      
                      Promise.all(sendDialActionTexts)
                      .then(
                        function(responses){
                          responses.forEach((message) =>{
                            console.log('Text Message Sent ' + message.sid);  
                          })
                          
                          response.say("Goodbye");
                          response.hangup();   
                          return callback(null, response);
                        },
                        function(error){
                          console.error('Error Text Message failed ' + error);
                          response.say("Goodbye");
                          response.hangup();   
                          return callback(null, response);
                        }
                      ); 
                    },
                    function(error){
                      console.error('Error retriving Call Log ' + error);
                      response.say("Goodbye");
                      response.hangup();   
                      return callback(null, response);
                    }
                    
                    
                  )
                  
                }else{
                  console.log('RecordTextNotify = false');
                  response.say("Goodbye");
                  response.hangup();   
                  return callback(null, response);
                }   
                  
                
              }else{  //else CallStatus "Completed"
                let dial = parseInt(event.Dial,10);
                let number = parseInt(event.Number,10);
                if(dial && number && assetData.dial && assetData.dial["dial" + dial]){
                  let dialData = assetData.dial["dial" + dial];
                  if(dialData.numbers){
                    let numbers = dialData.numbers.split(/,\s?/);
                    if(dialData.simulring || numbers.length >= number){
                      //check to see if the next dialData has numbers if so redirect to that Dial Data
                      dial = dial + 1;
                      if(assetData.dial && assetData.dial["dial" + dial]){
                        let redirUrl = "/ExecuteFlow?Flow=" + encodeURIComponent(flow) +"&State=Dial&Dial=" + dial + "&Number=1";
                        console.log('Url' + redirUrl);
                        if(assetData.huntSay){
                          response.say(assetData.huntSay);  
                        }
                        if(assetData.huntPlay){
                          response.play(assetData.huntPlay);  
                        }
                        response.redirect(redirUrl);
                        return callback(null, response); 
                      }
                      
                    }else{
                      number++;
                      if(numbers[number]){
                        let redirUrl = "/ExecuteFlow?Flow=" + encodeURIComponent(flow) +"&State=Dial&Dial=" + dial + "&Number=" + number;
                        console.log('Url' + redirUrl);
                        if(assetData.huntSay){
                          response.say(assetData.huntSay);  
                        }
                        if(assetData.huntPlay){
                          response.play(assetData.huntPlay);  
                        }
                        response.redirect(redirUrl);
                        return callback(null, response); 
                      }
                    }
                    if(assetData.voicemail && assetData.voicemail.enabled){
                      let redirUrl = "/ExecuteFlow?Flow=" + encodeURIComponent(flow) +"&State=Record";
                      console.log('Url' + redirUrl);
                      response.redirect(redirUrl);
                      return callback(null, response); 
                    }else{
                      response.say("Goodbye");
                      response.hangup();
                      return callback(null, response); 
                    }
                  }
                }
              }
            } catch (error) {
              // In the event of an error, return a 500 error and the error message
              console.error(error);
              return callback(error);
            }   
            break;
          case "RecordAction":
            //Send Hangup if we have finished Recording 
            response.say("Goodbye");
            response.hangup();
            return callback(null, response);
            break;
          case "RecordStatus":
            try {
              const voicemailData = assetData.voicemail;
              const VmSmsNotifyFrom = context.NOTIFY_SMS_FROM;
              const VmSmsNotifyTo = voicemailData.smsNotifyNumbers;
              if(voicemailData.smsNotify){
                let voicemailNotifyToNumbers = VmSmsNotifyTo.split(/,\s?/);
                var sendVoicemailTexts = [];
                const client = context.getTwilioClient(); 
                let notifyBody = "Call Recorded From " + event.From + " To " + event.To + " duration " + event.RecordingDuration + " " + event.RecordingUrl;  
                
                voicemailNotifyToNumbers.forEach((notifyToNumber) => {
                  sendVoicemailTexts.push( client.messages.create({from: VmSmsNotifyFrom, body: notifyBody, to: VmSmsNotifyTo}));
                })

                Promise.all(sendVoicemailTexts).then(
                  function(message){
                    console.log('Text Message Sent ' + message.sid);
                    response.say("Goodbye.");
                    response.hangup();   
                    return callback(null, response);
                  },
                  function(error){
                    console.error('Error Text Message failed ' + error);
                    response.say("Goodbye.");
                    response.hangup();   
                    return callback(null, response);
                    //return callback(error);
                  }
                );

              }
            } catch (error) {
              // In the event of an error, return a 500 error and the error message
              console.error(error);
              return callback(error);
            }
            break;
          default:
            console.error('Error Invalid State', state);
            response.say("Invalid State"); 
            response.hangup(); 
            return callback(null, response);
            break;
        }
     }
     else{
       response.say("Call Flow is Missing Unable to continue. " + flow);
       response.say("Goodbye");
       response.hangup();  
       return callback(null, response);  
     }
      
      
      
  } catch (error) {
    // In the event of an error, return a 500 error and the error message
    console.error(error);
    return callback(error);
  }
  
};