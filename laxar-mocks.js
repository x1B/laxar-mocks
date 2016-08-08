import { bootstrap } from 'laxar';

// TODO work out API
import * as plainAdapter from 'laxar/lib/widget_adapters/plain_adapter';

const widgetPrivateApi = {};
let widgetDomContainer;
let adapterInstance;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const widget = {
   configure( keyOrConfiguration, optionalValue ) {
      if( !widgetPrivateApi.configure ) {
         throw new Error( 'testing.createSetupForWidget needs to be called prior to configure.' );
      }
      widgetPrivateApi.configure( keyOrConfiguration, optionalValue );
   },

   load( done ) {
      if( !widgetPrivateApi.load ) {
         throw new Error( 'testing.createSetupForWidget needs to be called prior to load.' );
      }
      if( typeof done !== 'function' ) {
         throw new Error( 'testing.widget.load needs to be called with a Jasmine done-callback function.' );
      }
      widgetPrivateApi.load()
         .catch( handleErrorForJasmine )
         .then( done );
   },

   render() {
     if( widgetDomContainer && widgetDomContainer.parentElement ) {
        widgetDomContainer.parentElement.removeChild( widgetDomContainer );
     }

     widgetDomContainer = document.createElement( 'div' );
     widgetDomContainer.id = 'widgetContainer';
     document.body.appendChild( widgetDomContainer );
     widgetPrivateApi.renderTo( widgetDomContainer );

     return widgetDomContainer.firstChild;
   }
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function interceptAdapterCreation( adapter ) {
   adapter.bootstrap = ( ...args ) => {
      const result = bootstrap( ...args );
      return {
         ...result,
         create( ...args ) {
            adapterInstance = result.create( ...args );
            return adapterInstance;
         }
      };
   };
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function createSetupForWidget( descriptor, optionalOptions = {} ) {
   return () => {

      let features = {};
      const { module, adapter = plainAdapter, htmlTemplate } = optionalOptions;

      interceptAdapterCreation( adapter );
      const laxarServices = bootstrap( null, {
         widgetAdapters: [ adapter ],
         configuration: {},
         artifacts: createArtifactsMock( descriptor, module )
      } );

      widgetPrivateApi.configure = ( keyOrConfiguration, optionalValue ) => {
         if( optionalValue === undefined ) {
            features = keyOrConfiguration;
         }
         else {
            features[ keyOrConfiguration ] = optionalValue;
         }
      };

      widgetPrivateApi.load = () => {
         return laxarServices.widgetLoader.load( {
            id: 'test-widget',
            widget: descriptor.name,
            features
         } );
      };

      widgetPrivateApi.renderTo = container => {
         adapterInstance.domAttachTo( container, htmlTemplate );
      };
   };
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function createArtifactsMock( descriptor, module ) {
   return {
      aliases: {
         widgets: { [ descriptor.name ]: 0 },
         themes: { default: 0 }
      },
      themes: [ {
         descriptor: { name: 'default.theme' },
         assets: {}
      } ],
      widgets: [ {
         descriptor,
         assets: {},
         module
      } ],
      controls: []
   };
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function handleErrorForJasmine( err ) {
   if( window.console && window.console.error ) {
      window.console.error( err );
   }
   jasmine.getEnv().fail( err );
}
