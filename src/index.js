/* eslint max-len: ["warn", { "ignoreComments": true }] */
import {
  SPECIAL_PROPS,
  reuseSpecialProps,
  initializer,
  name,
  inject,
  type,
  options,
  parseDependencyDeclaration,
} from './util';
import YError from 'yerror';
import initDebug from 'debug';

const debug = initDebug('knifecycle');

const DISPOSE = '$dispose';
const DESTROY = '$destroy';
const INJECTOR = '$injector';
const SILO_CONTEXT = '$siloContext';
const FATAL_ERROR = '$fatalError';

const E_UNMATCHED_DEPENDENCY = 'E_UNMATCHED_DEPENDENCY';
const E_CIRCULAR_DEPENDENCY = 'E_CIRCULAR_DEPENDENCY';
const E_ANONYMOUS_ANALYZER = 'E_ANONYMOUS_ANALYZER';
const E_BAD_SERVICE_PROVIDER = 'E_BAD_SERVICE_PROVIDER';
const E_BAD_SERVICE_PROMISE = 'E_BAD_SERVICE_PROMISE';
const E_BAD_INJECTION = 'E_BAD_INJECTION';
const E_CONSTANT_INJECTION = 'E_CONSTANT_INJECTION';

// Constants that should use Symbol whenever possible
const INSTANCE = '__instance';

