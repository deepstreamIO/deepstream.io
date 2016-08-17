var DistributedStateRegistry = require( '../../src/utils/distributed-state-registry' );
var LocalMessageConnector = require( '../mocks/local-message-connector' );

var createRegistry = function ( serverName, messageConnector ) {
	var options = {
		serverName: serverName,
		stateReconciliationTimeout: 10,
		messageConnector: messageConnector
	};
	var result = {
		addCallback: jasmine.createSpy( 'add' ),
		removeCallback: jasmine.createSpy( 'remove' ),
		registry: new DistributedStateRegistry( 'TEST_TOPIC', options )
	}

	result.registry.on( 'add', result.addCallback );
	result.registry.on( 'remove', result.removeCallback );

	return result;
};

describe( 'distributed-state-registry adds and removes names in a cluster', function(){
	var messageConnector = new LocalMessageConnector();
	var registryA;
	var registryB;
	var registryC;

	it( 'creates the registries', function(){
		registryA = createRegistry( 'server-name-a', messageConnector );
		registryB = createRegistry( 'server-name-b', messageConnector );
		registryC = createRegistry( 'server-name-c', messageConnector );
		expect( messageConnector.subscribedTopics.length ).toBe( 3 );
	});

	it( 'adds an entry to registry a', function(){
		registryA.registry.add( 'test-entry-a' );
		expect( registryA.addCallback ).toHaveBeenCalledWith( 'test-entry-a' );
		expect( registryB.addCallback ).toHaveBeenCalledWith( 'test-entry-a' );
		expect( registryC.addCallback ).toHaveBeenCalledWith( 'test-entry-a' );
		expect( registryA.registry.getAll() ).toEqual([ 'test-entry-a' ]);
		expect( registryB.registry.getAll() ).toEqual([ 'test-entry-a' ]);
		expect( registryC.registry.getAll() ).toEqual([ 'test-entry-a' ]);
	});

	it( 'adds an entry to registry b', function(){
		registryB.registry.add( 'test-entry-b' );
		expect( registryA.addCallback ).toHaveBeenCalledWith( 'test-entry-b' );
		expect( registryB.addCallback ).toHaveBeenCalledWith( 'test-entry-b' );
		expect( registryC.addCallback ).toHaveBeenCalledWith( 'test-entry-b' );
		expect( registryA.registry.getAll() ).toEqual([ 'test-entry-a', 'test-entry-b' ]);
		expect( registryB.registry.getAll() ).toEqual([ 'test-entry-a', 'test-entry-b' ]);
		expect( registryC.registry.getAll() ).toEqual([ 'test-entry-a', 'test-entry-b' ]);
	});

	it( 'adds the same entry to registry c', function(){
		registryA.addCallback.calls.reset();
		registryB.addCallback.calls.reset();
		registryC.addCallback.calls.reset();
		registryC.registry.add( 'test-entry-b' );
		expect( registryA.addCallback ).not.toHaveBeenCalled();
		expect( registryB.addCallback ).not.toHaveBeenCalled();
		expect( registryC.addCallback ).not.toHaveBeenCalled();
		expect( registryA.registry.getAll() ).toEqual([ 'test-entry-a', 'test-entry-b' ]);
		expect( registryB.registry.getAll() ).toEqual([ 'test-entry-a', 'test-entry-b' ]);
		expect( registryC.registry.getAll() ).toEqual([ 'test-entry-a', 'test-entry-b' ]);
	});

	it( 'removes a single node entry from registry a', function(){
		registryA.registry.remove( 'test-entry-a' );
		expect( registryA.removeCallback ).toHaveBeenCalledWith( 'test-entry-a' );
		expect( registryB.removeCallback ).toHaveBeenCalledWith( 'test-entry-a' );
		expect( registryC.removeCallback ).toHaveBeenCalledWith( 'test-entry-a' );
		expect( registryA.registry.getAll() ).toEqual([ 'test-entry-b' ]);
		expect( registryB.registry.getAll() ).toEqual([ 'test-entry-b' ]);
		expect( registryC.registry.getAll() ).toEqual([ 'test-entry-b' ]);
	});

	it( 'removes a multi node entry from registry b', function(){
		registryA.removeCallback.calls.reset();
		registryB.removeCallback.calls.reset();
		registryC.removeCallback.calls.reset();
		registryB.registry.remove( 'test-entry-b' );
		expect( registryA.removeCallback ).not.toHaveBeenCalled();
		expect( registryB.removeCallback ).not.toHaveBeenCalled();
		expect( registryC.removeCallback ).not.toHaveBeenCalled();
		expect( registryA.registry.getAll() ).toEqual([ 'test-entry-b' ]);
		expect( registryB.registry.getAll() ).toEqual([ 'test-entry-b' ]);
		expect( registryC.registry.getAll() ).toEqual([ 'test-entry-b' ]);
	});

	it( 'removes a multi node entry from registry c', function(){
		registryA.removeCallback.calls.reset();
		registryB.removeCallback.calls.reset();
		registryC.removeCallback.calls.reset();
		registryC.registry.remove( 'test-entry-b' );
		expect( registryA.removeCallback ).toHaveBeenCalledWith( 'test-entry-b' );
		expect( registryB.removeCallback ).toHaveBeenCalledWith( 'test-entry-b' );
		expect( registryC.removeCallback ).toHaveBeenCalledWith( 'test-entry-b' );
		expect( registryA.registry.getAll() ).toEqual([]);
		expect( registryB.registry.getAll() ).toEqual([]);
		expect( registryC.registry.getAll() ).toEqual([]);
	});
});

