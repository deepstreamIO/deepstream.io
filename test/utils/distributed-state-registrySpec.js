var DistributedStateRegistry = require( '../../src/utils/distributed-state-registry' );
var MessageConnectorMock = require( '../mocks/message-connector-mock' );
var clusterRegistryMock = new (require( '../mocks/cluster-registry-mock' ))();

describe( 'distributed-state-registry adds and removes names', function(){
	var registry;

	var options = {
		clusterRegistry: clusterRegistryMock,
		serverName: 'server-name-a',
		stateReconciliationTimeout: 10,
		messageConnector: new MessageConnectorMock()
	};

	it( 'creates the registry', function(){
		registry = new DistributedStateRegistry( 'TEST_TOPIC', options );
		expect( typeof registry.add ).toBe( 'function' );
	});

	it( 'adds a new local name', function(){
		options.messageConnector.reset();
		var callback = jasmine.createSpy( 'callback' );
		registry.once( 'add', callback );
		registry.add( 'test-name-a' );

		expect( options.messageConnector.lastPublishedTopic ).toBe( 'TEST_TOPIC' );
		expect( options.messageConnector.lastPublishedMessage ).toEqual({
			topic: 'TEST_TOPIC',
			action: 'DISTRIBUTED_STATE_ADD',
			data: [ 'test-name-a', 'server-name-a', 2467841850 ]
		});

		expect( callback ).toHaveBeenCalledWith( 'test-name-a' );
		expect( registry.getAll() ).toEqual([ 'test-name-a' ]);
	});

	it( 'adds another new local name', function(){
		options.messageConnector.reset();
		var callback = jasmine.createSpy( 'callback' );
		registry.once( 'add', callback );
		registry.add( 'test-name-b' );

		expect( options.messageConnector.lastPublishedTopic ).toBe( 'TEST_TOPIC' );
		expect( options.messageConnector.lastPublishedMessage ).toEqual({
			topic: 'TEST_TOPIC',
			action: 'DISTRIBUTED_STATE_ADD',
			data: [ 'test-name-b', 'server-name-a', 4935683701 ]
		});

		expect( callback ).toHaveBeenCalledWith( 'test-name-b' );
		expect( registry.getAll() ).toEqual([ 'test-name-a', 'test-name-b' ]);
	});

	it( 'adds an existing local name', function(){
		options.messageConnector.reset();
		var callback = jasmine.createSpy( 'callback' );

		registry.once( 'add', callback );
		registry.add( 'test-name-b' );

		expect( options.messageConnector.lastPublishedTopic ).toBe( null );
		expect( options.messageConnector.lastPublishedMessage ).toBe( null );
		expect( callback ).not.toHaveBeenCalled();
		expect( registry.getAll() ).toEqual([ 'test-name-a', 'test-name-b' ]);
	});

	it( 'adds a new remote name', function(){
		options.messageConnector.reset();
		var callback = jasmine.createSpy( 'callback' );
		registry.once( 'add', callback );

		options.messageConnector.simulateIncomingMessage({
			topic: 'TEST_TOPIC',
			action: 'DISTRIBUTED_STATE_ADD',
			data: [ 'test-name-c', 'server-name-b', 2467841852 ]
		});

		expect( options.messageConnector.lastPublishedTopic ).toBe( null );
		expect( options.messageConnector.lastPublishedMessage ).toBe( null );
		expect( callback ).toHaveBeenCalledWith( 'test-name-c' );
		expect( registry.getAll() ).toEqual([ 'test-name-a', 'test-name-b', 'test-name-c' ]);
	});

	it( 'adds another new remote name', function(){
		options.messageConnector.reset();
		var callback = jasmine.createSpy( 'callback' );
		registry.once( 'add', callback );

		options.messageConnector.simulateIncomingMessage({
			topic: 'TEST_TOPIC',
			action: 'DISTRIBUTED_STATE_ADD',
			data: [ 'test-name-d', 'server-name-b', 4935683705 ]
		});

		expect( options.messageConnector.lastPublishedTopic ).toBe( null );
		expect( options.messageConnector.lastPublishedMessage ).toBe( null );
		expect( callback ).toHaveBeenCalledWith( 'test-name-d' );
		expect( registry.getAll() ).toEqual([ 'test-name-a', 'test-name-b', 'test-name-c', 'test-name-d' ]);
	});

	it( 'adds an existing remote name', function(){
		options.messageConnector.reset();
		var callback = jasmine.createSpy( 'callback' );
		registry.once( 'add', callback );

		options.messageConnector.simulateIncomingMessage({
			topic: 'TEST_TOPIC',
			action: 'DISTRIBUTED_STATE_ADD',
			data: [ 'test-name-c', 'server-name-c', 2467841852 ]
		});

		expect( options.messageConnector.lastPublishedTopic ).toBe( null );
		expect( options.messageConnector.lastPublishedMessage ).toBe( null );
		expect( callback ).not.toHaveBeenCalled();
		expect( registry.getAll() ).toEqual([ 'test-name-a', 'test-name-b', 'test-name-c', 'test-name-d' ]);
	});

	it( 'removes a name that exists once locally', function(){
		options.messageConnector.reset();
		var callback = jasmine.createSpy( 'callback' );
		registry.once( 'remove', callback );

		registry.remove( 'test-name-a' );

		expect( options.messageConnector.lastPublishedTopic ).toBe( 'TEST_TOPIC' );
		expect( options.messageConnector.lastPublishedMessage ).toEqual({
			topic: 'TEST_TOPIC',
			action: 'DISTRIBUTED_STATE_REMOVE',
			data: [ 'test-name-a', 'server-name-a', 2467841851 ]
		});
		expect( callback ).toHaveBeenCalledWith( 'test-name-a' );
		expect( registry.getAll() ).toEqual([ 'test-name-b', 'test-name-c', 'test-name-d' ]);
	});

	it( 'removes a remote name that exists once', function(){
		options.messageConnector.reset();
		var callback = jasmine.createSpy( 'callback' );
		registry.once( 'remove', callback );

		options.messageConnector.simulateIncomingMessage({
			topic: 'TEST_TOPIC',
			action: 'DISTRIBUTED_STATE_REMOVE',
			data: [ 'test-name-d', 'server-name-b', 2467841852 ]
		});

		expect( options.messageConnector.lastPublishedTopic ).toBe( null );
		expect( options.messageConnector.lastPublishedMessage ).toBe( null );
		expect( callback ).toHaveBeenCalledWith( 'test-name-d' );
		expect( registry.getAll() ).toEqual([ 'test-name-b', 'test-name-c' ]);
	});

	it( 'doesnt remove a remote name that exists for another node', function(){
		options.messageConnector.reset();
		var callback = jasmine.createSpy( 'callback' );
		registry.once( 'remove', callback );

		options.messageConnector.simulateIncomingMessage({
			topic: 'TEST_TOPIC',
			action: 'DISTRIBUTED_STATE_REMOVE',
			data: [ 'test-name-c', 'server-name-b', 0 ]
		});

		expect( options.messageConnector.lastPublishedTopic ).toBe( null );
		expect( options.messageConnector.lastPublishedMessage ).toBe( null );
		expect( callback ).not.toHaveBeenCalled();
		expect( registry.getAll() ).toEqual([ 'test-name-b', 'test-name-c' ]);
	});

	it( 'removes a remote name once the last node is removed', function(){
		options.messageConnector.reset();
		var callback = jasmine.createSpy( 'callback' );
		registry.once( 'remove', callback );

		options.messageConnector.simulateIncomingMessage({
			topic: 'TEST_TOPIC',
			action: 'DISTRIBUTED_STATE_REMOVE',
			data: [ 'test-name-c', 'server-name-c', 0 ]
		});

		expect( options.messageConnector.lastPublishedTopic ).toBe( null );
		expect( options.messageConnector.lastPublishedMessage ).toBe( null );
		expect( callback ).toHaveBeenCalledWith( 'test-name-c' );
		expect( registry.getAll() ).toEqual([ 'test-name-b' ]);
	});

	it( 'ensures that no reconciliation messages where pending', function( done ){
		options.messageConnector.reset();
		setTimeout(function(){
			expect( options.messageConnector.lastPublishedTopic ).toBe( null );
			expect( options.messageConnector.lastPublishedMessage ).toBe( null );
			done();
		}, 50 );
	});
});

