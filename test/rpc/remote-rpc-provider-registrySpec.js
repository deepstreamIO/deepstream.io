var RemoteRpcProviderRegistry = require( '../../src/rpc/remote-rpc-provider-registry' ),
	MessageConnectorMock = require( '../mocks/message-connector-mock' ),
	C = require( '../../src/constants/constants' ),
	options = {
		messageConnector: new MessageConnectorMock(),
		rpcProviderQueryTimeout: 10,
		rpcProviderCacheTime: 40
	};

describe( 'keeps track of which remote deepstream instance can provide which rpc', function(){


	var registry;

	it( 'creates the registry', function(){
		expect( options.messageConnector.lastSubscribedTopic ).toBe( null );
		registry = new RemoteRpcProviderRegistry( options );
		expect( options.messageConnector.lastSubscribedTopic ).toBe( C.TOPIC.RPC );
	});

	it( 'queries other deepstream instances for remote providers', function(){
		var rpcAProviderCallback = jasmine.createSpy( 'addTwoProviderCallback' );

		expect( options.messageConnector.lastPublishedMessage ).toBe( null );

		registry.getProviderTopic( 'rpcA', rpcAProviderCallback );

		expect( options.messageConnector.lastPublishedMessage ).toEqual({
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.QUERY,
			data: [ 'rpcA' ]
		});

		expect( rpcAProviderCallback ).not.toHaveBeenCalled();

		options.messageConnector.simulateIncomingMessage({
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.PROVIDER_UPDATE,
			data: [{
				numberOfProviders: 2,
				privateTopic: 'privateTopicA',
				rpcName: 'rpcA'
			}]
		});

		expect( rpcAProviderCallback.calls.count() ).toBe( 1 );
		expect( rpcAProviderCallback ).toHaveBeenCalledWith( null, 'privateTopicA' );

		// make sure it doesn't invoke callbacks multiple times for subsequent provider updates
		options.messageConnector.simulateIncomingMessage({
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.PROVIDER_UPDATE,
			data: [{
				numberOfProviders: 2,
				privateTopic: 'privateTopicA',
				rpcName: 'rpcA'
			}]
		});

		expect( rpcAProviderCallback.calls.count() ).toBe( 1 );
	});

	it( 'handles unsolicited provider updates', function(){
		options.messageConnector.simulateIncomingMessage({
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.PROVIDER_UPDATE,
			data: [{
				numberOfProviders: 2,
				privateTopic: 'privateTopicB',
				rpcName: 'rpcB'
			}]
		});

		registry.getProviderTopic( 'rpcB', function( error, topic ){
			expect( topic ).toBe( 'privateTopicB' );
		});

		expect( options.messageConnector.lastPublishedMessage.data[ 0 ] ).toBe( 'rpcA' );
	});

	it( 'handles provider updates with multiple entries', function(){
		options.messageConnector.simulateIncomingMessage({
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.PROVIDER_UPDATE,
			data: [{
				numberOfProviders: 2,
				privateTopic: 'privateTopicC',
				rpcName: 'rpcC'
			},{
				numberOfProviders: 2,
				privateTopic: 'privateTopicC',
				rpcName: 'rpcD'
			}]
		});

		registry.getProviderTopic( 'rpcC', function( error, topic ){
			expect( topic ).toBe( 'privateTopicC' );
		});

		registry.getProviderTopic( 'rpcD', function( error, topic ){
			expect( topic ).toBe( 'privateTopicC' );
		});

		expect( options.messageConnector.lastPublishedMessage.data[ 0 ] ).toBe( 'rpcA' );
	});

	it( 'adds another provider', function(){
		expect( registry.getAllProviderTopics( 'rpcA' ) ).toEqual([ 'privateTopicA' ] );

		options.messageConnector.simulateIncomingMessage({
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.PROVIDER_UPDATE,
			data: [{
				numberOfProviders: 2,
				privateTopic: 'privateTopicC',
				rpcName: 'rpcA'
			}]
		});

		expect( registry.getAllProviderTopics( 'rpcA' ) ).toEqual([ 'privateTopicA', 'privateTopicC' ]);
	});

	it( 'returns different providers if multiple providers are available for the same rpc', function(){
		var hadTopicC = false,
			hadTopicA = false,
			callback = function( error, topic ){
				if( topic === 'privateTopicA' ) {
					hadTopicA = true;
				}

				if( topic === 'privateTopicC' ) {
					hadTopicC = true;
				}
			};

		while( hadTopicA === false || hadTopicC === false ) {
			registry.getProviderTopic( 'rpcA', callback );
		}

		expect( hadTopicA ).toBe( true );
		expect( hadTopicC ).toBe( true );
	});

	it( 'times out if query doesn\'t yield results in time', function( done ){
		var providerCallback = jasmine.createSpy( 'providerCallback' );

		expect( options.messageConnector.lastPublishedMessage.data[ 0 ] ).toBe( 'rpcA' );

		registry.getProviderTopic( 'rpcE', providerCallback );

		expect( options.messageConnector.lastPublishedMessage.data[ 0 ] ).toBe( 'rpcE' );

		expect( providerCallback ).not.toHaveBeenCalled();

		setTimeout(function(){
			expect( providerCallback.calls.count() ).toBe( 1 );
			expect( providerCallback ).toHaveBeenCalledWith( C.EVENT.NO_RPC_PROVIDER );
			done();
		}, 60 );
	});

	it( 'retuns topics for registered providers', function(){
		options.messageConnector.simulateIncomingMessage({
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.PROVIDER_UPDATE,
			data: [{
				numberOfProviders: 2,
				privateTopic: 'privateTopicA',
				rpcName: 'rpcA'
			}]
		});
		expect( registry.getAllProviderTopics( 'rpcA' ) ).toEqual([ 'privateTopicA' ]);
	});

	it( 'only executes one query for a topic at a time', function(){
		var callback = jasmine.createSpy( 'cb' );
		registry.getProviderTopic( 'rpcX', callback );
		expect( options.messageConnector.lastPublishedMessage.data[ 0 ] ).toBe( 'rpcX' );
		options.messageConnector.reset();
		expect( options.messageConnector.lastPublishedMessage ).toBe( null );
		registry.getProviderTopic( 'rpcX', callback );
		expect( options.messageConnector.lastPublishedMessage ).toBe( null );
	});
});