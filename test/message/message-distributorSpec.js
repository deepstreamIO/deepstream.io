var SocketMock = require( '../mocks/socket-mock' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	LoggerMock = require( '../mocks/logger-mock' ),
	messageConnectorMock = new (require( '../mocks/message-connector-mock' ))(),
	MessageDistributor = require( '../../src/message/message-distributor' ),
	_msg = require( '../test-helper/test-helper' ).msg;

describe( 'message connector distributes messages to callbacks', function(){
	var messageDistributor,
		testCallback = jasmine.createSpy( 'testCallback' );

	it( 'creates the message distributor', function(){
		messageDistributor = new MessageDistributor({
			messageConnector: messageConnectorMock,
			logger: new LoggerMock()
		});
	});

	it( 'routes topics to subscribers', function(){
		expect( testCallback ).not.toHaveBeenCalled();
		expect( messageConnectorMock.lastSubscribedTopic ).toBe( null );
		messageDistributor.registerForTopic( 'someTopic', testCallback );
		expect( messageConnectorMock.lastSubscribedTopic ).toBe( 'someTopic' );
		var socketWrapper = new SocketWrapper( new SocketMock(), {} ),
			msg = { 'topic': 'someTopic' };

		messageDistributor.distribute( socketWrapper, msg );
		expect( testCallback.calls.count() ).toEqual( 1 );
	});

	it( 'routes messages from the message connector', function(){
		var cb = jasmine.createSpy( 'callback' );
		messageDistributor.registerForTopic( 'topicB', cb );
		expect( messageConnectorMock.lastSubscribedTopic ).toBe( 'topicB' );
		expect( cb ).not.toHaveBeenCalled();
		messageConnectorMock.simulateIncomingMessage({ topic: 'topicB' });
		expect( cb ).toHaveBeenCalled();
	});

	it( 'only routes matching topics', function(){
		expect( testCallback.calls.count() ).toEqual( 1 );

		var socketWrapper = new SocketWrapper( new SocketMock(), {} ),
			msg = { 'topic': 'someOtherTopic' };

		messageDistributor.distribute( socketWrapper, msg );
		expect( testCallback.calls.count() ).toEqual( 1 );
	});

	it( 'throws an error for multiple registrations to the same topic', function(){
		var hasErrored = false;

		try{
			messageDistributor.registerForTopic( 'someTopic', testCallback );
		} catch( e ) {
			hasErrored = true;
		}

		expect( hasErrored ).toBe( true );
	});

	it( 'sends errors for messages to unknown topics', function(){
		var socketWrapper = new SocketWrapper( new SocketMock(), {} ),
			msg = { 'topic': 'gibberish' };
		expect( socketWrapper.socket.lastSendMessage ).toBe( null );
		messageDistributor.distribute( socketWrapper, msg );
		expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'X|E|UNKNOWN_TOPIC|gibberish+' ) );
	});
});