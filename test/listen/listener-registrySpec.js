/* global describe, expect, it, jasmine */
var ListenerRegistry = require('../../src/listen/listener-registry'),
	msg = require('../test-helper/test-helper').msg,
	SocketMock = require('../mocks/socket-mock'),
	SocketWrapper = require('../../src/message/socket-wrapper'),
	LoggerMock = require('../mocks/logger-mock'),
	clusterRegistryMock = new (require( '../mocks/cluster-registry-mock' ))(),
	noopMessageConnector = require('../../src/default-plugins/noop-message-connector');

var listenerRegistry,
	options = {
		clusterRegistry: clusterRegistryMock,
		messageConnector: noopMessageConnector,
		logger: {
			log: jasmine.createSpy( 'logger' )
		}
	},
	recordSubscriptionRegistryMock = {
		getNames: function() {
			return ['car/Mercedes', 'car/Abarth'];
		}
	};

describe('listener-registry errors', function() {

	beforeEach(function() {
		listeningSocket = new SocketWrapper(new SocketMock(), options );
		listenerRegistry = new ListenerRegistry('R', options, recordSubscriptionRegistryMock);
		expect(typeof listenerRegistry.handle).toBe('function');
	});

	it('adds a listener without message data', function() {
		var socketWrapper = new SocketWrapper(new SocketMock(), options );
		listenerRegistry.handle(socketWrapper, {
			topic: 'R',
			action: 'L',
			data: []
		});
		expect(options.logger.log).toHaveBeenCalledWith(3, 'INVALID_MESSAGE_DATA', undefined);
		expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|INVALID_MESSAGE_DATA|undefined+'));
	});

	it('adds a listener with invalid message data message data', function() {
		var socketWrapper = new SocketWrapper( new SocketMock(), options );
		listenerRegistry.handle(socketWrapper, {
			topic: 'R',
			action: 'L',
			data: [44]
		});
		expect(options.logger.log).toHaveBeenCalledWith(3, 'INVALID_MESSAGE_DATA', 44);
		expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|INVALID_MESSAGE_DATA|44+'));
	});

	it('adds a listener with an invalid regexp', function() {
		var socketWrapper = new SocketWrapper( new SocketMock(), options );
		listenerRegistry.handle(socketWrapper, {
			topic: 'R',
			action: 'L',
			data: ['us(']
		});
		expect(options.logger.log).toHaveBeenCalledWith(3, 'INVALID_MESSAGE_DATA', 'SyntaxError: Invalid regular expression: /us(/: Unterminated group');
		expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|INVALID_MESSAGE_DATA|SyntaxError: Invalid regular expression: /us(/: Unterminated group+'));
	});
});