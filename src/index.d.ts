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

type Initializer =
  | HandlerInitializer
  | ServiceInitializer
  | ProviderInitializer;

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
  register<T extends Initializer>(initializer: T): void;
}

export function initializer<T extends Initializer>(
  declaration: InitializerDeclaration,
  initializer: T,
): T;
export function name<T extends Initializer>(name: string, initializer: T): T;
export function autoName<T extends Initializer>(initializer: T): T;
export function type<T extends Initializer>(
  type: InitializerType,
  initializer: T,
): T;
export function inject<T extends Initializer>(
  dependencies: DependenciesDeclarations,
  initializer: T,
): T;
export function autoInject<T extends Initializer>(initializer: T): T;
export function alsoInject<T extends Initializer>(
  dependencies: DependenciesDeclarations,
  initializer: T,
): T;
export function options<T extends Initializer>(
  options: InitializerOptions,
  initializer: T,
  merge: boolean,
): T;
export function extra<T extends Initializer>(data: any, initializer: T): T;
export function reuseSpecialProps<T extends Initializer>(
  from: T,
  to: T,
  amend?: InitializerOptions,
): T;
export function wrapInitializer<T extends Initializer>(
  wrapper: Function,
  baseInitializer: T,
): T;
export function constant(name: String, value: any): ServiceInitializer;
export function service<T extends ServiceInitializer>(
  initializer: T,
  name?: string,
  dependencies?: DependenciesDeclarations,
  options?: InitializerOptions,
): T;
export function autoService<T extends ServiceInitializer>(initializer: T): T;
export function provider<T extends ProviderInitializer>(
  initializer: T,
  name?: string,
  dependencies?: DependenciesDeclarations,
  options?: InitializerOptions,
): T;
export function autoProvider<T extends ProviderInitializer>(initializer: T): T;
export function handler<T extends HandlerInitializer>(
  handlerInitializer: T,
  name?: string,
  dependencies?: DependenciesDeclarations,
  options?: InitializerOptions,
): T;
export function autoHandler<T extends HandlerInitializer>(initializer: T): T;

export const SPECIAL_PROPS: Array<string>;
export const DECLARATION_SEPARATOR: string;
export const OPTIONAL_FLAG: string;

export default Knifecycle;
