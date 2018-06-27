// ==========================================
// Server
//
// This file contains all of the code necessary for managing a
// WebCraft server on the Node.js platform.
// ==========================================

// Parameters
var WORLD_SX = 128;
var WORLD_SY = 128;
var WORLD_SZ = 32;
var WORLD_GROUNDHEIGHT = 16;
var SECONDS_BETWEEN_SAVES = 60;
var ADMIN_IP = "";

// Load modules
var modules = {};
modules.helpers = require( "./js/helpers.js" );
modules.blocks = require( "./js/blocks.js" );
modules.world = require( "./js/world.js" );
modules.network = require( "./js/network.js" );
modules.io = require( "socket.io" );
modules.fs = require( "fs" );
var log = require( "util" ).log;

// Set-up evil globals
global.Vector = modules.helpers.Vector;
global.BLOCK = modules.blocks.BLOCK;

// Create new empty world or load one from file
const world_path = "./world/";
var worlds = {};
worlds["public"] = new modules.world.World( WORLD_SX, WORLD_SY, WORLD_SZ );
log( "Creating world..." );
if ( worlds["public"].loadFromFile( world_path + "world_public" ) ) {
	log( "Loaded the world from file." );
} else {
	log( "Creating a new empty world." );
	worlds["public"].createFlatWorld( WORLD_GROUNDHEIGHT );
	worlds["public"].saveToFile( world_path + "world_public" );
}

// Load the worlds in world directory
const fs = require('fs');

fs.readdirSync(world_path).forEach(file => {
	var world_name = file.substr(6);
	worlds[world_name] = new modules.world.World( WORLD_SX, WORLD_SY, WORLD_SZ );
	worlds[world_name].loadFromFile( world_path + "world_" + world_name)
})

// Start server
var server = new modules.network.Server( modules.io, 16 );
server.setWorld( worlds );
server.setLogger( log );
server.setOneUserPerIp( true );
log( "Waiting for clients..." );

// Chat commands
server.on( "chat", function( client, nickname, msg )
{
	if ( msg == "/spawn" ) {
		server.setPos( client, worlds["public"].spawnPoint.x, worlds["public"].spawnPoint.y, worlds["public"].spawnPoint.z );
		return true;
	} else if ( msg.substr( 0, 7) == "/create" ) {
		for ( var w in worlds ) {
			log( "Check if world is already exist..." );
			// return false;
			if ( w.toLowerCase() == client.handshake.address ) {
				server.sendMessage( "World is already exist..." );
				// log( "World is already exist..." );
				return false;
			}
		}
		log( "Creating world..." );
		worlds[client.handshake.address] = new modules.world.World( WORLD_SX, WORLD_SY, WORLD_SZ );
		world_name = "world_" + client.handshake.address;
		if ( worlds[client.handshake.address].loadFromFile( world_path + world_name ) ) {
			log( "Loaded the world from file." );
		} else {
			log( "Creating a new empty world." );
			worlds[client.handshake.address].createFlatWorld( WORLD_GROUNDHEIGHT );
			worlds[client.handshake.address].saveToFile( world_path + world_name );
		}
		server.setWorld( worlds );
		for ( var w in worlds ) {
			for ( var p in worlds[w].players ) {
				if ( p.toLowerCase() == client._nickname ) {
					server.changeWorld(client, w, client.handshake.address)
					return true;
				}
			}
		}
    } else if ( msg.substr( 0, 6 ) == "/visit" ) {
		var target = msg.substr( 6 );
		if (target == "") {
			target = client._nickname;
		}
		target = server.findPlayerByName( target );
		// log(target.socket.handshake.address);

		if ( target != null ) {

			for ( var w in worlds ) {
				log("Check if world is already exist..." );
				if ( w == target.socket.handshake.address ) {
					log( "World is exist, prepare for visiting world_" + w);
					for ( var w in worlds ) {
						for ( var p in worlds[w].players ) {
							if ( p.toLowerCase() == client._nickname ) {
								server.changeWorld(client, w, target.socket.handshake.address)
								return true;
							}
						}
					}
				}
			}
			return true;
		} else {
			server.sendMessage( "Couldn't find that player!", client );
			return false;
		}

	} else if ( msg.substr( 0, 3 ) == "/tp" ) {
		var target = msg.substr( 4 );
		target = server.findPlayerByName( target );
		
		if ( target != null ) {
				server.setPos( client, target.x, target.y, target.z );
				server.sendMessage( nickname + " was teleported to " + target.nick + "." );
				return true;
		} else {
			server.sendMessage( "Couldn't find that player!", client );
			return false;
		}
	} else if ( msg.substr( 0, 5 ) == "/kick" && client.handshake.address.address == ADMIN_IP ) {
		var target = msg.substr( 6 );
		target = server.findPlayerByName( target );
		
		if ( target != null ) {
				server.kick( target.socket, "Kicked by Overv" );
				return true;
		} else {
			server.sendMessage( "Couldn't find that player!", client );
			return false;
		}
	} else if ( msg == "/listroom" ) {
		var worldlist = "";
		for ( var w in worlds )
			worldlist += w + ", ";
		worldlist = worldlist.substring( 0, worldlist.length - 2 );
		server.sendMessage( "Rooms: " + worldlist, client );
		return true;
	} else if ( msg == "/list" ) {
		var playerlist = "";
		for ( var w in worlds) {
			for ( var p in worlds[w].players )
				playerlist += p + ", ";
		}
		playerlist = playerlist.substring( 0, playerlist.length - 2 );
		server.sendMessage( "Players: " + playerlist, client );
		return true;
	} else if ( msg.substr( 0, 1 ) == "/" ) {
		server.sendMessage( "Unknown command!", client );
		return false;
	}
} );

// Send a welcome message to new clients
server.on( "join", function( client, nickname )
{
	server.sendMessage( "Welcome! Enjoy your stay, " + nickname + "!", client );
	server.broadcastMessage( nickname + " joined the game.", client );
} );

// And let players know of a disconnecting user
server.on( "leave", function( nickname )
{
	server.sendMessage( nickname + " left the game." );
} );

// Periodical saves
setInterval( function()
{
	for ( w in worlds ) {
		worlds[w].saveToFile( world_path + "world_" + w );
	}
	log( "Saved world to file." );
}, SECONDS_BETWEEN_SAVES * 1000 );