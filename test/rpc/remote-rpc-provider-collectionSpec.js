var RemoteRpcProviderCollection = require( '../../src/rpc/remote-rpc-provider-collection' ),
	options = { rpcProviderCacheTime: 10 };

describe( 'the remote rpc provider collection keeps track of providers for a specific rpcName', function(){
	var collection;
	
	it( 'creates the collection', function(){
		collection = new RemoteRpcProviderCollection( options );
		expect( collection.isUpToDate() ).toBe( false );
		expect( collection.getRandomProvider() ).toBe( null );
	});
	
	it( 'adds a provider', function(){
		var providerData = {
			rpcName: 'rpcA',
			privateTopic: 'privateTopicA',
			numberOfProviders: 2
		};
		
		collection.addProvider( providerData );
		expect( collection.isUpToDate() ).toBe( true );
		expect( collection.getRandomProvider() ).toBe( 'privateTopicA' );
	});
	
	it( 'adds another provider', function(){
		var providerData = {
			rpcName: 'rpcA',
			privateTopic: 'privateTopicB',
			numberOfProviders: 2
		},
		hadTopicA = false,
		hadTopicB = false;
		
		collection.addProvider( providerData );
		expect( collection.isUpToDate() ).toBe( true );
		
		for( var i = 0; i < 200; i++ ) {
			if( collection.getRandomProvider() === 'privateTopicA' ) {
				hadTopicA = true;
			}
			if( collection.getRandomProvider() === 'privateTopicB' ) {
				hadTopicB = true;
			} 
		}
		
		expect( hadTopicA ).toBe( true );
		expect( hadTopicB ).toBe( true );
	});
	
	it( 'removes expired providers', function( done ){
	    setTimeout(function(){
	    	expect( collection.isUpToDate() ).toBe( false );
	    	expect( collection.getRandomProvider() ).toBe( null );
	    	done();
	    }, 20 );
	});
});