const sinon = require('sinon')
const EventEmitter = require('events').EventEmitter

module.exports = () => {

	const subscriptionRegistry = {
	  subscribe: () => {},
	  unsubscribe: () => {},
	  sendToSubscribers: () => {},
	  setSubscriptionListener: () => {}
	}

	const listenerRegistry = {
	  handle: () => {}
	}
	
	const emitter = new EventEmitter()
	const stateRegistry = {
	  add: () => {},
	  remove: () => {},
	  on: () => {},
	  getAll: () => {}
	}
	stateRegistry.on = emitter.on
	stateRegistry.emit = emitter.emit

	const subscriptionRegistryMock = sinon.mock(subscriptionRegistry)
    const listenerRegistryMock = sinon.mock(listenerRegistry)
    const stateRegistryMock = sinon.mock(stateRegistry)

    function getSocketWrapper (user) {
	    const socketWrapper = {
	    	user,
	    	sendMessage: () => {},
	    	sendError: () => {},
	    	sendAckMessage: () => {},
	    	uuid: Math.random()
	    }
    	return {
    		socketWrapper,
    		socketWrapperMock: sinon.mock(socketWrapper)
    	}
    }

    return { 
    	subscriptionRegistry, 
    	listenerRegistry, 
    	stateRegistry,
    	subscriptionRegistryMock, 
    	listenerRegistryMock,
    	stateRegistryMock,
    	getSocketWrapper
    }
}



   