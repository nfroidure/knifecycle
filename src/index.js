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

// Constants that should use Symbol whenever possible
const INSTANCE = '__instance';
const DEPENDENCIES = '__dependencies';

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
    }));
  }

  /**
   * Register a service
   * @param  {String}             serviceName        Service name
   * @param  {Function|Promise}   service            The service promise or a function returning it
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
  service(serviceName, service) {
    function serviceProvider(hash) {
      return {
        servicePromise: 'function' === typeof service ?
        service(hash) :
        service,
      };
    }
    serviceProvider[DEPENDENCIES] = service[DEPENDENCIES] || [];
    this.provider(serviceName, serviceProvider);
    debug('Registered a new service:', serviceName);
    return serviceProvider;
  }

  /**
   * Register a service provider
   * @param  {String}     serviceName        Service name
   * @param  {Function}   serviceProvider    Service provider or a service provider promise
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
  provider(serviceName, serviceProvider) {
    const uniqueServiceProvider = serviceProvider.bind();

    uniqueServiceProvider[DEPENDENCIES] = serviceProvider[DEPENDENCIES] || [];

    uniqueServiceProvider[DEPENDENCIES].forEach((dependencyDeclaration) => {
      const serviceName = _pickServiceNameFromDeclaration(dependencyDeclaration);
      const dependencyProvider = this._servicesProviders.get(serviceName);

      if(
        dependencyProvider &&
        dependencyProvider[DEPENDENCIES]
        .some((childDependencyDeclaration) => {
          const childServiceName = _pickServiceNameFromDeclaration(childDependencyDeclaration);
          return childServiceName === serviceName;
        })
      ) {
        throw new YError(E_CIRCULAR_DEPENDENCY, dependencyDeclaration, serviceName);
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

    debug('Wrapped a service provider with dependencies:', dependenciesDeclarations);

    return uniqueServiceProvider;
  }

  /**
   * Outputs a Mermaid compatible dependency graph of the declared services.
   * See [Mermaid docs](https://github.com/knsv/mermaid)
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
  toMermaidGraph() {
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
    if(!links.length) {
      return '';
    }
    return ['graph TD'].concat(
      links.map(
        ({ serviceName, dependedServiceName }) =>
        '  ' + serviceName + '-->' + dependedServiceName
      )
    )
    .join('\n');
  }

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
      name: 'silo-' + Date.now(),
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
        const shutdownPromise = _shutdownNextServices(siloContext.servicesSequence);

        debug('Shutting down services');

        return shutdownPromise;

        // Shutdown services in their instanciation order
        function _shutdownNextServices(reversedServiceSequence) {
          if(0 === reversedServiceSequence.length) {
            return Promise.resolve();
          }
          return Promise.all(
            reversedServiceSequence.pop().map((serviceName) => {
              const serviceDescriptor = siloContext.servicesDescriptors.get(serviceName);
              let serviceShutdownPromise = siloContext.servicesShutdownsPromises.get(serviceName);

              if(serviceShutdownPromise) {
                debug('Reusing a service shutdown promise:', serviceName);
                return serviceShutdownPromise;
              }
              if(reversedServiceSequence.some(
                servicesDeclarations => servicesDeclarations.includes(serviceName)
              )) {
                debug('Delaying service shutdown:', serviceName);
                return Promise.resolve();
              }
              debug('Shutting down a service:', serviceName);
              serviceShutdownPromise = serviceDescriptor.shutdownProvider ?
                serviceDescriptor.shutdownProvider() :
                Promise.resolve();
              siloContext.servicesShutdownsPromises.set(serviceName, serviceShutdownPromise);
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
        this._initializeDependencies(siloContext, siloContext.name, dependenciesDeclarations, true)
      ),
    });

    return this._initializeDependencies(siloContext, siloContext.name, dependenciesDeclarations)
    .then((servicesHash) => {
      debug('Handling fatal errors:', siloContext.errorsPromises);
      Promise.all(siloContext.errorsPromises).catch(siloContext.throwFatalError);
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
    const serviceDescriptor = siloContext.servicesDescriptors.get(serviceName);

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
      serviceDescriptorPromise = Promise.reject(new YError(E_UNMATCHED_DEPENDENCY, serviceName));
      siloContext.servicesDescriptors.set(serviceName, serviceDescriptorPromise);
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
        throw YError.wrap.apply(YError, [
          err, E_UNMATCHED_DEPENDENCY, serviceName,
        ].concat(err.params)
        );
      }
      throw err;
    });
    siloContext.servicesDescriptors.set(serviceName, serviceDescriptorPromise);
    return serviceDescriptorPromise;
  }

  /**
   * Initialize a service dependencies
   * @param  {Object}     siloContext       Current execution silo siloContext
   * @param  {String}     serviceName       Service name.
   * @param  {String}     servicesDeclarations     Dependencies names.
   * @param  {Boolean}    injectOnly        Flag indicating if existing services only should be used
   * @return {Promise}                      Service dependencies hash promise.
   */
  _initializeDependencies(siloContext, serviceName, servicesDeclarations, injectOnly = false) {
    debug('Initializing dependencies:', serviceName, servicesDeclarations);
    return Promise.resolve()
    .then(
      () => Promise.all(
        servicesDeclarations
        .map(_pickMappedNameFromDeclaration)
        .map(this._getServiceDescriptor.bind(this, siloContext, injectOnly))
      )
      .then((servicesDescriptors) => {
        debug('Initialized dependencies descriptors:', serviceName, servicesDeclarations);
        siloContext.servicesSequence.push(servicesDeclarations.map(_pickMappedNameFromDeclaration));
        return Promise.all(servicesDescriptors.map(
          (serviceDescriptor, index) => {
            if((!serviceDescriptor.servicePromise) || !serviceDescriptor.servicePromise.then) {
              return Promise.reject(new YError(E_BAD_SERVICE_PROMISE, servicesDeclarations[index]));
            }
            return serviceDescriptor.servicePromise.then(service => service);
          }
        ));
      })
      .then(services => services.reduce((hash, service, index) => {
        const serviceName = _pickServiceNameFromDeclaration(servicesDeclarations[index]);
        hash[serviceName] = service;
        return hash;
      }, {}))
    );
  }
}

function _pickServiceNameFromDeclaration(serviceDeclaration) {
  const [serviceName] = serviceDeclaration.split(DECLARATION_SEPARATOR);
  return serviceName;
}

function _pickMappedNameFromDeclaration(serviceDeclaration) {
  const [serviceName, mappedName] = serviceDeclaration.split(DECLARATION_SEPARATOR);
  return mappedName || serviceName;
}
