export type DependencyName = string;
export type DependencyDeclaration = string;
export type DependenciesDeclarations = DependencyDeclaration[];
export type Service = any;
export type Provider<S = Service> = {
  service: S;
  dispose?: () => Promise<void>;
  fatalErrorPromise?: Promise<void>;
};
export type Dependencies<S = Service> = { [name: string]: S };
export type Services<S = Service> = { [name: string]: S };
export type Parameters<V = any> = { [name: string]: V };

export interface HandlerFunction<D, P extends Parameters, U extends any[], R> {
  (dependencies: D, parameters?: P, ...args: U): Promise<R>;
}

export interface Handler<P extends Parameters, U extends any[], R> {
  (parameters?: P, ...args: U): Promise<R>;
}

export interface ProviderInitializer<D extends Dependencies, S = Service> {
  (dependencies?: D): Promise<Provider<S>>;
}
export interface ServiceInitializer<D extends Dependencies, S = Service> {
  (dependencies?: D): Promise<S>;
}
export interface HandlerInitializer<D extends Dependencies, U extends any[], R, P = Parameters, S = Handler<P, U, R>> {
  (dependencies?: D): Promise<S>;
}

export type Initializer<D extends Dependencies, S> =
  | ServiceInitializer<D, S>
  | ProviderInitializer<D, S>
  | HandlerInitializer<D, any[], any, any, S>;

export type InitializerType = 'service' | 'provider' | 'constant';

export interface InitializerOptions {
  singleton: boolean;
}

export interface InitializerDeclaration {
  name: DependencyName;
  type: InitializerType;
  inject?: DependenciesDeclarations;
  options?: InitializerOptions;
  extra?: any;
}

export interface Injector<S extends Services> {
  (dependencies: DependenciesDeclarations): Promise<S>;
}
export interface Disposer {
  (): Promise<void>;
}
export interface Autoloader<S = Service> {
  (name: DependencyDeclaration): Promise<S>;
}
export interface FatalErrorProvider {
  promise: Promise<void>;
}
export interface SiloContext<S extends Service> {
  name: string,
  servicesDescriptors: Map<DependencyDeclaration, S>,
  servicesSequence: DependencyDeclaration[],
  servicesShutdownsPromises: Map<DependencyDeclaration, Promise<void>>,
  errorsPromises: Promise<void>[],
}

export class Knifecycle<S = Services> {
  constructor();
  run<RS = S>(dependencies: DependenciesDeclarations): Promise<RS>;
  destroy(): Promise<void>;
  register<D extends Dependencies, S, T extends Initializer<D, S>>(
    initializer: T,
  ): Knifecycle;
  toMermaidGraph({ shapes, styles, classes } : {
    shapes: ({
      pattern: RegExp,
      template: string,
    })[],
    styles: ({
      pattern: RegExp,
      className: string,
    })[],
    classes: {
      [name : string]: string,
    },
  }): string
}

export function initializer<D extends Dependencies, S, T extends Initializer<D, S>>(
  declaration: InitializerDeclaration,
  initializer: T
): T;

export function name<D extends Dependencies, S, T extends Initializer<D, S>>(
  name: DependencyDeclaration,
  initializer: T,
): T;
export function autoName<
  D extends Dependencies,
  S,
  T extends Initializer<D, S>
>(initializer: T): T;
export function type<D extends Dependencies, S, T extends Initializer<D, S>>(
  type: InitializerType,
  initializer: T,
): T;
export function inject<D extends Dependencies, S, T extends Initializer<D, S>>(
  dependencies: DependenciesDeclarations,
  initializer: T,
): T;
export function autoInject<
  D extends Dependencies,
  S,
  T extends Initializer<D, S>
>(initializer: T): T;
export function alsoInject<
  D extends Dependencies,
  S,
  T extends Initializer<D, S>
>(dependencies: DependenciesDeclarations, initializer: T): T;
export function options<D extends Dependencies, S, T extends Initializer<D, S>>(
  options: InitializerOptions,
  initializer: T,
  merge?: boolean,
): T;
export function extra<D extends Dependencies, S, T extends Initializer<D, S>>(
  data: any,
  initializer: T,
): T;
export function reuseSpecialProps<
  D extends Dependencies,
  S,
  T extends Initializer<D, S>
>(from: T, to: T, amend?: InitializerOptions): T;
export function wrapInitializer<
  D extends Dependencies,
  S,
  T extends Initializer<D, S>
>(wrapper: Function, baseInitializer: T): T;

export function constant<S>(name: string, value: S): ServiceInitializer<any, S>;

export function service<
  D extends Dependencies,
  S,
  T extends ServiceInitializer<D, S>
>(
  serviceBuilder: T,
  name?: DependencyDeclaration,
  dependencies?: DependenciesDeclarations,
  options?: InitializerOptions,
): T;
export function autoService<
  D extends Dependencies,
  S,
  T extends ServiceInitializer<D, S>
>(serviceBuilder: T): T;

export function provider<
  D extends Dependencies,
  S,
  T extends ProviderInitializer<D, S>
>(
  providerBuilder: T,
  name?: DependencyDeclaration,
  dependencies?: DependenciesDeclarations,
  options?: InitializerOptions,
): T;
export function autoProvider<
  D extends Dependencies,
  S,
  T extends ProviderInitializer<D, S>
>(providerBuilder: T): T;

export function handler<
  D extends Dependencies,
  P extends Parameters,
  U extends any[],
  R
>(
  handlerFunction: HandlerFunction<D, P, U, R>,
  name?: DependencyDeclaration,
  dependencies?: DependenciesDeclarations,
  options?: InitializerOptions,
): HandlerInitializer<D, U, R, P>;
export function autoHandler<
  D extends Dependencies,
  P extends Parameters,
  U extends any[],
  R
>(
  handlerFunction: HandlerFunction<D, P, U, R>,
): HandlerInitializer<D, U, R, P>;

export const SPECIAL_PROPS: {
  INJECT: string,
  OPTIONS: string,
  NAME: string,
  TYPE: string,
  EXTRA: string,
  VALUE: string,
};
export const DECLARATION_SEPARATOR: string;
export const OPTIONAL_FLAG: string;

export default Knifecycle;
