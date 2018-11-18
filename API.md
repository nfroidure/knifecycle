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
<dt><a href="#inject">inject(dependencies, initializer)</a> ⇒ <code>function</code></dt>
<dd><p>Decorator creating a new initializer with different
 dependencies declarations set to it.</p>
</dd>
<dt><a href="#autoInject">autoInject(initializer)</a> ⇒ <code>function</code></dt>
<dd><p>Decorator creating a new initializer with different
 dependencies declarations set to it according to the
 given function signature.</p>
</dd>
<dt><a href="#alsoInject">alsoInject(dependencies, initializer)</a> ⇒ <code>function</code></dt>
<dd><p>Decorator creating a new initializer with some
 more dependencies declarations appended to it.</p>
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
<dt><a href="#autoName">autoName(initializer)</a> ⇒ <code>function</code></dt>
<dd><p>Decorator to set an initializer name from its function name.</p>
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
<dt><a href="#service">service(builder, [name], [dependencies], [options])</a> ⇒ <code>function</code></dt>
<dd><p>Decorator that creates an initializer for a service</p>
</dd>
<dt><a href="#autoService">autoService(initializer)</a> ⇒ <code>function</code></dt>
<dd><p>Decorator that auto creates a service</p>
</dd>
<dt><a href="#provider">provider(builder, [name], [dependencies], [options])</a> ⇒ <code>function</code></dt>
<dd><p>Decorator that creates an initializer for a provider</p>
</dd>
<dt><a href="#autoProvider">autoProvider(initializer)</a> ⇒ <code>function</code></dt>
<dd><p>Decorator that auto creates a provider</p>
</dd>
<dt><a href="#handler">handler(handlerFunction, [name], [dependencies], [options])</a> ⇒ <code>function</code></dt>
<dd><p>Shortcut to create an initializer with a simple handler</p>
</dd>
<dt><a href="#autoHandler">autoHandler(handlerFunction)</a> ⇒ <code>function</code></dt>
<dd><p>Allows to create an initializer with a simple handler automagically</p>
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
import Knifecycle, { inject, constant, service } from 'knifecycle';
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
import Knifecycle, { constant } from 'knifecycle'

const $ = new Knifecycle();

$.register(constant('ENV', process.env));
$.run(['ENV'])
.then(({ ENV }) => {
 // Here goes your code
})
```
<a name="Knifecycle+_getServiceDescriptor"></a>

### knifecycle.\_getServiceDescriptor(siloContext, serviceName, options, serviceProvider) ⇒ <code>Promise</code>
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

### knifecycle.\_initializeServiceDescriptor(siloContext, serviceName, options) ⇒ <code>Promise</code>
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

### knifecycle.\_initializeDependencies(siloContext, serviceName, servicesDeclarations, options) ⇒ <code>Promise</code>
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

## inject(dependencies, initializer) ⇒ <code>function</code>
Decorator creating a new initializer with different
 dependencies declarations set to it.

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Description |
| --- | --- | --- |
| dependencies | <code>Array.&lt;String&gt;</code> | List of dependencies declarations to declare which  services the initializer needs to resolve its  own service |
| initializer | <code>function</code> | The initializer to tweak |

**Example**  
```js
import Knifecycle, { inject } from 'knifecycle'
import myServiceInitializer from './service';

new Knifecycle()
 .register(
   service(
     inject(['ENV'], myServiceInitializer)
     'myService',
   )
  )
);
```
<a name="autoInject"></a>

## autoInject(initializer) ⇒ <code>function</code>
Decorator creating a new initializer with different
 dependencies declarations set to it according to the
 given function signature.

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Description |
| --- | --- | --- |
| initializer | <code>function</code> | The original initializer |

**Example**  
```js
import Knifecycle, { autoInject, name } from 'knifecycle'

new Knifecycle()
  .register(
    name(
      'application',
      autoInject(
        async ({ NODE_ENV, mysql: db }) =>
          async () => db.query('SELECT applicationId FROM applications WHERE environment=?', [NODE_ENV])
        )
      )
    )
  )
);
```
<a name="alsoInject"></a>

## alsoInject(dependencies, initializer) ⇒ <code>function</code>
Decorator creating a new initializer with some
 more dependencies declarations appended to it.

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Description |
| --- | --- | --- |
| dependencies | <code>Array.&lt;String&gt;</code> | List of dependencies declarations to append |
| initializer | <code>function</code> | The initializer to tweak |

**Example**  
```js
import Knifecycle, { alsoInject } from 'knifecycle'
import myServiceInitializer from './service';

new Knifecycle()
.register(service(
  alsoInject(['ENV'], myServiceInitializer),
  'myService',
));
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
import Knifecycle, { extra } from 'knifecycle'
import myServiceInitializer from './service';

