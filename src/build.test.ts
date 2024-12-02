/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from '@jest/globals';
import { YError } from 'yerror';
import initInitializerBuilder from './build.js';
import { Knifecycle, initializer, constant } from './index.js';

describe('buildInitializer', () => {
  async function aProvider() {
    return {
      service: 'PROVIDER_SERVICE',
    };
  }
  const mockedDepsHash = {
    $fatalError: constant('$fatalError', undefined),
    $dispose: constant('$dispose', undefined),
    $instance: constant('$instance', undefined),
    $siloContext: constant('$siloContext', undefined),
    NODE_ENV: constant('NODE_ENV', 'development'),
    dep1: initializer(
      {
        inject: [],
        type: 'service',
        name: 'dep1',
      },
      aProvider,
    ),
    dep2: initializer(
      {
        inject: ['dep1', 'NODE_ENV'],
        type: 'provider',
        name: 'dep2',
      },
      aProvider,
    ),
    dep3: initializer(
      {
        inject: ['dep5', 'dep2', 'dep1', '?depOpt'],
        type: 'service',
        name: 'dep3',
      },
      aProvider,
    ),
    dep4: initializer(
      {
        inject: ['dep5', 'dep2', 'dep1', '?depOpt'],
        type: 'service',
        name: 'dep4',
      },
      aProvider,
    ),
    dep5: initializer(
      {
        inject: ['$ready'],
        type: 'service',
        name: 'dep5',
      },
      aProvider,
    ),
    dep6: initializer(
      {
        inject: [],
        type: 'service',
        name: 'dep6',
      },
      aProvider,
    ),
  };
  const initAutoloader = initializer(
    {
      name: '$autoload',
      type: 'service',
      inject: [],
      singleton: true,
    },
    async () => {
      return async function $autoload(name) {
        return mockedDepsHash[name]
          ? Promise.resolve({
              path: `./services/${name}`,
              initializer: mockedDepsHash[name],
            })
          : Promise.reject(new YError('E_UNMATCHED_DEPENDENCY', name));
      };
    },
  );

  test('should build an initialization module', async () => {
    const $ = new Knifecycle();

    $.register(constant('PWD', '~/my-project'));
    $.register(initAutoloader);
    $.register(initInitializerBuilder);

    const { buildInitializer } = await $.run<any>(['buildInitializer']);

    const content = await buildInitializer(['dep1', 'finalMappedDep>dep3']);

    expect(content).toMatchInlineSnapshot(`
"
// Automatically generated by \`knifecycle\`
import { initFatalError } from 'knifecycle';

const batchsDisposers = [];

async function $dispose() {
  for(const batchDisposers of batchsDisposers.reverse()) {
    await Promise.all(
      batchDisposers
        .map(batchDisposer => batchDisposer())
    );
  }
}

let resolveReady;
const $ready = new Promise((resolve) => {
  resolveReady = resolve;
});
const $instance = {
  destroy: $dispose,
};


// Definition batch #0
import initDep1 from './services/dep1';
const NODE_ENV = "development";

// Definition batch #1
import initDep5 from './services/dep5';
import initDep2 from './services/dep2';

// Definition batch #2
import initDep3 from './services/dep3';

export async function initialize(services = {}) {
  const $fatalError = await initFatalError();

  // Initialization batch #0
  batchsDisposers[0] = [];
  const batch0 = {
    dep1: initDep1({
    }),
    $ready: Promise.resolve($ready),
    NODE_ENV: Promise.resolve(NODE_ENV),
  };

  await Promise.all(
    Object.keys(batch0)
    .map(key => batch0[key])
  );

  services['dep1'] = await batch0['dep1'];
  services['$ready'] = await batch0['$ready'];
  services['NODE_ENV'] = await batch0['NODE_ENV'];

  // Initialization batch #1
  batchsDisposers[1] = [];
  const batch1 = {
    dep5: initDep5({
      $ready: services['$ready'],
    }),
    dep2: initDep2({
      dep1: services['dep1'],
      NODE_ENV: services['NODE_ENV'],
    }).then(provider => {
      if(provider.dispose) {
        batchsDisposers[1].push(provider.dispose);
      }
      if(provider.fatalErrorPromise) {
        $fatalError.registerErrorPromise(provider.fatalErrorPromise);
      }
      return provider.service;
    }),
  };

  await Promise.all(
    Object.keys(batch1)
    .map(key => batch1[key])
  );

  services['dep5'] = await batch1['dep5'];
  services['dep2'] = await batch1['dep2'];

  // Initialization batch #2
  batchsDisposers[2] = [];
  const batch2 = {
    dep3: initDep3({
      dep5: services['dep5'],
      dep2: services['dep2'],
      dep1: services['dep1'],
      depOpt: services['depOpt'],
    }),
  };

  await Promise.all(
    Object.keys(batch2)
    .map(key => batch2[key])
  );

  services['dep3'] = await batch2['dep3'];


  resolveReady();

  return {
    dep1: services['dep1'],
    finalMappedDep: services['dep3'],
  };
}
"
`);
  });

  test('should build an initialization module even with overrides', async () => {
    const $ = new Knifecycle();

    $.register(
      constant('$overrides', {
        dep3: 'dep4',
        dep4: {
          dep5: 'dep6',
        },
      }),
    );
    $.register(constant('PWD', '~/my-project'));
    $.register(initAutoloader);
    $.register(initInitializerBuilder);

    const { buildInitializer } = await $.run<any>(['buildInitializer']);

    const content = await buildInitializer(['dep1', 'finalMappedDep>dep3']);

    expect(content).toMatchInlineSnapshot(`
"
// Automatically generated by \`knifecycle\`
import { initFatalError } from 'knifecycle';

const batchsDisposers = [];

async function $dispose() {
  for(const batchDisposers of batchsDisposers.reverse()) {
    await Promise.all(
      batchDisposers
        .map(batchDisposer => batchDisposer())
    );
  }
}

let resolveReady;
const $ready = new Promise((resolve) => {
  resolveReady = resolve;
});
const $instance = {
  destroy: $dispose,
};


// Definition batch #0
import initDep1 from './services/dep1';
import initDep6 from './services/dep6';
const NODE_ENV = "development";

// Definition batch #1
import initDep2 from './services/dep2';

// Definition batch #2
import initDep4 from './services/dep4';

export async function initialize(services = {}) {
  const $fatalError = await initFatalError();

  // Initialization batch #0
  batchsDisposers[0] = [];
  const batch0 = {
    dep1: initDep1({
    }),
    dep6: initDep6({
    }),
    NODE_ENV: Promise.resolve(NODE_ENV),
  };

  await Promise.all(
    Object.keys(batch0)
    .map(key => batch0[key])
  );

  services['dep1'] = await batch0['dep1'];
  services['dep6'] = await batch0['dep6'];
  services['NODE_ENV'] = await batch0['NODE_ENV'];

  // Initialization batch #1
  batchsDisposers[1] = [];
  const batch1 = {
    dep2: initDep2({
      dep1: services['dep1'],
      NODE_ENV: services['NODE_ENV'],
    }).then(provider => {
      if(provider.dispose) {
        batchsDisposers[1].push(provider.dispose);
      }
      if(provider.fatalErrorPromise) {
        $fatalError.registerErrorPromise(provider.fatalErrorPromise);
      }
      return provider.service;
    }),
  };

  await Promise.all(
    Object.keys(batch1)
    .map(key => batch1[key])
  );

  services['dep2'] = await batch1['dep2'];

  // Initialization batch #2
  batchsDisposers[2] = [];
  const batch2 = {
    dep4: initDep4({
      dep5: services['dep6'],
      dep2: services['dep2'],
      dep1: services['dep1'],
      depOpt: services['depOpt'],
    }),
  };

  await Promise.all(
    Object.keys(batch2)
    .map(key => batch2[key])
  );

  services['dep4'] = await batch2['dep4'];


  resolveReady();

  return {
    dep1: services['dep1'],
    finalMappedDep: services['dep4'],
  };
}
"
`);
  });

  test('should work with simple internal services dependencies', async () => {
    const $ = new Knifecycle();

    $.register(constant('PWD', '~/my-project'));
    $.register(initAutoloader);
    $.register(initInitializerBuilder);

    const { buildInitializer } = await $.run<any>(['buildInitializer']);

    const content = await buildInitializer([
      'dep1',
      'finalMappedDep>dep3',
      '$fatalError',
      '$dispose',
      '$instance',
      '$siloContext',
    ]);
    expect(content).toMatchInlineSnapshot(`
"
// Automatically generated by \`knifecycle\`
import { initFatalError } from 'knifecycle';

const batchsDisposers = [];

async function $dispose() {
  for(const batchDisposers of batchsDisposers.reverse()) {
    await Promise.all(
      batchDisposers
        .map(batchDisposer => batchDisposer())
    );
  }
}

let resolveReady;
const $ready = new Promise((resolve) => {
  resolveReady = resolve;
});
const $instance = {
  destroy: $dispose,
};


// Definition batch #0
import initDep1 from './services/dep1';
const NODE_ENV = "development";
const $siloContext = undefined;

// Definition batch #1
import initDep5 from './services/dep5';
import initDep2 from './services/dep2';

// Definition batch #2
import initDep3 from './services/dep3';

export async function initialize(services = {}) {
  const $fatalError = await initFatalError();

  // Initialization batch #0
  batchsDisposers[0] = [];
  const batch0 = {
    dep1: initDep1({
    }),
    $ready: Promise.resolve($ready),
    NODE_ENV: Promise.resolve(NODE_ENV),
    $fatalError: Promise.resolve($fatalError),
    $dispose: Promise.resolve($dispose),
    $instance: Promise.resolve($instance),
    $siloContext: Promise.resolve($siloContext),
  };

  await Promise.all(
    Object.keys(batch0)
    .map(key => batch0[key])
  );

  services['dep1'] = await batch0['dep1'];
  services['$ready'] = await batch0['$ready'];
  services['NODE_ENV'] = await batch0['NODE_ENV'];
  services['$fatalError'] = await batch0['$fatalError'];
  services['$dispose'] = await batch0['$dispose'];
  services['$instance'] = await batch0['$instance'];
  services['$siloContext'] = await batch0['$siloContext'];

  // Initialization batch #1
  batchsDisposers[1] = [];
  const batch1 = {
    dep5: initDep5({
      $ready: services['$ready'],
    }),
    dep2: initDep2({
      dep1: services['dep1'],
      NODE_ENV: services['NODE_ENV'],
    }).then(provider => {
      if(provider.dispose) {
        batchsDisposers[1].push(provider.dispose);
      }
      if(provider.fatalErrorPromise) {
        $fatalError.registerErrorPromise(provider.fatalErrorPromise);
      }
      return provider.service;
    }),
  };

  await Promise.all(
    Object.keys(batch1)
    .map(key => batch1[key])
  );

  services['dep5'] = await batch1['dep5'];
  services['dep2'] = await batch1['dep2'];

  // Initialization batch #2
  batchsDisposers[2] = [];
  const batch2 = {
    dep3: initDep3({
      dep5: services['dep5'],
      dep2: services['dep2'],
      dep1: services['dep1'],
      depOpt: services['depOpt'],
    }),
  };

  await Promise.all(
    Object.keys(batch2)
    .map(key => batch2[key])
  );

  services['dep3'] = await batch2['dep3'];


  resolveReady();

  return {
    dep1: services['dep1'],
    finalMappedDep: services['dep3'],
    $fatalError: services['$fatalError'],
    $dispose: services['$dispose'],
    $instance: services['$instance'],
    $siloContext: services['$siloContext'],
  };
}
"
`);
  });
});
