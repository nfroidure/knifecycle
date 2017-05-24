
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

Using Knifecycle is all about declaring the services our
 application needs. Some of them are simple constants:
```js
// services/core.js
// Core services that are often needed. The constant decorator allows you to
// declare values or simple functions managing global states

// Notice we are directly using the instance module that prepare the Knifecycle
// instance for us
import { constant } from 'knifecycle/instance';

// Add the process environment as a simple constant
constant('ENV', process.env);

// Add a function providing the current timestamp
constant('now', Date.now.bind(Date));

// Add a delay function
constant('delay', Promise.delay.bind(Promise));

// Add process lifetime utils
constant('waitSignal', function waitSignal(signal) {
  return new Promise((resolve, reject) => {
    process.once(signal, resolve.bind(null, signal));
  });
});
constant('exit', process.exit.bind(exit));
```

While others are services that are asynchronously built
 or may depends on other services. By example a logger.
```js
// services/logger.js
// A log service that depends on the process environment
import { depends } from 'knifecycle';
import { service } from 'knifecycle/instance';
import Logger from 'logger';

// Register a service with the service method.
// A service function returns a service promise
service('logger',
  // Declare the service dependencies with the depends
  // decorator. Note that the LOGGER_CONFIG dependency
  // is optional
  depends(['?LOGGER_CONFIG', 'ENV'],
    function logService({ LOGGER_CONFIG, ENV }) {
      let logger = new Logger({
        logFile: LOGGER_CONFIG && LOGGER_CONFIG.LOGFILE ?
          LOGGER_CONFIG.LOGFILE :
          ENV.LOGFILE : ,
      });

      logger.log('info', 'Log service initialized!');

      return Promise.resolve(logger);
    }
  )
);
```

Let's add a db service too:
```js
// services/db.js
import { depends } from 'knifecycle';
import { provider, constant } from 'knifecycle/instance';
import MongoClient from 'mongodb';

constant('DB_CONFIG', { uri: 'mongo:xxxxx' });

// Register a service with the provider method.
provider('db',
  // Declare the service dependencies with the depends decorator
  depends(['DB_CONFIG', 'logger'],
    dbProvider
  )
);

// A service provider returns a promise of a service descriptor
// exposing:
// - a mandatory service property containing the actual service
// - an optional shutdown function allowing to gracefully close the service
// - an optional error promise to handle the service unrecoverable
//   failure
function dbProvider({ DB_CONFIG, logger }) {
  return MongoClient.connect(DB_CONFIG.uri)
  .then(function(db) {
    let fatalErrorPromise = new Promise((resolve, reject) {
      db.once('error', reject);
    });

    logger.log('info', 'db service initialized!');

    return {
      service: db,
      shutdownProvider: db.close.bind(db, true),
      errorPromise: fatalErrorPromise,
    };
  });
}

// What if we need 2 mongodb clients?
// Just use service mapping!
constant('DB_CONFIG2', { uri: 'mongo:xxxxx' });
provider('db2',
  // You can wire a dependency with an different name
  // than the one expected by your service provider with
  // the mapping feature
  depends(['DB_CONFIG2:DB_CONFIG', 'logger'],
  dbProvider
);

```

Adding an Express server
```js
// services/server.js
import { depends } from 'knifecycle';
import { constant, provider, service } from 'knifecycle/instance';
import express from 'express';

// Create an express app
constant('app', express());

// Setting a route to serve the current timestamp.
service('routes/time',
  depends('app', 'now', 'logger',
  function timeRoutesService({ app, now, logger }) {
    return Promise.resolve()
    .then(() => {
      app.get('/time', (req, res, next) => {
        const curTime = now();

        logger.log('info', 'Sending the current time:', curTime);
        res.status(200).send(curTime);
      });
    });
  })
);

// Add an HTTP server service
provider('server',
  depends(['app', 'routes/time', 'logger', 'ENV'],
  function serverProvider({ app, logger, ENV }) {
    return new Promise((resolve, reject) => {
      app.listen(ENV.PORT, (server) => {
        logger.log('info', 'server listening on port ' + ENV.PORT + '!');
        resolve(server);
      });
    }).then(function(server) {
      let fatalErrorPromise = new Promise((resolve, reject) {
        app.once('error', reject);
      });

      function shutdownServer() {
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
        service: server,
        shutdownProvider: shutdownServer,
        errorPromise: fatalErrorPromise,
      };
    });
  })
);
```

Let's wire it altogether to bootstrap an express application:
```js
// app.js

import { run } from 'knifecycle/instance';
import * from './services/core';
import * from './services/log';
import * from './services/db';
import * from './services/server';

// At this point, nothing is running. To instanciate services, we have to create
// an execution silo using them
// Note that we required the $dispose service implicitly created by knifecycle
run(['server', 'waitSignal', 'exit', '$dispose'])
function main({ waitSignal, exit, $dispose }) {
  // We want to exit gracefully when a SIG_TERM/INT signal is received
  Promise.any([
    waitSignal('SIGINT'),
    waitSignal('SIGTERM'),
  ])
  // The shutdown service will disable silos progressively and then the services
  // they rely on to finally resolve the returned promise once done
  .then($dispose)
  .then(() => {
    // graceful shutdown was successful let's exit in peace
    exit(0);
  })
  .catch((err) => {
    console.error('Could not exit gracefully:', err);
    exit(1);
  });

}
```

## Debugging

Simply use the DEBUG environment variable by setting it to
 'knifecycle':
```sh
DEBUG=knifecycle npm t
```

## Plans

The scope of this library won't change. However the plan is:
- improve performances
- evolve with Node. I may not need to transpile this library at
 some point.
- `depends`, `constant`, `service`, `provider` may become decorators;
- track bugs ;).

I'll also share most of my own services/providers and their stubs/mocks in order
to let you reuse it through your projects easily.
