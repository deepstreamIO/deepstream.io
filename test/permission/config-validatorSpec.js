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
				"publish": true,
				"subscribe": true
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

	it( 'fails if no root permissions are specified', function(){
		var conf = getConfig();
		conf.rpc = { 'bla': {
			'request': 'user.id === $userId'
		}};
		expect( configValidator.validate( conf ) ).toBe( 'missing root entry "*" for section rpc' );
	});

	it( 'fails for invalid paths', function(){
		var conf = getConfig();
		conf.record.a$$x = {};
		expect( configValidator.validate( conf ) ).toBe( 'invalid variable name $$ for path a$$x in section record' );
	});

	it( 'fails for invalid rule types', function(){
		var conf = getConfig();
		conf.rpc.somepath = { write: 'a === b' };
		expect( configValidator.validate( conf ) ).toBe( 'unknown rule type write in section rpc' );
	});

	it( 'fails for invalid rules', function(){
		var conf = getConfig();
		conf.record.somepath = { write: 'process.exit()' };
		expect( configValidator.validate( conf ) ).toBe( 'function exit is not supported' );
	});

	// it( 'fails for rules referencing data that dont support it', function(){
	// 	var conf = getConfig();
	// 	conf.record.somepath = { read: 'data.firstname === "Egon"' };
	// 	expect( configValidator.validate( conf ) ).toBe( 'data is not supported for record read - did you mean "oldData"?' );
	// });
});