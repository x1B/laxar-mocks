/**
 * Copyright 2016 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
/* eslint-env node */


/**
 * Webpack loader for a LaxarJS widget spec test that automatically requires dependencies:
 *
 *  - artifacts listing, stored under window.laxarMocksFixtures.artifacts
 *  - adapter (if the technology is not 'plain'), stored under window.laxarMocksFixtures.adapter
 *
 * To use, simply configure `laxar-mocks/spec-loader` to handle files matching /.spec.js$/`.
 */

const path = require( 'path' );
const process = require( 'process' );

module.exports = function( content ) {
   if( this.cacheable ) {
      this.cacheable();
   }

   const widgetDirectory = this.resource.replace( /\/spec\/[^\/]+$/, '' );
   const technology = require( `${widgetDirectory}/widget.json` ).integration.technology;
   const widgetRef = `amd:./${path.relative( process.cwd(), widgetDirectory )}`;
   const dependencies = {
      adapter: technology === 'plain' ? null : `laxar-${technology}-adapter`,
      artifacts: `laxar-loader/entry?widget=${widgetRef}`
   };

   return [
      `window.laxarMocksFixtures = {
         adapter: ${dependency('adapter')},
         artifacts: ${dependency('artifacts')}
      }`,
      content
   ].join( ';' );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function dependency( name ) {
      const path = dependencies[ name ];
      return path ? `require( '${path}' )` : 'undefined';
   }
};
