var MessageConnectorMock = function() {
    this.lastPublishedTopic = null;
    this.lastPublishedMessage = null;
    this.lastSubscribedTopic = null;
};

MessageConnectorMock.prototype.reset = function() {
    this.lastPublishedTopic = null;
    this.lastPublishedMessage = null;
    this.lastSubscribedTopic = null;
};

MessageConnectorMock.prototype.subscribe = function( topic, callback ) {
	this.lastSubscribedTopic = topic;
};

MessageConnectorMock.prototype.publish = function( topic, message ) {
    this.lastPublishedTopic = topic;
    this.lastPublishedMessage = message;
};

module.exports = new MessageConnectorMock();
