require('chai').should();

let pushIn;

let jsdom = require("jsdom");
let JSDOM = jsdom.JSDOM;

describe( 'getSpeed', function() {

    this.beforeEach( function() {
        var dom = new JSDOM(`
        <!DOCTYPE html>
            <body>
                <div class="pushin">
                    <div class="pushin-scene">
                        <div id="layer-0" class="pushin-layer">Layer 0</div>
                        <div id="layer-1" class="pushin-layer" data-pushin-speed="50">Layer 1</div>
                        <div id="layer-2" class="pushin-layer" data-pushin-speed="abc">Layer 2</div>
                    </div>
                </div>
            </body>
        </html>`);

        global.window   = dom.window;
        global.document = window.document;

        pushIn = require( '../src/pushin' ).PushIn;

        const container = document.querySelector( '.pushin' );
        this.pushIn     = new pushIn( container );
    } );

    it( 'Should return 8 by default', function() {
        const elem   = document.querySelector( '#layer-0' );
        const result = this.pushIn.getSpeed( elem );
        result.should.equal( 8 );
    } );

    it( 'Should return integer value from data-pushin-speed attribute', function() {
        const elem   = document.querySelector( '#layer-1' );
        const result = this.pushIn.getSpeed( elem );
        result.should.equal( 50 );
    } );

    it( 'Should return default if NaN', function() {
        const elem   = document.querySelector( '#layer-2' );
        const result = this.pushIn.getSpeed( elem );
        result.should.equal( 8 );
    } );
} );