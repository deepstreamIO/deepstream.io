var ClusterRegistry = require( '../../src/cluster/cluster-registry' );
var C = require( '../../src/constants/constants' );
var MessageConnectorMock = require( '../mocks/message-connector-mock' );
var connectionEndpointMock = {
	getBrowserConnectionCount: function() { return 8; },
	getTcpConnectionCount: function() { return 7; }
};

fdescribe( 'distributed-state-registry adds and removes names', function(){
	var clusterRegistry;

	var addSpy = jasmine.createSpy( 'add' );
	var removeSpy = jasmine.createSpy( 'remove' );

	var options = {
		serverName: 'server-name-a',
		externalUrl: 'some-host:1234',
		clusterKeepAliveInterval: 20,
		clusterActiveCheckInterval: 50,
		clusterNodeInactiveTimeout: 100,
		messageConnector: new MessageConnectorMock(),
		logger: { log: function(){ console.log( arguments ); } }
	};

	it( 'sends an exist message when the cluster registry is created', function(){
		clusterRegistry = new ClusterRegistry( options, connectionEndpointMock );
		clusterRegistry.on( 'add', addSpy );
		clusterRegistry.on( 'remove', addSpy );
		var msg = options.messageConnector.lastPublishedMessage;
		var mem = msg.data[ 0 ].memory;
		expect( msg.topic ).toBe( C.TOPIC.CLUSTER );
		expect( msg.action ).toBe( C.ACTIONS.STATUS );
		expect( msg.data[ 0 ].serverName ).toBe( 'server-name-a' );
		expect( msg.data[ 0 ].externalUrl ).toBe( 'some-host:1234' );
		expect( msg.data[ 0 ].browserConnections ).toBe( 8 );
		expect( msg.data[ 0 ].tcpConnections ).toBe( 7 );
		expect( isNaN( mem ) === false && mem > 0 && mem < 1 ).toBe( true );
	});

	it( 'receives a message that adds a node', function(){
		expect( clusterRegistry.getAll() ).toEqual([ 'server-name-a']);
		
		options.messageConnector.simulateIncomingMessage({
			topic: C.TOPIC.CLUSTER,
			action: C.ACTIONS.STATUS,
			data: [{
				serverName: 'server-name-b',
				browserConnections: 14,
				tcpConnections: 17,
				memory: 0.3,
				externalUrl: 'external-url-b'
			}]
		});

		expect( addSpy ).toHaveBeenCalledWith( 'server-name-b' );
		expect( clusterRegistry.getAll() ).toEqual([ 'server-name-a', 'server-name-b' ]);
	});

	it( 'receives another message that adds a node', function(){

		options.messageConnector.simulateIncomingMessage({
			topic: C.TOPIC.CLUSTER,
			action: C.ACTIONS.STATUS,
			data: [{
				serverName: 'server-name-c',
				browserConnections: 11,
				tcpConnections: 17,
				memory: 0.9,
				externalUrl: 'external-url-c'
			}]
		});

		expect( addSpy ).toHaveBeenCalledWith( 'server-name-c' );
		expect( clusterRegistry.getAll() ).toEqual([ 'server-name-a', 'server-name-b', 'server-name-c' ]);
	});

	it( 'returns the least utilized node', function(){
		expect( clusterRegistry.getLeastUtilizedExternalUrl() ).toBe( 'external-url-b' );
	});

	it( 'receives an update that changes a status for an existing node', function(){
		options.messageConnector.simulateIncomingMessage({
			topic: C.TOPIC.CLUSTER,
			action: C.ACTIONS.STATUS,
			data: [{
				serverName: 'server-name-c',
				browserConnections: 11,
				tcpConnections: 17,
				memory: 0.01,
				externalUrl: 'external-url-c'
			}]
		});
		expect( clusterRegistry.getLeastUtilizedExternalUrl() ).toBe( 'external-url-c' );
	});

	it( 'removes a node due to a leave message', function(){
		options.messageConnector.simulateIncomingMessage({
			topic: C.TOPIC.CLUSTER,
			action: C.ACTIONS.REMOVE,
			data: [ 'server-name-c' ]
		});

		expect( clusterRegistry.getAll() ).toEqual([ 'server-name-a', 'server-name-b' ]);
		expect( clusterRegistry.getLeastUtilizedExternalUrl() ).toBe( 'external-url-b' );
	});

	it( 'removes a node due to timeout', function( done ){
		expect( clusterRegistry.getAll() ).toEqual([ 'server-name-a', 'server-name-b' ]);

		setTimeout(function(){
			expect( clusterRegistry.getAll() ).toEqual([ 'server-name-a' ]);
			done();
		}, 500 );
	});
});