exports.handler = function (context, event, callback) {
  const twiml = new Twilio.twiml.MessagingResponse();
  const smsFrom = context.MESSAGEFORWARD_FROM || event.To ;
  const smsToNumbers = context.MESSAGEFORWARD_TO_NUMBERS; //Seperated by Commas
  let msgBody = "";
    if(context.MESSAGEFORWARD_TITLE){
      msgBody = context.MESSAGEFORWARD_TITLE + "\n"
    }
    msgBody = msgBody + "From: " + event.From + "\n";
    msgBody = msgBody + event.Body;
  smsToNumbers.split(/,\s?/).forEach((number) => {
    
    var message = twiml.message( {
      to: number,
      from: smsFrom 
    });
    message.body(msgBody);
    
  });
  callback(null, twiml);
};
