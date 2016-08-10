/**
 * Copyright 2016 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 *
 * with parts by Kris Kowal
 * Copyright 2009-2012 Kris Kowal under the terms of the MIT
 * license found at http://github.com/kriskowal/q/raw/master/LICENSE
 */
/**
 * A testing framework for LaxarJS widgets.
 *
 * @module laxar-mocks
 */
import { bootstrap } from 'laxar';

// TODO (#26)work out laxar-side API
import { create as createEventBusMock } from 'laxar/lib/testing/event_bus_mock';
import * as plainAdapter from 'laxar/lib/widget_adapters/plain_adapter';

const widgetPrivateApi = {};

let laxarServices;
let widgetDomContainer;
let adapterInstance;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

export let eventBus;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The API to instrument and inspect the widget under test. In addition to the listed methods it has all
 * injections for the specific widget technology set as properties. E.g. for every widget technology there
 * will be `axEventBus` and `axContext` properties, but for AngularJS widgets there will be an additional
 * `$scope` property. Note that these are only available after `load()` has been called and the widget
 * controller is loaded.
 *
 * The methods of the event bus instance available as `axEventBus` are already provided with
 * [Jasmine spies](http://jasmine.github.io/2.3/introduction.html#section-Spies).
 *
 * @name Widget
 */
export const widget = {

   /**
    * Configures the widget features before loading with the given configuration object or key/value
    * entries. In fact this is what you'd normally configure under the `features` key in a page descriptor.
    *
    * Shorthands may be used:
    *
    * This
    * ```js
    * beforeEach( function() {
    *    testing.widget.configure( {
    *       search: {
    *          resource: 'search'
    *       }
    *    } );
    * } );
    * ```
    * is equivalent to the following shorter version
    * ```js
    * beforeEach( function() {
    *    testing.widget.configure( 'search.resource', 'search' );
    * } );
    * ```
    *
    * @param {String|Object} keyOrConfiguration
    *    either an object for the full features configuration or the path to the property to configure
    * @param {*} [optionalValue]
    *    if `keyOrConfiguration` is a string, this is the value to set the feature configuration to
    *
    * @memberOf Widget
    */
   configure( keyOrConfiguration, optionalValue ) {
      if( !widgetPrivateApi.configure ) {
         throw new Error( 'testing.createSetupForWidget needs to be called prior to configure.' );
      }
      widgetPrivateApi.configure( keyOrConfiguration, optionalValue );
   },

   /**
    * Loads the given widget and instantiates its controller. As this function is asynchronous, it receives
    * a Jasmine `done` callback that is called when the widget is ready.
    *
    * The instance ID (`axContext.widget.id`) for widgets loaded by laxar-mocks is always `testWidget`.
    * Their containing widget area is always `content`.
    *
    * The simplest way to call this function is by passing it to its own `beforeEach` call:
    * ```js
    * beforeEach( testing.widget.load );
    * ```
    *
    * @param {Function} done
    *    callback to notify Jasmine that the asynchronous widget loading has finished
    *
    * @memberOf Widget
    */
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

   /**
    * Renders the widget's template by calling the appropriate widget adapter and appends it within a
    * container div to the test's DOM. The widget DOM fragement will be returned in order to simulate
    * user interaction on it. Calling `tearDown()` will remove it again.
    *
    * Note that calling this method for an activity has no effect and hence is unnessecary.
    *
    * @return {Node}
    *    the widget DOM fragment
    *
    * @memberOf Widget
    */
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
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function decoratedAdapter( adapter ) {
   return {
      technology: adapter.technology,
      bootstrap( modules, services ) {
         laxarServices = services;
         eventBus = createEventBusMock();
         const result = adapter.bootstrap( modules, services );
         return {
            ...result,
            serviceDecorators() {
               return {
                  axGlobalEventBus: () => eventBus,
                  axEventBus: eventBus => {
                     const methods = [ 'subscribe', 'publish', 'publishAndGatherReplies', 'addInspector' ];
                     methods.forEach( method => {
                        spyOn( eventBus, method ).and.callThrough();
                     } );
                     return eventBus;
                  }
               };
            },
            create( ...args ) {
               adapterInstance = result.create( ...args );
               return adapterInstance;
            }
         };
      }
   };
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Removes any DOM fragments of the widget and calls the appropriate destructors. It is advised to call
 * this once in an `afterEach` call. Passing this function directly to `afterEach` works as well.
 *
 * Example.
 * ```js
 * afterEach( axMocks.tearDown );
 * ```
 */
export function tearDown() {
   widgetPrivateApi.destroy();
   if( widgetDomContainer && widgetDomContainer.parentElement ) {
      widgetDomContainer.parentElement.removeChild( widgetDomContainer );
      widgetDomContainer = null;
   }
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

const defaultEvents = [
   {
      topic: 'didChangeLocale',
      subtopics: {
         'default': {
            locale: 'default',
            languageTag: 'en'
         }
      }
   },
   {
      topic: 'didChangeLocale',
      subtopics: {
         'default': {
            theme: 'default'
         }
      }
   },
   {
      topic: 'beginLifecycleRequest',
      subtopics: {
         'default': {
            lifecycleId: 'default'
         }
      }
   },
   {
      topic: 'didChangeAreaVisibility',
      subtopics: {
         'content.true': {
            area: 'content',
            visible: true
         }
      }
   },
   {
      topic: 'didNavigate',
      subtopics: {
         testing: {
            place: 'testing',
            target: '_self',
            data: {}
         }
      }
   }
];

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Triggers all events normally published by the runtime after instantiation of the controller. This
 * includes the following events, listed with their payloads in the order they are published:
 *
 * **1. didChangeLocale.default:**
 * ```js
 * {
 *    locale: 'default',
 *    languageTag: 'en'
 * }
 * ```
 * **2. didChangeTheme.default:**
 * ```js
 * {
 *    theme: 'default'
 * }
 * ```
 * **3. beginLifecycleRequest.default:**
 * ```js
 * {
 *    lifecycleId: 'default'
 * }
 * ```
 * **4. didChangeAreaVisibility.content.true:**
 * ```js
 * {
 *    area: 'content',
 *    visible: true
 * }
 * ```
 * **5. didNavigate.testing:**
 * ```js
 * {
 *    place: 'testing',
 *    target: '_self',
 *    data: {}
 * }
 * ```
 *
 * Via the `optionalEvents` argument it is possible to add events with different topic suffixes, to
 * overwrite events defined above, or to completely prevent from triggering one of the events. To do so
 * simply pass a map, where the primary topics are the keys and the value is a map from topic suffix to
 * payload. If the value is `null`, the specific event is not published.
 *
 * Example:
 * ```js
 * axMocks.triggerStartupEvents( {
 *    didChangeLocale: {
 *       alternative: {
 *          locale: 'alternative',
 *          languageTag: 'de'
 *       }
 *    },
 *    didChangeTheme: {
 *       'default': null
 *    },
 *    didNavigate: {
 *       testing: {
 *          place: 'testing',
 *          target: '_self',
 *          data: {
 *             user: 'Peter',
 *             articleId: '1234'
 *          }
 *       }
 *    }
 * } );
 * ```
 *
 * The effect of this call is the following:
 * 1. There will be two *didChangeLocale* events: *didChangeLocale.default*, carrying the language tag *en*
 *    in its payload, and *didChangeLocale.alternative*, carrying the language tag *de* in its payload.
 * 2. There will be no *didChangeTheme* event, since the only pre-configured one is set to `null`.
 * 3. The parameters of the *didNavigate.testing* event are changed to be
 *    `{ user: 'Peter', articleId: '1234' }`.
 *
 * @param {Object} [optionalEvents]
 *    optional map of user defined events
 *
 */
export function triggerStartupEvents( optionalEvents = {} ) {
   defaultEvents
      .map( ({ topic, subtopics }) => ({
         topic,
         subtopics: { ...subtopics, ...optionalEvents[ topic ] }
      }) )
      .forEach( ({ topic, subtopics }) => {
         Object.keys( subtopics )
            .filter( key => subtopics[ key ] != null )
            .forEach( key => {
               eventBus.publish( `${topic}.${key}`, subtopics[ key ] );
            } );
         eventBus.flush();
      } );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function createSetupForWidget( descriptor, optionalOptions = {} ) {
   return () => {

      let htmlTemplate;
      let features = {};
      let loadingInfo;
      const { artifacts, adapter = plainAdapter } = optionalOptions;

      bootstrap( null, {
         widgetAdapters: [ decoratedAdapter( adapter ) ],
         configuration: {
            // TODO (#26) move to the test setup
            base: '/'
         },
         artifacts
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
         }, {
            onBeforeControllerCreation( _, services ) {
               // avoid creating services that were not actually injected:
               Object.keys( services ).forEach( k => {
                  delete widget[ k ];
                  Object.defineProperty( widget, k, {
                     configurable: true,
                     get: () => services[ k ]
                  } );
               } );
            }
         } ).then( info => {
            loadingInfo = info;
            return info.templatePromise.then( html => { htmlTemplate = html; } );
         } );
      };

      widgetPrivateApi.destroy = () => {
         if( loadingInfo ) {
            loadingInfo.destroy();
            loadingInfo = null;
         }
      };

      widgetPrivateApi.renderTo = container => {
         adapterInstance.domAttachTo( container, htmlTemplate );
      };
   };
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function handleErrorForJasmine( err ) {
   if( window.console && window.console.error ) {
      window.console.error( err );
   }
   jasmine.getEnv().fail( err );
}
