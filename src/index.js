/* eslint max-len: ["warn", { "ignoreComments": true }] */
import {
  SPECIAL_PROPS,
  ALLOWED_INITIALIZER_TYPES,
  DECLARATION_SEPARATOR,
  OPTIONAL_FLAG,
  name,
  autoName,
  inject,
  autoInject,
  alsoInject,
  type,
  options,
  extra,
  reuseSpecialProps,
  initializer,
  constant,
  service,
  autoService,
  provider,
  autoProvider,
  handler,
  autoHandler,
  wrapInitializer,
  parseDependencyDeclaration,
} from './util';
import YError from 'yerror';
import initDebug from 'debug';

const debug = initDebug('knifecycle');

const DISPOSE = '$dispose';
const DESTROY = '$destroy';
const AUTOLOAD = '$autoload';
const INJECTOR = '$injector';
const INSTANCE = '$instance';
const SILO_CONTEXT = '$siloContext';
const FATAL_ERROR = '$fatalError';

const E_BAD_INITIALIZER_TYPE = 'E_BAD_INITIALIZER_TYPE';
const E_BAD_AUTOLOADED_INITIALIZER = 'E_BAD_AUTOLOADED_INITIALIZER';
const E_BAD_AUTOLOADER = 'E_BAD_AUTOLOADER';
const E_AUTOLOADED_INITIALIZER_MISMATCH = 'E_AUTOLOADED_INITIALIZER_MISMATCH';
const E_UNMATCHED_DEPENDENCY = 'E_UNMATCHED_DEPENDENCY';
const E_CIRCULAR_DEPENDENCY = 'E_CIRCULAR_DEPENDENCY';
const E_BAD_INITIALIZER = 'E_BAD_INITIALIZER';
const E_ANONYMOUS_ANALYZER = 'E_ANONYMOUS_ANALYZER';
const E_BAD_SERVICE_PROVIDER = 'E_BAD_SERVICE_PROVIDER';
const E_BAD_SERVICE_PROMISE = 'E_BAD_SERVICE_PROMISE';
const E_BAD_INJECTION = 'E_BAD_INJECTION';
const E_INSTANCE_DESTROYED = 'E_INSTANCE_DESTROYED';
const E_AUTOLOADER_DYNAMIC_DEPENDENCY = 'E_AUTOLOADER_DYNAMIC_DEPENDENCY';
const E_BAD_CLASS = 'E_BAD_CLASS';
const E_UNDEFINED_CONSTANT_INITIALIZER = 'E_UNDEFINED_CONSTANT_INITIALIZER';
const E_NON_SINGLETON_CONSTANT_INITIALIZER =
  'E_NON_SINGLETON_CONSTANT_INITIALIZER';
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
  /**
   * Create a new Knifecycle instance
   * @return {Knifecycle}     The Knifecycle instance
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
    this.register(
      initializer(
        {
          name: INJECTOR,
          type: 'provider',
          inject: [SILO_CONTEXT],
        },
        async ({ $siloContext }) => ({
          service: dependenciesDeclarations =>
            this._initializeDependencies(
              $siloContext,
              $siloContext.name,
              dependenciesDeclarations,
              { injectOnly: true },
            ),
        }),
      ),
    );
    this.register(
      initializer(
        {
          name: DESTROY,
          type: 'provider',
          inject: [],
          options: {
            singleton: true,
          },
        },
        async () => ({
          service: () => {
            this.shutdownPromise =
              this.shutdownPromise ||
              Promise.all(
                [...this._silosContexts].map(siloContext => {
                  const $dispose = siloContext.servicesDescriptors.get(DISPOSE)
                    .service;

                  return $dispose();
                }),
              );

            debug('Shutting down Knifecycle instance.');

            return this.shutdownPromise;
          },
        }),
      ),
    );
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
  register(initializer) {
    if (typeof initializer !== 'function') {
      throw new YError(E_BAD_INITIALIZER, initializer);
    }
    initializer[SPECIAL_PROPS.INJECT] = initializer[SPECIAL_PROPS.INJECT] || [];
    initializer[SPECIAL_PROPS.OPTIONS] =
      initializer[SPECIAL_PROPS.OPTIONS] || {};
    initializer[SPECIAL_PROPS.TYPE] =
      initializer[SPECIAL_PROPS.TYPE] || ALLOWED_INITIALIZER_TYPES[0];
    if (!initializer[SPECIAL_PROPS.NAME]) {
      throw new YError(E_ANONYMOUS_ANALYZER, initializer[SPECIAL_PROPS.NAME]);
    }
    if (
      initializer[SPECIAL_PROPS.NAME] === AUTOLOAD &&
      !initializer[SPECIAL_PROPS.OPTIONS].singleton
    ) {
      throw new YError(E_BAD_AUTOLOADER, initializer[SPECIAL_PROPS.OPTIONS]);
    }
    if (!ALLOWED_INITIALIZER_TYPES.includes(initializer[SPECIAL_PROPS.TYPE])) {
      throw new YError(
        E_BAD_INITIALIZER_TYPE,
        initializer[SPECIAL_PROPS.NAME],
        initializer[SPECIAL_PROPS.TYPE],
        ALLOWED_INITIALIZER_TYPES,
      );
    }
    if (initializer[SPECIAL_PROPS.TYPE] === 'constant') {
      if ('undefined' === typeof initializer[SPECIAL_PROPS.VALUE]) {
        throw new YError(
          E_UNDEFINED_CONSTANT_INITIALIZER,
          initializer[SPECIAL_PROPS.NAME],
        );
      }
      if (!initializer[SPECIAL_PROPS.OPTIONS].singleton) {
        throw new YError(
          E_NON_SINGLETON_CONSTANT_INITIALIZER,
          initializer[SPECIAL_PROPS.NAME],
        );
      }
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
        serviceAdapter.bind(null, initializer[SPECIAL_PROPS.NAME], initializer),
      );
      initializer[SPECIAL_PROPS.TYPE] = 'provider';
    }

    const initializerDependsOfItself = initializer[SPECIAL_PROPS.INJECT]
      .map(_pickServiceNameFromDeclaration)
      .includes(initializer[SPECIAL_PROPS.NAME]);

    if (initializerDependsOfItself) {
      throw new YError(E_CIRCULAR_DEPENDENCY, initializer[SPECIAL_PROPS.NAME]);
    }

    initializer[SPECIAL_PROPS.INJECT].forEach(dependencyDeclaration => {
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
        ).preloaded;
      const initializedAsInstance = [...this._silosContexts.values()].some(
        siloContext =>
          siloContext.servicesSequence.some(sequence =>
            sequence.includes(initializer[SPECIAL_PROPS.NAME]),
          ),
      );
      if (initializedAsSingleton || initializedAsInstance) {
        throw new YError(
          'E_INITIALIZER_ALREADY_INSTANCIATED',
          initializer[SPECIAL_PROPS.NAME],
        );
      }
      debug(`'Overridden an initializer: ${initializer[SPECIAL_PROPS.NAME]}`);
    } else {
      debug(`Registered an initializer: ${initializer[SPECIAL_PROPS.NAME]}`);
    }

    // Constants are singletons and constant so we can set it
    // to singleton services descriptors map directly
    if ('constant' === initializer[SPECIAL_PROPS.TYPE]) {
      const handlesSet = new Set();

      this._singletonsServicesHandles.set(
        initializer[SPECIAL_PROPS.NAME],
        handlesSet,
      );
      this._singletonsServicesDescriptors.set(initializer[SPECIAL_PROPS.NAME], {
        preloaded: true,
        promise: Promise.resolve({
          // We do not directly use initializer[SPECIAL_PROPS.VALUE] here
          // since it looks like there is a bug with Babel build that
          // change functions to empty litteral objects
          service: initializer(),
        }),
      });
    }

    this._initializers.set(initializer[SPECIAL_PROPS.NAME], initializer);
    return this;
  }

  _lookupCircularDependencies(
    rootServiceName,
    dependencyDeclaration,
    declarationsStacks = [],
  ) {
    const serviceName = _pickServiceNameFromDeclaration(dependencyDeclaration);
    const dependencyProvider = this._initializers.get(serviceName);

    if (!dependencyProvider) {
      return;
    }
    declarationsStacks = declarationsStacks.concat(dependencyDeclaration);
    dependencyProvider[SPECIAL_PROPS.INJECT].forEach(
      childDependencyDeclaration => {
        const childServiceName = _pickServiceNameFromDeclaration(
          childDependencyDeclaration,
        );

        if (rootServiceName === childServiceName) {
          throw new YError(
            ...[E_CIRCULAR_DEPENDENCY, rootServiceName]
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
   * @param {Object} options    Options for generating the graph (destructured)
   * @param {Array<Object>} options.shapes    Various shapes to apply
   * @param {Array<Object>} options.styles    Various styles to apply
   * @param {Object} options.classes    A hash of various classes contents
   * @return {String}   Returns a string containing the Mermaid dependency graph
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
  toMermaidGraph({ shapes = [], styles = [], classes = {} } = {}) {
    const servicesProviders = this._initializers;
    const links = Array.from(servicesProviders.keys())
      .filter(provider => !provider.startsWith('$'))
      .reduce((links, serviceName) => {
        const serviceProvider = servicesProviders.get(serviceName);

        if (!serviceProvider[SPECIAL_PROPS.INJECT].length) {
          return links;
        }
        return links.concat(
          serviceProvider[SPECIAL_PROPS.INJECT].map(dependencyDeclaration => {
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
            `  ${_applyShapes(shapes, serviceName) ||
              serviceName}-->${_applyShapes(shapes, dependedServiceName) ||
              dependedServiceName}`,
        ),
      )
      .concat(
        Object.keys(classes).map(
          className => `  classDef ${className} ${classes[className]}`,
        ),
      )
      .concat(
        Object.keys(classesApplications).map(
          serviceName =>
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
   * @param  {String[]}   dependenciesDeclarations    Service name.
   * @return {Promise}                         Service descriptor promise
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
  async run(dependenciesDeclarations) {
    const _this = this;
    const internalDependencies = [
      ...new Set(dependenciesDeclarations.concat(DISPOSE)),
    ];
    const siloContext = {
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
    siloContext.servicesDescriptors.set(FATAL_ERROR, {
      service: {
        promise: new Promise((resolve, reject) => {
          siloContext.throwFatalError = err => {
            debug('Handled a fatal error', err);
            reject(err);
          };
        }),
      },
    });

    // Make the siloContext available for internal injections
    siloContext.servicesDescriptors.set(SILO_CONTEXT, {
      service: siloContext,
    });
    // Create a provider for the shutdown special dependency
    siloContext.servicesDescriptors.set(DISPOSE, {
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
            reversedServiceSequence.pop().map(async serviceName => {
              const singletonServiceDescriptor = await _this._pickupSingletonServiceDescriptorPromise(
                serviceName,
              );
              const serviceDescriptor =
                singletonServiceDescriptor ||
                (await siloContext.servicesDescriptors.get(serviceName));
              let serviceShutdownPromise =
                _this._singletonsServicesShutdownsPromises.get(serviceName) ||
                siloContext.servicesShutdownsPromises.get(serviceName);

              if (serviceShutdownPromise) {
                debug('Reusing a service shutdown promise:', serviceName);
                return serviceShutdownPromise;
              }

              if (
                reversedServiceSequence.some(servicesDeclarations =>
                  servicesDeclarations.includes(serviceName),
                )
              ) {
                debug('Delaying service shutdown:', serviceName);
                return Promise.resolve();
              }
              if (singletonServiceDescriptor) {
                const handleSet = _this._singletonsServicesHandles.get(
                  serviceName,
                );

                handleSet.delete(siloContext.name);
                if (handleSet.size) {
                  debug('Singleton is used elsewhere:', serviceName, handleSet);
                  return Promise.resolve();
                }
                _this._singletonsServicesDescriptors.delete(serviceName);
              }
              debug('Shutting down a service:', serviceName);
              serviceShutdownPromise = serviceDescriptor.dispose
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
    });

    this._silosContexts.add(siloContext);

    const servicesHash = await this._initializeDependencies(
      siloContext,
      siloContext.name,
      internalDependencies,
      { injectOnly: false, autoloading: false },
    );

    debug('Handling fatal errors:', siloContext.errorsPromises);
    Promise.all(siloContext.errorsPromises).catch(siloContext.throwFatalError);

    return dependenciesDeclarations.reduce(
      (finalHash, dependencyDeclaration) => {
        const { serviceName, mappedName } = parseDependencyDeclaration(
          dependencyDeclaration,
        );

        finalHash[serviceName] = servicesHash[mappedName];
        return finalHash;
      },
      {},
    );
  }

  /**
   * Initialize or return a service descriptor
   * @param  {Object}     siloContext
   * Current execution silo context
   * @param  {String}     serviceName
   * Service name.
   * @param  {Object}     options
   * Options for service retrieval
   * @param  {Boolean}    options.injectOnly
   * Flag indicating if existing services only should be used
   * @param  {Boolean}    options.autoloading
   * Flag to indicating $autoload dependencies on the fly loading
   * @param  {String}     serviceProvider   Service provider.
   * @return {Promise}                      Service dependencies hash promise.
   */
  async _getServiceDescriptor(
    siloContext,
    serviceName,
    { injectOnly, autoloading },
  ) {
    // Try to get service descriptior early from the silo context
    let serviceDescriptorPromise = siloContext.servicesDescriptors.get(
      serviceName,
    );
    if (serviceDescriptorPromise) {
      return serviceDescriptorPromise;
    }
    let initializer = await this._findInitializer(siloContext, serviceName, {
      injectOnly,
      autoloading,
    });

    serviceDescriptorPromise = this._pickupSingletonServiceDescriptorPromise(
      serviceName,
    );

    if (serviceDescriptorPromise) {
      this._singletonsServicesHandles.get(serviceName).add(siloContext.name);
    } else {
      serviceDescriptorPromise = siloContext.servicesDescriptors.get(
        serviceName,
      );
    }

    if (serviceDescriptorPromise) {
      return serviceDescriptorPromise;
    }

    // The inject service is intended to be used as a workaround for unavoidable
    // circular dependencies. It wouldn't make sense to instanciate new services
    // at this level so throwing an error
    if (injectOnly) {
      return Promise.reject(new YError(E_BAD_INJECTION, serviceName));
    }

    serviceDescriptorPromise = this._initializeServiceDescriptor(
      siloContext,
      serviceName,
      initializer,
      {
        autoloading: autoloading || AUTOLOAD === serviceName,
        injectOnly,
      },
    );

    if (initializer[SPECIAL_PROPS.OPTIONS].singleton) {
      const handlesSet = new Set();

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
    if (AUTOLOAD === this.serviceName) {
      siloContext.servicesSequence.unshift([AUTOLOAD]);
    }
    return serviceDescriptorPromise;
  }

  async _findInitializer(
    siloContext,
    serviceName,
    { injectOnly, autoloading },
  ) {
    let initializer = this._initializers.get(serviceName);

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
        const autoloadingDescriptor = await this._getServiceDescriptor(
          siloContext,
          AUTOLOAD,
          { injectOnly, autoloading: true },
        );
        const { initializer, path } = await autoloadingDescriptor.service(
          serviceName,
        );

        if (typeof initializer !== 'function') {
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
    })();

    this._initializerResolvers.set(serviceName, initializerPromise);

    return await initializerPromise;
  }

  _pickupSingletonServiceDescriptorPromise(serviceName) {
    const serviceDescriptor = this._singletonsServicesDescriptors.get(
      serviceName,
    );

    if (!serviceDescriptor) {
      return;
    }

    serviceDescriptor.preloaded = false;

    return serviceDescriptor.promise;
  }

  /**
   * Initialize a service descriptor
   * @param  {Object}     siloContext       Current execution silo context
   * @param  {String}     serviceName       Service name.
   * @param  {Object}     options
   * Options for service retrieval
   * @param  {Boolean}    options.injectOnly
   * Flag indicating if existing services only should be used
   * @param  {Boolean}    options.autoloading
   * Flag to indicating $autoload dependendencies on the fly loading.
   * @return {Promise}                      Service dependencies hash promise.
   */
  async _initializeServiceDescriptor(
    siloContext,
    serviceName,
    initializer,
    { autoloading, injectOnly },
  ) {
    let serviceDescriptor;

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
        { injectOnly, autoloading },
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
      siloContext.servicesDescriptors.set(serviceName, serviceDescriptor);
    } catch (err) {
      debug('Error initializing a service descriptor:', serviceName, err.stack);
      if (E_UNMATCHED_DEPENDENCY === err.code) {
        throw YError.wrap(
          ...[err, E_UNMATCHED_DEPENDENCY, serviceName].concat(err.params),
        );
      }
      throw err;
    }
    return serviceDescriptor;
  }

  /**
   * Initialize a service dependencies
   * @param  {Object}     siloContext       Current execution silo siloContext
   * @param  {String}     serviceName       Service name.
   * @param  {String}     servicesDeclarations     Dependencies declarations.
   * @param  {Object}     options
   * Options for service retrieval
   * @param  {Boolean}    options.injectOnly
   * Flag indicating if existing services only should be used
   * @param  {Boolean}    options.autoloading
   * Flag to indicating $autoload dependendencies on the fly loading.
   * @return {Promise}                      Service dependencies hash promise.
   */
  async _initializeDependencies(
    siloContext,
    serviceName,
    servicesDeclarations,
    { injectOnly = false, autoloading = false },
  ) {
    debug('Initializing dependencies:', serviceName, servicesDeclarations);
    const servicesDescriptors = await Promise.all(
      servicesDeclarations.map(async serviceDeclaration => {
        const { mappedName, optional } = parseDependencyDeclaration(
          serviceDeclaration,
        );

        try {
          const serviceDescriptor = await this._getServiceDescriptor(
            siloContext,
            mappedName,
            {
              injectOnly,
              autoloading,
            },
          );
          return serviceDescriptor;
        } catch (err) {
          // Let pass syntax errors through to avoid running
          // invalid code
          if (optional && !(err instanceof SyntaxError)) {
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
      servicesDescriptors.map(async serviceDescriptor => {
        if (!serviceDescriptor) {
          return {}.undef;
        }
        return serviceDescriptor.service;
      }),
    );

    return services.reduce((hash, service, index) => {
      const mappedName = _pickMappedNameFromDeclaration(
        servicesDeclarations[index],
      );

      hash[mappedName] = service;
      return hash;
    }, {});
  }
}

export default Knifecycle;
export {
  SPECIAL_PROPS,
  DECLARATION_SEPARATOR,
  OPTIONAL_FLAG,
  Knifecycle,
  initializer,
  name,
  autoName,
  type,
  inject,
  autoInject,
  alsoInject,
  options,
  extra,
  reuseSpecialProps,
  wrapInitializer,
  constant,
  service,
  autoService,
  provider,
  autoProvider,
  handler,
  autoHandler,
};

function _pickServiceNameFromDeclaration(dependencyDeclaration) {
  const { serviceName } = parseDependencyDeclaration(dependencyDeclaration);

  return serviceName;
}

function _pickMappedNameFromDeclaration(dependencyDeclaration) {
  const { mappedName } = parseDependencyDeclaration(dependencyDeclaration);

  return mappedName;
}

function _applyShapes(shapes, serviceName) {
  return shapes.reduce((shapedService, shape) => {
    let matches;

    if (shapedService) {
      return shapedService;
    }
    matches = shape.pattern.exec(serviceName);
    if (!matches) {
      return shapedService;
    }
    return shape.template.replace(
      /\$([0-9])+/g,
      ($, $1) => matches[parseInt($1, 10)],
    );
  }, '');
}

function _applyClasses(classes, styles, links) {
  return links.reduce(
    (classesApplications, link) =>
      Object.assign(classesApplications, _applyStyles(classes, styles, link)),
    {},
  );
}

function _applyStyles(classes, styles, { serviceName, dependedServiceName }) {
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

function serviceAdapter(serviceName, initializer, dependenciesHash) {
  const servicePromise = initializer(dependenciesHash);

  if (!servicePromise || !servicePromise.then) {
    throw new YError(E_BAD_SERVICE_PROMISE, serviceName);
  }
  return servicePromise.then(_service_ =>
    Promise.resolve({
      service: _service_,
    }),
  );
}
