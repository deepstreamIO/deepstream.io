/* global describe, it, expect, jasmine */
var utils = require( '../../src/utils/utils' ),
    EventEmitter = require( 'events' ).EventEmitter;

describe( 'utils', function(){
   
   it( 'receives a different value everytime getUid is called', function() {
        var uidA = utils.getUid(),
            uidB = utils.getUid(),
            uidC = utils.getUid();
            
        expect( uidA ).not.toBe( uidB );
        expect( uidB ).not.toBe( uidC );
        expect( uidA ).not.toBe( uidC );
   });
   
   it( 'combines multiple events into one', function() {
        var emitters = [
            new EventEmitter(),
            new EventEmitter(),
            new EventEmitter()
        ],
        callback = jasmine.createSpy( 'eventCallback' );
        
        utils.combineEvents( emitters, 'someEvent', callback );
        expect( callback ).not.toHaveBeenCalled();
        
        emitters[ 0 ].emit( 'someEvent' );
        expect( callback ).not.toHaveBeenCalled();
        
        emitters[ 1 ].emit( 'someEvent' );
        emitters[ 2 ].emit( 'someEvent' );
        expect( callback ).toHaveBeenCalled();
   });
});