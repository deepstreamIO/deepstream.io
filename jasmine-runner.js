var Jasmine = require('jasmine')

var jrunner = new Jasmine()
var jasmine = global.jasmine
jrunner.loadConfigFile('./jasmine.json')           // load jasmine.json configuration
jrunner.execute()