describe( 'distributed-state-registry reconciles state in a cluster', function(){
	var messageConnector = new LocalMessageConnector();
	var registryA;
	var registryB;
	var registryC;

	it( 'creates the registries', function(){
		registryA = createRegistry( 'server-name-a', messageConnector );
		registryB = createRegistry( 'server-name-b', messageConnector );
		registryC = createRegistry( 'server-name-c', messageConnector );
		expect( messageConnector.subscribedTopics.length ).toBe( 3 );
	});

	it( 'adds an entry to registry a', function(){
		registryA.registry.add( 'test-entry-a' );
		expect( registryA.addCallback ).toHaveBeenCalledWith( 'test-entry-a' );
		expect( registryB.addCallback ).toHaveBeenCalledWith( 'test-entry-a' );
		expect( registryC.addCallback ).toHaveBeenCalledWith( 'test-entry-a' );
		expect( registryA.registry.getAll() ).toEqual([ 'test-entry-a' ]);
		expect( registryB.registry.getAll() ).toEqual([ 'test-entry-a' ]);
		expect( registryC.registry.getAll() ).toEqual([ 'test-entry-a' ]);
	});

	it( 'adds an entry to registry b, but drops the message resulting in a compromised state', function(){
		registryA.addCallback.calls.reset();
		registryB.addCallback.calls.reset();
		registryC.addCallback.calls.reset();
		messageConnector.dropNextMessage = true;
		registryB.registry.add( 'test-entry-f' );
		expect( registryA.addCallback ).not.toHaveBeenCalled();
		expect( registryB.addCallback ).toHaveBeenCalledWith( 'test-entry-f' );
		expect( registryC.addCallback ).not.toHaveBeenCalled();
		expect( registryA.registry.getAll() ).toEqual([ 'test-entry-a' ]);
		expect( registryB.registry.getAll() ).toEqual([ 'test-entry-a', 'test-entry-f' ]);
		expect( registryC.registry.getAll() ).toEqual([ 'test-entry-a' ]);
	});

	it( 'adds another entry to registry b, the other registries detect the compromised state', function( done ){
		registryA.addCallback.calls.reset();
		registryB.addCallback.calls.reset();
		registryC.addCallback.calls.reset();
		registryB.registry.add( 'test-entry-g' );
		expect( messageConnector.messages.length ).toBe( 11 );
		expect( registryA.addCallback ).toHaveBeenCalledWith( 'test-entry-g' );
		expect( registryB.addCallback ).toHaveBeenCalledWith( 'test-entry-g' );
		expect( registryC.addCallback ).toHaveBeenCalledWith( 'test-entry-g' );
		expect( registryA.registry.getAll() ).toEqual([ 'test-entry-a', 'test-entry-g' ]);
		expect( registryB.registry.getAll() ).toEqual([ 'test-entry-a', 'test-entry-f', 'test-entry-g' ]);
		expect( registryC.registry.getAll() ).toEqual([ 'test-entry-a', 'test-entry-g' ]);
		setTimeout( done, 50 );
	});

	it( 'has reconciled the compromised state', function(){
		expect( messageConnector.messages.length ).toBe( 14 );

		// registry A asks for state
		expect( messageConnector.messages[ 0 ].data.action ).toBe( 'DISTRIBUTED_STATE_REQUEST_FULL_STATE' );
		expect( messageConnector.messages[ 1 ].data.action ).toBe( 'DISTRIBUTED_STATE_FULL_STATE' );

		// registry B asks for state
		expect( messageConnector.messages[ 2 ].data.action ).toBe( 'DISTRIBUTED_STATE_REQUEST_FULL_STATE' );
		expect( messageConnector.messages[ 3 ].data.action ).toBe( 'DISTRIBUTED_STATE_FULL_STATE' );
		expect( messageConnector.messages[ 4 ].data.action ).toBe( 'DISTRIBUTED_STATE_FULL_STATE' );

		// registry C asks for state
		expect( messageConnector.messages[ 5 ].data.action ).toBe( 'DISTRIBUTED_STATE_REQUEST_FULL_STATE' );
		expect( messageConnector.messages[ 6 ].data.action ).toBe( 'DISTRIBUTED_STATE_FULL_STATE' );
		expect( messageConnector.messages[ 7 ].data.action ).toBe( 'DISTRIBUTED_STATE_FULL_STATE' );
		expect( messageConnector.messages[ 8 ].data.action ).toBe( 'DISTRIBUTED_STATE_FULL_STATE' );

		// add 'test-entry-a'
		expect( messageConnector.messages[ 9 ].data.action ).toBe( 'DISTRIBUTED_STATE_ADD' );
		// add 'test-entry-g', 'test-entry-f' has been dropped
		expect( messageConnector.messages[ 10 ].data.action ).toBe( 'DISTRIBUTED_STATE_ADD' );
		// full state request from either A or C arrives
		expect( messageConnector.messages[ 11 ].data.action ).toBe( 'DISTRIBUTED_STATE_REQUEST_FULL_STATE' );
		// B response immediatly with full state
		expect( messageConnector.messages[ 12 ].data.action ).toBe( 'DISTRIBUTED_STATE_FULL_STATE' );
		// full state request from the other registry (either A or C) arrives, but is ignored as fulls state has already
		// been send within stateReconciliationTimeout
		expect( messageConnector.messages[ 13 ].data.action ).toBe( 'DISTRIBUTED_STATE_REQUEST_FULL_STATE' );

		expect( registryA.addCallback ).toHaveBeenCalledWith( 'test-entry-f' );
		expect( registryC.addCallback ).toHaveBeenCalledWith( 'test-entry-f' );
		expect( registryA.registry.getAll() ).toEqual([ 'test-entry-a', 'test-entry-g', 'test-entry-f' ]);
		expect( registryB.registry.getAll() ).toEqual([ 'test-entry-a', 'test-entry-f', 'test-entry-g' ]);
		expect( registryC.registry.getAll() ).toEqual([ 'test-entry-a', 'test-entry-g', 'test-entry-f' ]);
	});
});