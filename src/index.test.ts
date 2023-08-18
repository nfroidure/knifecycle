/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint max-nested-callbacks:0 */
import { jest, describe, beforeEach, test } from '@jest/globals';
import assert from 'assert';
import sinon from 'sinon';
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
        assert.deepEqual(await $.run<any>(['TEST']), {
          TEST: 2,
        });
      });

      test('should fail when overriding an initialized constant', async () => {
        $.register(constant('TEST', 1));
        assert.deepEqual(await $.run<any>(['TEST']), {
          TEST: 1,
        });

        try {
          $.register(constant('TEST', 2));
          throw new YError('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          assert.equal(
            (err as YError).code,
            'E_INITIALIZER_ALREADY_INSTANCIATED',
          );
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
        assert.deepEqual(test(), 2);
      });

      test('should fail when overriding an initialized service', async () => {
        $.register(service(async () => () => 1, 'test'));
        const { test } = await $.run<any>(['test']);
        assert.deepEqual(test(), 1);

        try {
          $.register(service(async () => () => 2, 'test'));
          throw new YError('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          assert.equal(
            (err as YError).code,
            'E_INITIALIZER_ALREADY_INSTANCIATED',
          );
        }
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
        assert.deepEqual(test, 2);
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
        assert.deepEqual(test, 2);
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
        assert.deepEqual(test, 1);

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
          assert.equal(
            (err as YError).code,
            'E_INITIALIZER_ALREADY_INSTANCIATED',
          );
        }
      });
    });

    test('should fail when intitializer is no a function', () => {
      assert.throws(
        () => {
          $.register('not_a_function' as any);
        },
        (err) => {
          assert.deepEqual((err as YError).code, 'E_BAD_INITIALIZER');
          assert.deepEqual((err as YError).params, ['not_a_function']);
          return true;
        },
      );
    });

    test('should fail with no service name', () => {
      assert.throws(
        () => {
          $.register(async () => undefined);
        },
        (err) => {
          assert.deepEqual((err as YError).code, 'E_ANONYMOUS_ANALYZER');
          assert.deepEqual((err as YError).params, []);
          return true;
        },
      );
    });

    test('should fail with a bad service type', () => {
      assert.throws(
        () => {
          const fn = async () => undefined;
          fn[SPECIAL_PROPS.NAME] = 'test';
          fn[SPECIAL_PROPS.TYPE] = 'not_allowed_type';
          $.register(fn);
        },
        (err) => {
          assert.deepEqual((err as YError).code, 'E_BAD_INITIALIZER_TYPE');
          assert.deepEqual((err as YError).params, [
            'test',
            'not_allowed_type',
            ALLOWED_INITIALIZER_TYPES,
          ]);
          return true;
        },
      );
    });

    test('should fail with an undefined constant', () => {
      assert.throws(
        () => {
          const fn = async () => undefined;
          fn[SPECIAL_PROPS.NAME] = 'THE_NUMBER';
          fn[SPECIAL_PROPS.TYPE] = 'constant';
          fn[SPECIAL_PROPS.VALUE] = undefined;
          $.register(fn);
        },
        (err) => {
          assert.deepEqual(
            (err as YError).code,
            'E_UNDEFINED_CONSTANT_INITIALIZER',
          );
          assert.deepEqual((err as YError).params, ['THE_NUMBER']);
          return true;
        },
      );
    });

    test('should fail with a non constant that has a value', () => {
      assert.throws(
        () => {
          const fn = async () => undefined;
          fn[SPECIAL_PROPS.NAME] = 'myService';
          fn[SPECIAL_PROPS.TYPE] = 'service';
          fn[SPECIAL_PROPS.VALUE] = 42;
          $.register(fn);
        },
        (err) => {
          assert.deepEqual(
            (err as YError).code,
            'E_BAD_VALUED_NON_CONSTANT_INITIALIZER',
          );
          assert.deepEqual((err as YError).params, ['myService']);
          return true;
        },
      );
    });

    test('should fail with special autoload intitializer that is not a singleton', () => {
      assert.throws(
        () => {
          $.register(
            initializer(
              {
                name: '$autoload',
                type: 'provider',
              },
              async () => ({ service: () => undefined }),
            ),
          );
        },
        (err) => {
          assert.deepEqual((err as YError).code, 'E_BAD_AUTOLOADER');
          assert.deepEqual((err as YError).params, [false]);
          return true;
        },
      );
    });
  });

  describe('provider', () => {
    test('should register provider', () => {
      $.register(provider(hashProvider, 'hash'));
    });

    test('should fail with direct circular dependencies', () => {
      assert.throws(
        () => {
          $.register(provider(hashProvider, 'hash', ['hash']));
        },
        (err) => {
          assert.deepEqual((err as YError).code, 'E_CIRCULAR_DEPENDENCY');
          assert.deepEqual((err as YError).params, ['hash']);
          return true;
        },
      );
    });

    test('should fail with direct circular dependencies on mapped services', () => {
      assert.throws(
        () => {
          $.register(provider(hashProvider, 'hash', ['hash>lol']));
        },
        (err) => {
          assert.deepEqual((err as YError).code, 'E_CIRCULAR_DEPENDENCY');
          assert.deepEqual((err as YError).params, ['hash']);
          return true;
        },
      );
    });

    test('should fail with circular dependencies', () => {
      assert.throws(
        () => {
          $.register(provider(inject(['hash3'], hashProvider), 'hash'));
          $.register(provider(inject(['hash'], hashProvider), 'hash1'));
          $.register(provider(inject(['hash1'], hashProvider), 'hash2'));
          $.register(provider(inject(['hash'], hashProvider), 'hash3'));
        },
        (err) => {
          assert.deepEqual((err as YError).code, 'E_CIRCULAR_DEPENDENCY');
          assert.deepEqual((err as YError).params, ['hash3', 'hash', 'hash3']);
          return true;
        },
      );
    });

    test('should fail with deeper circular dependencies', () => {
      assert.throws(
        () => {
          $.register(provider(inject(['hash1'], hashProvider), 'hash'));
          $.register(provider(inject(['hash2'], hashProvider), 'hash1'));
          $.register(provider(inject(['hash3'], hashProvider), 'hash2'));
          $.register(provider(inject(['hash'], hashProvider), 'hash3'));
        },
        (err) => {
          assert.deepEqual((err as YError).code, 'E_CIRCULAR_DEPENDENCY');
          assert.deepEqual((err as YError).params, [
            'hash3',
            'hash',
            'hash1',
            'hash2',
            'hash3',
          ]);
          return true;
        },
      );
    });

    test('should fail with circular dependencies on mapped services', () => {
      assert.throws(
        () => {
          $.register(provider(inject(['hash3>aHash3'], hashProvider), 'hash'));
          $.register(provider(inject(['hash>aHash'], hashProvider), 'hash1'));
          $.register(provider(inject(['hash1>aHash1'], hashProvider), 'hash2'));
          $.register(provider(inject(['hash>aHash'], hashProvider), 'hash3'));
        },
        (err) => {
          assert.deepEqual((err as YError).code, 'E_CIRCULAR_DEPENDENCY');
          assert.deepEqual((err as YError).params, [
            'hash3',
            'hash>aHash',
            'hash3>aHash3',
          ]);
          return true;
        },
      );
    });

    test('should fail with singleton depending on siloed services', () => {
      assert.throws(
        () => {
          $.register(provider(hashProvider, 'hash', [], false));
          $.register(provider(hashProvider, 'hash1', ['hash'], true));
        },
        (err) => {
          assert.deepEqual(
            (err as YError).code,
            'E_BAD_SINGLETON_DEPENDENCIES',
          );
          assert.deepEqual((err as YError).params, ['hash1', 'hash']);
          return true;
        },
      );
    });

    test('should fail when setting siloed services depended on by a singleton', () => {
      assert.throws(
        () => {
          $.register(provider(hashProvider, 'hash1', ['hash'], true));
          $.register(provider(hashProvider, 'hash', [], false));
        },
        (err) => {
          assert.deepEqual(
            (err as YError).code,
            'E_BAD_SINGLETON_DEPENDENCIES',
          );
          assert.deepEqual((err as YError).params, ['hash1', 'hash']);
          return true;
        },
      );
    });
  });

  describe('run', () => {
    describe('should work', () => {
      test('with no dependencies', async () => {
        const dependencies = await $.run<any>([]);

        assert.deepEqual(dependencies, {});
      });

      test('with constant dependencies', async () => {
        $.register(constant('ENV', ENV));
        $.register(constant('time', time));

        const dependencies = await $.run<any>(['time', 'ENV']);

        assert.deepEqual(Object.keys(dependencies), ['time', 'ENV']);
        assert.deepEqual(dependencies, {
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

        assert.deepEqual(Object.keys(dependencies), ['sample']);
        assert.deepEqual(dependencies, {
          sample: 'function',
        });
      });

      test('with null service dependencies', async () => {
        const time = jest.fn();

        $.register(nullService);
        $.register(constant('time', time));

        const dependencies = await $.run<any>(['nullService']);

        assert.deepEqual(Object.keys(dependencies), ['nullService']);
        assert.deepEqual(dependencies, {
          nullService: null,
        });
      });

      test('with null provider dependencies', async () => {
        const time = jest.fn();

        $.register(nullProvider);
        $.register(constant('time', time));

        const dependencies = await $.run<any>(['nullProvider']);

        assert.deepEqual(Object.keys(dependencies), ['nullProvider']);
        assert.deepEqual(dependencies, {
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

        assert.deepEqual(Object.keys(dependencies), [
          'undefinedService',
          'undefinedProvider',
        ]);
        assert.deepEqual(dependencies, {
          undefinedService: undefined,
          undefinedProvider: undefined,
        });
      });

      test('with simple dependencies', async () => {
        $.register(constant('ENV', ENV));
        $.register(constant('time', time));
        $.register(provider(hashProvider, 'hash', ['ENV']));

        const dependencies = await $.run<any>(['time', 'hash']);

        assert.deepEqual(Object.keys(dependencies), ['time', 'hash']);
        assert.deepEqual(dependencies, {
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

        assert.deepEqual(Object.keys(dependencies), ['time', 'hash']);
        assert.deepEqual(dependencies, {
          hash: { ENV, DEBUG: {} },
          time,
        });
      });

      test('with lacking optional dependencies', async () => {
        $.register(constant('ENV', ENV));
        $.register(constant('time', time));
        $.register(provider(hashProvider, 'hash', ['ENV', '?DEBUG']));

        const dependencies = await $.run<any>(['time', 'hash']);

        assert.deepEqual(Object.keys(dependencies), ['time', 'hash']);
        assert.deepEqual(dependencies, {
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

        assert.deepEqual(Object.keys(dependencies), ['hash5', 'time']);
      });

      test('and instanciate services once', async () => {
        const timeServiceStub = sinon.spy(timeService);

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

        assert.deepEqual(Object.keys(dependencies), [
          'hash',
          'hash2',
          'hash3',
          'time',
        ]);
        assert.deepEqual(timeServiceStub.args, [[{}]]);
      });

      test('and instanciate a single mapped service', async () => {
        const providerStub = sinon.stub().returns(
          Promise.resolve({
            service: 'stub',
          }),
        );
        const providerStub2 = sinon.stub().returns(
          Promise.resolve({
            service: 'stub2',
          }),
        );

        $.register(provider(providerStub, 'mappedStub', ['stub2>mappedStub2']));
        $.register(provider(providerStub2, 'mappedStub2'));

        const dependencies = await $.run<any>(['stub>mappedStub']);

        assert.deepEqual(dependencies, {
          stub: 'stub',
        });
        assert.deepEqual(providerStub.args, [
          [
            {
              stub2: 'stub2',
            },
          ],
        ]);
      });

      test('and instanciate several services with mappings', async () => {
        const timeServiceStub = sinon.spy(timeService);

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

        assert.deepEqual(Object.keys(dependencies), ['hash2', 'hash3', 'time']);
        assert.deepEqual(timeServiceStub.args, [[{}]]);
      });
    });
    describe('should fail', () => {
      test('with bad service', async () => {
        $.register(service((() => undefined) as any, 'lol'));

        try {
          await $.run<any>(['lol']);
          throw new Error('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          assert.deepEqual((err as YError).code, 'E_BAD_SERVICE_PROMISE');
          assert.deepEqual((err as YError).params, ['lol']);
        }
      });

      test('with bad provider', async () => {
        $.register(provider((() => undefined) as any, 'lol'));
        try {
          await $.run<any>(['lol']);
          throw new Error('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          assert.deepEqual((err as YError).code, 'E_BAD_SERVICE_PROVIDER');
          assert.deepEqual((err as YError).params, ['lol']);
        }
      });

      test('with bad service in a provider', async () => {
        $.register(provider(() => Promise.resolve() as any, 'lol'));
        try {
          await $.run<any>(['lol']);
          throw new Error('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          assert.deepEqual((err as YError).code, 'E_BAD_SERVICE_PROVIDER');
          assert.deepEqual((err as YError).params, ['lol']);
        }
      });

      test('with undeclared dependencies', async () => {
        try {
          await $.run<any>(['lol']);
          throw new Error('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          assert.deepEqual((err as YError).code, 'E_UNMATCHED_DEPENDENCY');
          assert.deepEqual((err as YError).params, ['__run__', 'lol']);
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
          assert.deepEqual((err as YError).code, 'E_UNMATCHED_DEPENDENCY');
          assert.deepEqual((err as YError).params, [
            '__run__',
            'hash',
            'hash2',
            'lol',
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
          assert.deepEqual((err as Error).message, 'E_DB_ERROR');
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

        assert.deepEqual(Object.keys(dependencies), ['time', 'hash']);
        assert.deepEqual(dependencies, {
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

        assert.deepEqual(Object.keys(dependencies), ['time', 'hash']);
        assert.deepEqual(dependencies, {
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

        assert.deepEqual(Object.keys(dependencies), ['hash5', 'time']);
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

        assert.deepEqual(Object.keys(dependencies), ['hash', 'ENV']);
      });

      test('and instanciate services once', async () => {
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
        const timeServiceStub = sinon.spy(timeService);

        $.register(constant('ENV', ENV));
        $.register(service(timeServiceStub, 'time'));
        $.register(provider(hashProvider, 'hash', ['hash1', 'hash2', 'hash3']));
        $.register(
          provider(hashProvider, 'hash_', ['hash1', 'hash2', 'hash3']),
        );

        const dependencies = await $.run<any>(['hash', 'hash_', 'hash3']);

        assert.deepEqual(timeServiceStub.args, [[{}]]);
        assert.deepEqual(Object.keys(dependencies), ['hash', 'hash_', 'hash3']);
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

        assert.deepEqual(Object.keys(dependencies), ['nullService']);
        assert.deepEqual(dependencies, {
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

        assert.deepEqual(Object.keys(dependencies), ['nullProvider']);
        assert.deepEqual(dependencies, {
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

        assert.deepEqual(Object.keys(dependencies), [
          'undefinedService',
          'undefinedProvider',
        ]);
        assert.deepEqual(dependencies, {
          undefinedService: undefined,
          undefinedProvider: null,
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

        assert.deepEqual(Object.keys(dependencies), ['test']);
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

        assert.deepEqual(Object.keys(dependencies), ['test', 'log']);
      });
    });

    describe('should fail', () => {
      test('when autoload does not exists', async () => {
        try {
          await $.run<any>(['test']);
          throw new YError('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          assert.equal((err as YError).code, 'E_UNMATCHED_DEPENDENCY');
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
          assert.equal((err as YError).code, 'E_BAD_AUTOLOADED_INITIALIZER');
          assert.deepEqual((err as YError).params, ['test']);
          assert.equal(
            ((err as YError).wrappedErrors[0] as YError).code,
            'E_CANNOT_AUTOLOAD',
          );
          assert.deepEqual(
            ((err as YError).wrappedErrors[0] as YError).params,
            ['test'],
          );
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
          assert.equal((err as YError).code, 'E_BAD_AUTOLOADED_INITIALIZER');
          assert.deepEqual((err as YError).params, ['test']);
          assert.equal(
            ((err as YError).wrappedErrors[0] as YError).code,
            'E_BAD_AUTOLOADER_RESULT',
          );
          assert.deepEqual(
            ((err as YError).wrappedErrors[0] as YError).params,
            ['test', 'not_an_initializer'],
          );
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
          assert.equal((err as YError).code, 'E_BAD_AUTOLOADED_INITIALIZER');
          assert.deepEqual((err as YError).params, ['test']);
          assert.equal(
            ((err as YError).wrappedErrors[0] as YError).code,
            'E_AUTOLOADED_INITIALIZER_MISMATCH',
          );
          assert.deepEqual(
            ((err as YError).wrappedErrors[0] as YError).params,
            ['test', undefined],
          );
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
          assert.equal((err as YError).code, 'E_BAD_AUTOLOADED_INITIALIZER');
          assert.deepEqual((err as YError).params, ['test']);
          assert.equal(
            ((err as YError).wrappedErrors[0] as YError).code,
            'E_AUTOLOADED_INITIALIZER_MISMATCH',
          );
          assert.deepEqual(
            ((err as YError).wrappedErrors[0] as YError).params,
            ['test', 'not-test'],
          );
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
          assert.equal((err as YError).code, 'E_UNMATCHED_DEPENDENCY');
          assert.deepEqual((err as YError).params, ['__run__', 'test']);
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
      assert.deepEqual(Object.keys(dependencies), [
        'time',
        'hash',
        '$injector',
      ]);
      const injectDependencies = await dependencies.$injector([]);

      assert.deepEqual(Object.keys(injectDependencies), []);
      assert.deepEqual(injectDependencies, {});
    });

    test('should work with same dependencies then the running silo', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));

      const dependencies = await $.run<any>(['time', 'hash', '$injector']);
      assert.deepEqual(Object.keys(dependencies), [
        'time',
        'hash',
        '$injector',
      ]);

      const injectDependencies = await dependencies.$injector(['time', 'hash']);
      assert.deepEqual(Object.keys(injectDependencies), ['time', 'hash']);
      assert.deepEqual(injectDependencies, {
        hash: { ENV },
        time,
      });
    });

    test('should work with name mapping', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));

      const dependencies = await $.run<any>(['time', 'hash', '$injector']);
      assert.deepEqual(Object.keys(dependencies), [
        'time',
        'hash',
        '$injector',
      ]);

      const injectDependencies = await dependencies.$injector([
        'aTime>time',
        'aHash>hash',
      ]);
      assert.deepEqual(Object.keys(injectDependencies), ['aTime', 'aHash']);
      assert.deepEqual(injectDependencies, {
        aHash: { ENV },
        aTime: time,
      });
    });

    test('should work with non instanciated dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));

      const dependencies = await $.run<any>(['time', '$injector']);
      assert.deepEqual(Object.keys(dependencies), ['time', '$injector']);

      const injectDependencies = await dependencies.$injector(['time', 'hash']);
      assert.deepEqual(Object.keys(injectDependencies), ['time', 'hash']);
      assert.deepEqual(injectDependencies, {
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

      assert.notEqual(hash, sameHash);

      const { hash: yaSameHash } = await $.run<any>(['hash']);

      assert.notEqual(hash, yaSameHash);
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
      assert.equal(hash, sameHash);
      assert.equal(hash2, sameHash2);

      const { hash: yaSameHash } = await $.run<any>(['hash']);

      assert.equal(hash, yaSameHash);
    });
  });

  describe('destroy', () => {
    test('should work even with one silo and no dependencies', async () => {
      assert.equal(typeof $.destroy, 'function');
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

      assert.equal(typeof dependencies.$instance.destroy, 'function');

      await $.destroy();
    });

    test('should work when trigered from several silos simultaneously', async () => {
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

      assert.equal(typeof dependencies.$instance.destroy, 'function');

      await dependencies.$instance.destroy();

      try {
        await $.run<any>(['ENV', 'hash', 'hash1']);
        throw new YError('E_UNEXPECTED_SUCCES');
      } catch (err) {
        assert.equal((err as YError).code, 'E_INSTANCE_DESTROYED');
      }
    });
  });

  describe('$dispose', () => {
    test('should work with no dependencies', async () => {
      const dependencies = await $.run<any>(['$dispose']);
      assert.equal(typeof dependencies.$dispose, 'function');

      return dependencies.$dispose();
    });

    test('should work with constant dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));

      const dependencies = await $.run<any>(['time', 'ENV', '$dispose']);
      assert.deepEqual(Object.keys(dependencies), ['time', 'ENV', '$dispose']);

      await dependencies.$dispose();
    });

    test('should work with simple dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));

      const dependencies = await $.run<any>(['time', 'hash', '$dispose']);
      assert.deepEqual(Object.keys(dependencies), ['time', 'hash', '$dispose']);

      await dependencies.$dispose();
    });

    test('should work with deeper dependencies', async () => {
      let shutdownCallResolve: (value?: unknown) => void;
      let shutdownResolve: (value?: unknown) => void;
      const shutdownCallPromise = new Promise((resolve) => {
        shutdownCallResolve = resolve;
      });
      const shutdownStub = sinon.spy(() => {
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
            }),
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
      assert.deepEqual(Object.keys(dependencies), [
        'hash5',
        'time',
        '$dispose',
        'shutdownChecker',
      ]);

      const finalPromise = shutdownCallPromise.then(() => {
        assert.deepEqual(shutdownStub.args, [[]]);
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
      const shutdownStub = sinon.spy(() => {
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
            }),
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
      assert.deepEqual(Object.keys(dependencies), [
        'hash1',
        'hash2',
        '$dispose',
        'shutdownChecker',
      ]);

      const finalPromise = shutdownCallPromise.then(() => {
        assert.deepEqual(shutdownStub.args, [[]]);
        shutdownResolve();
      });

      await dependencies.$dispose();
      await finalPromise;
    });

    test('should delay service shutdown to their deeper dependencies', async () => {
      const servicesShutdownCalls = sinon.spy(() => Promise.resolve());

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
      assert.deepEqual(Object.keys(dependencies), ['hash2', '$dispose']);
      await dependencies.$dispose();

      assert.deepEqual(servicesShutdownCalls.args, [
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

      assert.equal(dependencies.hash, hash);

      await dependencies.$dispose();

      const newDependencies = await $.run<any>(['time', 'hash']);
      assert.equal(newDependencies.hash, hash);
    });

    test('should shutdown singleton dependencies if not used elsewhere', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV'], true));

      const { hash, $dispose } = await $.run<any>(['time', 'hash', '$dispose']);

      await $dispose();

      const dependencies = await $.run<any>(['time', 'hash']);
      assert.notEqual(dependencies.hash, hash);
    });
  });

  describe('toMermaidGraph', () => {
    test('should print nothing when no dependency', () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      assert.equal($.toMermaidGraph(), '');
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
      assert.equal(
        $.toMermaidGraph(),
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
      assert.equal(
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
      assert.equal(
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
