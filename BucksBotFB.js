
'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()

var ConversationV1 = require('watson-developer-cloud/conversation/v1');
//Credentials
var username = 'bbb78b04-a7b7-41df-a193-e39c99a21fa5';
var password = 'CyNtpDiqmTzF';
var workspce = '17592d00-8f0b-439c-af21-ae5eae9410ad';

var conversation = new ConversationV1({
  username: username,
  password: password,
  version_date: ConversationV1.VERSION_DATE_2017_02_03
});

var async = require('async'),
Cloudant = require('cloudant'),
doc=null;

var cloudant_username = '3d13c833-538f-452e-9c38-d88d78539cc3-bluemix';
var cloudant_password = 'e1f0e02b5dce0105f093dcf4b514fb45f5c3b155690fd6a374c10e94acdf17ae';
var cloudant = Cloudant({account:cloudant_username, password:cloudant_password})
var db = cloudant.db.use('ibm_chatbot');

app.set('port', (process.env.PORT || 5000))

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// parse application/json
app.use(bodyParser.json())

// index
app.get('/', function (req, res) {
	res.send('Terms and Conditions: For Academic Purpose. Primarily for IBM Challenge - IIIT Delhi')
})

// for facebook verification
app.get('/webhook/', function (req, res) {
	res.send(req.query['hub.challenge'])
	/*if (req.query['hub.verify_token'] === 'my_voice_is_my_password_verify_me') {
		res.send(req.query['hub.challenge'])
	} else {
		res.send('Error, wrong token')
	} */
})
var arrOfContext = [];
var arrOfDoc = [];
var arrOfUserInputAmount = [];
var arrOfTenure = [];

//var context = {};
// to post data
app.post('/webhook/', function (req, res) {
	let messaging_events = req.body.entry[0].messaging
	for (let i = 0; i < messaging_events.length; i++) {
		let event = req.body.entry[0].messaging[i]
		let sender = event.sender.id
		console.log("Sender ID "+sender);
		if (event.message && event.message.text && sender != 753827281447880) {
			let text = event.message.text
			/*if (text === 'Generic'){ 
				console.log("welcome to chatbot")
				//sendGenericMessage(sender)
				continue
			} */
			//console.log(JSON.stringify(context));
			if(arrOfContext[sender] == undefined){
				console.log("Chat just initiated");
				arrOfContext[sender] = {};
			}
			console.log("I am going to send message "+text);
			SendMessageToWatson(text,sender);

			//sendTextMessage(sender, "Text received, echo: " + text.substring(0, 200))
		}
		if (event.postback) {
			let text = JSON.stringify(event.postback)
			sendTextMessage(sender, "Postback received: "+text.substring(0, 200), token)
			continue
		}
	}
	res.sendStatus(200)
})

var checkAccNoFlag   = false;
var checkSuffBalFlag = false;
var processFDFlag    = false;
var verifyAccNoFlag  = false;
var lastFlag = false;
function OnFlagsForMessages(text){
	if(text == 'Ok. let me first confirm your account number.') {
		checkAccNoFlag = true;
	}
	else if(text == 'Please give me a moment to check your current balance.'){
		checkSuffBalFlag = true;
	}
	else if(text == 'Kindly wait. Your FD is being processed.'){
		processFDFlag = true;
	}
	else if(text == 'Please give me a moment to verify your account number.'){
		verifyAccNoFlag = true;
	}

}

