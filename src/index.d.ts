export type DependencyName = string;
export type Dependencies = { [name: string]: any };

export interface ProviderInitializer<D extends Dependencies, S> {
  (services?: D): Promise<{
    service: S;
    dispose?: () => Promise<void>;
    fatalErrorPromise?: Promise<void>;
  }>;
}
export interface ServiceInitializer<D extends Dependencies, S> {
  (services?: D): Promise<S>;
}
export interface HandlerInitializer<D extends Dependencies, U extends any[], V> {
  (services?: D, ...args: U): Promise<V>;
}
export interface Handler<U extends any[], V> {
  (...args: U): Promise<V>;
}

export type Initializer<D extends Dependencies, S> =
  | ServiceInitializer<D, S>
  | ProviderInitializer<D, S>;

export type InitializerType = 'service' | 'provider' | 'constant';

export type DependenciesDeclarations = Array<DependencyName>;

export interface InitializerOptions {
  singleton: boolean;
}

export interface InitializerDeclaration {
  name: string;
  type: InitializerType;
  inject?: DependenciesDeclarations;
  options?: InitializerOptions;
  extra?: any;
}

export interface Injector {
  (dependencies: DependenciesDeclarations): Promise<Dependencies>;
}
export interface Disposer {
  (): Promise<void>;
}
export interface Autoloader<D> {
  (name: DependencyName): Promise<D>;
}
export interface FatalErrorProvider {
  promise: Promise<void>;
}
export interface SiloContext<D> {
  name: string,
  servicesDescriptors: Map<DependencyName, D>,
  servicesSequence: DependencyName[],
  servicesShutdownsPromises: Map<DependencyName, Promise<void>>,
  errorsPromises: Promise<void>[],
}

export class Knifecycle {
  constructor();
  run(dependencies: DependenciesDeclarations): Promise<Dependencies>;
  destroy(): Promise<void>;
  register<D extends Dependencies, S, T extends Initializer<D, S>>(
    initializer: T,
  ): Knifecycle;
}

export function initializer<
  D extends Dependencies,
  S,
  T extends Initializer<D, S>
>(declaration: InitializerDeclaration, initializer: T): T;
export function name<D extends Dependencies, S, T extends Initializer<D, S>>(
  name: DependencyName,
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
  name?: DependencyName,
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
  name?: DependencyName,
  dependencies?: DependenciesDeclarations,
  options?: InitializerOptions,
): T;
export function autoProvider<
  D extends Dependencies,
  S,
  T extends ProviderInitializer<D, S>
>(providerBuilder: T): T;
export function handler<D extends Dependencies, U extends any[], V>(
  handlerInitializer: HandlerInitializer<D, U, V>,
  name?: DependencyName,
  dependencies?: DependenciesDeclarations,
  options?: InitializerOptions,
): ServiceInitializer<D, Handler<U, V>>;
export function autoHandler<D extends Dependencies, U extends any[], V>(
  handlerInitializer: HandlerInitializer<D, U, V>,
): ServiceInitializer<D, Handler<U, V>>;

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
