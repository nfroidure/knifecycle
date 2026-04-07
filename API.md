# API
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
<dt><a href="#parseDependencyDeclaration">parseDependencyDeclaration(dependencyDeclaration)</a> ⇒ <code>Object</code></dt>
<dd><p>Explode a dependency declaration an returns its parts.</p>
</dd>
<dt><a href="#stringifyDependencyDeclaration">stringifyDependencyDeclaration(dependencyDeclarationParts)</a> ⇒ <code>String</code></dt>
<dd><p>Stringify a dependency declaration from its parts.</p>
</dd>
</dl>

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
