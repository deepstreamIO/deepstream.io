var ruleParser = require( '../../src/permission/rule-parser' );

describe('validates rule strings from permissions.json', function(){
	it( 'exposes a validate method', function(){
		expect( typeof ruleParser.validate ).toBe( 'function' );
	});

	it( 'accepts valid rules', function(){
		expect( ruleParser.validate( 'user.id === $userId' ) ).toBe( true );
	});

	it( 'rejects non-strings', function(){
		expect( ruleParser.validate( 3 ) ).toBe( 'rule must be a string' );
	});

	it( 'rejects empty strings', function(){
		expect( ruleParser.validate( '' ) ).toBe( 'rule can\'t be empty' );
	});

	it( 'rejects rules that contain new as a keyword', function(){
		expect( ruleParser.validate( 'newData.firstname' ) ).toBe( true );
		expect( ruleParser.validate( 'a new SomeClass' ) ).toBe( 'rule can\'t contain the new keyword' );
		expect( ruleParser.validate( 'a=new SomeClass' ) ).toBe( 'rule can\'t contain the new keyword' );
		expect( ruleParser.validate( 'new SomeClass' ) ).toBe( 'rule can\'t contain the new keyword' );
		expect( ruleParser.validate( ' new SomeClass' ) ).toBe( 'rule can\'t contain the new keyword' );
	});

	it( 'rejects rules that call unsupported functions', function(){
		expect( ruleParser.validate( 'data.lastname.toUpperCase()', 'record', 'write' ) ).toBe( true );
		expect( ruleParser.validate( 'alert("bobo")' ) ).toBe( 'function alert is not supported' );
		expect( ruleParser.validate( 'data.lastname.toUpperCase() && data.lastname.substr(0,3)', 'record', 'write' ) ).toBe( 'function substr is not supported' );
	});

	it( 'rejects invalid cross references', function(){
		expect( ruleParser.validate( '_("another-record" + data.userId) === $userId', 'record', 'write' ) ).toBe( true );
	});

	it( 'rejects rules that are syntactiacally invalid', function(){
		expect( ruleParser.validate( 'a b' ) ).toBe( 'SyntaxError: Unexpected identifier' );
		expect( ruleParser.validate(  'user.id.toUpperCase(' ) ).toBe( 'SyntaxError: Unexpected token }' );
	});

	it( 'rejects rules that reference old data without it being supported', function(){
		expect( ruleParser.validate( 'data.price === 500 && oldData.price < 500', 'event', 'publish' ) ).toBe( 'rule publish for event does not support oldData' );
	});

	it( 'rejects rules that reference data without it being supported', function(){
		expect( ruleParser.validate( 'user.id === $userId && data.price === 500', 'rpc', 'provide' ) ).toBe( 'rule provide for rpc does not support data' );
	});
});

describe( 'compiles rules into usable objects', function(){
	it( 'compiles boolean false', function(){
		var compiledRule = ruleParser.parse( false, [] );
		expect( compiledRule.fn() ).toBe( false );
		expect( typeof compiledRule.fn ).toBe( 'function' );
		expect( compiledRule.hasOldData ).toBe( false );
		expect( compiledRule.hasData ).toBe( false );
	});

	it( 'compiles boolean true', function(){
		var compiledRule = ruleParser.parse( true, [] );
		expect( compiledRule.fn() ).toBe( true );
		expect( typeof compiledRule.fn ).toBe( 'function' );
		expect( compiledRule.hasOldData ).toBe( false );
		expect( compiledRule.hasData ).toBe( false );
	});

	it( 'creates executable functions', function(){
		var compiledRule = ruleParser.parse( '"bobo"', [] );
		expect( ruleParser.parse( '"bobo"', [] ).fn() ).toBe( 'bobo' );
		expect( ruleParser.parse( '2+2', [] ).fn() ).toBe( 4 );
	});

	it( 'compiles a simple rule', function(){
		var compiledRule = ruleParser.parse( 'user.id !== "open"', [] );
		expect( typeof compiledRule.fn ).toBe( 'function' );
		expect( compiledRule.hasOldData ).toBe( false );
		expect( compiledRule.hasData ).toBe( false );
	});

	it( 'compiles a rule referencing data', function(){
		var compiledRule = ruleParser.parse( 'user.id !== data.someUser', [] );
		expect( typeof compiledRule.fn ).toBe( 'function' );
		expect( compiledRule.hasOldData ).toBe( false );
		expect( compiledRule.hasData ).toBe( true );
	});

	it( 'compiles a rule referencing data followed by a space', function(){
		var compiledRule = ruleParser.parse(  "data .firstname === \"Yasser\"", [] );
		expect( typeof compiledRule.fn ).toBe( 'function' );
		expect( compiledRule.hasOldData ).toBe( false );
		expect( compiledRule.hasData ).toBe( true );
	});

	it( 'compiles a rule referencing oldData', function(){
		var compiledRule = ruleParser.parse( 'user.id !== oldData.someUser', [] );
		expect( typeof compiledRule.fn ).toBe( 'function' );
		expect( compiledRule.hasOldData ).toBe( true );
		expect( compiledRule.hasData ).toBe( false );
	});

	it( 'compiles a rule referencing both data and oldData', function(){
		var compiledRule = ruleParser.parse( 'user.id !== data.someUser && oldData.price <= data.price', [] );
		expect( typeof compiledRule.fn ).toBe( 'function' );
		expect( compiledRule.hasOldData ).toBe( true );
		expect( compiledRule.hasData ).toBe( true );
	});

	it( 'compiles a rule referencing both data and oldData as well as other records', function(){
		var compiledRule = ruleParser.parse( '_( "private/"+ user.id ) !== data.someUser && oldData.price <= data.price', [] );
		expect( typeof compiledRule.fn ).toBe( 'function' );
		expect( compiledRule.hasOldData ).toBe( true );
		expect( compiledRule.hasData ).toBe( true );
	});
});