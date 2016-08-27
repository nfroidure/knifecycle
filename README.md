# knifecycle
> Manage your NodeJS processes's lifecycle.

[![NPM version](https://img.shields.io/npm/v/knifecycle.svg)](https://www.npmjs.com/package/knifecycle)
[![Build Status](https://travis-ci.org/nfroidure/knifecycle.svg?branch=master)](https://travis-ci.org/nfroidure/knifecycle)
[![Dependency Status](https://david-dm.org/nfroidure/knifecycle.svg)](https://david-dm.org/nfroidure/knifecycle)
[![devDependency Status](https://david-dm.org/nfroidure/knifecycle/dev-status.svg)](https://david-dm.org/nfroidure/knifecycle#info=devDependencies)
[![Coverage Status](https://coveralls.io/repos/nfroidure/knifecycle/badge.svg?branch=master)](https://coveralls.io/r/nfroidure/knifecycle?branch=master)
[![Code Climate](https://codeclimate.com/github/nfroidure/knifecycle/badges/gpa.svg)](https://codeclimate.com/github/nfroidure/knifecycle)
[![Dependency Status](https://dependencyci.com/github/nfroidure/knifecycle/badge)](https://dependencyci.com/github/nfroidure/knifecycle)

Most (maybe all) applications rely on two kinds of dependencies.

**The code dependencies** are fully covered by require/system modules in a
 testable manner (with `mockery` or `System` directly). There is no need for
 another dependency management system if those libraries are pure functions
 (involve no global states at all).

Unfortunately, applications often rely on **global states** where the JavaScript
 module system show its limits. This is where `knifecycle` enters the game.

It is largely inspired from the Angular service system except is should not
 provide code but access to global stuffs (time, filesystem, dbs). It also
 have an important additional feature to shutdown processes which is less
 useful for front-end applications and doesn't exists in Angular.

## Features
- services management: start services taking their dependencies in count and
 shut them down the same way to gracefully exit.
- easy end to end testing: just replace your services per your own mocks and
 stubs.
- isolation: isolate processing in a clean manner, per concerns.
- functional programming ready: encapsulate global states allowing the rest of
 your application to be purely functional.
- no circular dependencies for services: while circular dependencies is not a
 problem within purely functional libraries (require allows it), it may be
 harmful for your services, knifecycle impeach that.

## Usage

First we create a Knifecycle instance:
```js
// services/knifecycle.js
// For this sample application, we know we won't need several lifecycle
// instances so we will use the module singleton instead of injecting the
// lifecycle instance everywhere.
import Knifecycle from 'knifecycle';

const $ = Knifecycle.getInstance();

export default $;
```

Then we create the services our application need. Some of them are simple
 constants:
```js
// services/core.js
// Core services that are often needed. The constant decorator allows you to
// declare values or simple functions managing global states
import { constant } from './knifecycle';
import Winston from 'winston';

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

While others are services that may depend on higher level ones. By example a
 logger.
```js
// services/logger.js
// A log service that depends on the process environment
import { depends, service } from './knifecycle';
import Logger from 'logger';

// Register a service with the service method.
// A service function returns a service promise
service('logger',
  // Declare the service dependencies with the depends decorator
  depends(['ENV'],
    function logService({ ENV }) {
      let logger = new Logger({
        logFile: ENV.LOGFILE,
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
import { depends, provider } from './knifecycle';
import MongoClient from 'mongodb';

// Register a service with the provider method.
// A service provider returns a service descriptor promise exposing:
// - a mandatory service property containing the actual service
// - an optional shutdown function allowing to gracefully close the service
// - an optional error promise to handle the service failure
provider('db',
  // Declare the service dependencies with the depends decorator
  depends(['ENV', 'logger'],
  function dbProvider({ ENV, logger }) {
    return MongoClient.connect(ENV.DB_URI)
    .then(function(db) {
      let fatalErrorPromise = new Promise((resolve, reject) {
        db.once('error', reject);
      });

      logger.log('info', 'db service initialized!');

      return {
        servicePromise: db,
        shutdownProvider: db.close.bind(db, true),
        errorPromise: fatalErrorPromise,
      };
    });
  })
);
```

Adding an express server
```js
// services/server.js
import { depends, constant, provider, service } from './knifecycle';
import express from 'express';

// Create an express app
constant('app', express());

// Setting a route to serve the current timestamp.
service('routes/time',
  depends('app', 'now', 'logger',
  function timeRoutesProvider() {
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
        db.once('error', reject);
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
        servicePromise: Promise.resolve(server),
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

import { run } from './services/knifecycle';
import * from './services/core';
import * from './services/log';
import * from './services/db';
import * from './services/server';

// At this point, nothing is running. To instanciate services, we have to create
// an execution silo using them
// Note that we required the $shutdown service implicitly created by knifecycle
run(['server', 'waitSignal', 'exit', '$shutdown'])
function main({ waitSignal, exit, $shutdown }) {
  // We want to exit gracefully when a SIG_TERM/INT signal is received
  Promise.any([
    waitSignal('SIGINT'),
    waitSignal('SIGTERM'),
  ])
  // The shutdown service will disable silos progressively and then the services
  // they rely on to finaly resolve the returned promise when done
  .then($shutdown)
  .then(() => {
    // graceful shutdown was successful let's exit in peace
    process.exit(0);
  })
  .catch((err) => {
    console.error('Could not exit gracefully:', err);
    process.exit(1);
  });

}
```

## Debugging

Simply use the DEBUG env var by setting it to 'knifecycle':
```sh
DEBUG=knifecycle npm t
```

## Plans

Use this lib for real world applications. I plan to use it with the
 [Trip Story](https://github.com/nfroidure/TripStory) toy project first and use
 it at work then. Maybe for front-end stuffs too.

The scope of this library won't change. However the plan is:
- improve performances
- allow to declare singleton services
- use next JavaScript feature that ships to Node if it make sense:
depends, constant, service, provider may become decorators;
WeakMap may be used to share singleton services between runs
- track bugs

I'll also share most of my own services/providers and their stubs/mocks in order
to let you reuse it through your projects easily.
