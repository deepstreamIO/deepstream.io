/**
 * This collection holds a list of all deepstream
 * instances that are connected to a client which can provide
 * a specific RPC.
 *
 * It keeps track of the time they were added and whether they have expired -
 * in which case a new query will be issued - or are still expected to be there.
 *
 * This is part of the effort to keep the knowledge of connected servers
 * and rpc providers more or less stateless.
 *
 * @param {Object} options deepstream options
 *
 * @constructor
 */
var RpcProviderCollection = function( options ) {
	this._options = options;
	this._provider = {};
};

/**
 * Adds a remote provider to the list. The time
 * this method is called determines the start-time
 * for the providers expiry.
 *
 * @param {Object} providerData {
 * 	                            	rpcName: <String>,
 * 									privateTopic: <String>
 * 									numberOfProviders: <Number>
 * 								}
 *
 * @public
 * @returns {void}
 */
RpcProviderCollection.prototype.addProvider = function( providerData ) {
	this._provider[ providerData.privateTopic ] = {
		numberOfProviders: providerData.numberOfProviders,
		timestamp: Date.now()
	};
};

/**
 * Returns true if there is at least one provider in
 * the collection that hasn't expired yet. Also does some
 * housekeeping and deletes expired providers
 *
 * @public
 * @returns {Boolean} is up to date
 */
RpcProviderCollection.prototype.isUpToDate = function() {
	var cacheTime = this._options.rpcProviderCacheTime,
		now = Date.now(),
		result = false,
		privateTopic;

	for( privateTopic in this._provider ) {
		if( ( this._provider[ privateTopic ].timestamp + cacheTime ) < now ) {
			delete this._provider[ privateTopic ];
		} else {
			result = true;
		}
	}

    return result;
};

/**
 * Returns the private topic for a randomly selected provider.
 * The likelyhood of every deepstream instance to be choosen as
 * a provider is determined by the number of clients that are
 * connected to it that can provide the RPC.
 *
 * @todo - actually choose providers in the way described above
 *
 * @public
 * @returns {String} privateTopic
 */
RpcProviderCollection.prototype.getRandomProvider = function() {
	var privateTopics = this.getAll();

	if( privateTopics.length === 0 ) {
		return null;
	}

	return privateTopics[ Math.floor( Math.random() * privateTopics.length ) ];
};

/**
 * Returns an array of all currently registered topics
 *
 * @public
 * @returns {Array} topics
 */
RpcProviderCollection.prototype.getAll = function() {
	return Object.keys( this._provider );
};

module.exports = RpcProviderCollection;
