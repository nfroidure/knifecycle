/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint max-len: ["warn", { "ignoreComments": true }] @typescript-eslint/no-this-alias: "warn" */
import {
  SPECIAL_PROPS,
  SPECIAL_PROPS_PREFIX,
  DECLARATION_SEPARATOR,
  OPTIONAL_FLAG,
  ALLOWED_INITIALIZER_TYPES,
  ALLOWED_SPECIAL_PROPS,
  parseInjections,
  readFunctionName,
  reuseSpecialProps,
  parseName,
  name,
  autoName,
  inject,
  useInject,
  mergeInject,
  autoInject,
  alsoInject,
  type,
  extra,
  singleton,
  initializer,
  constant,
  service,
  autoService,
  provider,
  autoProvider,
  wrapInitializer,
  handler,
  autoHandler,
  parseDependencyDeclaration,
  stringifyDependencyDeclaration,
  unwrapInitializerProperties,
} from './util.js';
import initInitializerBuilder from './build.js';
import { YError } from 'yerror';
import initDebug from 'debug';
import type {
  ServiceName,
  Service,
  Disposer,
  FatalErrorPromise,
  Provider,
  Dependencies,
  DependencyDeclaration,
  ExtraInformations,
  ParsedDependencyDeclaration,
  ConstantProperties,
  ConstantInitializer,
  ProviderInitializerBuilder,
  ProviderProperties,
  ProviderInitializer,
  ProviderInputProperties,
  ServiceInitializerBuilder,
  ServiceProperties,
  ServiceInitializer,
  ServiceInputProperties,
  AsyncInitializerBuilder,
  AsyncInitializer,
  PartialAsyncInitializer,
  Initializer,
  ServiceInitializerWrapper,
  ProviderInitializerWrapper,
  HandlerFunction,
  Parameters,
} from './util.js';
import type { BuildInitializer } from './build.js';
export type {
  ServiceName,
  Service,
  Disposer,
  FatalErrorPromise,
  Provider,
  Dependencies,
  DependencyDeclaration,
  ExtraInformations,
  ParsedDependencyDeclaration,
  ConstantProperties,
  ConstantInitializer,
  ProviderInitializerBuilder,
  ProviderProperties,
  ProviderInitializer,
  ProviderInputProperties,
  ServiceInitializerBuilder,
  ServiceProperties,
  ServiceInitializer,
  ServiceInputProperties,
  AsyncInitializerBuilder,
  AsyncInitializer,
  PartialAsyncInitializer,
  Initializer,
  ServiceInitializerWrapper,
  ProviderInitializerWrapper,
  HandlerFunction,
  Parameters,
  BuildInitializer,
};

export interface Injector<T extends Record<string, unknown>> {
  (dependencies: DependencyDeclaration[]): Promise<T>;
}
export interface Autoloader<
  T extends Initializer<unknown, Record<string, unknown>>,
> {
  (name: DependencyDeclaration): Promise<{
    initializer: T;
    path: string;
  }>;
}
export interface SiloContext<S> {
  name: string;
  servicesDescriptors: Map<DependencyDeclaration, Promise<Provider<S>>>;
  servicesSequence: DependencyDeclaration[][];
  servicesShutdownsPromises: Map<DependencyDeclaration, Promise<void>>;
  errorsPromises: Promise<void>[];
  shutdownPromise?: Promise<void>;
  throwFatalError?: (err: Error) => void;
}
export type FatalErrorService = {
  promise: Promise<void>;
};

export type InternalDependencies = {
  $dispose: Disposer;
  $autoload: Autoloader<Initializer<unknown, Record<string, unknown>>>;
  $injector: Injector<Record<string, unknown>>;
  $instance: Knifecycle;
  $siloContext: SiloContext<unknown>;
  $fatalError: FatalErrorService;
};

const debug = initDebug('knifecycle');

const DISPOSE = '$dispose';
const AUTOLOAD = '$autoload';
const INJECTOR = '$injector';
const INSTANCE = '$instance';
const SILO_CONTEXT = '$siloContext';
const FATAL_ERROR = '$fatalError';

const E_BAD_AUTOLOADED_INITIALIZER = 'E_BAD_AUTOLOADED_INITIALIZER';
const E_AUTOLOADED_INITIALIZER_MISMATCH = 'E_AUTOLOADED_INITIALIZER_MISMATCH';
const E_UNMATCHED_DEPENDENCY = 'E_UNMATCHED_DEPENDENCY';
const E_CIRCULAR_DEPENDENCY = 'E_CIRCULAR_DEPENDENCY';
const E_BAD_SERVICE_PROVIDER = 'E_BAD_SERVICE_PROVIDER';
const E_BAD_SERVICE_PROMISE = 'E_BAD_SERVICE_PROMISE';
const E_INSTANCE_DESTROYED = 'E_INSTANCE_DESTROYED';
const E_AUTOLOADER_DYNAMIC_DEPENDENCY = 'E_AUTOLOADER_DYNAMIC_DEPENDENCY';
const E_BAD_CLASS = 'E_BAD_CLASS';
const E_UNDEFINED_CONSTANT_INITIALIZER = 'E_UNDEFINED_CONSTANT_INITIALIZER';
const E_BAD_VALUED_NON_CONSTANT_INITIALIZER =
  'E_BAD_VALUED_NON_CONSTANT_INITIALIZER';

