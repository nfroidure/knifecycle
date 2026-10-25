/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint max-len: ["warn", { "ignoreComments": true }] @typescript-eslint/no-this-alias: "warn" */
import { YError, pickYErrorWithCode } from 'yerror';
import initDebug from 'debug';
import {
  NO_PROVIDER,
  constant,
  service,
  parseDependencyDeclaration,
  type ServiceName,
  type Service,
  type Disposer,
  type Provider,
  type Dependencies,
  type DependencyDeclaration,
  type ServiceInitializerBuilder,
  type Initializer,
  ProviderInitializerBuilder,
  provider,
  unwrapInitializerProperties,
} from './util.js';
import initFatalError, { type FatalErrorService } from './fatalError.js';
import initDispose from './dispose.js';
import { type Overrides, pickOverriddenName } from './overrides.js';
import { type Injector } from './injector.js';
import initInitializerBuilder from './build.js';
import './errors.js';

export type * from './build.js';
export * from './build.js';
export type * from './dispose.js';
export * from './dispose.js';
export type * from './fatalError.js';
export * from './fatalError.js';
export type * from './injector.js';
export type * from './overrides.js';
export * from './overrides.js';
export type * from './sequence.js';
export * from './sequence.js';
export type * from './util.js';
export * from './util.js';

export { initInitializerBuilder, initDispose, initFatalError };

export const RUN_DEPENDENT_NAME = '__run__';
export const SYSTEM_DEPENDENT_NAME = '__system__';
export const AUTO_LOAD_DEPENDENT_NAME = '__autoloader__';
export const INJECTOR_DEPENDENT_NAME = '__injector__';
export const RESERVED_SERVICE_NAMES = ['__self'];
export const IMMUTABLE_SERVICE_NAMES = [
  '$instance',
  '$injector',
  '$siloContext',
  '$dispose',
];

export type Autoloader<
  T extends Initializer<unknown, Record<string, unknown>>,
> = (name: DependencyDeclaration) => Promise<T>;
export interface DependencyDescriptor {
  serviceName: ServiceName;
  finalName: ServiceName;
  optional: boolean;
}
export type DependenciesDescriptors = DependencyDescriptor[];
export type DependencyChainItem = Partial<DependencyDescriptor> & {
  dependencyName: ServiceName;
};
export type DependencyChain = DependencyChainItem[];

export type SiloIndex = string & { _type?: 'silo' };
export interface ServiceRequirement {
  dependencies?: DependenciesDescriptors;
  dependents: Record<
    ServiceName,
    {
      mappedName: ServiceName;
      serviceName: ServiceName;
      finalName: ServiceName;
      optional: boolean;
      parentName: ServiceName;
    }
  >;
}
export type SiloContext = {
  index: SiloIndex | 'singletons';
  requiredServices: Record<ServiceName, ServiceRequirement>;
  loadingSequences: ServiceName[][];
} & (
  | {
      status: 'idle';
    }
  | {
      status: 'init';
      readyPromise: Promise<undefined>;
    }
  | {
      status: 'run';
    }
  | {
      status: 'shutdown';
      shutdownPromise: Promise<undefined>;
    }
  | {
      status: 'stopped';
    }
);

export interface InternalDependencies {
  $dispose: Disposer;
  $autoload: Autoloader<Initializer<unknown, Record<string, unknown>>>;
  $injector: Injector<Record<string, unknown>>;
  $instance: Knifecycle;
  $siloContext: SiloContext;
  $fatalError: FatalErrorService;
}

const debug = initDebug('knifecycle');

export const UNBUILDABLE_SERVICES = [
  '$autoload',
  '$injector',
  '$instance',
  '$siloContext',
];

export const INTERNAL_SERVICES = [
  '$fatalError',
  '$siloContext',
  '$siloIndex',
  '$ready',
  '$dispose',
  '$instance',
  '$overrides',
  '$injector',
];

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

In fact, the Knifecycle API is aimed to allow to statically
 build its services load/unload code once in production.
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
export class Knifecycle {
  private _silosCounter: number;
  private _silosContexts: Record<SiloIndex, SiloContext>;
  private _initializers: Map<ServiceName, Initializer<unknown, Dependencies>>;
  private _providers: Record<
    SiloIndex,
    Map<ServiceName, Provider<Service> | typeof NO_PROVIDER>
  >;
  private _autoloadingServices: ServiceName[];

