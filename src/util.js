import YError from 'yerror';
import initDebug from 'debug';

const debug = initDebug('knifecycle');

/* Architecture Note #1.2: Creating initializers

`knifecycle` uses initializers at its a core. An initializer is basically
 an asynchronous function with some annotations:
- name: it uniquely identifies the initializer so that it can be
 referred to as another initializer dependency.
- type: an initializer can be of three types at the moment
 (constant, service or provider). The initializer annotations
 varies accordsing to those types as we'll see later on.
- injected dependencies: an array of dependencies declarations that
 declares which initializer htis initializer depends on. Constants
 logically cannot have dependencies.
- options: various options like for exemple, if the initializer
 implements the singleton pattern or not.
- value: only used for constant, this property allows to know
 the value the initializer resolves to without actually executing it.
- extra: an extra property for custom use that will be propagated
 by the various other decorators you'll find in this library.

`Knifecycle` provides a set of decorators that allows you to simply
 create new initializers.
*/
export const SPECIAL_PROPS_PREFIX = '$';
export const SPECIAL_PROPS = {
  INJECT: `${SPECIAL_PROPS_PREFIX}inject`,
  OPTIONS: `${SPECIAL_PROPS_PREFIX}options`,
  NAME: `${SPECIAL_PROPS_PREFIX}name`,
  TYPE: `${SPECIAL_PROPS_PREFIX}type`,
  EXTRA: `${SPECIAL_PROPS_PREFIX}extra`,
  VALUE: `${SPECIAL_PROPS_PREFIX}value`,
};
export const ALLOWED_SPECIAL_PROPS = Object.keys(SPECIAL_PROPS).map(
  key => SPECIAL_PROPS[key],
);
export const DECLARATION_SEPARATOR = '>';
export const OPTIONAL_FLAG = '?';
export const ALLOWED_INITIALIZER_TYPES = ['provider', 'service', 'constant'];

const E_BAD_INJECT_IN_CONSTANT = 'E_BAD_INJECT_IN_CONSTANT';
const E_CONSTANT_INJECTION = 'E_CONSTANT_INJECTION';

/**
 * Apply special props to the given function from another one
 * @param  {Function} from The initialization function in which to pick the props
 * @param  {Function} to   The initialization function from which to build the new one
 * @param  {Object}   [amend={}]   Some properties to override
 * @return {Function}      The newly built function
 */
export function reuseSpecialProps(from, to, amend = {}) {
  return [...new Set(Object.keys(from).concat(Object.keys(amend)))]
    .filter(prop => prop.startsWith(SPECIAL_PROPS_PREFIX))
    .reduce((fn, prop) => {
      const value =
        'undefined' !== typeof amend[prop] ? amend[prop] : from[prop];
      if (value instanceof Array) {
        fn[prop] = value.concat();
      } else if (value instanceof Object) {
        fn[prop] = Object.assign({}, value);
      } else {
        fn[prop] = value;
      }
      return fn;
    }, to.bind());
}

/**
 * Allows to wrap an initializer to add extra initialization steps
 * @param  {Function} wrapper
 * A function taking dependencies and the base
 * service in arguments
 * @param  {Function} baseInitializer
 * The initializer to decorate
 * @return {Function}
 * The new initializer
 */
export function wrapInitializer(wrapper, baseInitializer) {
  return reuseSpecialProps(baseInitializer, async services => {
    const baseInstance = await baseInitializer(services);

    return wrapper(services, baseInstance);
  });
}

/**
 * Decorator creating a new initializer with different
 *  dependencies declarations set to it.
 * @param  {String[]}  dependenciesDeclarations
 * List of dependencies declarations to declare which
 *  services the initializer needs to resolve its
 *  own service
 * @param  {Function}  initializer
 * The initializer to tweak
 * @return {Function}
 * Returns a new initializer
 * @example
 *
 * import { inject, getInstance } from 'knifecycle'
 * import myServiceInitializer from './service';
 *
 * getInstance()
 * .service('myService',
 *   inject(['ENV'], myServiceInitializer)
 * );
 */
