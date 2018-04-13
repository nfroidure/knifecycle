import { SPECIAL_PROPS, parseDependencyDeclaration } from './util';
import { buildInitializationSequence } from './sequence';

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

module.exports = buildInitializer;

/**
 * Create a JavaScript module that initialize
 * a set of dependencies with hardcoded
 * import/awaits.
 * @param  {Object}   constants
 * An hash for simple constants
 * @param  {Function} loader
 * The dependency auto-loader
 * @param  {String[]} dependencies
 * The main dependencies
 * @return {Promise<String>}
 * The JavaScript module content
 * @example
 * import buildInitializer from 'knifecycle/src/build';
 *
 * buildInitializer(constants, loader, ['entryPoint']);
 */
function buildInitializer(constants, loader, dependencies) {
  return Promise.all(
    dependencies.map(dependency =>
      buildDependencyTree(constants, loader, dependency),
    ),
  ).then(dependencyTrees => {
    const dependenciesHash = buildDependenciesHash(
      dependencyTrees.filter(identity),
    );
    const batches = buildInitializationSequence({
      __name: 'main',
      __childNodes: dependencyTrees.filter(identity),
    });
    batches.pop();

    return `${batches
      .map(
        (batch, index) => `
// Definition batch #${index}${batch
          .map(name => {
            if (!dependenciesHash[name].__initializer) {
              return `
const ${name} = ${JSON.stringify(constants[name], null, 2)};`;
            }

            return `
import ${dependenciesHash[name].__initializerName} from '${
              dependenciesHash[name].__path
            }';`;
          })
          .join('')}`,
      )
      .join('\n')}

export async function initialize(services = {}) {${batches
      .map(
        (batch, index) => `
  // Initialization batch #${index}
  const batch${index} = {${batch
          .map(name => {
            if (!dependenciesHash[name].__initializer) {
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
          .map(name => {
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
  });
}

function buildDependencyTree(constants, loader, dependencyDeclaration) {
  const { mappedName, optional } = parseDependencyDeclaration(
    dependencyDeclaration,
  );

  if (constants[mappedName]) {
    return Promise.resolve({
      __name: mappedName,
      __constant: constants[mappedName],
    });
  }

  return loader(mappedName)
    .then(({ path, initializer }) => {
      const node = {
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

      return initializer[SPECIAL_PROPS.INJECT] &&
        initializer[SPECIAL_PROPS.INJECT].length
        ? Promise.all(
            initializer[SPECIAL_PROPS.INJECT].map(childDependencyDeclaration =>
              buildDependencyTree(
                constants,
                loader,
                childDependencyDeclaration,
              ),
            ),
          ).then(childNodes => {
            node.__childNodes = childNodes.filter(identity);
            return node;
          })
        : node;
    })
    .catch(err => {
      if (optional) {
        return null;
      }
      throw err;
    });
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

  node.__childNodes.forEach(childNode => {
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
