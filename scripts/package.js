var nexe = require( 'nexe' );
var os = require( 'os' );

var nodeVersion = '4.4.5';
var commit = process.env.TRAVIS_COMMIT || process.env.APPVEYOR_REPO_COMMIT || 'local';
var platform = os.platform();
var extension = platform == 'win32' ? '.exe' : '';
var packageVersion = require( '../package.json' ).version;

if( process.version.indexOf( nodeVersion ) === -1 ) {
	console.log( 'We only compile nexe on Node version: ', nodeVersion );
	process.exit();
}

// Only include first seven for it to be unique
commit = commit.substr( 0, 7 );
var fileName = `build/deepstream${extension}`;

console.log( `Compiling: ${fileName}` );

nexe.compile({
		"input": "start.js",
		"output": fileName,
		"nodeTempDir": "nexe_node",
		"framework": "node",
		"nodeVersion": nodeVersion,
		"js-flags": "--use_strict",
		nodeConfigureArgs: ['opt', 'val'], // for all your configure arg needs.
		nodeMakeArgs: ["-j", "4"], // when you want to control the make process.
		nodeVCBuildArgs: ["nosign", "x64"] // when you want to control the make process for windows.
}, function(err) {
		if(err) {
				return console.log(err);
				process.exit( 1 );
		}
		console.log( 'Compile Complete' )
});