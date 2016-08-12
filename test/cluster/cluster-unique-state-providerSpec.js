var ClusterUniqueStateProvider = require( '../../src/cluster/cluster-unique-state-provider' );
var C = require( '../../src/constants/constants' );
var MessageConnectorMock = require( '../mocks/message-connector-mock' );
var ClusterRegistryMock = require( '../mocks/cluster-registry-mock' );


fdescribe( 'unique-state-provider elects a leader', function(){
	var uniqueStateProvider;

	var options = {
		serverName: 'server-name-a',
		messageConnector: new MessageConnectorMock(),
		logger: { log: jasmine.createSpy( 'log' ) }
	};

	var clusterRegistryMock = new ClusterRegistryMock();


	it( 'creates the provider', function(){
		uniqueStateProvider = new ClusterUniqueStateProvider( options, clusterRegistryMock );
		expect( uniqueStateProvider._currentLeader ).toBe( null );
		expect( uniqueStateProvider._iAmTheLeader ).toBe( false );
		expect( options.messageConnector.publishedMessages.length ).toBe( 2 );

		expect( options.messageConnector.publishedMessages[ 0 ] ).toEqual({
			topic: C.TOPIC.LEADER,
			action: C.ACTIONS.LEADER_REQUEST,
			data: []
		});

		expect( options.messageConnector.publishedMessages[ 1 ].topic ).toBe( C.TOPIC.LEADER );
		expect( options.messageConnector.publishedMessages[ 1 ].action ).toBe( C.ACTIONS.LEADER_VOTE );
		expect( options.messageConnector.publishedMessages[ 1 ].data[ 0 ] ).toBe( 'server-name-a' );
		var vote = options.messageConnector.publishedMessages[ 1 ].data[ 1 ];
		expect( typeof vote === 'number' && vote > 0 && vote < 1 ).toBe( true );
	});

	it( 'receives a leader vote', function(){
		options.messageConnector.simulateIncomingMessage({
			topic: C.TOPIC.LEADER,
			action: C.ACTIONS.LEADER_VOTE,
			data: [ 'server-name-b', 0.5 ]
		});

		expect( uniqueStateProvider._currentLeader ).toBe( null );
		expect( uniqueStateProvider._iAmTheLeader ).toBe( false );
	});

	it( 'receives the final leader vote', function(){
		options.messageConnector.simulateIncomingMessage({
			topic: C.TOPIC.LEADER,
			action: C.ACTIONS.LEADER_VOTE,
			data: [ 'server-name-c', 0.99999 ]
		});

		expect( uniqueStateProvider._currentLeader ).toBe( 'server-name-c' );
		expect( uniqueStateProvider._iAmTheLeader ).toBe( false );
	});
});