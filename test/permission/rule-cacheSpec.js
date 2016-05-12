var RuleCache = require( '../../src/permission/rule-cache' );

describe( 'loads and retrieves values from the rule cache', function(){
	var ruleCache;

	it( 'creates the rule cache', function(){
		ruleCache = new RuleCache({ permissionCacheEvacuationInterval: 10 });
		expect( ruleCache.has( 'record', '*' ) ).toBe( false );
	});

	it( 'sets a value', function(){
		ruleCache.set( 'event', '*', 'ah' );
		expect( ruleCache.has( 'event', '*' ) ).toBe( true );
		expect( ruleCache.get( 'event', '*' ) ).toBe( 'ah' );
	});

	it( 'sets another value', function( next ){
		ruleCache.set( 'record', '*', 'yup' );
		expect( ruleCache.has( 'record', '*' ) ).toBe( true );
		expect( ruleCache.get( 'record', '*' ) ).toBe( 'yup' );
		setTimeout( next, 40 );
	});

	it( 'has purged the cache in the meantime', function(){
		expect( ruleCache.has( 'record', '*' ) ).toBe( false );
	});

	it( 'does not remove an entry thats repeatedly requested', function( next ){
		ruleCache.set( 'record', '*', 'yeah' );
		var count = 0;
		var interval = setInterval(function(){
			count++;
			expect( ruleCache.has( 'record', '*' ) ).toBe( true );
			expect( ruleCache.get( 'record', '*' ) ).toBe( 'yeah' );
			if( count >= 10 ) {
				clearInterval( interval );
				next();
			}
		}, 5 );
	});

	it( 'removes the entry once it stops being requested', function( next ){
		expect( ruleCache.has( 'record', '*' ) ).toBe( true );
		expect( ruleCache.get( 'record', '*' ) ).toBe( 'yeah' );
		setTimeout(function(){
			expect( ruleCache.has( 'record', '*' ) ).toBe( false );
			next();
		}, 40 );
	});
});