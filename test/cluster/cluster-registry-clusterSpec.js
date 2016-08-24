var ClusterRegistry = require( '../../src/cluster/cluster-registry' );
var C = require( '../../src/constants/constants' );
var LocalMessageConnector = require( '../mocks/local-message-connector' );
var messageConnector = new LocalMessageConnector();
var connectionEndpointMock = {
	getBrowserConnectionCount: function() { return 8; },
	getTcpConnectionCount: function() { return 7; }
};

describe( 'distributed-state-registry adds and removes names', function(){
	var createClusterRegistry = function( serverName, externalUrl ) {
		var options = {
			serverName: serverName,
			externalUrl: externalUrl,
			clusterKeepAliveInterval: 20,
			clusterActiveCheckInterval: 50,
			clusterNodeInactiveTimeout: 100,
			messageConnector: messageConnector,
			logger: { log: jasmine.createSpy( 'log' ) }
		};

		var result = {
			clusterRegistry: new ClusterRegistry( options, connectionEndpointMock ),
			addSpy: jasmine.createSpy( 'add' ),
			removeSpy: jasmine.createSpy( 'remove' )
		};

		result.clusterRegistry.on( 'add', result.addSpy );
		result.clusterRegistry.on( 'remove', result.removeSpy );

		return result;
	};


	var a,b,c;

	it( 'creates three registries', function( done ){
		a = createClusterRegistry( 'server-name-a', 'external-url-a' );
		b = createClusterRegistry( 'server-name-b', 'external-url-b' );
		c = createClusterRegistry( 'server-name-c', 'external-url-c' );

		expect( a.clusterRegistry.getAll() ).toEqual( [ 'server-name-a', 'server-name-b', 'server-name-c' ] );
		expect( b.clusterRegistry.getAll() ).toEqual( [ 'server-name-b', 'server-name-c' ] );
		expect( c.clusterRegistry.getAll() ).toEqual( [ 'server-name-c' ] );

		setTimeout( done, 100 );
	});

	it( 'synced all clusters', function(){
		expect( a.clusterRegistry.getAll().sort() ).toEqual( [ 'server-name-a', 'server-name-b', 'server-name-c' ] );
		expect( b.clusterRegistry.getAll().sort() ).toEqual( [ 'server-name-a', 'server-name-b', 'server-name-c' ] );
		expect( c.clusterRegistry.getAll().sort() ).toEqual( [ 'server-name-a', 'server-name-b', 'server-name-c' ] );
	});

	it( 'removes a node', function(){
		a.clusterRegistry.leaveCluster();
		expect( b.clusterRegistry.getAll().sort() ).toEqual( [ 'server-name-b', 'server-name-c' ] );
		expect( c.clusterRegistry.getAll().sort() ).toEqual( [ 'server-name-b', 'server-name-c' ] );
	});
});