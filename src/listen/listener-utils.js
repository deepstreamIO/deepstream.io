'use strict';

var C = require( '../constants/constants' ),
	messageParser = require( '../message/message-parser' ),
	messageBuilder = require( '../message/message-builder' );

class ListenerUtils {

	constructor( topic, options, clientRegistry ) {
		this._uniqueLockName = `${topic}_LISTEN_LOCK`;
		this._topic = topic;
		this._options = options;
		this._clientRegistry = clientRegistry;
	}

	/**
	* Adds a unique close listener to avoid unnecessary adds
	*/
	addUniqueCloseListener( socketWrapper, eventHandler ) {
		const eventName = 'close';
		const socketListeners = socketWrapper.socket.listeners( eventName );
		const listenerFound = false;
		var i, item;
		for( i=0; i<socketListeners.length; i++) {
			item = socketListeners[ i ];
			if( item.listener === eventHandler ) {
				listenerFound = true;
				break;
			}
		}
		if( !listenerFound ) {
			socketWrapper.socket.once( eventName, eventHandler );
		}
	}

	/**
	 * Remove provider from listen in progress map if it unlistens during
	 * discovery stage
	 *
	 * @private
	 * @returns {Message}
	 */
	removeListenerFromInProgress( listensCurrentlyInProgress, pattern, socketWrapper ) {
		var subscriptionName, i, listenInProgress;
		for( var subscriptionName in listensCurrentlyInProgress ) {
			listenInProgress = listensCurrentlyInProgress[ subscriptionName ];
			for( var i=0; i< listenInProgress.length; i++) {
				if(
					listenInProgress[i].socketWrapper === socketWrapper &&
					listenInProgress[i].pattern === pattern
				) {
					listenInProgress.splice( i, 1 );
				}
			}
		}
	}

	/**
	 * Sends a has provider update to all subscribers
	 *
	 * @private
	 * @returns {Message}
	 */
	sendHasProviderUpdateToSingleSubscriber( hasProvider, socketWrapper, subscriptionName ) {
		if( socketWrapper && this._topic === C.TOPIC.RECORD ) {
			socketWrapper.send( this._createHasProviderMessage( hasProvider, this._topic, subscriptionName ) );
		}
	}

	/**
	 * Sends a has provider update to all subscribers
	 *
	 * @private
	 * @returns {Message}
	 */
	sendHasProviderUpdate( hasProvider, subscriptionName ) {
		if( this._topic !== C.TOPIC.RECORD ) {
			return
		}
		this._clientRegistry.sendToSubscribers( subscriptionName, this._createHasProviderMessage( hasProvider, this._topic, subscriptionName ) );
	}

	sendRemoteDiscoveryStart( serverName, subscriptionName ) {
		const messageTopic = this.getMessageBusTopic( serverName, this._topic );
		this._options.messageConnector.publish( messageTopic, {
			topic: messageTopic,
			action: C.ACTIONS.LISTEN,
			data:[ serverName, subscriptionName ]
		});
	}

	sendRemoteDiscoveryStop( listenLeaderServerName, subscriptionName ) {
		const messageTopic = this.getMessageBusTopic( listenLeaderServerName, this._topic );
		this._options.messageConnector.publish( messageTopic, {
			topic: messageTopic,
			action: C.ACTIONS.LISTEN,
			data:[ listenLeaderServerName, subscriptionName ]
		});
	}

	/**
	 * Create a has provider update message
	 *
	 * @private
	 * @returns {Message}
	 */
	sendSubscriptionForPatternFound( provider, subscriptionName ) {
		provider.socketWrapper.send( messageBuilder.getMsg(
			this._topic, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, [ provider.pattern, subscriptionName ]
			)
		);
	}

	/**
	 * Create a has provider update message
	 *
	 * @private
	 * @returns {Message}
	 */
	sendSubscriptionForPatternRemoved( provider, subscriptionName ) {
		provider.socketWrapper.send(
			messageBuilder.getMsg(
				this._topic, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, [ provider.pattern, subscriptionName ]
			)
		);
	}

	/**
	 * Create a map of all the listeners that patterns match the subscriptionName locally
	 *
	 * @private
	 * @returns {void}
	 */
	createLocalListenMap( patterns, providerRegistry, subscriptionName ) {
		const providers = [];
		for( var pattern in patterns ) {
			if( patterns[ pattern ].test( subscriptionName ) ) {
				var providersForPattern = providerRegistry.getLocalSubscribers( pattern );
				for( var i = 0; providersForPattern && i < providersForPattern.length; i++ ) {
					providers.push( {
						pattern: pattern,
						socketWrapper: providersForPattern[ i ]
					});
				}
			}
		}
		return providers;
	}

	/**
	 * Extracts the subscription pattern from the message and notifies the sender
	 * if something went wrong
	 *
	 * @param   {SocketWrapper} socketWrapper
	 * @param   {Object} message
	 *
	 * @private
	 * @returns {void}
	 */
	getPattern( socketWrapper, message ) {
		if( message.data.length > 2  ) {
			this.onMsgDataError( socketWrapper, message.raw );
			return null;
		}

		var pattern = message.data[ 0 ];

		if( typeof pattern !== 'string' ) {
			this.onMsgDataError( socketWrapper, pattern );
			return null;
		}

		return pattern;
	}

	/**
	 * Validates that the pattern is not empty and is a valid regular expression
	 *
	 * @param   {SocketWrapper} socketWrapper
	 * @param   {String} pattern
	 *
	 * @private
	 * @returns {RegExp}
	 */
	validatePattern( socketWrapper, pattern ) {
		if( !pattern ) {
			return false;
		}

		try{
			return new RegExp( pattern );
		} catch( e ) {
			this.onMsgDataError( socketWrapper, e.toString() );
			return false ;
		}
	}

	/**
	 * Processes errors for invalid messages
	 *
	 * @param   {SocketWrapper} socketWrapper
	 * @param   {String} errorMsg
	 * @param   {Event} [errorEvent] Default to C.EVENT.INVALID_MESSAGE_DATA
	 *
	 * @private
	 * @returns {void}
	 */
	onMsgDataError( socketWrapper, errorMsg, errorEvent ) {
		errorEvent = errorEvent || C.EVENT.INVALID_MESSAGE_DATA;
		socketWrapper.sendError( this._topic, errorEvent, errorMsg );
		this._options.logger.log( C.LOG_LEVEL.ERROR, errorEvent, errorMsg );
	}

	getMessageBusTopic( serverName, topic ) {
		return C.TOPIC.LEADER_PRIVATE + serverName + topic + C.ACTIONS.LISTEN;
	}

	getUniqueLockName( subscriptionName ) {
		return `${this._uniqueLockName}_${subscriptionName}`;
	}

	/**
	 * Create a has provider update message
	 *
	 * @private
	 * @returns {Message}
	 */
	_createHasProviderMessage(hasProvider, topic, subscriptionName) {
		return messageBuilder.getMsg(
				topic,
				C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER,
				[subscriptionName, (hasProvider ? C.TYPES.TRUE : C.TYPES.FALSE)]
			);
	}
}

module.exports = ListenerUtils;