export function inject(dependenciesDeclarations, initializer) {
  if ('constant' === initializer[SPECIAL_PROPS.TYPE]) {
    throw new YError(
      E_BAD_INJECT_IN_CONSTANT,
      initializer[SPECIAL_PROPS.NAME],
      dependenciesDeclarations,
    );
  }

  const uniqueInitializer = reuseSpecialProps(initializer, initializer, {
    [SPECIAL_PROPS.INJECT]: dependenciesDeclarations,
  });

  debug('Wrapped an initializer with dependencies:', dependenciesDeclarations);

  return uniqueInitializer;
}
/**
 * Decorator creating a new initializer with different
 *  dependencies declarations set to it according to the
 *  given function signature.
 * @param  {Function}  initializer
 * The original initializer
 * @return {Function}
 * Returns a new initializer
 * @example
 *
 * import Knifecycle, { autoInject, name } from 'knifecycle'
 *
 * new Knifecycle()
 * .register(
 *   name(
 *     'application',
 *     autoInject(
 *       async ({ NODE_ENV, mysql: db }) =>
 *         async () => db.query('SELECT applicationId FROM applications WHERE environment=?', [NODE_ENV]))
 * );
 */
export function autoInject(initializer) {
  const source = initializer.toString();
  const matches = source.match(
    /\s*async\s+(?:function)?\s*\(\{\s*([^}]+)\s*\}\)/,
  );

  if (!matches) {
    throw new YError('E_AUTO_INJECTION_FAILURE', source);
  }

  const dependenciesDeclarations = matches[1]
    .trim()
    .split(/\s*,\s*/)
    .map(injection => injection.split(/\s*:\s*/).shift());

  return inject(dependenciesDeclarations, initializer);
}

/**
 * Decorator creating a new initializer with some
 *  more dependencies declarations appended to it.
 * @param  {String[]}  dependenciesDeclarations
 * List of dependencies declarations to append
 * @param  {Function}  initializer
 * The initializer to tweak
 * @return {Function}
 * Returns a new initializer
 * @example
 *
 * import { alsoInject, getInstance } from 'knifecycle'
 * import myServiceInitializer from './service';
 *
 * getInstance()
 * .service('myService',
 *   alsoInject(['ENV'], myServiceInitializer)
 * );
 */
export function alsoInject(dependenciesDeclarations, initializer) {
  return inject(
    (initializer[SPECIAL_PROPS.INJECT] || []).concat(dependenciesDeclarations),
    initializer,
  );
}

/**
 * Decorator creating a new initializer with some
 *  extra informations appended to it. It is just
 *  a way for user to store some additional
 *  informations but has no interaction with the
 *  Knifecycle internals.
 * @param  {Object}  extraInformations
 * An object containing those extra informations.
 * @param  {Function}  initializer
 * The initializer to tweak
 * @param  {Boolean}   [merge=false]
 * Whether the extra object should be merged
 * with the existing one or not
 * @return {Function}
 * Returns a new initializer
 * @example
 *
 * import { extra, getInstance } from 'knifecycle'
 * import myServiceInitializer from './service';
 *
 * getInstance()
 * .service('myService',
 *   extra({ httpHandler: true }, myServiceInitializer)
 * );
 */
export function extra(extraInformations, initializer, merge = false) {
  const uniqueInitializer = reuseSpecialProps(initializer, initializer, {
    [SPECIAL_PROPS.EXTRA]: merge
      ? Object.assign(initializer[SPECIAL_PROPS.EXTRA] || {}, extraInformations)
      : extraInformations,
  });

  debug('Wrapped an initializer with extra informations:', extraInformations);

  return uniqueInitializer;
}

/**
 * Decorator to amend an initializer options.
 * @param  {Object}    options
 * Options to set to the initializer
 * @param  {Object}    options.singleton
 * Define the initializer service as a singleton
 * (one instance for several runs)
 * @param  {Function}  initializer
 * The initializer to tweak
 * @param  {Function}  [merge=true]
 * Whether options should be merged or not
 * @return {Function}
 * Returns a new initializer
 * @example
 *
 * import { inject, options, getInstance } from 'knifecycle';
 * import myServiceInitializer from './service';
 *
 * getInstance()
 * .service('myService',
 *   inject(['ENV'],
 *     options({ singleton: true}, myServiceInitializer)
 *   )
 * );
 */
export function options(options, initializer, merge = false) {
  const uniqueInitializer = reuseSpecialProps(initializer, initializer, {
    [SPECIAL_PROPS.OPTIONS]: merge
      ? options
      : Object.assign({}, initializer[SPECIAL_PROPS.OPTIONS] || {}, options),
  });

  debug('Wrapped an initializer with options:', options);

  return uniqueInitializer;
}

/**
 * Decorator to set an initializer name.
 * @param  {String}    name
 * The name of the service the initializer resolves to.
 * @param  {Function}  initializer
 * The initializer to tweak
 * @return {Function}
 * Returns a new initializer with that name set
 * @example
 *
 * import { name, getInstance } from 'knifecycle';
 * import myServiceInitializer from './service';
 *
 * getInstance()
 * .register(name('myService', myServiceInitializer));
 */
