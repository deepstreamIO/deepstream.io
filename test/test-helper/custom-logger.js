'use strict';

const Emitter = require( 'events' ).EventEmitter;

class CustomLogger extends Emitter {
	constructor( options ) {
		super();
		this.options = options;
		this.isReady = false;
		setTimeout( () => {
			this.isReady = true;
			this.emit( 'ready' );
		}, 1 );
	}

	log( level, event, msg ) {
		console.log( 'CustomLogger:', level, event, msg );
	}

	setLogLevel( level ) {
		console.log( '<< new log level', level );
	}

}

module.exports = CustomLogger;
