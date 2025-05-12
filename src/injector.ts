import { type DependencyDeclaration } from './util.js';

export const INJECTOR = '$injector';
export interface Injector<T extends Record<string, unknown>> {
  (dependencies: DependencyDeclaration[]): Promise<T>;
}
