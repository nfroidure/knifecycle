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
- generate Mermaid graphs of the dependency tree.

## Usage

Using `knifecycle` is all about declaring the services our
 application needs and running your application over it.

Let's say we are building a web service. First, we need to
 handle a configuration file so we are creating an
 initializer to instanciate our `CONFIG` service:
```js
// services/config.js
import fs from 'fs';
import { initializer } from 'knifecycle';

// We are using the `initializer` decorator to
// declare our service initializer specificities
// Note that the initializer` decorator is pure
// so it just adds static informations and do not
// register the initializer to the provider yet.
export const initConfig = initializer({
  // we have to give our final service a name
  // for further use in other services injections
  name: 'CONFIG',
  // we will need an `ENV` variable in the initializer
  // so adding it in the injected dependencies.
  inject: ['ENV'],
  // our initializer is simple so we use the `service`
  // type for the initializer which just indicate that
  // the initializer will return a promise of the actual
  // service
  type: 'service',
  // We don't want to read the config file everytime we
  // inject it so declaring it as a singleton
  options: { singleton: true },
// Here is the actual initializer implementation, you
// can notice that it expect the `ENV` dependency to
// be set as a property of an object in first argument.
}, ({ ENV }) => {
  return new Promise((resolve, reject) {
    fs.readFile(ENV.CONFIG_PATH, function(err, data) {
      if(err) {
        return reject(err);
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
  }, 'utf-8');
});
```

Our service also uses a database so let's write an
 initializer for it:
 ```js
 // services/db.js
 import { initializer } from 'knifecycle';

const initDB = initializer({
  name: 'db',
  // Here we are injecting the previous `CONFIG` service
  // plus an optional one. If it does not exist then it
  // will silently fail and the service will be undefined.
  inject: ['CONFIG', '?log'],
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
  type: 'provider',,
  options: { singleton: true },
}, ({ CONFIG, log }) {
   return MongoClient.connect(CONFIG.DB_URI)
   .then(function(db) {
     let fatalErrorPromise = new Promise((resolve, reject) {
       db.once('error', reject);
     });

     // Logging only if the `log` service is defined
     log && log('info', 'db service initialized!');

     return {
       service: db,
       dispose: db.close.bind(db, true),
       fatalErrorPromise,
     };
   });
 }
 ```

We need a last initializer for the HTTP server itself:
```js
// services/server.js
import { initializer } from 'knifecycle';
import express from 'express';

const initDB = initializer({
  name: 'server',
  inject: ['ENV', 'CONFIG', '?log'],
  options: { singleton: true },
}, ({ ENV, CONFIG, log }) => {
  const app = express();

  return new Promise((resolve, reject) => {
    const port = ENV.PORT || CONFIG.PORT;
    const server = app.listen(port, () => {
      log && log('info', `server listening on port ${port}!`);
      resolve(server);
    });
  }).then(function(server) {
    let fatalErrorPromise = new Promise((resolve, reject) {
      app.once('error', reject);
      server.once('error', reject);
    });

    function dispose() {
      return new Promise((resolve, reject) => {
        server.close((err) => {
          if(err) {
            reject(err);
            return;
          }
          resolve();
        })
      });
    }

    return {
      service: app,
      dispose,
      fatalErrorPromise,
    };
  });
});
```

Great! We are ready to make it work altogether:
```js
import { getInstance } from 'knifecycle';
import initConfig from 'services/config';
import initDB from 'services/db';
import initServer from 'services/server';

// We need only one Knifecycle instance so using
// a the singleton API
getInstance()
// Registering our initializers
.register(initConfig)
.register(initServer)
.register(initDB)
// Let's say we need to have another `db`
// service pointing to another db server.
.register(
  // First we remap the injected dependencies
  inject(['DB2_CONFIG:CONFIG', '?log'],
    // Then we override its name
    name('db2', initDB)
  )
)
// Finally, we have to create the `DB2_CONFIG` service
// on which the `db2` service now depends on
.register(name('DB2_CONFIG', inject(['CONFIG'], ({ CONFIG }) => {
  // Let's just pick up the `db2` uri in the `CONFIG`
  // service
  return Promise.resolve({
    DB_URI: CONFIG.DB2_URI,
  });
})))
// Add the process environment as a simple constant
.constant('ENV', process.env)
// Add a function providing the current timestamp
.constant('now', Date.now.bind(Date))
// Add a delay function
.constant('delay', Promise.delay.bind(Promise))
// Add process lifetime utils
.constant('waitSignal', function waitSignal(signal) {
  return new Promise((resolve, reject) => {
    process.once(signal, resolve.bind(null, signal));
  });
})
.constant('exit', process.exit.bind(exit))
// Setting a route to serve the current timestamp.
.register(name('timeRoute',
  inject(
    ['server', 'now', '?log'],
    ({ server: app, now, log }) {
      return Promise.resolve()
      .then(() => {
        app.get('/time', (req, res, next) => {
          const curTime = now();

          log && log('info', 'Sending the current time:', curTime);
          res.status(200).send(curTime);
        });
      });
    }
  )
))

// At this point, nothing is running. To instanciate
// services, we have to create an execution silo using
// them. Note that we required the `$destroy` service
// implicitly created by `knifecycle`
.run(['server', 'timeRoute', 'waitSignal', 'exit', '$destroy'])
// Note that despite we injected them, we do not take
// back the `server` and `timeRoute` services. We only
// need them to get up and running but do not need to
// operate on them
.then(({ waitSignal, exit, $destroy }) {
  // We want to exit gracefully when a SIG_TERM/INT
  // signal is received
  Promise.any([
    waitSignal('SIGINT'),
    waitSignal('SIGTERM'),
  ])
  // The `$destroy` service will disable all silos
  // progressively and then the services they rely
  // on to finally resolve the returned promise
  // once done
  .then($destroy)
  .then(() => {
    // graceful shutdown was successful let's exit
    // in peace
    exit(0);
  })
  .catch((err) => {
    console.error('Could not exit gracefully:', err);
    exit(1);
  });

})
.catch((err) => {
  console.error('Could not launch the app:', err);
  process.exit(1);
});
```

## Debugging

Simply use the DEBUG environment variable by setting it to
 'knifecycle':
```sh
DEBUG=knifecycle npm t
```

## Plans

The scope of this library won't change. However the plan is:
- improve performances;
- evolve with Node: I may not need to transpile this library at
 some point.
- track bugs ;).

I'll also share most of my own initializers and their
 stubs/mocks in order to let you reuse it through
 your projects easily.
