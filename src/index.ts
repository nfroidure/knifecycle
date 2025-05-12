/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint max-len: ["warn", { "ignoreComments": true }] @typescript-eslint/no-this-alias: "warn" */
import {
  NO_PROVIDER,
  INSTANCE,
  SILO_CONTEXT,
  READY,
  AUTOLOAD,
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
  unInject,
  type,
  extra,
  singleton,
  initializer,
  constant,
  service,
  autoService,
  provider,
  autoProvider,
  location,
  wrapInitializer,
  parseDependencyDeclaration,
  stringifyDependencyDeclaration,
  unwrapInitializerProperties,
} from './util.js';
import initFatalError, { FATAL_ERROR } from './fatalError.js';
import initDispose, { DISPOSE } from './dispose.js';
import { type Overrides, OVERRIDES, pickOverridenName } from './overrides.js';
import initInitializerBuilder from './build.js';
import { YError, printStackTrace } from 'yerror';
import initDebug from 'debug';
import type {
  ServiceName,
  Service,
  Disposer,
  FatalErrorPromise,
  Provider,
  Dependencies,
  DependencyDeclaration,
  LocationInformation,
  ExtraInformation,
  ParsedDependencyDeclaration,
  ConstantProperties,
  ConstantInitializer,
  ProviderInitializerBuilder,
  ProviderProperties,
  ProviderInitializer,
  ServiceInitializerBuilder,
  ServiceProperties,
  ServiceInitializer,
  AsyncInitializerBuilder,
  AsyncInitializer,
  PartialAsyncInitializer,
  Initializer,
  ServiceInitializerWrapper,
  ProviderInitializerWrapper,
} from './util.js';
import type { BuildInitializer } from './build.js';
import type { FatalErrorService } from './fatalError.js';
import { Injector, INJECTOR } from './injector.js';

export type {
  ServiceName,
  Service,
  Disposer,
  FatalErrorPromise,
  Provider,
  Dependencies,
  DependencyDeclaration,
  LocationInformation,
  ExtraInformation,
  ParsedDependencyDeclaration,
  ConstantProperties,
  ConstantInitializer,
  ProviderInitializerBuilder,
  ProviderProperties,
  ProviderInitializer,
  ServiceInitializerBuilder,
  ServiceProperties,
  ServiceInitializer,
  AsyncInitializerBuilder,
  AsyncInitializer,
  PartialAsyncInitializer,
  Initializer,
  ServiceInitializerWrapper,
  ProviderInitializerWrapper,
  BuildInitializer,
  FatalErrorService,
  Injector,
  Overrides,
};

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
  unInject,
  extra,
  singleton,
  reuseSpecialProps,
  wrapInitializer,
  constant,
  service,
  autoService,
  provider,
  autoProvider,
  location,
  parseDependencyDeclaration,
  stringifyDependencyDeclaration,
  unwrapInitializerProperties,
  initInitializerBuilder,
  initFatalError,
  initDispose,
};

export const RUN_DEPENDENT_NAME = '__run__';
export const SYSTEM_DEPENDENT_NAME = '__system__';
export const AUTOLOAD_DEPENDENT_NAME = '__autoloader__';
export const INJECTOR_DEPENDENT_NAME = '__injector__';
export { NO_PROVIDER, INJECTOR };

export type KnifecycleOptions = {
  sequential?: boolean;
};
export interface Autoloader<
  T extends Initializer<unknown, Record<string, unknown>>,
> {
  (name: DependencyDeclaration): Promise<T>;
}
export type SiloIndex = string;
export type BaseInitializerStateDescriptor<S, D extends Dependencies> = {
  dependents: {
    silo?: SiloIndex;
    name: ServiceName;
    optional: boolean;
  }[];
  initializerLoadPromise?: Promise<Initializer<S, D>>;
  initializer?: Initializer<S, D>;
  autoloaded: boolean;
};
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

export type InternalDependencies = {
  $dispose: Disposer;
  $autoload: Autoloader<Initializer<unknown, Record<string, unknown>>>;
  $injector: Injector<Record<string, unknown>>;
  $instance: Knifecycle;
  $siloContext: SiloContext;
  $fatalError: FatalErrorService;
};

const debug = initDebug('knifecycle');

