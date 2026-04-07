import { type DependencyDeclaration } from './util.js';

export type Injector<T extends Record<string, unknown>> = (
  dependencies: DependencyDeclaration[],
) => Promise<T>;
