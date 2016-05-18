
/* global it, describe, expect, jasmine */
var proxyquire = require( 'proxyquire' ),
	RecordRequestMock = require( '../mocks/record-request-mock' ),
	RecordTransition = proxyquire( '../../src/record/record-transition', { './record-request': RecordRequestMock } ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	SocketMock = require( '../mocks/socket-mock' ),
	msg = require( '../test-helper/test-helper' ).msg,
	StorageMock = require( '../mocks/storage-mock' );

describe( 'record transitions', function() {

	describe( 'happy path', function() {
		
		var recordTransition,
			socketWrapper = new SocketWrapper( new SocketMock(), {} ),
			patchMessage = { topic: 'RECORD', action: 'P', data: [ 'someRecord', 1, 'firstname', 'SEgon' ] },
			recordHandlerMock = { _$broadcastUpdate: jasmine.createSpy(), _$transitionComplete: jasmine.createSpy() },
			options = { cache: new StorageMock(), storage: new StorageMock() }; 

		it( 'creates the transition', function() {
			recordTransition = new RecordTransition( 'someRecord', options, recordHandlerMock );
			expect( recordTransition.hasVersion ).toBeDefined();
			expect( recordTransition.hasVersion( 2 ) ).toBe( false );
		} );

		it( 'adds a patch to the queue', function() {
			expect( recordTransition._recordRequest ).toBe( null );
			recordTransition.add( socketWrapper, 1, patchMessage );
			expect( recordTransition._recordRequest ).toBeDefined();
			expect( recordTransition._recordRequest.recordName ).toBe( 'someRecord' );
		} );

		it( 'retrieves the empty record', function() {
			expect( recordHandlerMock._$broadcastUpdate ).not.toHaveBeenCalled();
			expect( recordHandlerMock._$transitionComplete ).not.toHaveBeenCalled();
			recordTransition._recordRequest.onComplete({ _v: 0, _d: {} } );
			expect( recordHandlerMock._$broadcastUpdate ).toHaveBeenCalledWith( 'someRecord', patchMessage, socketWrapper );
			expect( recordHandlerMock._$transitionComplete ).toHaveBeenCalledWith( 'someRecord' );
		} );
	} );

	describe( 'multiple steps', function() {
		var recordTransition,
			socketWrapper = new SocketWrapper( new SocketMock(), {} ),
			patchMessage = { topic: 'RECORD', action: 'P', data: [ 'someRecord', 1, 'firstname', 'SEgon' ] },
			patchMessage2 = { topic: 'RECORD', action: 'P', data: [ 'someRecord', 3, 'firstname', 'SLana' ] },
			updateMessage = { topic: 'RECORD', action: 'U', data: [ 'someRecord', 2, '{ "lastname": "Peterson" }' ] },
			recordHandlerMock = { 
				_$broadcastUpdate: jasmine.createSpy( '_$broadcastUpdate' ), 
				_$transitionComplete: jasmine.createSpy( '_$transitionComplete' ) },
			options = { cache: new StorageMock(), storage: new StorageMock() }; 

		options.cache.nextOperationWillBeSynchronous = false;

		it( 'creates the transition', function() {
			recordTransition = new RecordTransition( 'someRecord', options, recordHandlerMock );
			expect( recordTransition._record ).toBe( null );
			expect( recordTransition.hasVersion ).toBeDefined();
			expect( recordTransition.hasVersion( 2 ) ).toBe( false );
		} );

		it( 'adds a patch to the queue', function() {
			expect( recordTransition._recordRequest ).toBe( null );
			recordTransition.add( socketWrapper, 1, patchMessage );
			expect( recordTransition._recordRequest ).toBeDefined();
			expect( recordTransition._recordRequest.recordName ).toBe( 'someRecord' );
			expect( recordTransition._record ).toBe( null );
		} );

		it( 'adds an update to the queue', function() {
			expect( recordTransition._steps.length ).toBe( 1 );
			recordTransition.add( socketWrapper, 2, updateMessage );
			expect( recordTransition._steps.length ).toBe( 2 );
		} );

		it( 'adds a message with invalid data to the queue', function() {
			socketWrapper.socket.lastSendMessage = null;
			recordTransition.add( socketWrapper, 3, {
				topic: 'RECORD', 
				action: 'U',
				data: [ 1 ]
			});
			expect( recordTransition._steps.length ).toBe( 2 );
			expect( socketWrapper.socket.lastSendMessage).toBe( msg( 'R|E|INVALID_MESSAGE_DATA|undefined+' ) );
		} );

		it( 'adds a message with broken data to the queue', function() {
			socketWrapper.socket.lastSendMessage = null;
			recordTransition.add( socketWrapper, 3, {
				topic: 'RECORD', 
				action: 'U',
				data: [ 'someRecord', 2, '{ "lastname": "Peterson' ]
			});
			expect( recordTransition._steps.length ).toBe( 2 );
			expect( socketWrapper.socket.lastSendMessage).toBe( msg( 'R|E|INVALID_MESSAGE_DATA|undefined+' ) );
		} );

		it( 'retrieves the empty record', function( done ){
			expect( recordHandlerMock._$broadcastUpdate ).not.toHaveBeenCalled();
			expect( recordHandlerMock._$transitionComplete ).not.toHaveBeenCalled();
			expect( recordTransition._steps.length ).toBe( 2 );
			expect( recordTransition._record ).toBe( null );
			recordTransition._recordRequest.onComplete({ _v: 0, _d: { lastname: 'Kowalski' } } );
			expect( recordTransition._record ).toEqual({ _v: 1, _d: { firstname: 'Egon', lastname: 'Kowalski' } } );
			expect( options.cache.completedSetOperations ).toBe( 0 );
			var check = setInterval(function() {
				if( options.cache.completedSetOperations === 1 ) {
					expect( recordHandlerMock._$broadcastUpdate ).toHaveBeenCalledWith( 'someRecord', patchMessage, socketWrapper );
					expect( recordHandlerMock._$transitionComplete ).not.toHaveBeenCalled();
					expect( recordTransition._record ).toEqual({ _v: 2, _d: { lastname: 'Peterson' } } );
					clearInterval( check );
					done();
				}
			}, 1 );
		} );

		it( 'receives a patch message whilst the transition is in progress', function() {
			expect( recordHandlerMock._$transitionComplete ).not.toHaveBeenCalled();
			recordTransition.add( socketWrapper, 3, patchMessage2 );
		} );  

		it( 'returns hasVersion for 1,2 and 3', function() {
			expect( recordTransition.hasVersion( 0 ) ).toBe( true );
			expect( recordTransition.hasVersion( 1 ) ).toBe( true );
			expect( recordTransition.hasVersion( 2 ) ).toBe( true );
			expect( recordTransition.hasVersion( 3 ) ).toBe( true );
			expect( recordTransition.hasVersion( 4 ) ).toBe( false );
			expect( recordTransition.hasVersion( 5 ) ).toBe( false );
		} );

		it( 'processes the next step in the queue', function( done ){
			var check = setInterval(function() {
				if( options.cache.completedSetOperations === 2 ) {
					expect( recordHandlerMock._$broadcastUpdate ).toHaveBeenCalledWith( 'someRecord', updateMessage, socketWrapper );
					expect( recordHandlerMock._$transitionComplete ).not.toHaveBeenCalled();
					expect( recordTransition._record ).toEqual({ _v: 3, _d: { firstname: 'Lana', lastname: 'Peterson' } } );
					clearInterval( check );
					done();
				}
			}, 1 );
		} );

		it( 'processes the final step in the queue', function( done ){
			var check = setInterval(function() {
				if( options.cache.completedSetOperations === 3 ) {
					expect( recordHandlerMock._$broadcastUpdate ).toHaveBeenCalledWith( 'someRecord', patchMessage2, socketWrapper );
					expect( recordHandlerMock._$transitionComplete ).toHaveBeenCalled();
					clearInterval( check );
					done();
				}
			}, 1 );
		} );

		it( 'stored each transition in storage', function( done ){
			var check = setInterval(function() {
				if( options.storage.completedSetOperations === 3 ) {
					done();
				}
			}, 1 );
		} );
	} );

	describe( 'does not store excluded data', function() {
		var recordTransition,
			socketWrapper = new SocketWrapper( new SocketMock(), {} ),
			patchMessage = { topic: 'RECORD', action: 'P', data: [ 'no-storage/1', 1, 'firstname', 'SEgon' ] },
			recordHandlerMock = { _$broadcastUpdate: jasmine.createSpy(), _$transitionComplete: jasmine.createSpy() },
			options = { cache: new StorageMock(), storage: new StorageMock(), storageExclusion: new RegExp( 'no-storage/' ) }; 

		it( 'creates the transition', function() {
			recordTransition = new RecordTransition( 'no-storage/1', options, recordHandlerMock );
			expect( recordTransition.hasVersion ).toBeDefined();
			expect( recordTransition.hasVersion( 2 ) ).toBe( false );
		} );

		it( 'adds a patch to the queue', function() {
			expect( recordTransition._recordRequest ).toBe( null );
			recordTransition.add( socketWrapper, 1, patchMessage );
			expect( recordTransition._recordRequest ).toBeDefined();
			expect( recordTransition._recordRequest.recordName ).toBe( 'no-storage/1' );
		} );

		it( 'retrieves the empty record', function() {
			expect( recordHandlerMock._$broadcastUpdate ).not.toHaveBeenCalled();
			expect( recordHandlerMock._$transitionComplete ).not.toHaveBeenCalled();
			recordTransition._recordRequest.onComplete({ _v: 0, _d: {} } );
			expect( recordHandlerMock._$broadcastUpdate ).toHaveBeenCalledWith( 'no-storage/1', patchMessage, socketWrapper );
			expect( recordHandlerMock._$transitionComplete ).toHaveBeenCalledWith( 'no-storage/1' );
		} );

		it( 'does not store transition in storage', function( done ){
			var check = setInterval(function() {
				if( options.storage.completedSetOperations === 0 ) {
					done();
				}
			}, 1 );
		} );
	} );

	describe( 'destroys a transition between steps', function() {
		var recordTransition,
			socketWrapper = new SocketWrapper( new SocketMock(), {} ),
			firstPatchMessage = { topic: 'RECORD', action: 'P', data: [ 'someRecord', 1, 'firstname', 'SEgon' ] },
			secondPatchMessage = { topic: 'RECORD', action: 'P', data: [ 'someRecord', 2, 'firstname', 'SEgon' ] },
			recordHandlerMock = { _$broadcastUpdate: jasmine.createSpy(), _$transitionComplete: jasmine.createSpy() },
			options = { cache: new StorageMock(), storage: new StorageMock() };

		options.cache.nextOperationWillBeSynchronous = false;

		it( 'creates the transition', function() {
			recordTransition = new RecordTransition( 'someRecord', options, recordHandlerMock );
			expect( recordTransition.hasVersion ).toBeDefined();
			expect( recordTransition.hasVersion( 2 ) ).toBe( false );
		} );

		it( 'adds a patch to the queue', function() {
			expect( recordTransition._recordRequest ).toBe( null );
			recordTransition.add( socketWrapper, 1, firstPatchMessage );
			expect( recordTransition._recordRequest ).toBeDefined();
			expect( recordTransition._recordRequest.recordName ).toBe( 'someRecord' );
			recordTransition._recordRequest.onComplete({ _v: 0, _d: {} });
		} );

		it( 'adds a patch to the queue', function() {
			expect(function(){
				recordTransition.add( socketWrapper, 2, secondPatchMessage );
				expect( recordTransition.hasVersion( 2 ) ).toBe( true );
			}).not.toThrow();
		} );
	} );

	describe( 'tries to set a record, but everything goes wrong', function() {
		var recordTransition,
			socketWrapper = new SocketWrapper( new SocketMock(), {} ),
			patchMessage = { topic: 'RECORD', action: 'P', data: [ 'someRecord', 1, 'firstname', 'SEgon' ] },
			recordHandlerMock = { _$broadcastUpdate: jasmine.createSpy(), _$transitionComplete: jasmine.createSpy() },
			options = { 
				cache: new StorageMock(), 
				storage: new StorageMock(),
				logger: { log: jasmine.createSpy( 'log' ) }
			};

		options.cache.nextOperationWillBeSynchronous = true;
		options.cache.nextOperationWillBeSuccessful = false;
		options.storage.nextOperationWillBeSuccessful = false;

		it( 'creates the transition', function() {
			recordTransition = new RecordTransition( 'someRecord', options, recordHandlerMock );
			expect( recordTransition.hasVersion ).toBeDefined();
			expect( recordTransition.hasVersion( 2 ) ).toBe( false );
		} );

		it( 'adds a patch to the queue', function() {
			expect( recordTransition._recordRequest ).toBe( null );
			recordTransition.add( socketWrapper, 1, patchMessage );
			expect( recordTransition._recordRequest ).toBeDefined();
			expect( recordTransition._recordRequest.recordName ).toBe( 'someRecord' );
			recordTransition._recordRequest.onComplete({ _v: 0, _d: {} });
			expect( options.logger.log ).toHaveBeenCalledWith(  3, 'RECORD_UPDATE_ERROR', 'storageError' );
		} );
	} );

	describe( 'destroys the transition', function() {
		var recordTransition,
			socketWrapper = new SocketWrapper( new SocketMock(), {} ),
			patchMessage = { topic: 'RECORD', action: 'P', data: [ 'someRecord', 1, 'firstname', 'SEgon' ] },
			recordHandlerMock = { _$broadcastUpdate: jasmine.createSpy(), _$transitionComplete: jasmine.createSpy() },
			options = { cache: new StorageMock(), storage: new StorageMock() };

		options.cache.nextOperationWillBeSynchronous = false;

		it( 'creates the transition', function() {
			recordTransition = new RecordTransition( 'someRecord', options, recordHandlerMock );
			expect( recordTransition.hasVersion ).toBeDefined();
			expect( recordTransition.hasVersion( 2 ) ).toBe( false );
		} );

		it( 'adds a patch to the queue', function() {
			expect( recordTransition._recordRequest ).toBe( null );
			recordTransition.add( socketWrapper, 1, patchMessage );
			expect( recordTransition._recordRequest ).toBeDefined();
			expect( recordTransition._recordRequest.recordName ).toBe( 'someRecord' );
			recordTransition._recordRequest.onComplete({ _v: 0, _d: {} });
		} );

		it( 'adds a patch to the queue', function() {
			recordTransition.add( socketWrapper, 1, patchMessage );
		} );

		it( 'destroys the transition', function( done ){
			recordTransition.destroy();
			expect( recordTransition.isDestroyed ).toBe( true );
			expect( recordTransition._steps ).toBe( null );
			setTimeout(function() {
				//just leave this here to make sure no error is thrown when the
				//record request returns after 30ms
				done();
			}, 50 );
		} );

		it( 'calls destroy a second time without causing problems', function(){
			recordTransition.destroy();
			expect( recordTransition.isDestroyed ).toBe( true );
			expect( recordTransition._steps ).toBe( null );
		});
	} );

	describe( 'recordRequest returns an error', function() {
		var recordTransition,
			socketWrapper = new SocketWrapper( new SocketMock(), {} ),
			patchMessage = { topic: 'RECORD', action: 'P', data: [ 'someRecord', 1, 'firstname', 'SEgon' ] },
			recordHandlerMock = { _$broadcastUpdate: jasmine.createSpy(), _$transitionComplete: jasmine.createSpy() },
			logSpy = jasmine.createSpy( 'log' ),
			options = { cache: new StorageMock(), storage: new StorageMock(), logger: {log: logSpy } };

		options.cache.nextOperationWillBeSynchronous = false;

		it( 'creates the transition', function() {
			recordTransition = new RecordTransition( 'someRecord', options, recordHandlerMock );
			expect( recordTransition.hasVersion ).toBeDefined();
			expect( recordTransition.hasVersion( 2 ) ).toBe( false );
		} );

		it( 'adds a patch to the queue', function() {
			expect( recordTransition._recordRequest ).toBe( null );
			recordTransition.add( socketWrapper, 1, patchMessage );
			expect( recordTransition._recordRequest ).toBeDefined();
			expect( recordTransition._recordRequest.recordName ).toBe( 'someRecord' );
		} );

		it( 'receives an error', function() {
			expect( socketWrapper.socket.lastSendMessage ).toBe( null );
			recordTransition._recordRequest.onError( 'errorMsg' );
			expect( logSpy ).toHaveBeenCalledWith( 3, 'RECORD_UPDATE_ERROR', 'errorMsg' );
			expect( socketWrapper.socket.lastSendMessage ).toBe( msg( 'R|E|RECORD_UPDATE_ERROR|1+' ) );
		} );

		
	} );

	describe( 'recordRequest returns null', function() {
		var recordTransition,
			socketWrapper = new SocketWrapper( new SocketMock(), {} ),
			patchMessage = { topic: 'RECORD', action: 'P', data: [ 'someRecord', 1, 'firstname', 'SEgon' ] },
			recordHandlerMock = { _$broadcastUpdate: jasmine.createSpy(), _$transitionComplete: jasmine.createSpy() },
			logSpy = jasmine.createSpy( 'log' ),
			options = { cache: new StorageMock(), storage: new StorageMock(), logger: {log: logSpy } };

		options.cache.nextOperationWillBeSynchronous = false;

		it( 'creates the transition', function() {
			recordTransition = new RecordTransition( 'someRecord', options, recordHandlerMock );
			expect( recordTransition.hasVersion ).toBeDefined();
			expect( recordTransition.hasVersion( 2 ) ).toBe( false );
		} );

		it( 'adds a patch to the queue', function() {
			expect( recordTransition._recordRequest ).toBe( null );
			recordTransition.add( socketWrapper, 1, patchMessage );
			expect( recordTransition._recordRequest ).toBeDefined();
			expect( recordTransition._recordRequest.recordName ).toBe( 'someRecord' );
		} );

		it( 'receives a non existant error', function() {
			expect( socketWrapper.socket.lastSendMessage ).toBe( null );
			recordTransition._recordRequest.onComplete( null, null );
			expect( logSpy ).toHaveBeenCalledWith( 3, 'RECORD_UPDATE_ERROR', 'Received update for non-existant record someRecord' );
			expect( socketWrapper.socket.lastSendMessage ).toBe( msg( 'R|E|RECORD_UPDATE_ERROR|1+' ) );
		} );
	});

	describe( 'handles invalid message data', function() {
		var recordTransition,
			socketWrapper = new SocketWrapper( new SocketMock(), {} ),
			patchMessage = { topic: 'RECORD', action: 'P', data: [ 'someRecord', 2, 'somepath', 'O{"invalid":"json' ] },
			recordHandlerMock = { _$broadcastUpdate: jasmine.createSpy(), _$transitionComplete: jasmine.createSpy() },
			logSpy = jasmine.createSpy( 'log' ),
			options = { cache: new StorageMock(), storage: new StorageMock(), logger: {log: logSpy } };

		options.cache.nextOperationWillBeSynchronous = false;

		it( 'creates the transition', function() {
			recordTransition = new RecordTransition( 'someRecord', options, recordHandlerMock );
			expect( recordTransition.hasVersion ).toBeDefined();
			expect( recordTransition.hasVersion( 2 ) ).toBe( false );
		} );

		it( 'adds a patch to the queue', function() {
			expect( recordTransition._recordRequest ).toBe( null );
			recordTransition.add( socketWrapper, 2, patchMessage );
			expect( recordTransition._recordRequest ).toBe( null );
		} );

		it( 'receives an error', function() {
			expect( socketWrapper.socket.lastSendMessage ).toContain( msg( 'R|E|INVALID_MESSAGE_DATA|') );
		} );
	} );

	describe( 'handles invalid message data', function() {
		var recordTransition,
			socketWrapper = new SocketWrapper( new SocketMock(), {} ),
			patchMessage = { topic: 'RECORD', action: 'P', data: [ 'someRecord', 2, 'somepath', 'O{"invalid":"json' ] },
			recordHandlerMock = { _$broadcastUpdate: jasmine.createSpy(), _$transitionComplete: jasmine.createSpy() },
			logSpy = jasmine.createSpy( 'log' ),
			options = { cache: new StorageMock(), storage: new StorageMock(), logger: {log: logSpy } };

		options.cache.nextOperationWillBeSynchronous = false;

		it( 'creates the transition', function() {
			recordTransition = new RecordTransition( 'someRecord', options, recordHandlerMock );
			expect( recordTransition.hasVersion ).toBeDefined();
			expect( recordTransition.hasVersion( 2 ) ).toBe( false );
		} );

		it( 'adds a patch to the queue', function() {
			expect( recordTransition._recordRequest ).toBe( null );
			recordTransition.add( socketWrapper, 2, patchMessage );
			expect( recordTransition._recordRequest ).toBe( null );
		} );

		it( 'receives an error', function() {
			expect( socketWrapper.socket.lastSendMessage ).toContain( msg( 'R|E|INVALID_MESSAGE_DATA|') );
		} );
	} );

	describe( 'transition version conflicts', function() {
		
		var recordTransition,
			socketMock1 = new SocketMock(),
			socketMock2 = new SocketMock(),
			socketMock3 = new SocketMock(),
			socketWrapper1 = new SocketWrapper( socketMock1, {} ),
			socketWrapper2 = new SocketWrapper( socketMock2, {} ),
			socketWrapper3 = new SocketWrapper( socketMock3, {} ),
			patchMessage1 = { topic: 'RECORD', action: 'P', data: [ 'someRecord', 1, 'firstname', 'SEgon' ] },
			patchMessage2 = { topic: 'RECORD', action: 'P', data: [ 'someRecord', 2, 'firstname', 'SEgon' ] },
			recordHandlerMock = { _$broadcastUpdate: jasmine.createSpy(), _$transitionComplete: jasmine.createSpy() },
			logSpy = jasmine.createSpy( 'log' ),
			options = { cache: new StorageMock(), storage: new StorageMock(), logger: {log: logSpy } };

		options.cache.nextOperationWillBeSynchronous = false;

		it( 'creates the transition', function() {
			recordTransition = new RecordTransition( 'someRecord', options, recordHandlerMock );
			expect( recordTransition.hasVersion ).toBeDefined();
			expect( recordTransition.hasVersion( 2 ) ).toBe( false );
		} );

		it( 'adds a patch to the queue', function() {
			expect( recordTransition._recordRequest ).toBe( null );
			recordTransition.add( socketWrapper1, 1, patchMessage1 );
			recordTransition.add( socketWrapper1, 2, patchMessage2 );
			expect( recordTransition._recordRequest ).toBeDefined();
			expect( recordTransition._recordRequest.recordName ).toBe( 'someRecord' );
		} );

		it( 'gets a version exist error on two seperate updates but does not send error', function() {
			recordTransition.sendVersionExists( socketWrapper1, 1 );
			recordTransition.sendVersionExists( socketWrapper2, 1 );

			expect( socketMock1.lastSendMessage ).toBeNull();
			expect( socketMock2.lastSendMessage ).toBeNull();
			expect( socketMock3.lastSendMessage ).toBeNull();
		} );

		it( 'sends version exists error once record request is completed is retrieved', function() {
			recordTransition._recordRequest.onComplete( { _v: 1, _d: { lastname: 'Kowalski' } } );

			expect( socketMock1.lastSendMessage ).toBe( msg( 'R|E|VERSION_EXISTS|someRecord|1|{"lastname":"Kowalski"}+' ) );
			expect( socketMock2.lastSendMessage ).toBe( msg( 'R|E|VERSION_EXISTS|someRecord|1|{"lastname":"Kowalski"}+' ) );
			expect( socketMock3.lastSendMessage ).toBeNull();
		} );

		it( 'immediately sends version exists when record is already loaded', function() {
			socketMock1.lastSendMessage = null;
			socketMock2.lastSendMessage = null;
			socketMock3.lastSendMessage = null;

			recordTransition.sendVersionExists( socketWrapper3, 1 );

			expect( socketMock1.lastSendMessage ).toBeNull();
			expect( socketMock2.lastSendMessage ).toBeNull();
			expect( socketMock3.lastSendMessage ).toBe( msg( 'R|E|VERSION_EXISTS|someRecord|2|{"lastname":"Kowalski","firstname":"Egon"}+' ) );
		} );

		it( 'destroys the transition', function( done ){
			recordTransition.destroy();
			expect( recordTransition.isDestroyed ).toBe( true );
			expect( recordTransition._steps ).toBe( null );
			setTimeout(function() {
				//just leave this here to make sure no error is thrown when the
				//record request returns after 30ms
				done();
			}, 50 );
		} );
	} );

} );