describe( 'distributed-state-registry reconciles states', function(){
	var registry;

	var options = {
		clusterRegistry: clusterRegistryMock,
		serverName: 'server-name-a',
		stateReconciliationTimeout: 10,
		logger: { log: function(){ console.log( arguments ); }},
		messageConnector: new MessageConnectorMock()
	};

	it( 'creates the registry', function(){
		registry = new DistributedStateRegistry( 'TEST_TOPIC', options );
		expect( typeof registry.add ).toBe( 'function' );
	});

	it( 'adds a remote name with invalid checksum', function(){
		options.messageConnector.reset();
		var callback = jasmine.createSpy( 'callback' );
		registry.once( 'add', callback );

		options.messageConnector.simulateIncomingMessage({
			topic: 'TEST_TOPIC',
			action: 'DISTRIBUTED_STATE_ADD',
			data: [ 'test-name-z', 'server-name-b', 666 ] // should be 2467841875
		});

		expect( options.messageConnector.lastPublishedTopic ).toBe( null );
		expect( options.messageConnector.lastPublishedMessage ).toBe( null );
		expect( callback ).toHaveBeenCalledWith( 'test-name-z' );
		expect( registry.getAll() ).toEqual([ 'test-name-z' ]);
	});

	it( 'adds a remote name with invalid checksum', function( done ){
		options.messageConnector.reset();
		var callback = jasmine.createSpy( 'callback' );
		registry.once( 'add', callback );

		options.messageConnector.simulateIncomingMessage({
			topic: 'TEST_TOPIC',
			action: 'DISTRIBUTED_STATE_ADD',
			data: [ 'test-name-c', 'server-name-b', 666 ] // should be 1054
		});

		expect( options.messageConnector.lastPublishedTopic ).toBe( null );
		expect( options.messageConnector.lastPublishedMessage ).toBe( null );
		expect( callback ).toHaveBeenCalledWith( 'test-name-c' );

		setTimeout(function(){
			expect( options.messageConnector.lastPublishedTopic ).toBe( 'TEST_TOPIC' );
			expect( options.messageConnector.lastPublishedMessage ).toEqual({
				topic: 'TEST_TOPIC',
				action: 'DISTRIBUTED_STATE_REQUEST_FULL_STATE',
				data: [ 'server-name-b' ]
			});
			expect( registry.getAll() ).toEqual([ 'test-name-z', 'test-name-c' ]);
			done();
		}, 30 );
	});

	it( 'receives a full state update', function(){
		options.messageConnector.reset();
		var callback = jasmine.createSpy( 'callback' );
		registry.once( 'add', callback );

		options.messageConnector.simulateIncomingMessage({
			topic: 'TEST_TOPIC',
			action: 'DISTRIBUTED_STATE_FULL_STATE',
			data: [ 'server-name-b', [ 'test-name-x', 'test-name-c' ] ]
		});

		expect( options.messageConnector.lastPublishedTopic ).toBe( null );
		expect( options.messageConnector.lastPublishedMessage ).toBe( null );
		expect( callback ).toHaveBeenCalledWith( 'test-name-x' );
		expect( registry.getAll() ).toEqual([ 'test-name-c', 'test-name-x' ]);
	});
});