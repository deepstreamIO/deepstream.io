var ClusterUniqueStateProvider = require( '../../src/cluster/cluster-unique-state-provider' );
var C = require( '../../src/constants/constants' );
var MessageConnectorMock = require( '../mocks/message-connector-mock' );
var ClusterRegistryMock = require( '../mocks/cluster-registry-mock' );

describe( 'unique state provider', function(){
	describe( 'handles local locks', function(){
		var options, uniqueStateProvider;

		beforeAll( () => {
			options = {
				serverName: 'server-name-a',
				messageConnector: new MessageConnectorMock(),
				logger: { log: jasmine.createSpy( 'log' ) },
				lockTimeout: 100,
				lockRequestTimeout: 50
			};

			var clusterRegistryMock = new ClusterRegistryMock( options );
			uniqueStateProvider = new ClusterUniqueStateProvider( options, clusterRegistryMock );
		} );

		it( 'subscribes to the lock on message bus', function(){
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

	describe( 'handles remote locks', function(){
		var options, uniqueStateProvider, lockCallbackA;

		beforeAll( () => {
			options = {
				serverName: 'server-name-a',
				messageConnector: new MessageConnectorMock(),
				logger: { log: jasmine.createSpy( 'log' ) },
				lockTimeout: 10,
				lockRequestTimeout: 10
			};

			var clusterRegistryMock = new ClusterRegistryMock( options );
			clusterRegistryMock.currentLeader = 'server-name-b';
			uniqueStateProvider = new ClusterUniqueStateProvider( options, clusterRegistryMock );
			lockCallbackA = jasmine.createSpy( 'lock-callback-a' );
		} );

		beforeEach( () => {
			lockCallbackA.calls.reset();
			options.logger.log.calls.reset();
		} );

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

		it( 'returns false if lock request times out', function( done ){
			uniqueStateProvider.get( 'lock-a', lockCallbackA );
			setTimeout( () => {
				expect( lockCallbackA ).toHaveBeenCalledWith( false );
				done();
			}, 20 );
		});

		it( 'returns false to second lock call before response', function(){
			uniqueStateProvider.get( 'lock-a', () => {} );
			uniqueStateProvider.get( 'lock-a', lockCallbackA );
			expect( lockCallbackA ).toHaveBeenCalledWith( false );
		});

		it( 'logs a warning on an unsupported action', function(){
			expect( lockCallbackA ).not.toHaveBeenCalled();
			options.messageConnector.simulateIncomingMessage({
				topic: 'LP_server-name-a',
				action: C.ACTIONS.SUBSCRIBE,
				data: [{
					name: 'lock-a',
					result: true
				}]
			});
			expect( options.logger.log ).toHaveBeenCalled();
			expect( options.logger.log ).toHaveBeenCalledWith( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, C.ACTIONS.SUBSCRIBE );
		});

		it( 'logs a warning on an unsupported action', function(){
			expect( lockCallbackA ).not.toHaveBeenCalled();
			options.messageConnector.simulateIncomingMessage({
				topic: 'LP_server-name-a',
				action: C.ACTIONS.LOCK_RELEASE,
				data: []
			});
			expect( options.logger.log ).toHaveBeenCalled();
			expect( options.logger.log ).toHaveBeenCalledWith( C.LOG_LEVEL.WARN, C.EVENT.INVALID_MESSAGE_DATA, [] );
		});

		it( 'recieves a ', function(){
			expect( lockCallbackA ).not.toHaveBeenCalled();
			options.messageConnector.simulateIncomingMessage({
				topic: 'LP_server-name-a',
				action: C.ACTIONS.LOCK_REQUEST,
				data: [ {
					name: 'lock-a',
					responseTopic: 'LP_server-name-a'
				} ]
			});
			expect( options.logger.log ).toHaveBeenCalled();
			expect( options.logger.log ).toHaveBeenCalledWith( C.LOG_LEVEL.WARN, C.EVENT.INVALID_LEADER_REQUEST, 'server server-name-a assumes this node \'server-name-a\' is the leader' );
		});
	});
});