export {
  DISPOSE,
  FATAL_ERROR,
  INSTANCE,
  SILO_CONTEXT,
  READY,
  AUTOLOAD,
  OVERRIDES,
};
export const UNBUILDABLE_SERVICES = [
  AUTOLOAD,
  INJECTOR,
  INSTANCE,
  SILO_CONTEXT,
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
class Knifecycle {
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
   * Allows to load dependencies sequentially (usefull for debugging)
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
      [FATAL_ERROR]: {
        initializer: initFatalError,
        autoloaded: false,
        dependents: [],
      },
      [SILO_CONTEXT]: {
        initializer: service(async () => {
          throw new YError('E_UNEXPECTED_INIT', SILO_CONTEXT);
        }, SILO_CONTEXT),
        autoloaded: false,
        dependents: [],
        silosInstances: {},
      },
      [READY]: {
        initializer: service(async () => {
          throw new YError('E_UNEXPECTED_INIT', READY);
        }, READY),
        autoloaded: false,
        dependents: [],
        silosInstances: {},
      },
      [DISPOSE]: {
        initializer: initDispose as any,
        autoloaded: false,
        dependents: [],
        silosInstances: {},
      },
    };
    this.register(constant(INSTANCE, this));
    this.register(constant(OVERRIDES, {}));

    const initInjectorProvider = provider(
      async ({
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
      }),
      INJECTOR,
      [SILO_CONTEXT, INSTANCE],
      // Despite its global definition, the injector
      // depends on the silo context and then needs
      // to be instanciated once per silo.
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
   be objects, functions or litteral values.
  - providers: they instead resolve to an object that
   contains the service built into the `service` property
   but also an optional `dispose` property exposing a
   method to properly stop the service and a
   `fatalErrorPromise` that will be rejected if an
   unrecoverable error happens allowing Knifecycle
   to terminate.

   Initializers can be declared as singletons (constants are
    of course only singletons). This means that they will be
    instanciated once for all for each executions silos using
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
      [INSTANCE, INJECTOR, SILO_CONTEXT, DISPOSE].includes(
        initializer[SPECIAL_PROPS.NAME],
      )
    ) {
      throw new YError(
        'E_IMMUTABLE_SERVICE_NAME',
        initializer[SPECIAL_PROPS.NAME],
      );
    }
    if (
      initializer[SPECIAL_PROPS.NAME] === OVERRIDES &&
      initializer[SPECIAL_PROPS.TYPE] !== 'constant'
    ) {
      throw new YError(
        'E_CONSTANT_SERVICE_NAME',
        initializer[SPECIAL_PROPS.NAME],
        initializer[SPECIAL_PROPS.TYPE],
      );
    }

    const initializerState: InitializerStateDescriptor<any, any> = {
      initializer,
      autoloaded: false,
      dependents: [],
    };

    this._checkInitializerOverride(initializer[SPECIAL_PROPS.NAME]);

    this._buildInitializerState(initializerState, initializer);

    this._initializersStates[initializer[SPECIAL_PROPS.NAME]] =
      initializerState;

    debug(`Registered an initializer: ${initializer[SPECIAL_PROPS.NAME]}`);
    return this;
  }

  _checkInitializerOverride(serviceName: ServiceName) {
    if (this._initializersStates[serviceName]) {
      if ('initializer' in this._initializersStates[serviceName]) {
        if (this._initializersStates[serviceName]?.dependents?.length) {
          debug(
            `Override attempt of an already used initializer: ${serviceName}`,
          );
          throw new YError('E_INITIALIZER_ALREADY_INSTANCIATED', serviceName);
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

    if (initializer[SPECIAL_PROPS.TYPE] === 'constant') {
      const provider = {
        service: initializer[SPECIAL_PROPS.VALUE],
      };
      (
        initializerState as SingletonInitializerStateDescriptor<any, any>
      ).singletonProvider = provider;
      (
        initializerState as SingletonInitializerStateDescriptor<any, any>
      ).singletonProviderLoadPromise = Promise.resolve();
    } else {
      this._checkInitializerDependencies(initializer);
      if (!initializer[SPECIAL_PROPS.SINGLETON]) {
        (
          initializerState as SiloedInitializerStateDescriptor<any, any>
        ).silosInstances = {};
      }
    }
  }

  _checkInitializerDependencies(initializer: Initializer<any, any>) {
    // Here, we do not have to take in count the overrides since it
    // won't impact the checking
    const initializerDependsOfItself = initializer[SPECIAL_PROPS.INJECT]
      .map((dependencyDeclaration) => {
        const { serviceName } = parseDependencyDeclaration(
          dependencyDeclaration,
        );

        if (
          // TEMPFIX: let's build
          initializer[SPECIAL_PROPS.NAME] !== 'BUILD_CONSTANTS' &&
          // TEMPFIX: Those services are special...
          ![INJECTOR, SILO_CONTEXT].includes(serviceName) &&
          initializer[SPECIAL_PROPS.SINGLETON] &&
          this._initializersStates[serviceName] &&
          'initializer' in this._initializersStates[serviceName] &&
          this._initializersStates[serviceName]?.initializer &&
          !this._initializersStates[serviceName]?.initializer?.[
            SPECIAL_PROPS.SINGLETON
          ]
        ) {
          debug(
            `Found an inconsistent singleton initializer dependency: ${
              initializer[SPECIAL_PROPS.NAME]
            }`,
            serviceName,
            initializer,
          );
          throw new YError(
            'E_BAD_SINGLETON_DEPENDENCIES',
            initializer[SPECIAL_PROPS.NAME],
            serviceName,
          );
        }

        return serviceName;
      })
      .includes(initializer[SPECIAL_PROPS.NAME]);

    if (
      // TEMPFIX: let's build
      initializer[SPECIAL_PROPS.NAME] !== 'BUILD_CONSTANTS' &&
      !initializer[SPECIAL_PROPS.SINGLETON]
    ) {
      Object.keys(this._initializersStates)
        .filter(
          (serviceName) =>
            ![
              // TEMPFIX: Those services are special...
              INJECTOR,
              SILO_CONTEXT,
            ].includes(serviceName),
        )
        .forEach((serviceName) => {
          if (
            this._initializersStates[serviceName]?.initializer &&
            this._initializersStates[serviceName]?.initializer?.[
              SPECIAL_PROPS.SINGLETON
            ] &&
            (
              this._initializersStates[serviceName]?.initializer?.[
                SPECIAL_PROPS.INJECT
              ] || []
            )
              .map(
                (declaration) =>
                  parseDependencyDeclaration(declaration).serviceName,
              )
              .includes(initializer[SPECIAL_PROPS.NAME])
          ) {
            debug(
              `Found an inconsistent dependent initializer: ${
                initializer[SPECIAL_PROPS.NAME]
              }`,
              serviceName,
              initializer,
            );
            throw new YError(
              'E_BAD_SINGLETON_DEPENDENCIES',
              serviceName,
              initializer[SPECIAL_PROPS.NAME],
            );
          }
        });
    }
    if (initializerDependsOfItself) {
      throw new YError(
        'E_CIRCULAR_DEPENDENCY',
        initializer[SPECIAL_PROPS.NAME],
      );
    }

    initializer[SPECIAL_PROPS.INJECT].forEach((dependencyDeclaration) => {
      this._lookupCircularDependencies(
        initializer[SPECIAL_PROPS.NAME],
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
    (initializersState.initializer[SPECIAL_PROPS.INJECT] || []).forEach(
      (childDependencyDeclaration) => {
        const childServiceName = parseDependencyDeclaration(
          childDependencyDeclaration,
        ).serviceName;

        if (rootServiceName === childServiceName) {
          throw new YError(
            'E_CIRCULAR_DEPENDENCY',
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
    const initializersStates = this._initializersStates;
    const links: MermaidLink[] = Object.keys(initializersStates)
      .filter((provider) => !provider.startsWith('$'))
      .reduce((links, serviceName) => {
        const initializerState = initializersStates[serviceName];

        if (
          !initializerState ||
          !initializerState.initializer ||
          !initializerState.initializer[SPECIAL_PROPS.INJECT]?.length
        ) {
          return links;
        }
        return links.concat(
          initializerState.initializer[SPECIAL_PROPS.INJECT].map(
            (dependencyDeclaration) => {
              const dependedServiceName = parseDependencyDeclaration(
                dependencyDeclaration,
              ).serviceName;

              return { serviceName, dependedServiceName };
            },
          ),
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
    const siloIndex: SiloIndex = `silo-${this._silosCounter++}`;
    const siloContext: SiloContext = {
      index: siloIndex,
      loadingServices: [],
      loadingSequences: [],
    };

    let resolveReady;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    if (this._shutdownPromise) {
      throw new YError('E_INSTANCE_DESTROYED');
    }

    // Make the siloContext available for internal injections
    (
      this._initializersStates[
        SILO_CONTEXT
      ] as SiloedInitializerStateDescriptor<SiloContext, Dependencies<unknown>>
    ).silosInstances[siloIndex] = {
      provider: { service: siloContext },
    };

    // Make the ready service available for internal injections
    (
      this._initializersStates[READY] as SiloedInitializerStateDescriptor<
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
      [DISPOSE, FATAL_ERROR],
    );

    debug('All dependencies now loaded:', siloContext.loadingSequences);

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
      this._initializersStates[OVERRIDES].initializer as ConstantInitializer<
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
          throw new YError(
            'E_UNEXPECTED_PROVIDER_STATE',
            serviceName,
            parentsNames,
          );
        }

        if (!optional && provider === NO_PROVIDER) {
          throw new YError(
            'E_UNMATCHED_DEPENDENCY',
            ...parentsNames,
            serviceName,
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
      {},
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
      // At that point there should be an initialiser property
      throw new YError('E_CIRCULAR_DEPENDENCY', ...parentsNames, serviceName);
    }

    const initializerState = this._initializersStates[serviceName];

    if (!('initializer' in initializerState) || !initializerState.initializer) {
      // At that point there should be an initialiser property
      throw new YError('E_UNEXPECTED_INITIALIZER_STATE', serviceName);
    }

    const services = await this._loadInitializerDependencies(
      siloContext,
      [...parentsNames, serviceName],
      initializerState.initializer[SPECIAL_PROPS.INJECT],
      [],
    );

    let providerPromise: Promise<Provider<unknown>>;

    if (initializerState.initializer[SPECIAL_PROPS.TYPE] === 'service') {
      const servicePromise = (
        initializerState.initializer as ServiceInitializer<
          Dependencies,
          Service
        >
      )(services);

      if (!servicePromise || !servicePromise.then) {
        debug('Service initializer did not return a promise:', serviceName);
        throw new YError('E_BAD_SERVICE_PROMISE', serviceName);
      }

      providerPromise = servicePromise.then((service) => ({ service }));
    } else if (
      initializerState.initializer[SPECIAL_PROPS.TYPE] === 'provider'
    ) {
      providerPromise = (
        initializerState.initializer as ProviderInitializer<
          Dependencies,
          Service
        >
      )(services);

      if (!providerPromise || !providerPromise.then) {
        debug('Provider initializer did not return a promise:', serviceName);
        throw new YError('E_BAD_SERVICE_PROVIDER', serviceName);
      }
    } else {
      providerPromise = Promise.reject(
        new YError('E_UNEXPECTED_STATE', serviceName, initializer),
      );
    }

    if (initializerState.initializer[SPECIAL_PROPS.SINGLETON]) {
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
      throw new YError('E_BAD_SERVICE_PROVIDER', serviceName);
    }

    if (provider.fatalErrorPromise) {
      const fatalErrorInitializerState = (await this._initializersStates[
        FATAL_ERROR
      ]) as SingletonInitializerStateDescriptor<any, any>;

      await fatalErrorInitializerState.singletonProviderLoadPromise;

      const fatalError = (
        fatalErrorInitializerState.singletonProvider as Provider<FatalErrorService>
      ).service;

      debug('Registering service descriptor error promise:', serviceName);
      fatalError.registerErrorPromise(provider.fatalErrorPromise);
    }

    if (initializerState.initializer[SPECIAL_PROPS.SINGLETON]) {
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
    if (parentsNames.includes(AUTOLOAD)) {
      debug(
        `${parentsNames.join(
          '->',
        )}: Won't try to autoload autoloader dependencies...`,
      );
      return;
    }

    const autoloaderState: SingletonInitializerStateDescriptor<any, any> =
      this._initializersStates[AUTOLOAD];

    if (!autoloaderState) {
      return;
    }

    if (!('singletonProviderLoadPromise' in autoloaderState)) {
      debug(`${parentsNames.join('->')}: Instanciating the autoloader...`);

      // Trick to ensure the singletonProviderLoadPromise is set
      let resolveAutoloder;

      autoloaderState.singletonProviderLoadPromise = new Promise((_resolve) => {
        resolveAutoloder = _resolve;
      });

      resolveAutoloder(
        await this._loadProvider(siloContext, AUTOLOAD, parentsNames),
      );
    }
    await autoloaderState.singletonProviderLoadPromise;

    const autoloader = (await this._getServiceProvider(
      siloContext,
      AUTOLOAD,
    )) as Provider<Autoloader<any>>;

    debug(`${parentsNames.join('->')}: Loaded the autoloader...`);

    if (!autoloader) {
      throw new YError('E_UNEXPECTED_AUTOLOADER');
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

    // At that point there should be an initialiser state
    if (!initializerState) {
      throw new YError('E_UNEXPECTED_INITIALIZER_STATE', serviceName);
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
        let resolveInitializer, rejectInitializer;

        initializerState.initializerLoadPromise = new Promise(
          (_resolve, _reject) => {
            resolveInitializer = _resolve;
            rejectInitializer = _reject;
          },
        );

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
            resolveInitializer(undefined);
            return;
          }

          const initializer = await autoloader(serviceName);

          if (!['object', 'function'].includes(typeof initializer)) {
            throw new YError(
              'E_BAD_AUTOLOADER_RESULT',
              serviceName,
              initializer,
            );
          }

          debug(
            `${[...parentsNames, serviceName].join(
              '->',
            )}: Loaded the initializer in location ${
              initializer[SPECIAL_PROPS.LOCATION]?.url || 'no_location'
            }...`,
          );

          if (initializer[SPECIAL_PROPS.NAME] !== serviceName) {
            throw new YError(
              'E_AUTOLOADED_INITIALIZER_MISMATCH',
              serviceName,
              initializer[SPECIAL_PROPS.NAME],
            );
          }

          initializerState.dependents.push({
            silo: siloContext.index,
            name: AUTOLOAD,
            optional: false,
          });
          initializerState.initializer = initializer;

          this._buildInitializerState(initializerState, initializer);

          resolveInitializer(initializer);
          return;
        } catch (err) {
          if ((err as YError).code === 'E_AULOADER_DEPENDS_ON_AUTOLOAD') {
            initializerState.initializer = undefined;
            rejectInitializer(err);
            await initializerState.initializerLoadPromise;
            return;
          }
          if (!['E_UNMATCHED_DEPENDENCY'].includes((err as YError).code)) {
            initializerState.initializer = undefined;
            rejectInitializer(
              YError.wrap(
                err as Error,
                'E_BAD_AUTOLOADED_INITIALIZER',
                serviceName,
              ),
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

        if (initializer[SPECIAL_PROPS.TYPE] === 'constant') {
          const provider = initializerState.initializer[SPECIAL_PROPS.VALUE];
          (
            initializerState as SingletonInitializerStateDescriptor<any, any>
          ).singletonProvider = provider;
          (
            initializerState as SingletonInitializerStateDescriptor<any, any>
          ).singletonProviderLoadPromise = Promise.resolve(provider);
        }
        if (initializerState.initializer[SPECIAL_PROPS.SINGLETON]) {
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
              DISPOSE,
            )) as Provider<Disposer>
          )?.service;

          return $dispose();
        }),
      ).then(() => undefined);

    debug('Shutting down Knifecycle instance.');

    return this._shutdownPromise;
  }
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
        throw new YError('E_BAD_CLASS', style.className, serviceName);
      }
      classesApplications[serviceName] = style.className;
    }
    if (
      style.pattern.test(dependedServiceName) &&
      !classesApplications[dependedServiceName]
    ) {
      if (!classes[style.className]) {
        throw new YError('E_BAD_CLASS', style.className, dependedServiceName);
      }
      classesApplications[dependedServiceName] = style.className;
    }
    return classesApplications;
  }, {});
}
