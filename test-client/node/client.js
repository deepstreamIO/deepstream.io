var eio = require( 'engine.io-client' ),
    readline = require('readline'),
    url = 'ws://localhost:' + ( process.argv[ 2 ] || 6020 ),
    connection = eio( url ),
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

console.log( 'Connecting to ' + url + ' ...' );

connection.on( 'open', function( socket ){
	console.log( 'connection opened' );
});

connection.on( 'message', function( msg ){
    var regExp = new RegExp( String.fromCharCode(31), 'g');
    console.log( 'INCOMING', msg.replace( regExp, '|' ) );
});

connection.on( 'error', function( err ){
	console.log( 'ERROR', err );
});

connection.on( 'connect_error', function( err ){ 
	console.log( 'CONNECT_ERROR', err );
});

connection.on( 'close', function(){ 
	console.log( 'CLOSE' );
});

rl.on( 'line', function ( cmd ) {
    if( cmd.toUpperCase() === 'OPEN' ) {
        connection.open();
        return;
    }
    
    var msg = cmd.replace( /\|/g, String.fromCharCode( 31 ) );
    connection.send( msg );
});
