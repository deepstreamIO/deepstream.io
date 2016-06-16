var RuleCache = require( '../../src/permission/rule-cache' );

describe( 'loads and retrieves values from the rule cache', function(){
	var ruleCache;

	it( 'creates the rule cache', function(){
		ruleCache = new RuleCache({ cacheEvacuationInterval: 10 });
		expect( ruleCache.has( 'record', '*', 'write' ) ).toBe( false );
	});

	it( 'sets a value', function(){
		ruleCache.set( 'event', '*', 'write', 'ah' );
		expect( ruleCache.has( 'event', '*', 'write' ) ).toBe( true );
		expect( ruleCache.get( 'event', '*', 'write' ) ).toBe( 'ah' );
	});

	it( 'sets another value', function( next ){
		ruleCache.set( 'record', '*', 'write', 'yup' );
		expect( ruleCache.has( 'record', '*', 'write' ) ).toBe( true );
		expect( ruleCache.get( 'record', '*', 'write' ) ).toBe( 'yup' );
		setTimeout( next, 40 );
	});

	it( 'sets two values for different actions', function(){
		ruleCache.set( 'record', 'somepath', 'write', true );
		ruleCache.set( 'record', 'somepath', 'read', 'bla' );

		expect( ruleCache.has( 'record', 'somepath', 'write' ) ).toBe( true );
		expect( ruleCache.get( 'record', 'somepath', 'write' ) ).toBe( true );

		expect( ruleCache.has( 'record', 'somepath', 'read' ) ).toBe( true );
		expect( ruleCache.get( 'record', 'somepath', 'read' ) ).toBe( 'bla' );
	});

	it( 'has purged the cache in the meantime', function(){
		expect( ruleCache.has( 'record', '*', 'write' ) ).toBe( false );
	});

	it( 'does not remove an entry thats repeatedly requested', function( next ){
		ruleCache.set( 'record', '*', 'write', 'yeah' );
		var count = 0;
		var interval = setInterval(function(){
			count++;
			expect( ruleCache.has( 'record', '*', 'write' ) ).toBe( true );
			expect( ruleCache.get( 'record', '*', 'write' ) ).toBe( 'yeah' );
			if( count >= 10 ) {
				clearInterval( interval );
				next();
			}
		}, 10 );
	});

	it( 'removes the entry once it stops being requested', function( next ){
		expect( ruleCache.has( 'record', '*', 'write' ) ).toBe( true );
		expect( ruleCache.get( 'record', '*', 'write' ) ).toBe( 'yeah' );
		setTimeout(function(){
			expect( ruleCache.has( 'record', '*', 'write' ) ).toBe( false );
			next();
		}, 40 );
	});
});
