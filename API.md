# API
## Classes

<dl>
<dt><a href="#Knifecycle">Knifecycle</a></dt>
<dd></dd>
</dl>

## Functions

<dl>
<dt><a href="#initInitializerBuilder">initInitializerBuilder(services)</a> ⇒ <code>Promise.&lt;function()&gt;</code></dt>
<dd><p>Instantiate the initializer builder service</p>
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
    * ~~[.constant(constantName, constantValue)](#Knifecycle+constant) ⇒ [<code>Knifecycle</code>](#Knifecycle)~~
    * ~~[.service(serviceName, serviceBuilder, options)](#Knifecycle+service) ⇒ [<code>Knifecycle</code>](#Knifecycle)~~
    * ~~[.provider(serviceName, initializer, options)](#Knifecycle+provider) ⇒ [<code>Knifecycle</code>](#Knifecycle)~~
    * [.register(initializer)](#Knifecycle+register) ⇒ [<code>Knifecycle</code>](#Knifecycle)
    * [.toMermaidGraph(options)](#Knifecycle+toMermaidGraph) ⇒ <code>String</code>
    * [.run(dependenciesDeclarations)](#Knifecycle+run) ⇒ <code>Promise</code>
    * [._getServiceDescriptor(siloContext, serviceName, options, serviceProvider)](#Knifecycle+_getServiceDescriptor) ⇒ <code>Promise</code>
    * [._initializeServiceDescriptor(siloContext, serviceName, options)](#Knifecycle+_initializeServiceDescriptor) ⇒ <code>Promise</code>
    * [._initializeDependencies(siloContext, serviceName, servicesDeclarations, options)](#Knifecycle+_initializeDependencies) ⇒ <code>Promise</code>

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

<a name="initInitializerBuilder"></a>

## initInitializerBuilder(services) ⇒ <code>Promise.&lt;function()&gt;</code>
Instantiate the initializer builder service

**Kind**: global function  
**Returns**: <code>Promise.&lt;function()&gt;</code> - A promise of the buildInitializer function  

| Param | Type | Description |
| --- | --- | --- |
| services | <code>Object</code> | The services to inject |
| services.$autoload | <code>Object</code> | The dependencies autoloader |

**Example**  
```js
import initInitializerBuilder from 'knifecycle/dist/build';

const buildInitializer = await initInitializerBuilder({
  $autoload: async () => {},
});
```
<a name="initInitializerBuilder..buildInitializer"></a>

### initInitializerBuilder~buildInitializer(dependencies) ⇒ <code>Promise.&lt;String&gt;</code>
Create a JavaScript module that initialize
a set of dependencies with hardcoded
import/awaits.

**Kind**: inner method of [<code>initInitializerBuilder</code>](#initInitializerBuilder)  
**Returns**: <code>Promise.&lt;String&gt;</code> - The JavaScript module content  

| Param | Type | Description |
| --- | --- | --- |
| dependencies | <code>Array.&lt;String&gt;</code> | The main dependencies |

**Example**  
```js
import initInitializerBuilder from 'knifecycle/dist/build';

const buildInitializer = await initInitializerBuilder({
  $autoload: async () => {},
});

const content = await buildInitializer(['entryPoint']);
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
