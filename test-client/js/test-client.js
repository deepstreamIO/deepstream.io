ViewModel = function() {
	this.inputValue = ko.observable();
	this.inputValue.subscribe( this.processInput.bind( this ) );
	this.messages = ko.observableArray();
};

ViewModel.prototype.processInput = function() {
	if( !this.inputValue() ) {
		return;
	}

	var msg = this.inputValue();
	this.inputValue( '' );
};

window.onload = function() {
	console.log('♦‡');
	console.log( '  ', '  '.length );
	if( '  '.length !== 2 ) {
		var msg = 'INVALID ENCODING\n' +
			'Please set the encoding of your page\n' +
			'(or at least of the deepstream client) to UTF-8.\n' +
			'You can do so by either adding <meta charset="UTF-8"> to your <head>\n' +
			'or charset="UTF-8" to the <script> tag that includes the client.';
		throw new Error( msg );
	}
	return;
	connection = eio( 'http://localhost:6020' );
	connection.on( 'open', function( socket ){
		debugger;
		connection.send( 'testtext:♦‡' );
		//connection.send( 'AUTH{"firstname":"Wolfram"}' );
	});

	connection.on( 'message', function( msg ){
		console.log( 'received', msg );
	});
	//document.cookie = '';
	//connection.on( 'error', function(){ console.log( 'error', arguments ); });
	//connection.on( 'connect_error', function(){ console.log( 'connect_error', arguments ); });
	//ko.applyBindings( new ViewModel() );
};