/* Architecture Note #1: Knifecycle

The `knifecycle` project is intended to be a [dependency
 injection](https://en.wikipedia.org/wiki/Dependency_injection)
 with [inversion of control](https://en.wikipedia.org/wiki/Inversion_of_control)
 tool. It will always be tied to this goal since I prefer
 composing software instead of using frameworks and DI/IC is
 a major part to design strong software in my opinion.

It is designed to have a low footprint on services code.
 There is nothing worse than having to write specific code for
 a given tool. With `knifecycle`, services can be either constants,
 functions or objects created synchronously or asynchronously. They
 can be reused elsewhere (even when not using DI) with no changes
 at all since they are just simple functions with annotations
 set as a property.
*/

/* Architecture Note #1.1: OOP
The `knifecycle` use case is one of the rare use case where
 [OOP](https://en.wikipedia.org/wiki/Object-oriented_programming)
 principles are a good fit.

A service provider is full of state since its concern is
 precisely to
 [encapsulate](https://en.wikipedia.org/wiki/Encapsulation_(computer_programming))
 your application global states.
*/
class Knifecycle {
  private _silosCounter: number;
  private _silosContexts: Set<SiloContext<unknown>>;
  private _initializers: Map<
    string,
    ProviderInitializer<Record<string, unknown>, unknown>
  >;
  private _initializerResolvers: Map<
    string,
    Promise<ProviderInitializer<Record<string, unknown>, unknown>>
  >;
  private _singletonsServicesHandles: Map<string, Set<string>>;
  private _singletonsServicesDescriptors: Map<
    string,
    {
      promise: Promise<Provider<unknown>>;
      preloaded: boolean;
    }
  >;
  private _singletonsServicesShutdownsPromises: Map<string, Promise<void>>;
  private shutdownPromise?: Promise<void>;

  /**
   * Create a new Knifecycle instance
   * @return {Knifecycle}
   * The Knifecycle instance
   * @example
   *
   * import Knifecycle from 'knifecycle'
   *
   * const $ = new Knifecycle();
   */
  constructor() {
    this._silosCounter = 0;
    this._silosContexts = new Set();
    this._initializers = new Map();
    this._initializerResolvers = new Map();
    this._singletonsServicesHandles = new Map();
    this._singletonsServicesDescriptors = new Map();
    this._singletonsServicesShutdownsPromises = new Map();
    this.register(constant(INSTANCE, this));

    const initInjectorProvider = provider(
      async ({ $siloContext }: { $siloContext: SiloContext<unknown> }) => ({
        service: async (dependenciesDeclarations: DependencyDeclaration[]) =>
          _buildFinalHash(
            await this._initializeDependencies(
              $siloContext,
              $siloContext.name,
              dependenciesDeclarations,
              { injectorContext: true, autoloading: false },
            ),
            dependenciesDeclarations,
          ),
      }),
      INJECTOR,
      [SILO_CONTEXT],
      // Despite its global definition, the injector
      // depends on the silo context and then needs
      // to be instanciated once per silo.
      false,
    );

    this.register(initInjectorProvider);
  }

  /* Architecture Note #1.3: Registering initializers

  The first step to use `knifecycle` is to create a new
   `Knifecycle` instance and register the previously
   created initializers.

  Initializers can be of three types:
  - constants: a `constant` initializer resolves to
   a constant value.
  - services: a `service` initializer directly
   resolve to the actual service it builds. It can
   be objects, functions or litteral values.
  - providers: they instead resolve to an object that
   contains the service built into the `service` property
   but also an optional `dispose` property exposing a
   method to properly stop the service and a
   `fatalErrorPromise` that will be rejected if an
   unrecoverable error happens.

   Initializers can be declared as singletons. This means
    that they will be instanciated once for all for each
    executions silos using them (we will cover this
    topic later on).
  */

