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

  });

  describe('depends', () => {

    it('should allow to decorate service registration with dependencies', () => {
      $.service('hash', $.depends(['ENV'], hashProvider));
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

  });

});
