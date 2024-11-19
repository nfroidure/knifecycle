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
<dt><a href="#initDispose">initDispose()</a></dt>
<dd><p>Allow to dispose the services of an
initialized silo content.</p>
</dd>
<dt><a href="#constant">constant(name, value)</a> ⇒ <code>function</code></dt>
<dd><p>Decorator that creates an initializer for a constant value</p>
</dd>
<dt><a href="#service">service(serviceBuilder, [name], [dependencies], [singleton], [extra])</a> ⇒ <code>function</code></dt>
<dd><p>Decorator that creates an initializer from a service builder</p>
</dd>
<dt><a href="#autoService">autoService(serviceBuilder)</a> ⇒ <code>function</code></dt>
<dd><p>Decorator that creates an initializer from a service
 builder by automatically detecting its name
 and dependencies</p>
</dd>
<dt><a href="#provider">provider(providerBuilder, [name], [dependencies], [singleton], [extra])</a> ⇒ <code>function</code></dt>
<dd><p>Decorator that creates an initializer for a provider
 builder</p>
</dd>
<dt><a href="#autoProvider">autoProvider(providerBuilder)</a> ⇒ <code>function</code></dt>
<dd><p>Decorator that creates an initializer from a provider
 builder by automatically detecting its name
 and dependencies</p>
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
<dt><a href="#stringifyDependencyDeclaration">stringifyDependencyDeclaration(dependencyDeclarationParts)</a> ⇒ <code>String</code></dt>
<dd><p>Stringify a dependency declaration from its parts.</p>
</dd>
</dl>

<a name="Knifecycle"></a>

## Knifecycle
**Kind**: global class  

* [Knifecycle](#Knifecycle)
    * [new Knifecycle(options)](#new_Knifecycle_new)
    * [.register(initializer)](#Knifecycle+register) ⇒ [<code>Knifecycle</code>](#Knifecycle)
    * [.toMermaidGraph(options)](#Knifecycle+toMermaidGraph) ⇒ <code>String</code>
    * [.run(dependenciesDeclarations)](#Knifecycle+run) ⇒ <code>Promise</code>
    * [.destroy()](#Knifecycle+destroy) ⇒ <code>Promise</code>

<a name="new_Knifecycle_new"></a>

### new Knifecycle(options)
Create a new Knifecycle instance

**Returns**: [<code>Knifecycle</code>](#Knifecycle) - The Knifecycle instance  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | An object with options |
| options.sequential | <code>boolean</code> | Allows to load dependencies sequentially (usefull for debugging) |

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
<a name="Knifecycle+destroy"></a>

### knifecycle.destroy() ⇒ <code>Promise</code>
Destroy the Knifecycle instance

**Kind**: instance method of [<code>Knifecycle</code>](#Knifecycle)  
**Returns**: <code>Promise</code> - Full destruction promise  
**Example**  
```js
import Knifecycle, { constant } from 'knifecycle'

const $ = new Knifecycle();

$.register(constant('ENV', process.env));
$.run(['ENV'])
.then(({ ENV }) => {
   // Here goes your code

   // Finally destroy the instance
   $.destroy()
})
```
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
<a name="initDispose"></a>

## initDispose()
Allow to dispose the services of an
initialized silo content.

**Kind**: global function  
<a name="constant"></a>

## constant(name, value) ⇒ <code>function</code>
Decorator that creates an initializer for a constant value

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new constant initializer  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | The constant's name. |
| value | <code>any</code> | The constant's value |

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

## service(serviceBuilder, [name], [dependencies], [singleton], [extra]) ⇒ <code>function</code>
Decorator that creates an initializer from a service builder

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Description |
| --- | --- | --- |
| serviceBuilder | <code>function</code> | An async function to build the service |
| [name] | <code>String</code> | The service's name |
| [dependencies] | <code>Array.&lt;String&gt;</code> | The service's injected dependencies |
| [singleton] | <code>Boolean</code> | Whether the service is a singleton or not |
| [extra] | <code>any</code> | Eventual extra information |

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
    true
  ))
  .run(['printAnswer']);

printAnswer(); // 42
```
<a name="autoService"></a>

## autoService(serviceBuilder) ⇒ <code>function</code>
Decorator that creates an initializer from a service
 builder by automatically detecting its name
 and dependencies

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new initializer  

| Param | Type | Description |
| --- | --- | --- |
| serviceBuilder | <code>function</code> | An async function to build the service |

<a name="provider"></a>

## provider(providerBuilder, [name], [dependencies], [singleton], [extra]) ⇒ <code>function</code>
Decorator that creates an initializer for a provider
 builder

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new provider initializer  

| Param | Type | Description |
| --- | --- | --- |
| providerBuilder | <code>function</code> | An async function to build the service provider |
| [name] | <code>String</code> | The service's name |
| [dependencies] | <code>Array.&lt;String&gt;</code> | The service's dependencies |
| [singleton] | <code>Boolean</code> | Whether the service is a singleton or not |
| [extra] | <code>any</code> | Eventual extra information |

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

## autoProvider(providerBuilder) ⇒ <code>function</code>
Decorator that creates an initializer from a provider
 builder by automatically detecting its name
 and dependencies

**Kind**: global function  
**Returns**: <code>function</code> - Returns a new provider initializer  

| Param | Type | Description |
| --- | --- | --- |
| providerBuilder | <code>function</code> | An async function to build the service provider |

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
<a name="stringifyDependencyDeclaration"></a>

## stringifyDependencyDeclaration(dependencyDeclarationParts) ⇒ <code>String</code>
Stringify a dependency declaration from its parts.

**Kind**: global function  
**Returns**: <code>String</code> - The various parts of it  

| Param | Type | Description |
| --- | --- | --- |
| dependencyDeclarationParts | <code>Object</code> | A dependency declaration string |

**Example**  
```js
stringifyDependencyDeclaration({
  serviceName: 'pgsql',
  mappedName: 'db',
  optional: false,
});

// Returns
'pgsql>db'
```
