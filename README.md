# twilio-callflow-generator
Twilio CallFlow Generator is a Twilio function based script that allows for the quick generation of a json call flow file that will play messages hunt groups of numbers and send voicemail text and emails as well as answered call recording texts and email.

Use /FlowAssetGenerator.html to generate the json.  Save the json as a private asset (must be private not public else will not work as we look for it by asset path)  

then set the webhook for your twilio phone number to the service url for this funtion  https://{yourfunctionamehere}}.twil.io/Executeflow will execute the DefaultFlow.json

you can call other flows buy appending to the url   https://{yourfunctionamehere}}.twil.io/Executeflow?Flow=SampleCallFlow.json

## Setup Visual Code Debug

[[https://www.twilio.com/blog/locally-developing-and-debugging-twilio-functions]]


```
npm install twilio-cli -g
npm install -D twilio-run

```

Install the Visual Code Twilio Extension


Add as many CallFlows as you want or extend this script by forking it on github.

To deploy to Twilio execute this command in the Terminal

```
twilio serverless:deploy
```

To Debug Local with Break Points

```
 node_modules/.bin/twilio-run --inspect

```

The under Visual Code Debug use the Attach and it should hit your break points.

## Environment Variables

Don't Forget to set your Environment Variables under your service before you go live.

```
EXECUTEFLOW_NOTIFY_SMS_TO_DEFAULT
MESSAGEFORWARD_TITLE
MESSAGEFORWARD_FROM
MESSAGEFORWARD_TO_NUMBERS
EXECUTEFLOW_NOTIFY_SMS_FROM
```

To Debug rename .env.template to .env  and set them so they are used during Visual Code debug.

```
ACCOUNT_SID=
AUTH_TOKEN=


# Variables for function "ExecuteFlow"
# ---
# description: A list of numbers in E.164 format you want to send notify messages to if flow doesn't specify Notify Number, separated by commas
# format: list(phone_number)
# required: true
EXECUTEFLOW_NOTIFY_SMS_TO_DEFAULT=+12223334444,+491761234567

# description: A numbers in E.164 format you want the notify message to be sent from
# format: phone_number
# required: true
EXECUTEFLOW_NOTIFY_SMS_FROM=+12223334444


# Variables for function "MessageForward"
# ---
# description: A list of numbers in E.164 format you want to forward incoming messages to, separated by commas
# format: list(phone_number)
# required: true

MESSAGEFORWARD_TO_NUMBERS=+12223334444,+491761234567
# description: The Prefix Message to send when a Text is sent
# format: text
# required: true
MESSAGEFORWARD_TITLE=Incoming Text Message


```