function CatchImportantMessages(text,sender){
	if(checkAccNoFlag){
		checkAccNoFlag = false;
		var accountNo = text;
		//validateAccountNo(accountNo);
		db.get(accountNo, function(err, data) {
			if(err){
				sendTextMessage(sender, "Not Found".substring(0, 200));
				SendMessageToWatson("No",sender);
			}
			else{
				arrOfDoc[sender] = data;
				var msg = "Current balance in your account is Rs. "+data.amount;
				sendTextMessage(sender, "Verified".substring(0, 200));
				sendTextMessage(sender, msg.substring(0, 200));
				SendMessageToWatson("Yes",sender);
			}
		});
		
	}

	if(checkSuffBalFlag){
		checkSuffBalFlag = false;
		arrOfUserInputAmount[sender] = parseFloat(text);
		var userInputAmount = arrOfUserInputAmount[sender];
		var amountInAccount = parseFloat(arrOfDoc[sender].amount);
		if(userInputAmount <= amountInAccount){
			var msg = "Congrats! You can make an FD with this amount. Your account balance is: Rs "+amountInAccount;
			sendTextMessage(sender, msg.substring(0, 200));
			SendMessageToWatson("Yes",sender);		
		}
		else{
			var msg = "Sorry! Your current account balance is Rs "+amountInAccount;
			sendTextMessage(sender, msg.substring(0, 200));
			SendMessageToWatson("No",sender);
		}
	}

	if(processFDFlag){
		processFDFlag = false;
		lastFlag = true;
		arrOfTenure[sender] = parseFloat(text);
		var userInputAmount = arrOfUserInputAmount[sender];
		var amountInAccount = parseFloat(arrOfDoc[sender].amount);
		var leftBalance = amountInAccount - userInputAmount;

		if(userInputAmount <= amountInAccount){
			var msg = "Congrats! Your FD is processed with input amount. Current Account Balance is: Rs "+leftBalance+
			" Interest rate is 7%.";
			sendTextMessage(sender, msg.substring(0, 200));
			SendMessageToWatson("Yes",sender);	
			//update document in Database and add FD
			var doc = arrOfDoc[sender];
			doc.amount = leftBalance + "";
			if(doc['fixed-deposit'] == undefined){
				var value = {};
				var fd = {};
				value["amount"] = userInputAmount;
				value["tenure"] = arrOfTenure[sender];
				fd['0'] = value;
				doc['fixed-deposit'] = fd;   	
				db.insert(doc, function (er, result) {
  					if (er) {
    					throw er;
 					}
					console.log('Created document');
				});
			}
			else{
					//multiple time
				var value = {};
				var fd = doc['fixed-deposit'];
				var length = Object.keys(fd).length; + '';
				console.log(Object.keys(fd).length);
				value["amount"] = userInputAmount;
				value["tenure"] = arrOfTenure[sender];
				fd[length] = value;
				doc['fixed-deposit'] = fd;  
				db.insert(doc, function (er, result) {
  				if (er) {
    				throw er;
 				}
				console.log('Created document');
				});
			}
		}
		else{
			var msg = "Sorry! Your current account balance is Rs "+amountInAccount;
			sendTextMessage(sender, msg.substring(0, 200));
			SendMessageToWatson("No",sender);

		} 
	}

	if(verifyAccNoFlag){
		verifyAccNoFlag = false;
		lastFlag = true;
		var accountNo = text;
		//validateAccountNo(accountNo);
		db.get(accountNo, function(err, data) {
			if(err){
				sendTextMessage(sender, "Not Found".substring(0, 200));
				SendMessageToWatson("No",sender);
			}
			else{
				arrOfDoc[sender] = data;
				var balance = data.amount;
				var msg = "Your account balance is Rs "+balance;
				sendTextMessage(sender, "Verified".substring(0, 200));
				sendTextMessage(sender,msg.substring(0,200));
				SendMessageToWatson("Yes",sender);
			}
		});
	}


}

function SendMessageToWatson(text,sender){
	console.log(text);
	conversation.message({
		workspace_id: workspce,
		input: {'text': text},
		context: arrOfContext[sender]
		},function(err, response){
			if (err){
				console.log('error:', err);
			}
			else{
	    		//console.log(JSON.stringify(response, null, 2));
	    		arrOfContext[sender] = response.context;
	    		var responseFromWatson = "";
	    		if(lastFlag && response.output.text.length > 1){
	    			console.log("I am here looking for 2nd msg");
	    			responseFromWatson = response.output.text[1];
	    		}
	    		else{
	    			console.log("I am here looking for 1st msg");
	    			responseFromWatson = response.output.text[0];
	    		}

	    		
	    		sendTextMessage(sender, responseFromWatson.substring(0, 200));
	    		OnFlagsForMessages(responseFromWatson);
	    		CatchImportantMessages(text,sender);
			}	
		});

}




// recommended to inject access tokens as environmental variables, e.g.
// const token = process.env.FB_PAGE_ACCESS_TOKEN
const token = "EAAXoPRBHZCGcBAM9WX4y7bLg1ZBenRjVlbURZARcfKMXwp2iSSsCiZAQg26M9BSsSeZAJac7sYlONxYsspB0nhTfqrvqkFsclMSrJbXvUTIFTrYRdH9FKZAR5jkAR0dK9ZAVD3FEajVCujzp7OuH67mjtKsDEpgW7yHzgJLJ3zREAZDZD"

function sendTextMessage(sender, text) {
	let messageData = { text:text }
	
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token:token},
		method: 'POST',
		json: {
			recipient: {id:sender},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	})
}

function sendGenericMessage(sender) {
	let messageData = {
		"attachment": {
			"type": "template",
			"payload": {
				"template_type": "generic",
				"elements": [{
					"title": "First card",
					"subtitle": "Element #1 of an hscroll",
					"image_url": "http://messengerdemo.parseapp.com/img/rift.png",
					"buttons": [{
						"type": "web_url",
						"url": "https://www.messenger.com",
						"title": "web url"
					}, {
						"type": "postback",
						"title": "Postback",
						"payload": "Payload for first element in a generic bubble",
					}],
				}, {
					"title": "Second card",
					"subtitle": "Element #2 of an hscroll",
					"image_url": "http://messengerdemo.parseapp.com/img/gearvr.png",
					"buttons": [{
						"type": "postback",
						"title": "Postback",
						"payload": "Payload for second element in a generic bubble",
					}],
				}]
			}
		}
	}
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token:token},
		method: 'POST',
		json: {
			recipient: {id:sender},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	})
}

// spin spin sugar
app.listen(app.get('port'), function() {
	console.log('running on port', app.get('port'))
})