  /**
   * Register an initializer
   * @param  {Function}   initializer
   * An initializer
   * @return {Knifecycle}
   * The Knifecycle instance (for chaining)
   */
  register<T extends Initializer<unknown, any>>(initializer: T): Knifecycle {
    if (this.shutdownPromise) {
      throw new YError(E_INSTANCE_DESTROYED);
    }

    unwrapInitializerProperties(initializer);

    // Temporary cast constants into providers
    // Best would be to threat each differently
    // at dependencies initialization level to boost performances
    if (initializer[SPECIAL_PROPS.TYPE] === 'constant') {
      const value = initializer[SPECIAL_PROPS.VALUE];

      if ('undefined' === typeof value) {
        throw new YError(
          E_UNDEFINED_CONSTANT_INITIALIZER,
          initializer[SPECIAL_PROPS.NAME],
        );
      }

      initializer = provider(
        async () => ({
          service: value,
        }),
        initializer[SPECIAL_PROPS.NAME],
        [],
        true,
      ) as T;

      // Needed for the build utils to still recognize
      // this initializer as a constant value
      initializer[SPECIAL_PROPS.VALUE] = value;
      initializer[SPECIAL_PROPS.TYPE] = 'constant';
    } else if ('undefined' !== typeof initializer[SPECIAL_PROPS.VALUE]) {
      throw new YError(
        E_BAD_VALUED_NON_CONSTANT_INITIALIZER,
        initializer[SPECIAL_PROPS.NAME],
      );
    }

    // Temporary cast service initializers into
    // providers. Best would be to threat each differently
    // at dependencies initialization level to boost performances
    if ('service' === initializer[SPECIAL_PROPS.TYPE]) {
      initializer = reuseSpecialProps(
        initializer,
        serviceAdapter.bind(
          null,
          initializer[SPECIAL_PROPS.NAME] as string,
          initializer as ServiceInitializer<Record<string, unknown>, unknown>,
        ),
      ) as T;
      initializer[SPECIAL_PROPS.TYPE] = 'provider';
    }

    const initializerDependsOfItself = initializer[SPECIAL_PROPS.INJECT]
      .map(_pickServiceNameFromDeclaration)
      .includes(initializer[SPECIAL_PROPS.NAME]);

    if (initializerDependsOfItself) {
      throw new YError(E_CIRCULAR_DEPENDENCY, initializer[SPECIAL_PROPS.NAME]);
    }

    initializer[SPECIAL_PROPS.INJECT].forEach((dependencyDeclaration) => {
      this._lookupCircularDependencies(
        initializer[SPECIAL_PROPS.NAME],
        dependencyDeclaration,
      );
    });

    if (this._initializers.has(initializer[SPECIAL_PROPS.NAME])) {
      const initializedAsSingleton =
        this._singletonsServicesHandles.has(initializer[SPECIAL_PROPS.NAME]) &&
        this._singletonsServicesDescriptors.has(
          initializer[SPECIAL_PROPS.NAME],
        ) &&
        !this._singletonsServicesDescriptors.get(
          initializer[SPECIAL_PROPS.NAME],
        )?.preloaded;
      const initializedAsInstance = [...this._silosContexts.values()].some(
        (siloContext) =>
          siloContext.servicesSequence.some((sequence) =>
            sequence.includes(initializer[SPECIAL_PROPS.NAME]),
          ),
      );
      if (initializedAsSingleton || initializedAsInstance) {
        throw new YError(
          'E_INITIALIZER_ALREADY_INSTANCIATED',
          initializer[SPECIAL_PROPS.NAME],
        );
      }
      debug(`Overridden an initializer: ${initializer[SPECIAL_PROPS.NAME]}`);
    } else {
      debug(`Registered an initializer: ${initializer[SPECIAL_PROPS.NAME]}`);
    }

    // Constants are singletons and constant so we can set it
    // to singleton services descriptors map directly
    if ('constant' === initializer[SPECIAL_PROPS.TYPE]) {
      const handlesSet = new Set<string>();

      this._singletonsServicesHandles.set(
        initializer[SPECIAL_PROPS.NAME],
        handlesSet,
      );
      this._singletonsServicesDescriptors.set(initializer[SPECIAL_PROPS.NAME], {
        preloaded: true,
        // We do not directly use initializer[SPECIAL_PROPS.VALUE] here
        // since it looks like there is a bug with Babel build that
        // change functions to empty litteral objects
        promise: (
          initializer as ProviderInitializer<Record<string, unknown>, unknown>
        )({}),
      });
    }

    this._initializers.set(
      initializer[SPECIAL_PROPS.NAME],
      initializer as ProviderInitializer<Record<string, unknown>, unknown>,
    );
    return this;
  }

  _lookupCircularDependencies(
    rootServiceName: ServiceName,
    dependencyDeclaration: DependencyDeclaration,
    declarationsStacks: DependencyDeclaration[] = [],
  ): void {
    const serviceName = _pickServiceNameFromDeclaration(dependencyDeclaration);
    const dependencyProvider = this._initializers.get(serviceName);

    if (!dependencyProvider) {
      return;
    }
    declarationsStacks = declarationsStacks.concat(dependencyDeclaration);
    dependencyProvider[SPECIAL_PROPS.INJECT].forEach(
      (childDependencyDeclaration) => {
        const childServiceName = _pickServiceNameFromDeclaration(
          childDependencyDeclaration,
        );

        if (rootServiceName === childServiceName) {
          throw new YError(
            E_CIRCULAR_DEPENDENCY,
            ...[rootServiceName]
              .concat(declarationsStacks)
              .concat(childDependencyDeclaration),
          );
        }

        this._lookupCircularDependencies(
          rootServiceName,
          childDependencyDeclaration,
          declarationsStacks,
        );
      },
    );
  }

