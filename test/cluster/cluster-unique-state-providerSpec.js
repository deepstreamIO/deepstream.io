var ClusterUniqueStateProvider = require( '../../src/cluster/cluster-unique-state-provider' );
var C = require( '../../src/constants/constants' );
var MessageConnectorMock = require( '../mocks/message-connector-mock' );
var ClusterRegistryMock = require( '../mocks/cluster-registry-mock' );


describe( 'unique state provider handles local locks', function(){
	var uniqueStateProvider;

	var options = {
		serverName: 'server-name-a',
		messageConnector: new MessageConnectorMock(),
		logger: { log: jasmine.createSpy( 'log' ) },
		lockTimeout: 100,
		lockRequestTimeout: 50
	};

	var clusterRegistryMock = new ClusterRegistryMock();


	it( 'creates the provider', function(){
		uniqueStateProvider = new ClusterUniqueStateProvider( options, clusterRegistryMock );
		expect( typeof uniqueStateProvider.get ).toBe( 'function' );
		expect( options.messageConnector.lastSubscribedTopic ).toBe( 'LP_server-name-a' );
	});

	it( 'is the leader and returns a local lock', function( done ){
		uniqueStateProvider.get( 'lock-a', function( success ){
			expect( success ).toBe( true );
			expect( options.messageConnector.lastPublishedMessage ).toBe( null );
			done();
		});
	});

	it( 'has kept the local lock', function( done ){
		uniqueStateProvider.get( 'lock-a', function( success ){
			expect( success ).toBe( false );
			expect( options.messageConnector.lastPublishedMessage ).toBe( null );
			done();
		});
	});

	it( 'releases the local lock', function( done ){
		uniqueStateProvider.release( 'lock-a')
		uniqueStateProvider.get( 'lock-a', function( success ){
			expect( success ).toBe( true );
			expect( options.messageConnector.lastPublishedMessage ).toBe( null );
			done();
		});
	});
});

describe( 'unique state provider handles remove locks', function(){
	var uniqueStateProvider;

	var options = {
		serverName: 'server-name-a',
		messageConnector: new MessageConnectorMock(),
		logger: { log: jasmine.createSpy( 'log' ) },
		lockTimeout: 100,
		lockRequestTimeout: 50
	};

	var clusterRegistryMock = new ClusterRegistryMock();
	clusterRegistryMock.currentLeader = 'server-name-b';
	var lockCallbackA = jasmine.createSpy( 'lock-callback-a' );

	it( 'creates the provider', function(){
		uniqueStateProvider = new ClusterUniqueStateProvider( options, clusterRegistryMock );
		expect( typeof uniqueStateProvider.get ).toBe( 'function' );
		expect( options.messageConnector.lastSubscribedTopic ).toBe( 'LP_server-name-a' );
	});

	it( 'queries for a remote lock', function(){
		uniqueStateProvider.get( 'lock-a', lockCallbackA );
		expect( lockCallbackA ).not.toHaveBeenCalled();
		expect( options.messageConnector.lastPublishedMessage ).toEqual({
			topic: 'LP_server-name-b',
			action: C.ACTIONS.LOCK_REQUEST,
			data: [{
				name: 'lock-a',
				responseTopic: 'LP_server-name-a'
			}]
		});
	});

	it( 'returns a positive response for lock-a', function(){
		expect( lockCallbackA ).not.toHaveBeenCalled();
		options.messageConnector.simulateIncomingMessage({
			topic: 'LP_server-name-a',
			action: C.ACTIONS.LOCK_RESPONSE,
			data: [{
				name: 'lock-a',
				result: true
			}]
		});
		expect( options.logger.log ).not.toHaveBeenCalled();
		expect( lockCallbackA ).toHaveBeenCalledWith( true );
	});

	it( 'releases the remote lock', function(){
		options.messageConnector.reset();
		uniqueStateProvider.release( 'lock-a' );
		expect( options.messageConnector.lastPublishedMessage ).toEqual({
			topic: 'LP_server-name-b',
			action: C.ACTIONS.LOCK_RELEASE,
			data:[{
				name: 'lock-a'
			}]
		});
	});
});