ViewModel = function( connection ) {
	window.vm = this;
	this.connection = connection;
	this.inputValue = ko.observable();
	this.inputValue.subscribe( this.processInput.bind( this ) );
	this.messages = ko.observableArray();
	this.messageSuggestions = ko.observableArray();
};

ViewModel.prototype.processInput = function() {
	if( !this.inputValue() ) {
		return;
	}

	var msg = this.inputValue();
	this.inputValue( '' );

	this.send( msg );
};

ViewModel.prototype.send = function( msg ) {
	this.addMsg( 'outgoing', msg );
	msg = msg.replace( /\|/g, String.fromCharCode( 31 ) );
	this.connection.send( msg );
};

ViewModel.prototype.openConnection = function() {
	this.connection.open();
};


ViewModel.prototype.addMsg = function( type, msg ) {
	var regExp = new RegExp( String.fromCharCode( 31 ), 'g' );

	this.messages.unshift({
		type: type,
		msg: msg.replace( regExp, '|' )
	});
};

ViewModel.prototype.addMessageSuggestion = function( msg ) {
	this.messageSuggestions.push( msg );
};