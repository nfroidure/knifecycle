/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint max-len: ["warn", { "ignoreComments": true }] @typescript-eslint/no-this-alias: "warn" */
import { YError, printStackTrace } from 'yerror';
import initDebug from 'debug';
import {
  NO_PROVIDER,
  SPECIAL_PROPS,
  constant,
  service,
  provider,
  parseDependencyDeclaration,
  unwrapInitializerProperties,
  type ServiceName,
  type Service,
  type Disposer,
  type FatalErrorPromise,
  type Provider,
  type Dependencies,
  type DependencyDeclaration,
  type ConstantInitializer,
  type ProviderInitializerBuilder,
  type ProviderInitializer,
  type ServiceInitializerBuilder,
  type ServiceInitializer,
  type AsyncInitializer,
  type Initializer,
} from './util.js';
import initFatalError, { type FatalErrorService } from './fatalError.js';
import initDispose from './dispose.js';
import { type Overrides, pickOverridenName } from './overrides.js';
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

export interface KnifecycleOptions {
  sequential?: boolean;
}
export type Autoloader<
  T extends Initializer<unknown, Record<string, unknown>>,
> = (name: DependencyDeclaration) => Promise<T>;
export type SiloIndex = string;
export interface BaseInitializerStateDescriptor<S, D extends Dependencies> {
  dependents: {
    silo?: SiloIndex;
    name: ServiceName;
    optional: boolean;
  }[];
  initializerLoadPromise?: Promise<Initializer<S, D>>;
  initializer?: Initializer<S, D>;
  autoloaded: boolean;
}
export type SiloedInitializerStateDescriptor<
  S,
  D extends Dependencies,
> = BaseInitializerStateDescriptor<S, D> & {
  silosInstances: Record<
    SiloIndex,
    {
      dependency?: ServiceName;
      provider?: NonNullable<Provider<S> | typeof NO_PROVIDER>;
      providerLoadPromise?: Promise<void>;
      instanceDisposePromise?: Promise<S>;
    }
  >;
};
export type SingletonInitializerStateDescriptor<
  S,
  D extends Dependencies,
> = BaseInitializerStateDescriptor<S, D> & {
  singletonProvider?: NonNullable<Provider<S> | typeof NO_PROVIDER>;
  singletonProviderLoadPromise?: Promise<void>;
  disposer?: Disposer;
  fatalErrorPromise?: FatalErrorPromise;
};
export type AutoloadedInitializerStateDescriptor<
  S,
  D extends Dependencies,
> = BaseInitializerStateDescriptor<S, D> & {
  autoloaded: true;
};
export type InitializerStateDescriptor<S, D extends Dependencies> =
  | SingletonInitializerStateDescriptor<S, D>
  | SiloedInitializerStateDescriptor<S, D>
  | AutoloadedInitializerStateDescriptor<S, D>;