export function name(name, initializer) {
  const uniqueInitializer = reuseSpecialProps(initializer, initializer, {
    [SPECIAL_PROPS.NAME]: name,
  });

  debug('Wrapped an initializer with a name:', name);

  return uniqueInitializer;
}

/**
 * Decorator to set an initializer name from its function name.
 * @param  {Function}  initializer
 * The initializer to name
 * @return {Function}
 * Returns a new initializer with that name set
 * @example
 *
 * import { autoName } from 'knifecycle';
 *
 * .register(name(async function myService() {}));
 */
export function autoName(initializer) {
  const functionName = (initializer.name || '')
    .split(' ')
    .pop()
    .replace(/^init(?:ialize)?([A-Z])/, (_, $1) => $1.toLowerCase());

  if (!functionName) {
    throw new YError('E_AUTO_NAMING_FAILURE', initializer.name);
  }

  return name(functionName, initializer);
}

/**
 * Decorator to set an initializer type.
 * @param  {String}    type
 * The type to set to the initializer.
 * @param  {Function}  initializer
 * The initializer to tweak
 * @return {Function}
 * Returns a new initializer
 * @example
 *
 * import { name, type, getInstance } from 'knifecycle';
 * import myServiceInitializer from './service';
 *
 * getInstance()
 * .register(
 *   type('service',
 *     name('myService',
 *       myServiceInitializer
 *     )
 *   )
 *  );
 */
export function type(type, initializer) {
  const uniqueInitializer = reuseSpecialProps(initializer, initializer, {
    [SPECIAL_PROPS.TYPE]: type,
  });

  debug('Wrapped an initializer with a type:', type);

  return uniqueInitializer;
}

/**
 * Decorator to set an initializer properties.
 * @param  {Object}    properties
 * Properties to set to the service.
 * @param  {Function}  initializer
 * The initializer to tweak
 * @return {Function}
 * Returns a new initializer
 * @example
 *
 * import { initializer, getInstance } from 'knifecycle';
 * import myServiceInitializer from './service';
 *
 * getInstance()
 * .register(initializer({
 *   name: 'myService',
 *   type: 'service',
 *   inject: ['ENV'],
 *   options: { singleton: true }
 * }, myServiceInitializer));
 */
export function initializer(properties, initializer) {
  const uniqueInitializer = reuseSpecialProps(
    initializer,
    initializer,
    Object.keys(properties).reduce((finalProperties, property) => {
      const finalProperty = SPECIAL_PROPS_PREFIX + property;

      if (!ALLOWED_SPECIAL_PROPS.includes(finalProperty)) {
        throw new YError('E_BAD_PROPERTY', property);
      }
      finalProperties[finalProperty] = properties[property];
      return finalProperties;
    }, {}),
  );

  debug('Wrapped an initializer with properties:', properties);

  return uniqueInitializer;
}

/**
 * Decorator that creates an initializer for a constant value
 * @param  {String}    name
 * The constant's name.
 * @param  {any}  initializer
 * The constant's value
 * @return {Function}
 * Returns a new initializer
 * @example
 * import { Knifecycle, constant, service } from 'knifecycle';
 *
 * const { printAnswer } = new Knifecycle()
 *   .register(constant('THE_NUMBER', value))
 *   .register(constant('log', console.log.bind(console)))
 *   .register(service(
 *     'printAnswer',
 *     async ({ THE_NUMBER, log }) => () => log(THE_NUMBER),
 *     {
 *       inject: ['THE_NUMBER', 'log'],
 *     }
 *   .run(['printAnswer']);
 *
 * printAnswer(); // 42
 */
export function constant(name, value) {
  const contantLooksLikeAnInitializer =
    value instanceof Function && value[SPECIAL_PROPS.INJECT];

  if (contantLooksLikeAnInitializer) {
    throw new YError(E_CONSTANT_INJECTION, value[SPECIAL_PROPS.INJECT]);
  }

  const uniqueInitializer = initializer(
    {
      name: name,
      type: 'constant',
      options: { singleton: true },
      inject: [],
      value: value,
    },
    deliverConstantValue.bind(null, value),
  );

  debug(`Created an initializer from a constant: ${name}.`);

  return uniqueInitializer;
}

