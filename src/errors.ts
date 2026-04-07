import {
  type Dependencies,
  type Initializer,
  type Service,
  type ServiceName,
} from './util.js';

declare module 'yerror' {
  interface YErrorRegistry {
    /** A system service (like READY or SILO_CONTEXT) was unexpectedly initialized */
    E_UNEXPECTED_INIT: [serviceName: ServiceName];

    /** Attempted to use or register a service on a destroyed Knifecycle instance */
    E_INSTANCE_DESTROYED: [];

    /** Attempted to override a core immutable service (e.g., `$instance`, `$injector`) */
    E_IMMUTABLE_SERVICE_NAME: [serviceName: ServiceName];

    /** The `$overrides` service must be registered as a 'constant' type */
    E_CONSTANT_SERVICE_NAME: [serviceName: ServiceName, actualType: string];

    /** Attempted to override an initializer that has already been instantiated */
    E_INITIALIZER_ALREADY_INSTANTIATED: [serviceName: ServiceName];

    /** Inconsistent dependency tree:
     * A singleton service cannot depend on a non-singleton (siloed) service
     */
    E_BAD_SINGLETON_DEPENDENCIES: [
      serviceName: ServiceName,
      dependencyName: ServiceName,
    ];

    /** A circular dependency path was detected in the service graph */
    E_CIRCULAR_DEPENDENCY: [serviceName: ServiceName, ...stack: string[]];

    /** Internal error: Attempted to read the state of an unregistered service */
    E_UNEXPECTED_SERVICE_READ: [];

    /** Internal error: The provider state is inconsistent during dependency resolution */
    E_UNEXPECTED_PROVIDER_STATE: [
      serviceName: ServiceName,
      parents: ServiceName[],
    ];

    /** A required dependency was not found in the registry or autoloader */
    E_UNMATCHED_DEPENDENCY: [
      serviceName: ServiceName,
      ...parents: ServiceName[],
    ];

    /** Internal error: Initializer state is missing while attempting to load a provider */
    E_UNEXPECTED_INITIALIZER_STATE: [serviceName: ServiceName];

    /** A 'service' type initializer failed to return a Promise */
    E_BAD_SERVICE_PROMISE: [serviceName: ServiceName];

    /** * The provider is malformed:
     * Either it didn't return a Promise, or the resolved object is missing the 'service' property
     */
    E_BAD_SERVICE_PROVIDER: [serviceName: ServiceName];

    /** Internal error: Theoretically unreachable internal states */
    E_UNEXPECTED_STATE: [
      serviceName: ServiceName,
      initializer: Initializer<Service, Dependencies>,
    ];

    /** The autoloader service was expected but could not be retrieved from the provider */
    E_UNEXPECTED_AUTO_LOADER: [];

    /** The autoloader returned an invalid type (must be a function or an object) */
    E_BAD_AUTO_LOADER_RESULT: [
      serviceName: ServiceName,
      initializer: Initializer<Service, Dependencies> | undefined,
    ];

    /** The autoloader returned an initializer whose $name property does not match the requested service */
    E_AUTO_LOADED_INITIALIZER_MISMATCH: [
      expectedName: ServiceName,
      actualName: ServiceName,
    ];

    /** The autoloader itself depends on a service that requires auto-loading (infinite loop protection) */
    E_AUTO_LOADER_DEPENDS_ON_AUTO_LOAD: [serviceName: ServiceName];

    /** An error occurred during the auto-loading process of a specific service */
    E_BAD_AUTO_LOADED_INITIALIZER: [serviceName: ServiceName];

    /** A style class used in Mermaid graph generation is not defined in the classes dictionary */
    E_BAD_CLASS: [className: string, serviceName: ServiceName];

    /** Could not solve the dependency tree after 99 iterations */
    E_PROBABLE_CIRCULAR_DEPENDENCY: [];

    /** The initializer must be an 'async function' to be automatically analyzed */
    E_NON_ASYNC_INITIALIZER: [source: string];

    /** * Failed to automatically detect dependencies from the function signature.
     * Usually happens if the function doesn't use the 'async ({ dep }) => ...' pattern.
     */
    E_AUTO_INJECTION_FAILURE: [source: string];

    /** Failed to detect a service name from the function name (e.g. anonymous functions) */
    E_AUTO_NAMING_FAILURE: [functionNameOrType: string];

    /** Attempted to inject dependencies into a 'constant' type initializer */
    E_BAD_INJECT_IN_CONSTANT: [serviceName: string, dependencies: string[]];

    /** * A constant value looks like an initializer (it has a $inject property).
     * This is forbidden to avoid confusion between a constant and a service.
     */
    E_CONSTANT_INJECTION: [injections: string[]];

    /** The service() decorator was called without a service builder function */
    E_NO_SERVICE_BUILDER: [];

    /** The provider() decorator was called without a provider builder function */
    E_NO_PROVIDER_BUILDER: [];
    /** An invalid property name was passed to the initializer decorator */
    E_BAD_PROPERTY: [property: string];

    /** The provided initializer is neither a function nor a valid object */
    E_BAD_INITIALIZER: [initializer: Initializer<Service, Dependencies>];

    /** * The initializer has no name or an empty name.
     * Knifecycle requires named initializers for dependency resolution.
     */
    E_ANONYMOUS_ANALYZER: [serviceName: ServiceName | undefined];

    /** The initializer type is not among: 'service', 'provider', or 'constant' */
    E_BAD_INITIALIZER_TYPE: [
      serviceName: ServiceName,
      actualType: string,
      allowedTypes: readonly string[],
    ];

    /** The $autoload service must be a singleton to avoid infinite recursion */
    E_BAD_AUTO_LOADER: [isSingleton: boolean];

    /** A 'constant' type initializer was registered without a defined value */
    E_UNDEFINED_CONSTANT_INITIALIZER: [serviceName: ServiceName];

    /** A service or provider type initializer incorrectly contains a $value property */
    E_BAD_VALUED_NON_CONSTANT_INITIALIZER: [serviceName: ServiceName];
  }
}
