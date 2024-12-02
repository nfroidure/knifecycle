import {
  SPECIAL_PROPS,
  INSTANCE,
  AUTOLOAD,
  parseDependencyDeclaration,
  initializer,
  READY,
} from './util.js';
import { buildInitializationSequence } from './sequence.js';
import { FATAL_ERROR } from './fatalError.js';
import { DISPOSE } from './dispose.js';
import { type Overrides, type Autoloader } from './index.js';
import type {
  DependencyDeclaration,
  Initializer,
  Dependencies,
} from './util.js';
import { OVERRIDES, pickOverridenName } from './overrides.js';

export const MANAGED_SERVICES = [FATAL_ERROR, DISPOSE, INSTANCE, READY];

type DependencyTreeNode = {
  __name: string;
  __childNodes?: DependencyTreeNode[];
  __initializer: Initializer<unknown, Dependencies<unknown>>;
  __inject: DependencyDeclaration[];
  __type: 'provider' | 'constant' | 'service';
  __initializerName: string;
  __path: string;
  __parentsNames: string[];
};

export type BuildInitializer = (
  dependencies: DependencyDeclaration[],
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
    inject: [AUTOLOAD, OVERRIDES],
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
  $overrides,
}: {
  $autoload: Autoloader<Initializer<unknown, Record<string, unknown>>>;
  $overrides: Overrides;
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
  ): Promise<string> {
    const dependencyTrees = await Promise.all(
      dependencies.map((dependency) =>
        buildDependencyTree({ $autoload, $overrides }, dependency, []),
      ),
    );
    const dependenciesHash = buildDependenciesHash(
      dependencyTrees.filter(identity) as DependencyTreeNode[],
    );
    const batches = buildInitializationSequence({
      __name: 'main',
      __childNodes: dependencyTrees.filter(identity) as DependencyTreeNode[],
    });
    batches.pop();

    return `
// Automatically generated by \`knifecycle\`
import { initFatalError } from 'knifecycle';

const batchsDisposers = [];

async function $dispose() {
  for(const batchDisposers of batchsDisposers.reverse()) {
    await Promise.all(
      batchDisposers
        .map(batchDisposer => batchDisposer())
    );
  }
}

let resolveReady;
const $ready = new Promise((resolve) => {
  resolveReady = resolve;
});
const $instance = {
  destroy: $dispose,
};

${batches
  .map(
    (batch, index) => `
// Definition batch #${index}${batch
      .map((name) => {
        if (MANAGED_SERVICES.includes(name)) {
          return '';
        }
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

        return `
import ${dependenciesHash[name].__initializerName} from '${dependenciesHash[name].__path}';`;
      })
      .join('')}`,
  )
  .join('\n')}

export async function initialize(services = {}) {
  const $fatalError = await initFatalError();
${batches
  .map(
    (batch, index) => `
  // Initialization batch #${index}
  batchsDisposers[${index}] = [];
  const batch${index} = {${batch
    .map((name) => {
      if (
        MANAGED_SERVICES.includes(name) ||
        'constant' === dependenciesHash[name].__initializer[SPECIAL_PROPS.TYPE]
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
      ${serviceName}: services['${pickOverridenName($overrides, [
        ...dependenciesHash[name].__parentsNames,
        mappedName,
      ])}'],`,
            )
            .join('')}`
        : ''
    }
    })${
      'provider' === dependenciesHash[name].__type
        ? `.then(provider => {
      if(provider.dispose) {
        batchsDisposers[${index}].push(provider.dispose);
      }
      if(provider.fatalErrorPromise) {
        $fatalError.registerErrorPromise(provider.fatalErrorPromise);
      }
      return provider.service;
    })`
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

  resolveReady();

  return {${dependencies
    .map(parseDependencyDeclaration)
    .map(
      ({ serviceName, mappedName }) =>
        `
    ${serviceName}: services['${pickOverridenName($overrides, [
      mappedName,
    ])}'],`,
    )
    .join('')}
  };
}
`;
  }
}

async function buildDependencyTree(
  {
    $autoload,
    $overrides,
  }: {
    $autoload: Autoloader<Initializer<unknown, Record<string, unknown>>>;
    $overrides: Overrides;
  },
  dependencyDeclaration: string,
  parentsNames: string[],
): Promise<DependencyTreeNode | null> {
  const { mappedName, optional } = parseDependencyDeclaration(
    dependencyDeclaration,
  );
  const finalName = pickOverridenName($overrides, [
    ...parentsNames,
    mappedName,
  ]);

  if(MANAGED_SERVICES.includes(finalName)) {
    return {

      __name: finalName,
      __initializer: async() => {},
      __inject: [],
      __type: 'constant',
      __initializerName: 'init' + upperCaseFirst(finalName.slice(1)),
      __path: `internal://managed/${finalName}`,
      __childNodes: [],
      __parentsNames: [...parentsNames, finalName],
    };
  }

  try {
    const { path, initializer } = await $autoload(finalName);
    const node: DependencyTreeNode = {
      __name: finalName,
      __initializer: initializer,
      __inject:
        initializer && initializer[SPECIAL_PROPS.INJECT]
          ? initializer[SPECIAL_PROPS.INJECT]
          : [],
      __type:
        initializer && initializer[SPECIAL_PROPS.TYPE]
          ? initializer[SPECIAL_PROPS.TYPE]
          : 'provider',
      __initializerName: 'init' + upperCaseFirst(finalName),
      __path: path,
      __childNodes: [],
      __parentsNames: [...parentsNames, finalName],
    };

    if (
      initializer[SPECIAL_PROPS.INJECT] &&
      initializer[SPECIAL_PROPS.INJECT].length
    ) {
      const childNodes: DependencyTreeNode[] = await Promise.all(
        initializer[SPECIAL_PROPS.INJECT].map((childDependencyDeclaration) =>
          buildDependencyTree(
            { $autoload, $overrides },
            childDependencyDeclaration,
            [...parentsNames, finalName],
          ),
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

function buildDependenciesHash(
  dependencyTrees: DependencyTreeNode[],
  hash: Record<string, DependencyTreeNode> = {},
): Record<string, DependencyTreeNode> {
  return dependencyTrees.reduce(
    (hash, tree) => buildHashFromNode(tree, hash),
    hash,
  );
}

function buildHashFromNode(
  node: DependencyTreeNode,
  hash: Record<string, DependencyTreeNode> = {},
): Record<string, DependencyTreeNode> {
  const nodeIsALeaf = !(node.__childNodes && node.__childNodes.length);

  hash[node.__name] = node;

  if (nodeIsALeaf) {
    return hash;
  }

  (node?.__childNodes || []).forEach((childNode) => {
    hash = buildHashFromNode(childNode, hash);
  });

  return hash;
}

function identity<T = unknown>(a: T): T {
  return a;
}

function upperCaseFirst(str: string): string {
  return str[0].toUpperCase() + str.slice(1);
}
