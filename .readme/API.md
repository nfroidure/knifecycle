# API
## Functions

<dl>
<dt><a href="#getInstance">getInstance()</a> ⇒ <code>Knifecycle</code></dt>
<dd><p>Returns a Knifecycle instance (always the same)</p>
</dd>
<dt><a href="#constant">constant(constantName, constantValue)</a> ⇒ <code>function</code></dt>
<dd><p>Register a constant service</p>
</dd>
<dt><a href="#service">service(serviceName, service)</a> ⇒ <code>function</code></dt>
<dd><p>Register a service</p>
</dd>
<dt><a href="#provider">provider(serviceName, serviceProvider)</a> ⇒ <code>Promise</code></dt>
<dd><p>Register a service provider</p>
</dd>
<dt><a href="#depends">depends(dependenciesDeclarations, serviceProvider)</a> ⇒ <code>function</code></dt>
<dd><p>Decorator to claim that a service depends on others ones.</p>
</dd>
<dt><a href="#toMermaidGraph">toMermaidGraph(options)</a> ⇒ <code>String</code></dt>
<dd><p>Outputs a Mermaid compatible dependency graph of the declared services.
See <a href="https://github.com/knsv/mermaid">Mermaid docs</a></p>
</dd>
<dt><a href="#run">run(dependenciesDeclarations)</a> ⇒ <code>Promise</code></dt>
<dd><p>Creates a new execution silo</p>
</dd>
<dt><a href="#_getServiceDescriptor">_getServiceDescriptor(siloContext, injectOnly, serviceName, serviceProvider)</a> ⇒ <code>Promise</code></dt>
<dd><p>Initialize or return a service descriptor</p>
</dd>
<dt><a href="#_initializeServiceDescriptor">_initializeServiceDescriptor(siloContext, serviceName, serviceProvider)</a> ⇒ <code>Promise</code></dt>
<dd><p>Initialize a service</p>
</dd>
<dt><a href="#_initializeDependencies">_initializeDependencies(siloContext, serviceName, servicesDeclarations, injectOnly)</a> ⇒ <code>Promise</code></dt>
<dd><p>Initialize a service dependencies</p>
</dd>
</dl>

<a name="getInstance"></a>

## getInstance() ⇒ <code>Knifecycle</code>
Returns a Knifecycle instance (always the same)

**Kind**: global function  
**Returns**: <code>Knifecycle</code> - The created/saved instance  
**Example**  
```js
import Knifecycle from 'knifecycle'

const $ = Knifecycle.getInstance();
```
<a name="constant"></a>

## constant(constantName, constantValue) ⇒ <code>function</code>
Register a constant service

**Kind**: global function  
**Returns**: <code>function</code> - The created service provider  

| Param | Type | Description |
| --- | --- | --- |
| constantName | <code>String</code> | The name of the service |
| constantValue | <code>any</code> | The constant value |

**Example**  
```js
import Knifecycle from 'knifecycle'

const $ = new Knifecycle();

$.constant('ENV', process.env); // Expose the process env
$.constant('time', Date.now.bind(Date)); // Expose a time() function
```
<a name="service"></a>

## service(serviceName, service) ⇒ <code>function</code>
Register a service

**Kind**: global function  
**Returns**: <code>function</code> - The created service provider  

| Param | Type | Description |
| --- | --- | --- |
| serviceName | <code>String</code> | Service name |
| service | <code>function</code> \| <code>Promise</code> | The service promise or a function returning it |

**Example**  
```js
import Knifecycle from 'knifecycle'
import fs from 'fs';

const $ = new Knifecycle();

$.service('config', function config() {
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
```
<a name="provider"></a>

## provider(serviceName, serviceProvider) ⇒ <code>Promise</code>
Register a service provider

**Kind**: global function  
**Returns**: <code>Promise</code> - The actual service descriptor promise  

| Param | Type | Description |
| --- | --- | --- |
| serviceName | <code>String</code> | Service name |
| serviceProvider | <code>function</code> | Service provider or a service provider promise |

