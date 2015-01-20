
// TODO
// ----------------------------------------------------------
// [x] Seen Mod
// [ ] Stats Mod (quante parole ha scritto etc)
// [ ] Sistema per attivare / disattivare moduli
// [x] Game Mode
// [x] UN parser decente per i comandi
// [x] https://github.com/NaturalNode/natural
// [x] Aggiungere il nome del canale nella liste delle partite attive
// [x] Se !list arriva da chat privata allora è sempre global

var xmpp 		    = require('simple-xmpp');
var util        = require('util');
var request     = require('quisquilia/request');
var consts 		  = require('quisquilia/consts');
var db 			    = require('quisquilia/db');
var ladder 		  = require('quisquilia/ladder');
var LolClient 	= require('./lol-client');
var HashMap 	  = require('hashmap').HashMap;
var config      = require('./config');


var LolClient, client, options, summoner, util;
options = {
    region: 'euw',
    username: config.rtmp_user, // LOWERCASE OR IT WILL NOT WORK. Please add a function to convert to lowercase just in case.
    password: config.rtmp_password,
    version: '4.14.14_08_11_13_42',
    debug: false
  };

db.create();

/**
 * Queue for messages, otherwise the server blocks for spamming
 */
/*var message =
{
    to : "",
    message : "",
    groupchat : false
}*/
var messages 		= [];
var first_message 	= {};
var greetings_served = 0;

client = new LolClient(options);

var trackedGames = new HashMap();


/**
 * When the bot goes online
 * @return {[type]} [description]
 */
xmpp.on('online', function()
{
    console.log("");
    console.log("");
    console.log("---/¯`· .  ¸    .  o °|-----------------------");
    console.log("|");
    console.log("| " + consts.APPLICATION_NAME);
    console.log("| version " + consts.VERSION);
    console.log("| written by buu <matteo.alvazzi@gmail.com>");
    console.log("| contibutors:");
    console.log("| -- Shêngbô <bacsi.tibor92@gmail.com>");
    console.log("|");
    console.log("----------------------------------------------");
    console.log("");
    console.log("");
    console.log("");

    // Join all the active conferences
    db.getConferences(function(conference, name)
    {
        util.log("Joinin channel " + name + " (" + conference + ")");
        xmpp.join(conference);
    });

    // Set presence every few minutes
    setInterval(
        function()
        {
            xmpp.setPresence('chat', consts.STATUS);
        }, 180000);

    // Advertisement
    setInterval(
        function()
        {
            db.getConferences(function(conference)
            {
            	var quote =  consts.QUOTES[Math.floor(Math.random() * (consts.QUOTES.length + 1))];
                xmpp.send(conference, quote, true);
            });
        }, 60000 * 30);

    // Discworld Quotes
    setInterval(
        function()
        {
            db.getConferences(function(conference)
            {
                var quote =  consts.DISCQUOTES[Math.floor(Math.random() * (consts.DISCQUOTES.length + 1))];
                xmpp.send(conference, quote + " (Discworld)", true);
            });
        }, 60000 * 15);
    

    //xmpp.join("@lvl.pvp.net");

});

/**
 * On Private chat
 * @param  {[type]} from    [description]
 * @param  {[type]} message [description]
 * @return {[type]}         [description]
 */
xmpp.on('chat', function(from, message)
{
	//console.log("CHAT " + message);
    message = message.replace("<![CDATA[", "").replace("]]>", "");
    request.process(message, null, from, xmpp, client, SendMessage);
});

/**
 * On Group Chat
 * @param  {[type]} conference [description]
 * @param  {[type]} from       [description]
 * @param  {[type]} message    [description]
 * @param  {[type]} stamp      [description]
 * @return {[type]}            [description]
 */
xmpp.on('groupchat', function(conference, from, message, stamp, from_id)
{
	//console.log("GROUPCHAT " + message);
    message = message.replace("<![CDATA[", "").replace("]]>", "");
    request.process(message, conference, from, xmpp, client, SendMessage);
});

//     if(from === "quisquilia" || from === "") return;
//     if(message === "") return;
//     message = message.replace("<![CDATA[", "").replace("]]>", "");
//     if(message === "") return;
//     if (message.indexOf('!hello') === 0)
//     {
//         xmpp.send(conference, "Hey there " + from, true);
//     }
//     if (message.indexOf('!version') === 0)
//     {
//         xmpp.send(conference, "Quisquilia Bot - Version 0.0.1", true);
//     }
//     else
//     {
//         xmpp.send(conference, socialbot.answer(message), true);
//     } was j
//     //console.log('%s says %s on %s on %s at %s', from, message, conference, stamp.substr(0,9), stamp.substr(10));
//     // console.log('%s says %s on %s', from, message, conference);
// });


/**
 * Low level processing
 * @param  {[type]} stanza [description]
 * @return {[type]}        [description]
 * 5 seconds of delay, otherwise it will consider everyone as just joined
 */
