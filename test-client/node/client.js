var eio = require( 'engine.io-client' ),
    readline = require('readline'),
    url = 'ws://localhost:' + ( process.argv[ 2 ] || 6020 ),
    connection = eio( url ),
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

console.log( 'Connecting to ' + url + ' ...' );

var send = function( msg ) {
    console.log( 'OUTGOING', msg );
    connection.send( msg.replace( /\|/g, String.fromCharCode( 31 ) ) );
};

connection.on( 'open', function( socket ){
	console.log( 'connection opened' );
	send( 'AUTH|REQ|{"user":"wolfram"}' );
});

connection.on( 'message', function( msg ){
    var regExp = new RegExp( String.fromCharCode(31), 'g');
    if( msg ) {
        msg = msg.replace( regExp, '|' );
    }
    
    console.log( 'INCOMING', msg );
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
    
    send( cmd );
    
});