  /**
   * Outputs a Mermaid compatible dependency graph of the declared services.
   * See [Mermaid docs](https://github.com/knsv/mermaid)
   * @param {Object} options
   * Options for generating the graph (destructured)
   * @param {Array<Object>} options.shapes
   * Various shapes to apply
   * @param {Array<Object>} options.styles
   * Various styles to apply
   * @param {Object} options.classes
   * A hash of various classes contents
   * @return {String}
   * Returns a string containing the Mermaid dependency graph
   * @example
   *
   * import Knifecycle, { inject, constant, service } from 'knifecycle';
   * import appInitializer from './app';
   *
   * const $ = new Knifecycle();
   *
   * $.register(constant('ENV', process.env));
   * $.register(constant('OS', require('os')));
   * $.register(service('app', inject(['ENV', 'OS'], appInitializer)));
   * $.toMermaidGraph();
   *
   * // returns
   * graph TD
   *   app-->ENV
   *   app-->OS
   */

  toMermaidGraph(
    {
      shapes = [],
      styles = [],
      classes = {},
    }: {
      shapes?: MermaidShapes;
      styles?: MermaidStyles;
      classes?: MermaidClasses;
    } = {
      shapes: [],
      styles: [],
      classes: {},
    },
  ): string {
    const servicesProviders = this._initializers;
    const links: MermaidLink[] = Array.from(servicesProviders.keys())
      .filter((provider) => !provider.startsWith('$'))
      .reduce((links, serviceName) => {
        const serviceProvider = servicesProviders.get(
          serviceName,
        ) as ProviderInitializer<Record<string, unknown>, unknown>;

        if (!serviceProvider[SPECIAL_PROPS.INJECT].length) {
          return links;
        }
        return links.concat(
          serviceProvider[SPECIAL_PROPS.INJECT].map((dependencyDeclaration) => {
            const dependedServiceName = _pickServiceNameFromDeclaration(
              dependencyDeclaration,
            );

            return { serviceName, dependedServiceName };
          }),
        );
      }, []);
    const classesApplications = _applyClasses(classes, styles, links);

    if (!links.length) {
      return '';
    }

    return ['graph TD']
      .concat(
        links.map(
          ({ serviceName, dependedServiceName }) =>
            `  ${_applyShapes(shapes, serviceName) || serviceName}-->${
              _applyShapes(shapes, dependedServiceName) || dependedServiceName
            }`,
        ),
      )
      .concat(
        Object.keys(classes).map(
          (className) => `  classDef ${className} ${classes[className]}`,
        ),
      )
      .concat(
        Object.keys(classesApplications).map(
          (serviceName) =>
            `  class ${serviceName} ${classesApplications[serviceName]};`,
        ),
      )
      .join('\n');
  }

  /* Architecture Note #1.4: Execution silos
  Once every initializers are registered, we need a way to bring
   them to life. Execution silos are where the magic happens.
   For each call of the `run` method with given dependencies,
   a new silo is created and the required environment to
   run the actual code is leveraged.

  Depending on your application design, you could run it
   in only one execution silo or into several ones
   according to the isolation level your wish to reach.
  */

