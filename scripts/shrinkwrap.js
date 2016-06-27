// fix for https://github.com/jaredallard/nexe/issues/219#issuecomment-221687043

const fs = require( 'fs' );
const path = require( 'path' );
const shrinkwrapPath = '../npm-shrinkwrap.json';
const shrinkwrap = require( shrinkwrapPath );

try {
	const negotiator = shrinkwrap.dependencies['engine.io'].dependencies.accepts.dependencies.negotiator;
	negotiator.version = '0.6.1';
	negotiator.from = 'negotiator@0.6.1';
	negotiator.resolved = 'https://registry.npmjs.org/negotiator/-/negotiator-0.6.1.tgz';
	fs.writeFileSync( path.join(  __dirname, shrinkwrapPath ), JSON.stringify( shrinkwrap, null, 2 ) + '\n', 'utf8' );
} catch( e ) {
	console.log( 'ERROR: ', e );
	console.log( shrinkwrap );
	process.exit( 1 );
}
