import {
  SPECIAL_PROPS,
  parseDependencyDeclaration,
  initializer,
} from './util.js';
import { buildInitializationSequence } from './sequence.js';
import type { DependencyDeclaration, Initializer } from './util.js';
import type { Autoloader } from './index.js';

export type BuildOptions = { modules?: 'commonjs' | true };
export type BuildInitializer = (
  dependencies: DependencyDeclaration[],
  options?: BuildOptions,
) => Promise<string>;

/* Architecture Note #2: Build

Using Knifecycle only makes sense for
 monoliths. For some targets like
 serverless functions, a better
 approach is to simply build a raw
 initialization function.

For the build to work, we need:
- a hash of various constants that may be
 used.
- an autoloader that resolves dependencies
 names to its actual initializer
- the dependencies list you want to
 initialize
*/

export default initializer(
  {
    name: 'buildInitializer',
    type: 'service',
    inject: ['$autoload'],
  },
  initInitializerBuilder,
);

/**
 * Instantiate the initializer builder service
 * @param  {Object}   services
 * The services to inject
 * @param  {Object}   services.$autoload
 * The dependencies autoloader
 * @return {Promise<Function>}
 * A promise of the buildInitializer function
 * @example
 * import initInitializerBuilder from 'knifecycle/dist/build';
 *
 * const buildInitializer = await initInitializerBuilder({
 *   $autoload: async () => {},
 * });
 */
async function initInitializerBuilder({
  $autoload,
}: {
  $autoload: Autoloader<Initializer<unknown, Record<string, unknown>>>;
}) {
  return buildInitializer;

  /**
   * Create a JavaScript module that initialize
   * a set of dependencies with hardcoded
   * import/awaits.
   * @param  {String[]} dependencies
   * The main dependencies
   * @return {Promise<String>}
   * The JavaScript module content
   * @example
   * import initInitializerBuilder from 'knifecycle/dist/build';
   *
   * const buildInitializer = await initInitializerBuilder({
   *   $autoload: async () => {},
   * });
   *
   * const content = await buildInitializer(['entryPoint']);
   */
  async function buildInitializer(
    dependencies: DependencyDeclaration[],
    options: BuildOptions = {},
  ): Promise<string> {
    const dependencyTrees = await Promise.all(
      dependencies.map((dependency) =>
        buildDependencyTree({ $autoload }, dependency),
      ),
    );
    const dependenciesHash = buildDependenciesHash(
      dependencyTrees.filter(identity),
    );
    const batches = buildInitializationSequence({
      __name: 'main',
      __childNodes: dependencyTrees.filter(identity) as DependencyTreeNode[],
    });
    batches.pop();

    return `${batches
      .map(
        (batch, index) => `
// Definition batch #${index}${batch
          .map((name) => {
            if (
              'constant' ===
              dependenciesHash[name].__initializer[SPECIAL_PROPS.TYPE]
            ) {
              return `
const ${name} = ${JSON.stringify(
                dependenciesHash[name].__initializer[SPECIAL_PROPS.VALUE],
                null,
                2,
              )};`;
            }

            return options.modules === 'commonjs'
              ? `
const ${dependenciesHash[name].__initializerName} = (() => { const m = require('${dependenciesHash[name].__path}'); return m && m.default || m; })();`
              : `
import ${dependenciesHash[name].__initializerName} from '${dependenciesHash[name].__path}';`;
          })
          .join('')}`,
      )
      .join('\n')}

${
  options.modules === 'commonjs'
    ? 'module.exports = {}; module.exports.initialize = '
    : 'export '
}async function initialize(services = {}) {${batches
      .map(
        (batch, index) => `
  // Initialization batch #${index}
  const batch${index} = {${batch
          .map((name) => {
            if (
              'constant' ===
              dependenciesHash[name].__initializer[SPECIAL_PROPS.TYPE]
            ) {
              return `
    ${name}: Promise.resolve(${name}),`;
            }
            return `
    ${name}: ${dependenciesHash[name].__initializerName}({${
              dependenciesHash[name].__inject
                ? `${dependenciesHash[name].__inject
                    .map(parseDependencyDeclaration)
                    .map(
                      ({ serviceName, mappedName }) =>
                        `
      ${serviceName}: services['${mappedName}'],`,
                    )
                    .join('')}`
                : ''
            }
    })${
      'provider' === dependenciesHash[name].__type
        ? '.then(provider => provider.service)'
        : ''
    },`;
          })
          .join('')}
  };

  await Promise.all(
    Object.keys(batch${index})
    .map(key => batch${index}[key])
  );
${batch
  .map((name) => {
    return `
  services['${name}'] = await batch${index}['${name}'];`;
  })
  .join('')}
`,
      )
      .join('')}
  return {${dependencies
    .map(parseDependencyDeclaration)
    .map(
      ({ serviceName, mappedName }) =>
        `
    ${serviceName}: services['${mappedName}'],`,
    )
    .join('')}
  };
}
`;
  }
}

type DependencyTreeNode = {
  __name: string;
  __childNodes?: DependencyTreeNode[];
  __initializer: Initializer<unknown, Record<string, unknown>>;
  __inject: DependencyDeclaration[];
  __type: 'provider' | 'constant' | 'service';
  __initializerName: string;
  __path: string;
};

async function buildDependencyTree(
  {
    $autoload,
  }: { $autoload: Autoloader<Initializer<unknown, Record<string, unknown>>> },
  dependencyDeclaration,
): Promise<DependencyTreeNode | null> {
  const { mappedName, optional } = parseDependencyDeclaration(
    dependencyDeclaration,
  );

  try {
    const { path, initializer } = await $autoload(mappedName);
    const node: DependencyTreeNode = {
      __name: mappedName,
      __initializer: initializer,
      __inject:
        initializer && initializer[SPECIAL_PROPS.INJECT]
          ? initializer[SPECIAL_PROPS.INJECT]
          : [],
      __type:
        initializer && initializer[SPECIAL_PROPS.TYPE]
          ? initializer[SPECIAL_PROPS.TYPE]
          : 'provider',
      __initializerName: 'init' + upperCaseFirst(mappedName),
      __path: path,
      __childNodes: [],
    };

    if (
      initializer[SPECIAL_PROPS.INJECT] &&
      initializer[SPECIAL_PROPS.INJECT].length
    ) {
      const childNodes: DependencyTreeNode[] = await Promise.all(
        initializer[SPECIAL_PROPS.INJECT].map((childDependencyDeclaration) =>
          buildDependencyTree({ $autoload }, childDependencyDeclaration),
        ),
      );
      node.__childNodes = childNodes.filter(identity);
      return node;
    } else {
      return node;
    }
  } catch (err) {
    if (optional) {
      return null;
    }
    throw err;
  }
}

function buildDependenciesHash(dependencyTrees, hash = {}) {
  return dependencyTrees.reduce(
    (hash, tree) => buildHashFromNode(tree, hash),
    hash,
  );
}

function buildHashFromNode(node, hash = {}) {
  const nodeIsALeaf = !(node.__childNodes && node.__childNodes.length);

  hash[node.__name] = node;

  if (nodeIsALeaf) {
    return hash;
  }

  node.__childNodes.forEach((childNode) => {
    hash = buildHashFromNode(childNode, hash);
  });

  return hash;
}

function identity(a) {
  return a;
}

function upperCaseFirst(str) {
  return str[0].toUpperCase() + str.slice(1);
}