  /**
   * Creates a new execution silo
   * @param  {String[]}   dependenciesDeclarations
   * Service name.
   * @return {Promise}
   * Service descriptor promise
   * @example
   *
   * import Knifecycle, { constant } from 'knifecycle'
   *
   * const $ = new Knifecycle();
   *
   * $.register(constant('ENV', process.env));
   * $.run(['ENV'])
   * .then(({ ENV }) => {
   *  // Here goes your code
   * })
   */
  async run<ID extends Record<string, unknown>>(
    dependenciesDeclarations: DependencyDeclaration[],
  ): Promise<ID> {
    const _this = this;
    const internalDependencies = [
      ...new Set(dependenciesDeclarations.concat(DISPOSE)),
    ];
    const siloContext: SiloContext<unknown> = {
      name: `silo-${this._silosCounter++}`,
      servicesDescriptors: new Map(),
      servicesSequence: [],
      servicesShutdownsPromises: new Map(),
      errorsPromises: [],
    };

    if (this.shutdownPromise) {
      throw new YError(E_INSTANCE_DESTROYED);
    }

    // Create a provider for the special fatal error service
    siloContext.servicesDescriptors.set(
      FATAL_ERROR,
      Promise.resolve({
        service: {
          promise: new Promise<void>((_resolve, reject) => {
            siloContext.throwFatalError = (err) => {
              debug('Handled a fatal error', err);
              reject(err);
            };
          }),
        },
      }),
    );

    // Make the siloContext available for internal injections
    siloContext.servicesDescriptors.set(
      SILO_CONTEXT,
      Promise.resolve({
        service: siloContext,
      }),
    );
    // Create a provider for the shutdown special dependency
    siloContext.servicesDescriptors.set(
      DISPOSE,
      Promise.resolve({
        service: async () => {
          siloContext.shutdownPromise =
            siloContext.shutdownPromise ||
            _shutdownNextServices(siloContext.servicesSequence);

          debug('Shutting down services');

          await siloContext.shutdownPromise;

          this._silosContexts.delete(siloContext);

          // Shutdown services in their instanciation order
          async function _shutdownNextServices(reversedServiceSequence) {
            if (0 === reversedServiceSequence.length) {
              return;
            }

            await Promise.all(
              reversedServiceSequence.pop().map(async (serviceName) => {
                const singletonServiceDescriptor =
                  await _this._pickupSingletonServiceDescriptorPromise(
                    serviceName,
                  );
                const serviceDescriptor =
                  singletonServiceDescriptor ||
                  (await siloContext.servicesDescriptors.get(serviceName));
                let serviceShutdownPromise: Promise<void> | undefined =
                  _this._singletonsServicesShutdownsPromises.get(serviceName) ||
                  siloContext.servicesShutdownsPromises.get(serviceName);

                if (serviceShutdownPromise) {
                  debug('Reusing a service shutdown promise:', serviceName);
                  return serviceShutdownPromise;
                }

                if (
                  reversedServiceSequence.some((servicesDeclarations) =>
                    servicesDeclarations.includes(serviceName),
                  )
                ) {
                  debug('Delaying service shutdown:', serviceName);
                  return Promise.resolve();
                }
                if (singletonServiceDescriptor) {
                  const handleSet = _this._singletonsServicesHandles.get(
                    serviceName,
                  ) as Set<string>;

                  handleSet.delete(siloContext.name);
                  if (handleSet.size) {
                    debug(
                      'Singleton is used elsewhere:',
                      serviceName,
                      handleSet,
                    );
                    return Promise.resolve();
                  }
                  _this._singletonsServicesDescriptors.delete(serviceName);
                }
                debug('Shutting down a service:', serviceName);
                serviceShutdownPromise = serviceDescriptor?.dispose
                  ? serviceDescriptor.dispose()
                  : Promise.resolve();
                if (singletonServiceDescriptor) {
                  _this._singletonsServicesShutdownsPromises.set(
                    serviceName,
                    serviceShutdownPromise,
                  );
                }
                siloContext.servicesShutdownsPromises.set(
                  serviceName,
                  serviceShutdownPromise,
                );
                return serviceShutdownPromise;
              }),
            );

            await _shutdownNextServices(reversedServiceSequence);
          }
        },
        dispose: Promise.resolve.bind(Promise),
      }),
    );

    this._silosContexts.add(siloContext);

    const servicesHash = await this._initializeDependencies(
      siloContext,
      siloContext.name,
      internalDependencies,
      { injectorContext: false, autoloading: false },
    );

    debug('Handling fatal errors:', siloContext.errorsPromises);
    Promise.all(siloContext.errorsPromises).catch(siloContext.throwFatalError);

    return _buildFinalHash(
      servicesHash,
      dependenciesDeclarations,
    ) as unknown as ID;
  }

  /**
   * Destroy the Knifecycle instance
   * @return {Promise}
   * Full destruction promise
   * @example
   *
   * import Knifecycle, { constant } from 'knifecycle'
   *
   * const $ = new Knifecycle();
   *
   * $.register(constant('ENV', process.env));
   * $.run(['ENV'])
   * .then(({ ENV }) => {
   *    // Here goes your code
   *
   *    // Finally destroy the instance
   *    $.destroy()
   * })
   */
  async destroy(): Promise<void> {
    this.shutdownPromise =
      this.shutdownPromise ||
      Promise.all(
        [...this._silosContexts].map(async (siloContext) => {
          const $dispose = (await siloContext.servicesDescriptors.get(DISPOSE))
            ?.service as Disposer;

          return $dispose();
        }),
      ).then(() => undefined);

    debug('Shutting down Knifecycle instance.');

    return this.shutdownPromise;
  }

