/* eslint max-nested-callbacks:0 */

import assert from 'assert';
import sinon from 'sinon';
import YError from 'yerror';

import {
  SPECIAL_PROPS,
  Knifecycle,
  initializer,
  inject,
  constant,
  service,
  provider,
} from './index';
import { ALLOWED_INITIALIZER_TYPES } from './util';

describe('Knifecycle', () => {
  let $;
  const ENV = {
    MY_ENV_VAR: 'plop',
  };
  const time = Date.now.bind(Date);

  function timeService() {
    return Promise.resolve(time);
  }

  function hashProvider(hash) {
    return Promise.resolve({
      service: hash,
    });
  }

  beforeEach(() => {
    $ = new Knifecycle();
  });

  describe('register', () => {
    describe('with constants', () => {
      it('should work with an object', () => {
        $.register(constant('ENV', ENV));
      });

      it('should work with a function', () => {
        $.register(constant('time', time));
      });

      it('should work when overriding a previously set constant', async () => {
        $.register(constant('TEST', 1));
        $.register(constant('TEST', 2));
        assert.deepEqual(await $.run(['TEST']), { TEST: 2 });
      });

      it('should fail when overriding an initialized constant', async () => {
        $.register(constant('TEST', 1));
        assert.deepEqual(await $.run(['TEST']), { TEST: 1 });

        try {
          $.register(constant('TEST', 2));
          throw new YError('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          assert.equal(err.code, 'E_INITIALIZER_ALREADY_INSTANCIATED');
        }
      });
    });

    describe('with services', () => {
      it('should  work with a service', () => {
        $.register(service(timeService, 'time'));
      });

      it('should work when overriding a previously set service', async () => {
        $.register(service(async () => () => 1, 'test'));
        $.register(service(async () => () => 2, 'test'));

        const { test } = await $.run(['test']);
        assert.deepEqual(test(), 2);
      });

      it('should fail when overriding an initialized service', async () => {
        $.register(service(async () => () => 1, 'test'));
        const { test } = await $.run(['test']);
        assert.deepEqual(test(), 1);

        try {
          $.register(service(async () => () => 2, 'test'));
          throw new YError('E_UNEXPECTED_SUCCESS');
        } catch (err) {
          assert.equal(err.code, 'E_INITIALIZER_ALREADY_INSTANCIATED');
        }
      });
    });

    describe('with providers', () => {
      it('should  work with a provider', () => {
        $.register(service(hashProvider, 'hash'));
      });

      it('should work when overriding a previously set provider', async () => {
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

        const { test } = await $.run(['test']);
        assert.deepEqual(test, 2);
      });

      it('should work when overriding a previously set singleton provider', async () => {
        $.register(
          initializer(
            {
              type: 'provider',
              name: 'test',
              inject: [],
              options: { singleton: true },
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

        const { test } = await $.run(['test']);
        assert.deepEqual(test, 2);
      });

      it('should fail when overriding an initialized provider', async () => {
        $.register(
          initializer(
            {
              type: 'provider',
              name: 'test',
              inject: [],
              options: { singleton: true },
            },
            async () => ({
              service: 1,
            }),
          ),
        );

        const { test } = await $.run(['test']);
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
          assert.equal(err.code, 'E_INITIALIZER_ALREADY_INSTANCIATED');
        }
      });
    });

    it('should fail when intitializer is no a function', () => {
      assert.throws(
        () => {
          $.register('not_a_function');
        },
        (err) => {
          assert.deepEqual(err.code, 'E_BAD_INITIALIZER');
          assert.deepEqual(err.params, ['not_a_function']);
          return true;
        },
      );
    });

    it('should fail with no service name', () => {
      assert.throws(
        () => {
          $.register(() => {});
        },
        (err) => {
          assert.deepEqual(err.code, 'E_ANONYMOUS_ANALYZER');
          assert.deepEqual(err.params, []);
          return true;
        },
      );
    });

    it('should fail with a bad service type', () => {
      assert.throws(
        () => {
          const fn = () => {};
          fn[SPECIAL_PROPS.NAME] = 'test';
          fn[SPECIAL_PROPS.TYPE] = 'not_allowed_type';
          $.register(fn);
        },
        (err) => {
          assert.deepEqual(err.code, 'E_BAD_INITIALIZER_TYPE');
          assert.deepEqual(err.params, [
            'test',
            'not_allowed_type',
            ALLOWED_INITIALIZER_TYPES,
          ]);
          return true;
        },
      );
    });

    it('should fail with an undefined constant', () => {
      assert.throws(
        () => {
          const fn = () => {};
          fn[SPECIAL_PROPS.NAME] = 'THE_NUMBER';
          fn[SPECIAL_PROPS.TYPE] = 'constant';
          fn[SPECIAL_PROPS.VALUE] = {}.undef;
          fn[SPECIAL_PROPS.OPTIONS] = { singleton: true };
          $.register(fn);
        },
        (err) => {
          assert.deepEqual(err.code, 'E_UNDEFINED_CONSTANT_INITIALIZER');
          assert.deepEqual(err.params, ['THE_NUMBER']);
          return true;
        },
      );
    });

    it('should fail with a constant that is not a singleton', () => {
      assert.throws(
        () => {
          const fn = () => {};
          fn[SPECIAL_PROPS.NAME] = 'THE_NUMBER';
          fn[SPECIAL_PROPS.TYPE] = 'constant';
          fn[SPECIAL_PROPS.VALUE] = NaN;
          fn[SPECIAL_PROPS.OPTIONS] = { singleton: false };
          $.register(fn);
        },
        (err) => {
          assert.deepEqual(err.code, 'E_NON_SINGLETON_CONSTANT_INITIALIZER');
          assert.deepEqual(err.params, ['THE_NUMBER']);
          return true;
        },
      );
    });

    it('should fail with a non constant that has a value', () => {
      assert.throws(
        () => {
          const fn = () => {};
          fn[SPECIAL_PROPS.NAME] = 'myService';
          fn[SPECIAL_PROPS.TYPE] = 'service';
          fn[SPECIAL_PROPS.VALUE] = 42;
          $.register(fn);
        },
        (err) => {
          assert.deepEqual(err.code, 'E_BAD_VALUED_NON_CONSTANT_INITIALIZER');
          assert.deepEqual(err.params, ['myService']);
          return true;
        },
      );
    });

    it('should fail with special autoload intitializer that is not a singleton', () => {
      assert.throws(
        () => {
          $.register(
            initializer(
              {
                name: '$autoload',
                type: 'provider',
              },
              () => {},
            ),
          );
        },
        (err) => {
          assert.deepEqual(err.code, 'E_BAD_AUTOLOADER');
          assert.deepEqual(err.params, [{}]);
          return true;
        },
      );
    });
  });

  describe('provider', () => {
    it('should register provider', () => {
      $.register(provider(hashProvider, 'hash'));
    });

    it('should fail with direct circular dependencies', () => {
      assert.throws(
        () => {
          $.register(provider(hashProvider, 'hash', ['hash']));
        },
        (err) => {
          assert.deepEqual(err.code, 'E_CIRCULAR_DEPENDENCY');
          assert.deepEqual(err.params, ['hash']);
          return true;
        },
      );
    });

    it('should fail with direct circular dependencies on mapped services', () => {
      assert.throws(
        () => {
          $.register(provider(hashProvider, 'hash', ['hash>lol']));
        },
        (err) => {
          assert.deepEqual(err.code, 'E_CIRCULAR_DEPENDENCY');
          assert.deepEqual(err.params, ['hash']);
          return true;
        },
      );
    });

    it('should fail with circular dependencies', () => {
      assert.throws(
        () => {
          $.register(provider(inject(['hash3'], hashProvider), 'hash'));
          $.register(provider(inject(['hash'], hashProvider), 'hash1'));
          $.register(provider(inject(['hash1'], hashProvider), 'hash2'));
          $.register(provider(inject(['hash'], hashProvider), 'hash3'));
        },
        (err) => {
          assert.deepEqual(err.code, 'E_CIRCULAR_DEPENDENCY');
          assert.deepEqual(err.params, ['hash3', 'hash', 'hash3']);
          return true;
        },
      );
    });

    it('should fail with deeper circular dependencies', () => {
      assert.throws(
        () => {
          $.register(provider(inject(['hash1'], hashProvider), 'hash'));
          $.register(provider(inject(['hash2'], hashProvider), 'hash1'));
          $.register(provider(inject(['hash3'], hashProvider), 'hash2'));
          $.register(provider(inject(['hash'], hashProvider), 'hash3'));
        },
        (err) => {
          assert.deepEqual(err.code, 'E_CIRCULAR_DEPENDENCY');
          assert.deepEqual(err.params, [
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

    it('should fail with circular dependencies on mapped services', () => {
      assert.throws(
        () => {
          $.register(provider(inject(['hash3>aHash3'], hashProvider), 'hash'));
          $.register(provider(inject(['hash>aHash'], hashProvider), 'hash1'));
          $.register(provider(inject(['hash1>aHash1'], hashProvider), 'hash2'));
          $.register(provider(inject(['hash>aHash'], hashProvider), 'hash3'));
        },
        (err) => {
          assert.deepEqual(err.code, 'E_CIRCULAR_DEPENDENCY');
          assert.deepEqual(err.params, ['hash3', 'hash>aHash', 'hash3>aHash3']);
          return true;
        },
      );
    });
  });

  describe('run', () => {
    it('should work with no dependencies', async () => {
      const dependencies = await $.run([]);

      assert.deepEqual(dependencies, {});
    });

    it('should work with constant dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));

      const dependencies = await $.run(['time', 'ENV']);

      assert.deepEqual(Object.keys(dependencies), ['time', 'ENV']);
      assert.deepEqual(dependencies, {
        ENV,
        time,
      });
    });

    it('should work with service dependencies', async () => {
      $.register(
        service(
          inject(['time'], function sampleService({ time }) {
            return Promise.resolve(typeof time);
          }),
          'sample',
        ),
      );
      $.register(constant('time', time));

      const dependencies = await $.run(['sample']);

      assert.deepEqual(Object.keys(dependencies), ['sample']);
      assert.deepEqual(dependencies, {
        sample: 'function',
      });
    });

    it('should work with simple dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));

      const dependencies = await $.run(['time', 'hash']);

      assert.deepEqual(Object.keys(dependencies), ['time', 'hash']);
      assert.deepEqual(dependencies, {
        hash: { ENV },
        time,
      });
    });

    it('should work with given optional dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('DEBUG', {}));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV', '?DEBUG']));

      const dependencies = await $.run(['time', 'hash']);

      assert.deepEqual(Object.keys(dependencies), ['time', 'hash']);
      assert.deepEqual(dependencies, {
        hash: { ENV, DEBUG: {} },
        time,
      });
    });

    it('should work with lacking optional dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV', '?DEBUG']));

      const dependencies = await $.run(['time', 'hash']);

      assert.deepEqual(Object.keys(dependencies), ['time', 'hash']);
      assert.deepEqual(dependencies, {
        hash: { ENV, DEBUG: {}.undef },
        time,
      });
    });

    it('should work with deeper dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));
      $.register(provider(hashProvider, 'hash1', ['hash']));
      $.register(provider(hashProvider, 'hash2', ['hash1']));
      $.register(provider(hashProvider, 'hash3', ['hash2']));
      $.register(provider(hashProvider, 'hash4', ['hash3']));
      $.register(provider(hashProvider, 'hash5', ['hash4']));

      const dependencies = await $.run(['hash5', 'time']);

      assert.deepEqual(Object.keys(dependencies), ['hash5', 'time']);
    });

    it('should instanciate services once', async () => {
      const timeServiceStub = sinon.spy(timeService);

      $.register(constant('ENV', ENV));
      $.register(service(timeServiceStub, 'time'));
      $.register(provider(hashProvider, 'hash', ['ENV', 'time']));
      $.register(provider(hashProvider, 'hash2', ['ENV', 'time']));
      $.register(provider(hashProvider, 'hash3', ['ENV', 'time']));

      const dependencies = await $.run(['hash', 'hash2', 'hash3', 'time']);

      assert.deepEqual(Object.keys(dependencies), [
        'hash',
        'hash2',
        'hash3',
        'time',
      ]);
      assert.deepEqual(timeServiceStub.args, [[{}]]);
    });

    it('should instanciate a single mapped service', async () => {
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

      const dependencies = await $.run(['stub>mappedStub']);

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

    it('should instanciate several services with mappings', async () => {
      const timeServiceStub = sinon.spy(timeService);

      $.register(constant('ENV', ENV));
      $.register(service(timeServiceStub, 'aTime'));
      $.register(provider(hashProvider, 'aHash', ['ENV', 'time>aTime']));
      $.register(provider(hashProvider, 'aHash2', ['ENV', 'hash>aHash']));
      $.register(provider(hashProvider, 'aHash3', ['ENV', 'hash>aHash']));

      const dependencies = await $.run([
        'hash2>aHash2',
        'hash3>aHash3',
        'time>aTime',
      ]);

      assert.deepEqual(Object.keys(dependencies), ['hash2', 'hash3', 'time']);
      assert.deepEqual(timeServiceStub.args, [[{}]]);
    });

    it('should fail with bad service', async () => {
      $.register(service(() => {}, 'lol'));

      try {
        await $.run(['lol']);
        throw new Error('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        assert.deepEqual(err.code, 'E_BAD_SERVICE_PROMISE');
        assert.deepEqual(err.params, ['lol']);
      }
    });

    it('should fail with bad provider', async () => {
      $.register(provider(() => {}, 'lol'));
      try {
        await $.run(['lol']);
        throw new Error('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        assert.deepEqual(err.code, 'E_BAD_SERVICE_PROVIDER');
        assert.deepEqual(err.params, ['lol']);
      }
    });

    it('should fail with bad service in a provider', async () => {
      $.register(provider(() => Promise.resolve(), 'lol'));
      try {
        await $.run(['lol']);
        throw new Error('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        assert.deepEqual(err.code, 'E_BAD_SERVICE_PROVIDER');
        assert.deepEqual(err.params, ['lol']);
      }
    });

    it('should fail with undeclared dependencies', async () => {
      try {
        await $.run(['lol']);
        throw new Error('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        assert.deepEqual(err.code, 'E_UNMATCHED_DEPENDENCY');
        assert.deepEqual(err.params, ['lol']);
      }
    });

    it('should fail with undeclared dependencies upstream', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV', 'hash2']));
      $.register(provider(hashProvider, 'hash2', ['ENV', 'lol']));

      try {
        await $.run(['time', 'hash']);
        throw new Error('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        assert.deepEqual(err.code, 'E_UNMATCHED_DEPENDENCY');
        assert.deepEqual(err.params, ['hash', 'hash2', 'lol']);
      }
    });

    it('should provide a fatal error handler', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));
      $.register(provider(dbProvider, 'db', ['ENV']));
      $.register(provider(processProvider, 'process', ['$fatalError']));

      function processProvider({ $fatalError }) {
        return Promise.resolve({
          service: {
            fatalErrorPromise: $fatalError.promise,
          },
        });
      }

      async function dbProvider({ ENV }) {
        let service;
        const fatalErrorPromise = new Promise((resolve, reject) => {
          service = Promise.resolve({
            resolve,
            reject,
            ENV,
          });
        });

        return {
          service,
          fatalErrorPromise,
        };
      }

      const { process, db } = await $.run(['time', 'hash', 'db', 'process']);

      try {
        db.reject(new Error('E_DB_ERROR'));
        await process.fatalErrorPromise;
        throw new Error('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        assert.deepEqual(err.message, 'E_DB_ERROR');
      }
    });
  });

  describe('autoload', () => {
    it('should work with lacking autoloaded dependencies', async () => {
      $.register(
        initializer(
          {
            type: 'service',
            name: '$autoload',
            inject: [],
            options: {
              singleton: true,
            },
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
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV', '?DEBUG']));

      const dependencies = await $.run(['time', 'hash']);

      assert.deepEqual(Object.keys(dependencies), ['time', 'hash']);
      assert.deepEqual(dependencies, {
        hash: { ENV, DEBUG: 'THE_DEBUG:DEBUG' },
        time,
      });
    });

    it('should work with deeper several lacking dependencies', async () => {
      $.register(
        initializer(
          {
            name: '$autoload',
            type: 'service',
            options: {
              singleton: true,
            },
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

      const dependencies = await $.run(['hash5', 'time']);

      assert.deepEqual(Object.keys(dependencies), ['hash5', 'time']);
    });

    it('should work with various dependencies', async () => {
      $.register(provider(hashProvider, 'hash', ['hash2']));
      $.register(provider(hashProvider, 'hash3', ['?ENV']));
      $.register(constant('DEBUG', 1));
      $.register(
        initializer(
          {
            type: 'service',
            name: '$autoload',
            inject: ['?ENV', 'DEBUG'],
            options: {
              singleton: true,
            },
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

      const dependencies = await $.run(['hash', '?ENV']);

      assert.deepEqual(Object.keys(dependencies), ['hash', 'ENV']);
    });

    it('should instanciate services once', async () => {
      $.register(
        initializer(
          {
            name: '$autoload',
            type: 'service',
            options: {
              singleton: true,
            },
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
      $.register(provider(hashProvider, 'hash_', ['hash1', 'hash2', 'hash3']));

      const dependencies = await $.run(['hash', 'hash_', 'hash3']);

      assert.deepEqual(timeServiceStub.args, [[{}]]);
      assert.deepEqual(Object.keys(dependencies), ['hash', 'hash_', 'hash3']);
    });

    it('should fail when autoload does not exists', async () => {
      try {
        await $.run(['test']);
        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        assert.equal(err.code, 'E_UNMATCHED_DEPENDENCY');
      }
    });

    it('should fail when autoloaded dependencies are not found', async () => {
      $.register(
        initializer(
          {
            type: 'service',
            name: '$autoload',
            inject: [],
            options: {
              singleton: true,
            },
          },
          async () => async (serviceName) => {
            throw new YError('E_CANNOT_AUTOLOAD', serviceName);
          },
        ),
      );

      try {
        await $.run(['test']);
        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        assert.equal(err.code, 'E_CANNOT_AUTOLOAD');
        assert.deepEqual(err.params, ['test']);
      }
    });

    it('should fail when autoloaded dependencies are not initializers', async () => {
      $.register(
        initializer(
          {
            type: 'service',
            name: '$autoload',
            inject: [],
            options: {
              singleton: true,
            },
          },
          async () => async () => 'not_an_initializer',
        ),
      );

      try {
        await $.run(['test']);
        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        assert.equal(err.code, 'E_BAD_AUTOLOADED_INITIALIZER');
        assert.deepEqual(err.params, ['test', {}.undef]);
      }
    });

    it('should fail when autoloaded dependencies are not right initializers', async () => {
      $.register(
        initializer(
          {
            type: 'service',
            name: '$autoload',
            inject: [],
            options: {
              singleton: true,
            },
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
        await $.run(['test']);
        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        assert.equal(err.code, 'E_AUTOLOADED_INITIALIZER_MISMATCH');
        assert.deepEqual(err.params, ['test', 'not-test']);
      }
    });

    it('should fail when autoload depends on existing autoloaded dependencies', async () => {
      $.register(
        initializer(
          {
            type: 'service',
            name: '$autoload',
            inject: ['ENV'],
            options: {
              singleton: true,
            },
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
        await $.run(['test']);
        throw new YError('E_UNEXPECTED_SUCCESS');
      } catch (err) {
        assert.equal(err.code, 'E_AUTOLOADER_DYNAMIC_DEPENDENCY');
        assert.deepEqual(err.params, ['ENV']);
      }
    });

    it('should work when autoload depends on optional and unexisting autoloaded dependencies', async () => {
      $.register(
        initializer(
          {
            type: 'service',
            name: '$autoload',
            inject: ['?ENV'],
            options: {
              singleton: true,
            },
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

      const dependencies = await $.run(['test']);

      assert.deepEqual(Object.keys(dependencies), ['test']);
    });

    it.skip('should work when autoload depends on deeper optional and unexisting autoloaded dependencies', async () => {
      $.register(
        initializer(
          {
            type: 'service',
            name: 'log',
            inject: ['?LOG_ROUTING', '?LOGGER', '?debug'],
          },
          async () => {
            return function log() {};
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
            options: {
              singleton: true,
            },
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

      const dependencies = await $.run(['test', 'log']);

      assert.deepEqual(Object.keys(dependencies), ['test', 'log']);
    });
  });

  describe('$injector', () => {
    it('should work with no dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));

      const dependencies = await $.run(['time', 'hash', '$injector']);
      assert.deepEqual(Object.keys(dependencies), [
        'time',
        'hash',
        '$injector',
      ]);
      const injectDependencies = await dependencies.$injector([]);

      assert.deepEqual(Object.keys(injectDependencies), []);
      assert.deepEqual(injectDependencies, {});
    });

    it('should work with same dependencies then the running silo', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));

      const dependencies = await $.run(['time', 'hash', '$injector']);
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

    it('should work with name mapping', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));

      const dependencies = await $.run(['time', 'hash', '$injector']);
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

    it('should work with non instanciated dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));

      const dependencies = await $.run(['time', '$injector']);
      assert.deepEqual(Object.keys(dependencies), ['time', '$injector']);

      const injectDependencies = await dependencies.$injector(['time', 'hash']);
      assert.deepEqual(Object.keys(injectDependencies), ['time', 'hash']);
      assert.deepEqual(injectDependencies, {
        hash: { ENV },
        time,
      });
    });

    it('should create dependencies when not declared as singletons', async () => {
      $.register(constant('ENV', ENV));
      $.register(provider(hashProvider, 'hash', ['ENV']));

      const [{ hash }, { hash: sameHash }] = await Promise.all([
        $.run(['hash']),
        $.run(['hash']),
      ]);

      assert.notEqual(hash, sameHash);

      const { hash: yaSameHash } = await $.run(['hash']);

      assert.notEqual(hash, yaSameHash);
    });

    it('should reuse dependencies when declared as singletons', async () => {
      $.register(constant('ENV', ENV));
      $.register(
        provider(hashProvider, 'hash', ['ENV'], {
          singleton: true,
        }),
      );
      $.register(
        provider(hashProvider, 'hash2', ['ENV'], {
          singleton: true,
        }),
      );

      const [
        { hash, hash2 },
        { hash: sameHash, hash2: sameHash2 },
      ] = await Promise.all([
        $.run(['hash']),
        $.run(['hash']),
        $.run(['hash2']),
        $.run(['hash2']),
      ]);
      assert.equal(hash, sameHash);
      assert.equal(hash2, sameHash2);

      const { hash: yaSameHash } = await $.run(['hash']);

      assert.equal(hash, yaSameHash);
    });
  });

  describe('destroy', () => {
    it('should work even with one silo and no dependencies', async () => {
      assert.equal(typeof $.destroy, 'function');
      const dependencies = await $.run(['$instance']);

      await dependencies.$instance.destroy();
    });

    it('should work with several silos and dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(
        provider(hashProvider, 'hash', ['ENV'], {
          singleton: true,
        }),
      );
      $.register(provider(hashProvider, 'hash1', ['ENV']));
      $.register(provider(hashProvider, 'hash2', ['ENV']));

      const [dependencies] = await Promise.all([
        $.run(['$instance']),
        $.run(['ENV', 'hash', 'hash1', 'time']),
        $.run(['ENV', 'hash', 'hash2']),
      ]);

      assert.equal(typeof dependencies.$instance.destroy, 'function');

      await $.destroy();
    });

    it('should work when trigered from several silos simultaneously', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));
      $.register(provider(hashProvider, 'hash1', ['ENV']));
      $.register(provider(hashProvider, 'hash2', ['ENV']));

      const dependenciesBuckets = await Promise.all([
        $.run(['$instance']),
        $.run(['$instance', 'ENV', 'hash', 'hash1', 'time']),
        $.run(['$instance', 'ENV', 'hash', 'hash2']),
      ]);

      await Promise.all(
        dependenciesBuckets.map((dependencies) =>
          dependencies.$instance.destroy(),
        ),
      );
    });

    it('should work when a silo shutdown is in progress', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));
      $.register(provider(hashProvider, 'hash1', ['ENV']));
      $.register(provider(hashProvider, 'hash2', ['ENV']));

      const [dependencies1, dependencies2] = await Promise.all([
        $.run(['$instance']),
        $.run(['$dispose', 'ENV', 'hash', 'hash1', 'time']),
        $.run(['ENV', 'hash', 'hash2']),
      ]);
      await Promise.all([
        dependencies2.$dispose(),
        dependencies1.$instance.destroy(),
      ]);
    });

    it('should disallow new runs', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));
      $.register(provider(hashProvider, 'hash1', ['ENV']));

      const dependencies = await $.run(['$instance']);

      assert.equal(typeof dependencies.$instance.destroy, 'function');

      await dependencies.$instance.destroy();

      try {
        await $.run(['ENV', 'hash', 'hash1']);
        throw new YError('E_UNEXPECTED_SUCCES');
      } catch (err) {
        assert.equal(err.code, 'E_INSTANCE_DESTROYED');
      }
    });
  });

  describe('$dispose', () => {
    it('should work with no dependencies', async () => {
      const dependencies = await $.run(['$dispose']);
      assert.equal(typeof dependencies.$dispose, 'function');

      return dependencies.$dispose();
    });

    it('should work with constant dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));

      const dependencies = await $.run(['time', 'ENV', '$dispose']);
      assert.deepEqual(Object.keys(dependencies), ['time', 'ENV', '$dispose']);

      await dependencies.$dispose();
    });

    it('should work with simple dependencies', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(provider(hashProvider, 'hash', ['ENV']));

      const dependencies = await $.run(['time', 'hash', '$dispose']);
      assert.deepEqual(Object.keys(dependencies), ['time', 'hash', '$dispose']);

      await dependencies.$dispose();
    });

    it('should work with deeper dependencies', async () => {
      let shutdownCallResolve;
      let shutdownResolve;
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

      const dependencies = await $.run([
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

    it('should work with deeper multi used dependencies', async () => {
      let shutdownCallResolve;
      let shutdownResolve;
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

      const dependencies = await $.run([
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

    it('should delay service shutdown to their deeper dependencies', async () => {
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

      const dependencies = await $.run(['hash2', '$dispose']);
      assert.deepEqual(Object.keys(dependencies), ['hash2', '$dispose']);
      await dependencies.$dispose();

      assert.deepEqual(servicesShutdownCalls.args, [
        ['hash2'],
        ['hash1'],
        ['hash'],
      ]);
    });

    it('should not shutdown singleton dependencies if used elsewhere', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(
        provider(hashProvider, 'hash', ['ENV'], {
          singleton: true,
        }),
      );

      const { hash } = await $.run(['time', 'hash']);
      const dependencies = await $.run(['time', 'hash', '$dispose']);

      assert.equal(dependencies.hash, hash);

      await dependencies.$dispose();

      const newDependencies = await $.run(['time', 'hash']);
      assert.equal(newDependencies.hash, hash);
    });

    it('should shutdown singleton dependencies if not used elsewhere', async () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      $.register(
        provider(hashProvider, 'hash', ['ENV'], {
          singleton: true,
        }),
      );

      const { hash, $dispose } = await $.run(['time', 'hash', '$dispose']);

      await $dispose();

      const dependencies = await $.run(['time', 'hash']);
      assert.notEqual(dependencies.hash, hash);
    });
  });

  describe('toMermaidGraph', () => {
    it('should print nothing when no dependency', () => {
      $.register(constant('ENV', ENV));
      $.register(constant('time', time));
      assert.equal($.toMermaidGraph(), '');
    });

    it('should print a dependency graph', () => {
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

    it('should allow custom shapes', () => {
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

    it('should allow custom styles', () => {
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
