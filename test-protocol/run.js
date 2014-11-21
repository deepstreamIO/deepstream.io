var parseXlsx = require('excel'),
    Server = require( './src/server' ),
    Client = require( './src/client' ),
    Row = require( './src/row' );

var Runner = function() {
  this._serverReady = false;
  this._parsedSpec = null;
  
  this._currentRow = null;
  this._currentRowIndex = 0;
  
  this._portA = 6014;
  this._portB = 6015;
  
  console.log( 'starting server...' );
  
  this._serverA = new Server( this._portA );
  this._serverA.on( 'ready', this._checkReady.bind( this ) );
  
  this._serverB = new Server( this._portB );
  this._serverB.on( 'ready', this._checkReady.bind( this ) );
  
  parseXlsx('Protocoll.xlsx', this._onSpec.bind( this ) );
};

Runner.prototype._run = function() {
  if( this._currentRowIndex === this._parsedSpec.length ) {
    this._done();
    return;
  }
  
  var rowData = this._parsedSpec[ this._currentRowIndex ],
      clients = [ this._clientA1, this._clientA2, this._clientB1 ];
      
  this._currentRow = new Row( rowData, clients );
  this._currentRow.once( 'done', this._processResult.bind( this ) );
};

Runner.prototype._processResult = function() {
  var isSuccess = true;
  
  for( var i = 0; i < this._currentRow.results.length; i++ ) {
    if( this._currentRow.results[ i ] !== true ) {
      isSuccess = false;
    }
  }
  
  if( isSuccess ) {
    this._currentRowIndex++;
    this._clientA1.reset();
    this._clientA2.reset();
    this._clientB1.reset();
    this._run();
  } else {
    console.log( 'test error' );
    process.exit();
  }
};

Runner.prototype._done = function() {
  console.log( 'ALL DONE' );
};

Runner.prototype._checkReady = function() {
  
  if( this._serverA.isReady && this._serverB.isReady && this._serverReady === false ) {
    this._serverReady = true;
    this._startClients();
  }
  
  if( this._serverReady === false ) {
    return;
  }
  
  if( 
    this._clientA1.isReady &&
    this._clientA2.isReady &&
    this._clientB1.isReady &&
    this._parsedSpec
  ) {
    this._run();
  }
};

Runner.prototype._startClients = function() {
  this._clientA1 =  new Client( this._portA );
  this._clientA1.on( 'ready', this._checkReady.bind( this ) );
  
  this._clientA2 =  new Client( this._portA );
  this._clientA2.on( 'ready', this._checkReady.bind( this ) );
  
  this._clientB1 =  new Client( this._portB );
  this._clientB1.on( 'ready', this._checkReady.bind( this ) );
};

Runner.prototype._onSpec = function( error, data ) {
  if( error !== null ) {
    throw error;
  }
  
  this._parsedSpec = data;
};

new Runner();

