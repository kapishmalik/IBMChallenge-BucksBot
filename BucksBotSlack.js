var Botkit = require('botkit');
var request = require('request');
var ConversationV1 = require('watson-developer-cloud/conversation/v1');
var controller = Botkit.slackbot({ debug: false });
var bot = controller.spawn({ token: 'xoxb-154812323269-uwsArCrTTIcAkow2hT7y20yj' }).startRTM();




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

// Initialize the library with my account. 
var cloudant = Cloudant({account:cloudant_username, password:cloudant_password})


var db = cloudant.db.use('ibm_chatbot');
var checkAccNoFlag   = false;
var checkSuffBalFlag = false;
var processFDFlag    = false;
var verifyAccNoFlag  = false;
var arrOfContext = [];
var arrOfDoc = [];
var arrOfUserInputAmount = [];
var arrOfTenure = [];
var lastFlag = false;

controller.hears(
	'(.*)',
	['direct_message'],
	function(bot, message) { 
		var messageFromSlack = message.match[0];
		var userID = message.user;
		if(arrOfContext[userID] == undefined){
			arrOfContext[userID] = {};
			console.log("Chat initiated");
		}

		SendMessageToWatson(messageFromSlack,bot,message,userID);


});

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

function CatchImportantMessages(text,bot,message,userID){
	if(checkAccNoFlag){
		checkAccNoFlag = false;
		var accountNo = text;
		//validateAccountNo(accountNo);
		db.get(accountNo, function(err, data) {
			if(err){
				bot.reply(message,"Not Found");
				SendMessageToWatson("No",bot,message,userID);
			}
			else{
				arrOfDoc[userID] = data;
				var msg = "Current balance in your account is Rs. "+data.amount;
				bot.reply(message,"Verified");
				bot.reply(message,msg);
				SendMessageToWatson("Yes",bot,message,userID);
			}
		});
		
	}
	if(checkSuffBalFlag){
		checkSuffBalFlag = false;
		arrOfUserInputAmount[userID] = parseFloat(text);
		var userInputAmount = arrOfUserInputAmount[userID];
		var amountInAccount = parseFloat(arrOfDoc[userID].amount);
		if(userInputAmount <= amountInAccount){
			var msg = "Congrats! You can make an FD with this amount. Your account balance is: Rs "+amountInAccount;
			bot.reply(message,msg);
			SendMessageToWatson("Yes",bot,message,userID);		
		}
		else{
			var msg = "Sorry! Your current account balance is Rs "+amountInAccount;
			bot.reply(message,msg);
			SendMessageToWatson("No",bot,message,userID);
		}
	}

	if(processFDFlag){
		processFDFlag = false;
		lastFlag = true;
		arrOfTenure[userID] = parseFloat(text);
		var userInputAmount = arrOfUserInputAmount[userID];
		var amountInAccount = parseFloat(arrOfDoc[userID].amount);
		var leftBalance = amountInAccount - userInputAmount;

		if(userInputAmount <= amountInAccount){
			var msg = "Congrats! Your FD is processed with input amount. Current Account Balance is: Rs "+leftBalance+
			"Interest rate is 7%.";
			bot.reply(message,msg);
			SendMessageToWatson("Yes",bot,message,userID);	
			//update document in Database and add FD
			var doc = arrOfDoc[userID];
			doc.amount = leftBalance + "";
			if(doc['fixed-deposit'] == undefined){
				var value = {};
				var fd = {};
				value["amount"] = userInputAmount;
				value["tenure"] = arrOfTenure[userID];
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
				value["tenure"] = arrOfTenure[userID];
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
			bot.reply(message,msg);
			SendMessageToWatson("No",bot,message,userID);

		} 
	}
	
	if(verifyAccNoFlag){
		verifyAccNoFlag = false;
		lastFlag = true;
		var accountNo = text;
		//validateAccountNo(accountNo);
		db.get(accountNo, function(err, data) {
			if(err){
				bot.reply(message,"Not Found");
				SendMessageToWatson("No",bot,message,userID);
			}
			else{
				arrOfDoc[userID] = data;
				var balance = data.amount;
				var msg = "Your account balance is Rs "+balance;
				bot.reply(message,"Verified");
				bot.reply(message,msg);
				
				SendMessageToWatson("Yes",bot,message,userID);
			}
		});
	}


}

function SendMessageToWatson(text,bot,message,userID){
	//console.log(text);
	conversation.message({
		workspace_id: workspce,
		input: {'text': text},
		context: arrOfContext[userID]
		},function(err, response){
			if (err){
				console.log('error:', err);
			}
			else{
	    		console.log(JSON.stringify(response, null, 2));
	    		arrOfContext[userID] = response.context;
	 	    	var responseFromWatson = "";
	 	    	if(lastFlag && response.output.text.length > 1){
	    			console.log("I am here looking for 2nd msg");
	    			responseFromWatson = response.output.text[1];
	    		}
	    		else{
	    			console.log("I am here looking for 1st msg");
	    			responseFromWatson = response.output.text[0];
	    		}
	 	    	bot.reply(message,responseFromWatson);
	    		OnFlagsForMessages(responseFromWatson);
	    		CatchImportantMessages(text,bot,message,userID);
			}	
		});

}


