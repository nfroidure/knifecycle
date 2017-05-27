import assert from 'assert';
import {
  reuseSpecialProps,
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
