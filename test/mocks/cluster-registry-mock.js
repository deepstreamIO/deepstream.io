'use strict';

const EventEmitter = require( 'events' ).EventEmitter;

module.exports = class ClusterRegistryMock extends EventEmitter{
	constructor() {
		super();
		this.all = null;
		this.currentLeader = null;
		this.reset();
	}

	reset() {
		this.all = [ 'server-name-a', 'server-name-b', 'server-name-c' ];
		this.currentLeader = 'server-name-a';
	}

	getAll() {
		return this.all;
	}

	getCurrentLeader() {
		return this.currentLeader;
	}
};