  /**
   * Create a new Knifecycle instance
   * @param {Object}  options
   * An object with options
   * @param {boolean} options.sequential
   * Allows to load dependencies sequentially (useful for debugging)
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
    this._silosContexts = {
      singletons: {
        index: 'singletons',
        status: 'idle',
        requiredServices: {},
        loadingSequences: [],
      },
    };
    this._autoloadingServices = [];
    this._providers = {
      singletons: new Map(),
    };
    this._initializers = new Map();
    this._initializers.set('$fatalError', initFatalError);
    this._initializers.set(
      '$siloContext',
      service(
        (async () => {
          throw new YError('E_UNEXPECTED_INIT', ['$siloContext']);
        }) as ServiceInitializerBuilder<Dependencies, unknown>,
        '$siloContext',
      ),
    );
    this._initializers.set(
      '$siloIndex',
      service(
        (async () => {
          throw new YError('E_UNEXPECTED_INIT', ['$siloIndex']);
        }) as ServiceInitializerBuilder<Dependencies, unknown>,
        '$siloIndex',
      ),
    );
    this._initializers.set(
      '$ready',
      service(
        (async () => {
          throw new YError('E_UNEXPECTED_INIT', ['$ready']);
        }) as ServiceInitializerBuilder<Dependencies, unknown>,
        '$ready',
      ),
    );
    this._initializers.set('$fatalError', initFatalError);
    this._initializers.set(
      '$dispose',
      initDispose as Initializer<unknown, Dependencies>,
    );
    // TODO: consider direct injection
    this._initializers.set('$instance', constant('$instance', this));
    this._initializers.set('$overrides', constant('$overrides', {}));
    const initInjectorProvider = provider(
      (async ({
        $siloIndex,
        $instance,
      }: {
        $siloIndex: SiloIndex;
        $instance: Knifecycle;
      }) => ({
        service: async (dependenciesDeclarations: DependencyDeclaration[]) => {
          return $instance._loadDependencies(
            $siloIndex,
            INJECTOR_DEPENDENT_NAME,
            dependenciesDeclarations,
          );
        },
      })) as unknown as ProviderInitializerBuilder<Dependencies, Service>,
      '$injector',
      ['$siloIndex', '$instance'],
      // Despite its global definition, the injector
      // depends on the silo context and then needs
      // to be instantiated once per silo.
      false,
    );

    this._initializers.set('$injector', initInjectorProvider);
  }

  /* Architecture Note #1.3: Registering initializers

  The first step to use `knifecycle` is to create a new
   `Knifecycle` instance and register the previously
   created initializers.

  Initializers can be of three types:
  - constants: a `constant` initializer resolves to
   any constant value.
  - services: a `service` initializer directly
   resolve to the actual service it builds. It can
   be objects, functions or literal values.
  - providers: they instead resolve to an object that
   contains the service built into the `service` property
   but also an optional `dispose` property exposing a
   method to properly stop the service and a
   `fatalErrorPromise` that will be rejected if an
   unrecoverable error happens allowing Knifecycle
   to terminate.

   Initializers can be declared as singletons (constants are
    of course only singletons). This means that they will be
    instantiated once for all for each executions silos using
    them (we will cover this topic later on).
  */

  /**
   * List registered initializers
   * @return {string[]}
   * The service names registered
   */
  registered(): ServiceName[] {
    return [...new Set([...this._initializers.keys()].concat(['$injector']))];
  }

  /**
   * Get a previously registered initializer
   * @param {string} serviceName
   * @return {Initializer}
   * The initializer registered
   */
  getRegisteredInitializer(serviceName: ServiceName) {
    return this._initializers.get(serviceName);
  }

  /**
   * Register an initializer
   * @param  {Function}   initializer
   * An initializer
   * @return {Knifecycle}
   * The Knifecycle instance (for chaining)
   */
  register<T extends Initializer<unknown, any>>(initializer: T): Knifecycle {
    if (
      this._silosContexts['singletons'].status === 'shutdown' ||
      this._silosContexts['singletons'].status === 'stopped'
    ) {
      throw new YError('E_INSTANCE_DESTROYED');
    }
    if (RESERVED_SERVICE_NAMES.includes(initializer.$name)) {
      throw new YError('E_RESERVED_SERVICE_NAME', [initializer.$name]);
    }
    if (
      this._silosContexts &&
      IMMUTABLE_SERVICE_NAMES.includes(initializer.$name)
    ) {
      throw new YError('E_IMMUTABLE_SERVICE_NAME', [initializer.$name]);
    }
    if (initializer.$name === '$overrides') {
      if (initializer.$type !== 'constant') {
        throw new YError('E_CONSTANT_SERVICE_NAME', [
          initializer.$name,
          initializer.$type,
        ]);
      }
      this._providers.singletons.set('$overrides', {
        service: initializer.$value,
      });
    }

    this._checkInitializerOverride(initializer.$name);

    unwrapInitializerProperties(initializer);

    if (this._providers.singletons.get(initializer.$name) === NO_PROVIDER) {
      this._providers.singletons.delete(initializer.$name);
    }

    this._initializers.set(initializer.$name, initializer);

    debug(`Registered an initializer: ${initializer.$name}`);
    return this;
  }

