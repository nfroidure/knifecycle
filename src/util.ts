/* eslint @typescript-eslint/ban-types:0 */

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
export const DECLARATION_SEPARATOR = '>';
export const OPTIONAL_FLAG = '?';
export const ALLOWED_INITIALIZER_TYPES = [
  'provider',
  'service',
  'constant',
] as const;

export type ServiceName = string;
export type Service = any;
export interface Disposer {
  (): Promise<void>;
}
export type FatalErrorProvider = Promise<void>;
export type Provider<S extends Service> = {
  service: S;
  dispose?: Disposer;
  fatalErrorPromise?: FatalErrorProvider;
};
export type Dependencies<S extends Service = Service> = { [name: string]: S };
export type DependencyName = string;
export type DependencyDeclaration = string;
export type ExtraInformations = any;
export type ParsedDependencyDeclaration = {
  serviceName: string;
  mappedName: string;
  optional: boolean;
};

export type ConstantProperties = {
  $type: 'constant';
  $name: DependencyName;
};
export type ConstantInitializer<S extends Service> = ConstantProperties & {
  $value: S;
};

export type ProviderInitializerBuilder<
  D extends Dependencies,
  S extends Service
> = (dependencies?: D) => Promise<Provider<S>>;
export type ProviderProperties = {
  $type: 'provider';
  $name: DependencyName;
  $inject?: DependencyDeclaration[];
  $singleton?: boolean;
  $extra?: ExtraInformations;
};
export type ProviderInitializer<
  D extends Dependencies,
  S extends Service
> = ProviderInitializerBuilder<D, S> & ProviderProperties;
export type ProviderInputProperties = {
  type: 'provider';
  name: DependencyName;
  inject?: DependencyDeclaration[];
  singleton?: boolean;
  extra?: ExtraInformations;
};

export type ServiceInitializerBuilder<
  D extends Dependencies,
  S extends Service
> = (dependencies?: D) => Promise<S>;
export type ServiceProperties = {
  $type: 'service';
  $name: DependencyName;
  $inject?: DependencyDeclaration[];
  $singleton?: boolean;
  $extra?: ExtraInformations;
};
export type ServiceInitializer<
  D extends Dependencies,
  S extends Service
> = ServiceInitializerBuilder<D, S> & ServiceProperties;
export type ServiceInputProperties = {
  type: 'service';
  name: DependencyName;
  inject?: DependencyDeclaration[];
  singleton?: boolean;
  extra?: ExtraInformations;
};

export type AsyncInitializerBuilder<
  D extends Dependencies,
  S extends Service
> = ProviderInitializerBuilder<D, S> | ServiceInitializerBuilder<D, S>;
export type AsyncInitializer<D extends Dependencies, S extends Service> =
  | ServiceInitializer<D, S>
  | ProviderInitializer<D, S>;
export type PartialAsyncInitializer<
  D extends Dependencies,
  S extends Service
> = Partial<ServiceInitializer<D, S>> | Partial<ProviderInitializer<D, S>>;

export type Initializer<
  S extends Service,
  D extends Dependencies = Dependencies
> =
  | ConstantInitializer<S>
  | ServiceInitializer<D, S>
  | ProviderInitializer<D, S>;

export type ServiceInitializerWrapper<
  S extends Service,
  D extends Dependencies = Dependencies
> = (dependencies: D, baseService: S) => Promise<S>;
export type ProviderInitializerWrapper<
  S extends Service,
  D extends Dependencies = Dependencies
> = (dependencies: D, baseService: Provider<S>) => Promise<Provider<S>>;

export type Parameters<V = any> = { [name: string]: V };
export interface HandlerFunction<
  D extends Dependencies,
  V,
  P extends Parameters<V>,
  U extends any[],
  R
> {
  (dependencies: D, parameters?: P, ...args: U): Promise<R>;
}

