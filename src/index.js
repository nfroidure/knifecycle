/* eslint max-len: ["warn", { "ignoreComments": true }] */
import YError from 'yerror';
import initDebug from 'debug';

const debug = initDebug('knifecycle');

const SHUTDOWN = '$shutdown';
const INJECT = '$inject';
const FATAL_ERROR = '$fatalError';
const E_UNMATCHED_DEPENDENCY = 'E_UNMATCHED_DEPENDENCY';
const E_CIRCULAR_DEPENDENCY = 'E_CIRCULAR_DEPENDENCY';
const E_BAD_SERVICE_PROVIDER = 'E_BAD_SERVICE_PROVIDER';
const E_BAD_SERVICE_PROMISE = 'E_BAD_SERVICE_PROMISE';
const E_BAD_INJECTION = 'E_BAD_INJECTION';
const DECLARATION_SEPARATOR = ':';
const OPTIONAL_FLAG = '?';

// Constants that should use Symbol whenever possible
const INSTANCE = '__instance';
const DEPENDENCIES = '__dependencies';
const OPTIONS = '__options';

/* Architecture Note #1: Knifecycle

The `knifecycle` project is intended to be a [dependency
 injection](https://en.wikipedia.org/wiki/Dependency_injection)
 and [inversion of control](https://en.wikipedia.org/wiki/Inversion_of_control)
 tool. It will always be tied to this goal since I prefer
 composing software instead of using frameworks.

It is designed to have a low footprint on services code.
 There is nothing worse than having to write specific code for
 a given tool. With `knifecycle`, services can be either constants,
 functions or object created synchronously or asynchronously. They
 can be reused elsewhere with no changes at all.
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
export default class Knifecycle {
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
    this._servicesProviders = new Map();
    this._singletonsServicesDescriptors = new Map();
  }

  /**
   * Returns a Knifecycle instance (always the same)
   * @return {Knifecycle}         The created/saved instance
   * @example
   *
   * import Knifecycle from 'knifecycle'
   *
   * const $ = Knifecycle.getInstance();
   */
  static getInstance() {
    Knifecycle[INSTANCE] = Knifecycle[INSTANCE] || new Knifecycle();
    debug('Spawning an instance.');
    return Knifecycle[INSTANCE];
  }

  /* Architecture Note #1.3: Declaring services

  The first step to use `knifecycle` is to declare
   services. There are three kinds of services:
  - constants: a constant is a simple value that will
   never change. It can be literal values, objects
   or even functions.
  - services: services are asynchronous functions
   resolving to objects, functions or complexer
   objects. Those one just need an initialization
   phase that must be done asynchronously.
  - providers: they are very similar to services
   except they have an additional layer of
   complexity. Indeed, they have to be hooked
   to the process life cycle to allow graceful
   shutdown of the applications build on top of
   `knifecycle`.

   In addition to this, services and providers can
    be declared as singletons. This means that they
    will be instanciated once for all for each
    executions silos using them (we will cover this
    topic later on).
  */

  /**
   * Register a constant service
   * @param  {String} constantName    The name of the service
   * @param  {any}    constantValue   The constant value
   * @return {Function}               The created service provider
   * @example
   *
   * import Knifecycle from 'knifecycle'
   *
   * const $ = new Knifecycle();
   *
   * $.constant('ENV', process.env); // Expose the process env
   * $.constant('time', Date.now.bind(Date)); // Expose a time() function
   */
  constant(constantName, constantValue) {
    debug('Registered a new constant:', constantName);
    return this.provider(constantName, Promise.resolve.bind(Promise, {
      servicePromise: Promise.resolve(constantValue),
      shutdownProvider: Promise.resolve.bind(Promise),
    }), { singleton: true });
  }

  /**
   * Register a service
   * @param  {String}             serviceName        Service name
   * @param  {Function|Promise}   service            The service promise or a function returning it
   * @param  {Object}             options            Options for the provider
   * @return {Function}                              The created service provider
   * @example
   *
   * import Knifecycle from 'knifecycle'
   * import fs from 'fs';
   *
   * const $ = new Knifecycle();
   *
   * $.service('config', function config() {
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
   *     resolve({
   *       service: config,
   *     });
   *   });
   * });
   */
  service(serviceName, service, options) {
    function serviceProvider(hash) {
      return {
        servicePromise: 'function' === typeof service ?
        service(hash) :
        service,
      };
    }
    serviceProvider[DEPENDENCIES] = service[DEPENDENCIES] || [];
    this.provider(serviceName, serviceProvider, options);
    debug('Registered a new service:', serviceName);
    return serviceProvider;
  }

  /**
   * Register a service provider
   * @param  {String}     serviceName        Service name
   * @param  {Function}   serviceProvider    Service provider or a service provider promise
   * @param  {Object}     options            Options for the provider
   * @return {Promise}                       The actual service descriptor promise
   * @example
   *
   * import Knifecycle from 'knifecycle'
   * import fs from 'fs';
   *
   * const $ = new Knifecycle();
   *
   * $.provider('config', function configProvider() {
   *   return Promise.resolve({
   *     servicePromise: new Promise((resolve, reject) {
   *       fs.readFile('config.js', function(err, data) {
   *         let config;
   *         if(err) {
   *           return reject(err);
   *         }
   *         try {
   *           config = JSON.parse(data.toString);
   *         } catch (err) {
   *           return reject(err);
   *         }
   *         resolve({
   *           service: config,
   *         });
   *       });
   *     });
   *   });
   * });
   */
  provider(serviceName, serviceProvider, options = {}) {
    const uniqueServiceProvider = serviceProvider.bind();

    uniqueServiceProvider[DEPENDENCIES] = serviceProvider[DEPENDENCIES] || [];
    uniqueServiceProvider[OPTIONS] = options;

    uniqueServiceProvider[DEPENDENCIES].forEach((dependencyDeclaration) => {
      const serviceName = _pickServiceNameFromDeclaration(
        dependencyDeclaration
      );
      const dependencyProvider = this._servicesProviders.get(serviceName);

      if(
        dependencyProvider &&
        dependencyProvider[DEPENDENCIES]
        .some((childDependencyDeclaration) => {
          const childServiceName = _pickServiceNameFromDeclaration(
            childDependencyDeclaration
          );

          return childServiceName === serviceName;
        })
      ) {
        throw new YError(
          E_CIRCULAR_DEPENDENCY,
          dependencyDeclaration,
          serviceName
        );
      }
    });

    this._servicesProviders.set(serviceName, uniqueServiceProvider);
    debug('Registered a new service provider:', serviceName);
    return uniqueServiceProvider;
  }

  /**
   * Decorator to claim that a service depends on others ones.
   * @param  {String[]}  dependenciesDeclarations   Dependencies the decorated service provider depends on.
   * @param  {Function}  serviceProvider     Service provider or a service provider promise
   * @return {Function}                      Returns the decorator function
   * @example
   *
   * import Knifecycle from 'knifecycle'
   * import fs from 'fs';
   *
   * const $ = new Knifecycle();
   *
   * $.service('config', $.depends(['ENV'], function configProvider({ ENV }) {
   *   return new Promise((resolve, reject) {
   *     fs.readFile(ENV.CONFIG_FILE, function(err, data) {
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
   * }));
   */
  depends(dependenciesDeclarations, serviceProvider) { // eslint-disable-line
    const uniqueServiceProvider = serviceProvider.bind();

    uniqueServiceProvider[DEPENDENCIES] = (
      serviceProvider[DEPENDENCIES] ||
      []
    ).concat(dependenciesDeclarations);

    debug(
      'Wrapped a service provider with dependencies:',
      dependenciesDeclarations
    );

    return uniqueServiceProvider;
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
   * import Knifecycle from 'knifecycle'
   *
   * const $ = new Knifecycle();
   *
   * $.constant('ENV', process.env);
   * $.constant('OS', require('os'));
   * $.service('app', $.depends(['ENV', 'OS'], () => Promise.resolve()));
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
    .reduce((links, serviceName) => {
      const serviceProvider = servicesProviders.get(serviceName);

      if(!serviceProvider[DEPENDENCIES].length) {
        return links;
      }
      return links.concat(serviceProvider[DEPENDENCIES]
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
    const siloContext = {
      name: `silo-${Date.now()}`,
      servicesDescriptors: new Map(),
      servicesSequence: [],
      servicesShutdownsPromises: new Map(),
      errorsPromises: [],
    };

    // Create a provider for the special fatal error service
    siloContext.servicesDescriptors.set(FATAL_ERROR, {
      servicePromise: Promise.resolve({
        promise: new Promise((resolve, reject) => {
          siloContext.throwFatalError = (err) => {
            debug('Handled a fatal error', err);
            reject(err);
          };
        }),
      }),
    });

    // Create a provider for the shutdown special dependency
    siloContext.servicesDescriptors.set(SHUTDOWN, {
      servicePromise: Promise.resolve(() => {
        const shutdownPromise = _shutdownNextServices(
          siloContext.servicesSequence
        );

        debug('Shutting down services');

        return shutdownPromise;

        // Shutdown services in their instanciation order
        function _shutdownNextServices(reversedServiceSequence) {
          if(0 === reversedServiceSequence.length) {
            return Promise.resolve();
          }
          return Promise.all(
            reversedServiceSequence.pop().map((serviceName) => {
              const serviceDescriptor =
                siloContext.servicesDescriptors.get(serviceName);
              let serviceShutdownPromise =
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
              debug('Shutting down a service:', serviceName);
              serviceShutdownPromise = serviceDescriptor.shutdownProvider ?
                serviceDescriptor.shutdownProvider() :
                Promise.resolve();
              siloContext.servicesShutdownsPromises.set(
                serviceName,
                serviceShutdownPromise
              );
              return serviceShutdownPromise;
            })
          )
          .then(_shutdownNextServices.bind(null, reversedServiceSequence));
        }
      }),
      shutdownProvider: Promise.resolve.bind(Promise),
    });

    // Create a provider for the special inject service
    siloContext.servicesDescriptors.set(INJECT, {
      servicePromise: Promise.resolve(dependenciesDeclarations =>
        this._initializeDependencies(
          siloContext,
          siloContext.name,
          dependenciesDeclarations,
          true
        )
      ),
    });

    return this._initializeDependencies(
      siloContext,
      siloContext.name,
      dependenciesDeclarations
    )
    .then((servicesHash) => {
      debug('Handling fatal errors:', siloContext.errorsPromises);
      Promise.all(siloContext.errorsPromises)
      .catch(siloContext.throwFatalError);
      return servicesHash;
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
    const serviceDescriptor =
      this._singletonsServicesDescriptors.get(serviceName) ||
      siloContext.servicesDescriptors.get(serviceName);

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

    serviceDescriptorPromise = this._initializeDependencies(
      siloContext,
      serviceName,
      serviceProvider[DEPENDENCIES]
    );

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
      if(serviceDescriptor.errorPromise) {
        debug('Registering service descriptor error promise:', serviceName);
        siloContext.errorsPromises.push(serviceDescriptor.errorPromise);
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
    if(serviceProvider[OPTIONS].singleton) {
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
          } = _parseDependencyDeclaration(serviceDeclaration);

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
            if(
              (!serviceDescriptor.servicePromise) ||
              !serviceDescriptor.servicePromise.then
            ) {
              return Promise.reject(
                new YError(
                  E_BAD_SERVICE_PROMISE,
                  servicesDeclarations[index]
                )
              );
            }
            return serviceDescriptor.servicePromise.then(service => service);
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

function _pickServiceNameFromDeclaration(dependencyDeclaration) {
  const { serviceName } = _parseDependencyDeclaration(dependencyDeclaration);

  return serviceName;
}

function _pickMappedNameFromDeclaration(dependencyDeclaration) {
  const {
    serviceName, mappedName,
  } = _parseDependencyDeclaration(dependencyDeclaration);

  return mappedName || serviceName;
}

function _parseDependencyDeclaration(dependencyDeclaration) {
  const optional = dependencyDeclaration.startsWith(OPTIONAL_FLAG);
  const [serviceName, mappedName] = (
    optional ?
    dependencyDeclaration.slice(1) :
    dependencyDeclaration
  ).split(DECLARATION_SEPARATOR);

  return {
    serviceName,
    mappedName: mappedName || serviceName,
    optional,
  };
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
