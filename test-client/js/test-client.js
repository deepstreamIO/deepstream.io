window.onload = function() {

	connection = eio( 'http://localhost:6020' );

	var viewModel = new ViewModel( connection );

	connection.on( 'open', function( socket ){
		viewModel.addMsg( 'system', 'connection opened' );
	});

	connection.on( 'message', function( msg ){
		viewModel.addMsg( 'incoming', msg );
	});

	connection.on( 'error', function( err ){
		viewModel.addMsg( 'error', err );
	});
	
	connection.on( 'connect_error', function( err ){ 
		viewModel.addMsg( 'error', 'connection error ' + err );
	});

	connection.on( 'close', function(){ 
		viewModel.addMsg( 'error', 'connection closed' );
	});

	viewModel.addMessageSuggestion( 'AUTH|REQ|{"firstname":"Wolfram"}' );
	viewModel.addMessageSuggestion( 'EVENT|S|someEvent' );
	viewModel.addMessageSuggestion( 'EVENT|US|someEvent' );
	viewModel.addMessageSuggestion( 'EVENT|EVT|someEvent|someData' );

	ko.applyBindings( viewModel );
};