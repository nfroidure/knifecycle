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
 * @param  {Array<String>}  dependencies
 * List of dependencies declarations to declare which
 *  services the initializer needs to resolve its
 *  own service
 * @param  {Function}  initializer
 * The initializer to tweak
 * @return {Function}
 * Returns a new initializer
 * @example
 *
 * import Knifecycle, { inject } from 'knifecycle'
 * import myServiceInitializer from './service';
 *
 * new Knifecycle()
 *  .register(
 *    service(
 *      inject(['ENV'], myServiceInitializer)
 *      'myService',
 *    )
 *   )
 * );
 */
export function inject(dependencies, initializer) {
  if ('constant' === initializer[SPECIAL_PROPS.TYPE]) {
    throw new YError(
      E_BAD_INJECT_IN_CONSTANT,
      initializer[SPECIAL_PROPS.NAME],
      dependencies,
    );
  }

  const uniqueInitializer = reuseSpecialProps(initializer, initializer, {
    [SPECIAL_PROPS.INJECT]: dependencies,
  });

  debug('Wrapped an initializer with dependencies:', dependencies);

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
 *   .register(
 *     name(
 *       'application',
 *       autoInject(
 *         async ({ NODE_ENV, mysql: db }) =>
 *           async () => db.query('SELECT applicationId FROM applications WHERE environment=?', [NODE_ENV])
 *         )
 *       )
 *     )
 *   )
 * );
 */
export function autoInject(initializer) {
  const source = initializer.toString();
  const matches = source.match(
    /^\s*(?:async\s+function(?:\s+\w+)?|async)\s*\(\{\s*([^{}}]+)\s*\}[^()]*\)/,
  );

  if (!matches) {
    if (!source.match(/^\s*async/)) {
      throw new YError('E_NON_ASYNC_INITIALIZER', source);
    }
    throw new YError('E_AUTO_INJECTION_FAILURE', source);
  }

  const dependencies = matches[1]
    .trim()
    .split(/\s*,\s*/)
    .map(
      injection =>
        (injection.includes('=') ? '?' : '') +
        injection
          .split(/\s*=\s*/)
          .shift()
          .split(/\s*:\s*/)
          .shift(),
    )
    .filter(injection => !/[)(\][]/.test(injection));

  return inject(dependencies, initializer);
}

/**
 * Decorator creating a new initializer with some
 *  more dependencies declarations appended to it.
 * @param  {Array<String>}  dependencies
 * List of dependencies declarations to append
 * @param  {Function}  initializer
 * The initializer to tweak
 * @return {Function}
 * Returns a new initializer
 * @example
 *
 * import Knifecycle, { alsoInject } from 'knifecycle'
 * import myServiceInitializer from './service';
 *
 * new Knifecycle()
 * .register(service(
 *   alsoInject(['ENV'], myServiceInitializer),
 *   'myService',
 * ));
 */
