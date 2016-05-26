var fs = require( 'fs' );
var path = require( 'path' );
var yaml = require( 'js-yaml' );
var merge  = require('lodash.merge');
var defaultOptions = require( '../default-options' );
var utils = require( './utils' );
var  C = require( '../constants/constants' );
var argv = require( 'minimist' )( process.argv.slice(2) );

module.exports = function(customFilePath) {
  var order = [
    'config.json',
    'config.js',
    'config.yml',
  ];
  if ( customFilePath != null ) {
    order.unshift(customFilePath)
  }

  var filePath = order.filter(function( filePath ) {
    try {
      fs.lstatSync(filePath)
      return true
    } catch ( err ) {}
  })[0]

  if ( filePath == null ) {
    return defaultOptions.get();
  }
  var config = null;
  var extension = path.extname( filePath )
  try {
    if ( extension === '.yml' ) {
      config = yaml.safeLoad( fs.readFileSync( filePath, 'utf8' ));
    } else {
      config = require(path.join( process.cwd(), filePath ))
    }
  } catch ( err ) {
    console.error( err )
    process.exit( 1 );
  }

  // CLI arguments
  var cliArgs = {};
  var keys = Object.keys(defaultOptions.get())
  for ( key in keys ) {
    cliArgs[key] = argv[key] || config[key] || defaultOptions.get()[key]
  }

  var result = merge({}, defaultOptions.get(), handleMagicProperties(config), cliArgs);
  return result;
}

function handleMagicProperties( cfg ) {
  var config = utils.deepCopy( cfg );
  if ( config.serverName === 'UUID' ) {
    config.serverName = utils.getUid();
  }
  if ( config.logLevel.indexOf(['INFO']) !== -1 ) {
    config.logLevel = C.LOG_LEVEL[config.logLevel];
  }
  var plugins = {
    logger: config.plugins.logger,
    messageConnector: config.plugins.message,
    cache: config.plugins.cache,
    storage: config.plugins.storage
  }
  for ( key in plugins ) {
    var plugin = plugins[key]
    if ( plugin != null ) {
      var requirePath = path.basename( plugin.path ) === plugin.path ?
        plugin.path : path.join( process.cwd(), plugin.path );
      var fn = require( requirePath );
      if ( key === 'logger' ) {
        config[key] = fn;
      } else {
        config[key] = new fn( plugin.options );
      }
    }
  }
  return config;
}