export const SPECIAL_PROPS_PREFIX = '$';
export const SPECIAL_PROPS = {
  TYPE: `${SPECIAL_PROPS_PREFIX}type`,
  NAME: `${SPECIAL_PROPS_PREFIX}name`,
  INJECT: `${SPECIAL_PROPS_PREFIX}inject`,
  SINGLETON: `${SPECIAL_PROPS_PREFIX}singleton`,
  EXTRA: `${SPECIAL_PROPS_PREFIX}extra`,
  VALUE: `${SPECIAL_PROPS_PREFIX}value`,
};
export const ALLOWED_SPECIAL_PROPS = Object.keys(SPECIAL_PROPS).map(
  (key) => SPECIAL_PROPS[key],
);

const E_BAD_INJECT_IN_CONSTANT = 'E_BAD_INJECT_IN_CONSTANT';
const E_CONSTANT_INJECTION = 'E_CONSTANT_INJECTION';

export function parseInjections(
  source: string,
  options?: { allowEmpty: boolean },
): DependencyDeclaration[] {
  const matches = source.match(
    /^\s*(?:async\s+function(?:\s+\w+)?|async)\s*\(\s*\{\s*([^{}]+)(\s*\.\.\.[^{}]+|)\s*\}/,
  );

  if (!matches) {
    if (!source.match(/^\s*async/)) {
      throw new YError('E_NON_ASYNC_INITIALIZER', source);
    }
    if (
      options &&
      options.allowEmpty &&
      source.match(/^\s*(?:async\s+function(?:\s+\w+)?|async)\s*\(\s*\)/)
    ) {
      return [];
    }
    throw new YError('E_AUTO_INJECTION_FAILURE', source);
  }

  return matches[1]
    .trim()
    .replace(/,$/, '')
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter((s) => !s.startsWith('...'))
    .map(
      (injection) =>
        (injection.includes('=') ? '?' : '') +
        injection
          .split(/\s*=\s*/)
          .shift()
          .split(/\s*:\s*/)
          .shift(),
    )
    .filter((injection) => !/[)(\][]/.test(injection));
}

export function readFunctionName(aFunction: Function): string {
  if (typeof aFunction !== 'function') {
    throw new YError('E_AUTO_NAMING_FAILURE', typeof aFunction);
  }

  const functionName = parseName(aFunction.name || '');

  if (!functionName) {
    throw new YError('E_AUTO_NAMING_FAILURE', aFunction.name);
  }

  return functionName;
}

export function parseName(functionName: string): string {
  return functionName
    .split(' ')
    .pop()
    .replace(/^init(?:ialize)?([A-Z])/, (_, $1) => $1.toLowerCase());
}

/**
 * Apply special props to the given initializer from another one
 *  and optionally amend with new special props
 * @param  {Function} from The initializer in which to pick the props
 * @param  {Function} to   The initializer from which to build the new one
 * @param  {Object}   [amend={}]   Some properties to override
 * @return {Function}      The newly built initializer
 */
export function reuseSpecialProps<FD, TD, S>(
  from:
    | AsyncInitializerBuilder<FD, unknown>
    | PartialAsyncInitializer<FD, unknown>,
  to: ProviderInitializerBuilder<TD, S>,
  amend?: Partial<ProviderProperties>,
): ProviderInitializerBuilder<FD & TD, S>;
export function reuseSpecialProps<FD, TD, S>(
  from:
    | AsyncInitializerBuilder<FD, unknown>
    | PartialAsyncInitializer<FD, unknown>,
  to: ServiceInitializerBuilder<TD, S>,
  amend?: Partial<ServiceProperties>,
): ServiceInitializerBuilder<FD & TD, S>;
export function reuseSpecialProps<FD, TD, S>(
  from:
    | AsyncInitializerBuilder<FD, unknown>
    | PartialAsyncInitializer<FD, unknown>,
  to: ProviderInitializerBuilder<TD, S> | ServiceInitializerBuilder<TD, S>,
  amend: Partial<ProviderProperties> | Partial<ServiceProperties> = {},
):
  | ProviderInitializerBuilder<FD & TD, S>
  | ServiceInitializerBuilder<FD & TD, S> {
  const uniqueInitializer = ((to as unknown) as Function).bind(null);

  return [...new Set(Object.keys(from).concat(Object.keys(amend)))]
    .filter((prop) => prop.startsWith(SPECIAL_PROPS_PREFIX))
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
    }, uniqueInitializer);
}

