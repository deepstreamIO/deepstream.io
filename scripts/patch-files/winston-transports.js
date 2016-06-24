 // THIS IS A PATCH TO GET NEXE/BROWSERIFY WORKING

/*
 * transports.js: Set of all transports Winston knows about
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 *
 */

var path = require('path');

var transports = {
  http: function() {
    return require('./transports/http')
  },
  file: function() {
    return require('./transports/file')
  },
  console: function() {
    return require('./transports/console')
  },
  memory: function() {
    return require('./transports/memory')
  }
};

//
// Setup all transports as lazy-loaded getters.
//
Object.defineProperties(
  exports,
  ['Console', 'File', 'Http', 'Memory']
    .reduce(function (acc, name) {
      acc[name] = {
        configurable: true,
        enumerable: true,
        get: function () {
          var fnName = name.toLowerCase();
          var fn = transports[fnName];
          return fn()[name];
        }
      };

      return acc;
    }, {})
);
