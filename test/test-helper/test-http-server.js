'use strict';

const http = require( 'http' );
const EventEmitter = require( 'events' ).EventEmitter;

module.exports = class TestHttpServer extends EventEmitter{
	constructor( port, callback, doLog ) {
		super();
		this.server = http.createServer( this._onRequest.bind( this ) );
		this.lastRequestData = null;
		this.hasReceivedRequest = false;
		this.lastRequestHeaders = null;
		this._port = port;
		this._callback = callback;
		this._doLog = doLog;
		this._response = null;
		this.server.listen( port, this._onListen.bind( this ) );
	}

	static getRandomPort() {
		return 1000 + Math.floor( Math.random() * 9000 );
	}

	reset() {
		this.lastRequestData = null;
		this.hasReceivedRequest = false;
		this.lastRequestHeaders = null;
	}

	respondWith( statusCode, data ) {
		if( typeof data === 'object' ) {
			data = JSON.stringify( data );
		}
		this._response.setHeader( 'content-type', 'application/json');
		this._response.writeHead( statusCode );
		this._response.end( data );
	}

	close( callback ) {
		this.server.close( callback );
	}


	_onListen() {
		this._log.bind( this, 'server listening on port ' + this._port );
		this._callback();
	}

	_log( msg ) {
		if( this._doLog ) {
			console.log( msg );
		}
	}

	_onRequest( request, response ) {
		request.postData = '';
		request.setEncoding( 'utf8' );
		request.on( 'data', this._addChunk.bind( this, request ));
		request.on( 'end', this._onRequestComplete.bind( this, request ));
		this._response = response;
	}

	_addChunk( request, chunk ) {
		request.postData += chunk;
	}

	_onRequestComplete( request ) {
		this.lastRequestData = JSON.parse( request.postData );
		this.lastRequestHeaders = request.headers;
		this.lastRequestMethod = request.method;
		this.emit( 'request-received' );
		this._log( 'received data ' + request.postData );
	}
}