  /**
   * Initialize or return a service descriptor
   * @param  {Object}     siloContext
   * Current execution silo context
   * @param  {String}     serviceName
   * Service name.
   * @param  {Object}     options
   * Options for service retrieval
   * @param  {Boolean}    options.injectorContext
   * Flag indicating the injection were initiated by the $injector
   * @param  {Boolean}    options.autoloading
   * Flag to indicating $autoload dependencies on the fly loading
   * @param  {String}     serviceProvider
   * Service provider.
   * @return {Promise}
   * Service descriptor promise.
   */
  async _getServiceDescriptor(
    siloContext: SiloContext<unknown>,
    serviceName: ServiceName,
    {
      injectorContext,
      autoloading,
    }: { injectorContext: boolean; autoloading: boolean },
  ): Promise<Provider<unknown>> {
    // Try to get service descriptior early from the silo context
    let serviceDescriptorPromise =
      siloContext.servicesDescriptors.get(serviceName);
    if (serviceDescriptorPromise) {
      if (autoloading) {
        debug(
          `⚠️ - Possible dead lock due to reusing "${serviceName}" from the silo context while autoloading.`,
        );
      }
      return serviceDescriptorPromise;
    }

    const initializer = await this._findInitializer(siloContext, serviceName, {
      injectorContext,
      autoloading,
    });

    serviceDescriptorPromise = this._pickupSingletonServiceDescriptorPromise(
      serviceName,
    ) as Promise<Provider<unknown>>;

    if (serviceDescriptorPromise as Promise<Provider<unknown>> | undefined) {
      if (autoloading) {
        debug(
          `⚠️ - Possible dead lock due to reusing the singleton "${serviceName}" while autoloading.`,
        );
      }
      (this._singletonsServicesHandles.get(serviceName) as Set<string>).add(
        siloContext.name,
      );
    } else {
      serviceDescriptorPromise =
        siloContext.servicesDescriptors.get(serviceName);
    }

    if (serviceDescriptorPromise) {
      return serviceDescriptorPromise;
    }

    // The $injector service is mainly intended to be used as a workaround
    // for unavoidable circular dependencies. It rarely make sense to
    // instanciate new services at this level so printing a warning for
    // debug purposes
    if (injectorContext) {
      debug(
        'Warning: Instantiating a new service via the $injector. It may' +
          ' mean that you no longer need it if your worked around a circular' +
          ' dependency.',
      );
    }

    serviceDescriptorPromise = this._initializeServiceDescriptor(
      siloContext,
      serviceName,
      initializer,
      {
        autoloading: autoloading || AUTOLOAD === serviceName,
        injectorContext,
      },
    );

    if (initializer[SPECIAL_PROPS.SINGLETON]) {
      const handlesSet = new Set<string>();

      handlesSet.add(siloContext.name);
      this._singletonsServicesHandles.set(serviceName, handlesSet);
      this._singletonsServicesDescriptors.set(serviceName, {
        preloaded: false,
        promise: serviceDescriptorPromise,
      });
    } else {
      siloContext.servicesDescriptors.set(
        serviceName,
        serviceDescriptorPromise,
      );
    }
    // Since the autoloader is a bit special it must be pushed here
    if (AUTOLOAD === serviceName) {
      siloContext.servicesSequence.unshift([AUTOLOAD]);
    }
    return serviceDescriptorPromise;
  }

  async _findInitializer(
    siloContext: SiloContext<unknown>,
    serviceName: ServiceName,
    {
      injectorContext,
      autoloading,
    }: { injectorContext: boolean; autoloading: boolean },
  ): Promise<ProviderInitializer<Record<string, unknown>, unknown>> {
    const initializer = this._initializers.get(serviceName);

    if (initializer) {
      return initializer;
    }

    // The auto loader must only have static dependencies
    // and we have to do this check here to avoid caching
    // non-autoloading request and then be blocked by an
    // autoloader dep that waits for that cached load
    if (autoloading) {
      throw new YError(E_AUTOLOADER_DYNAMIC_DEPENDENCY, serviceName);
    }

    debug('No service provider:', serviceName);

    let initializerPromise = this._initializerResolvers.get(serviceName);

    if (initializerPromise) {
      return await initializerPromise;
    }

    initializerPromise = (async () => {
      if (!this._initializers.get(AUTOLOAD)) {
        throw new YError(E_UNMATCHED_DEPENDENCY, serviceName);
      }
      debug(`Loading the $autoload service to lookup for: ${serviceName}.`);
      try {
        const autoloadingDescriptor = (await this._getServiceDescriptor(
          siloContext,
          AUTOLOAD,
          { injectorContext, autoloading: true },
        )) as Provider<
          Autoloader<Initializer<unknown, Record<string, unknown>>>
        >;
        const { initializer, path } = await autoloadingDescriptor.service(
          serviceName,
        );

        if (
          typeof initializer !== 'function' &&
          (typeof initializer !== 'object' ||
            initializer[SPECIAL_PROPS.TYPE] !== 'constant')
        ) {
          throw new YError(
            E_BAD_AUTOLOADED_INITIALIZER,
            serviceName,
            initializer,
          );
        }

        if (initializer[SPECIAL_PROPS.NAME] !== serviceName) {
          throw new YError(
            E_AUTOLOADED_INITIALIZER_MISMATCH,
            serviceName,
            initializer[SPECIAL_PROPS.NAME],
          );
        }

        debug(`Loaded the ${serviceName} initializer at path ${path}.`);
        this.register(initializer);
        this._initializerResolvers.delete(serviceName);
        // Here we need to pick-up the registered initializer to
        // have a universally usable intitializer
        return this._initializers.get(serviceName);
      } catch (err) {
        debug(`Could not load ${serviceName} via the auto loader.`);
        throw err;
      }
    })() as Promise<ProviderInitializer<Record<string, unknown>, unknown>>;

    this._initializerResolvers.set(
      serviceName,
      initializerPromise as Promise<
        ProviderInitializer<Record<string, unknown>, unknown>
      >,
    );

    return await (initializerPromise as Promise<
      ProviderInitializer<Record<string, unknown>, unknown>
    >);
  }

