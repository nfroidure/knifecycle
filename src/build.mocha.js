import assert from 'assert';
import YError from 'yerror';
import buildInitializer from './build';
import {
  initializer,
} from './util';

describe('buildInitializer', () => {
  function aProvider() {}
  const mockedConstants = {
    NODE_ENV: 'development',
  };
  const mockedDepsHash = {
    dep1: initializer({
      inject: [],
      options: {},
      type: 'service',
      name: 'dep1',
    }, aProvider),
    dep2: initializer({
      inject: ['dep1', 'NODE_ENV'],
      options: {},
      type: 'initializer',
      name: 'dep2',
    }, aProvider),
    dep3: initializer({
      inject: ['dep2', 'dep1', '?depOpt'],
      options: {},
      type: 'service',
      name: 'dep3',
    }, aProvider),
  };
  function mockedLoader(name) {
    return mockedDepsHash[name] ?
      Promise.resolve({
        path: `./services/${name}`,
        initializer: mockedDepsHash[name],
      }) :
      Promise.reject(new YError('E_UNMATCHED_DEPENDENCY', name));
  }

  it('should build an initialization module', () =>
    buildInitializer(
      mockedConstants,
      mockedLoader,
      ['dep1', 'finalMappedDep>dep3']
    )
    .then((content) => {
      assert.equal(content,
  `
// Definition batch #0
import initDep1 from './services/dep1';
const NODE_ENV = "development";

// Definition batch #1
import initDep2 from './services/dep2';

// Definition batch #2
import initDep3 from './services/dep3';

export async function initialize(services = {}) {
  // Initialization batch #0
  services['dep1'] = await initDep1({
  });
  services['NODE_ENV'] = NODE_ENV;

  // Initialization batch #1
  services['dep2'] = await initDep2({
    dep1: services['dep1'],
    NODE_ENV: services['NODE_ENV'],
  });

  // Initialization batch #2
  services['dep3'] = await initDep3({
    dep2: services['dep2'],
    dep1: services['dep1'],
    depOpt: services['depOpt'],
  });

  return {
    dep1: services['dep1'],
    finalMappedDep: services['dep3'],
  };
}
`
      );
    })
  );
});
