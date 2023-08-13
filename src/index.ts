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

export const RUN_DEPENDENT_NAME = '__run__';
export const SYSTEM_DEPENDENT_NAME = '__system__';
export const AUTOLOAD_DEPENDENT_NAME = '__autoloader__';
export const INJECTOR_DEPENDENT_NAME = '__injector__';

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
      instance?: S;
      instanceLoadPromise?: Promise<S>;
      instanceDisposePromise?: Promise<S>;
      disposer?: Disposer;
      fatalErrorPromise?: FatalErrorPromise;
    }
  >;
};
export type SingletonInitializerStateDescriptor<
  S,
  D extends Dependencies,
> = BaseInitializerStateDescriptor<S, D> & {
  singletonInstance?: S;
  instanceLoadPromise?: Promise<S>;
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
  errorsPromises: Promise<void>[];
  _shutdownPromise?: Promise<void>;
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
  $siloContext: SiloContext;
  $fatalError: FatalErrorService;
};

const debug = initDebug('knifecycle');

const DISPOSE = '$dispose';
const AUTOLOAD = '$autoload';
const INJECTOR = '$injector';
const INSTANCE = '$instance';
const SILO_CONTEXT = '$siloContext';
const FATAL_ERROR = '$fatalError';

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
  private _silosCounter: number;
  private _silosContexts: Record<SiloIndex, SiloContext>;
  private _initializersStates: Record<
    string,
    InitializerStateDescriptor<unknown, Dependencies>
  >;
  private _shutdownPromise?: Promise<void>;

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
    this._silosContexts = {};
    this._initializersStates = {
      [FATAL_ERROR]: {
        initializer: service(async () => {
          throw new YError('E_UNEXPECTED_INIT', FATAL_ERROR);
        }, FATAL_ERROR),
        autoloaded: false,
        dependents: [],
        silosInstances: {},
      },
      [SILO_CONTEXT]: {
        initializer: service(async () => {
          throw new YError('E_UNEXPECTED_INIT', SILO_CONTEXT);
        }, SILO_CONTEXT),
        autoloaded: false,
        dependents: [],
        silosInstances: {},
      },
      [DISPOSE]: {
        initializer: service(async () => {
          throw new YError('E_UNEXPECTED_INIT', DISPOSE);
        }, DISPOSE),
        autoloaded: false,
        dependents: [],
        silosInstances: {},
      },
    };
    this.register(constant(INSTANCE, this));

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

    unwrapInitializerProperties(initializer);

    this._checkInitializerOverride(initializer[SPECIAL_PROPS.NAME]);

    if (initializer[SPECIAL_PROPS.TYPE] === 'constant') {
      this._initializersStates[initializer[SPECIAL_PROPS.NAME]] = {
        initializer,
        singletonInstance: initializer[SPECIAL_PROPS.VALUE],
        instanceLoadPromise: Promise.resolve(initializer[SPECIAL_PROPS.VALUE]),
        autoloaded: false,
        dependents: [],
      };
    } else {
      this._checkInitializerDependencies(initializer);
      this._initializersStates[initializer[SPECIAL_PROPS.NAME]] = initializer[
        SPECIAL_PROPS.SINGLETON
      ]
        ? {
            initializer,
            autoloaded: false,
            dependents: [],
          }
        : {
            initializer,
            autoloaded: false,
            silosInstances: {},
            dependents: [],
          };
    }

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

  _checkInitializerDependencies(initializer: Initializer<any, any>) {
    const initializerDependsOfItself = initializer[SPECIAL_PROPS.INJECT]
      .map((dependencyDeclaration) => {
        const serviceName = _pickServiceNameFromDeclaration(
          dependencyDeclaration,
        );

        if (
          // TEMPFIX: Fatal Errors are global
          ![FATAL_ERROR, INJECTOR, SILO_CONTEXT].includes(serviceName) &&
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

    if (!initializer[SPECIAL_PROPS.SINGLETON]) {
      Object.keys(this._initializersStates)
        // TEMPFIX: Fatal Errors are global
        .filter(
          (serviceName) =>
            ![FATAL_ERROR, INJECTOR, SILO_CONTEXT].includes(serviceName),
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
              .map(_pickServiceNameFromDeclaration)
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
    const serviceName = _pickServiceNameFromDeclaration(dependencyDeclaration);
    const initializersState = this._initializersStates[serviceName];

    if (!initializersState || !initializersState.initializer) {
      return;
    }

    declarationsStacks = declarationsStacks.concat(dependencyDeclaration);
    (initializersState.initializer[SPECIAL_PROPS.INJECT] || []).forEach(
      (childDependencyDeclaration) => {
        const childServiceName = _pickServiceNameFromDeclaration(
          childDependencyDeclaration,
        );

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
              const dependedServiceName = _pickServiceNameFromDeclaration(
                dependencyDeclaration,
              );

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
  async run(
    dependenciesDeclarations: DependencyDeclaration[],
  ): Promise<Dependencies> {
    // const _this = this;
    const siloIndex: SiloIndex = `silo-${this._silosCounter++}`;
    const siloContext: SiloContext = {
      index: siloIndex,
      loadingServices: [],
      loadingSequences: [],
      errorsPromises: [],
    };

    if (this._shutdownPromise) {
      throw new YError('E_INSTANCE_DESTROYED');
    }

    // Create a provider for the special fatal error service
    (
      this._initializersStates[FATAL_ERROR] as SiloedInitializerStateDescriptor<
        FatalErrorService,
        Dependencies<unknown>
      >
    ).silosInstances[siloIndex] = {
      instance: {
        promise: new Promise<void>((_resolve, reject) => {
          siloContext.throwFatalError = (err) => {
            debug('Handled a fatal error', err);
            reject(err);
          };
        }),
      },
    };

    // Make the siloContext available for internal injections
    (
      this._initializersStates[
        SILO_CONTEXT
      ] as SiloedInitializerStateDescriptor<SiloContext, Dependencies<unknown>>
    ).silosInstances[siloIndex] = {
      instance: siloContext,
    };
    // Create a provider for the shutdown special dependency
    (
      this._initializersStates[DISPOSE] as SiloedInitializerStateDescriptor<
        Disposer,
        Dependencies<unknown>
      >
    ).silosInstances[siloIndex] = {
      instance: async () => {
        const _this = this;
        siloContext._shutdownPromise =
          siloContext._shutdownPromise ||
          _shutdownNextServices(siloContext.loadingSequences.concat());
        await siloContext._shutdownPromise;
        delete this._silosContexts[siloContext.index];

        // Shutdown services in their instanciation order
        async function _shutdownNextServices(
          serviceLoadSequences: ServiceName[][],
        ) {
          if (0 === serviceLoadSequences.length) {
            return;
          }
          const currentServiceLoadSequence = serviceLoadSequences.pop() || [];

          // First ensure to remove services that are depend on
          // by another service loaded in the same batch (may
          // happen depending on the load sequence)
          const dependendedByAServiceInTheSameBatch =
            currentServiceLoadSequence.filter((serviceName) => {
              if (
                currentServiceLoadSequence
                  .filter(
                    (anotherServiceName) => anotherServiceName !== serviceName,
                  )
                  .some((anotherServiceName) =>
                    (
                      _this._initializersStates[anotherServiceName]
                        ?.initializer?.[SPECIAL_PROPS.INJECT] || []
                    )
                      .map(_pickServiceNameFromDeclaration)
                      .includes(serviceName),
                  )
              ) {
                debug(
                  `Delaying service "${serviceName}" dependencies shutdown to a dedicated batch.'`,
                );
                return true;
              }
            });

          await Promise.all(
            currentServiceLoadSequence
              .filter(
                (serviceName) =>
                  !dependendedByAServiceInTheSameBatch.includes(serviceName),
              )
              .map(async (serviceName) => {
                const initializeState = _this._initializersStates[serviceName];

                if ('silosInstances' in initializeState) {
                  const provider = _this._getServiceProvider(
                    siloContext,
                    serviceName,
                  );

                  if (
                    serviceLoadSequences.some((servicesLoadSequence) =>
                      servicesLoadSequence.includes(serviceName),
                    )
                  ) {
                    debug(
                      'Delaying service shutdown to another batch:',
                      serviceName,
                    );
                    return Promise.resolve();
                  }
                  if (
                    !initializeState.silosInstances[siloContext.index]
                      .instanceDisposePromise
                  ) {
                    debug('Shutting down a service:', serviceName);
                    initializeState.silosInstances[
                      siloContext.index
                    ].instanceDisposePromise =
                      provider && 'dispose' in provider && provider.dispose
                        ? provider.dispose()
                        : Promise.resolve();
                  } else {
                    debug('Reusing a service shutdown promise:', serviceName);
                  }
                  await initializeState.silosInstances[siloContext.index]
                    .instanceDisposePromise;
                } else if ('singletonInstance' in initializeState) {
                  initializeState.dependents =
                    initializeState.dependents.filter(
                      ({ silo }) => silo !== siloContext.index,
                    );

                  if (initializeState.dependents.length) {
                    debug(
                      `Will not shut down the ${serviceName} singleton service (still used ${initializeState.dependents.length} times).`,
                      initializeState.dependents,
                    );
                  } else {
                    const provider = _this._getServiceProvider(
                      siloContext,
                      serviceName,
                    );
                    debug('Shutting down a singleton service:', serviceName);
                    delete initializeState.instanceLoadPromise;
                    delete initializeState.singletonInstance;
                    return provider && 'dispose' in provider && provider.dispose
                      ? provider.dispose()
                      : Promise.resolve();
                  }
                }
              }),
          );
          if (dependendedByAServiceInTheSameBatch.length) {
            serviceLoadSequences.unshift(dependendedByAServiceInTheSameBatch);
          }
          await _shutdownNextServices(serviceLoadSequences);
        }
      },
      disposer: Promise.resolve.bind(Promise),
    };
    this._silosContexts[siloContext.index] = siloContext;

    const services = await this._loadInitializerDependencies(
      siloContext,
      [RUN_DEPENDENT_NAME],
      dependenciesDeclarations,
      [DISPOSE],
    );

    // TODO: recreate error promise when autoloaded/injected things?
    debug('Handling fatal errors:', siloContext.errorsPromises);
    Promise.all(siloContext.errorsPromises).catch(siloContext.throwFatalError);

    debug('All dependencies now loaded:', siloContext.loadingSequences);

    return services;
  }

  // TODO: ensure undefined/null services works
  _getInitializer(
    serviceName: ServiceName,
  ): Initializer<unknown, Dependencies> | undefined {
    return this._initializersStates[serviceName]?.initializer;
  }

  _getServiceProvider<S extends Service>(
    siloContext: SiloContext,
    serviceName: ServiceName,
  ): Provider<S> | undefined {
    const initializerState = this._initializersStates[serviceName];

    // This method expect the initialized to have a state
    // so failing early if not to avoid programming errors
    if (!initializerState) {
      throw new YError('E_UNEXPECTED_SERVICE_READ');
    }
    if ('initializer' in initializerState) {
      if ('singletonInstance' in initializerState) {
        return {
          service: initializerState.singletonInstance as S,
        };
      }

      if (
        'silosInstances' in initializerState &&
        initializerState.silosInstances &&
        initializerState.silosInstances[siloContext.index] &&
        'instance' in initializerState.silosInstances[siloContext.index]
      ) {
        return {
          service: initializerState.silosInstances[siloContext.index]
            .instance as S,
          dispose: initializerState.silosInstances[siloContext.index].disposer,
          fatalErrorPromise:
            initializerState.silosInstances[siloContext.index]
              .fatalErrorPromise,
        };
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
      const initializerState = this._initializersStates[mappedName] || {
        dependents: [],
        autoloaded: true,
      };

      this._initializersStates[mappedName] = initializerState;
      initializerState.dependents.push({
        silo: siloContext.index,
        name: parentsNames[parentsNames.length - 1],
        optional,
      });

      dependencies.push(mappedName);
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
        const provider = this._getServiceProvider(siloContext, mappedName);

        // We expect a provider here since everything
        // should be resolved
        if (!provider) {
          throw new YError(
            'E_UNEXPECTED_PROVIDER_STATE',
            serviceName,
            parentsNames,
          );
        }

        if (
          !optional &&
          (!('service' in provider) || 'undefined' === typeof provider.service)
        ) {
          throw new YError(
            'E_UNMATCHED_DEPENDENCY',
            ...parentsNames,
            serviceName,
          );
        }

        if (
          !('service' in provider) ||
          'undefined' === typeof provider.service
        ) {
          debug(
            `${[...parentsNames, serviceName].join(
              '->',
            )}: Optional dependency not found.`,
          );
        }

        finalHash[serviceName] = provider?.service;
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

      const service = await servicePromise;

      if (initializerState.initializer[SPECIAL_PROPS.SINGLETON]) {
        (
          initializerState as SingletonInitializerStateDescriptor<any, any>
        ).singletonInstance = service;
      } else {
        (
          initializerState as SiloedInitializerStateDescriptor<any, any>
        ).silosInstances[siloContext.index] = { instance: service };
      }
    } else if (
      initializerState.initializer[SPECIAL_PROPS.TYPE] === 'provider'
    ) {
      const providerPromise = (
        initializerState.initializer as ProviderInitializer<
          Dependencies,
          Service
        >
      )(services);

      if (!providerPromise || !providerPromise.then) {
        debug('Provider initializer did not return a promise:', serviceName);
        throw new YError('E_BAD_SERVICE_PROVIDER', serviceName);
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
        debug('Registering service descriptor error promise:', serviceName);
        siloContext.errorsPromises.push(provider.fatalErrorPromise);
      }

      if (initializerState.initializer[SPECIAL_PROPS.SINGLETON]) {
        (
          initializerState as SingletonInitializerStateDescriptor<any, any>
        ).singletonInstance = provider.service;
        (
          initializerState as SingletonInitializerStateDescriptor<any, any>
        ).disposer = provider.dispose;
        (
          initializerState as SingletonInitializerStateDescriptor<any, any>
        ).fatalErrorPromise = provider.fatalErrorPromise;
      } else {
        (
          initializerState as SiloedInitializerStateDescriptor<any, any>
        ).silosInstances[siloContext.index] = {
          instance: provider.service,
          disposer: provider.dispose,
          fatalErrorPromise: provider.fatalErrorPromise,
        };
      }
    }
  }

  async _loadInitializer(
    siloContext: SiloContext,
    serviceName: ServiceName,
    parentsNames: ServiceName[],
  ): Promise<void> {
    debug(
      `${[...parentsNames, serviceName].join('->')}: Loading an initializer...`,
    );
    if (!this._initializersStates[serviceName]) {
      // At that point there should be an initialiser state
      throw new YError('E_UNEXPECTED_INITIALIZER_STATE', serviceName);
    }

    // At this stage, when no initializer is in the state,
    //  we know that we may load an autoloaded service
    if (!('initializer' in this._initializersStates[serviceName])) {
      debug(
        `${[...parentsNames, serviceName].join(
          '->',
        )}: No registered initializer...`,
      );

      // The auto loader must only have static dependencies
      // and we have to do this check here to avoid inifinite loop
      if (parentsNames.includes(AUTOLOAD)) {
        this._initializersStates[serviceName].initializer = undefined;
        debug(
          `${[...parentsNames, serviceName].join(
            '->',
          )}: Won't try to autoload autoloader dependencies...`,
        );
        return;
      }

      const autoloaderState: SingletonInitializerStateDescriptor<any, any> =
        this._initializersStates[AUTOLOAD];

      this._initializersStates[serviceName] = {
        dependents: [
          {
            silo: siloContext.index,
            name: RUN_DEPENDENT_NAME,
            optional: false,
          },
        ],
        autoloaded: !!autoloaderState,
      };

      if (!autoloaderState) {
        debug(
          `${[...parentsNames, serviceName].join(
            '->',
          )}: No autoloader found, leaving initializer undefined...`,
        );
        this._initializersStates[serviceName].initializer = undefined;
        return;
      } else {
        if (!('instanceLoadPromise' in autoloaderState)) {
          debug(
            `${[...parentsNames, serviceName].join(
              '->',
            )}: Instanciating the autoloader...`,
          );

          // Trick to ensure the instanceLoadPromise is set
          let resolve;
          autoloaderState.instanceLoadPromise = new Promise((_resolve) => {
            resolve = _resolve;
          });

          debug(
            `${[...parentsNames, serviceName].join(
              '->',
            )}: Loaded the autoloader...`,
          );

          resolve(
            await this._loadProvider(siloContext, AUTOLOAD, parentsNames),
          );
        }
        await autoloaderState.instanceLoadPromise;

        const autoloader = await this._getServiceProvider<Autoloader<any>>(
          siloContext,
          AUTOLOAD,
        );

        if (!autoloader) {
          throw new YError('E_UNEXPECTED_AUTOLOADER');
        }

        try {
          if (!this._initializersStates[serviceName].initializerLoadPromise) {
            let resolve;
            this._initializersStates[serviceName].initializerLoadPromise =
              new Promise<Initializer<any, any>>((_resolve) => {
                resolve = _resolve;
              });
            debug(
              `${[...parentsNames, serviceName].join(
                '->',
              )}: Autoloading the service...`,
            );
            const result = await autoloader.service(serviceName);

            if (
              typeof result !== 'object' ||
              !('initializer' in result) ||
              !('path' in result)
            ) {
              throw new YError('E_BAD_AUTOLOADER_RESULT', serviceName, result);
            }

            const { initializer, path } = result;

            debug(
              `${[...parentsNames, serviceName].join(
                '->',
              )}: Loaded the initializer at path ${path}...`,
            );

            resolve(initializer);
          }
          const initializer = await this._initializersStates[serviceName]
            .initializerLoadPromise;

          if (initializer) {
            unwrapInitializerProperties(initializer);

            this._checkInitializerOverride(initializer[SPECIAL_PROPS.NAME]);

            if (initializer[SPECIAL_PROPS.NAME] !== serviceName) {
              throw new YError(
                'E_AUTOLOADED_INITIALIZER_MISMATCH',
                serviceName,
                initializer[SPECIAL_PROPS.NAME],
              );
            }

            if (initializer[SPECIAL_PROPS.TYPE] === 'constant') {
              this._initializersStates[serviceName].initializer = initializer;
              (
                this._initializersStates[
                  initializer[SPECIAL_PROPS.NAME]
                ] as SingletonInitializerStateDescriptor<any, any>
              ).singletonInstance = initializer[SPECIAL_PROPS.VALUE];
              (
                this._initializersStates[
                  initializer[SPECIAL_PROPS.NAME]
                ] as SingletonInitializerStateDescriptor<any, any>
              ).instanceLoadPromise = Promise.resolve(
                initializer[SPECIAL_PROPS.VALUE],
              );
            } else {
              this._checkInitializerDependencies(initializer);
              this._initializersStates[serviceName].initializer = initializer;
              if (!initializer[SPECIAL_PROPS.SINGLETON]) {
                (
                  this._initializersStates[
                    serviceName
                  ] as SiloedInitializerStateDescriptor<any, any>
                ).silosInstances = {};
              }
            }
          } else {
            this._initializersStates[serviceName].initializer = initializer;
          }
        } catch (err) {
          if (!['E_UNMATCHED_DEPENDENCY'].includes((err as YError).code)) {
            throw YError.wrap(
              err as Error,
              'E_BAD_AUTOLOADED_INITIALIZER',
              serviceName,
            );
          }

          debug(
            `${[...parentsNames, serviceName].join(
              '->',
            )}: Could not autoload the initializer...`,
            err,
          );
          this._initializersStates[serviceName].initializer = undefined;
        }
        return;
      }
    }

    const initializerState = this._initializersStates[serviceName];

    if (!initializerState.initializer) {
      debug(
        `${[...parentsNames, serviceName].join(
          '->',
        )}: Could not find the initializer...`,
      );
      initializerState.initializer = undefined;
      (
        initializerState as SingletonInitializerStateDescriptor<any, any>
      ).singletonInstance = undefined;
    } else if ('initializer' in initializerState) {
      debug(
        `${[...parentsNames, serviceName].join('->')}: Initializer ready...`,
      );
      if (initializerState.initializer[SPECIAL_PROPS.SINGLETON]) {
        const singletonInitializerState =
          initializerState as SingletonInitializerStateDescriptor<any, any>;

        if (!('instanceLoadPromise' in singletonInitializerState)) {
          singletonInitializerState.instanceLoadPromise = this._loadProvider(
            siloContext,
            serviceName,
            parentsNames,
          );
        }
        await singletonInitializerState.instanceLoadPromise;
      } else {
        const siloedInitializerState =
          initializerState as SiloedInitializerStateDescriptor<any, any>;

        if (!siloedInitializerState.silosInstances[siloContext.index]) {
          siloedInitializerState.silosInstances[siloContext.index] = {
            instanceLoadPromise: this._loadProvider(
              siloContext,
              serviceName,
              parentsNames,
            ),
          };
        }
        await siloedInitializerState.silosInstances[siloContext.index]
          .instanceLoadPromise;
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

    // TODO: add an option to switch from sequential to parallel resolve
    for (const loadingService of loadingServices) {
      await this._loadInitializer(siloContext, loadingService, parentsNames);
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
            await this._getServiceProvider(siloContext, DISPOSE)
          )?.service as Disposer;

          return $dispose();
        }),
      ).then(() => undefined);

    debug('Shutting down Knifecycle instance.');

    return this._shutdownPromise;
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
