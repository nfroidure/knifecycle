import { location, service } from './util.js';
import { type Disposer } from './util.js';
import { SiloIndex, type Knifecycle } from './index.js';

/**
 * Allow to dispose the services of an
 * initialized silo content.
 */
async function initDispose({
  $instance,
  $siloIndex,
}: {
  $instance: Knifecycle;
  $siloIndex: SiloIndex;
}): Promise<Disposer> {
  return async () => {
    await $instance.shutdown($siloIndex);
  };
}

export default location(
  service(initDispose, '$dispose', ['$instance', '$siloIndex']),
  import.meta.url,
);
