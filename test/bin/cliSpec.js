/* global describe, it, expect */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const child_process = require( 'child_process' );
const pidHelper = require( '../../bin/pid-helper' );

const cwd = path.resolve( '.' );
const execOptions =  {
	cwd: cwd,
	encoding : 'utf8'
};

function stopServer() {
	return child_process.spawnSync( 'node', ['bin/deepstream', 'stop'], execOptions );
}

describe( 'Command Line Interface', function() {
	it( 'start, status and stop', function() {
		child_process.exec( 'node bin/deepstream start', execOptions );
		let output = '';
		while ( output.indexOf( 'process running with PID' ) === -1 ) {
			output = child_process.spawnSync( 'node', ['bin/deepstream', 'status'], execOptions ).stdout;
		}
		const stopResult = child_process.spawnSync( 'node', ['bin/deepstream', 'stop'], execOptions );
		expect( stopResult.status ).toEqual( 0 );
		expect( stopResult.stdout ).toContain( 'deepstream was running' );
		expect( stopResult.stderr === '' ).toBe( true );
	} );

	it( 'start in background, status and stop', function() {
		child_process.exec( 'node bin/deepstream start --detach', execOptions );
		let output = '';
		while ( output.indexOf( 'process running with PID' ) === -1 ) {
			output = child_process.spawnSync( 'node', ['bin/deepstream', 'status'], execOptions ).stdout;
		}
		const stopResult = stopServer();
		expect( stopResult.status ).toEqual( 0 );
		expect( stopResult.stdout ).toContain( 'deepstream was running' );
		expect( stopResult.stderr === '' ).toBe( true );
	} );

	it( 'fail during start of second server', function() {
		child_process.exec( 'node bin/deepstream start', execOptions );
		let output = '';
		while ( output.indexOf( 'process running with PID' ) === -1 ) {
			output = child_process.spawnSync( 'node', ['bin/deepstream', 'status'], execOptions ).stdout;
		}
		const startDetachResult = child_process.spawnSync( 'node', ['bin/deepstream', 'start', '-d'], execOptions );
		expect( startDetachResult.status ).toEqual( 1 );
		expect( startDetachResult.stderr ).toContain( 'server is already running' );
		expect( startDetachResult.stdout === '' ).toBe( true );
		stopServer();
	} );

	it( 'fail during start of second server, even if pid file not found', function() {
		child_process.exec( 'node bin/deepstream start', execOptions );
		let output = '';
		while ( output.indexOf( 'process running with PID' ) === -1 ) {
			output = child_process.spawnSync( 'node', ['bin/deepstream', 'status'], execOptions ).stdout;
		}
		const fileContent = fs.readFileSync( pidHelper.PID_FILE, 'utf8' );
		const pidFileContent = JSON.parse( fileContent );
		fs.unlinkSync( pidHelper.PID_FILE );
		const startDetachResult = child_process.spawnSync( 'node', ['bin/deepstream', 'start', '-d'], execOptions );
		expect( startDetachResult.status ).toEqual( 1 );
		expect( startDetachResult.stdout === '' ).toBe( true );
		expect( startDetachResult.stderr === '' ).toBe( false );
		process.kill( pidFileContent.pid );
	} );

} );
