const fs = require('fs');
//const got = require('got');
const https = require('https');
exports.handler = function(context, event, callback) {
   //The Asset must be marked as Private
   try {
     const response  = new Twilio.twiml.VoiceResponse();
     const assets = Runtime.getAssets();
     let flow = event.Flow || "/DefaultCallFlow.json";
     if(flow.startsWith("/") === false){
       flow = "/" + flow;
     }
     let state = event.State || "Execute";
     //console.log("flow " + flow, "state " + state, "event", JSON.stringify(event));
     if(assets[flow] && assets[flow].path){
        const assetRawText = fs.readFileSync(assets[flow].path, 'utf8');
        let assetData = null;
        try{
          assetData = JSON.parse(assetRawText);
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
                response.pause({length: 2});
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
              action: "/ExecuteFlow?Flow="+ encodeURIComponent(flow) +"&State=RecordAction" ,
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
                let recordSmsNotify = false;
                let recordSmsNotifyNumbers = "";
                let dial = parseInt(event.Dial,10);
                let number = parseInt(event.Number,10);
                let smsNotifyCalled = false;
                let smsNotifyTitle = "";
                if(dial && number && assetData.dial && assetData.dial["dial" + dial]){
                  let dialData = assetData.dial["dial" + dial];
                  if (dialData.recordSmsNotify){
                    recordSmsNotify = true;
                  }
                  if (dialData.smsNotifyNumbers){
                    recordSmsNotifyNumbers = dialData.smsNotifyNumbers;
                  }
                  if(dialData.smsNotifyCalled){
                    smsNotifyCalled = true;
                  }
                  if(dialData.smsNotifyTitle){
                    smsNotifyTitle = dialData.smsNotifyTitle;
                  }
                }
                if(recordSmsNotify){
                  
                  let dialRecordNotifyToNumbers = null;
                  if(recordSmsNotifyNumbers){
                    dialRecordNotifyToNumbers = recordSmsNotifyNumbers.split(/,\s?/);
                  }
                  
                  const dialRecordNotifyFrom =  context.EXECUTEFLOW_NOTIFY_SMS_FROM || event.To;
                  const client = context.getTwilioClient(); 
                  
                  const getCalledNumberPromise = new Promise((resolve, reject) => {
                    
                    if(smsNotifyCalled){
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
                  
                  
                  getCalledNumberPromise.then(
                    function(dialedNumber){
                      let notifyBody = "";
                      if(smsNotifyTitle){
                        notifyBody = smsNotifyTitle + "\n"
                      }
                      
                      notifyBody = notifyBody + "From: " + event.From + "\nTo: " + event.To + "\nDuration: " + event.DialCallDuration  + "\n" + event.RecordingUrl;  
                      
                      var sendDialActionTexts = [];
                      
                      if(dialedNumber){
                        if(dialRecordNotifyToNumbers){
                          dialRecordNotifyToNumbers.push(dialedNumber);
                        }else{
                          dialRecordNotifyToNumbers = [];
                          dialRecordNotifyToNumbers.push(dialedNumber);
                        }
                      }
                      if(dialRecordNotifyToNumbers){
                        dialRecordNotifyToNumbers.forEach((notifyToNumber) => {
                          console.log('DialAction Text Message From ' + dialRecordNotifyFrom + ' Sending to ' + notifyToNumber);
                          var message = 
                          sendDialActionTexts.push(client.messages.create({from: dialRecordNotifyFrom, body: notifyBody, to: notifyToNumber}));
                        }); 
                      }else{
                        console.error('No Numbers to send record to!');
                        sendDialActionTexts.push(true);
                      }
                      
                      
                      Promise.all(sendDialActionTexts)
                      .then(
                        function(responses){
                          responses.forEach((message) =>{
                            console.log('Text Message Sent ' + message.sid);  
                          })
                          
                          response.say("Goodbye");
                          response.pause({length: 2});
                          response.hangup();   
                          return callback(null, response);
                        },
                        function(error){
                          console.error('Error Text Message failed ' + error);
                          response.say("Goodbye");
                          response.pause({length: 2});
                          response.hangup();   
                          return callback(null, response);
                        }
                      ); 
                    },
                    function(error){
                      console.error('Error retriving Call Log ' + error);
                      response.say("Goodbye");
                      response.pause({length: 2});
                      response.hangup();   
                      return callback(null, response);
                    }
                    
                    
                  )
                  
                }else{
                  console.log('RecordSmsNotify = false');
                  response.say("Goodbye");
                  response.pause({length: 2});
                  response.hangup();   
                  return callback(null, response);
                }   
                  
                
              }else{  //else CallStatus if we got here it was not "completed"
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
                      response.pause({length: 2});
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
            response.pause({length: 2});
            response.hangup();
            return callback(null, response);
            break;
          case "RecordStatus":
            try {
              const voicemailData = assetData.voicemail;
              const VmSmsNotifyFrom = context.EXECUTEFLOW_NOTIFY_SMS_FROM || event.To;
              const VmSmsNotifyTo = voicemailData.smsNotifyNumbers;
              const client = context.getTwilioClient();
              client.calls(event.CallSid)
              .fetch()
              .then(
                function(callLog){
                  console.log("Dial Action Call Log Call To "+  callLog.to + " " + event.CallSid);
                  let callFrom = callLog.from || event.From || context.From;
                  let callTo = callLog.to || event.To || context.To;
                  
                  var notifyPromises = [];

                  if(voicemailData.smsNotify){
                    let voicemailNotifyToNumbers = VmSmsNotifyTo.split(/,\s?/);
                    
                     
                    let notifyBody = "";
    ``
                    if(voicemailData.smsNotifyTitle){
                      notifyBody = voicemailData.smsNotifyTitle + "\n"
                    }
                    
                    notifyBody = notifyBody + "From: " + callFrom; 
                    
                    if(callLog.callerName && callLog.callerName !== callFrom){
                      notifyBody = notifyBody + " " + callLog.callerName;
                    }
                    
                    notifyBody = notifyBody + "\nTo:" + callTo + "\nDuration: " + event.RecordingDuration + "\n" + event.RecordingUrl;  
                    
                    voicemailNotifyToNumbers.forEach((notifyToNumber) => {
                      notifyPromises.push( client.messages.create({from: VmSmsNotifyFrom, body: notifyBody, to: notifyToNumber}));
                    })
                  }
                  if(voicemailData.emailNotify ){
                    let emailNotifyTo =  voicemailData.emailNotifyTo || context.EXECUTEFLOW_NOTIFY_EMAIL_TO
                    let emailNotifyFrom =  voicemailData.emailNotifyFrom || context.EXECUTEFLOW_NOTIFY_EMAIL_FROM
                    let emailNotifySubject = voicemailData.emailNotifySubject || context.EXECUTEFLOW_NOTIFY_EMAIL_SUBJECT
                    let notifyBody = "";
                    
                    notifyBody = notifyBody + "From: " + callFrom;
                    if(callLog.callerName && callLog.callerName !== callFrom){
                      notifyBody = notifyBody + " " + callLog.callerName;
                    }
                    
                    notifyBody = notifyBody + "\nTo:" + callTo + "\nDuration: " + event.RecordingDuration + "\n" + event.RecordingUrl;

                    const postData  = {
                      personalizations: [{ to: [{ email: emailNotifyTo }] }],
                      from: { email: emailNotifyFrom },
                      subject: emailNotifySubject + ` From: ${callFrom}`,
                      content: [
                        {
                          type: 'text/plain',
                          value: notifyBody,
                        },
                      ],
                    };
                    const postOptions = {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${context.SENDGRID_API_KEY}`,
                        'Content-Type': 'application/json',
                      }
                    }
                    let httpRequest = https.request('https://api.sendgrid.com/v3/mail/send', postOptions)
                    httpRequest.write(JSON.stringify(postData));
                    httpRequest.end();
                    notifyPromises.push(httpRequest);
                        
                  }
                  if(notifyPromises && notifyPromises.length > 0){
                      Promise.all(notifyPromises).then(
                        function(message){
                          console.log('Text Messages and/or Email Sent');
                          response.say("Goodbye.");
                          response.pause({length: 2});
                          response.hangup();   
                          return callback(null, response);
                        },
                        function(error){
                          console.error('Error Text Message failed ' + error);
                          response.say("Goodbye.");
                          response.pause({length: 2});
                          response.hangup();   
                          return callback(null, response);
                          //return callback(error);
                        }
                      );
                  }else{
                    response.say("Goodbye.");
                      response.pause({length: 2});
                      response.hangup();   
                      return callback(null, response);
                  }
                
                },
                function(){
                  console.log("Error Retriving Call Log " + event.DialCallSid);
                  resolve(null);
                }
              );



              
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
       response.pause({length: 2});
       response.hangup();  
       return callback(null, response);  
     }
      
      
      
  } catch (error) {
    // In the event of an error, return a 500 error and the error message
    console.error(error);
    return callback(error);
  }
  
};