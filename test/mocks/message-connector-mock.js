var EventEmitter = require( 'events' ).EventEmitter;

var MessageConnectorMock = function() {
    this.lastPublishedTopic = null;
    this.lastPublishedMessage = null;
    this.lastSubscribedTopic = null;
    this._eventEmitter = new EventEmitter();
};

MessageConnectorMock.prototype.reset = function() {
    this.lastPublishedTopic = null;
    this.lastPublishedMessage = null;
    this.lastSubscribedTopic = null;
};

MessageConnectorMock.prototype.subscribe = function( topic, callback ) {
	this.lastSubscribedTopic = topic;
	this._eventEmitter.on( topic, callback );
};

MessageConnectorMock.prototype.publish = function( topic, message ) {
    this.lastPublishedTopic = topic;
    this.lastPublishedMessage = message;
};

MessageConnectorMock.prototype.simulateIncomingMessage = function( msg ) {
    this._eventEmitter.emit( msg.topic, msg );
};

module.exports = MessageConnectorMock;