export function alsoInject(dependencies, initializer) {
  return inject(
    (initializer[SPECIAL_PROPS.INJECT] || []).concat(dependencies),
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
 * import Knifecycle, { extra } from 'knifecycle'
 * import myServiceInitializer from './service';
 *
 * new Knifecycle()
 * .register(service(
 *   extra({ httpHandler: true }, myServiceInitializer),
 *   'myService',
 * ));
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
 * import Knifecycle, { inject, options } from 'knifecycle';
 * import myServiceInitializer from './service';
 *
 * new Knifecycle()
 * .register(service(
 *   inject(['ENV'],
 *     options({ singleton: true}, myServiceInitializer)
 *   ),
 *   'myService',
 * ));
 */
export function options(options, initializer, merge = true) {
  const uniqueInitializer = reuseSpecialProps(initializer, initializer, {
    [SPECIAL_PROPS.OPTIONS]: merge
      ? Object.assign({}, initializer[SPECIAL_PROPS.OPTIONS] || {}, options)
      : options,
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
 * import Knifecycle, { name } from 'knifecycle';
 * import myServiceInitializer from './service';
 *
 * new Knifecycle()
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
 * import Knifecycle, { autoName } from 'knifecycle';
 *
 * new Knifecycle()
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
 * import Knifecycle, { name, type } from 'knifecycle';
 * import myServiceInitializer from './service';
 *
 * new Knifecycle()
 * .register(
 *   type('service',
 *     name('myService',
 *       myServiceInitializer
 *     )
 *   )
 * );
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
 * import Knifecycle, { initializer } from 'knifecycle';
 * import myServiceInitializer from './service';
 *
 * new Knifecycle()
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
 * import Knifecycle, { constant, service } from 'knifecycle';
 *
 * const { printAnswer } = new Knifecycle()
 *   .register(constant('THE_NUMBER', value))
 *   .register(constant('log', console.log.bind(console)))
 *   .register(service(
 *     async ({ THE_NUMBER, log }) => () => log(THE_NUMBER),
 *     'printAnswer',
 *     ['THE_NUMBER', 'log'],
 *   ))
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
 * @param  {Function}   builder
 * An initializer returning the service promise
 * @param  {String}    [name]
 * The service's name
 * @param  {Array<String>}    [dependencies]
 * The service's dependencies
 * @param  {Object}    [options]
 * Options attached to the built initializer
 * @return {Function}
 * Returns a new initializer
 * @example
 * import Knifecycle, { constant, service } from 'knifecycle';
 *
 * const { printAnswer } = new Knifecycle()
 *   .register(constant('THE_NUMBER', value))
 *   .register(constant('log', console.log.bind(console)))
 *   .register(service(
 *     async ({ THE_NUMBER, log }) => () => log(THE_NUMBER),
 *     'printAnswer',
 *     ['THE_NUMBER', 'log'],
 *     { singleton: true }
 *   ))
 *   .run(['printAnswer']);
 *
 * printAnswer(); // 42
 */
export function service(builder, name, dependencies, options) {
  if (!builder) {
    throw new YError('E_NO_SERVICE_BUILDER');
  }
  const uniqueInitializer = reuseSpecialProps(builder, builder, {
    [SPECIAL_PROPS.NAME]: name,
    [SPECIAL_PROPS.TYPE]: 'service',
    [SPECIAL_PROPS.INJECT]: dependencies,
    [SPECIAL_PROPS.OPTIONS]: options,
  });

  debug(
    `Created an initializer from a service builder: ${name || 'anonymous'}.`,
  );

  return uniqueInitializer;
}

/**
 * Decorator that auto creates a service
 * @param  {Function}   initializer
 * An initializer returning the service promise
 * @return {Function}
 * Returns a new initializer
 */
export function autoService(serviceBuilder) {
  return initializer(
    {
      name: autoName(serviceBuilder)[SPECIAL_PROPS.NAME],
      type: 'service',
      inject: autoInject(serviceBuilder)[SPECIAL_PROPS.INJECT],
    },
    serviceBuilder,
  );
}

/**
 * Decorator that creates an initializer for a provider
 * @param  {Function}   builder
 * A builder returning the provider promise
 * @param  {String}    [name]
 * The service's name
 * @param  {Array<String>}    [dependencies]
 * The service's dependencies
 * @param  {Object}    [options]
 * Options attached to the built initializer
 * @return {Function}
 * Returns a new initializer
 * @example
 *
 * import Knifecycle, { provider } from 'knifecycle'
 * import fs from 'fs';
 *
 * const $ = new Knifecycle();
 *
 * $.register(provider(configProvider, 'config'));
 *
 * async function configProvider() {
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
 * }
 */
export function provider(builder, name, dependencies, options) {
  if (!builder) {
    throw new YError('E_NO_PROVIDER_BUILDER');
  }

  const uniqueInitializer = reuseSpecialProps(builder, builder, {
    [SPECIAL_PROPS.NAME]: name,
    [SPECIAL_PROPS.TYPE]: 'provider',
    [SPECIAL_PROPS.INJECT]: dependencies,
    [SPECIAL_PROPS.OPTIONS]: options,
  });

  debug(
    `Created an initializer from a provider builder: ${name || 'anonymous'}.`,
  );

  return uniqueInitializer;
}

/**
 * Decorator that auto creates a provider
 * @param  {Function}   initializer
 * An initializer returning the provider promise
 * @return {Function}
 * Returns a new initializer
 */
export function autoProvider(baseInitializer) {
  return initializer(
    {
      name: autoName(baseInitializer)[SPECIAL_PROPS.NAME],
      type: 'provider',
      inject: autoInject(baseInitializer)[SPECIAL_PROPS.INJECT],
    },
    baseInitializer,
  );
}

async function deliverConstantValue(value) {
  return value;
}

/**
 * Shortcut to create an initializer with a simple handler
 * @param  {Function} handlerFunction
 * The handler function
 * @param  {String}  [name]
 * The name of the handler. Default to the DI prop if exists
 * @param  {Array<String>}  [dependencies=[]]
 * The dependencies to inject in it
 * @param  {Object}    [options]
 * Options attached to the built initializer
 * @return {Function}
 * Returns a new initializer
 * @example
 * import Knifecycle, { handler } from 'knifecycle';
 *
 * new Knifecycle()
 * .register(handler(getUser, 'getUser', ['db', '?log']));
 *
 * const QUERY = `SELECT * FROM users WHERE id=$1`
 * async function getUser({ db }, userId) {
 *   const [row] = await db.query(QUERY, userId);
 *
 *   return row;
 * }
 */
export function handler(handlerFunction, name, dependencies, options) {
  name = name || handlerFunction[SPECIAL_PROPS.NAME];
  dependencies = dependencies || handlerFunction[SPECIAL_PROPS.INJECT];

  if (!name) {
    throw new YError('E_NO_HANDLER_NAME', handlerFunction);
  }
  return initializer(
    {
      name,
      type: 'service',
      inject: dependencies,
      options,
    },
    async (...args) => handlerFunction.bind(null, ...args),
  );
}

/**
 * Allows to create an initializer with a simple handler automagically
 * @param  {Function} handlerFunction
 * The handler function
 * @return {Function}
 * Returns a new initializer
 * @example
 * import Knifecycle, { autoHandler } from 'knifecycle';
 *
 * new Knifecycle()
 * .register(autoHandler(getUser));
 *
 * const QUERY = `SELECT * FROM users WHERE id=$1`
 * async function getUser({ db }, userId) {
 *   const [row] = await db.query(QUERY, userId);
 *
 *   return row;
 * }
 */
export function autoHandler(handlerFunction) {
  return initializer(
    {
      name: autoName(handlerFunction)[SPECIAL_PROPS.NAME],
      type: 'service',
      inject: autoInject(handlerFunction)[SPECIAL_PROPS.INJECT],
    },
    async (...args) => handlerFunction.bind(null, ...args),
  );
}

/* Architecture Note #1.2.1: Dependencies declaration syntax

The dependencies syntax is of the following form:
 `?serviceName>mappedName`
The `?` flag indicates an optional dependency.
 `>mappedName` is optional and allows to inject
 `mappedName` as `serviceName`.
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