  _pickupSingletonServiceDescriptorPromise(
    serviceName: ServiceName,
  ): Promise<Provider<unknown>> | void {
    const serviceDescriptor =
      this._singletonsServicesDescriptors.get(serviceName);

    if (!serviceDescriptor) {
      return;
    }

    serviceDescriptor.preloaded = false;

    return serviceDescriptor.promise;
  }

  /**
   * Initialize a service descriptor
   * @param  {Object}     siloContext
   * Current execution silo context
   * @param  {String}     serviceName
   * Service name.
   * @param  {Object}     options
   * Options for service retrieval
   * @param  {Boolean}    options.injectorContext
   * Flag indicating the injection were initiated by the $injector
   * @param  {Boolean}    options.autoloading
   * Flag to indicating $autoload dependendencies on the fly loading.
   * @return {Promise}
   * Service dependencies hash promise.
   */
  async _initializeServiceDescriptor(
    siloContext: SiloContext<unknown>,
    serviceName: ServiceName,
    initializer: ProviderInitializer<Record<string, unknown>, unknown>,
    {
      autoloading,
      injectorContext,
    }: { autoloading: boolean; injectorContext: boolean },
  ): Promise<Provider<unknown>> {
    let serviceDescriptor: Provider<unknown>;

    debug('Initializing a service descriptor:', serviceName);

    try {
      // A singleton service may use a reserved resource
      // like a TCP socket. This is why we have to be aware
      // of singleton services full shutdown before creating
      // a new one

      await (this._singletonsServicesShutdownsPromises.get(serviceName) ||
        Promise.resolve());
      // Anyway delete any shutdown promise before instanciating
      // a new service
      this._singletonsServicesShutdownsPromises.delete(serviceName);
      siloContext.servicesShutdownsPromises.delete(serviceName);

      const servicesHash = await this._initializeDependencies(
        siloContext,
        serviceName,
        initializer[SPECIAL_PROPS.INJECT],
        { injectorContext, autoloading },
      );

      debug('Successfully gathered service dependencies:', serviceName);

      serviceDescriptor = await initializer(
        initializer[SPECIAL_PROPS.INJECT].reduce(
          (finalHash, dependencyDeclaration) => {
            const { serviceName, mappedName } = parseDependencyDeclaration(
              dependencyDeclaration,
            );

            finalHash[serviceName] = servicesHash[mappedName];
            return finalHash;
          },
          {},
        ),
      );

      if (!serviceDescriptor) {
        debug('Provider did not return a descriptor:', serviceName);
        return Promise.reject(new YError(E_BAD_SERVICE_PROVIDER, serviceName));
      }
      debug('Successfully initialized a service descriptor:', serviceName);
      if (serviceDescriptor.fatalErrorPromise) {
        debug('Registering service descriptor error promise:', serviceName);
        siloContext.errorsPromises.push(serviceDescriptor.fatalErrorPromise);
      }
      siloContext.servicesDescriptors.set(
        serviceName,
        Promise.resolve(serviceDescriptor),
      );
    } catch (err) {
      debug(
        'Error initializing a service descriptor:',
        serviceName,
        (err as Error).stack || 'no_stack_trace',
      );
      if (E_UNMATCHED_DEPENDENCY === (err as YError).code) {
        throw YError.wrap(
          err as Error,
          E_UNMATCHED_DEPENDENCY,
          ...[serviceName].concat((err as YError).params),
        );
      }
      throw err;
    }
    return serviceDescriptor;
  }

  /**
   * Initialize a service dependencies
   * @param  {Object}     siloContext
   * Current execution silo siloContext
   * @param  {String}     serviceName
   * Service name.
   * @param  {String}     servicesDeclarations
   * Dependencies declarations.
   * @param  {Object}     options
   * Options for service retrieval
   * @param  {Boolean}    options.injectorContext
   * Flag indicating the injection were initiated by the $injector
   * @param  {Boolean}    options.autoloading
   * Flag to indicating $autoload dependendencies on the fly loading.
   * @return {Promise}
   * Service dependencies hash promise.
   */
  async _initializeDependencies(
    siloContext: SiloContext<unknown>,
    serviceName: ServiceName,
    servicesDeclarations: DependencyDeclaration[],
    {
      injectorContext = false,
      autoloading = false,
    }: { autoloading: boolean; injectorContext: boolean },
  ): Promise<Dependencies> {
    debug('Initializing dependencies:', serviceName, servicesDeclarations);
    const servicesDescriptors: (Provider<unknown> | undefined)[] =
      await Promise.all(
        servicesDeclarations.map(async (serviceDeclaration) => {
          const { mappedName, optional } =
            parseDependencyDeclaration(serviceDeclaration);

          try {
            const serviceDescriptor = await this._getServiceDescriptor(
              siloContext,
              mappedName,
              {
                injectorContext,
                autoloading,
              },
            );
            return serviceDescriptor;
          } catch (err) {
            if (
              optional &&
              [
                'E_UNMATCHED_DEPENDENCY',
                E_AUTOLOADER_DYNAMIC_DEPENDENCY,
              ].includes((err as YError).code)
            ) {
              debug(
                'Optional dependency not found:',
                serviceDeclaration,
                (err as Error).stack || 'no_stack_trace',
              );
              return;
            }
            throw err;
          }
        }),
      );
    debug(
      'Initialized dependencies descriptors:',
      serviceName,
      servicesDeclarations,
      servicesDescriptors,
    );
    siloContext.servicesSequence.push(
      servicesDeclarations
        .filter((_, index) => servicesDescriptors[index])
        .map(_pickMappedNameFromDeclaration),
    );

    const services = await Promise.all(
      servicesDescriptors.map(async (serviceDescriptor) => {
        if (!serviceDescriptor) {
          return undefined;
        }
        return serviceDescriptor.service;
      }),
    );

    return services.reduce<Record<string, unknown>>((hash, service, index) => {
      const mappedName = _pickMappedNameFromDeclaration(
        servicesDeclarations[index],
      );

      hash[mappedName] = service;
      return hash;
    }, {});
  }
}

