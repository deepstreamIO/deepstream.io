var MessageConnectorMock = function() {
    this.lastPublishedTopic = null;
    this.lastPublishedMessage = null;
};

MessageConnectorMock.prototype.publish = function( topic, message ) {
    this.lastPublishedTopic = topic;
    this.lastPublishedMessage = message;
};

module.exports = new MessageConnectorMock();