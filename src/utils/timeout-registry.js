'use strict'

const messageBuilder = require( '../message/message-builder' );
const C = require( '../constants/constants' );

class TimeoutRegistry {
	constructor( type, options ) {
		this._type = type;
		this._options = options;
		this._timeoutMap = {};
		this._timedoutProviders = {};
	}

	addTimeout( name, provider, callback ) {
		var timeoutId = setTimeout(() => {
			if (this._timedoutProviders[ name ] == null ) {
				this._timedoutProviders[ name ] = [];
			}
			this._timedoutProviders[ name ].push( provider );
			callback( name );
		}, 20 );
		// TODO/CLARIFY: this can lead to overwrite an previous timeout
		this._timeoutMap[ name ] = timeoutId;
	}

	clearTimeout( name ) {
		clearTimeout( this._timeoutMap[ name ] );
	}

	getIndex( socketWrapper, message ) {
		const pattern = message.data[ 0 ];
		const name = message.data[ 1 ];
		return (this._timedoutProviders[ name ] || []).findIndex( provider => {
			return provider.socketWrapper === socketWrapper && provider.pattern === pattern;
		})
	}

	getLateProviders( name ) {
		return (this._timedoutProviders[ name ] || []).filter( provider => provider.lateAccept )
	}

	handle( socketWrapper, message ) {
		const pattern = message.data[ 0 ];
		const name = message.data[ 1 ];
		const index = this.getIndex( socketWrapper, message );
		const provider = this._timedoutProviders[ name ][ index ];
		if( message.action === C.ACTIONS.LISTEN_ACCEPT ) {
			// hold for later
			provider.lateAccept = true;
			provider.action = message.action;
			provider.pattern = pattern;
		} else if ( message.action === C.ACTIONS.LISTEN_REJECT ) {
			// ignore and remove from map
			this._timedoutProviders[ name ].splice( index, 1 );
		}
	}

	hasLateProviders( socketWrapper, message ) {
		const index = this.getIndex( socketWrapper, message )
		return this._timedoutProviders[ message.data[ 1 ] ] && index !== -1;
	}

	rejectRemainingRevitalized( name ) {
		this.getLateProviders( name ).forEach( (provider, index) => {
			provider.socketWrapper.send(
				messageBuilder.getMsg(
					this._type,
					C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED,
					[ provider.pattern, name ]
				)
			);
			this._timedoutProviders[ name ].splice( index, 1 );
		});
	}

	getNextRevitalized( name ) {
		const provider =  this.getLateProviders( name ).shift();
		if (provider == null) {
			return;
		}
		const index = this._timedoutProviders[ name ].indexOf( provider );
		this._timedoutProviders[ name ].splice( index, 1 );
		return provider;
	}
}


module.exports = TimeoutRegistry
