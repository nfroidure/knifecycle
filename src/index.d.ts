type Dependencies = { [name: string]: any };

interface ProviderInitializer {
  (services?: Dependencies): Promise<{
    service: any;
    shutdown: () => Promise<void>;
    fatalErrorPromise: Promise<void>;
  }>;
}
interface ServiceInitializer {
  (services?: Dependencies): Promise<any>;
}
interface HandlerInitializer {
  (services?: Dependencies, ...args: Array<any>): Promise<any>;
}

type Initializer<T> = T & (HandlerInitializer | ServiceInitializer | ProviderInitializer);

type InitializerType = 'service' | 'provider' | 'constant';

type DependenciesDeclarations = Array<string>;

interface InitializerOptions {
  singleton: boolean;
}

interface InitializerDeclaration {
  name: string;
  type: InitializerType;
  inject?: DependenciesDeclarations;
  options?: InitializerOptions;
  extra?: any;
}

export class Knifecycle {
  constructor();
  run(dependencies: DependenciesDeclarations): Promise<Dependencies>;
  register<T>(initializer: Initializer<T>): void;
}

export function initializer<T>(
  declaration: InitializerDeclaration,
  initializer: Initializer<T>,
): Initializer<T>;
export function name<T>(
  name: string,
  initializer: Initializer<T>,
): Initializer<T>;
export function autoName<T>(initializer: Initializer<T>): Initializer<T>;
export function type<T>(
  type: InitializerType,
  initializer: Initializer<T>,
): Initializer<T>;
export function inject<T>(
  dependencies: DependenciesDeclarations,
  initializer: Initializer<T>,
): Initializer<T>;
export function autoInject<T>(initializer: Initializer<T>): Initializer<T>;
export function alsoInject<T>(
  dependencies: DependenciesDeclarations,
  initializer: Initializer<T>,
): Initializer<T>;
export function options<T>(
  options: InitializerOptions,
  initializer: Initializer<T>,
  merge: boolean,
): Initializer<T>;
export function extra<T>(
  data: any,
  initializer: Initializer<T>,
): Initializer<T>;
export function reuseSpecialProps<T>(
  from: Initializer<T>,
  to: Initializer<T>,
  amend?: InitializerOptions,
): Initializer<T>;
export function wrapInitializer<T>(
  wrapper: Function,
  baseInitializer: Initializer<T>,
): Initializer<T>;
export function constant(name: String, value: any): ServiceInitializer;
export function service<T>(
  initializer: T & ServiceInitializer,
  name?: string,
  dependencies?: DependenciesDeclarations,
  options?: InitializerOptions,
): T & ServiceInitializer;
export function autoService<T>(
  initializer: T & ServiceInitializer,
): T & ServiceInitializer;
export function provider<T>(
  initializer: T & ProviderInitializer,
  name?: string,
  dependencies?: DependenciesDeclarations,
  options?: InitializerOptions,
): T & ProviderInitializer;
export function autoProvider<T>(
  initializer: T & ProviderInitializer,
): T & ProviderInitializer;
export function handlerInitializer<T>(
  handlerInitializer: T & HandlerInitializer,
  name?: string,
  dependencies?: DependenciesDeclarations,
  options?: InitializerOptions,
): T & HandlerInitializer;
export function autoHandlerInitializer<T>(initializer: HandlerInitializer): HandlerInitializer;

export const SPECIAL_PROPS: Array<string>;
export const DECLARATION_SEPARATOR: string;
export const OPTIONAL_FLAG: string;

export default Knifecycle;
