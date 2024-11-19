import {
  INSTANCE,
  NO_PROVIDER,
  SILO_CONTEXT,
  SPECIAL_PROPS,
  parseDependencyDeclaration,
  service,
} from './util.js';
import initDebug from 'debug';
import type { Disposer, ServiceName } from './util.js';
import type { Knifecycle, SiloContext } from './index.js';

const debug = initDebug('knifecycle');

export const DISPOSE = '$dispose';

/**
 * Allow to dispose the services of an
 * initialized silo content.
 */
async function initDispose({
  $instance,
  $siloContext,
}: {
  $instance: Knifecycle;
  $siloContext: SiloContext;
}): Promise<Disposer> {
  return async () => {
    $siloContext._shutdownPromise =
      $siloContext._shutdownPromise ||
      _shutdownNextServices($siloContext.loadingSequences.concat());
    await $siloContext._shutdownPromise;
    delete $instance._silosContexts[$siloContext.index];

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
                  $instance._initializersStates[anotherServiceName]
                    ?.initializer?.[SPECIAL_PROPS.INJECT] || []
                )
                  .map(
                    (declaration) =>
                      parseDependencyDeclaration(declaration).serviceName,
                  )
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
            const initializeState = $instance._initializersStates[serviceName];

            if ('silosInstances' in initializeState) {
              const provider = $instance._getServiceProvider(
                $siloContext,
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
                !initializeState.silosInstances[$siloContext.index]
                  .instanceDisposePromise
              ) {
                debug('Shutting down a service:', serviceName);
                initializeState.silosInstances[
                  $siloContext.index
                ].instanceDisposePromise =
                  provider &&
                  provider !== NO_PROVIDER &&
                  'dispose' in provider &&
                  provider.dispose
                    ? provider.dispose()
                    : Promise.resolve();
              } else {
                debug('Reusing a service shutdown promise:', serviceName);
              }
              await initializeState.silosInstances[$siloContext.index]
                .instanceDisposePromise;
            } else if ('singletonProvider' in initializeState) {
              initializeState.dependents = initializeState.dependents.filter(
                ({ silo }) => silo !== $siloContext.index,
              );

              if (initializeState.dependents.length) {
                debug(
                  `Will not shut down the ${serviceName} singleton service (still used ${initializeState.dependents.length} times).`,
                  initializeState.dependents,
                );
              } else {
                const provider = $instance._getServiceProvider(
                  $siloContext,
                  serviceName,
                );
                debug('Shutting down a singleton service:', serviceName);
                delete initializeState.singletonProviderLoadPromise;
                delete initializeState.singletonProvider;
                return provider &&
                  provider !== NO_PROVIDER &&
                  'dispose' in provider &&
                  provider.dispose
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
  };
}

export default service(initDispose, DISPOSE, [INSTANCE, SILO_CONTEXT]);
