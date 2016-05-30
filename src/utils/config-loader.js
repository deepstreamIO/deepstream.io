'use strict'

const fs = require( 'fs' );
const path = require( 'path' );
const yaml = require( 'js-yaml' );
const merge  = require( 'lodash.merge' );
const defaultOptions = require( '../default-options' );
const utils = require( './utils' );
const C = require( '../constants/constants' );
const argv = require( 'minimist' )( process.argv.slice( 2 ) );
const LOG_LEVEL_KEYS = Object.keys( C.LOG_LEVEL );

module.exports = function( customFilePath ) {
  const order = [
    'config.json',
    'config.js',
    'config.yml'
  ];

  let filePath = null;

  if ( customFilePath != null ) {
    try {
      fs.lstatSync( customFilePath )
      filePath = customFilePath;
    } catch ( err ) {
      throw new Error( 'configuration file not found at: ' + customFilePath );
    }
  } else {
    filePath = order.filter( function( filePath ) {
      try {
        fs.lstatSync( filePath )
        return true
      } catch ( err ) {}
    } )[ 0 ];
  }

  if ( filePath == null ) {
    return defaultOptions.get();
  }
  let config = null;
  const extension = path.extname( filePath );
  const fileContent = fs.readFileSync( filePath, 'utf8' );
  try {
    if ( extension === '.yml' ) {
      config = yaml.safeLoad( fileContent );
    } else if ( extension === '.js' ) {
      config = require( path.resolve( filePath ) );
    } else if ( extension === '.json' ) {
      config = JSON.parse( fileContent );
    } else {
      throw new Error( extension + ' is not supported as configuration file' );
    }
  } catch ( err ) {
    // Could not parse config file
    throw err
  }

  // CLI arguments
  var cliArgs = {};
  for ( let key in Object.keys( defaultOptions.get() ) ) {
    cliArgs[key] = argv[key] || undefined;
  }

  return merge( {}, defaultOptions.get(), handleMagicProperties( config ), cliArgs );
}

function handleMagicProperties( cfg ) {
  const config = merge( {
    plugins: {}
  }, cfg );
  if ( config.serverName === 'UUID' ) {
    config.serverName = utils.getUid();
  }
  if ( LOG_LEVEL_KEYS.indexOf( config.logLevel ) !== -1 ) {
    config.logLevel = C.LOG_LEVEL[ config.logLevel ];
  }
  var plugins = {
    logger: config.plugins.logger,
    messageConnector: config.plugins.message,
    cache: config.plugins.cache,
    storage: config.plugins.storage
  }
  for ( let key in plugins ) {
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
