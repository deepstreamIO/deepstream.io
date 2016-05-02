var configValidator = require( '../../src/permission/config-validator' );
var getConfig = function() {
	return {
		"record": {
			"*": {
				"write": true,
				"read": true
			}
		},
		"event": {
			"*": {
				"write": true,
				"read": true
			}
		},
		"rpc": {
			"*": {
				"provide": true,
				"request": true
			}
		}
	};
};

describe( 'it validates permission.json files', function(){
	it( 'exposes a validate method', function(){
		expect( typeof configValidator.validate ).toBe( 'function' );
	});

	it( 'validates a basic configuration', function(){
		expect( configValidator.validate( getConfig() ) ).toBe( true );
	});

	it( 'validates the type of the configuration', function(){
		expect( configValidator.validate() ).toBe( 'config should be an object literal, but was of type undefined' );
		expect( configValidator.validate( 'bla' ) ).toBe( 'config should be an object literal, but was of type string' );
		expect( configValidator.validate( getConfig() ) ).toBe( true );
	});

	it( 'fails if a top level key is missing', function(){
		var conf = getConfig();
		delete conf.record;
		expect( configValidator.validate( conf ) ).toBe( 'missing configuration section "record"' );
	});

	it( 'fails if an unknown top level key is added', function(){
		var conf = getConfig();
		conf.bogus = {};
		expect( configValidator.validate( conf ) ).toBe( 'unexpected configuration section "bogus"' );
	});

	it( 'fails for empty sections', function(){
		var conf = getConfig();
		conf.rpc = {};
		expect( configValidator.validate( conf ) ).toBe( 'empty section "rpc"' );
	});

	it( 'fails for invalid paths', function(){
		var conf = getConfig();
		conf.record.a$$x = {};
		expect( configValidator.validate( conf ) ).toBe( 'invalid variable name $$ for path a$$x in section record' );
	});
});