var EventEmitter = require( 'events' ).EventEmitter,
	PresenceHandler = require( '../../src/presence/presence-handler' ),
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
		logger: new LoggerMock(),
		connectionEndpoint: new EventEmitter()
	},
	queryMessage = {
			 topic: C.TOPIC.PRESENCE,
			 action: C.ACTIONS.QUERY,
			 data: null
	},
	presenceHandler = new PresenceHandler( options );
	userOne = new SocketWrapper( new SocketMock(), {} ); userOne.user = 'Homer';
	userTwo = new SocketWrapper( new SocketMock(), {} ); userTwo.user = 'Marge';
	userTwoAgain = new SocketWrapper( new SocketMock(), {} ); userTwoAgain.user = 'Marge';
	userThree = new SocketWrapper( new SocketMock(), {} ); userThree.user = 'Bart';

describe( 'presence handler', function(){

	beforeEach( function() {
		userOne.socket.lastSendMessage = null;
		userTwo.socket.lastSendMessage = null;
		userThree.socket.lastSendMessage = null;
	});

	it( 'adds client and subscribes to client logins and logouts', function(){
		options.connectionEndpoint.emit( 'client-connected', userOne );

		var subMsg = { topic: C.TOPIC.PRESENCE, action: C.ACTIONS.SUBSCRIBE, data: [ C.ACTIONS.PRESENCE_JOIN ] }
		presenceHandler.handle( userOne, subMsg );

		var unSubMsg = { topic: C.TOPIC.PRESENCE, action: C.ACTIONS.SUBSCRIBE, data: [ C.ACTIONS.PRESENCE_LEAVE ] }
		presenceHandler.handle( userOne, unSubMsg );
	});

	it( 'does not return own name when queried and only user', function(){
		presenceHandler.handle( userOne, queryMessage );
		expect( userOne.socket.lastSendMessage ).toBe( _msg( 'U|Q+' ) );
	});

	it( 'adds a client and notifies original client', function(){
		options.connectionEndpoint.emit( 'client-connected', userTwo );
		expect( userOne.socket.lastSendMessage ).toBe( _msg( 'U|PNJ|Marge+' ) );
	});

	it( 'returns one user when queried', function(){
		presenceHandler.handle( userOne, queryMessage );
		expect( userOne.socket.lastSendMessage ).toBe( _msg( 'U|Q|Marge+' ) );
	});

	it( 'same username having another connection does not send an update', function(){
		options.connectionEndpoint.emit( 'client-connected', userTwoAgain );
		expect( userOne.socket.lastSendMessage ).toBeNull();
	});

	it( 'add another client and only subscribed clients get notified', function() {
		options.connectionEndpoint.emit( 'client-connected', userThree );
		expect( userOne.socket.lastSendMessage ).toBe( _msg( 'U|PNJ|Bart+' ) );
		expect( userTwo.socket.lastSendMessage ).toBeNull();
		expect( userThree.socket.lastSendMessage ).toBeNull();
	});

	it( 'returns multiple uses when queried', function(){
		presenceHandler.handle( userOne, queryMessage );
		expect( userOne.socket.lastSendMessage ).toBe( _msg( 'U|Q|Marge|Bart+' ) );
	});

	it( 'client three disconnects', function(){
		options.connectionEndpoint.emit( 'client-disconnected', userThree );
		expect( userOne.socket.lastSendMessage ).toBe( _msg( 'U|PNL|Bart+' ) );
		expect( userTwo.socket.lastSendMessage ).toBeNull();
		expect( userThree.socket.lastSendMessage ).toBeNull();
	});

});
