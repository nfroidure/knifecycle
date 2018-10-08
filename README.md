[//]: # ( )
[//]: # (This file is automatically generated by a `metapak`)
[//]: # (module. Do not change it  except between the)
[//]: # (`content:start/end` flags, your changes would)
[//]: # (be overridden.)
[//]: # ( )
# knifecycle
> Manage your NodeJS processes's lifecycle.

[![NPM version](https://badge.fury.io/js/knifecycle.svg)](https://npmjs.org/package/knifecycle)
[![Build status](https://secure.travis-ci.org/nfroidure/knifecycle.svg)](https://travis-ci.org/nfroidure/knifecycle)
[![Dependency Status](https://david-dm.org/nfroidure/knifecycle.svg)](https://david-dm.org/nfroidure/knifecycle)
[![devDependency Status](https://david-dm.org/nfroidure/knifecycle/dev-status.svg)](https://david-dm.org/nfroidure/knifecycle#info=devDependencies)
[![Coverage Status](https://coveralls.io/repos/nfroidure/knifecycle/badge.svg?branch=master)](https://coveralls.io/r/nfroidure/knifecycle?branch=master)
[![Code Climate](https://codeclimate.com/github/nfroidure/knifecycle.svg)](https://codeclimate.com/github/nfroidure/knifecycle)
[![Dependency Status](https://dependencyci.com/github/nfroidure/knifecycle/badge)](https://dependencyci.com/github/nfroidure/knifecycle)
[![Package Quality](http://npm.packagequality.com/shield/knifecycle.svg)](http://packagequality.com/#?package=knifecycle)


[//]: # (::contents:start)

[![Browser Support Matrix](https://saucelabs.com/open_sauce/build_matrix/nfroidure.svg)](https://saucelabs.com/u/nfroidure)

Most (maybe all) applications rely on two kinds of dependencies.

**The code dependencies** are fully covered by require/system
 modules in a testable manner (with `mockery` or `System`
 directly). There is no need for another dependency management
 system if those libraries are pure functions (involve no
 global states at all).

Unfortunately, applications often rely on **global states**
 where the JavaScript module system shows its limits. This
 is where `knifecycle` enters the game.

It is largely inspired by the Angular service system except
 it should not provide code but access to global states
 (time, filesystem, db). It also have an important additional
 feature to shutdown processes which is really useful for
 back-end servers and doesn't exists in Angular.

You may want to look at the
 [architecture notes](./ARCHITECTURE.md) to better handle the
 reasonning behind `knifecycle` and its implementation.

At this point you may think that a DI system is useless. My
 advice is that it depends. But at least, you should not
 make a definitive choice and allow both approaches. See
 [this Stack Overflow anser](http://stackoverflow.com/questions/9250851/do-i-need-dependency-injection-in-nodejs-or-how-to-deal-with/44084729#44084729)
 for more context about this statement.

## Features
- services management: start services taking their dependencies
 in count and shut them down the same way for graceful exits
 (namely dependency injection with inverted control);
- singleton: maintain singleton services across several running
 execution silos.
- easy end to end testing: just replace your services per your
 own mocks and stubs while ensuring your application integrity
 between testing and production;
- isolation: isolate processing in a clean manner, per concerns;
- functional programming ready: encapsulate global states
 allowing the rest of your application to be purely functional;
- no circular dependencies for services: while circular
 dependencies are not a problem within purely functional
 libraries (require allows it), it may be harmful for your
 services, `knifecycle` impeach that while providing an
 `$injector` service à la Angular to allow accessing existing
 services references if you really need to;
- generate Mermaid graphs of the dependency tree;
- build raw initialization modules to avoid
 embedding Knifecycle in your builds.
- optionally autoload services dependencies with custom
 logic

## Usage

Using `knifecycle` is all about declaring the services our
 application needs and running your application over it.

Let's say we are building a CLI script. He is how we would
 proceed with Knifecycle:
 
 
 First, we need to
 handle a configuration file so we are creating an
 initializer to instanciate our `CONFIG` service:
```js
// bin.js
import fs from 'fs';
import Knifecycle, { initializer, inject, name } from 'knifecycle';

// First of all we create a new Knifecycle instance
const $ = new Knifecycle();

// Some of our code with rely on the process environment
// let's inject it as a constant instead of directly
// pickking en vars in `process.env` to make our code
// easily testable
$.constant('ENV', process.env);

// Let's do so for CLI args with another constant
// in real world apps we would have create a service
// that would parse args in a complexer way
$.constant('ARGS', process.argv);

// We want our CLI tool to rely on some configuration
// Let's build an injectable service initializer that
// reads environment variables via an injected but
// optional `ENV` object
async function initConfig({ ENV = { CONFIG_PATH: '.' } }) {
  return new Promise((resolve, reject) => {
    fs.readFile(ENV.CONFIG_PATH, 'utf-8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
  });
}

// We are using the `initializer` decorator to
// declare our service initializer specificities
// and register it with our Knifecycle instance
$.register(
  initializer(
    {
      // we have to give our final service a name
      // for further use in other services injections
      name: 'CONFIG',
      // we will need an `ENV` variable in the initializer
      // so adding it in the injected dependencies. The `?`
      // sign tells Knifecycle that the ENV dependency
      // is optional
      inject: ['?ENV'],
      // our initializer is simple so we use the `service`
      // type for the initializer which just indicate that
      // the initializer will return a promise of the actual
      // service
      type: 'service',
      // We don't want to read the config file everytime we
      // inject it so declaring it as a singleton
      options: { singleton: true },
    },
    initConfig,
  ),
);

// Our CLI also uses a database so let's write an
// initializer for it:
const initDB = initializer(
  {
    name: 'db',
    // Here we are injecting the previous `CONFIG` service
    // as required so that our DB cannot be connected without
    // having a proper config.
    inject: ['CONFIG', 'DB_URI', '?log'],
    // The initializer type is slightly different. Indeed,
    // we need to manage the database connection errors
    // and wait for it to flush before shutting down the
    // process.
    // A service provider returns a promise of a provider
    // descriptor exposing:
    // - a mandatory `service` property containing the
    // actual service;
    // - an optional `dispose` function allowing to
    // gracefully close the service;
    // - an optional `fatalErrorPromise` property to
    // handle the service unrecoverable failure.
    type: 'provider',
    options: { singleton: true },
  },
  async ({ CONFIG, DB_URI, log }) => {
    const db = await MongoClient.connect(
      DB_URI,
      CONFIG.databaseOptions,
    );
    let fatalErrorPromise = new Promise((resolve, reject) => {
      db.once('error', reject);
    });

    // Logging only if the `log` service is defined
    log && log('info', 'db service initialized!');

    return {
      service: db,
      dispose: db.close.bind(db, true),
      fatalErrorPromise,
    };
  },
);

// Here we are registering our initializer apart to
// be able to reuse it, we also declare the required
// DB_URI constant it needs
$.constant('DB_URI', 'posgresql://xxxx').register(initDB);

// Say we need to use two different DB server
// We can reuse our initializer by tweaking
// some of its properties
$.constant('DB_URI2', 'posgresql://yyyy');
$.register(
  // First we remap the injected dependencies. It will
  // take the `DB_URI2` constant and inject it as
  // `DB_URI`
  inject(
    ['CONFIG', 'DB_URI2>DB_URI', '?log'],
    // Then we override its name to make it
    // available as a different service
    name('db2', initDB),
  ),
);

// A lot of NodeJS functions have some side effects
// declaring them as constants allows you to easily
// mock/monitor/patch it. The `common-services` NPM
// module contains a few useful ones
$.constant('now', Date.now.bind(Date))
  .constant('log', console.log.bind(console))
  .constant('exit', process.exit.bind(process));

// Finally, let's declare an `$autoload` service
// to allow us to load only the initializers needed
// to run the given commands
$.register(
  initializer(
    {
      name: '$autoload',
      type: 'service',
      inject: ['CONFIG', 'ARGS'],
      // Note that the auto loader must be a singleton
      options: { singleton: true }
    },
    async ({ CONFIG, ARGS }) => async serviceName => {
      if ('command' !== serviceName) {
        throw new Error(`${serviceName} not supported!`);
      }
      try {
        const path = CONFIG.commands + '/' + ARGS[2];
        return {
          path,
          initializer: require(path).default,
        };
      } catch (err) {
        throw new Error(`Cannot load ${serviceName}: ${ARGS[2]}!`);
      }
    },
  ),
);

// At this point, nothing is running. To instanciate the
// services, we have to create an execution silo using
// them. Note that we required the `$destroy` service
// implicitly created by `knifecycle`
$.run(['command', '$destroy', 'exit', 'log'])
  // Here, command contains the initializer eventually
  // found by automatically loading a NodeJS module
  // in the above `$autoload service`. The db connections
  // we only be instanciated if that command needs it
  .then(async ({ command, $destroy, exit, log }) => {
    try {
      command();

      log('It worked!');
    } catch (err) {
      log('It failed!', err);
    } finally {
      // Here we ensure every db connections are closed
      // properly
      await $destroy().catch(err => {
        console.error('Could not exit gracefully:', err);
        exit(1);
      });
    }
  })
  .catch(err => {
    console.error('Could not launch the app:', err);
    process.exit(1);
  });
```
Running the following should make the magic happen:
```sh
cat "{ commands: './commands'}" > config.json
DEBUG=knifecycle CONFIG_PATH=./config.json node -r @babel/register bin.js mycommand test
// Prints: Could not launch the app: Error: Cannot load command: mycommand!
// (...stack trace)
```
Or at least, we still have to create commands, let's create the `mycommand` one:
```js
// commands/mycommand.js
import { initializer } from './dist';

// A simple command that prints the given args
export default initializer(
  {
    name: 'command',
    type: 'service',
    // Here we could have injected whatever we declared
    // in the previous file: db, now, exit...
    inject: ['ARGS', 'log'],
  },
  async ({ ARGS, log }) => {
    return () => log('Command args:', ARGS.slice(2));
  },
);
```
So now, it works:
```sh
DEBUG=knifecycle CONFIG_PATH=./config.json node -r @babel/register bin.js mycommand test
// Prints: Command args: [ 'mycommand', 'test' ]
// It worked!
```

This is a very simple example but you can find a complexer CLI usage
 with (`metapak`)[https://github.com/nfroidure/metapak/blob/master/bin/metapak.js].

## Debugging

Simply use the DEBUG environment variable by setting it to
 'knifecycle':
```sh
DEBUG=knifecycle npm t
```
The output is very verbose but lead to a deep understanding of
 mechanisms that take place under the hood.

## Plans

The scope of this library won't change. However the plan is:
- improve performances;
- evolve with Node: I may not need to transpile this library at
 some point.
- track bugs ;).

I'll also share most of my own initializers and their
 stubs/mocks in order to let you reuse it through
 your projects easily. Here are the current projects
 that use this DI lib:
- [common-services](https://github.com/nfroidure/common-services):
contains the services I use the most in my apps.
- [swagger-http-router](https://github.com/nfroidure/swagger-http-router):
 a complete HTTP router based on OpenAPI definitions with a few useful
 services compatible with Knifecycle.
- [memory-kv-store](https://github.com/nfroidure/memory-kv-store):
 a simple in memory key-value store.

[//]: # (::contents:end)

# API
## Classes

<dl>
<dt><a href="#Knifecycle">Knifecycle</a></dt>
<dd></dd>
</dl>

## Functions

<dl>
<dt><a href="#buildInitializer">buildInitializer(constants, loader, dependencies)</a> ⇒ <code>Promise.&lt;String&gt;</code></dt>
<dd><p>Create a JavaScript module that initialize
a set of dependencies with hardcoded
import/awaits.</p>
</dd>
<dt><a href="#reuseSpecialProps">reuseSpecialProps(from, to, [amend])</a> ⇒ <code>function</code></dt>
<dd><p>Apply special props to the given function from another one</p>
</dd>
<dt><a href="#wrapInitializer">wrapInitializer(wrapper, baseInitializer)</a> ⇒ <code>function</code></dt>
<dd><p>Allows to wrap an initializer to add extra initialization steps</p>
</dd>
<dt><a href="#inject">inject(dependenciesDeclarations, initializer, [merge])</a> ⇒ <code>function</code></dt>
<dd><p>Decorator creating a new initializer with some
 dependencies declarations appended to it.</p>
</dd>
<dt><a href="#extra">extra(extraInformations, initializer, [merge])</a> ⇒ <code>function</code></dt>
<dd><p>Decorator creating a new initializer with some
 extra informations appended to it. It is just
 a way for user to store some additional
 informations but has no interaction with the
 Knifecycle internals.</p>
</dd>
<dt><a href="#options">options(options, initializer, [merge])</a> ⇒ <code>function</code></dt>
<dd><p>Decorator to amend an initializer options.</p>
</dd>
<dt><a href="#name">name(name, initializer)</a> ⇒ <code>function</code></dt>
<dd><p>Decorator to set an initializer name.</p>
</dd>
<dt><a href="#type">type(type, initializer)</a> ⇒ <code>function</code></dt>
<dd><p>Decorator to set an initializer type.</p>
</dd>
<dt><a href="#initializer">initializer(properties, initializer)</a> ⇒ <code>function</code></dt>
<dd><p>Decorator to set an initializer properties.</p>
</dd>
<dt><a href="#constant">constant(name, initializer)</a> ⇒ <code>function</code></dt>
<dd><p>Decorator that creates an initializer for a constant value</p>
</dd>
<dt><a href="#service">service(name, initializer, options)</a> ⇒ <code>function</code></dt>
<dd><p>Decorator that creates an initializer for a service</p>
</dd>
<dt><a href="#provider">provider(name, provider, options)</a> ⇒ <code>function</code></dt>
<dd><p>Decorator that creates an initializer for a provider</p>
</dd>
<dt><a href="#handler">handler(handlerFunction, [dependencies], [extra])</a> ⇒ <code>function</code></dt>
<dd><p>Shortcut to create an initializer with a simple handler</p>
</dd>
<dt><a href="#parseDependencyDeclaration">parseDependencyDeclaration(dependencyDeclaration)</a> ⇒ <code>Object</code></dt>
<dd><p>Explode a dependency declaration an returns its parts.</p>
</dd>
</dl>

<a name="Knifecycle"></a>

## Knifecycle
**Kind**: global class  

* [Knifecycle](#Knifecycle)
    * [new Knifecycle()](#new_Knifecycle_new)
    * _instance_
        * ~~[.constant(constantName, constantValue)](#Knifecycle+constant) ⇒ [<code>Knifecycle</code>](#Knifecycle)~~
        * ~~[.service(serviceName, serviceBuilder, options)](#Knifecycle+service) ⇒ [<code>Knifecycle</code>](#Knifecycle)~~
        * ~~[.provider(serviceName, initializer, options)](#Knifecycle+provider) ⇒ [<code>Knifecycle</code>](#Knifecycle)~~
        * [.register(initializer)](#Knifecycle+register) ⇒ [<code>Knifecycle</code>](#Knifecycle)
        * [.toMermaidGraph(options)](#Knifecycle+toMermaidGraph) ⇒ <code>String</code>
        * [.run(dependenciesDeclarations)](#Knifecycle+run) ⇒ <code>Promise</code>
        * [._getServiceDescriptor(siloContext, serviceName, options, serviceProvider)](#Knifecycle+_getServiceDescriptor) ⇒ <code>Promise</code>
        * [._initializeServiceDescriptor(siloContext, serviceName, options)](#Knifecycle+_initializeServiceDescriptor) ⇒ <code>Promise</code>
        * [._initializeDependencies(siloContext, serviceName, servicesDeclarations, options)](#Knifecycle+_initializeDependencies) ⇒ <code>Promise</code>
    * _static_
        * ~~[.getInstance()](#Knifecycle.getInstance) ⇒ [<code>Knifecycle</code>](#Knifecycle)~~

<a name="new_Knifecycle_new"></a>

### new Knifecycle()
Create a new Knifecycle instance

**Returns**: [<code>Knifecycle</code>](#Knifecycle) - The Knifecycle instance  
**Example**  
```js
import Knifecycle from 'knifecycle'

const $ = new Knifecycle();
```
<a name="Knifecycle+constant"></a>

### ~~knifecycle.constant(constantName, constantValue) ⇒ [<code>Knifecycle</code>](#Knifecycle)~~
***Deprecated***

Register a constant initializer

**Kind**: instance method of [<code>Knifecycle</code>](#Knifecycle)  
**Returns**: [<code>Knifecycle</code>](#Knifecycle) - The Knifecycle instance (for chaining)  

| Param | Type | Description |
| --- | --- | --- |
| constantName | <code>String</code> | The name of the service |
| constantValue | <code>any</code> | The constant value |

**Example**  
```js
import Knifecycle from 'knifecycle'

const $ = new Knifecycle();

// Expose the process env
$.constant('ENV', process.env);
// Expose a time() function
$.constant('time', Date.now.bind(Date));
```
<a name="Knifecycle+service"></a>

### ~~knifecycle.service(serviceName, serviceBuilder, options) ⇒ [<code>Knifecycle</code>](#Knifecycle)~~
***Deprecated***

Register a service initializer

**Kind**: instance method of [<code>Knifecycle</code>](#Knifecycle)  
**Returns**: [<code>Knifecycle</code>](#Knifecycle) - The Knifecycle instance (for chaining)  

| Param | Type | Description |
| --- | --- | --- |
| serviceName | <code>String</code> | Service name |
| serviceBuilder | <code>function</code> | An asynchronous function returning the actual service |
| options | <code>Object</code> | Options attached to the initializer |

**Example**  
```js
import Knifecycle from 'knifecycle'
import fs from 'fs';

const $ = new Knifecycle();

$.service('config', configServiceInitializer, {
  singleton: true,
});

function configServiceInitializer({ CONFIG_PATH }) {
  return new Promise((resolve, reject) {
    fs.readFile(CONFIG_PATH, function(err, data) {
      if(err) {
        return reject(err);
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
  }, 'utf-8');
}
```
<a name="Knifecycle+provider"></a>

### ~~knifecycle.provider(serviceName, initializer, options) ⇒ [<code>Knifecycle</code>](#Knifecycle)~~
***Deprecated***

Register a provider initializer

**Kind**: instance method of [<code>Knifecycle</code>](#Knifecycle)  
**Returns**: [<code>Knifecycle</code>](#Knifecycle) - The Knifecycle instance (for chaining)  

| Param | Type | Description |
| --- | --- | --- |
| serviceName | <code>String</code> | Service name resolved by the provider |
| initializer | <code>function</code> | An initializer returning the service promise |
| options | <code>Object</code> | Options attached to the initializer |

**Example**  
```js
import Knifecycle from 'knifecycle'
import fs from 'fs';

const $ = new Knifecycle();

$.register(provider('config', function configProvider() {
  return new Promise((resolve, reject) {
    fs.readFile('config.js', function(err, data) {
      let config;
      if(err) {
        return reject(err);
      }
      try {
        config = JSON.parse(data.toString);
      } catch (err) {
        return reject(err);
      }
      resolve({
        service: config,
      });
    });
  });
}));
```
<a name="Knifecycle+register"></a>

### knifecycle.register(initializer) ⇒ [<code>Knifecycle</code>](#Knifecycle)
Register an initializer

**Kind**: instance method of [<code>Knifecycle</code>](#Knifecycle)  
**Returns**: [<code>Knifecycle</code>](#Knifecycle) - The Knifecycle instance (for chaining)  

| Param | Type | Description |
| --- | --- | --- |
| initializer | <code>function</code> | An initializer |

<a name="Knifecycle+toMermaidGraph"></a>

### knifecycle.toMermaidGraph(options) ⇒ <code>String</code>
Outputs a Mermaid compatible dependency graph of the declared services.
See [Mermaid docs](https://github.com/knsv/mermaid)

**Kind**: instance method of [<code>Knifecycle</code>](#Knifecycle)  
**Returns**: <code>String</code> - Returns a string containing the Mermaid dependency graph  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Options for generating the graph (destructured) |
| options.shapes | <code>Array.&lt;Object&gt;</code> | Various shapes to apply |
| options.styles | <code>Array.&lt;Object&gt;</code> | Various styles to apply |
| options.classes | <code>Object</code> | A hash of various classes contents |

**Example**  
```js
import { Knifecycle, inject, constant, service } from 'knifecycle';
import appInitializer from './app';

const $ = new Knifecycle();

$.register(constant('ENV', process.env));
$.register(constant('OS', require('os')));
$.register(service('app', inject(['ENV', 'OS'], appInitializer)));
$.toMermaidGraph();

// returns
graph TD
  app-->ENV
  app-->OS
```
<a name="Knifecycle+run"></a>

### knifecycle.run(dependenciesDeclarations) ⇒ <code>Promise</code>
Creates a new execution silo

**Kind**: instance method of [<code>Knifecycle</code>](#Knifecycle)  
**Returns**: <code>Promise</code> - Service descriptor promise  

| Param | Type | Description |
| --- | --- | --- |
| dependenciesDeclarations | <code>Array.&lt;String&gt;</code> | Service name. |

**Example**  
```js
import Knifecycle from 'knifecycle'

const $ = new Knifecycle();

$.register(constant('ENV', process.env));
$.run(['ENV'])
.then(({ ENV }) => {
 // Here goes your code
})
```
<a name="Knifecycle+_getServiceDescriptor"></a>

### knifecycle._getServiceDescriptor(siloContext, serviceName, options, serviceProvider) ⇒ <code>Promise</code>
Initialize or return a service descriptor

**Kind**: instance method of [<code>Knifecycle</code>](#Knifecycle)  
**Returns**: <code>Promise</code> - Service dependencies hash promise.  

| Param | Type | Description |
| --- | --- | --- |
| siloContext | <code>Object</code> | Current execution silo context |
| serviceName | <code>String</code> | Service name. |
| options | <code>Object</code> | Options for service retrieval |
| options.injectOnly | <code>Boolean</code> | Flag indicating if existing services only should be used |
| options.autoloading | <code>Boolean</code> | Flag to indicating $autoload dependencies on the fly loading |
| serviceProvider | <code>String</code> | Service provider. |

<a name="Knifecycle+_initializeServiceDescriptor"></a>

### knifecycle._initializeServiceDescriptor(siloContext, serviceName, options) ⇒ <code>Promise</code>
Initialize a service descriptor

**Kind**: instance method of [<code>Knifecycle</code>](#Knifecycle)  
**Returns**: <code>Promise</code> - Service dependencies hash promise.  

| Param | Type | Description |
| --- | --- | --- |
| siloContext | <code>Object</code> | Current execution silo context |
| serviceName | <code>String</code> | Service name. |
| options | <code>Object</code> | Options for service retrieval |
| options.injectOnly | <code>Boolean</code> | Flag indicating if existing services only should be used |
| options.autoloading | <code>Boolean</code> | Flag to indicating $autoload dependendencies on the fly loading. |

<a name="Knifecycle+_initializeDependencies"></a>

### knifecycle._initializeDependencies(siloContext, serviceName, servicesDeclarations, options) ⇒ <code>Promise</code>
Initialize a service dependencies

**Kind**: instance method of [<code>Knifecycle</code>](#Knifecycle)  
**Returns**: <code>Promise</code> - Service dependencies hash promise.  

| Param | Type | Description |
| --- | --- | --- |
| siloContext | <code>Object</code> | Current execution silo siloContext |
| serviceName | <code>String</code> | Service name. |
| servicesDeclarations | <code>String</code> | Dependencies declarations. |
| options | <code>Object</code> | Options for service retrieval |
| options.injectOnly | <code>Boolean</code> | Flag indicating if existing services only should be used |
| options.autoloading | <code>Boolean</code> | Flag to indicating $autoload dependendencies on the fly loading. |

<a name="Knifecycle.getInstance"></a>

### ~~Knifecycle.getInstance() ⇒ [<code>Knifecycle</code>](#Knifecycle)~~
***Deprecated***

Returns a Knifecycle instance (always the same)

**Kind**: static method of [<code>Knifecycle</code>](#Knifecycle)  
**Returns**: [<code>Knifecycle</code>](#Knifecycle) - The created/saved instance  
**Example**  
```js
import { getInstance } from 'knifecycle'

const $ = getInstance();
```
<a name="buildInitializer"></a>

## buildInitializer(constants, loader, dependencies) ⇒ <code>Promise.&lt;String&gt;</code>
Create a JavaScript module that initialize
a set of dependencies with hardcoded
import/awaits.

**Kind**: global function  
**Returns**: <code>Promise.&lt;String&gt;</code> - The JavaScript module content  

| Param | Type | Description |
| --- | --- | --- |
| constants | <code>Object</code> | An hash for simple constants |
| loader | <code>function</code> | The dependency auto-loader |
| dependencies | <code>Array.&lt;String&gt;</code> | The main dependencies |

**Example**  
```js
import buildInitializer from 'knifecycle/src/build';

buildInitializer(constants, loader, ['entryPoint']);
```
<a name="reuseSpecialProps"></a>

## reuseSpecialProps(from, to, [amend]) ⇒ <code>function</code>
Apply special props to the given function from another one

**Kind**: global function  
**Returns**: <code>function</code> - The newly built function  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| from | <code>function</code> |  | The initialization function in which to pick the props |
| to | <code>function</code> |  | The initialization function from which to build the new one |
| [amend] | <code>Object</code> | <code>{}</code> | Some properties to override |

<a name="wrapInitializer"></a>

## wrapInitializer(wrapper, baseInitializer) ⇒ <code>function</code>
Allows to wrap an initializer to add extra initialization steps

**Kind**: global function  
**Returns**: <code>function</code> - The new initializer  

| Param | Type | Description |
| --- | --- | --- |
| wrapper | <code>function</code> | A function taking dependencies and the base service in arguments |
| baseInitializer | <code>function</code> | The initializer to decorate |

<a name="inject"></a>

## inject(dependenciesDeclarations, initializer, [merge]) ⇒ <code>function</code>
Decorator creating a new initializer with some
 dependencies declarations appended to it.

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| dependenciesDeclarations | <code>Array.&lt;String&gt;</code> |  | List of dependencies declarations to declare which  services the initializer needs to resolve its  own service. |
| initializer | <code>function</code> |  | The initializer to tweak |
| [merge] | <code>Boolean</code> | <code>false</code> | Whether dependencies should be merged with existing  ones or not |

**Example**  
```js
import { inject, getInstance } from 'knifecycle'
import myServiceInitializer from './service';

getInstance()
.service('myService',
  inject(['ENV'], myServiceInitializer)
);
```
<a name="extra"></a>

## extra(extraInformations, initializer, [merge]) ⇒ <code>function</code>
Decorator creating a new initializer with some
 extra informations appended to it. It is just
 a way for user to store some additional
 informations but has no interaction with the
 Knifecycle internals.

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| extraInformations | <code>Object</code> |  | An object containing those extra informations. |
| initializer | <code>function</code> |  | The initializer to tweak |
| [merge] | <code>Boolean</code> | <code>false</code> | Whether the extra object should be merged with the existing one or not |

**Example**  
```js
import { extra, getInstance } from 'knifecycle'
import myServiceInitializer from './service';

getInstance()
.service('myService',
  extra({ httpHandler: true }, myServiceInitializer)
);
```
<a name="options"></a>

## options(options, initializer, [merge]) ⇒ <code>function</code>
Decorator to amend an initializer options.

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  | Options to set to the initializer |
| options.singleton | <code>Object</code> |  | Define the initializer service as a singleton (one instance for several runs) |
| initializer | <code>function</code> |  | The initializer to tweak |
| [merge] | <code>function</code> | <code>true</code> | Whether options should be merged or not |

**Example**  
```js
import { inject, options, getInstance } from 'knifecycle';
import myServiceInitializer from './service';

getInstance()
.service('myService',
  inject(['ENV'],
    options({ singleton: true}, myServiceInitializer)
  )
);
```
<a name="name"></a>

## name(name, initializer) ⇒ <code>function</code>
Decorator to set an initializer name.

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer with that name set  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | The name of the service the initializer resolves to. |
| initializer | <code>function</code> | The initializer to tweak |

**Example**  
```js
import { name, getInstance } from 'knifecycle';
import myServiceInitializer from './service';

getInstance()
.register(name('myService', myServiceInitializer));
```
<a name="type"></a>

## type(type, initializer) ⇒ <code>function</code>
Decorator to set an initializer type.

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>String</code> | The type to set to the initializer. |
| initializer | <code>function</code> | The initializer to tweak |

**Example**  
```js
import { name, type, getInstance } from 'knifecycle';
import myServiceInitializer from './service';

getInstance()
.register(
  type('service',
    name('myService',
      myServiceInitializer
    )
  )
 );
```
<a name="initializer"></a>

## initializer(properties, initializer) ⇒ <code>function</code>
Decorator to set an initializer properties.

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Description |
| --- | --- | --- |
| properties | <code>Object</code> | Properties to set to the service. |
| initializer | <code>function</code> | The initializer to tweak |

**Example**  
```js
import { initializer, getInstance } from 'knifecycle';
import myServiceInitializer from './service';

getInstance()
.register(initializer({
  name: 'myService',
  type: 'service',
  inject: ['ENV'],
  options: { singleton: true }
}, myServiceInitializer));
```
<a name="constant"></a>

## constant(name, initializer) ⇒ <code>function</code>
Decorator that creates an initializer for a constant value

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | The constant's name. |
| initializer | <code>any</code> | The constant's value |

**Example**  
```js
import { Knifecycle, constant, service } from 'knifecycle';

const { printAnswer } = new Knifecycle()
  .register(constant('THE_NUMBER', value))
  .register(constant('log', console.log.bind(console)))
  .register(service(
    'printAnswer',
    async ({ THE_NUMBER, log }) => () => log(THE_NUMBER),
    {
      inject: ['THE_NUMBER', 'log'],
    }
  .run(['printAnswer']);

printAnswer(); // 42
```
<a name="service"></a>

## service(name, initializer, options) ⇒ <code>function</code>
Decorator that creates an initializer for a service

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | The service's name. |
| initializer | <code>function</code> | An initializer returning the service promise |
| options | <code>Object</code> | Options attached to the initializer |

**Example**  
```js
import { Knifecycle, constant, service } from 'knifecycle';

const { printAnswer } = new Knifecycle()
  .register(constant('THE_NUMBER', value))
  .register(constant('log', console.log.bind(console)))
  .register(service(
    'printAnswer',
    async ({ THE_NUMBER, log }) => () => log(THE_NUMBER),
    {
      inject: ['THE_NUMBER', 'log'],
    }
  .run(['printAnswer']);

printAnswer(); // 42
```
<a name="provider"></a>

## provider(name, provider, options) ⇒ <code>function</code>
Decorator that creates an initializer for a provider

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | The provider's name. |
| provider | <code>function</code> | A provider returning the service builder promise |
| options | <code>Object</code> | Options attached to the initializer |

**Example**  
```js
import Knifecycle from 'knifecycle'
import fs from 'fs';

const $ = new Knifecycle();

$.register(provider('config', async function configProvider() {
  return new Promise((resolve, reject) {
    fs.readFile('config.js', function(err, data) {
      let config;

      if(err) {
        reject(err);
        return;
      }

      try {
        config = JSON.parse(data.toString);
      } catch (err) {
        reject(err);
        return;
      }

      resolve({
        service: config,
      });
    });
  });
}));
```
<a name="handler"></a>

## handler(handlerFunction, [dependencies], [extra]) ⇒ <code>function</code>
Shortcut to create an initializer with a simple handler

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| handlerFunction | <code>function</code> |  | The handler function |
| [dependencies] | <code>Array</code> | <code>[]</code> | The dependencies to inject in it |
| [extra] | <code>Object</code> |  | Optional extra data to associate with the handler |

**Example**  
```js
import { initializer, getInstance } from 'knifecycle';

getInstance()
.register(handler(getUser, ['db', '?log']));

const QUERY = `SELECT * FROM users WHERE id=$1`
async function getUser({ db }, userId) {
  const [row] = await db.query(QUERY, userId);

  return row;
}
```
<a name="parseDependencyDeclaration"></a>

## parseDependencyDeclaration(dependencyDeclaration) ⇒ <code>Object</code>
Explode a dependency declaration an returns its parts.

**Kind**: global function  
**Returns**: <code>Object</code> - The various parts of it  

| Param | Type | Description |
| --- | --- | --- |
| dependencyDeclaration | <code>String</code> | A dependency declaration string |

**Example**  
```js
parseDependencyDeclaration('pgsql>db');
// Returns
{
  serviceName: 'pgsql',
  mappedName: 'db',
  optional: false,
}
```

# Authors
- [Nicolas Froidure](http://insertafter.com/en/index.html)

# License
[MIT](https://github.com/nfroidure/knifecycle/blob/master/LICENSE)
