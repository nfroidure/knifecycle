import { type DependencyDeclaration } from './util.js';

export const INJECTOR = '$injector';
export type Injector<T extends Record<string, unknown>> = (
  dependencies: DependencyDeclaration[],
) => Promise<T>;
