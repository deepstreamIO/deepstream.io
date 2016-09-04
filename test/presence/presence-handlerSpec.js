var PresenceHandler = require( '../../src/presence/presence-handler' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	C = require( '../../src/constants/constants' ),
	_msg = require( '../test-helper/test-helper' ).msg,
	SocketMock = require( '../mocks/socket-mock' ),
	messageConnectorMock = new (require( '../mocks/message-connector-mock' ))(),
	clusterRegistryMock = new (require( '../mocks/cluster-registry-mock' ))(),
	LoggerMock = require( '../mocks/logger-mock' ),
	options = {
		clusterRegistry: clusterRegistryMock,
		serverName: 'server-name-a',
		stateReconciliationTimeout: 10,
		messageConnector: messageConnectorMock,
		logger: new LoggerMock()
	},
	presenceMessage = {
			 topic: C.TOPIC.PRESENCE,
			 action: C.ACTIONS.PRESENCE_JOIN,
			 raw: 'rawMessageString',
			 data: null
	},
	presenceHandler = new PresenceHandler( options );
	userOne = new SocketWrapper( new SocketMock(), {} ); userOne.user = 'Homer';
	userTwo = new SocketWrapper( new SocketMock(), {} ); userTwo.user = 'Marge';
	userThree = new SocketWrapper( new SocketMock(), {} ); userThree.user = 'Bart';

describe( 'presence handler handles clients added correctly', function(){

	it( 'adds client and subscribes to client logins', function(){
		presenceHandler.handle( userOne, presenceMessage );
		var subMsg = { topic: C.TOPIC.PRESENCE, action: C.ACTIONS.SUBSCRIBE, data: [ C.ACTIONS.PRESENCE_JOIN ] }
		presenceHandler.handle( userOne, subMsg );	
	});

	it( 'adds a client and notifies original client', function(){
		presenceHandler.handle( userTwo, presenceMessage );
		expect( userOne.socket.lastSendMessage ).toBe( _msg( 'PN|PNJ|Marge+' ) );
	});

	it( 'add another client and only subscribed clients get notified', function() {
		presenceHandler.handle( userThree, presenceMessage );
		expect( userOne.socket.lastSendMessage ).toBe( _msg( 'PN|PNJ|Bart+' ) );
		expect( userTwo.socket.lastSendMessage ).toBe( null );
	});

	it( 'client with no username doesnt notify clients', function(){
		presenceHandler.handle( new SocketWrapper( new SocketMock(), {} ), presenceMessage );
		expect( userOne.socket.lastSendMessage ).toBe( _msg( 'PN|PNJ|Bart+' ) );
		expect( userTwo.socket.lastSendMessage ).toBe( null );
		expect( userThree.socket.lastSendMessage ).toBe( null );
	});
});

describe( 'presence handler handles queries correctly', function(){

	it( 'queries for clients', function(){
		presenceMessage.action = C.ACTIONS.QUERY;
		presenceHandler.handle( userOne, presenceMessage );
		expect( userOne.socket.lastSendMessage ).toBe( _msg( 'PN|Q|Homer|Marge|Bart+' ) );
	});
});