new Knifecycle()
.register(service(
  extra({ httpHandler: true }, myServiceInitializer),
  'myService',
));
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
import Knifecycle, { inject, options } from 'knifecycle';
import myServiceInitializer from './service';

new Knifecycle()
.register(service(
  inject(['ENV'],
    options({ singleton: true}, myServiceInitializer)
  ),
  'myService',
));
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
import Knifecycle, { name } from 'knifecycle';
import myServiceInitializer from './service';

new Knifecycle()
.register(name('myService', myServiceInitializer));
```
<a name="autoName"></a>

## autoName(initializer) ⇒ <code>function</code>
Decorator to set an initializer name from its function name.

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer with that name set  

| Param | Type | Description |
| --- | --- | --- |
| initializer | <code>function</code> | The initializer to name |

**Example**  
```js
import Knifecycle, { autoName } from 'knifecycle';

new Knifecycle()
.register(name(async function myService() {}));
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
import Knifecycle, { name, type } from 'knifecycle';
import myServiceInitializer from './service';

new Knifecycle()
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
import Knifecycle, { initializer } from 'knifecycle';
import myServiceInitializer from './service';

new Knifecycle()
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
import Knifecycle, { constant, service } from 'knifecycle';

const { printAnswer } = new Knifecycle()
  .register(constant('THE_NUMBER', value))
  .register(constant('log', console.log.bind(console)))
  .register(service(
    async ({ THE_NUMBER, log }) => () => log(THE_NUMBER),
    'printAnswer',
    ['THE_NUMBER', 'log'],
  ))
  .run(['printAnswer']);

printAnswer(); // 42
```
<a name="service"></a>

## service(builder, [name], [dependencies], [options]) ⇒ <code>function</code>
Decorator that creates an initializer for a service

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Description |
| --- | --- | --- |
| builder | <code>function</code> | An initializer returning the service promise |
| [name] | <code>String</code> | The service's name |
| [dependencies] | <code>Array.&lt;String&gt;</code> | The service's dependencies |
| [options] | <code>Object</code> | Options attached to the built initializer |

**Example**  
```js
import Knifecycle, { constant, service } from 'knifecycle';

const { printAnswer } = new Knifecycle()
  .register(constant('THE_NUMBER', value))
  .register(constant('log', console.log.bind(console)))
  .register(service(
    async ({ THE_NUMBER, log }) => () => log(THE_NUMBER),
    'printAnswer',
    ['THE_NUMBER', 'log'],
    { singleton: true }
  ))
  .run(['printAnswer']);

printAnswer(); // 42
```
<a name="autoService"></a>

## autoService(initializer) ⇒ <code>function</code>
Decorator that auto creates a service

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Description |
| --- | --- | --- |
| initializer | <code>function</code> | An initializer returning the service promise |

<a name="provider"></a>

## provider(builder, [name], [dependencies], [options]) ⇒ <code>function</code>
Decorator that creates an initializer for a provider

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Description |
| --- | --- | --- |
| builder | <code>function</code> | A builder returning the provider promise |
| [name] | <code>String</code> | The service's name |
| [dependencies] | <code>Array.&lt;String&gt;</code> | The service's dependencies |
| [options] | <code>Object</code> | Options attached to the built initializer |

**Example**  
```js
import Knifecycle, { provider } from 'knifecycle'
import fs from 'fs';

const $ = new Knifecycle();

$.register(provider(configProvider, 'config'));

async function configProvider() {
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
}
```
<a name="autoProvider"></a>

## autoProvider(initializer) ⇒ <code>function</code>
Decorator that auto creates a provider

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Description |
| --- | --- | --- |
| initializer | <code>function</code> | An initializer returning the provider promise |

<a name="handler"></a>

## handler(handlerFunction, [name], [dependencies], [options]) ⇒ <code>function</code>
Shortcut to create an initializer with a simple handler

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| handlerFunction | <code>function</code> |  | The handler function |
| [name] | <code>String</code> |  | The name of the handler. Default to the DI prop if exists |
| [dependencies] | <code>Array.&lt;String&gt;</code> | <code>[]</code> | The dependencies to inject in it |
| [options] | <code>Object</code> |  | Options attached to the built initializer |

**Example**  
```js
import Knifecycle, { handler } from 'knifecycle';

new Knifecycle()
.register(handler(getUser, 'getUser', ['db', '?log']));

const QUERY = `SELECT * FROM users WHERE id=$1`
async function getUser({ db }, userId) {
  const [row] = await db.query(QUERY, userId);

  return row;
}
```
<a name="autoHandler"></a>

## autoHandler(handlerFunction) ⇒ <code>function</code>
Allows to create an initializer with a simple handler automagically

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Description |
| --- | --- | --- |
| handlerFunction | <code>function</code> | The handler function |

**Example**  
```js
import Knifecycle, { autoHandler } from 'knifecycle';

new Knifecycle()
.register(autoHandler(getUser));

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