setTimeout(function()
{

	xmpp.on('stanza', function(stanza)
	{
		//console.log("STANZA " + stanza);

	    if (stanza.is('presence') && stanza.attrs.type == 'subscribed')
	    {
	        var from = stanza.attrs.from;
	        if(first_message !== null)
	        {
	            xmpp.send(first_message.to, first_message.message, first_message.groupchat);
	            first_message = null;
	        }
	    }

	    if (stanza.is('presence') && stanza.attrs.type == 'unavailable')
	    {
	        var conference = stanza.attrs.from.split('/')[0];
	        var player = stanza.attrs.from.split('/')[1];
	        var account = "";
	        if(stanza.getChild('x'))
	        {
	            if ( stanza.getChild('x').getChild('item') )
	            {
	                account = stanza.getChild('x').getChild('item').attrs.jid;
	            }
	        }

            if(player !== undefined && player != 'undefined')
            {
    	        db.getGame(conference, player, function(game_id)
    	        {
    	            if(game_id !== null)
                    {
                        db.cancelGame(conference, player);
                    }
                });

	            db.setSeen(conference, player, account, 0);
            }
	    }

	    if (stanza.is('presence') && !stanza.attrs.type)
	    {
           
	        var conference = stanza.attrs.from.split('/')[0];
	        var player = stanza.attrs.from.split('/')[1];
	        var account = "";
            if(player !== undefined && player != 'undefined')
            {
                 // Update Last Seen
                db.setSeen(conference, player, account, 1);

    	        if(stanza.getChild('x'))
    	        {
    	            if ( stanza.getChild('x').getChild('item') )
    	            {
    	                account = stanza.getChild('x').getChild('item').attrs.jid;
                        var state = (stanza.getChild('show'))? stanza.getChild('show').getText(): "online";
    	    		    if(state == "online") 
                        {
                            console.log(account);
                            db.getGreeting(account, function(msg) 
                            {
                                setTimeout(function() 
                                {
                                    if (msg !== null && msg !== undefined) 
                                    {
                                        greetings_served++;
                                        if(greetings_served < 2) msg = msg + " [ " + greetings_served + " greeting served so far ]";
                                        else msg = msg + " [ " + greetings_served + " greetings served so far ]";
                                        xmpp.send(conference, msg, true);
                                    }  
                                }, 3000);
                            });
                        }
                    }
                }
            }
            
	        /**
	         * If the user goes in dnd it means that he's playing a game
	         * so any current active game get disabled
	         * @type {[type]}
	         */
	        var state = (stanza.getChild('show'))? stanza.getChild('show').getText(): "online";
	        if(state == "dnd")
	        {

                if(player !== undefined && player != 'undefined')
                {
                    db.getGame(conference, player, function(game_id)
                    {
                        if(game_id !== null && game_id !== undefined)
                        {
                            // Start the game (active = 0)
                            db.startGame(game_id);
                        }
                    });
                }
	        }
	    }
	});
}, 5000);

/**
 * In case of error Log It
 * @param  {[type]} err [description]
 * @return {[type]}     [description]
 */
xmpp.on('error', function(err)
{
    util.error("ERROR: " + err);
});

/**
 * Auto Accept Friend Request
 * @param  {[type]} from [description]
 * @return {[type]}      [description]
 */
xmpp.on('subscribe', function(from)
{
    xmpp.acceptSubscription(from);
});

/**
 * Log In the Bot
 * There is an already built in keep alive
 * @type {String}
 */
// xmpp.connect({
//         jid             : 'someuser@pvp.net/xiff',
//         password        : 'AIR_somepassword',
//         host            : 'chat.euw1.lol.riotgames.com', //chat.euw.lol.riotgames.com',
//         port            : 5223,
//         legacySSL       : true
// });

xmpp.connect({
        jid             : config.xmpp_user,
        password        : config.xmpp_password,
        host            : 'chat.euw1.lol.riotgames.com', //chat.euw.lol.riotgames.com',
        port            : 5223,
        legacySSL       : true
});


/**
 * Sends a message, pushing it into the message queue
 * @param {[type]} to        [description]
 * @param {[type]} message   [description]
 * @param {[type]} groupchat [description]
 */
function SendMessage(to, message, groupchat)
{
	// add 18 lines to clear
	if(!groupchat)
	{
		message = consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + consts.TABLE_NEWLINE + message;
	}

    messages.push(
    {
        to:to,
        message:message,
        groupchat:groupchat
    });
}

/**
 * Anti Spam queue. It ensures that the bot will only send 1 message every second
 */
setInterval(function()
{
    if(messages.length > 0)
    {
        // Send the message and shift the queue
        message = messages.shift();

        // first message used in case the account is not on our list yet
        first_message = message;

        xmpp.send(message.to, message.message, message.groupchat);
    }
}, 1000);

client.on('connection', function() {

	/**
	 * Keep Alive
	 */
	setInterval(client.HeartBeat, 5000);
    console.log('Connected');

    /**
     * Check for new game invites, to track games
     */
    setInterval(function()
    {
    	client.checkPendingInvitations(null, function(err, result)
   		{
   			// if we have some we have to check if we are already tracking them or not
   				return console.log(util.inspect(result, false, null, true));

   			//console.log(result.data);

   			if(result.data !== "")
   			{
   				gameMetaData = JSON.parse(result.data[0].object.gameMetaData);
   				gameId = gameMetaData.gameId;
   				invitationId = result.data[0].object.invitationId;

   				// add the game to the tracker only if we aren't tracking it already
   				if(!trackedGames.has(gameId))
   				{
   					db.trackGame(gameId, function()
   					{
   						trackedGames.set(gameId, result.data[0].object);

   						// send a message to the owner that the bot is now tracking the game
   				   		db.getAccount(result.data[0].object.owner.object.summonerName, function(account)
   				   		{
   				   			xmpp.subscribe(account);
	   					   	SendMessage(account, "Tracking game " + gameId, false);
						});

   					});
   				}
   			}
  		});
    }, 5000);

	/**
     * Track games
     */
  //   setInterval(function()
  //   {
  //   	console.log('Checking tracked games')

		// //
		// trackedGames.forEach(function(value, key) {

		// 	client.GetLatestGameTimerState(key, function(err, result)
		// 	{
		// 		return console.log(util.inspect(result, false, null, true));
		// 	});
		// });



  //  	 	//gameTypeConfigId":6 // tournament
  //   }, 10000);
  });

  client.connect();