/**
 * Decorator that creates an initializer for a service
 * @param  {String}    name
 * The service's name.
 * @param  {Function}   initializer
 * An initializer returning the service promise
 * @param  {Object}     options
 * Options attached to the initializer
 * @return {Function}
 * Returns a new initializer
 * @example
 * import { Knifecycle, constant, service } from 'knifecycle';
 *
 * const { printAnswer } = new Knifecycle()
 *   .register(constant('THE_NUMBER', value))
 *   .register(constant('log', console.log.bind(console)))
 *   .register(service(
 *     'printAnswer',
 *     async ({ THE_NUMBER, log }) => () => log(THE_NUMBER),
 *     {
 *       inject: ['THE_NUMBER', 'log'],
 *     }
 *   .run(['printAnswer']);
 *
 * printAnswer(); // 42
 */
export function service(serviceName, serviceBuilder, options = {}) {
  const uniqueInitializer = reuseSpecialProps(serviceBuilder, serviceBuilder, {
    [SPECIAL_PROPS.NAME]: serviceName,
    [SPECIAL_PROPS.TYPE]: 'service',
    [SPECIAL_PROPS.OPTIONS]: options,
  });

  debug(`Created an initializer from a service builder: ${name}.`);

  return uniqueInitializer;
}

/**
 * Decorator that creates an initializer for a provider
 * @param  {String}    name
 * The provider's name.
 * @param  {Function}   provider
 * A provider returning the service builder promise
 * @param  {Object}     options
 * Options attached to the initializer
 * @return {Function}
 * Returns a new initializer
 * @example
 *
 * import Knifecycle from 'knifecycle'
 * import fs from 'fs';
 *
 * const $ = new Knifecycle();
 *
 * $.register(provider('config', async function configProvider() {
 *   return new Promise((resolve, reject) {
 *     fs.readFile('config.js', function(err, data) {
 *       let config;
 *
 *       if(err) {
 *         reject(err);
 *         return;
 *       }
 *
 *       try {
 *         config = JSON.parse(data.toString);
 *       } catch (err) {
 *         reject(err);
 *         return;
 *       }
 *
 *       resolve({
 *         service: config,
 *       });
 *     });
 *   });
 * }));
 */
export function provider(providerName, provider, options = {}) {
  const uniqueInitializer = reuseSpecialProps(provider, provider, {
    [SPECIAL_PROPS.NAME]: providerName,
    [SPECIAL_PROPS.TYPE]: 'provider',
    [SPECIAL_PROPS.OPTIONS]: options,
  });

  debug(`Created an initializer from a provider builder: ${name}.`);

  return uniqueInitializer;
}

async function deliverConstantValue(value) {
  return value;
}

/**
 * Shortcut to create an initializer with a simple handler
 * @param  {Function} handlerFunction
 * The handler function
 * @param  {Array}  [dependencies=[]]
 * The dependencies to inject in it
 * @param  {Object}  [extra]
 * Optional extra data to associate with the handler
 * @return {Function}
 * Returns a new initializer
 * @example
 * import { initializer, getInstance } from 'knifecycle';
 *
 * getInstance()
 * .register(handler(getUser, ['db', '?log']));
 *
 * const QUERY = `SELECT * FROM users WHERE id=$1`
 * async function getUser({ db }, userId) {
 *   const [row] = await db.query(QUERY, userId);
 *
 *   return row;
 * }
 */
export function handler(handlerFunction, dependencies = [], extra) {
  if (!handlerFunction.name) {
    throw new YError('E_NO_HANDLER_NAME');
  }
  return initializer(
    {
      name: handlerFunction.name,
      type: 'service',
      inject: dependencies,
      extra,
    },
    async (...args) => handlerFunction.bind(null, ...args),
  );
}

/* Architecture Note #1.2.1: Dependencies declaration syntax

The dependencies syntax is of the following form:
 `?serviceName>mappedName`
The `?` flag indicates an optionnal dependencies.
 `:mappedName` is optional and says to the container to
 inject `serviceName` but to inject it as `mappedName`.
 It allows to write generic services with fixed
 dependencies and remap their name at injection time.
*/

/**
 * Explode a dependency declaration an returns its parts.
 * @param  {String}  dependencyDeclaration
 * A dependency declaration string
 * @return {Object}
 * The various parts of it
 * @example
 * parseDependencyDeclaration('pgsql>db');
 * // Returns
 * {
 *   serviceName: 'pgsql',
 *   mappedName: 'db',
 *   optional: false,
 * }
 */
export function parseDependencyDeclaration(dependencyDeclaration) {
  const optional = dependencyDeclaration.startsWith(OPTIONAL_FLAG);
  const [serviceName, mappedName] = (optional
    ? dependencyDeclaration.slice(1)
    : dependencyDeclaration
  ).split(DECLARATION_SEPARATOR);

  return {
    serviceName,
    mappedName: mappedName || serviceName,
    optional,
  };
}