export {
  SPECIAL_PROPS,
  SPECIAL_PROPS_PREFIX,
  DECLARATION_SEPARATOR,
  OPTIONAL_FLAG,
  ALLOWED_INITIALIZER_TYPES,
  ALLOWED_SPECIAL_PROPS,
  parseInjections,
  readFunctionName,
  parseName,
  Knifecycle,
  initializer,
  name,
  autoName,
  type,
  inject,
  useInject,
  mergeInject,
  autoInject,
  alsoInject,
  extra,
  singleton,
  reuseSpecialProps,
  wrapInitializer,
  constant,
  service,
  autoService,
  provider,
  autoProvider,
  handler,
  autoHandler,
  parseDependencyDeclaration,
  stringifyDependencyDeclaration,
  unwrapInitializerProperties,
  initInitializerBuilder,
};

function _pickServiceNameFromDeclaration(
  dependencyDeclaration: DependencyDeclaration,
): ServiceName {
  const { serviceName } = parseDependencyDeclaration(dependencyDeclaration);

  return serviceName;
}

function _pickMappedNameFromDeclaration(
  dependencyDeclaration: DependencyDeclaration,
): ServiceName {
  const { mappedName } = parseDependencyDeclaration(dependencyDeclaration);

  return mappedName;
}

function _applyShapes(shapes, serviceName) {
  return shapes.reduce((shapedService, shape) => {
    if (shapedService) {
      return shapedService;
    }

    const matches = shape.pattern.exec(serviceName);

    if (!matches) {
      return shapedService;
    }
    return shape.template.replace(
      /\$([0-9])+/g,
      ($, $1) => matches[parseInt($1, 10)],
    );
  }, '');
}

type MermaidShapes = {
  pattern: RegExp;
  template: string;
}[];
type MermaidLink = { serviceName: string; dependedServiceName: string };
type MermaidStyles = {
  pattern: RegExp;
  className: string;
}[];
type MermaidClasses = {
  [name: string]: string;
};

function _applyClasses(
  classes: MermaidClasses,
  styles: MermaidStyles,
  links: MermaidLink[],
) {
  return links.reduce(
    (classesApplications, link) =>
      Object.assign(classesApplications, _applyStyles(classes, styles, link)),
    {},
  );
}

function _applyStyles(
  classes: MermaidClasses,
  styles: MermaidStyles,
  {
    serviceName,
    dependedServiceName,
  }: { serviceName: string; dependedServiceName: string },
): MermaidClasses {
  return styles.reduce((classesApplications, style) => {
    if (style.pattern.test(serviceName) && !classesApplications[serviceName]) {
      if (!classes[style.className]) {
        throw new YError(E_BAD_CLASS, style.className, serviceName);
      }
      classesApplications[serviceName] = style.className;
    }
    if (
      style.pattern.test(dependedServiceName) &&
      !classesApplications[dependedServiceName]
    ) {
      if (!classes[style.className]) {
        throw new YError(E_BAD_CLASS, style.className, dependedServiceName);
      }
      classesApplications[dependedServiceName] = style.className;
    }
    return classesApplications;
  }, {});
}

function serviceAdapter<
  S,
  T extends ServiceInitializer<Record<string, unknown>, S>,
>(
  serviceName: ServiceName,
  initializer: T,
  dependenciesHash: T extends ServiceInitializer<infer D, unknown> ? D : never,
): Promise<Provider<S>> {
  const servicePromise = initializer(dependenciesHash);

  if (!servicePromise || !servicePromise.then) {
    throw new YError(E_BAD_SERVICE_PROMISE, serviceName);
  }

  return servicePromise.then((_service_) => ({
    service: _service_,
  }));
}

function _buildFinalHash(
  servicesHash: { [name: string]: unknown },
  dependenciesDeclarations: DependencyDeclaration[],
): { [name: string]: unknown } {
  return dependenciesDeclarations.reduce((finalHash, dependencyDeclaration) => {
    const { serviceName, mappedName } = parseDependencyDeclaration(
      dependencyDeclaration,
    );

    finalHash[serviceName] = servicesHash[mappedName];
    return finalHash;
  }, {});
}