export interface SiloContext {
  index: SiloIndex;
  loadingServices: ServiceName[];
  loadingSequences: ServiceName[][];
  _shutdownPromise?: Promise<void>;
}

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
  private _options: KnifecycleOptions;
  private _silosCounter: number;
  _silosContexts: Record<SiloIndex, SiloContext>;
  _initializersStates: Record<
    string,
    InitializerStateDescriptor<unknown, Dependencies>
  >;
  private _shutdownPromise?: Promise<void>;

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
  constructor(options?: KnifecycleOptions) {
    this._options = options || {};
    this._initializersStates = {
      ['$fatalError']: {
        initializer: initFatalError,
        autoloaded: false,
        dependents: [],
      },
      ['$siloContext']: {
        initializer: service(
          (async () => {
            throw new YError('E_UNEXPECTED_INIT', ['$siloContext']);
          }) as ServiceInitializerBuilder<Dependencies, unknown>,
          '$siloContext',
        ),
        autoloaded: false,
        dependents: [],
        silosInstances: {},
      },
      ['$ready']: {
        initializer: service(
          (async () => {
            throw new YError('E_UNEXPECTED_INIT', ['$ready']);
          }) as ServiceInitializerBuilder<Dependencies, unknown>,
          '$ready',
        ),
        autoloaded: false,
        dependents: [],
        silosInstances: {},
      },
      ['$dispose']: {
        initializer: initDispose as any,
        autoloaded: false,
        dependents: [],
        silosInstances: {},
      },
    };
    this.register(constant('$instance', this));
    this.register(constant('$overrides', {}));

    const initInjectorProvider = provider(
      (async ({
        $siloContext,
        $instance,
      }: {
        $siloContext: SiloContext;
        $instance: Knifecycle;
      }) => ({
        service: async (dependenciesDeclarations: DependencyDeclaration[]) => {
          return $instance._loadInitializerDependencies(
            $siloContext,
            [INJECTOR_DEPENDENT_NAME],
            dependenciesDeclarations,
            [],
          );
        },
      })) as unknown as ProviderInitializerBuilder<Dependencies, Service>,
      '$injector',
      ['$siloContext', '$instance'],
      // Despite its global definition, the injector
      // depends on the silo context and then needs
      // to be instantiated once per silo.
      false,
    );

    this.register(initInjectorProvider);
    this._silosCounter = 0;
    this._silosContexts = {};
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
   * Register an initializer
   * @param  {Function}   initializer
   * An initializer
   * @return {Knifecycle}
   * The Knifecycle instance (for chaining)
   */
  register<T extends Initializer<unknown, any>>(initializer: T): Knifecycle {
    if (this._shutdownPromise) {
      throw new YError('E_INSTANCE_DESTROYED');
    }
    if (
      this._silosContexts &&
      ['$instance', '$injector', '$siloContext', '$dispose'].includes(
        initializer.$name,
      )
    ) {
      throw new YError('E_IMMUTABLE_SERVICE_NAME', [initializer.$name]);
    }
    if (
      initializer.$name === '$overrides' &&
      initializer[SPECIAL_PROPS.TYPE] !== 'constant'
    ) {
      throw new YError('E_CONSTANT_SERVICE_NAME', [
        initializer.$name,
        initializer[SPECIAL_PROPS.TYPE],
      ]);
    }

    const initializerState: InitializerStateDescriptor<any, any> = {
      initializer,
      autoloaded: false,
      dependents: [],
    };

    this._checkInitializerOverride(initializer.$name);

    this._buildInitializerState(initializerState, initializer);

    this._initializersStates[initializer.$name] = initializerState;

    debug(`Registered an initializer: ${initializer.$name}`);
    return this;
  }

  _checkInitializerOverride(serviceName: ServiceName) {
    if (this._initializersStates[serviceName]) {
      if ('initializer' in this._initializersStates[serviceName]) {
        if (this._initializersStates[serviceName]?.dependents?.length) {
          debug(
            `Override attempt of an already used initializer: ${serviceName}`,
          );
          throw new YError('E_INITIALIZER_ALREADY_INSTANTIATED', [serviceName]);
        }
        debug(`Overridden an initializer: ${serviceName}`);
      }
    }
  }

  _buildInitializerState(
    initializerState: InitializerStateDescriptor<any, any>,
    initializer: Initializer<unknown, any>,
  ): void {
    unwrapInitializerProperties(initializer);

    if (initializer.$type === 'constant') {
      const provider = {
        service: initializer.$value,
      };
      (
        initializerState as SingletonInitializerStateDescriptor<any, any>
      ).singletonProvider = provider;
      (
        initializerState as SingletonInitializerStateDescriptor<any, any>
      ).singletonProviderLoadPromise = Promise.resolve();
    } else {
      this._checkInitializerDependencies(initializer);
      if (!initializer.$singleton) {
        (
          initializerState as SiloedInitializerStateDescriptor<any, any>
        ).silosInstances = {};
      }
    }
  }

  _checkInitializerDependencies(initializer: AsyncInitializer<any, any>) {
    // Here, we do not have to take in count the overrides since it
    // won't impact the checking
    const initializerDependsOfItself = (initializer.$inject || [])
      .map((dependencyDeclaration) => {
        const { serviceName } = parseDependencyDeclaration(
          dependencyDeclaration,
        );

        if (
          // TEMP_FIX: let's build
          initializer.$name !== 'BUILD_CONSTANTS' &&
          // TEMP_FIX: Those services are special...
          !['$injector', '$siloContext'].includes(serviceName) &&
          initializer.$singleton &&
          this._initializersStates[serviceName] &&
          'initializer' in this._initializersStates[serviceName] &&
          this._initializersStates[serviceName]?.initializer &&
          !this._initializersStates[serviceName]?.initializer?.[
            SPECIAL_PROPS.SINGLETON
          ]
        ) {
          debug(
            `Found an inconsistent singleton initializer dependency: ${
              initializer.$name
            }`,
            serviceName,
            initializer,
          );
          throw new YError('E_BAD_SINGLETON_DEPENDENCIES', [
            initializer.$name,
            serviceName,
          ]);
        }

        return serviceName;
      })
      .includes(initializer.$name);

    if (
      // TEMP_FIX: let's build
      initializer.$name !== 'BUILD_CONSTANTS' &&
      !initializer.$singleton
    ) {
      Object.keys(this._initializersStates)
        .filter(
          (serviceName) =>
            ![
              // TEMP_FIX: Those services are special...
              '$injector',
              '$siloContext',
            ].includes(serviceName),
        )
        .forEach((serviceName) => {
          if (
            this._initializersStates[serviceName]?.initializer &&
            this._initializersStates[serviceName].initializer.$singleton &&
            '$inject' in this._initializersStates[serviceName].initializer &&
            (this._initializersStates[serviceName].initializer.$inject || [])
              .map(
                (declaration: string) =>
                  parseDependencyDeclaration(declaration).serviceName,
              )
              .includes(initializer.$name)
          ) {
            debug(
              `Found an inconsistent dependent initializer: ${
                initializer.$name
              }`,
              serviceName,
              initializer,
            );
            throw new YError('E_BAD_SINGLETON_DEPENDENCIES', [
              serviceName,
              initializer.$name,
            ]);
          }
        });
    }
    if (initializerDependsOfItself) {
      throw new YError('E_CIRCULAR_DEPENDENCY', [initializer.$name]);
    }

    (initializer.$inject || []).forEach((dependencyDeclaration) => {
      this._lookupCircularDependencies(
        initializer.$name,
        dependencyDeclaration,
      );
    });
  }

  _lookupCircularDependencies(
    rootServiceName: ServiceName,
    dependencyDeclaration: DependencyDeclaration,
    declarationsStacks: DependencyDeclaration[] = [],
  ): void {
    const serviceName = parseDependencyDeclaration(
      dependencyDeclaration,
    ).serviceName;
    const initializersState = this._initializersStates[serviceName];

    if (!initializersState || !initializersState.initializer) {
      return;
    }

    declarationsStacks = declarationsStacks.concat(dependencyDeclaration);

    ('$inject' in initializersState.initializer
      ? initializersState.initializer.$inject || []
      : []
    ).forEach((childDependencyDeclaration: string) => {
      const childServiceName = parseDependencyDeclaration(
        childDependencyDeclaration,
      ).serviceName;

      if (rootServiceName === childServiceName) {
        throw new YError(
          'E_CIRCULAR_DEPENDENCY',
          [rootServiceName]
            .concat(declarationsStacks)
            .concat(childDependencyDeclaration) as [ServiceName],
        );
      }

      this._lookupCircularDependencies(
        rootServiceName,
        childDependencyDeclaration,
        declarationsStacks,
      );
    });
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
    const initializersStates = this._initializersStates;
    const links = Object.keys(initializersStates)
      .filter((provider) => !provider.startsWith('$'))
      .reduce((links, serviceName) => {
        const initializerState = initializersStates[serviceName];

        if (
          !initializerState ||
          !initializerState.initializer ||
          !('$inject' in initializerState.initializer) ||
          !initializerState.initializer.$inject?.length
        ) {
          return links;
        }

        return links.concat(
          initializerState.initializer.$inject.map(
            (dependencyDeclaration: string) => {
              const dependedServiceName = parseDependencyDeclaration(
                dependencyDeclaration,
              ).serviceName;

              return { serviceName, dependedServiceName };
            },
          ),
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
    const siloIndex: SiloIndex = `silo-${this._silosCounter++}`;
    const siloContext: SiloContext = {
      index: siloIndex,
      loadingServices: [],
      loadingSequences: [],
    };

    let resolveReady: (value: void | PromiseLike<void>) => void;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    if (this._shutdownPromise) {
      throw new YError('E_INSTANCE_DESTROYED');
    }

    // Make the siloContext available for internal injections
    (
      this._initializersStates[
        '$siloContext'
      ] as SiloedInitializerStateDescriptor<SiloContext, Dependencies<unknown>>
    ).silosInstances[siloIndex] = {
      provider: { service: siloContext },
    };

    // Make the ready service available for internal injections
    (
      this._initializersStates['$ready'] as SiloedInitializerStateDescriptor<
        Promise<void>,
        Dependencies<unknown>
      >
    ).silosInstances[siloIndex] = {
      provider: { service: ready },
    };

    this._silosContexts[siloContext.index] = siloContext;

    const services = await this._loadInitializerDependencies(
      siloContext,
      [RUN_DEPENDENT_NAME],
      dependenciesDeclarations,
      ['$dispose', '$fatalError'],
    );

    debug('All dependencies now loaded:', siloContext.loadingSequences);

    // @ts-expect-error The promise initializer is
    // immediately executed so will never be undefined
    resolveReady();

    return services as ID;
  }

  _getInitializer(
    serviceName: ServiceName,
  ): Initializer<unknown, Dependencies> | undefined {
    return this._initializersStates[serviceName]?.initializer;
  }

  _getServiceProvider(
    siloContext: SiloContext,
    serviceName: ServiceName,
  ): Provider<unknown> | typeof NO_PROVIDER | undefined {
    const initializerState = this._initializersStates[serviceName];

    // This method expect the initialized to have a state
    // so failing early if not to avoid programming errors
    if (!initializerState) {
      throw new YError('E_UNEXPECTED_SERVICE_READ');
    }
    if ('initializer' in initializerState) {
      if ('singletonProvider' in initializerState) {
        const provider = initializerState.singletonProvider;

        if (provider) {
          return provider;
        }
      }

      if (
        'silosInstances' in initializerState &&
        initializerState.silosInstances &&
        initializerState.silosInstances[siloContext.index] &&
        'provider' in initializerState.silosInstances[siloContext.index]
      ) {
        const provider =
          initializerState.silosInstances[siloContext.index].provider;

        if (provider) {
          return provider;
        }
      }
    }

    return;
  }

  async _loadInitializerDependencies(
    siloContext: SiloContext,
    parentsNames: ServiceName[],
    dependenciesDeclarations: DependencyDeclaration[],
    additionalDeclarations: DependencyDeclaration[],
  ): Promise<Dependencies> {
    const overrides = (
      this._initializersStates['$overrides'].initializer as ConstantInitializer<
        Record<string, string>
      >
    ).$value as Overrides;

    debug(
      `${[...parentsNames].join(
        '->',
      )}: Gathering the dependencies (${dependenciesDeclarations.join(', ')}).`,
    );
    const allDependenciesDeclarations = [
      ...new Set(dependenciesDeclarations.concat(additionalDeclarations)),
    ];
    const dependencies: ServiceName[] = [];
    const lackingDependencies: ServiceName[] = [];

    for (const serviceDeclaration of allDependenciesDeclarations) {
      const { mappedName, optional } =
        parseDependencyDeclaration(serviceDeclaration);
      const finalName = pickOverridenName(overrides, [
        ...parentsNames,
        mappedName,
      ]);

      if (finalName !== mappedName) {
        debug(
          `${[...parentsNames, mappedName].join(
            '->',
          )}: Mapping a dependency (${mappedName} => ${finalName}).`,
        );
      }

      const initializerState = this._initializersStates[finalName] || {
        dependents: [],
        autoloaded: true,
      };

      this._initializersStates[finalName] = initializerState;
      initializerState.dependents.push({
        silo: siloContext.index,
        name: parentsNames[parentsNames.length - 1],
        optional,
      });

      dependencies.push(finalName);
    }

    do {
      const previouslyLackingDependencies = [...lackingDependencies];

      lackingDependencies.length = 0;

      for (const mappedName of dependencies) {
        if (!this._getServiceProvider(siloContext, mappedName)) {
          lackingDependencies.push(mappedName);
          if (!siloContext.loadingServices.includes(mappedName)) {
            siloContext.loadingServices.push(mappedName);
          }
        }
      }

      if (lackingDependencies.length) {
        await this._resolveDependencies(
          siloContext,
          lackingDependencies,
          parentsNames,
        );
      }
      const loadSequence = previouslyLackingDependencies.filter(
        (previouslyLackingDependency) =>
          !lackingDependencies.includes(previouslyLackingDependency),
      );

      if (loadSequence.length) {
        siloContext.loadingSequences.push(loadSequence);
      }
    } while (lackingDependencies.length);

    return dependenciesDeclarations.reduce(
      (finalHash, dependencyDeclaration) => {
        const { serviceName, mappedName, optional } =
          parseDependencyDeclaration(dependencyDeclaration);
        const finalName = pickOverridenName(overrides, [
          ...parentsNames,
          mappedName,
        ]);

        const provider = this._getServiceProvider(siloContext, finalName);

        // We expect a provider here since everything
        // should be resolved
        if (!provider) {
          throw new YError('E_UNEXPECTED_PROVIDER_STATE', [
            serviceName,
            parentsNames,
          ]);
        }

        if (!optional && provider === NO_PROVIDER) {
          throw new YError(
            'E_UNMATCHED_DEPENDENCY',
            parentsNames.concat(serviceName) as [ServiceName],
          );
        }

        if (provider === NO_PROVIDER) {
          debug(
            `${[...parentsNames, serviceName].join(
              '->',
            )}: Optional dependency not found.`,
          );
        }

        finalHash[serviceName] = (provider as Provider<unknown>).service;
        return finalHash;
      },
      {} as Record<string, Service>,
    );
  }

  async _loadProvider(
    siloContext: SiloContext,
    serviceName: ServiceName,
    parentsNames: ServiceName[],
  ): Promise<void> {
    debug(
      `${[...parentsNames, serviceName].join('->')}: Loading the provider...`,
    );

    if (parentsNames.includes(serviceName)) {
      // At that point there should be an initializer property
      throw new YError(
        'E_CIRCULAR_DEPENDENCY',
        parentsNames.concat(serviceName) as [ServiceName],
      );
    }

    const initializerState = this._initializersStates[serviceName];

    if (!('initializer' in initializerState) || !initializerState.initializer) {
      // At that point there should be an initializer property
      throw new YError('E_UNEXPECTED_INITIALIZER_STATE', [serviceName]);
    }

    const services = await this._loadInitializerDependencies(
      siloContext,
      [...parentsNames, serviceName],
      '$inject' in initializerState.initializer &&
        initializerState.initializer.$inject
        ? initializerState.initializer.$inject
        : [],
      [],
    );

    let providerPromise: Promise<Provider<unknown>>;

    if (initializerState.initializer.$type === 'service') {
      const servicePromise = (
        initializerState.initializer as ServiceInitializer<
          Dependencies,
          Service
        >
      )(services);

      if (!servicePromise || !servicePromise.then) {
        debug('Service initializer did not return a promise:', serviceName);
        throw new YError('E_BAD_SERVICE_PROMISE', [serviceName]);
      }

      providerPromise = servicePromise.then((service) => ({ service }));
    } else if (initializerState.initializer.$type === 'provider') {
      providerPromise = (
        initializerState.initializer as ProviderInitializer<
          Dependencies,
          Service
        >
      )(services);

      if (!providerPromise || !providerPromise.then) {
        debug('Provider initializer did not return a promise:', serviceName);
        throw new YError('E_BAD_SERVICE_PROVIDER', [serviceName]);
      }
    } else {
      providerPromise = Promise.reject(
        new YError('E_UNEXPECTED_STATE', [
          serviceName,
          initializerState.initializer,
        ]),
      );
    }

    if (initializerState.initializer.$singleton) {
      (
        initializerState as SingletonInitializerStateDescriptor<any, any>
      ).singletonProviderLoadPromise =
        providerPromise as unknown as Promise<void>;
    } else {
      (
        initializerState as SiloedInitializerStateDescriptor<any, any>
      ).silosInstances[siloContext.index] = {
        providerLoadPromise: providerPromise as unknown as Promise<void>,
      };
    }

    const provider = await providerPromise;

    if (
      !provider ||
      !(typeof provider === 'object') ||
      !('service' in provider)
    ) {
      debug('Provider has no `service` property:', serviceName);
      throw new YError('E_BAD_SERVICE_PROVIDER', [serviceName]);
    }

    if (provider.fatalErrorPromise) {
      const fatalErrorInitializerState = (await this._initializersStates[
        '$fatalError'
      ]) as SingletonInitializerStateDescriptor<any, any>;

      await fatalErrorInitializerState.singletonProviderLoadPromise;

      const fatalError = (
        fatalErrorInitializerState.singletonProvider as Provider<FatalErrorService>
      ).service;

      debug('Registering service descriptor error promise:', serviceName);
      fatalError.registerErrorPromise(provider.fatalErrorPromise);
    }

    if (initializerState.initializer.$singleton) {
      (
        initializerState as SingletonInitializerStateDescriptor<any, any>
      ).singletonProvider = provider;
    } else {
      (
        initializerState as SiloedInitializerStateDescriptor<any, any>
      ).silosInstances[siloContext.index] = { provider };
    }
  }

  async _getAutoloader(
    siloContext: SiloContext,
    parentsNames: ServiceName[],
  ): Promise<
    Autoloader<Initializer<unknown, Dependencies<unknown>>> | undefined
  > {
    // The auto loader must only have static dependencies
    // and we have to do this check here to avoid infinite loop
    if (parentsNames.includes('$autoload')) {
      debug(
        `${parentsNames.join(
          '->',
        )}: Won't try to autoload autoloader dependencies...`,
      );
      return;
    }

    const autoloaderState: SingletonInitializerStateDescriptor<any, any> =
      this._initializersStates['$autoload'];

    if (!autoloaderState) {
      return;
    }

    if (!('singletonProviderLoadPromise' in autoloaderState)) {
      debug(`${parentsNames.join('->')}: Instantiating the autoloader...`);

      // Trick to ensure the singletonProviderLoadPromise is set
      let resolveAutoloder: (value: void | PromiseLike<void>) => void;

      autoloaderState.singletonProviderLoadPromise = new Promise((_resolve) => {
        resolveAutoloder = _resolve;
      });

      // @ts-expect-error The promise initializer is
      // immediately executed so will never be undefined
      resolveAutoloder(
        await this._loadProvider(siloContext, '$autoload', parentsNames),
      );
    }
    await autoloaderState.singletonProviderLoadPromise;

    const autoloader = (await this._getServiceProvider(
      siloContext,
      '$autoload',
    )) as Provider<Autoloader<any>>;

    debug(`${parentsNames.join('->')}: Loaded the autoloader...`);

    if (!autoloader) {
      throw new YError('E_UNEXPECTED_AUTO_LOADER');
    }
    return autoloader.service;
  }

  async _loadInitializer(
    siloContext: SiloContext,
    serviceName: ServiceName,
    parentsNames: ServiceName[],
  ): Promise<void> {
    const initializerState = this._initializersStates[serviceName];

    debug(
      `${[...parentsNames, serviceName].join('->')}: Loading an initializer...`,
    );

    // At that point there should be an initializer state
    if (!initializerState) {
      throw new YError('E_UNEXPECTED_INITIALIZER_STATE', [serviceName]);
    }

    // When no initializer try to autoload it
    if (!('initializer' in initializerState)) {
      debug(
        `${[...parentsNames, serviceName].join(
          '->',
        )}: No registered initializer...`,
      );

      if (initializerState.initializerLoadPromise) {
        debug(
          `${[...parentsNames, serviceName].join(
            '->',
          )}: Wait for pending initializer registration...`,
        );
        await initializerState.initializerLoadPromise;
      } else {
        debug(
          `${[...parentsNames, serviceName].join(
            '->',
          )}: Try to autoload the initializer...`,
        );

        initializerState.autoloaded = true;

        // Trick to ensure the singletonProviderLoadPromise is set
        let resolveInitializer: (
            value: Initializer<Service, Dependencies>,
          ) => void,
          rejectInitializer: (reason?: any) => void;

        initializerState.initializerLoadPromise = new Promise<
          Initializer<Service, Dependencies>
        >((_resolve, _reject) => {
          resolveInitializer = _resolve;
          rejectInitializer = _reject;
        });

        try {
          const autoloader = await this._getAutoloader(siloContext, [
            ...parentsNames,
            serviceName,
          ]);

          if (!autoloader) {
            debug(
              `${parentsNames.join(
                '->',
              )}: No autoloader found, leaving initializer undefined...`,
            );
            initializerState.initializer = undefined;
            // @ts-expect-error The promise initializer is
            // immediately executed so will never be undefined
            resolveInitializer(undefined);
            return;
          }

          const initializer = await autoloader(serviceName);

          if (!['object', 'function'].includes(typeof initializer)) {
            throw new YError('E_BAD_AUTO_LOADER_RESULT', [
              serviceName,
              initializer,
            ]);
          }

          debug(
            `${[...parentsNames, serviceName].join(
              '->',
            )}: Loaded the initializer in location ${
              initializer[SPECIAL_PROPS.LOCATION]?.url || 'no_location'
            }...`,
          );

          if (initializer.$name !== serviceName) {
            throw new YError('E_AUTO_LOADED_INITIALIZER_MISMATCH', [
              serviceName,
              initializer.$name,
            ]);
          }

          initializerState.dependents.push({
            silo: siloContext.index,
            name: '$autoload',
            optional: false,
          });
          initializerState.initializer = initializer;

          this._buildInitializerState(initializerState, initializer);

          // @ts-expect-error The promise initializer is
          // immediately executed so will never be undefined
          resolveInitializer(initializer);
          return;
        } catch (err) {
          if ((err as YError).code === 'E_AUTO_LOADER_DEPENDS_ON_AUTO_LOAD') {
            initializerState.initializer = undefined;
            // @ts-expect-error The promise initializer is
            // immediately executed so will never be undefined
            rejectInitializer(err);
            await initializerState.initializerLoadPromise;
            return;
          }
          if (!['E_UNMATCHED_DEPENDENCY'].includes((err as YError).code)) {
            initializerState.initializer = undefined;
            // @ts-expect-error The promise initializer is
            // immediately executed so will never be undefined
            rejectInitializer(
              YError.wrap(err as Error, 'E_BAD_AUTO_LOADED_INITIALIZER', [
                serviceName,
              ]),
            );
            await initializerState.initializerLoadPromise;
            return;
          }

          debug(
            `${[...parentsNames, serviceName].join(
              '->',
            )}: Could not autoload the initializer...`,
            printStackTrace(err as Error),
          );
          initializerState.initializer = undefined;
          // @ts-expect-error The promise initializer is
          // immediately executed so will never be undefined
          resolveInitializer(undefined);
          await initializerState.initializerLoadPromise;
        }
        return;
      }
    } else {
      if (initializerState.initializer) {
        debug(
          `${[...parentsNames, serviceName].join('->')}: Initializer ready...`,
        );

        if (initializerState.initializer.$type === 'constant') {
          const provider = { service: initializerState.initializer.$value };
          (
            initializerState as SingletonInitializerStateDescriptor<any, any>
          ).singletonProvider = provider;
          (
            initializerState as SingletonInitializerStateDescriptor<any, any>
          ).singletonProviderLoadPromise = Promise.resolve();
        }
        if (initializerState.initializer.$singleton) {
          const singletonInitializerState =
            initializerState as SingletonInitializerStateDescriptor<any, any>;

          if (!('singletonProviderLoadPromise' in singletonInitializerState)) {
            singletonInitializerState.singletonProviderLoadPromise =
              this._loadProvider(siloContext, serviceName, parentsNames);
          }
          await singletonInitializerState.singletonProviderLoadPromise;
        } else {
          const siloedInitializerState =
            initializerState as SiloedInitializerStateDescriptor<any, any>;

          if (!siloedInitializerState.silosInstances[siloContext.index]) {
            siloedInitializerState.silosInstances[siloContext.index] = {
              providerLoadPromise: this._loadProvider(
                siloContext,
                serviceName,
                parentsNames,
              ),
            };
          }
          await siloedInitializerState.silosInstances[siloContext.index]
            .providerLoadPromise;
        }
      } else {
        debug(
          `${[...parentsNames, serviceName].join(
            '->',
          )}: Could not find the initializer...`,
        );
        initializerState.initializer = undefined;
        (
          initializerState as SingletonInitializerStateDescriptor<any, any>
        ).singletonProvider = NO_PROVIDER;
      }
    }
  }

  async _resolveDependencies(
    siloContext: SiloContext,
    loadingServices: ServiceName[],
    parentsNames: ServiceName[],
  ): Promise<void> {
    debug(
      `Initiating a dependencies load round for silo "${siloContext.index}"'.`,
    );

    if (this._options.sequential) {
      for (const loadingService of loadingServices) {
        await this._loadInitializer(siloContext, loadingService, parentsNames);
      }
    } else {
      await Promise.all(
        loadingServices.map((loadingService) =>
          this._loadInitializer(siloContext, loadingService, parentsNames),
        ),
      );
    }
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
    this._shutdownPromise =
      this._shutdownPromise ||
      Promise.all(
        Object.keys(this._silosContexts).map(async (siloIndex) => {
          const siloContext = this._silosContexts[siloIndex];
          const $dispose = (
            (await this._getServiceProvider(
              siloContext,
              '$dispose',
            )) as Provider<Disposer>
          )?.service;

          return $dispose();
        }),
      ).then(() => undefined);

    debug('Shutting down Knifecycle instance.');

    return this._shutdownPromise;
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
