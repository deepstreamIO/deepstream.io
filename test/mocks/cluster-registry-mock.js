'use strict';

const EventEmitter = require( 'events' ).EventEmitter;

module.exports = class ClusterRegistryMock extends EventEmitter{
	constructor() {
		super();
	}

	getAll() {
		return [ 'server-name-a', 'server-name-b', 'server-name-c' ];
	}
};