/**
 * Decorator that creates an initializer for a constant value
 * @param  {String}    name
 * The constant's name.
 * @param  {any}  value
 * The constant's value
 * @return {Function}
 * Returns a new constant initializer
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
export function constant<V extends Service>(
  name: DependencyName,
  value: V,
): ConstantInitializer<V> {
  const contantLooksLikeAnInitializer =
    value instanceof Function && value[SPECIAL_PROPS.INJECT];

  if (contantLooksLikeAnInitializer) {
    throw new YError(E_CONSTANT_INJECTION, value[SPECIAL_PROPS.INJECT]);
  }

  debug(`Created an initializer from a constant: ${name}.`);

  return {
    $type: 'constant',
    $name: name,
    $value: value,
  };
}

/**
 * Decorator that creates an initializer from a service builder
 * @param  {Function}   serviceBuilder
 * An async function to build the service
 * @param  {String}    [name]
 * The service's name
 * @param  {Array<String>}    [dependencies]
 * The service's injected dependencies
 * @param  {Boolean}    [singleton]
 * Whether the service is a singleton or not
 * @param  {any}    [extra]
 * Eventual extra informations
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
 *     true
 *   ))
 *   .run(['printAnswer']);
 *
 * printAnswer(); // 42
 */
export function service<D, S>(
  serviceBuilder: ServiceInitializerBuilder<D, S>,
  name?: DependencyName,
  dependencies?: DependencyDeclaration[],
  singleton?: boolean,
  extra?: ExtraInformations,
): ServiceInitializer<D, S> {
  if (!serviceBuilder) {
    throw new YError('E_NO_SERVICE_BUILDER');
  }

  name = name || serviceBuilder[SPECIAL_PROPS.NAME] || 'anonymous';
  dependencies = dependencies || serviceBuilder[SPECIAL_PROPS.INJECT] || [];
  singleton =
    typeof singleton === 'undefined'
      ? serviceBuilder[SPECIAL_PROPS.SINGLETON] || false
      : singleton;
  extra = extra || serviceBuilder[SPECIAL_PROPS.EXTRA] || [];

  debug(`Created an initializer from a service builder: ${name}.`);

  const uniqueInitializer = reuseSpecialProps(serviceBuilder, serviceBuilder, {
    [SPECIAL_PROPS.TYPE]: 'service',
    [SPECIAL_PROPS.NAME]: name,
    [SPECIAL_PROPS.INJECT]: dependencies,
    [SPECIAL_PROPS.SINGLETON]: singleton,
    [SPECIAL_PROPS.EXTRA]: extra,
  }) as ServiceInitializer<D, S>;

  return uniqueInitializer;
}

/**
 * Decorator that creates an initializer from a service
 *  builder by automatically detecting its name
 *  and dependencies
 * @param  {Function}   serviceBuilder
 * An async function to build the service
 * @return {Function}
 * Returns a new initializer
 */
export function autoService<D, S>(
  serviceBuilder: ServiceInitializerBuilder<D, S>,
): ServiceInitializer<D, S> {
  const name = readFunctionName(serviceBuilder as Function);
  const source = serviceBuilder.toString();
  const dependencies = parseInjections(source, { allowEmpty: true });

  return service(serviceBuilder, name, dependencies);
}

