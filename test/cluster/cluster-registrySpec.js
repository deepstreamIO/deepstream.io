var ClusterRegistry = require( '../../src/cluster/cluster-registry' );
var C = require( '../../src/constants/constants' );
var MessageConnectorMock = require( '../mocks/message-connector-mock' );
var connectionEndpointMock = {
	getBrowserConnectionCount: function() { return 8; },
	getTcpConnectionCount: function() { return 7; }
};

fdescribe( 'distributed-state-registry adds and removes names', function(){
	var clusterRegistry;

	var options = {
		serverName: 'server-name-a',
		externalUrl: 'some-host:1234',
		clusterKeepAliveInterval: 20,
		clusterKeepAliveTimeout: 100,
		messageConnector: new MessageConnectorMock()
	};

	it( 'sends an exist message when the cluster registry is created', function(){
		clusterRegistry = new ClusterRegistry( options, connectionEndpointMock );
		var msg = options.messageConnector.lastPublishedMessage;
		var mem = msg.data[ 0 ].memory;
		expect( msg.topic ).toBe( C.TOPIC.CLUSTER );
		expect( msg.action ).toBe( C.ACTIONS.EXISTS );
		expect( msg.data[ 0 ].serverName ).toBe( 'server-name-a' );
		expect( msg.data[ 0 ].externalUrl ).toBe( 'some-host:1234' );
		expect( msg.data[ 0 ].browserConnections ).toBe( 8 );
		expect( msg.data[ 0 ].tcpConnections ).toBe( 7 );
		expect( isNaN( mem ) === false && mem > 0 && mem < 1 ).toBe( true );
	});
});