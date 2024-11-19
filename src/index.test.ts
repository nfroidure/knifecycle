/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint max-nested-callbacks:0 */
import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { YError } from 'yerror';

import {
  SPECIAL_PROPS,
  Knifecycle,
  initializer,
  inject,
  constant,
  service,
  provider,
  singleton,
} from './index.js';
import type { Provider, FatalErrorService } from './index.js';
import { ALLOWED_INITIALIZER_TYPES } from './util.js';

describe('Knifecycle', () => {
  let $: Knifecycle;
  const ENV = {
    MY_ENV_VAR: 'plop',
  };
  const time = Date.now.bind(Date);

  async function timeService() {
    return time;
  }

  async function hashProvider(hash: Record<string, unknown>) {
    return {
      service: hash,
    };
  }

  const nullService = service<{ time: any }, null>(
    async function nullService({ time }: { time: any }): Promise<null> {
      // service run for its side effect only
      time();
      return null;
    },
    'nullService',
    ['time'],
  );
  const undefinedService = service<{ time: any }, undefined>(
    async function undefinedService({
      time,
    }: {
      time: any;
    }): Promise<undefined> {
      // service run for its side effect only
      time();
      return undefined;
    },
    'undefinedService',
    ['time'],
  );
  const nullProvider = provider<{ time: any }, null>(
    async function nullProvider({
      time,
    }: {
      time: any;
    }): Promise<Provider<null>> {
      // provider run for its side effect only
      time();
      return { service: null };
    },
    'nullProvider',
    ['time'],
  );
  const undefinedProvider = provider<{ time: any }, undefined>(
    async function undefinedProvider({
      time,
    }: {
      time: any;
    }): Promise<Provider<undefined>> {
      // service run for its side effect only
      time();
      return { service: undefined };
    },
    'undefinedProvider',
    ['time'],
  );

  beforeEach(() => {
    $ = new Knifecycle();
  });

  describe('register', () => {
    describe('with constants', () => {
      test('should work with an object', () => {
        $.register(constant('ENV', ENV));
      });

      test('should work with a function', () => {
        $.register(constant('time', time));
      });

      test('should work when overriding a previously set constant', async () => {
        $.register(constant('TEST', 1));
        $.register(constant('TEST', 2));
        expect(await $.run<any>(['TEST'])).toEqual({
          TEST: 2,
        });
      });

      test('should fail when overriding an initialized constant', async () => {
        $.register(constant('TEST', 1));
        expect(await $.run<any>(['TEST'])).toEqual({
          TEST: 1,
        });

        try {
          $.register(constant('TEST', 2));
          throw new YError('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual(
            'E_INITIALIZER_ALREADY_INSTANCIATED',
          );
        }
      });

      test('should fail when overriding a reserved service', async () => {
        try {
          $.register(constant('$dispose', 2));
          throw new YError('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual('E_IMMUTABLE_SERVICE_NAME');
        }
      });

      test('should fail when overriding a constant service with anything else', async () => {
        try {
          $.register(service(timeService, '$overrides'));
          throw new YError('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual('E_CONSTANT_SERVICE_NAME');
        }
      });
    });

    describe('with services', () => {
      test('should  work with a service', () => {
        $.register(service(timeService, 'time'));
      });

      test('should work when overriding a previously set service', async () => {
        $.register(service(async () => () => 1, 'test'));
        $.register(service(async () => () => 2, 'test'));

        const { test } = await $.run<any>(['test']);
        expect(test()).toEqual(2);
      });

      test('should fail when overriding an initialized service', async () => {
        $.register(service(async () => () => 1, 'test'));
        const { test } = await $.run<any>(['test']);
        expect(test()).toEqual(1);

        try {
          $.register(service(async () => () => 2, 'test'));
          throw new YError('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual(
            'E_INITIALIZER_ALREADY_INSTANCIATED',
          );
        }
      });

      test('should work with services names overrides', async () => {
        $.register(
          service(
            async ({ test2 }) =>
              () =>
                test2(),
            'test',
            ['test2'],
          ),
        );
        $.register(service(async () => () => 2, 'test2'));
        $.register(service(async () => () => 3, 'test3'));
        $.register(constant('$overrides', { test2: 'test3' }));

        const { test } = await $.run<any>(['test']);

        expect(test()).toEqual(3);
      });

      test('should work with complex services names overrides', async () => {
        $.register(
          service(
            async ({ log }) =>
              () =>
                log('from debugLog'),
            'debugLog',
            ['log'],
          ),
        );
        $.register(service(async () => (str) => 'log ' + str, 'log'));
        $.register(
          constant('$overrides', {
            log: 'debugLog',
            debugLog: {
              log: 'log',
            },
          }),
        );

        const { log } = await $.run<any>(['log']);

        expect(log()).toEqual('log from debugLog');
      });
    });

    describe('with providers', () => {
      test('should  work with a provider', () => {
        $.register(service(hashProvider, 'hash'));
      });

      test('should work when overriding a previously set provider', async () => {
        $.register(
          initializer(
            {
              type: 'provider',
              name: 'test',
              inject: [],
            },
            async () => ({
              service: 1,
            }),
          ),
        );
        $.register(
          initializer(
            {
              type: 'provider',
              name: 'test',
              inject: [],
            },
            async () => ({
              service: 2,
            }),
          ),
        );

        const { test } = await $.run<any>(['test']);
        expect(test).toEqual(2);
      });

      test('should work when overriding a previously set singleton provider', async () => {
        $.register(
          initializer(
            {
              type: 'provider',
              name: 'test',
              inject: [],
              singleton: true,
            },
            async () => ({
              service: 1,
            }),
          ),
        );
        $.register(
          initializer(
            {
              type: 'provider',
              name: 'test',
              inject: [],
            },
            async () => ({
              service: 2,
            }),
          ),
        );

        const { test } = await $.run<any>(['test']);
        expect(test).toEqual(2);
      });

      test('should fail when overriding an initialized provider', async () => {
        $.register(
          initializer(
            {
              type: 'provider',
              name: 'test',
              inject: [],
              singleton: true,
            },
            async () => ({
              service: 1,
            }),
          ),
        );

        const { test } = await $.run<any>(['test']);
        expect(test).toEqual(1);

        try {
          $.register(
            initializer(
              {
                type: 'provider',
                name: 'test',
                inject: [],
              },
              async () => ({
                service: 2,
              }),
            ),
          );
          throw new YError('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual(
            'E_INITIALIZER_ALREADY_INSTANCIATED',
          );
        }
      });

      test('should work with provider names overrides', async () => {
        $.register(
          initializer(
            {
              type: 'provider',
              name: 'test',
              inject: ['test2'],
            },
            async ({ test2 }) => ({
              service: test2,
            }),
          ),
        );
        $.register(
          initializer(
            {
              type: 'provider',
              name: 'test2',
              inject: [],
            },
            async () => ({
              service: 2,
            }),
          ),
        );
        $.register(
          initializer(
            {
              type: 'provider',
              name: 'test3',
              inject: [],
            },
            async () => ({
              service: 3,
            }),
          ),
        );
        $.register(constant('$overrides', { test2: 'test3' }));

        const { test } = await $.run<any>(['test']);

        expect(test).toEqual(3);
      });
    });

    test('should fail when initializer is no a function', () => {
      try {
        $.register('not_a_function' as any);

        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect((err as YError).code).toEqual('E_BAD_INITIALIZER');
        expect((err as YError).params).toEqual(['not_a_function']);
      }
    });

    test('should fail with no service name', () => {
      try {
        $.register(async () => undefined);

        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect((err as YError).code).toEqual('E_ANONYMOUS_ANALYZER');
        expect((err as YError).params).toEqual([]);
      }
    });

    test('should fail with a bad service type', () => {
      try {
        const fn = async () => undefined;
        fn[SPECIAL_PROPS.NAME] = 'test';
        fn[SPECIAL_PROPS.TYPE] = 'not_allowed_type';
        $.register(fn);

        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect((err as YError).code).toEqual('E_BAD_INITIALIZER_TYPE');
        expect((err as YError).params).toEqual([
          'test',
          'not_allowed_type',
          ALLOWED_INITIALIZER_TYPES,
        ]);
      }
    });

    test('should fail with an undefined constant', () => {
      try {
        const fn = async () => undefined;
        fn[SPECIAL_PROPS.NAME] = 'THE_NUMBER';
        fn[SPECIAL_PROPS.TYPE] = 'constant';
        fn[SPECIAL_PROPS.VALUE] = undefined;
        $.register(fn);

        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect((err as YError).code).toEqual(
          'E_UNDEFINED_CONSTANT_INITIALIZER',
        );
        expect((err as YError).params).toEqual(['THE_NUMBER']);
      }
    });

    test('should fail with a non constant that has a value', () => {
      try {
        const fn = async () => undefined;
        fn[SPECIAL_PROPS.NAME] = 'myService';
        fn[SPECIAL_PROPS.TYPE] = 'service';
        fn[SPECIAL_PROPS.VALUE] = 42;
        $.register(fn);

        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect((err as YError).code).toEqual(
          'E_BAD_VALUED_NON_CONSTANT_INITIALIZER',
        );
        expect((err as YError).params).toEqual(['myService']);
      }
    });

    test('should fail with special autoload initializer that is not a singleton', () => {
      try {
        $.register(
          initializer(
            {
              name: '$autoload',
              type: 'provider',
            },
            async () => ({ service: () => undefined }),
          ),
        );

        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect((err as YError).code).toEqual('E_BAD_AUTOLOADER');
        expect((err as YError).params).toEqual([false]);
      }
    });
  });

  describe('provider', () => {
    test('should register provider', () => {
      $.register(provider(hashProvider, 'hash'));
    });

    test('should fail with direct circular dependencies', () => {
      try {
        $.register(provider(hashProvider, 'hash', ['hash']));

        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect((err as YError).code).toEqual('E_CIRCULAR_DEPENDENCY');
        expect((err as YError).params).toEqual(['hash']);
      }
    });

    test('should fail with direct circular dependencies on mapped services', () => {
      try {
        $.register(provider(hashProvider, 'hash', ['hash>lol']));

        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect((err as YError).code).toEqual('E_CIRCULAR_DEPENDENCY');
        expect((err as YError).params).toEqual(['hash']);
      }
    });

    test('should fail with circular dependencies', () => {
      try {
        $.register(provider(inject(['hash3'], hashProvider), 'hash'));
        $.register(provider(inject(['hash'], hashProvider), 'hash1'));
        $.register(provider(inject(['hash1'], hashProvider), 'hash2'));
        $.register(provider(inject(['hash'], hashProvider), 'hash3'));
        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect((err as YError).code).toEqual('E_CIRCULAR_DEPENDENCY');
        expect((err as YError).params).toEqual(['hash3', 'hash', 'hash3']);
      }
    });

    test('should fail with deeper circular dependencies', () => {
      try {
        $.register(provider(inject(['hash1'], hashProvider), 'hash'));
        $.register(provider(inject(['hash2'], hashProvider), 'hash1'));
        $.register(provider(inject(['hash3'], hashProvider), 'hash2'));
        $.register(provider(inject(['hash'], hashProvider), 'hash3'));
        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect((err as YError).code).toEqual('E_CIRCULAR_DEPENDENCY');
        expect((err as YError).params).toEqual([
          'hash3',
          'hash',
          'hash1',
          'hash2',
          'hash3',
        ]);
      }
    });

    test('should fail with circular dependencies on mapped services', () => {
      try {
        $.register(provider(inject(['hash3>aHash3'], hashProvider), 'hash'));
        $.register(provider(inject(['hash>aHash'], hashProvider), 'hash1'));
        $.register(provider(inject(['hash1>aHash1'], hashProvider), 'hash2'));
        $.register(provider(inject(['hash>aHash'], hashProvider), 'hash3'));
        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect((err as YError).code).toEqual('E_CIRCULAR_DEPENDENCY');
        expect((err as YError).params).toEqual([
          'hash3',
          'hash>aHash',
          'hash3>aHash3',
        ]);
      }
    });

    test('should fail with singleton depending on siloed services', () => {
      try {
        $.register(provider(hashProvider, 'hash', [], false));
        $.register(provider(hashProvider, 'hash1', ['hash'], true));
        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect((err as YError).code).toEqual('E_BAD_SINGLETON_DEPENDENCIES');
        expect((err as YError).params).toEqual(['hash1', 'hash']);
      }
    });

    test('should fail when setting siloed services depended on by a singleton', () => {
      try {
        $.register(provider(hashProvider, 'hash1', ['hash'], true));
        $.register(provider(hashProvider, 'hash', [], false));
        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect((err as YError).code).toEqual('E_BAD_SINGLETON_DEPENDENCIES');
        expect((err as YError).params).toEqual(['hash1', 'hash']);
      }
    });
  });

  describe('run', () => {
    describe('should work', () => {
      test('with no dependencies', async () => {
        const dependencies = await $.run<any>([]);

        expect(dependencies).toEqual({});
      });

      test('with constant dependencies', async () => {
        $.register(constant('ENV', ENV));
        $.register(constant('time', time));

        const dependencies = await $.run<any>(['time', 'ENV']);

        expect(Object.keys(dependencies)).toEqual(['time', 'ENV']);
        expect(dependencies).toEqual({
          ENV,
          time,
        });
      });

      test('with service dependencies', async () => {
        const wrappedSampleService = inject<{ time: any }, string>(
          ['time'],
          async function sampleService({ time }: { time: any }) {
            return Promise.resolve(typeof time);
          },
        );
        $.register(service(wrappedSampleService, 'sample'));
        $.register(constant('time', time));

        const dependencies = await $.run<any>(['sample']);

        expect(Object.keys(dependencies)).toEqual(['sample']);
        expect(dependencies).toEqual({
          sample: 'function',
        });
      });

      test('with null service dependencies', async () => {
        const time = jest.fn();

        $.register(nullService);
        $.register(constant('time', time));

        const dependencies = await $.run<any>(['nullService']);

        expect(Object.keys(dependencies)).toEqual(['nullService']);
        expect(dependencies).toEqual({
          nullService: null,
        });
      });

      test('with null provider dependencies', async () => {
        const time = jest.fn();

        $.register(nullProvider);
        $.register(constant('time', time));

        const dependencies = await $.run<any>(['nullProvider']);

        expect(Object.keys(dependencies)).toEqual(['nullProvider']);
        expect(dependencies).toEqual({
          nullProvider: null,
        });
      });

      test('with undefined dependencies', async () => {
        const time = jest.fn();

        $.register(undefinedService);
        $.register(undefinedProvider);
        $.register(constant('time', time));

        const dependencies = await $.run<any>([
          'undefinedService',
          'undefinedProvider',
        ]);

        expect(Object.keys(dependencies)).toEqual([
          'undefinedService',
          'undefinedProvider',
        ]);
        expect(dependencies).toEqual({
          undefinedService: undefined,
          undefinedProvider: undefined,
        });
      });

      test('with simple dependencies', async () => {
        $.register(constant('ENV', ENV));
        $.register(constant('time', time));
        $.register(provider(hashProvider, 'hash', ['ENV']));

        const dependencies = await $.run<any>(['time', 'hash']);

        expect(Object.keys(dependencies)).toEqual(['time', 'hash']);
        expect(dependencies).toEqual({
          hash: { ENV },
          time,
        });
      });

      test('with given optional dependencies', async () => {
        $.register(constant('ENV', ENV));
        $.register(constant('DEBUG', {}));
        $.register(constant('time', time));
        $.register(provider(hashProvider, 'hash', ['ENV', '?DEBUG']));

        const dependencies = await $.run<any>(['time', 'hash']);

        expect(Object.keys(dependencies)).toEqual(['time', 'hash']);
        expect(dependencies).toEqual({
          hash: { ENV, DEBUG: {} },
          time,
        });
      });

      test('with lacking optional dependencies', async () => {
        $.register(constant('ENV', ENV));
        $.register(constant('time', time));
        $.register(provider(hashProvider, 'hash', ['ENV', '?DEBUG']));

        const dependencies = await $.run<any>(['time', 'hash']);

        expect(Object.keys(dependencies)).toEqual(['time', 'hash']);
        expect(dependencies).toEqual({
          hash: { ENV, DEBUG: undefined },
          time,
        });
      });

      test('with deeper dependencies', async () => {
        $.register(constant('ENV', ENV));
        $.register(constant('time', time));
        $.register(provider(hashProvider, 'hash', ['ENV']));
        $.register(provider(hashProvider, 'hash1', ['hash']));
        $.register(provider(hashProvider, 'hash2', ['hash1']));
        $.register(provider(hashProvider, 'hash3', ['hash2']));
        $.register(provider(hashProvider, 'hash4', ['hash3']));
        $.register(provider(hashProvider, 'hash5', ['hash4']));

        const dependencies = await $.run<any>(['hash5', 'time']);

        expect(Object.keys(dependencies)).toEqual(['hash5', 'time']);
      });

      test('and instanciate services once', async () => {
        const timeServiceStub = jest.fn(timeService);

        $.register(constant('ENV', ENV));
        $.register(service(timeServiceStub, 'time'));
        $.register(provider(hashProvider, 'hash', ['ENV', 'time']));
        $.register(provider(hashProvider, 'hash2', ['ENV', 'time']));
        $.register(provider(hashProvider, 'hash3', ['ENV', 'time']));

        const dependencies = await $.run<any>([
          'hash',
          'hash2',
          'hash3',
          'time',
        ]);

        expect(Object.keys(dependencies)).toEqual([
          'hash',
          'hash2',
          'hash3',
          'time',
        ]);
        expect(timeServiceStub.mock.calls).toEqual([[{}]]);
      });

      test('and instanciate a single mapped service', async () => {
        const providerStub = jest.fn().mockReturnValue(
          Promise.resolve({
            service: 'stub',
          }),
        );
        const providerStub2 = jest.fn().mockReturnValue(
          Promise.resolve({
            service: 'stub2',
          }),
        );

        $.register(
          provider(providerStub as any, 'mappedStub', ['stub2>mappedStub2']),
        );
        $.register(provider(providerStub2 as any, 'mappedStub2'));

        const dependencies = await $.run<any>(['stub>mappedStub']);

        expect(dependencies).toEqual({
          stub: 'stub',
        });
        expect(providerStub.mock.calls).toEqual([
          [
            {
              stub2: 'stub2',
            },
          ],
        ]);
      });

      test('and instanciate several services with mappings', async () => {
        const timeServiceStub = jest.fn(timeService);

        $.register(constant('ENV', ENV));
        $.register(singleton(service(timeServiceStub, 'aTime')));
        $.register(provider(hashProvider, 'aHash', ['ENV', 'time>aTime']));
        $.register(provider(hashProvider, 'aHash2', ['ENV', 'hash>aHash']));
        $.register(provider(hashProvider, 'aHash3', ['ENV', 'hash>aHash']));

        const dependencies = await $.run<any>([
          'hash2>aHash2',
          'hash3>aHash3',
          'time>aTime',
        ]);

        expect(Object.keys(dependencies)).toEqual(['hash2', 'hash3', 'time']);
        expect(timeServiceStub.mock.calls).toEqual([[{}]]);
      });
    });

    describe('should fail', () => {
      test('with bad service', async () => {
        $.register(service((() => undefined) as any, 'lol'));

        try {
          await $.run<any>(['lol']);
          throw new Error('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual('E_BAD_SERVICE_PROMISE');
          expect((err as YError).params).toEqual(['lol']);
        }
      });

      test('with bad provider', async () => {
        $.register(provider((() => undefined) as any, 'lol'));
        try {
          await $.run<any>(['lol']);
          throw new Error('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual('E_BAD_SERVICE_PROVIDER');
          expect((err as YError).params).toEqual(['lol']);
        }
      });

      test('with bad service in a provider', async () => {
        $.register(provider(() => Promise.resolve() as any, 'lol'));
        try {
          await $.run<any>(['lol']);
          throw new Error('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual('E_BAD_SERVICE_PROVIDER');
          expect((err as YError).params).toEqual(['lol']);
        }
      });

      test('with undeclared dependencies', async () => {
        try {
          await $.run<any>(['lol']);
          throw new Error('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual('E_UNMATCHED_DEPENDENCY');
          expect((err as YError).params).toEqual(['__run__', 'lol']);
        }
      });

      test('with undeclared dependencies upstream', async () => {
        $.register(constant('ENV', ENV));
        $.register(constant('time', time));
        $.register(provider(hashProvider, 'hash', ['ENV', 'hash2']));
        $.register(provider(hashProvider, 'hash2', ['ENV', 'lol']));

        try {
          await $.run<any>(['time', 'hash']);
          throw new Error('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual('E_UNMATCHED_DEPENDENCY');
          expect((err as YError).params).toEqual([
            '__run__',
            'hash',
            'hash2',
            'lol',
          ]);
        }
      });

      test('with indirect circular dependencies', async () => {
        $.register(
          service(
            async () => {
              return () => 'human';
            },
            'human',
            ['tree'],
          ),
        );
        $.register(
          service(
            async () => {
              return () => 'tree';
            },
            'tree',
            ['earth'],
          ),
        );
        $.register(
          service(
            async () => {
              return () => 'earth';
            },
            'earth',
            ['person'],
          ),
        );
        $.register(constant('$overrides', { person: 'human' }));

        try {
          await $.run<any>(['human']);
          throw new Error('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual('E_CIRCULAR_DEPENDENCY');
          expect((err as YError).params).toEqual([
            '__run__',
            'human',
            'tree',
            'earth',
            'human',
          ]);
        }
      });

      test('and provide a fatal error handler', async () => {
        $.register(constant('ENV', ENV));
        $.register(constant('time', time));
        $.register(provider(hashProvider, 'hash', ['ENV']));
        $.register(provider(dbProvider, 'db', ['ENV']));
        $.register(provider(processProvider, 'process', ['$fatalError']));

        function processProvider({
          $fatalError,
        }: {
          $fatalError: FatalErrorService;
        }) {
          return Promise.resolve({
            service: {
              fatalErrorPromise: $fatalError.errorPromise,
            },
          });
        }

        async function dbProvider({ ENV }: { ENV: Record<string, string> }) {
          let service;
          const fatalErrorPromise = new Promise<void>((resolve, reject) => {
            service = {
              resolve,
              reject,
              ENV,
            };
          });

          return {
            service,
            fatalErrorPromise,
          };
        }

        const { process, db } = await $.run<any>([
          'time',
          'hash',
          'db',
          'process',
        ]);

        try {
          db.reject(new Error('E_DB_ERROR'));
          await process.fatalErrorPromise;
          throw new Error('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as Error).message).toEqual('E_DB_ERROR');
        }
      });
    });
  });

  describe('autoload', () => {
    describe('should work', () => {
      test('with constant dependencies', async () => {
        const autoloaderInitializer = initializer(
          {
            type: 'service',
            name: '$autoload',
            inject: [],
            singleton: true,
          },
          async () => async (serviceName) => ({
            path: `/path/of/${serviceName}`,
            initializer: constant(serviceName, `value_of:${serviceName}`),
          }),
        );
        const wrappedProvider = provider(hashProvider, 'hash', [
          'ENV',
          '?DEBUG',
        ]);

        $.register(autoloaderInitializer);
        $.register(wrappedProvider);

        const dependencies = await $.run<any>(['time', 'hash']);

        expect(Object.keys(dependencies)).toEqual(['time', 'hash']);
        expect(dependencies).toEqual({
          hash: { ENV: 'value_of:ENV', DEBUG: 'value_of:DEBUG' },
          time: 'value_of:time',
        });
      });

      test('with lacking autoloaded dependencies', async () => {
        const autoloaderInitializer = initializer(
          {
            type: 'service',
            name: '$autoload',
            inject: [],
            singleton: true,
          },
          async () => async (serviceName) => ({
            path: '/path/of/debug',
            initializer: initializer(
              {
                type: 'service',
                name: 'DEBUG',
                inject: [],
              },
              async () => 'THE_DEBUG:' + serviceName,
            ),
          }),
        );
        const wrappedProvider = provider(hashProvider, 'hash', [
          'ENV',
          '?DEBUG',
        ]);

        $.register(autoloaderInitializer);
        $.register(wrappedProvider);
        $.register(constant('ENV', ENV));
        $.register(constant('time', time));

        const dependencies = await $.run<any>(['time', 'hash']);

        expect(Object.keys(dependencies)).toEqual(['time', 'hash']);
        expect(dependencies).toEqual({
          hash: { ENV, DEBUG: 'THE_DEBUG:DEBUG' },
          time,
        });
      });

      test('with deeper several lacking dependencies', async () => {
        $.register(
          initializer(
            {
              name: '$autoload',
              type: 'service',
              singleton: true,
            },
            async () => async (serviceName) => ({
              path: `/path/to/${serviceName}`,
              initializer: initializer(
                {
                  type: 'provider',
                  name: serviceName,
                  inject:
                    'hash2' === serviceName
                      ? ['hash1']
                      : 'hash4' === serviceName
                        ? ['hash3']
                        : [],
                },
                hashProvider,
              ),
            }),
          ),
        );
        $.register(constant('ENV', ENV));
        $.register(constant('time', time));
        $.register(provider(hashProvider, 'hash', ['ENV']));
        $.register(provider(hashProvider, 'hash1', ['hash']));
        $.register(provider(hashProvider, 'hash3', ['hash2']));
        $.register(provider(hashProvider, 'hash5', ['hash4']));

        const dependencies = await $.run<any>(['hash5', 'time']);

        expect(Object.keys(dependencies)).toEqual(['hash5', 'time']);
      });

      test('with various dependencies', async () => {
        $.register(provider(hashProvider, 'hash', ['hash2']));
        $.register(provider(hashProvider, 'hash3', ['?ENV']));
        $.register(constant('DEBUG', 1));
        $.register(
          initializer(
            {
              type: 'service',
              name: '$autoload',
              inject: ['DEBUG'],
              singleton: true,
            },
            async () => async (serviceName) => {
              if ('ENV' === serviceName) {
                throw new YError('E_UNMATCHED_DEPENDENCY');
              }

              return {
                path: '/path/of/debug',
                initializer: initializer(
                  {
                    type: 'service',
                    name: 'hash2',
                    inject: ['hash3'],
                  },
                  async () => 'THE_HASH:' + serviceName,
                ),
              };
            },
          ),
        );

        const dependencies = await $.run<any>(['hash', '?ENV']);

        expect(Object.keys(dependencies)).toEqual(['hash', 'ENV']);
      });

      test('and instantiate services once', async () => {
        $.register(
          initializer(
            {
              name: '$autoload',
              type: 'service',
              singleton: true,
            },
            async () => async (serviceName) => ({
              path: `/path/to/${serviceName}`,
              initializer: initializer(
                {
                  type: 'provider',
                  name: serviceName,
                  inject: ['ENV', 'time'],
                },
                hashProvider,
              ),
            }),
          ),
        );
        const timeServiceStub = jest.fn(timeService);

        $.register(constant('ENV', ENV));
        $.register(service(timeServiceStub, 'time'));
        $.register(provider(hashProvider, 'hash', ['hash1', 'hash2', 'hash3']));
        $.register(
          provider(hashProvider, 'hash_', ['hash1', 'hash2', 'hash3']),
        );

        const dependencies = await $.run<any>(['hash', 'hash_', 'hash3']);

        expect(timeServiceStub.mock.calls).toEqual([[{}]]);
        expect(Object.keys(dependencies)).toEqual(['hash', 'hash_', 'hash3']);
      });

      test('with null service dependencies', async () => {
        const time = jest.fn();

        $.register(constant('time', time));

        $.register(
          initializer(
            {
              name: '$autoload',
              type: 'service',
              singleton: true,
            },
            async () => async (serviceName) => ({
              path: `/path/to/${serviceName}`,
              initializer: nullService,
            }),
          ),
        );

        const dependencies = await $.run<any>(['nullService']);

        expect(Object.keys(dependencies)).toEqual(['nullService']);
        expect(dependencies).toEqual({
          nullService: null,
        });
      });

      test('with null provider dependencies', async () => {
        const time = jest.fn();

        $.register(constant('time', time));

        $.register(
          initializer(
            {
              name: '$autoload',
              type: 'service',
              singleton: true,
            },
            async () => async (serviceName) => ({
              path: `/path/to/${serviceName}`,
              initializer: nullProvider,
            }),
          ),
        );

        const dependencies = await $.run<any>(['nullProvider']);

        expect(Object.keys(dependencies)).toEqual(['nullProvider']);
        expect(dependencies).toEqual({
          nullProvider: null,
        });
      });

      test('with undefined dependencies', async () => {
        const time = jest.fn();

        $.register(
          initializer(
            {
              name: '$autoload',
              type: 'service',
              singleton: true,
            },
            async () => async (serviceName) => ({
              path: `/path/to/${serviceName}`,
              initializer:
                serviceName === 'undefinedService'
                  ? undefinedService
                  : undefinedProvider,
            }),
          ),
        );

        $.register(constant('time', time));

        const dependencies = await $.run<any>([
          'undefinedService',
          'undefinedProvider',
        ]);

        expect(Object.keys(dependencies)).toEqual([
          'undefinedService',
          'undefinedProvider',
        ]);
        expect(dependencies).toEqual({
          undefinedService: undefined,
          undefinedProvider: undefined,
        });
      });

      test('when autoload depends on optional and unexisting autoloaded dependencies', async () => {
        $.register(
          initializer(
            {
              type: 'service',
              name: '$autoload',
              inject: ['?ENV'],
              singleton: true,
            },
            async () => async (serviceName) => ({
              path: `/path/of/${serviceName}`,
              initializer: initializer(
                {
                  type: 'service',
                  name: serviceName,
                  inject: [],
                },
                async () => `THE_${serviceName.toUpperCase()}:` + serviceName,
              ),
            }),
          ),
        );

        const dependencies = await $.run<any>(['test']);

        expect(Object.keys(dependencies)).toEqual(['test']);
      });

      test('when autoload depends on deeper optional and unexisting autoloaded dependencies', async () => {
        $.register(
          initializer(
            {
              type: 'service',
              name: 'log',
              inject: ['?LOG_ROUTING', '?LOGGER', '?debug'],
              singleton: true,
            },
            async () => {
              return () => undefined;
            },
          ),
        );
        $.register(constant('LOGGER', 'LOGGER_CONSTANT'));
        $.register(constant('debug', 'debug_value'));
        $.register(
          initializer(
            {
              type: 'service',
              name: '$autoload',
              inject: ['?ENV', '?log'],
              singleton: true,
            },
            async () => async (serviceName) => ({
              path: `/path/of/${serviceName}`,
              initializer: initializer(
                {
                  type: 'service',
                  name: serviceName,
                  inject: [],
                },
                async () => `THE_${serviceName.toUpperCase()}:` + serviceName,
              ),
            }),
          ),
        );

        const dependencies = await $.run<any>(['test', 'log']);

        expect(Object.keys(dependencies)).toEqual(['test', 'log']);
      });
    });

    describe('should fail', () => {
      test('when autoload does not exists', async () => {
        try {
          await $.run<any>(['test']);
          throw new YError('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual('E_UNMATCHED_DEPENDENCY');
        }
      });

      test('when autoloaded dependencies are not found', async () => {
        $.register(
          initializer(
            {
              type: 'service',
              name: '$autoload',
              inject: [],
              singleton: true,
            },
            async () => async (serviceName) => {
              throw new YError('E_CANNOT_AUTOLOAD', serviceName);
            },
          ),
        );

        try {
          await $.run<any>(['test']);
          throw new YError('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual('E_BAD_AUTOLOADED_INITIALIZER');
          expect((err as YError).params).toEqual(['test']);
          expect(((err as YError).wrappedErrors[0] as YError).code).toEqual(
            'E_CANNOT_AUTOLOAD',
          );
          expect(((err as YError).wrappedErrors[0] as YError).params).toEqual([
            'test',
          ]);
        }
      });

      test('when autoloaded dependencies are circularly dependent', async () => {
        $.register(
          service(
            async () => {
              return 'mainService';
            },
            'mainService',
            ['parentService1'],
          ),
        );
        $.register(
          service(
            async () => {
              return 'parentService1';
            },
            'parentService1',
            ['parentService2'],
          ),
        );
        $.register(
          initializer(
            {
              type: 'service',
              name: '$autoload',
              inject: ['?ENV', '?log'],
              singleton: true,
            },
            async () => async (serviceName) => ({
              path: `/path/of/${serviceName}`,
              initializer: initializer(
                {
                  type: 'service',
                  name: serviceName,
                  inject: ['parentService1'],
                },
                async () => `THE_${serviceName.toUpperCase()}:` + serviceName,
              ),
            }),
          ),
        );

        try {
          await $.run<any>(['test', 'log']);
          throw new YError('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual('E_BAD_AUTOLOADED_INITIALIZER');
          expect((err as YError).params).toEqual(['parentService2']);
          expect(((err as YError).wrappedErrors[0] as YError).code).toEqual(
            'E_CIRCULAR_DEPENDENCY',
          );
          expect(((err as YError).wrappedErrors[0] as YError).params).toEqual([
            'parentService2',
            'parentService1',
            'parentService2',
          ]);
        }
      });

      test('when the autoloader returns bad data', async () => {
        $.register(
          initializer(
            {
              type: 'service',
              name: '$autoload',
              inject: [],
              singleton: true,
            },
            async () => async () => 'not_an_initializer',
          ),
        );

        try {
          await $.run<any>(['test']);
          throw new YError('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual('E_BAD_AUTOLOADED_INITIALIZER');
          expect((err as YError).params).toEqual(['test']);
          expect(((err as YError).wrappedErrors[0] as YError).code).toEqual(
            'E_BAD_AUTOLOADER_RESULT',
          );
          expect(((err as YError).wrappedErrors[0] as YError).params).toEqual([
            'test',
            'not_an_initializer',
          ]);
        }
      });

      test('when autoloaded dependencies are not initializers', async () => {
        $.register(
          initializer(
            {
              type: 'service',
              name: '$autoload',
              inject: [],
              singleton: true,
            },
            async () => async () => ({
              initializer: 'not_an_initializer',
              path: '/path/to/initializer',
            }),
          ),
        );

        try {
          await $.run<any>(['test']);
          throw new YError('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual('E_BAD_AUTOLOADED_INITIALIZER');
          expect((err as YError).params).toEqual(['test']);
          expect(((err as YError).wrappedErrors[0] as YError).code).toEqual(
            'E_AUTOLOADED_INITIALIZER_MISMATCH',
          );
          expect(((err as YError).wrappedErrors[0] as YError).params).toEqual([
            'test',
            undefined,
          ]);
        }
      });

      test('when autoloaded dependencies are not right initializers', async () => {
        $.register(
          initializer(
            {
              type: 'service',
              name: '$autoload',
              inject: [],
              singleton: true,
            },
            async () => async (serviceName) => ({
              path: '/path/of/debug',
              initializer: initializer(
                {
                  type: 'service',
                  name: 'not-' + serviceName,
                  inject: [],
                },
                async () => 'THE_TEST:' + serviceName,
              ),
            }),
          ),
        );

        try {
          await $.run<any>(['test']);
          throw new YError('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual('E_BAD_AUTOLOADED_INITIALIZER');
          expect((err as YError).params).toEqual(['test']);
          expect(((err as YError).wrappedErrors[0] as YError).code).toEqual(
            'E_AUTOLOADED_INITIALIZER_MISMATCH',
          );
          expect(((err as YError).wrappedErrors[0] as YError).params).toEqual([
            'test',
            'not-test',
          ]);
        }
      });

      test('when autoload depends on existing autoloaded dependencies', async () => {
        $.register(
          initializer(
            {
              type: 'service',
              name: '$autoload',
              inject: ['ENV'],
              singleton: true,
            },
            async () => async (serviceName) => ({
              path: '/path/of/debug',
              initializer: initializer(
                {
                  type: 'service',
                  name: 'DEBUG',
                  inject: [],
                },
                async () => 'THE_DEBUG:' + serviceName,
              ),
            }),
          ),
        );

        try {
          await $.run<any>(['test']);
          throw new YError('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          expect((err as YError).code).toEqual('E_UNMATCHED_DEPENDENCY');
          expect((err as YError).params).toEqual(['__run__', 'test']);
        }
      });
    });
  });

  describe('$injector', () => {
    test('should work with no dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));

      const dependencies = await $.run<any>(['time', 'hash', '$injector']);
      expect(Object.keys(dependencies)).toEqual(['time', 'hash', '$injector']);
      const injectDependencies = await dependencies.$injector([]);

      expect(Object.keys(injectDependencies)).toEqual([]);
      expect(injectDependencies).toEqual({});
    });

    test('should work with same dependencies then the running silo', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));

      const dependencies = await $.run<any>(['time', 'hash', '$injector']);
      expect(Object.keys(dependencies)).toEqual(['time', 'hash', '$injector']);

      const injectDependencies = await dependencies.$injector(['time', 'hash']);
      expect(Object.keys(injectDependencies)).toEqual(['time', 'hash']);
      expect(injectDependencies).toEqual({
        hash: { ENV },
        time,
      });
    });

    test('should work with name mapping', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));

      const dependencies = await $.run<any>(['time', 'hash', '$injector']);
      expect(Object.keys(dependencies)).toEqual(['time', 'hash', '$injector']);

      const injectDependencies = await dependencies.$injector([
        'aTime>time',
        'aHash>hash',
      ]);
      expect(Object.keys(injectDependencies)).toEqual(['aTime', 'aHash']);
      expect(injectDependencies).toEqual({
        aHash: { ENV },
        aTime: time,
      });
    });

    test('should work with non instanciated dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));

      const dependencies = await $.run<any>(['time', '$injector']);
      expect(Object.keys(dependencies)).toEqual(['time', '$injector']);

      const injectDependencies = await dependencies.$injector(['time', 'hash']);
      expect(Object.keys(injectDependencies)).toEqual(['time', 'hash']);
      expect(injectDependencies).toEqual({
        hash: { ENV },
        time,
      });
    });

    test('should create dependencies when not declared as singletons', async () => {
      $.register(constant('ENV', ENV));
      $.register(provider(hashProvider, 'hash', ['ENV']));

      const [{ hash }, { hash: sameHash }] = await Promise.all([
        $.run<any>(['hash']),
        $.run<any>(['hash']),
      ]);

      expect(hash).not.toBe(sameHash);

      const { hash: yaSameHash } = await $.run<any>(['hash']);

      expect(hash).not.toBe(yaSameHash);
    });

    test('should reuse dependencies when declared as singletons', async () => {
      $.register(constant('ENV', ENV));
      $.register(provider(hashProvider, 'hash', ['ENV'], true));
      $.register(provider(hashProvider, 'hash2', ['ENV'], true));

      const [{ hash, hash2 }, { hash: sameHash, hash2: sameHash2 }] =
        await Promise.all([
          $.run<any>(['hash']),
          $.run<any>(['hash']),
          $.run<any>(['hash2']),
          $.run<any>(['hash2']),
        ]);
      expect(hash).toEqual(sameHash);
      expect(hash2).toEqual(sameHash2);

      const { hash: yaSameHash } = await $.run<any>(['hash']);

      expect(hash).toEqual(yaSameHash);
    });
  });

  describe('destroy', () => {
    test('should work even with one silo and no dependencies', async () => {
      expect(typeof $.destroy).toEqual('function');
      const dependencies = await $.run<any>(['$instance']);

      await dependencies.$instance.destroy();
    });

    test('should work with several silos and dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV'], true));
      $.register(provider(hashProvider, 'hash1', ['ENV']));
      $.register(provider(hashProvider, 'hash2', ['ENV']));

      const [dependencies] = await Promise.all([
        $.run<any>(['$instance']),
        $.run<any>(['ENV', 'hash', 'hash1', 'time']),
        $.run<any>(['ENV', 'hash', 'hash2']),
      ]);

      expect(typeof dependencies.$instance.destroy).toEqual('function');

      await $.destroy();
    });

    test('should work when triggered from several silos simultaneously', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));
      $.register(provider(hashProvider, 'hash1', ['ENV']));
      $.register(provider(hashProvider, 'hash2', ['ENV']));

      const dependenciesBuckets = await Promise.all([
        $.run<any>(['$instance']),
        $.run<any>(['$instance', 'ENV', 'hash', 'hash1', 'time']),
        $.run<any>(['$instance', 'ENV', 'hash', 'hash2']),
      ]);

      await Promise.all(
        dependenciesBuckets.map((dependencies) =>
          dependencies.$instance.destroy(),
        ),
      );
    });

    test('should work when a silo shutdown is in progress', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));
      $.register(provider(hashProvider, 'hash1', ['ENV']));
      $.register(provider(hashProvider, 'hash2', ['ENV']));

      const [dependencies1, dependencies2] = await Promise.all([
        $.run<any>(['$instance']),
        $.run<any>(['$dispose', 'ENV', 'hash', 'hash1', 'time']),
        $.run<any>(['ENV', 'hash', 'hash2']),
      ]);

      await Promise.all([
        dependencies2.$dispose(),
        dependencies1.$instance.destroy(),
      ]);
    });

    test('should disallow new runs', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));
      $.register(provider(hashProvider, 'hash1', ['ENV']));

      const dependencies = await $.run<any>(['$instance']);

      expect(typeof dependencies.$instance.destroy).toEqual('function');

      await dependencies.$instance.destroy();

      try {
        await $.run<any>(['ENV', 'hash', 'hash1']);
        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        expect((err as YError).code).toEqual('E_INSTANCE_DESTROYED');
      }
    });
  });

  describe('$dispose', () => {
    test('should work with no dependencies', async () => {
      const dependencies = await $.run<any>(['$dispose']);
      expect(typeof dependencies.$dispose).toEqual('function');

      return dependencies.$dispose();
    });

    test('should work with constant dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));

      const dependencies = await $.run<any>(['time', 'ENV', '$dispose']);
      expect(Object.keys(dependencies)).toEqual(['time', 'ENV', '$dispose']);

      await dependencies.$dispose();
    });

    test('should work with simple dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));

      const dependencies = await $.run<any>(['time', 'hash', '$dispose']);
      expect(Object.keys(dependencies)).toEqual(['time', 'hash', '$dispose']);

      await dependencies.$dispose();
    });

    test('should work with deeper dependencies', async () => {
      let shutdownCallResolve: (value?: unknown) => void;
      let shutdownResolve: (value?: unknown) => void;
      const shutdownCallPromise = new Promise((resolve) => {
        shutdownCallResolve = resolve;
      });
      const shutdownStub = jest.fn(() => {
        shutdownCallResolve();
        return new Promise((resolve) => {
          shutdownResolve = resolve;
        });
      });

      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));
      $.register(provider(hashProvider, 'hash1', ['hash']));
      $.register(provider(hashProvider, 'hash2', ['hash1']));
      $.register(provider(hashProvider, 'hash3', ['hash2']));
      $.register(provider(hashProvider, 'hash4', ['hash3']));
      $.register(provider(hashProvider, 'hash5', ['hash4']));
      $.register(
        provider(
          () =>
            Promise.resolve({
              service: {
                shutdownStub,
                shutdownResolve,
              },
              dispose: shutdownStub,
            }) as any,
          'shutdownChecker',
          ['hash4'],
        ),
      );

      const dependencies = await $.run<any>([
        'hash5',
        'time',
        '$dispose',
        'shutdownChecker',
      ]);
      expect(Object.keys(dependencies)).toEqual([
        'hash5',
        'time',
        '$dispose',
        'shutdownChecker',
      ]);

      const finalPromise = shutdownCallPromise.then(() => {
        expect(shutdownStub.mock.calls).toEqual([[]]);
        shutdownResolve();
      });
      await dependencies.$dispose();
      await finalPromise;
    });

    test('should work with deeper multi used dependencies', async () => {
      let shutdownCallResolve: (value?: unknown) => void;
      let shutdownResolve: (value?: unknown) => void;
      const shutdownCallPromise = new Promise((resolve) => {
        shutdownCallResolve = resolve;
      });
      const shutdownStub = jest.fn(() => {
        shutdownCallResolve();
        return new Promise((resolve) => {
          shutdownResolve = resolve;
        });
      });

      $.register(constant('ENV', ENV));
      $.register(provider(hashProvider, 'hash', ['ENV']));
      $.register(
        provider(
          () =>
            Promise.resolve({
              service: {
                shutdownStub,
                shutdownResolve,
              },
              dispose: shutdownStub,
            }) as any,
          'shutdownChecker',
          ['hash'],
        ),
      );
      $.register(provider(hashProvider, 'hash1', ['shutdownChecker']));
      $.register(provider(hashProvider, 'hash2', ['shutdownChecker']));

      const dependencies = await $.run<any>([
        'hash1',
        'hash2',
        '$dispose',
        'shutdownChecker',
      ]);
      expect(Object.keys(dependencies)).toEqual([
        'hash1',
        'hash2',
        '$dispose',
        'shutdownChecker',
      ]);

      const finalPromise = shutdownCallPromise.then(() => {
        expect(shutdownStub.mock.calls).toEqual([[]]);
        shutdownResolve();
      });

      await dependencies.$dispose();
      await finalPromise;
    });

    test('should delay service shutdown to their deeper dependencies', async () => {
      const servicesShutdownCalls = jest.fn(() => Promise.resolve());

      $.register(
        provider(
          () =>
            Promise.resolve({
              service: {},
              dispose: servicesShutdownCalls.bind(null, 'hash'),
            }),
          'hash',
        ),
      );
      $.register(
        provider(
          () =>
            Promise.resolve({
              service: {},
              dispose: servicesShutdownCalls.bind(null, 'hash1'),
            }),
          'hash1',
          ['hash'],
        ),
      );
      $.register(
        provider(
          () =>
            Promise.resolve({
              service: {},
              dispose: servicesShutdownCalls.bind(null, 'hash2'),
            }),
          'hash2',
          ['hash1', 'hash'],
        ),
      );

      const dependencies = await $.run<any>(['hash2', '$dispose']);
      expect(Object.keys(dependencies)).toEqual(['hash2', '$dispose']);
      await dependencies.$dispose();

      expect(servicesShutdownCalls.mock.calls).toEqual([
        ['hash2'],
        ['hash1'],
        ['hash'],
      ]);
    });

    test('should not shutdown singleton dependencies if used elsewhere', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV'], true));

      const { hash } = await $.run<any>(['time', 'hash']);
      const dependencies = await $.run<any>(['time', 'hash', '$dispose']);

      expect(dependencies.hash).toEqual(hash);

      await dependencies.$dispose();

      const newDependencies = await $.run<any>(['time', 'hash']);
      expect(newDependencies.hash).toEqual(hash);
    });

    test('should shutdown singleton dependencies if not used elsewhere', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV'], true));

      const { hash, $dispose } = await $.run<any>(['time', 'hash', '$dispose']);

      await $dispose();

      const dependencies = await $.run<any>(['time', 'hash']);

      expect(dependencies.hash).not.toBe(hash);
    });
  });

  describe('toMermaidGraph', () => {
    test('should print nothing when no dependency', () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      expect($.toMermaidGraph()).toEqual('');
    });

    test('should print a dependency graph', () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));
      $.register(provider(hashProvider, 'hash1', ['hash']));
      $.register(provider(hashProvider, 'hash2', ['hash1']));
      $.register(provider(hashProvider, 'hash3', ['hash2']));
      $.register(provider(hashProvider, 'hash4', ['hash3']));
      $.register(provider(hashProvider, 'hash5', ['hash4']));
      expect($.toMermaidGraph()).toEqual(
        'graph TD\n' +
          '  hash-->ENV\n' +
          '  hash1-->hash\n' +
          '  hash2-->hash1\n' +
          '  hash3-->hash2\n' +
          '  hash4-->hash3\n' +
          '  hash5-->hash4',
      );
    });

    test('should allow custom shapes', () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));
      $.register(provider(hashProvider, 'hash1', ['hash']));
      $.register(provider(hashProvider, 'hash2', ['hash1']));
      $.register(provider(hashProvider, 'hash3', ['hash2']));
      $.register(provider(hashProvider, 'hash4', ['hash3']));
      $.register(provider(hashProvider, 'hash5', ['hash4']));
      expect(
        $.toMermaidGraph({
          shapes: [
            {
              pattern: /^hash([0-9]+)$/,
              template: '$0(($1))',
            },
            {
              pattern: /^[A-Z_]+$/,
              template: '$0{$0}',
            },
            {
              pattern: /^.+$/,
              template: '$0[$0]',
            },
          ],
        }),
      ).toEqual(
        'graph TD\n' +
          '  hash[hash]-->ENV{ENV}\n' +
          '  hash1((1))-->hash[hash]\n' +
          '  hash2((2))-->hash1((1))\n' +
          '  hash3((3))-->hash2((2))\n' +
          '  hash4((4))-->hash3((3))\n' +
          '  hash5((5))-->hash4((4))',
      );
    });

    test('should allow custom styles', () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));
      $.register(provider(hashProvider, 'hash1', ['hash']));
      $.register(provider(hashProvider, 'hash2', ['hash1']));
      $.register(provider(hashProvider, 'hash3', ['hash2']));
      $.register(provider(hashProvider, 'hash4', ['hash3']));
      $.register(provider(hashProvider, 'hash5', ['hash4']));
      expect(
        $.toMermaidGraph({
          classes: {
            exotic: 'fill:#f9f,stroke:#333,stroke-width:4px;',
          },
          styles: [
            {
              pattern: /^hash([0-9]+)$/,
              className: 'exotic',
            },
            {
              pattern: /^hash([0-9]+)$/,
              className: 'notapplied',
            },
          ],
          shapes: [
            {
              pattern: /^hash([0-9]+)$/,
              template: '$0(($1))',
            },
            {
              pattern: /^[A-Z_]+$/,
              template: '$0{$0}',
            },
            {
              pattern: /^.+$/,
              template: '$0[$0]',
            },
          ],
        }),
      ).toEqual(
        'graph TD\n' +
          '  hash[hash]-->ENV{ENV}\n' +
          '  hash1((1))-->hash[hash]\n' +
          '  hash2((2))-->hash1((1))\n' +
          '  hash3((3))-->hash2((2))\n' +
          '  hash4((4))-->hash3((3))\n' +
          '  hash5((5))-->hash4((4))\n' +
          '  classDef exotic fill:#f9f,stroke:#333,stroke-width:4px;\n' +
          '  class hash1 exotic;\n' +
          '  class hash2 exotic;\n' +
          '  class hash3 exotic;\n' +
          '  class hash4 exotic;\n' +
          '  class hash5 exotic;',
      );
    });
  });
});
