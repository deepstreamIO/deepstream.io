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
		expect( ruleParser.validate( 'data.lastname.toUpperCase()' ) ).toBe( true );
		expect( ruleParser.validate( 'alert("bobo")' ) ).toBe( 'function alert is not supported' );
		expect( ruleParser.validate( 'data.lastname.toUpperCase() && data.lastname.substr(0,3)' ) ).toBe( 'function substr is not supported' );
	});
});