/**
 * Decorator that creates an initializer for a provider
 *  builder
 * @param  {Function} providerBuilder
 * An async function to build the service provider
 * @param  {String} [name]
 * The service's name
 * @param  {Array<String>} [dependencies]
 * The service's dependencies
 * @param  {Boolean} [singleton]
 * Whether the service is a singleton or not
 * @param  {any} [extra]
 * Eventual extra informations
 * @return {Function}
 * Returns a new provider initializer
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
export function provider<D, S>(
  providerBuilder: ProviderInitializerBuilder<D, S>,
  name?: DependencyName,
  dependencies?: DependencyDeclaration[],
  singleton?: boolean,
  extra?: ExtraInformations,
): ProviderInitializer<D, S> {
  if (!providerBuilder) {
    throw new YError('E_NO_PROVIDER_BUILDER');
  }

  name = name || providerBuilder[SPECIAL_PROPS.NAME] || 'anonymous';
  dependencies = dependencies || providerBuilder[SPECIAL_PROPS.INJECT] || [];
  singleton =
    typeof singleton === 'undefined'
      ? providerBuilder[SPECIAL_PROPS.SINGLETON] || false
      : singleton;
  extra = extra || providerBuilder[SPECIAL_PROPS.EXTRA] || [];

  debug(
    `Created an initializer from a provider builder: ${name || 'anonymous'}.`,
  );

  const uniqueInitializer = reuseSpecialProps(
    providerBuilder,
    providerBuilder,
    {
      [SPECIAL_PROPS.TYPE]: 'provider',
      [SPECIAL_PROPS.NAME]: name,
      [SPECIAL_PROPS.INJECT]: dependencies,
      [SPECIAL_PROPS.SINGLETON]: singleton,
      [SPECIAL_PROPS.EXTRA]: extra,
    },
  ) as ProviderInitializer<D, S>;

  return uniqueInitializer;
}

/**
 * Decorator that creates an initializer from a provider
 *  builder by automatically detecting its name
 *  and dependencies
 * @param  {Function}   providerBuilder
 * An async function to build the service provider
 * @return {Function}
 * Returns a new provider initializer
 */
