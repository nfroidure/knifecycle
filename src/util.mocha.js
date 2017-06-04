import assert from 'assert';
import sinon from 'sinon';
import {
  reuseSpecialProps,
  wrapInitializer,
  parseDependencyDeclaration,
} from './util';

describe('reuseSpecialProps', () => {
  it('should work', () => {
    // We can safely ignore coverage here since the
    // function are here just as placeholders
    /* istanbul ignore next */
    function from() { return 'from'; }
    /* istanbul ignore next */
    function to() { return 'to'; }

    from.$name = 'from';
    from.$type = 'service';
    from.$inject = ['ki', 'kooo', 'lol'];
    from.$options = { singleton: false };

    const newFn = reuseSpecialProps(from, to);

    assert.notEqual(newFn, to);
    assert.equal(newFn.$name, from.$name);
    assert.equal(newFn.$type, from.$type);
    assert.notEqual(newFn.$inject, from.$inject);
    assert.deepEqual(newFn.$inject, from.$inject);
    assert.notEqual(newFn.$options, from.$options);
    assert.deepEqual(newFn.$options, from.$options);

    const newFn2 = reuseSpecialProps(from, to, {
      $name: 'yolo',
    });

    assert.notEqual(newFn2, to);
    assert.equal(newFn2.$name, 'yolo');
    assert.equal(newFn2.$type, from.$type);
    assert.notEqual(newFn2.$inject, from.$inject);
    assert.deepEqual(newFn2.$inject, from.$inject);
    assert.notEqual(newFn2.$options, from.$options);
    assert.deepEqual(newFn2.$options, from.$options);
  });
});

describe('wrapInitializer', (done) => {
  it('should work', () => {
    function baseInitializer() {
      return Promise.resolve(() => 'test');
    }

    baseInitializer.$name = 'baseInitializer';
    baseInitializer.$type = 'service';
    baseInitializer.$inject = ['log'];
    baseInitializer.$options = { singleton: false };

    const log = sinon.stub();
    const newInitializer = wrapInitializer(
      ({ log }, service) => {
        log('Wrapping...');
        return () => service() + '-wrapped';
      },
      baseInitializer
    );

    newInitializer({ log })
    .then((service) => {
      assert.equal(service(), 'test-wrapped');
      assert.deepEqual(log.args, [['Wrapping...']]);
    })
    .then(done)
    .catch(done);
  });
});

describe('parseDependencyDeclaration', () => {
  it('should work', () => {
    assert.deepEqual(
      parseDependencyDeclaration('pgsql>db'), {
        serviceName: 'pgsql',
        mappedName: 'db',
        optional: false,
      });
  });
});
