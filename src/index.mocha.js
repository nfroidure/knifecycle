import assert from 'assert';
import sinon from 'sinon';

import Knifecycle from './index';

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
      servicePromise: Promise.resolve(hash),
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

  });

  describe('service', () => {

    it('should register service', () => {
      $.service('time', timeService);
    });

  });

  describe('provider', () => {

    it('should register provider', () => {
      $.service('hash', hashProvider);
    });

    it('should fail with circular dependencies', () => {
      try {
        $.provider('hash', $.depends(['hash3'], hashProvider));
        $.provider('hash1', $.depends(['hash'], hashProvider));
        $.provider('hash2', $.depends(['hash1'], hashProvider));
        $.provider('hash3', $.depends(['hash'], hashProvider));
      } catch (err) {
        assert.deepEqual(err.code, 'E_CIRCULAR_DEPENDENCY');
        assert.deepEqual(err.params, ['hash', 'hash3']);
      }
    });

    it('should fail with circular dependencies on mapped services', () => {
      try {
        $.provider('aHash', $.depends(['hash3:aHash3'], hashProvider));
        $.provider('aHash1', $.depends(['hash:aHash'], hashProvider));
        $.provider('aHash2', $.depends(['hash1:aHash1'], hashProvider));
        $.provider('aHash3', $.depends(['hash:aHash'], hashProvider));
      } catch (err) {
        assert.deepEqual(err.code, 'E_CIRCULAR_DEPENDENCY');
        assert.deepEqual(err.params, ['hash', 'hash3']);
      }
    });

  });

  describe('depends', () => {

    it('should allow to decorate service registration with dependencies', () => {
      $.service('hash', $.depends(['ENV'], hashProvider));
    });

    it('should allow to map services dependencies', () => {
      $.service('hash', $.depends(['ANOTHER_ENV:ENV'], hashProvider));
    });

  });

  describe('run', () => {

    it('should work with no dependencies', (done) => {
      $.run([])
      .then((dependencies) => {
        assert.deepEqual(dependencies, {});
        done();
      })
      .catch(done);
    });

    it('should work with constant dependencies', (done) => {
      $.constant('ENV', ENV);
      $.constant('time', time);

      $.run(['time', 'ENV'])
      .then((dependencies) => {
        assert.deepEqual(Object.keys(dependencies), ['time', 'ENV']);
        assert.deepEqual(dependencies, {
          ENV,
          time,
        });
        done();
      })
      .catch(done);
    });

    it('should work with service dependencies', (done) => {
      $.service('sample', $.depends(['time'], function sampleService({ time }) {
        return Promise.resolve(typeof time);
      }));
      $.constant('time', time);

      $.run(['sample'])
      .then((dependencies) => {
        assert.deepEqual(Object.keys(dependencies), ['sample']);
        assert.deepEqual(dependencies, {
          sample: 'function',
        });
        done();
      })
      .catch(done);
    });

    it('should work with simple dependencies', (done) => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', $.depends(['ENV'], hashProvider));

      $.run(['time', 'hash'])
      .then((dependencies) => {
        assert.deepEqual(Object.keys(dependencies), ['time', 'hash']);
        assert.deepEqual(dependencies, {
          hash: { ENV },
          time,
        });
        done();
      })
      .catch(done);
    });

    it('should work with deeper dependencies', (done) => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', $.depends(['ENV'], hashProvider));
      $.provider('hash1', $.depends(['hash'], hashProvider));
      $.provider('hash2', $.depends(['hash1'], hashProvider));
      $.provider('hash3', $.depends(['hash2'], hashProvider));
      $.provider('hash4', $.depends(['hash3'], hashProvider));
      $.provider('hash5', $.depends(['hash4'], hashProvider));

      $.run(['hash5', 'time'])
      .then((dependencies) => {
        assert.deepEqual(Object.keys(dependencies), ['hash5', 'time']);
        done();
      })
      .catch(done);
    });

    it('should instanciate services once', (done) => {
      const timeServiceStub = sinon.spy(timeService);

      $.constant('ENV', ENV);
      $.service('time', timeServiceStub);
      $.provider('hash', $.depends(['ENV', 'time'], hashProvider));
      $.provider('hash2', $.depends(['ENV', 'time'], hashProvider));
      $.provider('hash3', $.depends(['ENV', 'time'], hashProvider));

      $.run(['hash', 'hash2', 'hash3', 'time'])
      .then((dependencies) => {
        assert.deepEqual(Object.keys(dependencies), ['hash', 'hash2', 'hash3', 'time']);
        assert.deepEqual(timeServiceStub.args, [[{}]]);
        done();
      })
      .catch(done);
    });

    it('should instanciate services with mappings', (done) => {
      const timeServiceStub = sinon.spy(timeService);

      $.constant('ENV', ENV);
      $.service('aTime', timeServiceStub);
      $.provider('aHash', $.depends(['ENV', 'time:aTime'], hashProvider));
      $.provider('aHash2', $.depends(['ENV', 'hash:aHash'], hashProvider));
      $.provider('aHash3', $.depends(['ENV', 'hash:aHash'], hashProvider));

      $.run(['hash2:aHash2', 'hash3:aHash3', 'time:aTime'])
      .then((dependencies) => {
        assert.deepEqual(Object.keys(dependencies), ['hash2', 'hash3', 'time']);
        assert.deepEqual(timeServiceStub.args, [[{}]]);
        done();
      })
      .catch(done);
    });

    it('should fail with bad service', (done) => {
      $.service('lol', () => {});
      $.run(['lol'])
      .then(() => {
        done(new Error('E_UNEXPECTED_SUCCESS'));
      })
      .catch((err) => {
        assert.deepEqual(err.code, 'E_BAD_SERVICE_PROMISE');
        assert.deepEqual(err.params, ['lol']);
        done();
      })
      .catch(done);
    });

    it('should fail with bad provider', (done) => {
      $.provider('lol', () => {});
      $.run(['lol'])
      .then(() => {
        done(new Error('E_UNEXPECTED_SUCCESS'));
      })
      .catch((err) => {
        assert.deepEqual(err.code, 'E_BAD_SERVICE_PROVIDER');
        assert.deepEqual(err.params, ['lol']);
        done();
      })
      .catch(done);
    });

    it('should fail with bad service in a provider', (done) => {
      $.provider('lol', () => Promise.resolve({}));
      $.run(['lol'])
      .then(() => {
        done(new Error('E_UNEXPECTED_SUCCESS'));
      })
      .catch((err) => {
        assert.deepEqual(err.code, 'E_BAD_SERVICE_PROMISE');
        assert.deepEqual(err.params, ['lol']);
        done();
      })
      .catch(done);
    });

    it('should fail with undeclared dependencies', (done) => {
      $.run(['lol'])
      .then(() => {
        done(new Error('E_UNEXPECTED_SUCCESS'));
      })
      .catch((err) => {
        assert.deepEqual(err.code, 'E_UNMATCHED_DEPENDENCY');
        assert.deepEqual(err.params, ['lol']);
        done();
      })
      .catch(done);
    });

    it('should fail with undeclared dependencies upstream', (done) => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', $.depends(['ENV', 'hash2'], hashProvider));
      $.provider('hash2', $.depends(['ENV', 'lol'], hashProvider));

      $.run(['time', 'hash'])
      .then(() => {
        done(new Error('E_UNEXPECTED_SUCCESS'));
      })
      .catch((err) => {
        assert.deepEqual(err.code, 'E_UNMATCHED_DEPENDENCY');
        assert.deepEqual(err.params, ['hash', 'hash2', 'lol']);
        done();
      })
      .catch(done);
    });

    it('should provide a fatal error handler', (done) => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', $.depends(['ENV'], hashProvider));
      $.provider('db', $.depends(['ENV'], dbProvider));
      $.provider('process', $.depends(['$fatalError'], processProvider));

      function processProvider({ $fatalError }) {
        return Promise.resolve({
          servicePromise: Promise.resolve({
            fatalErrorPromise: $fatalError.promise,
          }),
        });
      }

      function dbProvider({ ENV }) {
        return Promise.resolve()
        .then(() => {
          let servicePromise;
          const errorPromise = new Promise((resolve, reject) => {
            servicePromise = Promise.resolve({
              resolve,
              reject,
              ENV,
            });
          });

          return {
            servicePromise,
            errorPromise,
          };
        });
      }

      $.run(['time', 'hash', 'db', 'process'])
      .then(({ process, db }) => {
        process.fatalErrorPromise
        .then(() => {
          done(new Error('E_UNEXPECTED_SUCCESS'));
        })
        .catch((err) => {
          assert.deepEqual(err.message, 'E_DB_ERROR');
          done();
        })
        .catch(done);
        db.reject(new Error('E_DB_ERROR'));
      })
      .catch(done);
    });

  });

  describe('inject', () => {

    it('should work with no dependencies', (done) => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', $.depends(['ENV'], hashProvider));

      $.run(['time', 'hash', '$inject'])
      .then((dependencies) => {
        assert.deepEqual(Object.keys(dependencies), ['time', 'hash', '$inject']);
        return dependencies.$inject([])
        .then((injectDependencies) => {
          assert.deepEqual(Object.keys(injectDependencies), []);
          assert.deepEqual(injectDependencies, {});

          done();
        });
      })
      .catch(done);

    });

    it('should work with same dependencies then the running silo', (done) => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', $.depends(['ENV'], hashProvider));

      $.run(['time', 'hash', '$inject'])
      .then((dependencies) => {
        assert.deepEqual(Object.keys(dependencies), ['time', 'hash', '$inject']);
        return dependencies.$inject(['time', 'hash'])
        .then((injectDependencies) => {
          assert.deepEqual(Object.keys(injectDependencies), ['time', 'hash']);
          assert.deepEqual(injectDependencies, {
            hash: { ENV },
            time,
          });

          done();
        });
      })
      .catch(done);

    });

    it('should fail with non instanciated dependencies', (done) => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', $.depends(['ENV'], hashProvider));

      $.run(['time', '$inject'])
      .then((dependencies) => {
        assert.deepEqual(Object.keys(dependencies), ['time', '$inject']);
        return dependencies.$inject(['time', 'hash'])
        .catch((err) => {
          assert.equal(err.code, 'E_BAD_INJECTION');
          done();
        });
      })
      .catch(done);

    });

  });

  describe('shutdown', () => {

    it('should work with no dependencies', (done) => {
      $.run(['$shutdown'])
      .then((dependencies) => {
        assert.equal(typeof dependencies.$shutdown, 'function');

        dependencies.$shutdown()
        .then(done)
        .catch(done);
      })
      .catch(done);
    });

    it('should work with constant dependencies', (done) => {
      $.constant('ENV', ENV);
      $.constant('time', time);

      $.run(['time', 'ENV', '$shutdown'])
      .then((dependencies) => {
        assert.deepEqual(Object.keys(dependencies), ['time', 'ENV', '$shutdown']);

        dependencies.$shutdown()
        .then(done)
        .catch(done);
      })
      .catch(done);
    });

    it('should work with simple dependencies', (done) => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', $.depends(['ENV'], hashProvider));

      $.run(['time', 'hash', '$shutdown'])
      .then((dependencies) => {
        assert.deepEqual(Object.keys(dependencies), ['time', 'hash', '$shutdown']);

        dependencies.$shutdown()
        .then(done)
        .catch(done);
      })
      .catch(done);
    });

    it('should work with deeper dependencies', (done) => {
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

      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', $.depends(['ENV'], hashProvider));
      $.provider('hash1', $.depends(['hash'], hashProvider));
      $.provider('hash2', $.depends(['hash1'], hashProvider));
      $.provider('hash3', $.depends(['hash2'], hashProvider));
      $.provider('hash4', $.depends(['hash3'], hashProvider));
      $.provider('hash5', $.depends(['hash4'], hashProvider));
      $.provider('shutdownChecker', $.depends(['hash4'], () => Promise.resolve({
        servicePromise: Promise.resolve({
          shutdownStub,
          shutdownResolve,
        }),
        shutdownProvider: shutdownStub,
      })));

      $.run(['hash5', 'time', '$shutdown', 'shutdownChecker'])
      .then((dependencies) => {
        assert.deepEqual(Object.keys(dependencies), [
          'hash5', 'time', '$shutdown', 'shutdownChecker',
        ]);

        shutdownCallPromise.then(() => {
          assert.deepEqual(shutdownStub.args, [[]]);
          shutdownResolve();
        })
        .catch(done);

        return dependencies.$shutdown();
      })
      .then(done)
      .catch(done);
    });

    it('should work with deeper multi used dependencies', (done) => {
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

      $.constant('ENV', ENV);
      $.provider('hash', $.depends(['ENV'], hashProvider));
      $.provider('shutdownChecker', $.depends(['hash'], () => Promise.resolve({
        servicePromise: Promise.resolve({
          shutdownStub,
          shutdownResolve,
        }),
        shutdownProvider: shutdownStub,
      })));
      $.provider('hash1', $.depends(['shutdownChecker'], hashProvider));
      $.provider('hash2', $.depends(['shutdownChecker'], hashProvider));

      $.run(['hash1', 'hash2', '$shutdown', 'shutdownChecker'])
      .then((dependencies) => {
        assert.deepEqual(Object.keys(dependencies), [
          'hash1', 'hash2', '$shutdown', 'shutdownChecker',
        ]);

        shutdownCallPromise.then(() => {
          assert.deepEqual(shutdownStub.args, [[]]);
          shutdownResolve();
        })
        .catch(done);

        return dependencies.$shutdown();
      })
      .then(done)
      .catch(done);
    });

    it('should delay service shutdown to their deeper dependencies', (done) => {
      const servicesShutdownCalls = sinon.spy(() => Promise.resolve());

      $.provider('hash', () => Promise.resolve({
        servicePromise: Promise.resolve({}),
        shutdownProvider: servicesShutdownCalls.bind(null, 'hash'),
      }));
      $.provider('hash1', $.depends(['hash'], () => Promise.resolve({
        servicePromise: Promise.resolve({}),
        shutdownProvider: servicesShutdownCalls.bind(null, 'hash1'),
      })));
      $.provider('hash2', $.depends(['hash1', 'hash'], () => Promise.resolve({
        servicePromise: Promise.resolve({}),
        shutdownProvider: servicesShutdownCalls.bind(null, 'hash2'),
      })));

      $.run(['hash2', '$shutdown'])
      .then((dependencies) => {
        assert.deepEqual(Object.keys(dependencies), [
          'hash2', '$shutdown',
        ]);
        return dependencies.$shutdown();
      })
      .then(() => {
        assert.deepEqual(servicesShutdownCalls.args, [[
          'hash2',
        ], [
          'hash1',
        ], [
          'hash',
        ]]);
      })
      .then(done)
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
      $.provider('hash', $.depends(['ENV'], hashProvider));
      $.provider('hash1', $.depends(['hash'], hashProvider));
      $.provider('hash2', $.depends(['hash1'], hashProvider));
      $.provider('hash3', $.depends(['hash2'], hashProvider));
      $.provider('hash4', $.depends(['hash3'], hashProvider));
      $.provider('hash5', $.depends(['hash4'], hashProvider));
      assert.equal($.toMermaidGraph(),
        'graph TD\n' +
        '  hash-->ENV\n' +
        '  hash1-->hash\n' +
        '  hash2-->hash1\n' +
        '  hash3-->hash2\n' +
        '  hash4-->hash3\n' +
        '  hash5-->hash4'
      );
    });

    it('should allow custom shapes', () => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', $.depends(['ENV'], hashProvider));
      $.provider('hash1', $.depends(['hash'], hashProvider));
      $.provider('hash2', $.depends(['hash1'], hashProvider));
      $.provider('hash3', $.depends(['hash2'], hashProvider));
      $.provider('hash4', $.depends(['hash3'], hashProvider));
      $.provider('hash5', $.depends(['hash4'], hashProvider));
      assert.equal($.toMermaidGraph({
        shapes: [{
          pattern: /^hash([0-9]+)$/,
          template: '$0(($1))',
        }, {
          pattern: /^[A-Z_]+$/,
          template: '$0{$0}',
        }, {
          pattern: /^.+$/,
          template: '$0[$0]',
        }],
      }),
        'graph TD\n' +
        '  hash[hash]-->ENV{ENV}\n' +
        '  hash1((1))-->hash[hash]\n' +
        '  hash2((2))-->hash1((1))\n' +
        '  hash3((3))-->hash2((2))\n' +
        '  hash4((4))-->hash3((3))\n' +
        '  hash5((5))-->hash4((4))'
      );
    });

    it('should allow custom styles', () => {
      $.constant('ENV', ENV);
      $.constant('time', time);
      $.provider('hash', $.depends(['ENV'], hashProvider));
      $.provider('hash1', $.depends(['hash'], hashProvider));
      $.provider('hash2', $.depends(['hash1'], hashProvider));
      $.provider('hash3', $.depends(['hash2'], hashProvider));
      $.provider('hash4', $.depends(['hash3'], hashProvider));
      $.provider('hash5', $.depends(['hash4'], hashProvider));
      assert.equal($.toMermaidGraph({
        classes: {
          exotic: 'fill:#f9f,stroke:#333,stroke-width:4px;',
        },
        styles: [{
          pattern: /^hash([0-9]+)$/,
          className: 'exotic',
        }],
        shapes: [{
          pattern: /^hash([0-9]+)$/,
          template: '$0(($1))',
        }, {
          pattern: /^[A-Z_]+$/,
          template: '$0{$0}',
        }, {
          pattern: /^.+$/,
          template: '$0[$0]',
        }],
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
        '  class hash5 exotic;'
      );
    });

  });

});