export function autoProvider<D, S>(
  providerBuilder: ProviderInitializerBuilder<D, S>,
): ProviderInitializer<D, S> {
  const name = readFunctionName(providerBuilder as Function);
  const source = providerBuilder.toString();
  const dependencies = parseInjections(source, { allowEmpty: true });

  return provider(providerBuilder, name, dependencies);
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

export function wrapInitializer<D, S>(
  wrapper: ProviderInitializerWrapper<S, D>,
  baseInitializer: ProviderInitializer<D, S>,
): ProviderInitializer<D, S>;
export function wrapInitializer<D, S>(
  wrapper: ServiceInitializerWrapper<S, D>,
  baseInitializer: ServiceInitializer<D, S>,
): ServiceInitializer<D, S>;
export function wrapInitializer<D, S>(
  wrapper: ProviderInitializerWrapper<S, D> | ServiceInitializerWrapper<S, D>,
  baseInitializer: ProviderInitializer<D, S> | ServiceInitializer<D, S>,
): ProviderInitializer<D, S> | ServiceInitializer<D, S> {
  return reuseSpecialProps(baseInitializer, async (services: D) => {
    const baseInstance = await baseInitializer(services);

    return (wrapper as ServiceInitializerWrapper<S, D>)(
      services,
      baseInstance as S,
    );
  }) as ServiceInitializer<D, S>;
}

/**
 * Decorator creating a new initializer with different
 *  dependencies declarations set to it.
 * @param  {Array<String>}  dependencies
 * List of dependencies declarations to declare which
 *  services the initializer needs to provide its
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
export function inject<D, S>(
  dependencies: DependencyDeclaration[],
  initializer: ProviderInitializer<unknown, S>,
): ProviderInitializer<D, S>;
export function inject<D, S>(
  dependencies: DependencyDeclaration[],
  initializer: ProviderInitializerBuilder<unknown, S>,
): ProviderInitializerBuilder<D, S>;
export function inject<D, S>(
  dependencies: DependencyDeclaration[],
  initializer: ServiceInitializer<unknown, S>,
): ServiceInitializer<D, S>;
export function inject<D, S>(
  dependencies: DependencyDeclaration[],
  initializer: ServiceInitializerBuilder<unknown, S>,
): ServiceInitializerBuilder<D, S>;
export function inject<D, S>(
  dependencies: DependencyDeclaration[],
  initializer:
    | ProviderInitializerBuilder<unknown, S>
    | ServiceInitializerBuilder<unknown, S>,
): ProviderInitializerBuilder<D, S> | ServiceInitializerBuilder<D, S> {
  if ('constant' === initializer[SPECIAL_PROPS.TYPE]) {
    throw new YError(
      E_BAD_INJECT_IN_CONSTANT,
      initializer[SPECIAL_PROPS.NAME],
      dependencies,
    );
  }

  const uniqueInitializer = reuseSpecialProps<D, {}, S>(
    initializer,
    initializer as ServiceInitializerBuilder<D, S>,
    {
      [SPECIAL_PROPS.INJECT]: dependencies,
    },
  );

  debug('Wrapped an initializer with dependencies:', dependencies);

  return uniqueInitializer;
}

/**
 * Apply injected dependencies from the given initializer to another one
 * @param  {Function} from The initialization function in which to pick the dependencies
 * @param  {Function} to   The destination initialization function
 * @return {Function}      The newly built initialization function
 */
export function useInject<FD, S>(
  from:
    | AsyncInitializerBuilder<FD, unknown>
    | PartialAsyncInitializer<FD, unknown>,
  to: ProviderInitializer<unknown, S>,
): ProviderInitializer<FD, S>;
export function useInject<FD, S>(
  from:
    | AsyncInitializerBuilder<FD, unknown>
    | PartialAsyncInitializer<FD, unknown>,
  to: ProviderInitializerBuilder<unknown, S>,
): ProviderInitializerBuilder<FD, S>;
export function useInject<FD, S>(
  from:
    | AsyncInitializerBuilder<FD, unknown>
    | PartialAsyncInitializer<FD, unknown>,
  to: ServiceInitializer<unknown, S>,
): ServiceInitializer<FD, S>;
export function useInject<FD, S>(
  from:
    | AsyncInitializerBuilder<FD, unknown>
    | PartialAsyncInitializer<FD, unknown>,
  to: ServiceInitializerBuilder<unknown, S>,
): ServiceInitializerBuilder<FD, S>;
export function useInject<FD, S>(
  from:
    | AsyncInitializerBuilder<FD, unknown>
    | PartialAsyncInitializer<FD, unknown>,
  to: ProviderInitializerBuilder<unknown, S>,
): ProviderInitializerBuilder<FD, S> | ServiceInitializerBuilder<FD, S> {
  return inject<FD, S>(from[SPECIAL_PROPS.INJECT] || [], to);
}

/**
 * Merge injected dependencies of the given initializer with another one
 * @param  {Function} from The initialization function in which to pick the dependencies
 * @param  {Function} to   The destination initialization function
 * @return {Function}      The newly built initialization function
 */
export function mergeInject<FD, D, S>(
  from:
    | AsyncInitializerBuilder<FD, unknown>
    | PartialAsyncInitializer<FD, unknown>,
  to: ProviderInitializer<D, S>,
): ProviderInitializer<FD & D, S>;
export function mergeInject<FD, D, S>(
  from:
    | AsyncInitializerBuilder<FD, unknown>
    | PartialAsyncInitializer<FD, unknown>,
  to: ProviderInitializerBuilder<D, S>,
): ProviderInitializerBuilder<FD & D, S>;
export function mergeInject<FD, D, S>(
  from:
    | AsyncInitializerBuilder<FD, unknown>
    | PartialAsyncInitializer<FD, unknown>,
  to: ServiceInitializer<D, S>,
): ServiceInitializer<FD, S>;
export function mergeInject<FD, D, S>(
  from:
    | AsyncInitializerBuilder<FD, unknown>
    | PartialAsyncInitializer<FD, unknown>,
  to: ServiceInitializerBuilder<D, S>,
): ServiceInitializerBuilder<FD, S>;
export function mergeInject<FD, D, S>(
  from:
    | AsyncInitializerBuilder<FD, unknown>
    | PartialAsyncInitializer<FD, unknown>,
  to: ProviderInitializerBuilder<D, S> | ServiceInitializerBuilder<D, S>,
):
  | ProviderInitializerBuilder<D & FD, S>
  | ServiceInitializerBuilder<D & FD, S> {
  return alsoInject(
    from[SPECIAL_PROPS.INJECT] || ([] as DependencyDeclaration[]),
    to as ServiceInitializerBuilder<D, S>,
  );
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
export function autoInject<D, S>(
  initializer: ProviderInitializer<D, S>,
): ProviderInitializer<D, S>;
export function autoInject<D, S>(
  initializer: ProviderInitializerBuilder<D, S>,
): ProviderInitializerBuilder<D, S>;
export function autoInject<D, S>(
  initializer: ServiceInitializer<D, S>,
): ServiceInitializer<D, S>;
export function autoInject<D, S>(
  initializer: ServiceInitializerBuilder<D, S>,
): ServiceInitializerBuilder<D, S>;
export function autoInject<D, S>(
  initializer:
    | ProviderInitializerBuilder<D, S>
    | ServiceInitializerBuilder<D, S>,
): ProviderInitializerBuilder<D, S> | ServiceInitializerBuilder<D, S> {
  const source = initializer.toString();
  const dependencies = parseInjections(source);

  return inject(dependencies, initializer as ServiceInitializerBuilder<D, S>);
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
export function alsoInject<ND, D, S>(
  dependencies: DependencyDeclaration[],
  to: ProviderInitializer<D, S>,
): ProviderInitializer<ND & D, S>;
export function alsoInject<ND, D, S>(
  dependencies: DependencyDeclaration[],
  to: ProviderInitializerBuilder<D, S>,
): ProviderInitializerBuilder<ND & D, S>;
export function alsoInject<ND, D, S>(
  dependencies: DependencyDeclaration[],
  to: ServiceInitializer<D, S>,
): ServiceInitializer<ND & D, S>;
export function alsoInject<ND, D, S>(
  dependencies: DependencyDeclaration[],
  to: ServiceInitializerBuilder<D, S>,
): ServiceInitializerBuilder<ND & D, S>;
export function alsoInject<ND, D, S>(
  dependencies: DependencyDeclaration[],
  initializer:
    | ProviderInitializerBuilder<D, S>
    | ServiceInitializerBuilder<D, S>,
):
  | ProviderInitializerBuilder<ND & D, S>
  | ServiceInitializerBuilder<ND & D, S> {
  const currentDependencies = (initializer[SPECIAL_PROPS.INJECT] || []).map(
    parseDependencyDeclaration,
  );
  const addedDependencies = dependencies.map(parseDependencyDeclaration);
  const dedupedDependencies: DependencyDeclaration[] = currentDependencies
    .filter(({ serviceName }) => {
      const declarationIsOverridden = addedDependencies.some(
        ({ serviceName: addedServiceName }) => {
          return addedServiceName === serviceName;
        },
      );

      return !declarationIsOverridden;
    })
    .concat(
      addedDependencies.map(({ serviceName, mappedName, optional }) => {
        const isOptionalEverywhere =
          optional &&
          currentDependencies.every(
            ({ optional, mappedName: addedMappedName }) => {
              return addedMappedName !== mappedName || optional;
            },
          );
        return {
          serviceName,
          mappedName,
          optional: isOptionalEverywhere,
        };
      }),
    )
    .map(stringifyDependencyDeclaration);

  return inject(
    dedupedDependencies,
    initializer as ServiceInitializerBuilder<D, S>,
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

export function extra<D, S>(
  extraInformations: ExtraInformations,
  initializer: ProviderInitializer<D, S>,
  merge?: boolean,
): ProviderInitializer<D, S>;
export function extra<D, S>(
  extraInformations: ExtraInformations,
  initializer: ProviderInitializerBuilder<D, S>,
  merge?: boolean,
): ProviderInitializerBuilder<D, S>;
export function extra<D, S>(
  extraInformations: ExtraInformations,
  initializer: ServiceInitializer<D, S>,
): ServiceInitializer<D, S>;
export function extra<D, S>(
  extraInformations: ExtraInformations,
  initializer: ServiceInitializerBuilder<D, S>,
): ServiceInitializerBuilder<D, S>;
export function extra<D, S>(
  extraInformations: ExtraInformations,
  initializer:
    | ProviderInitializerBuilder<D, S>
    | ServiceInitializerBuilder<D, S>,
  merge = false,
): ProviderInitializerBuilder<D, S> | ServiceInitializerBuilder<D, S> {
  const uniqueInitializer = reuseSpecialProps(
    initializer,
    initializer as ServiceInitializerBuilder<D, S>,
    {
      [SPECIAL_PROPS.EXTRA]: merge
        ? Object.assign(
            initializer[SPECIAL_PROPS.EXTRA] || {},
            extraInformations,
          )
        : extraInformations,
    },
  );

  debug('Wrapped an initializer with extra informations:', extraInformations);

  return uniqueInitializer;
}

/**
 * Decorator to set an initializer singleton option.
 * @param  {Function}  initializer
 * The initializer to tweak
 * @param  {boolean}    [isSingleton=true]
 * Define the initializer singleton option
 * (one instance for several runs if true)
 * @return {Function}
 * Returns a new initializer
 * @example
 *
 * import Knifecycle, { inject, singleton } from 'knifecycle';
 * import myServiceInitializer from './service';
 *
 * new Knifecycle()
 * .register(service(
 *   inject(['ENV'],
 *     singleton(myServiceInitializer)
 *   ),
 *   'myService',
 * ));
 */
export function singleton<D, S>(
  initializer: ProviderInitializer<D, S>,
  isSingleton?: boolean,
): ProviderInitializer<D, S>;
export function singleton<D, S>(
  initializer: ProviderInitializerBuilder<D, S>,
  isSingleton?: boolean,
): ProviderInitializerBuilder<D, S>;
export function singleton<D, S>(
  initializer: ServiceInitializer<D, S>,
  isSingleton?: boolean,
): ServiceInitializer<D, S>;
export function singleton<D, S>(
  initializer: ServiceInitializerBuilder<D, S>,
  isSingleton?: boolean,
): ServiceInitializerBuilder<D, S>;
export function singleton<D, S>(
  initializer:
    | ProviderInitializerBuilder<D, S>
    | ServiceInitializerBuilder<D, S>,
  isSingleton = true,
): ProviderInitializerBuilder<D, S> | ServiceInitializerBuilder<D, S> {
  const uniqueInitializer = reuseSpecialProps(
    initializer,
    initializer as ServiceInitializerBuilder<D, S>,
    {
      [SPECIAL_PROPS.SINGLETON]: isSingleton,
    },
  );

  debug('Marked an initializer as singleton:', isSingleton);

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
export function name<D, S>(
  name: DependencyName,
  initializer: ProviderInitializer<D, S>,
): ProviderInitializer<D, S>;
export function name<D, S>(
  name: DependencyName,
  initializer: ProviderInitializerBuilder<D, S>,
): ProviderInitializerBuilder<D, S>;
export function name<D, S>(
  name: DependencyName,
  initializer: ServiceInitializer<D, S>,
): ServiceInitializer<D, S>;
export function name<D, S>(
  name: DependencyName,
  initializer: ServiceInitializerBuilder<D, S>,
): ServiceInitializerBuilder<D, S>;
export function name<D, S>(
  name: DependencyName,
  initializer:
    | ProviderInitializerBuilder<D, S>
    | ServiceInitializerBuilder<D, S>,
): ProviderInitializerBuilder<D, S> | ServiceInitializerBuilder<D, S> {
  const uniqueInitializer = reuseSpecialProps(
    initializer,
    initializer as ServiceInitializerBuilder<D, S>,
    {
      [SPECIAL_PROPS.NAME]: name,
    },
  );

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
 * .register(autoName(async function myService() {}));
 */
export function autoName<D, S>(
  initializer: ProviderInitializer<D, S>,
): ProviderInitializer<D, S>;
export function autoName<D, S>(
  initializer: ProviderInitializerBuilder<D, S>,
): ProviderInitializerBuilder<D, S>;
export function autoName<D, S>(
  initializer: ServiceInitializer<D, S>,
): ServiceInitializer<D, S>;
export function autoName<D, S>(
  initializer: ServiceInitializerBuilder<D, S>,
): ServiceInitializerBuilder<D, S>;
export function autoName<D, S>(
  initializer:
    | ProviderInitializerBuilder<D, S>
    | ServiceInitializerBuilder<D, S>,
): ProviderInitializerBuilder<D, S> | ServiceInitializerBuilder<D, S> {
  return name(
    readFunctionName(initializer),
    initializer as ServiceInitializerBuilder<D, S>,
  );
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
export function type<D, S>(
  type: 'provider',
  initializer: ProviderInitializer<D, S>,
): ProviderInitializer<D, S>;
export function type<D, S>(
  type: 'provider',
  initializer: ProviderInitializerBuilder<D, S>,
): ProviderInitializerBuilder<D, S>;
export function type<D, S>(
  type: 'service',
  initializer: ServiceInitializer<D, S>,
): ServiceInitializer<D, S>;
export function type<D, S>(
  type: 'service',
  initializer: ServiceInitializerBuilder<D, S>,
): ServiceInitializerBuilder<D, S>;
export function type<D, S>(
  type: 'service' | 'provider',
  initializer:
    | ProviderInitializerBuilder<D, S>
    | ServiceInitializerBuilder<D, S>,
): ProviderInitializerBuilder<D, S> | ServiceInitializerBuilder<D, S> {
  const uniqueInitializer = reuseSpecialProps(
    initializer,
    initializer as ServiceInitializerBuilder<D, S>,
    {
      [SPECIAL_PROPS.TYPE]: type,
    },
  );

  debug('Wrapped an initializer with a type:', type);

  return uniqueInitializer as ServiceInitializerBuilder<D, S>;
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
export function initializer<D, S>(
  properties: ProviderInputProperties,
  initializer: ProviderInitializerBuilder<D, S>,
): ProviderInitializer<D, S>;
export function initializer<D, S>(
  properties: ServiceInputProperties,
  initializer: ServiceInitializerBuilder<D, S>,
): ServiceInitializer<D, S>;
export function initializer<D, S>(
  properties: ServiceInputProperties | ProviderInputProperties,
  initializer:
    | ProviderInitializerBuilder<D, S>
    | ServiceInitializerBuilder<D, S>,
): ProviderInitializer<D, S> | ServiceInitializer<D, S> {
  const uniqueInitializer = reuseSpecialProps(
    initializer,
    initializer as ServiceInitializerBuilder<D, S>,
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

  return uniqueInitializer as ServiceInitializer<D, S>;
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
export function handler<
  D extends Dependencies,
  V,
  P extends Parameters<V>,
  U extends unknown[],
  R
>(
  handlerFunction: HandlerFunction<D, V, P, U, R>,
  name?: ServiceName,
  dependencies?: DependencyDeclaration[],
  singleton?: boolean,
  extra?: ExtraInformations,
): ServiceInitializer<D, (parameters: P) => Promise<R>> {
  name = name || handlerFunction[SPECIAL_PROPS.NAME];
  dependencies = dependencies || handlerFunction[SPECIAL_PROPS.INJECT] || [];

  if (!name) {
    throw new YError('E_NO_HANDLER_NAME', handlerFunction);
  }

  return initializer(
    {
      name,
      type: 'service',
      inject: dependencies,
      singleton,
      extra,
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
export function autoHandler<
  D extends Dependencies,
  V,
  P extends Parameters<V>,
  U extends unknown[],
  R
>(
  handlerFunction: HandlerFunction<D, V, P, U, R>,
): ServiceInitializer<D, (parameters: P) => Promise<R>> {
  const name = readFunctionName(handlerFunction);
  const source = handlerFunction.toString();
  const dependencies = parseInjections(source);

  return initializer(
    {
      name,
      type: 'service',
      inject: dependencies,
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
export function parseDependencyDeclaration(
  dependencyDeclaration: DependencyDeclaration,
): ParsedDependencyDeclaration {
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

/**
 * Stringify a dependency declaration from its parts.
 * @param  {Object}  dependencyDeclarationParts
 * A dependency declaration string
 * @return {String}
 * The various parts of it
 * @example
 * stringifyDependencyDeclaration({
 *   serviceName: 'pgsql',
 *   mappedName: 'db',
 *   optional: false,
 * });
 *
 * // Returns
 * 'pgsql>db'
 */
export function stringifyDependencyDeclaration(
  dependencyDeclarationParts: ParsedDependencyDeclaration,
): DependencyDeclaration {
  return `${dependencyDeclarationParts.optional ? '?' : ''}${
    dependencyDeclarationParts.serviceName
  }${
    dependencyDeclarationParts.mappedName !==
    dependencyDeclarationParts.serviceName
      ? '>' + dependencyDeclarationParts.mappedName
      : ''
  }`;
}
