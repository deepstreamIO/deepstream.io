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

SEPERATOR = String.fromCharCode( 31 );

window.onload = function() {

	connection = eio( 'http://localhost:6020' );
	connection.on( 'open', function( socket ){
		connection.send( 'AUTH' + SEPERATOR + 'REQ' + SEPERATOR + '{"firstname":"Wolfram"}' );
	});

	connection.on( 'message', function( msg ){
		console.log( 'received', msg );
	});
	//document.cookie = '';
	//connection.on( 'error', function(){ console.log( 'error', arguments ); });
	//connection.on( 'connect_error', function(){ console.log( 'connect_error', arguments ); });
	//ko.applyBindings( new ViewModel() );
};