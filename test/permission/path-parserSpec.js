var pathParser = require( '../../src/permission/path-parser' );
var isRegExp = function( val ) {
	return typeof val === 'object' && typeof val.test === 'function';
};

describe( 'validates paths in permission.json files', function(){
	it( 'exposes a validate method', function(){
		expect( typeof pathParser.validate ).toBe( 'function' );
	});

	it( 'accepts a valid path', function(){
		expect( pathParser.validate( 'game-comment/$gameId/*' ) ).toBe( true );
	});

	it( 'rejects none strings', function(){
		expect( pathParser.validate( 3 ) ).toBe( 'path must be a string' );
	});

	it( 'rejects empty strings', function(){
		expect( pathParser.validate( '' ) ).toBe( 'path can\'t be empty' );
	});

	it( 'rejects paths starting with /', function(){
		expect( pathParser.validate( '/bla' ) ).toBe( 'path can\'t start with /' );
	});

	it( 'rejects paths with invalid variable names', function(){
		expect( pathParser.validate( 'bla/$-' ) ).toBe( 'invalid variable name $-' );
		expect( pathParser.validate( 'bla/$$aa' ) ).toBe( 'invalid variable name $$' );
	});
});


describe( 'parses valid paths in permission.json files', function(){
	it( 'exposes a parse method', function(){
		expect( typeof pathParser.parse ).toBe( 'function' );
	});

	it( 'parses a simple, valid path', function(){
		var result = pathParser.parse( 'i-am-valid' );
		expect( isRegExp( result.regexp ) ).toBe( true );
		expect( result.regexp.toString() ).toBe( '/^i-am-valid$/' );
		expect( result.variables.length ).toBe( 0 );
	});

	it( 'parses a valid path with a wildcard', function(){
		var result = pathParser.parse( 'i-am-valid/*' );
		expect( isRegExp( result.regexp ) ).toBe( true );
		expect( result.regexp.toString() ).toBe( '/^i-am-valid\\/.*$/' );
		expect( result.variables.length ).toBe( 0 );
	});

	it( 'parses a valid path with a variable', function(){
		var result = pathParser.parse( 'game-score/$gameId' );
		expect( isRegExp( result.regexp ) ).toBe( true );
		expect( result.regexp.toString() ).toBe( '/^game-score\\/(\\$[a-zA-Z0-9]*)$/' );
		expect( result.variables ).toEqual( [ '$gameId' ] );
	});

	it( 'parses a valid path with multiple variables', function(){
		var result = pathParser.parse( 'game-comment/$gameId/$userId/$commentId' );
		expect( isRegExp( result.regexp ) ).toBe( true );
		expect( result.regexp.toString() ).toBe( '/^game-comment\\/(\\$[a-zA-Z0-9]*)\\/(\\$[a-zA-Z0-9]*)\\/(\\$[a-zA-Z0-9]*)$/' );
		expect( result.variables ).toEqual( [ '$gameId', '$userId', '$commentId' ] );
	});

	it( 'parses a path with a mix of variables and wildcards', function(){
		var result = pathParser.parse( '$recordName/*' );
		expect( isRegExp( result.regexp ) ).toBe( true );
		expect( result.regexp.toString() ).toBe( '/^(\\$[a-zA-Z0-9]*)\\/.*$/' );
		expect( result.variables ).toEqual( [ '$recordName' ] );
	});

});