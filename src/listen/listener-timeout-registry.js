'use strict'

const C = require('../constants/constants')

module.exports = class ListenerTimeoutRegistry {

  /**
  * The ListenerTimeoutRegistry is responsible for keeping track of listeners that have
  * been asked whether they want to provide a certain subscription, but have not yet
  * responded.
  *
  * @param {Topic} type
  * @param {Map} options
  *
  * @constructor
  */
  constructor (type, options) {
    this._type = type
    this._options = options
    this._timeoutMap = {}
    this._timedoutProviders = {}
    this._acceptedProvider = {}
  }

  /**
    * The main entry point, which takes a message from a provider
    * that has already timed out and does the following:
    *
    * 1) If reject, remove from map
    * 2) If accept, store as an accepted and reject all following accepts
    *
    * @param {SocketWrapper} socketWrapper
    * @param {Object} message deepstream message
    *
    * @private
    * @returns {void}
    */
  handle (socketWrapper, message) {
    const subscriptionName = message.data[1]
    const index = this._getIndex(socketWrapper, message)
    const provider = this._timedoutProviders[subscriptionName][index]
    if (message.action === C.ACTIONS.LISTEN_ACCEPT) {
      if (!this._acceptedProvider[subscriptionName]) {
        this._acceptedProvider[subscriptionName] = this._timedoutProviders[subscriptionName][index]
      } else {
        provider.socketWrapper.sendMessage(
          this._type,
          C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED,
          [provider.pattern, subscriptionName]
        )
      }
    } else if (message.action === C.ACTIONS.LISTEN_REJECT) {
      this._timedoutProviders[subscriptionName].splice(index, 1)
    }
  }

  /**
    * Clear cache once discovery phase is complete
    *
    * @param {String} subscriptionName the subscription that needs to be removed
    *
    * @public
    * @returns {void}
    */
  clear (subscriptionName) {
    delete this._timeoutMap[subscriptionName]
    delete this._timedoutProviders[subscriptionName]
    delete this._acceptedProvider[subscriptionName]
  }

  /**
    * Called whenever a provider closes to ensure cleanup
    *
    * @param {SocketWrapper} socketWrapper the now closed connection endpoint
    *
    * @private
    * @returns {void}
    */
  removeProvider (socketWrapper) {
    for (const acceptedProvider in this._acceptedProvider) {
      if (this._acceptedProvider[acceptedProvider].socketWrapper === socketWrapper) {
        delete this._acceptedProvider[acceptedProvider]
      }
    }
    for (const subscriptionName in this._timeoutMap) {
      if (this._timeoutMap[subscriptionName]) {
        this.clearTimeout(subscriptionName)
      }
    }
  }
  /**
  * Starts a timeout for a provider. The following cases can apply
  *
  * Provider accepts within the timeout: We stop here
  * Provider rejects within the timeout: We ask the next provider
  * Provider doesn't respond within the timeout: We ask the next provider
  *
  * Provider accepts after the timeout:
  *  If no other provider accepted yet, we'll wait for the current request to end and stop here
  *  If another provider has accepted already, we'll immediatly send a SUBSCRIPTION_REMOVED message
  *
  * @param {String}   subscriptionName The subscription name
  * @param {Object}   provider         The provider that may timeout
  * @param {Function} callback         The callback if the timeout occurs
  *
  * @public
  * @returns {void}
  */
  addTimeout (subscriptionName, provider, callback) {
    const timeoutId = setTimeout(() => {
      if (this._timedoutProviders[subscriptionName] == null) {
        this._timedoutProviders[subscriptionName] = []
      }
      this._timedoutProviders[subscriptionName].push(provider)
      callback(subscriptionName)
    }, this._options.listenResponseTimeout)
    this._timeoutMap[subscriptionName] = timeoutId
  }

  /**
    * Clear the timeout for a LISTEN_ACCEPT or LISTEN_REJECt recieved
    * by the listen registry
    *
    * @public
    */
  clearTimeout (subscriptionName) {
    clearTimeout(this._timeoutMap[subscriptionName])
    delete this._timeoutMap[subscriptionName]
  }

  /**
    * Return if the socket is a provider that previously timeout
    *
    * @public
    */
  isALateResponder (socketWrapper, message) {
    const index = this._getIndex(socketWrapper, message)
    return this._timedoutProviders[message.data[1]] && index !== -1
  }

  /**
    * Return if the socket is a provider that previously timeout
    *
    * @public
    */
  rejectLateResponderThatAccepted (subscriptionName) {
    const provider = this._acceptedProvider[subscriptionName]
    if (provider) {
      provider.socketWrapper.sendMessage(
        this._type,
        C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED,
        [provider.pattern, subscriptionName]
      )
    }
  }

  /**
    * Return if the socket is a provider that previously timeout
    *
    * @public
    */
  getLateResponderThatAccepted (subscriptionName) {
    return this._acceptedProvider[subscriptionName]
  }

  /**
    * Return if the socket is a provider that previously timeout
    *
    * @private
    */
  _getIndex (socketWrapper, message) {
    const pattern = message.data[0]
    const subscriptionName = message.data[1]
    const timedoutProviders = this._timedoutProviders[subscriptionName]

    if (timedoutProviders) {
      for (let i = 0; i < timedoutProviders.length; i++) {
        if (
          timedoutProviders[i].socketWrapper === socketWrapper &&
          timedoutProviders[i].pattern === pattern
        ) {
          return i
        }
      }
    }

    return -1
  }
}