**Example**  
```js
import Knifecycle from 'knifecycle'
import fs from 'fs';

const $ = new Knifecycle();

$.provider('config', function configProvider() {
  return Promise.resolve({
    servicePromise: new Promise((resolve, reject) {
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
});
```
<a name="depends"></a>

## depends(dependenciesDeclarations, serviceProvider) ⇒ <code>function</code>
Decorator to claim that a service depends on others ones.

**Kind**: global function  
**Returns**: <code>function</code> - Returns the decorator function  

| Param | Type | Description |
| --- | --- | --- |
| dependenciesDeclarations | <code>Array.&lt;String&gt;</code> | Dependencies the decorated service provider depends on. |
| serviceProvider | <code>function</code> | Service provider or a service provider promise |

**Example**  
```js
import Knifecycle from 'knifecycle'
import fs from 'fs';

const $ = new Knifecycle();

$.service('config', $.depends(['ENV'], function configProvider({ ENV }) {
  return new Promise((resolve, reject) {
    fs.readFile(ENV.CONFIG_FILE, function(err, data) {
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
<a name="toMermaidGraph"></a>

## toMermaidGraph(options) ⇒ <code>String</code>
Outputs a Mermaid compatible dependency graph of the declared services.
See [Mermaid docs](https://github.com/knsv/mermaid)

**Kind**: global function  
**Returns**: <code>String</code> - Returns a string containing the Mermaid dependency graph  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Options for generating the graph (destructured) |
| options.shapes | <code>Array.&lt;Object&gt;</code> | Various shapes to apply |
| options.styles | <code>Array.&lt;Object&gt;</code> | Various styles to apply |
| options.classes | <code>Object</code> | A hash of various classes contents |

**Example**  
```js
import Knifecycle from 'knifecycle'

const $ = new Knifecycle();

$.constant('ENV', process.env);
$.constant('OS', require('os'));
$.service('app', $.depends(['ENV', 'OS'], () => Promise.resolve()));
$.toMermaidGraph();

// returns
graph TD
  app-->ENV
  app-->OS
```
<a name="run"></a>

## run(dependenciesDeclarations) ⇒ <code>Promise</code>
Creates a new execution silo

**Kind**: global function  
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
<a name="_getServiceDescriptor"></a>

## _getServiceDescriptor(siloContext, injectOnly, serviceName, serviceProvider) ⇒ <code>Promise</code>
Initialize or return a service descriptor

**Kind**: global function  
**Returns**: <code>Promise</code> - Service dependencies hash promise.  

| Param | Type | Description |
| --- | --- | --- |
| siloContext | <code>Object</code> | Current execution silo context |
| injectOnly | <code>Boolean</code> | Flag indicating if existing services only should be used |
| serviceName | <code>String</code> | Service name. |
| serviceProvider | <code>String</code> | Service provider. |

<a name="_initializeServiceDescriptor"></a>

## _initializeServiceDescriptor(siloContext, serviceName, serviceProvider) ⇒ <code>Promise</code>
Initialize a service

**Kind**: global function  
**Returns**: <code>Promise</code> - Service dependencies hash promise.  

| Param | Type | Description |
| --- | --- | --- |
| siloContext | <code>Object</code> | Current execution silo context |
| serviceName | <code>String</code> | Service name. |
| serviceProvider | <code>String</code> | Service provider. |

<a name="_initializeDependencies"></a>

## _initializeDependencies(siloContext, serviceName, servicesDeclarations, injectOnly) ⇒ <code>Promise</code>
Initialize a service dependencies

**Kind**: global function  
**Returns**: <code>Promise</code> - Service dependencies hash promise.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| siloContext | <code>Object</code> |  | Current execution silo siloContext |
| serviceName | <code>String</code> |  | Service name. |
| servicesDeclarations | <code>String</code> |  | Dependencies names. |
| injectOnly | <code>Boolean</code> | <code>false</code> | Flag indicating if existing services only should be used |

