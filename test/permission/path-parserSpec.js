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
		expect( result.regexp.toString() ).toBe( '/^game-score\\/([^\\/]+)$/' );
		expect( result.variables ).toEqual( [ '$gameId' ] );
	});

	it( 'parses a valid path with multiple variables', function(){
		var result = pathParser.parse( 'game-comment/$gameId/$userId/$commentId' );
		expect( isRegExp( result.regexp ) ).toBe( true );
		expect( result.regexp.toString() ).toBe( '/^game-comment\\/([^\\/]+)\\/([^\\/]+)\\/([^\\/]+)$/' );
		expect( result.variables ).toEqual( [ '$gameId', '$userId', '$commentId' ] );
	});

	it( 'parses a path with a mix of variables and wildcards', function(){
		var result = pathParser.parse( '$recordName/*' );
		expect( isRegExp( result.regexp ) ).toBe( true );
		expect( result.regexp.toString() ).toBe( '/^([^\\/]+)\\/.*$/' );
		expect( result.variables ).toEqual( [ '$recordName' ] );
	});

});

describe( 'applies regexp to paths', function(){
	it( 'applies a regexp to a simple path', function(){
		var path = 'public/*';
		var result = pathParser.parse( path );
		expect( result.regexp.test( 'public/details/info' ) ).toBe( true );
		expect( result.regexp.test( 'private/details/info' ) ).toBe( false );
	});

	it( 'applies a regexp and extracts a variable from a simple path', function(){
		var path = 'private/$userId';
		var name = 'private/userA';
		var result = pathParser.parse( path );
		expect( result.regexp.test( name ) ).toBe( true );
		expect( name.match( result.regexp )[ 1 ] ).toBe( 'userA' );
	});

	it( 'applies a regexp and extracts variables from a more complex path', function(){
		var path = 'private/$userId/*/$anotherId';
		var name = 'private/userA/blabla/14';
		var result = pathParser.parse( path );
		expect( result.regexp.test( name ) ).toBe( true );
		expect( name.match( result.regexp ).join( ',' ) ).toEqual( 'private/userA/blabla/14,userA,14' );
	});
});