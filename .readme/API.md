# API
## Classes

<dl>
<dt><a href="#Knifecycle">Knifecycle</a></dt>
<dd></dd>
</dl>

## Functions

<dl>
<dt><a href="#reuseSpecialProps">reuseSpecialProps(from, to, [amend])</a> ⇒ <code>function</code></dt>
<dd><p>Apply special props to the given function from another one</p>
</dd>
<dt><a href="#inject">inject(dependenciesDeclarations, initializer, [merge])</a> ⇒ <code>function</code></dt>
<dd><p>Decorator creating a new initializer with some
 dependencies declarations appended to it.</p>
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
</dl>

<a name="Knifecycle"></a>

## Knifecycle
**Kind**: global class  

* [Knifecycle](#Knifecycle)
    * [new Knifecycle()](#new_Knifecycle_new)
    * _instance_
        * [.constant(constantName, constantValue)](#Knifecycle+constant) ⇒ [<code>Knifecycle</code>](#Knifecycle)
        * [.service(serviceName, initializer, options)](#Knifecycle+service) ⇒ [<code>Knifecycle</code>](#Knifecycle)
        * [.provider(serviceName, initializer, options)](#Knifecycle+provider) ⇒ [<code>Knifecycle</code>](#Knifecycle)
        * [.toMermaidGraph(options)](#Knifecycle+toMermaidGraph) ⇒ <code>String</code>
        * [.run(dependenciesDeclarations)](#Knifecycle+run) ⇒ <code>Promise</code>
        * [._getServiceDescriptor(siloContext, injectOnly, serviceName, serviceProvider)](#Knifecycle+_getServiceDescriptor) ⇒ <code>Promise</code>
        * [._initializeServiceDescriptor(siloContext, serviceName, serviceProvider)](#Knifecycle+_initializeServiceDescriptor) ⇒ <code>Promise</code>
        * [._initializeDependencies(siloContext, serviceName, servicesDeclarations, injectOnly)](#Knifecycle+_initializeDependencies) ⇒ <code>Promise</code>
    * _static_
        * [.getInstance()](#Knifecycle.getInstance) ⇒ [<code>Knifecycle</code>](#Knifecycle)

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

### knifecycle.constant(constantName, constantValue) ⇒ [<code>Knifecycle</code>](#Knifecycle)
Register a constant service

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

### knifecycle.service(serviceName, initializer, options) ⇒ [<code>Knifecycle</code>](#Knifecycle)
Register a service initializer

**Kind**: instance method of [<code>Knifecycle</code>](#Knifecycle)  
**Returns**: [<code>Knifecycle</code>](#Knifecycle) - The Knifecycle instance (for chaining)  

| Param | Type | Description |
| --- | --- | --- |
| serviceName | <code>String</code> | Service name |
| initializer | <code>function</code> | An initializer returning the service promise |
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

### knifecycle.provider(serviceName, initializer, options) ⇒ [<code>Knifecycle</code>](#Knifecycle)
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

$.provider('config', function configProvider() {
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
});
```
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
import { Knifecycle, inject } from 'knifecycle';
import appInitializer from './app';

const $ = new Knifecycle();

$.constant('ENV', process.env);
$.constant('OS', require('os'));
$.service('app', inject(['ENV', 'OS'], appInitializer));
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

$.constant('ENV', process.env);
$.run(['ENV'])
.then(({ ENV }) => {
 // Here goes your code
})
```
<a name="Knifecycle+_getServiceDescriptor"></a>

### knifecycle._getServiceDescriptor(siloContext, injectOnly, serviceName, serviceProvider) ⇒ <code>Promise</code>
Initialize or return a service descriptor

**Kind**: instance method of [<code>Knifecycle</code>](#Knifecycle)  
**Returns**: <code>Promise</code> - Service dependencies hash promise.  

| Param | Type | Description |
| --- | --- | --- |
| siloContext | <code>Object</code> | Current execution silo context |
| injectOnly | <code>Boolean</code> | Flag indicating if existing services only should be used |
| serviceName | <code>String</code> | Service name. |
| serviceProvider | <code>String</code> | Service provider. |

<a name="Knifecycle+_initializeServiceDescriptor"></a>

### knifecycle._initializeServiceDescriptor(siloContext, serviceName, serviceProvider) ⇒ <code>Promise</code>
Initialize a service

**Kind**: instance method of [<code>Knifecycle</code>](#Knifecycle)  
**Returns**: <code>Promise</code> - Service dependencies hash promise.  

| Param | Type | Description |
| --- | --- | --- |
| siloContext | <code>Object</code> | Current execution silo context |
| serviceName | <code>String</code> | Service name. |
| serviceProvider | <code>String</code> | Service provider. |

<a name="Knifecycle+_initializeDependencies"></a>

### knifecycle._initializeDependencies(siloContext, serviceName, servicesDeclarations, injectOnly) ⇒ <code>Promise</code>
Initialize a service dependencies

**Kind**: instance method of [<code>Knifecycle</code>](#Knifecycle)  
**Returns**: <code>Promise</code> - Service dependencies hash promise.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| siloContext | <code>Object</code> |  | Current execution silo siloContext |
| serviceName | <code>String</code> |  | Service name. |
| servicesDeclarations | <code>String</code> |  | Dependencies declarations. |
| injectOnly | <code>Boolean</code> | <code>false</code> | Flag indicating if existing services only should be used |

<a name="Knifecycle.getInstance"></a>

### Knifecycle.getInstance() ⇒ [<code>Knifecycle</code>](#Knifecycle)
Returns a Knifecycle instance (always the same)

**Kind**: static method of [<code>Knifecycle</code>](#Knifecycle)  
**Returns**: [<code>Knifecycle</code>](#Knifecycle) - The created/saved instance  
**Example**  
```js
import { getInstance } from 'knifecycle'

const $ = getInstance();
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