/* Architecture Note #1: Knifecycle

The `knifecycle` project is intended to be a [dependency
 injection](https://en.wikipedia.org/wiki/Dependency_injection)
 and [inversion of control](https://en.wikipedia.org/wiki/Inversion_of_control)
 tool. It will always be tied to this goal since I prefer
 composing software instead of using frameworks.

It is designed to have a low footprint on services code.
 There is nothing worse than having to write specific code for
 a given tool. With `knifecycle`, services can be either constants,
 functions or objects created synchronously or asynchronously. They
 can be reused elsewhere (even when not using DI) with no changes
 at all.
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
    this._servicesProviders = new Map();
    this._singletonsServicesHandles = new Map();
    this._singletonsServicesDescriptors = new Map();
    this._singletonsServicesShutdownsPromises = new Map();
    this.provider(
      INJECTOR,
      inject([SILO_CONTEXT],
      ({ $siloContext }) => Promise.resolve({
        service: dependenciesDeclarations =>
          this._initializeDependencies(
            $siloContext,
            $siloContext.name,
            dependenciesDeclarations,
            true
          ),
      }))
    );
    this.provider(DESTROY, () => Promise.resolve(({
      service: () => {
        this.shutdownPromise = this.shutdownPromise ||
        Promise.all(
          [...this._silosContexts].map(
            (siloContext) => {
              const $dispose = siloContext.servicesDescriptors.get(DISPOSE)
              .service;

              return $dispose();
            }
          )
        );

        debug('Shutting down Knifecycle instance.');

        return this.shutdownPromise;
      },
    }), {
      singleton: true,
    }));
  }

  /**
   * Returns a Knifecycle instance (always the same)
   * @return {Knifecycle}
   * The created/saved instance
   * @example
   *
   * import { getInstance } from 'knifecycle'
   *
   * const $ = getInstance();
   */
  static getInstance() {
    Knifecycle[INSTANCE] = Knifecycle[INSTANCE] || new Knifecycle();
    debug('Spawning an instance.');
    return Knifecycle[INSTANCE];
  }

  /* Architecture Note #1.3: Declaring services

  The first step to use `knifecycle` is to declare
   services. There are two way of declaring services:
  - constants: a constant is a simple value that will
   never change. It can be literal values, objects
   or even functions.
  - initializers: they are asynchronous functions
   that handle the initialization phase.

  Initializers can be of two types:
  - services: a `service` initializer directly
   resolve to the actual service it builds. It can
   be objects, functions or literal values.
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
   * Register a constant service
   * @param  {String} constantName
   * The name of the service
   * @param  {any}    constantValue
   * The constant value
   * @return {Knifecycle}
   * The Knifecycle instance (for chaining)
   * @example
   *
   * import Knifecycle from 'knifecycle'
   *
   * const $ = new Knifecycle();
   *
   * // Expose the process env
   * $.constant('ENV', process.env);
   * // Expose a time() function
   * $.constant('time', Date.now.bind(Date));
   */
  constant(constantName, constantValue) {
    const contantLooksLikeAnInitializer =
      constantValue instanceof Function &&
      constantValue[SPECIAL_PROPS.INJECT];

    if(contantLooksLikeAnInitializer) {
      throw new YError(
        E_CONSTANT_INJECTION,
        constantValue[SPECIAL_PROPS.INJECT]
      );
    }

    this.register(
      initializer(
        {
          name: constantName,
          options: { singleton: true },
        },
        Promise.resolve.bind(Promise, {
          service: constantValue,
          dispose: Promise.resolve.bind(Promise),
        })
      )
    );

    debug('Registered a new constant:', constantName);

    return this;
  }

  /**
   * Register a service initializer
   * @param  {String}     serviceName
   * Service name
   * @param  {Function}   initializer
   * An initializer returning the service promise
   * @param  {Object}     options
   * Options attached to the initializer
   * @return {Knifecycle}
   * The Knifecycle instance (for chaining)
   * @example
   *
   * import Knifecycle from 'knifecycle'
   * import fs from 'fs';
   *
   * const $ = new Knifecycle();
   *
   * $.service('config', configServiceInitializer, {
   *   singleton: true,
   * });
   *
   * function configServiceInitializer({ CONFIG_PATH }) {
   *   return new Promise((resolve, reject) {
   *     fs.readFile(CONFIG_PATH, function(err, data) {
   *       if(err) {
   *         return reject(err);
   *       }
   *       try {
   *         resolve(JSON.parse(data));
   *       } catch (err) {
   *         reject(err);
   *       }
   *   }, 'utf-8');
   * }
   */
  service(serviceName, initializer, options) {
    this.register(reuseSpecialProps(
      initializer,
      initializer,
      {
        [SPECIAL_PROPS.NAME]: serviceName,
        [SPECIAL_PROPS.OPTIONS]: options,
        [SPECIAL_PROPS.TYPE]: 'service',
      }
    ), options);
    debug('Registered a new service initializer:', serviceName);
    return this;
  }

  /**
   * Register a provider initializer
   * @param  {String}     serviceName
   * Service name resolved by the provider
   * @param  {Function}   initializer
   * An initializer returning the service promise
   * @param  {Object}     options
   * Options attached to the initializer
   * @return {Knifecycle}
   * The Knifecycle instance (for chaining)
   * @example
   *
   * import Knifecycle from 'knifecycle'
   * import fs from 'fs';
   *
   * const $ = new Knifecycle();
   *
   * $.provider('config', function configProvider() {
   *   return new Promise((resolve, reject) {
   *     fs.readFile('config.js', function(err, data) {
   *       let config;
   *       if(err) {
   *         return reject(err);
   *       }
   *       try {
   *         config = JSON.parse(data.toString);
   *       } catch (err) {
   *         return reject(err);
   *       }
   *       resolve({
   *         service: config,
   *       });
   *     });
   *   });
   * });
   */
  provider(serviceName, initializer, options = {}) {
    this.register(reuseSpecialProps(
      initializer,
      initializer,
      {
        [SPECIAL_PROPS.NAME]: serviceName,
        [SPECIAL_PROPS.OPTIONS]: options,
      }
    ));
    debug('Registered a new service provider:', serviceName);
    return this;
  }

  register(initializer) {
    initializer[SPECIAL_PROPS.INJECT] =
      initializer[SPECIAL_PROPS.INJECT] || [];
    initializer[SPECIAL_PROPS.OPTIONS] =
      initializer[SPECIAL_PROPS.OPTIONS] || {};
    initializer[SPECIAL_PROPS.TYPE] =
      initializer[SPECIAL_PROPS.TYPE] || 'provider';
    if(!initializer[SPECIAL_PROPS.NAME]) {
      throw new YError(
        E_ANONYMOUS_ANALYZER,
        initializer[SPECIAL_PROPS.NAME]
      );
    }

    if('service' === initializer[SPECIAL_PROPS.TYPE]) {
      initializer = reuseSpecialProps(
        initializer,
        serviceAdapter.bind(
          null,
          initializer[SPECIAL_PROPS.NAME],
          initializer
        )
      );
      initializer[SPECIAL_PROPS.TYPE] = 'provider';
    }

    const initializerDependsOfItself =
      initializer[SPECIAL_PROPS.INJECT]
      .map(_pickServiceNameFromDeclaration)
      .includes(initializer[SPECIAL_PROPS.NAME]);

    if(initializerDependsOfItself) {
      throw new YError(
        E_CIRCULAR_DEPENDENCY,
        initializer[SPECIAL_PROPS.NAME]
      );
    }

    initializer[SPECIAL_PROPS.INJECT]
    .forEach((dependencyDeclaration) => {
      this._lookupCircularDependencies(
        initializer[SPECIAL_PROPS.NAME],
        dependencyDeclaration
      );
    });

    this._servicesProviders.set(
      initializer[SPECIAL_PROPS.NAME],
      initializer
    );
    debug('Registered a new initializer:', initializer[SPECIAL_PROPS.NAME]);
    return this;
  }

  _lookupCircularDependencies(
    rootServiceName,
    dependencyDeclaration,
    declarationsStacks = []
  ) {
    const serviceName = _pickMappedNameFromDeclaration(
      dependencyDeclaration
    );
    const dependencyProvider = this._servicesProviders.get(serviceName);

    if(!dependencyProvider) {
      return;
    }
    declarationsStacks = declarationsStacks.concat(dependencyDeclaration);
    dependencyProvider[SPECIAL_PROPS.INJECT]
    .forEach((childDependencyDeclaration) => {
      const childServiceName = _pickMappedNameFromDeclaration(
        childDependencyDeclaration
      );

      if(rootServiceName === childServiceName) {
        throw new YError(
          ...[E_CIRCULAR_DEPENDENCY, rootServiceName]
          .concat(declarationsStacks)
          .concat(childDependencyDeclaration)
        );
      }

      this._lookupCircularDependencies(
        rootServiceName,
        childDependencyDeclaration,
        declarationsStacks
      );
    });
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
   * import { Knifecycle, inject } from 'knifecycle';
   * import appInitializer from './app';
   *
   * const $ = new Knifecycle();
   *
   * $.constant('ENV', process.env);
   * $.constant('OS', require('os'));
   * $.service('app', inject(['ENV', 'OS'], appInitializer));
   * $.toMermaidGraph();
   *
   * // returns
   * graph TD
   *   app-->ENV
   *   app-->OS
   */
  toMermaidGraph({ shapes = [], styles = [], classes = {} } = {}) {
    const servicesProviders = this._servicesProviders;
    const links = Array.from(servicesProviders.keys())
    .filter(provider => !provider.startsWith('$'))
    .reduce((links, serviceName) => {
      const serviceProvider = servicesProviders.get(serviceName);

      if(!serviceProvider[SPECIAL_PROPS.INJECT].length) {
        return links;
      }
      return links.concat(serviceProvider[SPECIAL_PROPS.INJECT]
      .map((dependencyDeclaration) => {
        const dependedServiceName = _pickServiceNameFromDeclaration(
          dependencyDeclaration
        );

        return { serviceName, dependedServiceName };
      }));
    }, []);
    const classesApplications = _applyClasses(classes, styles, links);

    if(!links.length) {
      return '';
    }

    return ['graph TD'].concat(
      links.map(
        ({ serviceName, dependedServiceName }) =>
        `  ${
          _applyShapes(shapes, serviceName) ||
          serviceName
        }-->${
          _applyShapes(shapes, dependedServiceName) ||
          dependedServiceName
        }`
      )
    )
    .concat(Object.keys(classes).map(
      className => `  classDef ${className} ${classes[className]}`
    ))
    .concat(
      Object.keys(classesApplications).map(
        serviceName =>
        `  class ${serviceName} ${classesApplications[serviceName]};`
      )
    )
    .join('\n');
  }

  /* Architecture Note #1.4: Execution silos
  Once all the services are declared, we need a way to bring
   them to life. Execution silos are where the magic happen.
   For each call of the `run` method with given dependencies,
   a new silo is created and the required environment to
   run the actual code is leveraged.

  Depending of your application design, you could run it
   in only one execution silo or into several ones
   according to the isolation level your wish to reach.
  */

  /**
   * Creates a new execution silo
   * @param  {String[]}   dependenciesDeclarations    Service name.
   * @return {Promise}                         Service descriptor promise
   * @example
   *
   * import Knifecycle from 'knifecycle'
   *
   * const $ = new Knifecycle();
   *
   * $.constant('ENV', process.env);
   * $.run(['ENV'])
   * .then(({ ENV }) => {
   *  // Here goes your code
   * })
   */
  run(dependenciesDeclarations) {
    const _this = this;
    const internalDependencies = [...new Set(
      dependenciesDeclarations.concat(DISPOSE)
    )];
    const siloContext = {
      name: `silo-${this._silosCounter++}`,
      servicesDescriptors: new Map(),
      servicesSequence: [],
      servicesShutdownsPromises: new Map(),
      errorsPromises: [],
    };

    if(this.shutdownPromise) {
      throw new YError('E_INSTANCE_DESTROYED');
    }

    // Create a provider for the special fatal error service
    siloContext.servicesDescriptors.set(FATAL_ERROR, {
      service: {
        promise: new Promise((resolve, reject) => {
          siloContext.throwFatalError = (err) => {
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
      service: () => {
        siloContext.shutdownPromise = siloContext.shutdownPromise ||
          _shutdownNextServices(
            siloContext.servicesSequence
          );

        debug('Shutting down services');

        return siloContext.shutdownPromise
        .then(() => {
          this._silosContexts.delete(siloContext);
        });

        // Shutdown services in their instanciation order
        function _shutdownNextServices(reversedServiceSequence) {
          if(0 === reversedServiceSequence.length) {
            return Promise.resolve();
          }
          return Promise.all(
            reversedServiceSequence.pop().map((serviceName) => {
              const singletonServiceDescriptor =
                _this._singletonsServicesDescriptors.get(serviceName);
              const serviceDescriptor = singletonServiceDescriptor ||
                siloContext.servicesDescriptors.get(serviceName);
              let serviceShutdownPromise =
                _this._singletonsServicesShutdownsPromises.get(serviceName) ||
                siloContext.servicesShutdownsPromises.get(serviceName);

              if(serviceShutdownPromise) {
                debug('Reusing a service shutdown promise:', serviceName);
                return serviceShutdownPromise;
              }

              if(reversedServiceSequence.some(
                servicesDeclarations =>
                servicesDeclarations.includes(serviceName)
              )) {
                debug('Delaying service shutdown:', serviceName);
                return Promise.resolve();
              }
              if(singletonServiceDescriptor) {
                const handleSet =
                  _this._singletonsServicesHandles.get(serviceName);

                handleSet.delete(siloContext.name);
                if(handleSet.size) {
                  debug('Singleton is used elsewhere:', serviceName, handleSet);
                  return Promise.resolve();
                }
                _this._singletonsServicesDescriptors.delete(serviceName);
              }
              debug('Shutting down a service:', serviceName);
              serviceShutdownPromise = serviceDescriptor.dispose ?
                serviceDescriptor.dispose() :
                Promise.resolve();
              if(singletonServiceDescriptor) {
                _this._singletonsServicesShutdownsPromises.set(
                  serviceName,
                  serviceShutdownPromise
                );
              }
              siloContext.servicesShutdownsPromises.set(
                serviceName,
                serviceShutdownPromise
              );
              return serviceShutdownPromise;
            })
          )
          .then(_shutdownNextServices.bind(null, reversedServiceSequence));
        }
      },
      dispose: Promise.resolve.bind(Promise),
    });

    this._silosContexts.add(siloContext);

    return this._initializeDependencies(
      siloContext,
      siloContext.name,
      internalDependencies
    )
    .then((servicesHash) => {
      debug('Handling fatal errors:', siloContext.errorsPromises);
      Promise.all(siloContext.errorsPromises)
      .catch(siloContext.throwFatalError);
      return dependenciesDeclarations.reduce(
        (finalHash, dependencyDeclaration) => {
          const serviceName =
            _pickServiceNameFromDeclaration(dependencyDeclaration);

          finalHash[serviceName] = servicesHash[serviceName];
          return finalHash;
        }, {}
      );
    });
  }

  /**
   * Initialize or return a service descriptor
   * @param  {Object}     siloContext       Current execution silo context
   * @param  {Boolean}    injectOnly        Flag indicating if existing services only should be used
   * @param  {String}     serviceName       Service name.
   * @param  {String}     serviceProvider   Service provider.
   * @return {Promise}                      Service dependencies hash promise.
   */
  _getServiceDescriptor(siloContext, injectOnly, serviceName) {
    let serviceDescriptor =
      this._singletonsServicesDescriptors.get(serviceName);

    if(serviceDescriptor) {
      this._singletonsServicesHandles.get(serviceName)
        .add(siloContext.name);
    } else {
      serviceDescriptor =
        siloContext.servicesDescriptors.get(serviceName);
    }

    if(serviceDescriptor) {
      return Promise.resolve(serviceDescriptor);
    }

    // The inject service is intended to be used as a workaround for unavoidable
    // circular dependencies. It wouldn't make sense to instanciate new services
    // at this level so throwing an error
    if(injectOnly) {
      return Promise.reject(new YError(E_BAD_INJECTION, serviceName));
    }

    return this._initializeServiceDescriptor(siloContext, serviceName);
  }

  /**
   * Initialize a service
   * @param  {Object}     siloContext       Current execution silo context
   * @param  {String}     serviceName       Service name.
   * @param  {String}     serviceProvider   Service provider.
   * @return {Promise}                      Service dependencies hash promise.
   */
  _initializeServiceDescriptor(siloContext, serviceName) {
    const serviceProvider = this._servicesProviders.get(serviceName);
    let serviceDescriptorPromise;

    debug('Initializing a service descriptor:', serviceName);

    if(!serviceProvider) {
      debug('No service provider:', serviceName);
      serviceDescriptorPromise = Promise.reject(
        new YError(E_UNMATCHED_DEPENDENCY, serviceName)
      );
      siloContext.servicesDescriptors.set(
        serviceName,
        serviceDescriptorPromise
      );
      return serviceDescriptorPromise;
    }

    // A singleton service may use a reserved resource
    // like a TCP socket. This is why we have to be aware
    // of singleton services full shutdown before creating
    // a new one
    serviceDescriptorPromise = (
      this._singletonsServicesShutdownsPromises.get(serviceName) ||
      Promise.resolve()
    )
    // Anyway delete any shutdown promise before instanciating
    // a new service
    .then(() => {
      this._singletonsServicesShutdownsPromises.delete(serviceName);
      siloContext.servicesShutdownsPromises.delete(serviceName);
    })
    .then(this._initializeDependencies.bind(
      this,
      siloContext,
      serviceName,
      serviceProvider[SPECIAL_PROPS.INJECT]
    ));

    serviceDescriptorPromise = serviceDescriptorPromise
    .then((deps) => {
      debug('Successfully initialized service dependencies:', serviceName);
      return deps;
    })
    .then(serviceProvider)
    .then((serviceDescriptor) => {
      if((!serviceDescriptor)) {
        debug('Provider did not return a descriptor:', serviceName);
        return Promise.reject(new YError(E_BAD_SERVICE_PROVIDER, serviceName));
      }
      debug('Successfully initialized a service descriptor:', serviceName);
      if(serviceDescriptor.fatalErrorPromise) {
        debug('Registering service descriptor error promise:', serviceName);
        siloContext.errorsPromises.push(serviceDescriptor.fatalErrorPromise);
      }
      siloContext.servicesDescriptors.set(serviceName, serviceDescriptor);
      return serviceDescriptor;
    })
    .catch((err) => {
      debug('Error initializing a service descriptor:', serviceName, err.stack);
      if(E_UNMATCHED_DEPENDENCY === err.code) {
        throw YError.wrap(...[
          err, E_UNMATCHED_DEPENDENCY, serviceName,
        ].concat(err.params));
      }
      throw err;
    });
    if(serviceProvider[SPECIAL_PROPS.OPTIONS].singleton) {
      const handlesSet = new Set();

      handlesSet.add(siloContext.name);
      this._singletonsServicesHandles.set(serviceName, handlesSet);
      this._singletonsServicesDescriptors.set(
        serviceName,
        serviceDescriptorPromise
      );
    } else {
      siloContext.servicesDescriptors.set(
        serviceName,
        serviceDescriptorPromise
      );
    }
    return serviceDescriptorPromise;
  }

  /**
   * Initialize a service dependencies
   * @param  {Object}     siloContext       Current execution silo siloContext
   * @param  {String}     serviceName       Service name.
   * @param  {String}     servicesDeclarations     Dependencies declarations.
   * @param  {Boolean}    injectOnly        Flag indicating if existing services only should be used
   * @return {Promise}                      Service dependencies hash promise.
   */
  _initializeDependencies(
    siloContext, serviceName, servicesDeclarations, injectOnly = false
  ) {
    debug('Initializing dependencies:', serviceName, servicesDeclarations);
    return Promise.resolve()
    .then(
      () => Promise.all(
        servicesDeclarations
        .map((serviceDeclaration) => {
          const {
            mappedName,
            optional,
          } = parseDependencyDeclaration(serviceDeclaration);

          return this._getServiceDescriptor(siloContext, injectOnly, mappedName)
          .catch((err) => {
            if(optional) {
              return Promise.resolve();
            }
            throw err;
          });
        })
      )
      .then((servicesDescriptors) => {
        debug(
          'Initialized dependencies descriptors:',
          serviceName,
          servicesDeclarations
        );
        siloContext.servicesSequence.push(
          servicesDeclarations.map(_pickMappedNameFromDeclaration)
        );
        return Promise.all(servicesDescriptors.map(
          (serviceDescriptor, index) => {
            if(!serviceDescriptor) {
              return {}.undef;
            }
            return serviceDescriptor.service;
          }
        ));
      })
      .then(services => services.reduce((hash, service, index) => {
        const serviceName = _pickServiceNameFromDeclaration(
          servicesDeclarations[index]
        );

        hash[serviceName] = service;
        return hash;
      }, {}))
    );
  }
}

export default Knifecycle;
export const getInstance = Knifecycle.getInstance;
export {
  Knifecycle,
  initializer,
  name,
  inject,
  type,
  options,
};

function _pickServiceNameFromDeclaration(dependencyDeclaration) {
  const { serviceName } = parseDependencyDeclaration(dependencyDeclaration);

  return serviceName;
}

function _pickMappedNameFromDeclaration(dependencyDeclaration) {
  const {
    serviceName, mappedName,
  } = parseDependencyDeclaration(dependencyDeclaration);

  return mappedName || serviceName;
}

function _applyShapes(shapes, serviceName) {
  return shapes.reduce((shapedService, shape) => {
    let matches;

    if(shapedService) {
      return shapedService;
    }
    matches = shape.pattern.exec(serviceName);
    if(!matches) {
      return shapedService;
    }
    return shape.template.replace(
      /\$([0-9])+/g,
      ($, $1) => matches[parseInt($1, 10)]
    );
  }, '');
}

function _applyClasses(classes, styles, links) {
  return links.reduce(
    (classesApplications, link) =>
    Object.assign(classesApplications, _applyStyles(classes, styles, link)),
    {}
  );
}

function _applyStyles(classes, styles, { serviceName, dependedServiceName }) {
  return styles.reduce((classesApplications, style) => {
    if(
      style.pattern.test(serviceName) &&
      !classesApplications[serviceName]
    ) {
      if(!classes[style.className]) {
        throw new YError('E_BAD_CLASS', style.className, serviceName);
      }
      classesApplications[serviceName] = style.className;
    }
    if(
      style.pattern.test(dependedServiceName) &&
      !classesApplications[dependedServiceName]
    ) {
      if(!classes[style.className]) {
        throw new YError('E_BAD_CLASS', style.className, dependedServiceName);
      }
      classesApplications[dependedServiceName] = style.className;
    }
    return classesApplications;
  }, {});
}

function serviceAdapter(serviceName, initializer, dependenciesHash) {
  const servicePromise = initializer(dependenciesHash);

  if((!servicePromise) || !servicePromise.then) {
    throw new YError(E_BAD_SERVICE_PROMISE, serviceName);
  }
  return servicePromise.then(_service_ => Promise.resolve({
    service: _service_,
  }));
}