  _checkInitializerOverride(serviceName: ServiceName) {
    if (this._initializers.has(serviceName)) {
      debug(`Overridding an initializer: ${serviceName}`);
      for (const silo of Object.values(this._silosContexts)) {
        if (
          silo.status === 'init' ||
          (silo.status === 'run' && silo.requiredServices[serviceName])
        ) {
          debug(
            `Override attempt of an already used initializer: ${serviceName}`,
          );
          throw new YError('E_INITIALIZER_ALREADY_INSTANTIATED', [serviceName]);
        }
      }
    }
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
    const links = [...this._initializers.keys()]
      .filter((provider) => !provider.startsWith('$'))
      .reduce((links, serviceName) => {
        const initializer = this._initializers.get(serviceName);

        if (
          !initializer ||
          !('$inject' in initializer) ||
          !initializer.$inject?.length
        ) {
          return links;
        }

        return links.concat(
          initializer.$inject.map((dependencyDeclaration: string) => {
            const dependedServiceName = parseDependencyDeclaration(
              dependencyDeclaration,
            ).serviceName;

            return { serviceName, dependedServiceName };
          }),
        );
      }, [] as MermaidLink[]);
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

  _resolveDependencyDeclaration(
    parentName: ServiceName,
    dependencyDeclaration: DependencyDeclaration,
  ) {
    if (
      this._silosContexts.singletons.status !== 'init' &&
      this._silosContexts.singletons.status !== 'run'
    ) {
      throw new YError();
    }
    const $overrides = (
      this._providers.singletons.get('$overrides') as Provider<Overrides>
    )?.service;
    const parsedDependency = parseDependencyDeclaration(dependencyDeclaration);

    if ($overrides) {
      // TODO: Put the full list vs only first item
      const parents = [parentName];
      return {
        ...parsedDependency,
        finalName: pickOverriddenName($overrides, [
          ...parents,
          parsedDependency.mappedName,
        ]),
      };
    }

    return {
      ...parsedDependency,
      finalName: parsedDependency.mappedName,
    };
  }

  _requireDependenciesDeclarations(
    siloContext: SiloContext,
    parentName: ServiceName,
    dependenciesDeclarations: DependencyDeclaration[],
  ): DependenciesDescriptors {
    const serviceNames: DependenciesDescriptors = [];

    for (const serviceDeclaration of dependenciesDeclarations) {
      const { finalName, mappedName, serviceName, optional } =
        this._resolveDependencyDeclaration(parentName, serviceDeclaration);

      if (parentName === finalName) {
        throw new YError('E_CIRCULAR_DEPENDENCY', [
          parentName,
          [
            {
              dependencyName: parentName,
              finalName,
              serviceName,
              optional,
            },
          ],
        ]);
      }

      const serviceRequirement = this._getServiceRequirement(
        siloContext,
        finalName,
      ) || {
        dependents: {},
      };

      serviceRequirement.dependents[parentName] = {
        mappedName,
        serviceName,
        finalName,
        optional,
        parentName,
      };
      this._setServiceRequirement(siloContext, finalName, serviceRequirement);

      serviceNames.push({
        serviceName,
        finalName,
        optional,
      });
    }

    return serviceNames;
  }

  _getProvider(
    siloContext: SiloContext,
    service: ServiceName,
  ): Provider<Service> | typeof NO_PROVIDER | undefined {
    if (this._providers[siloContext.index].has(service)) {
      return this._providers[siloContext.index].get(service);
    }
    if (this._providers.singletons.has(service)) {
      return this._providers.singletons.get(service);
    }
    return undefined;
  }

  _deleteProvider(siloContext: SiloContext, service: ServiceName) {
    if (this._providers[siloContext.index].has(service)) {
      this._providers[siloContext.index].delete(service);
    }
    if (service in this._providers.singletons) {
      this._providers.singletons.delete(service);
    }
  }

  _resolveDependencies(
    siloContext: SiloContext,
    dependentName: ServiceName,
    dependencies: DependenciesDescriptors,
    skippableServices: Set<ServiceName>,
    circularServices: Set<ServiceName>,
  ): Record<ServiceName, Service> | undefined {
    const services: Record<ServiceName, Service> = {};

    for (const { serviceName, finalName, optional } of dependencies) {
      const provider =
        finalName === '$fatalError' &&
        this._initializers.get(dependentName)?.$singleton
          ? this._providers.singletons.get('$fatalError')
          : this._getProvider(siloContext, finalName);

      if (!provider) {
        if (circularServices.has(finalName)) {
          if (optional) {
            debug(
              ` ⚠️ - Ignoring "${
                finalName
              }" optional circular autoloader dependency of "${
                dependentName
              }".`,
            );
            continue;
          }
          throw new YError('E_AUTO_LOADER_RECURSION_DEAD_LOCK', [
            finalName,
            this._getDependenciesChains(siloContext, {
              dependencyName: finalName,
            }),
          ]);
        }
        if (skippableServices.has(finalName)) {
          if (optional) {
            if (dependentName === '$autoload') {
              debug(
                ` ⚠️ -Ignoring "${
                  finalName
                }" skippable optional dependency for "$autoload".`,
              );
              continue;
            }

            const autoloadChains = this._getDependenciesChains(siloContext, {
              dependencyName: dependentName,
            }).filter((chain) =>
              chain.some((item) => item.dependencyName === '$autoload'),
            );

            if (
              autoloadChains.some((chain) =>
                chain.some((item) => item.dependencyName === finalName),
              )
            ) {
              debug(
                `Ignoring "${
                  finalName
                }" skippable optional dependency for "$autoload".`,
              );
              continue;
            }
          }

          debug(`"${dependentName}" still miss skipable ${finalName}.`);
          return undefined;
        }
        debug(`"${dependentName}" still miss ${finalName}.`);
        return undefined;
      }

      if (provider === NO_PROVIDER) {
        if (optional) {
          continue;
        } else {
          const chains = this._getDependenciesChains(siloContext, {
            dependencyName: finalName,
          });

          throw new YError('E_UNMATCHED_DEPENDENCY', [serviceName, chains]);
        }
      } else {
        if (
          // FIXME: Maybe injector should only inject singletons when used with autoloader ?
          finalName !== '$injector' &&
          this._initializers.has(dependentName) &&
          this._initializers.get(dependentName)?.$singleton &&
          !this._initializers.get(finalName)?.$singleton
        ) {
          throw new YError('E_BAD_SINGLETON_DEPENDENCIES', [
            dependentName,
            serviceName,
          ]);
        }
        services[serviceName] = provider?.service;
      }
    }

    return services;
  }

  _getServiceRequirement(
    siloContext: SiloContext,
    dependencyName: ServiceName,
  ): ServiceRequirement {
    const serviceRequirement =
      siloContext.requiredServices[dependencyName] ||
      this._silosContexts.singletons.requiredServices[dependencyName];

    return serviceRequirement;
  }

  _setServiceRequirement(
    siloContext: SiloContext,
    dependencyName: ServiceName,
    serviceRequirement: ServiceRequirement,
  ) {
    const initializer = this._initializers.get(dependencyName);

    if (initializer && initializer.$singleton) {
      this._silosContexts.singletons.requiredServices[dependencyName] =
        serviceRequirement;

      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete siloContext.requiredServices[dependencyName];
    } else {
      siloContext.requiredServices[dependencyName] = serviceRequirement;
    }

    return serviceRequirement;
  }

  _getDependenciesChains(
    siloContext: SiloContext,
    dependency: DependencyChainItem,
    visited: Set<ServiceName> = new Set<ServiceName>(),
  ) {
    if (visited.has(dependency.dependencyName)) {
      return [[dependency]];
    }

    visited.add(dependency.dependencyName);

    const serviceRequirement = this._getServiceRequirement(
      siloContext,
      dependency.dependencyName,
    );

    if (!serviceRequirement || !serviceRequirement.dependents) {
      return [[dependency]];
    }

    const dependenciesNames = Object.keys(serviceRequirement.dependents);

    if (dependenciesNames.length === 0) {
      return [];
    }

    const nextVisited = new Set(visited);
    const chains: DependencyChain[] = [];

    for (const dependencyName of dependenciesNames) {
      const { optional, finalName, serviceName } =
        serviceRequirement.dependents[dependencyName];
      const subChains = this._getDependenciesChains(
        siloContext,
        { optional, finalName, serviceName, dependencyName },
        nextVisited,
      );

      if (subChains.length === 0) {
        chains.push([
          { optional, finalName, serviceName, dependencyName },
          dependency,
        ]);
      } else {
        for (const subChain of subChains) {
          chains.push([...subChain, dependency]);
        }
      }
    }

    return chains;
  }

  _detectCircularChain(serviceName: ServiceName, chains: DependencyChain[]) {
    for (const chain of chains) {
      if (chain.length > 2) {
        const first = chain[0];
        const last = chain[chain.length - 1];

        if (first.dependencyName === last.dependencyName) {
          throw new YError('E_CIRCULAR_DEPENDENCY', [serviceName, chain]);
        }
      }
    }
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
    if (
      this._silosContexts.singletons.status === 'shutdown' ||
      this._silosContexts.singletons.status === 'stopped'
    ) {
      throw new YError('E_INSTANCE_DESTROYED');
    }

    const { promise: readyPromise, resolve: resolveReady } =
      Promise.withResolvers<undefined>();
    const siloIndex: SiloIndex = `silo-${this._silosCounter++}`;
    const siloContext: SiloContext = {
      index: siloIndex,
      status: 'init',
      requiredServices: {
        $dispose: {
          dependents: {},
        },
        $fatalError: {
          dependents: {},
          dependencies: [],
        },
      },
      loadingSequences: [],
      readyPromise,
    };

    this._silosContexts[siloIndex] = siloContext;
    this._providers[siloIndex] = new Map();

    // Make the siloContext available for internal injections
    this._providers[siloIndex].set('$siloContext', {
      service: siloContext,
    });
    this._providers[siloIndex].set('$siloIndex', {
      service: siloIndex,
    });

    const singletonsFatalError =
      (
        this._providers.singletons.get(
          '$fatalError',
        ) as unknown as Provider<FatalErrorService>
      )?.service ?? (await initFatalError({}));
    const siloFatalError = await initFatalError({});

    if (!this._providers.singletons.has('$fatalError')) {
      this._providers.singletons.set('$fatalError', {
        service: singletonsFatalError,
      });
    }
    this._providers[siloIndex].set('$fatalError', {
      service: siloFatalError,
    });
    siloFatalError.registerErrorPromise(
      (
        this._providers.singletons.get(
          '$fatalError',
        ) as Provider<FatalErrorService>
      ).service.errorPromise,
    );

    // Make the ready service available for internal injections
    this._providers[siloIndex].set('$ready', {
      service: siloContext.readyPromise,
    });

    this._silosContexts.singletons = {
      ...this._silosContexts.singletons,
      status: 'init',
      readyPromise:
        this._silosContexts.singletons.status === 'init'
          ? (Promise.all([
              this._silosContexts.singletons.readyPromise,
              readyPromise,
            ]) as unknown as Promise<undefined>)
          : readyPromise,
    };

    const services = await this._loadDependencies<ID>(
      siloIndex,
      RUN_DEPENDENT_NAME,
      dependenciesDeclarations,
    );

    this._silosContexts[siloIndex] = {
      ...siloContext,
      status: 'run',
    };

    resolveReady(undefined);

    return services;
  }

  async _loadDependencies<ID extends Record<string, unknown>>(
    siloIndex: SiloIndex,
    rootName: ServiceName,
    dependenciesDeclarations: DependencyDeclaration[],
  ): Promise<ID> {
    const siloContext = this._silosContexts[siloIndex];
    const dependencies = this._requireDependenciesDeclarations(
      siloContext,
      rootName,
      dependenciesDeclarations,
    );

    let noEffectRoundCount = 0;
    let lackingServices = new Set<ServiceName>(
      dependencies
        .map((dependency) => dependency.finalName)
        .concat(['$dispose', '$fatalError']),
    );
    const skippableServices = new Set<ServiceName>();
    const circularServices = new Set<ServiceName>();
    const touchedServices = new Set<ServiceName>();
    let previouslyLackingServices: Set<ServiceName>;

    while (lackingServices.size) {
      debug(`${rootName}: Starting a new loading sequence:`, {
        lackingServices,
        circularServices,
        skippableServices,
        noEffectRoundCount,
        touchedServices,
      });

      const loadingSequence = new Set<ServiceName>();

      previouslyLackingServices = lackingServices;

      for await (const lackingService of lackingServices) {
        // Check if already loaded
        if (this._providers.singletons.has(lackingService)) {
          debug(
            `${rootName}: picking "${
              lackingService
            }" from singletons providers.`,
          );
          loadingSequence.add(lackingService);
          continue;
        }
        if (this._providers[siloIndex].has(lackingService)) {
          debug(
            `${rootName}: picking "${lackingService}" from silos providers.`,
          );
          loadingSequence.add(lackingService);
          continue;
        }

        const lackingServiceRequirement = this._getServiceRequirement(
          siloContext,
          lackingService,
        );

        if (
          lackingServiceRequirement &&
          lackingServiceRequirement.dependencies
        ) {
          const initializer = this._initializers.get(
            lackingService,
          ) as Initializer<UnknownCredentialOptions, Dependencies>;
          let provider: Provider<Service> | undefined = undefined;

          if (initializer.$type === 'constant') {
            debug(`${rootName}: picking "${lackingService}" constant.`);
            provider = {
              service: initializer.$value,
            };
          } else {
            const services = this._resolveDependencies(
              siloContext,
              lackingService,
              lackingServiceRequirement.dependencies,
              skippableServices,
              circularServices,
            ) as Dependencies;

            if (services) {
              if (initializer.$type === 'service') {
                debug(
                  `${rootName}: instantiating "${lackingService}" service.`,
                );
                const servicePromise = initializer?.(services);

                if (!servicePromise || !servicePromise.then) {
                  debug(
                    'Service initializer did not return a promise:',
                    lackingService,
                  );
                  throw new YError('E_BAD_SERVICE_PROMISE', [lackingService]);
                }

                provider = {
                  service: await servicePromise,
                };
              } else {
                debug(
                  `${rootName}: instantiating "${lackingService}" provider.`,
                );
                const providerPromise = initializer?.(services);

                if (!providerPromise || !providerPromise.then) {
                  debug(
                    'Provider initializer did not return a promise:',
                    lackingService,
                  );
                  throw new YError('E_BAD_SERVICE_PROVIDER', [lackingService]);
                }

                provider = await providerPromise;

                if (
                  !provider ||
                  !(typeof provider === 'object') ||
                  !('service' in provider)
                ) {
                  debug('Provider has no `service` property:', lackingService);
                  throw new YError('E_BAD_SERVICE_PROVIDER', [lackingService]);
                }

                if (provider.fatalErrorPromise) {
                  const $fatalError = (
                    (initializer.$singleton
                      ? this._providers.singletons.get('$fatalError')
                      : this._providers[siloIndex].get(
                          '$fatalError',
                        )) as Provider<FatalErrorService>
                  ).service;

                  debug(
                    'Registering service descriptor error promise:',
                    lackingService,
                  );
                  $fatalError.registerErrorPromise(provider.fatalErrorPromise);
                }
              }
            }
          }

          if (provider) {
            if (initializer.$singleton) {
              this._providers.singletons.set(lackingService, provider);
            } else {
              this._providers[siloContext.index].set(lackingService, provider);
            }
            loadingSequence.add(lackingService);
            continue;
          }

          debug(
            `${rootName}: waiting dependencies for "${
              lackingService
            }" instantiation.`,
          );
          continue;
        }

        // Check if initializer exists and require dependencies
        if (
          this._initializers.has(lackingService) &&
          !lackingServiceRequirement.dependencies
        ) {
          const initializer = this._initializers.get(lackingService);

          debug(
            `${rootName}: registering "${lackingService}" from initializer.`,
          );
          lackingServiceRequirement.dependencies =
            initializer?.$type === 'constant'
              ? []
              : this._requireDependenciesDeclarations(
                  siloContext,
                  lackingService,
                  initializer?.$inject || [],
                );

          this._setServiceRequirement(
            siloContext,
            lackingService,
            lackingServiceRequirement,
          );

          lackingServices = lackingServices.union(
            new Set(
              lackingServiceRequirement.dependencies.map(
                (dependency) => dependency.finalName,
              ),
            ),
          );

          touchedServices.add(lackingService);

          continue;
        }

        const $autoload = this._providers.singletons.get('$autoload');

        if (!$autoload) {
          if (this._initializers.has('$autoload')) {
            lackingServices.add('$autoload');

            const autoloadServiceRequirement = this._getServiceRequirement(
              siloContext,
              '$autoload',
            ) ?? {
              dependents: {},
            };

            if (!autoloadServiceRequirement.dependents[lackingService]) {
              debug(
                `${rootName}: using autoloader for "${
                  lackingService
                }" dependency.`,
              );
              autoloadServiceRequirement.dependents[lackingService] = {
                mappedName: '$autoload',
                serviceName: '$autoload',
                finalName: '$autoload',
                parentName: lackingService,
                optional: true,
              };
              this._setServiceRequirement(
                siloContext,
                '$autoload',
                autoloadServiceRequirement,
              );
            }
            continue;
          } else {
            this._providers.singletons.set('$autoload', NO_PROVIDER);
          }
        } else if ($autoload && $autoload !== NO_PROVIDER) {
          debug(`${rootName}: Attempting to autoload "${lackingService}".`);
          if (this._autoloadingServices.includes(lackingService)) {
            debug(
              `${rootName}: Autoloader recursion detected for "${
                lackingService
              }:"`,
              this._autoloadingServices,
            );
            throw new YError('E_AUTO_LOADER_RECURSION_DEAD_LOCK', [
              lackingService,
              this._getDependenciesChains(siloContext, {
                dependencyName: lackingService,
              }),
            ]);
          }
          this._autoloadingServices.push(lackingService);
          try {
            const initializer = await (
              $autoload as Provider<
                Autoloader<Initializer<unknown, Dependencies<unknown>>>
              >
            ).service(lackingService);

            try {
              if (!['object', 'function'].includes(typeof initializer)) {
                throw new YError('E_BAD_AUTO_LOADER_RESULT', [
                  lackingService,
                  initializer,
                ]);
              }

              if (initializer.$name !== lackingService) {
                throw new YError('E_AUTO_LOADED_INITIALIZER_MISMATCH', [
                  lackingService,
                  initializer.$name,
                ]);
              }

              unwrapInitializerProperties(initializer);

              if (
                this._providers.singletons.get(initializer.$name) ===
                NO_PROVIDER
              ) {
                this._providers.singletons.delete(initializer.$name);
              }

              this._initializers.set(lackingService, initializer);

              this._autoloadingServices.splice(
                this._autoloadingServices.indexOf(lackingService),
                1,
              );
              touchedServices.add(lackingService);
            } catch (err) {
              throw YError.wrap(err as Error, 'E_BAD_AUTO_LOADED_INITIALIZER', [
                lackingService,
              ]);
            }
          } catch (err) {
            this._autoloadingServices.splice(
              this._autoloadingServices.indexOf(lackingService),
              1,
            );
            const castedError = pickYErrorWithCode(
              err,
              'E_DEPENDENCY_NOT_FOUND',
            );

            if (castedError) {
              debug(
                `${rootName}: Autoloader did not found "${lackingService}"`,
              );
              this._providers.singletons.set(lackingService, NO_PROVIDER);
              loadingSequence.add(lackingService);
              continue;
            }

            const circularCastedError = pickYErrorWithCode(
              err,
              'E_AUTO_LOADER_RECURSION_DEAD_LOCK',
            );

            if (circularCastedError) {
              debug(
                `${rootName}: Autoload circularly loads "${
                  lackingService
                }" via the "$injector" service`,
              );
              circularServices.add(lackingService);
              continue;
            }

            const deadLockCastedError = pickYErrorWithCode(err, 'E_DEAD_LOCK');

            if (deadLockCastedError) {
              debug(
                `${rootName}: Autoload load dead locks "${
                  lackingService
                }" via the "$injector" service`,
              );
              circularServices.add(lackingService);
              continue;
            }
            throw err;
          }
          continue;
        } else {
          this._providers.singletons.set(lackingService, NO_PROVIDER);
        }
      }

      if (loadingSequence.size) {
        const finalLoadingSequence = new Set(loadingSequence);

        for (const serviceName of loadingSequence) {
          if (
            siloContext.loadingSequences.some((loadingSequence) =>
              loadingSequence.includes(serviceName),
            )
          ) {
            finalLoadingSequence.delete(serviceName);
          }
        }

        if (finalLoadingSequence.size) {
          siloContext.loadingSequences.push([...finalLoadingSequence.values()]);
        }
      }

      lackingServices = lackingServices.difference(loadingSequence);

      debug(`${rootName}: Dependency load round result:`, {
        rootName,
        circularServices,
        skippableServices,
        loadingSequence,
        lackingServices,
        touchedServices,
        noEffectRoundCount,
      });

      if (touchedServices.size) {
        noEffectRoundCount = 0;
      }
      touchedServices.clear();
      if (loadingSequence.size) {
        skippableServices.clear();
        circularServices.clear();
        noEffectRoundCount = 0;
      }

      if (
        loadingSequence.size === 0 &&
        previouslyLackingServices.difference(lackingServices).size === 0
      ) {
        noEffectRoundCount++;

        if (noEffectRoundCount && lackingServices.has('$autoload')) {
          const chains = this._getDependenciesChains(siloContext, {
            dependencyName: '$autoload',
          });

          for (const chain of chains) {
            try {
              this._detectCircularChain('$autoload', [chain]);
            } catch (err) {
              const castedError = pickYErrorWithCode(
                err,
                'E_CIRCULAR_DEPENDENCY',
              );

              if (castedError && castedError.debug[0] === '$autoload') {
                const chain = castedError.debug[1];
                const skippableServiceName = chain[chain.length - 3].finalName;

                if (
                  skippableServiceName &&
                  !this._getProvider(siloContext, skippableServiceName)
                ) {
                  debug(
                    `${rootName}: Flagging "${
                      skippableServiceName
                    }" as a skippable service for autoloader.`,
                    skippableServiceName,
                  );
                  skippableServices.add(skippableServiceName);
                  continue;
                }
              }
            }
          }
        }

        // FIXME: try to reduce no effect count by
        // doing more in less rounds
        if (noEffectRoundCount > 5) {
          for (const lackingService of lackingServices) {
            const chains = this._getDependenciesChains(siloContext, {
              dependencyName: lackingService,
            });

            this._detectCircularChain(lackingService, chains);
          }

          if (
            [...lackingServices].every((lackingService) =>
              dependencies.some(
                (dependency) =>
                  dependency.finalName === lackingService &&
                  dependency.optional,
              ),
            )
          ) {
            debug(
              `${rootName}: Cleaning up locking optional root dependencies:`,
              lackingServices,
            );
            lackingServices.clear();
          }

          if (noEffectRoundCount > 8) {
            debug(
              `${rootName}: Detected a dead lock:`,
              JSON.stringify(
                [...lackingServices.values()].map((lackingService) => {
                  return this._getDependenciesChains(siloContext, {
                    dependencyName: lackingService,
                  });
                }),
                null,
                2,
              ),
            );
            throw new YError('E_DEAD_LOCK', [
              [...lackingServices.values()],
              [...lackingServices.values()].map((lackingService) => {
                return this._getDependenciesChains(siloContext, {
                  dependencyName: lackingService,
                });
              }),
            ]);
          }
        }
      }
    }

    debug(
      `${rootName}: All dependencies now loaded:`,
      siloContext.loadingSequences,
    );

    return this._resolveDependencies(
      siloContext,
      rootName,
      dependencies,
      skippableServices,
      circularServices,
    ) as ID;
  }

  async shutdown(siloIndex: SiloIndex): Promise<undefined> {
    debug(`Destroying Knifecycle silo: ${siloIndex}`);

    const $siloContext = this._silosContexts[siloIndex];

    if ($siloContext.status === 'stopped') {
      return;
    }

    if ($siloContext.status === 'shutdown') {
      return $siloContext.shutdownPromise;
    }

    const shutdownPromise = this._shutdownNextServices(
      siloIndex,
      $siloContext.loadingSequences.concat(),
    );

    this._silosContexts[siloIndex] = {
      ...$siloContext,
      status: 'shutdown',
      shutdownPromise,
    };

    await shutdownPromise;

    this._silosContexts[siloIndex] = {
      ...$siloContext,
      status: 'stopped',
    };
  }

  // Shutdown services in their instantiation order
  async _shutdownNextServices(
    siloIndex: SiloIndex,
    serviceLoadSequences: ServiceName[][],
  ): Promise<undefined> {
    if (0 === serviceLoadSequences.length) {
      return;
    }

    const currentServiceLoadSequence = serviceLoadSequences.pop() || [];
    const dependendedByAServiceInTheSameBatch: string[] = [];
    const servicesToShutdown = [];

    for (const serviceName of currentServiceLoadSequence) {
      if (siloIndex !== 'singleton') {
        const initializer = this._initializers.get(serviceName);

        if (initializer?.$singleton) {
          const usedByAnotherSilo = Object.values(this._silosContexts).some(
            (siloContext) =>
              siloContext.index !== 'singletons' &&
              siloContext.index !== siloIndex &&
              ['init', 'run'].includes(siloContext.status) &&
              siloContext.loadingSequences.some((loadingSequence) =>
                loadingSequence.includes(serviceName),
              ),
          );

          if (usedByAnotherSilo) {
            debug(
              `Delegating service "${serviceName}" shutdown to another silo.`,
            );
            continue;
          }
        }
      }

      const serviceRequirement = this._getServiceRequirement(
        this._silosContexts[siloIndex],
        serviceName,
      );

      // Ensure to remove services that depends on
      // another service loaded in the same batch (may
      // happen depending on the load sequence)
      if (
        Object.keys(serviceRequirement.dependents).some(
          (dependentName) =>
            currentServiceLoadSequence.includes(dependentName) &&
            !dependendedByAServiceInTheSameBatch.includes(dependentName),
        )
      ) {
        dependendedByAServiceInTheSameBatch.push(serviceName);
        debug(
          `Delaying service "${
            serviceName
          }" dependencies shutdown to a dedicated batch.'`,
        );
        continue;
      }

      servicesToShutdown.push(serviceName);
    }

    for await (const serviceName of servicesToShutdown) {
      if (
        serviceLoadSequences.some((servicesLoadSequence) =>
          servicesLoadSequence.includes(serviceName),
        )
      ) {
        // TODO: This should not happen now, check it with a test
        debug(`Delaying "${serviceName}" service shutdown to another batch.`);
        continue;
      }

      const provider = this._getProvider(
        this._silosContexts[siloIndex],
        serviceName,
      );

      if (provider && provider !== NO_PROVIDER && provider.dispose) {
        await provider.dispose();
      }

      if (
        siloIndex !== 'singletons' &&
        this._initializers.get(serviceName)?.$singleton
      ) {
        this._providers.singletons.delete(serviceName);
        Reflect.deleteProperty(
          this._silosContexts.singletons.requiredServices,
          serviceName,
        );
      }
    }

    if (dependendedByAServiceInTheSameBatch.length) {
      serviceLoadSequences.unshift(dependendedByAServiceInTheSameBatch);
    }

    await this._shutdownNextServices(siloIndex, serviceLoadSequences);
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
  async destroy(): Promise<undefined> {
    debug('Destroying Knifecycle instance.');

    for await (const siloIndex of Object.keys(this._silosContexts)) {
      await this.shutdown(siloIndex);
    }
  }
}

function _applyShapes(shapes: MermaidShapes, serviceName: string) {
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
interface MermaidLink {
  serviceName: string;
  dependedServiceName: string;
}
type MermaidStyles = {
  pattern: RegExp;
  className: string;
}[];
type MermaidClasses = Record<string, string>;

function _applyClasses(
  classes: MermaidClasses,
  styles: MermaidStyles,
  links: MermaidLink[],
) {
  return links.reduce(
    (classesApplications, link) =>
      Object.assign(classesApplications, _applyStyles(classes, styles, link)),
    {} as MermaidClasses,
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
        throw new YError('E_BAD_CLASS', [style.className, serviceName]);
      }
      classesApplications[serviceName] = style.className;
    }
    if (
      style.pattern.test(dependedServiceName) &&
      !classesApplications[dependedServiceName]
    ) {
      if (!classes[style.className]) {
        throw new YError('E_BAD_CLASS', [style.className, dependedServiceName]);
      }
      classesApplications[dependedServiceName] = style.className;
    }
    return classesApplications;
  }, {} as MermaidClasses);
}
