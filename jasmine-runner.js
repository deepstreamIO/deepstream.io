var Jasmine = require('jasmine')
var noop = function() {}

var jrunner = new Jasmine()
var jasmine = global.jasmine
jrunner.configureDefaultReporter({ print: noop })  // remove default reporter logs
jrunner.loadConfigFile('./jasmine.json')           // load jasmine.json configuration
jrunner.execute()
