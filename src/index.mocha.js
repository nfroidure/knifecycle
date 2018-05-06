/* eslint max-nested-callbacks:0 */

import assert from 'assert';
import sinon from 'sinon';

import { Knifecycle, inject, options } from './index';

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

  describe('getInstance', () => {
    it('should return an instance', () => {
      assert(Knifecycle.getInstance());
    });

    it('should always return the same instance', () => {
      assert.equal(Knifecycle.getInstance(), Knifecycle.getInstance());
    });
  });

  describe('constant', () => {
    it('should register an object', () => {
      $.constant('ENV', ENV);
    });

    it('should register a function', () => {
      $.constant('time', time);
    });

    it('should fail with dependencies since it makes no sense', () => {
      assert.throws(() => {
        $.constant('time', inject(['hash3'], time));
      }, /E_CONSTANT_INJECTION/);
    });
  });

  describe('service', () => {
    it('should register service', () => {
      $.service('time', timeService);
    });
  });

  describe('provider', () => {
    it('should register provider', () => {
      $.provider('hash', hashProvider);
    });

    it('should fail with direct circular dependencies', () => {
      assert.throws(
        () => {
          $.provider('hash', inject(['hash'], hashProvider));
        },
        err => {
          assert.deepEqual(err.code, 'E_CIRCULAR_DEPENDENCY');
          assert.deepEqual(err.params, ['hash']);
          return true;
        },
      );
    });

    it('should fail with direct circular dependencies on mapped services', () => {
      assert.throws(
        () => {
          $.provider('hash', inject(['hash>lol'], hashProvider));
        },
        err => {
          assert.deepEqual(err.code, 'E_CIRCULAR_DEPENDENCY');
          assert.deepEqual(err.params, ['hash']);
          return true;
        },
      );
    });

    it('should fail with circular dependencies', () => {
      assert.throws(
        () => {
          $.provider('hash', inject(['hash3'], hashProvider));
          $.provider('hash1', inject(['hash'], hashProvider));
          $.provider('hash2', inject(['hash1'], hashProvider));
          $.provider('hash3', inject(['hash'], hashProvider));
        },
        err => {
          assert.deepEqual(err.code, 'E_CIRCULAR_DEPENDENCY');
          assert.deepEqual(err.params, ['hash3', 'hash', 'hash3']);
          return true;
        },
      );
    });

    it('should fail with deeper circular dependencies', () => {
      assert.throws(
        () => {
          $.provider('hash', inject(['hash1'], hashProvider));
          $.provider('hash1', inject(['hash2'], hashProvider));
          $.provider('hash2', inject(['hash3'], hashProvider));
          $.provider('hash3', inject(['hash'], hashProvider));
        },
        err => {
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
          $.provider('hash', inject(['hash3>aHash3'], hashProvider));
          $.provider('hash1', inject(['hash>aHash'], hashProvider));
          $.provider('hash2', inject(['hash1>aHash1'], hashProvider));
          $.provider('hash3', inject(['hash>aHash'], hashProvider));
        },
        err => {
          assert.deepEqual(err.code, 'E_CIRCULAR_DEPENDENCY');
          assert.deepEqual(err.params, ['hash3', 'hash>aHash', 'hash3>aHash3']);
          return true;
        },
      );
    });
  });

  describe('run', () => {
    it('should work with no dependencies', done => {
      $.run([])
        .then(dependencies => {
          assert.deepEqual(dependencies, {});
        })
        .then(() => done())
        .catch(done);
    });

    it('should work with constant dependencies', done => {
      $.constant('ENV', ENV);
      $.constant('time', time);

      $.run(['time', 'ENV'])
        .then(dependencies => {
          assert.deepEqual(Object.keys(dependencies), ['time', 'ENV']);
          assert.deepEqual(dependencies, {
            ENV,
            time,
          });
        })
        .then(() => done())
        .catch(done);
    });

    it('should work with service dependencies', done => {
      $.service(
        'sample',
        inject(['time'], function sampleService({ time }) {
          return Promise.resolve(typeof time);
        }),
      );
      $.constant('time', time);

      $.run(['sample'])
        .then(dependencies => {
          assert.deepEqual(Object.keys(dependencies), ['sample']);
          assert.deepEqual(dependencies, {
            sample: 'function',
          });
        })
        .then(() => done())
        .catch(done);
    });

    it('should work with simple dependencies', done => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV'], hashProvider));

      $.run(['time', 'hash'])
        .then(dependencies => {
          assert.deepEqual(Object.keys(dependencies), ['time', 'hash']);
          assert.deepEqual(dependencies, {
            hash: { ENV },
            time,
          });
        })
        .then(() => done())
        .catch(done);
    });

    it('should work with given optional dependencies', done => {
      $.constant('ENV', ENV);
      $.constant('DEBUG', {});
      $.constant('time', time);
      $.provider('hash', inject(['ENV', '?DEBUG'], hashProvider));

      $.run(['time', 'hash'])
        .then(dependencies => {
          assert.deepEqual(Object.keys(dependencies), ['time', 'hash']);
          assert.deepEqual(dependencies, {
            hash: { ENV, DEBUG: {} },
            time,
          });
        })
        .then(() => done())
        .catch(done);
    });

    it('should work with lacking optional dependencies', done => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV', '?DEBUG'], hashProvider));

      $.run(['time', 'hash'])
        .then(dependencies => {
          assert.deepEqual(Object.keys(dependencies), ['time', 'hash']);
          assert.deepEqual(dependencies, {
            hash: { ENV, DEBUG: {}.undef },
            time,
          });
        })
        .then(() => done())
        .catch(done);
    });

    it('should work with deeper dependencies', done => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV'], hashProvider));
      $.provider('hash1', inject(['hash'], hashProvider));
      $.provider('hash2', inject(['hash1'], hashProvider));
      $.provider('hash3', inject(['hash2'], hashProvider));
      $.provider('hash4', inject(['hash3'], hashProvider));
      $.provider('hash5', inject(['hash4'], hashProvider));

      $.run(['hash5', 'time'])
        .then(dependencies => {
          assert.deepEqual(Object.keys(dependencies), ['hash5', 'time']);
        })
        .then(() => done())
        .catch(done);
    });

    it('should instanciate services once', done => {
      const timeServiceStub = sinon.spy(timeService);

      $.constant('ENV', ENV);
      $.service('time', timeServiceStub);
      $.provider('hash', inject(['ENV', 'time'], hashProvider));
      $.provider('hash2', inject(['ENV', 'time'], hashProvider));
      $.provider('hash3', inject(['ENV', 'time'], hashProvider));

      $.run(['hash', 'hash2', 'hash3', 'time'])
        .then(dependencies => {
          assert.deepEqual(Object.keys(dependencies), [
            'hash',
            'hash2',
            'hash3',
            'time',
          ]);
          assert.deepEqual(timeServiceStub.args, [[{}]]);
        })
        .then(() => done())
        .catch(done);
    });

    it('should instanciate a single mapped service', done => {
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

      $.provider('mappedStub', inject(['stub2>mappedStub2'], providerStub));
      $.provider('mappedStub2', providerStub2);
      $.run(['stub>mappedStub'])
        .then(dependencies => {
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
        })
        .then(() => done())
        .catch(done);
    });

    it('should instanciate several services with mappings', done => {
      const timeServiceStub = sinon.spy(timeService);

      $.constant('ENV', ENV);
      $.service('aTime', timeServiceStub);
      $.provider('aHash', inject(['ENV', 'time>aTime'], hashProvider));
      $.provider('aHash2', inject(['ENV', 'hash>aHash'], hashProvider));
      $.provider('aHash3', inject(['ENV', 'hash>aHash'], hashProvider));

      $.run(['hash2>aHash2', 'hash3>aHash3', 'time>aTime'])
        .then(dependencies => {
          assert.deepEqual(Object.keys(dependencies), [
            'hash2',
            'hash3',
            'time',
          ]);
          assert.deepEqual(timeServiceStub.args, [[{}]]);
        })
        .then(() => done())
        .catch(done);
    });

    it('should fail with bad service', done => {
      $.service('lol', () => {});
      $.run(['lol'])
        .then(() => {
          throw new Error('E_UNEXPECTED_SUCCESS');
        })
        .catch(err => {
          assert.deepEqual(err.code, 'E_BAD_SERVICE_PROMISE');
          assert.deepEqual(err.params, ['lol']);
        })
        .then(() => done())
        .catch(done);
    });

    it('should fail with bad provider', done => {
      $.provider('lol', () => {});
      $.run(['lol'])
        .then(() => {
          throw new Error('E_UNEXPECTED_SUCCESS');
        })
        .catch(err => {
          assert.deepEqual(err.code, 'E_BAD_SERVICE_PROVIDER');
          assert.deepEqual(err.params, ['lol']);
        })
        .then(() => done())
        .catch(done);
    });

    it('should fail with bad service in a provider', done => {
      $.provider('lol', () => Promise.resolve());
      $.run(['lol'])
        .then(() => {
          throw new Error('E_UNEXPECTED_SUCCESS');
        })
        .catch(err => {
          assert.deepEqual(err.code, 'E_BAD_SERVICE_PROVIDER');
          assert.deepEqual(err.params, ['lol']);
        })
        .then(() => done())
        .catch(done);
    });

    it('should fail with undeclared dependencies', done => {
      $.run(['lol'])
        .then(() => {
          throw new Error('E_UNEXPECTED_SUCCESS');
        })
        .catch(err => {
          assert.deepEqual(err.code, 'E_UNMATCHED_DEPENDENCY');
          assert.deepEqual(err.params, ['lol']);
        })
        .then(() => done())
        .catch(done);
    });

    it('should fail with undeclared dependencies upstream', done => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV', 'hash2'], hashProvider));
      $.provider('hash2', inject(['ENV', 'lol'], hashProvider));

      $.run(['time', 'hash'])
        .then(() => {
          throw new Error('E_UNEXPECTED_SUCCESS');
        })
        .catch(err => {
          assert.deepEqual(err.code, 'E_UNMATCHED_DEPENDENCY');
          assert.deepEqual(err.params, ['hash', 'hash2', 'lol']);
        })
        .then(() => done())
        .catch(done);
    });

    it('should provide a fatal error handler', done => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV'], hashProvider));
      $.provider('db', inject(['ENV'], dbProvider));
      $.provider('process', inject(['$fatalError'], processProvider));

      function processProvider({ $fatalError }) {
        return Promise.resolve({
          service: {
            fatalErrorPromise: $fatalError.promise,
          },
        });
      }

      function dbProvider({ ENV }) {
        return Promise.resolve().then(() => {
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
        });
      }

      $.run(['time', 'hash', 'db', 'process'])
        .then(({ process, db }) => {
          process.fatalErrorPromise
            .then(() => {
              done(new Error('E_UNEXPECTED_SUCCESS'));
            })
            .catch(err => {
              assert.deepEqual(err.message, 'E_DB_ERROR');
            })
            .then(() => done())
            .catch(done);
          db.reject(new Error('E_DB_ERROR'));
        })
        .catch(done);
    });
  });

  describe('inject', () => {
    it('should work with no dependencies', done => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV'], hashProvider));

      $.run(['time', 'hash', '$injector'])
        .then(dependencies => {
          assert.deepEqual(Object.keys(dependencies), [
            'time',
            'hash',
            '$injector',
          ]);
          return dependencies.$injector([]).then(injectDependencies => {
            assert.deepEqual(Object.keys(injectDependencies), []);
            assert.deepEqual(injectDependencies, {});
          });
        })
        .then(() => done())
        .catch(done);
    });

    it('should work with same dependencies then the running silo', done => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV'], hashProvider));

      $.run(['time', 'hash', '$injector'])
        .then(dependencies => {
          assert.deepEqual(Object.keys(dependencies), [
            'time',
            'hash',
            '$injector',
          ]);
          return dependencies
            .$injector(['time', 'hash'])
            .then(injectDependencies => {
              assert.deepEqual(Object.keys(injectDependencies), [
                'time',
                'hash',
              ]);
              assert.deepEqual(injectDependencies, {
                hash: { ENV },
                time,
              });
            });
        })
        .then(() => done())
        .catch(done);
    });

    it('should fail with non instanciated dependencies', done => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV'], hashProvider));

      $.run(['time', '$injector'])
        .then(dependencies => {
          assert.deepEqual(Object.keys(dependencies), ['time', '$injector']);
          return dependencies.$injector(['time', 'hash']).catch(err => {
            assert.equal(err.code, 'E_BAD_INJECTION');
          });
        })
        .then(() => done())
        .catch(done);
    });

    it('should create dependencies when not declared as singletons', done => {
      $.constant('ENV', ENV);
      $.provider('hash', inject(['ENV'], hashProvider));

      Promise.all([$.run(['hash']), $.run(['hash'])])
        .then(([{ hash }, { hash: sameHash }]) => {
          assert.notEqual(hash, sameHash);
          return $.run(['hash']).then(({ hash: yaSameHash }) => {
            assert.notEqual(hash, yaSameHash);
          });
        })
        .then(() => done())
        .catch(done);
    });

    it('should reuse dependencies when declared as singletons', done => {
      $.constant('ENV', ENV);
      $.provider('hash', inject(['ENV'], hashProvider), {
        singleton: true,
      });
      $.provider(
        'hash2',
        inject(
          ['ENV'],
          options(
            {
              singleton: true,
            },
            hashProvider,
          ),
        ),
      );

      Promise.all([
        $.run(['hash']),
        $.run(['hash']),
        $.run(['hash2']),
        $.run(['hash2']),
      ])
        .then(([{ hash, hash2 }, { hash: sameHash, hash2: sameHash2 }]) => {
          assert.equal(hash, sameHash);
          assert.equal(hash2, sameHash2);
          return $.run(['hash']).then(({ hash: yaSameHash }) => {
            assert.equal(hash, yaSameHash);
          });
        })
        .then(() => done())
        .catch(done);
    });
  });

  describe('$destroy', () => {
    it('should work even with one silo and no dependencies', done => {
      $.run(['$destroy'])
        .then(dependencies => {
          assert.equal(typeof dependencies.$destroy, 'function');

          return dependencies.$destroy();
        })
        .then(() => done())
        .catch(done);
    });

    it('should work with several silos and dependencies', done => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV'], hashProvider), { singleton: true });
      $.provider('hash1', inject(['ENV'], hashProvider));
      $.provider('hash2', inject(['ENV'], hashProvider));

      Promise.all([
        $.run(['$destroy']),
        $.run(['ENV', 'hash', 'hash1', 'time']),
        $.run(['ENV', 'hash', 'hash2']),
      ])
        .then(([dependencies]) => {
          assert.equal(typeof dependencies.$destroy, 'function');

          return dependencies.$destroy();
        })
        .then(() => done())
        .catch(done);
    });

    it('should work when trigered from several silos simultaneously', done => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV'], hashProvider));
      $.provider('hash1', inject(['ENV'], hashProvider));
      $.provider('hash2', inject(['ENV'], hashProvider));

      Promise.all([
        $.run(['$destroy']),
        $.run(['$destroy', 'ENV', 'hash', 'hash1', 'time']),
        $.run(['$destroy', 'ENV', 'hash', 'hash2']),
      ])
        .then(dependenciesBuckets =>
          Promise.all(
            dependenciesBuckets.map(dependencies => dependencies.$destroy()),
          ),
        )
        .then(() => done())
        .catch(done);
    });

    it('should work when a silo shutdown is in progress', done => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV'], hashProvider));
      $.provider('hash1', inject(['ENV'], hashProvider));
      $.provider('hash2', inject(['ENV'], hashProvider));

      Promise.all([
        $.run(['$destroy']),
        $.run(['$dispose', 'ENV', 'hash', 'hash1', 'time']),
        $.run(['ENV', 'hash', 'hash2']),
      ])
        .then(([dependencies1, dependencies2]) =>
          Promise.all([dependencies2.$dispose(), dependencies1.$destroy()]),
        )
        .then(() => done())
        .catch(done);
    });

    it('should disallow new runs', done => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV'], hashProvider));
      $.provider('hash1', inject(['ENV'], hashProvider));

      $.run(['$destroy'])
        .then(dependencies => {
          assert.equal(typeof dependencies.$destroy, 'function');

          return dependencies.$destroy();
        })
        .then(() => {
          assert.throws(
            () => $.run(['ENV', 'hash', 'hash1']),
            err => {
              assert.equal(err.code, 'E_INSTANCE_DESTROYED');
              return true;
            },
          );
        })
        .then(() => done())
        .catch(done);
    });
  });

  describe('$dispose', () => {
    it('should work with no dependencies', done => {
      $.run(['$dispose'])
        .then(dependencies => {
          assert.equal(typeof dependencies.$dispose, 'function');

          return dependencies.$dispose();
        })
        .then(() => done())
        .catch(done);
    });

    it('should work with constant dependencies', done => {
      $.constant('ENV', ENV);
      $.constant('time', time);

      $.run(['time', 'ENV', '$dispose'])
        .then(dependencies => {
          assert.deepEqual(Object.keys(dependencies), [
            'time',
            'ENV',
            '$dispose',
          ]);

          return dependencies.$dispose();
        })
        .then(() => done())
        .catch(done);
    });

    it('should work with simple dependencies', done => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV'], hashProvider));

      $.run(['time', 'hash', '$dispose'])
        .then(dependencies => {
          assert.deepEqual(Object.keys(dependencies), [
            'time',
            'hash',
            '$dispose',
          ]);

          return dependencies.$dispose();
        })
        .then(() => done())
        .catch(done);
    });

    it('should work with deeper dependencies', done => {
      let shutdownCallResolve;
      let shutdownResolve;
      const shutdownCallPromise = new Promise(resolve => {
        shutdownCallResolve = resolve;
      });
      const shutdownStub = sinon.spy(() => {
        shutdownCallResolve();
        return new Promise(resolve => {
          shutdownResolve = resolve;
        });
      });

      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV'], hashProvider));
      $.provider('hash1', inject(['hash'], hashProvider));
      $.provider('hash2', inject(['hash1'], hashProvider));
      $.provider('hash3', inject(['hash2'], hashProvider));
      $.provider('hash4', inject(['hash3'], hashProvider));
      $.provider('hash5', inject(['hash4'], hashProvider));
      $.provider(
        'shutdownChecker',
        inject(['hash4'], () =>
          Promise.resolve({
            service: {
              shutdownStub,
              shutdownResolve,
            },
            dispose: shutdownStub,
          }),
        ),
      );

      $.run(['hash5', 'time', '$dispose', 'shutdownChecker'])
        .then(dependencies => {
          assert.deepEqual(Object.keys(dependencies), [
            'hash5',
            'time',
            '$dispose',
            'shutdownChecker',
          ]);

          shutdownCallPromise
            .then(() => {
              assert.deepEqual(shutdownStub.args, [[]]);
              shutdownResolve();
            })
            .catch(done);

          return dependencies.$dispose();
        })
        .then(done)
        .catch(done);
    });

    it('should work with deeper multi used dependencies', done => {
      let shutdownCallResolve;
      let shutdownResolve;
      const shutdownCallPromise = new Promise(resolve => {
        shutdownCallResolve = resolve;
      });
      const shutdownStub = sinon.spy(() => {
        shutdownCallResolve();
        return new Promise(resolve => {
          shutdownResolve = resolve;
        });
      });

      $.constant('ENV', ENV);
      $.provider('hash', inject(['ENV'], hashProvider));
      $.provider(
        'shutdownChecker',
        inject(['hash'], () =>
          Promise.resolve({
            service: {
              shutdownStub,
              shutdownResolve,
            },
            dispose: shutdownStub,
          }),
        ),
      );
      $.provider('hash1', inject(['shutdownChecker'], hashProvider));
      $.provider('hash2', inject(['shutdownChecker'], hashProvider));

      $.run(['hash1', 'hash2', '$dispose', 'shutdownChecker'])
        .then(dependencies => {
          assert.deepEqual(Object.keys(dependencies), [
            'hash1',
            'hash2',
            '$dispose',
            'shutdownChecker',
          ]);

          shutdownCallPromise
            .then(() => {
              assert.deepEqual(shutdownStub.args, [[]]);
              shutdownResolve();
            })
            .catch(done);

          return dependencies.$dispose();
        })
        .then(() => done())
        .catch(done);
    });

    it('should delay service shutdown to their deeper dependencies', done => {
      const servicesShutdownCalls = sinon.spy(() => Promise.resolve());

      $.provider('hash', () =>
        Promise.resolve({
          service: {},
          dispose: servicesShutdownCalls.bind(null, 'hash'),
        }),
      );
      $.provider(
        'hash1',
        inject(['hash'], () =>
          Promise.resolve({
            service: {},
            dispose: servicesShutdownCalls.bind(null, 'hash1'),
          }),
        ),
      );
      $.provider(
        'hash2',
        inject(['hash1', 'hash'], () =>
          Promise.resolve({
            service: {},
            dispose: servicesShutdownCalls.bind(null, 'hash2'),
          }),
        ),
      );

      $.run(['hash2', '$dispose'])
        .then(dependencies => {
          assert.deepEqual(Object.keys(dependencies), ['hash2', '$dispose']);
          return dependencies.$dispose();
        })
        .then(() => {
          assert.deepEqual(servicesShutdownCalls.args, [
            ['hash2'],
            ['hash1'],
            ['hash'],
          ]);
        })
        .then(() => done())
        .catch(done);
    });

    it('should not shutdown singleton dependencies if used elsewhere', done => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV'], hashProvider), {
        singleton: true,
      });

      $.run(['time', 'hash'])
        .then(dependencies => {
          const { hash } = dependencies;

          return $.run(['time', 'hash', '$dispose']).then(dependencies => {
            assert.equal(dependencies.hash, hash);
            return dependencies.$dispose().then(() =>
              $.run(['time', 'hash']).then(dependencies => {
                assert.equal(dependencies.hash, hash);
              }),
            );
          });
        })
        .then(() => done())
        .catch(done);
    });

    it('should shutdown singleton dependencies if not used elsewhere', done => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV'], hashProvider), {
        singleton: true,
      });

      $.run(['time', 'hash', '$dispose'])
        .then(dependencies => {
          const { hash } = dependencies;

          return dependencies.$dispose().then(() =>
            $.run(['time', 'hash']).then(dependencies => {
              assert.notEqual(dependencies.hash, hash);
            }),
          );
        })
        .then(() => done())
        .catch(done);
    });
  });

  describe('toMermaidGraph', () => {
    it('should print nothing when no dependency', () => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      assert.equal($.toMermaidGraph(), '');
    });

    it('should print a dependency graph', () => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV'], hashProvider));
      $.provider('hash1', inject(['hash'], hashProvider));
      $.provider('hash2', inject(['hash1'], hashProvider));
      $.provider('hash3', inject(['hash2'], hashProvider));
      $.provider('hash4', inject(['hash3'], hashProvider));
      $.provider('hash5', inject(['hash4'], hashProvider));
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
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV'], hashProvider));
      $.provider('hash1', inject(['hash'], hashProvider));
      $.provider('hash2', inject(['hash1'], hashProvider));
      $.provider('hash3', inject(['hash2'], hashProvider));
      $.provider('hash4', inject(['hash3'], hashProvider));
      $.provider('hash5', inject(['hash4'], hashProvider));
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
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', inject(['ENV'], hashProvider));
      $.provider('hash1', inject(['hash'], hashProvider));
      $.provider('hash2', inject(['hash1'], hashProvider));
      $.provider('hash3', inject(['hash2'], hashProvider));
      $.provider('hash4', inject(['hash3'], hashProvider));
      $.provider('hash5', inject(['hash4'], hashProvider));
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
