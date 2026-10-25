import { printStackTrace } from 'yerror';
import { location, service } from './util.js';
import initDebug from 'debug';

const debug = initDebug('knifecycle');

/**
 * Allow to manage processes lifecycle fatal
 * errors.
 */
export interface FatalErrorService {
  errorPromise: Promise<undefined>;
  registerErrorPromise: (errorPromise: Promise<undefined>) => void;
  unregisterErrorPromise: (errorPromise: Promise<undefined>) => void;
  throwFatalError: (err: Error) => void;
}

async function initFatalError(): Promise<FatalErrorService> {
  const errorPromises: Promise<undefined>[] = [];
  let errorCatchStep = 0;
  const { promise: errorPromise, reject: rejectFatalError } =
    Promise.withResolvers<undefined>();

  const throwFatalError = (err: Error) => {
    debug('Handled a fatal error', printStackTrace(err));
    rejectFatalError(err);
  };
  const handleErrorCatch = () => {
    const currentStep = ++errorCatchStep;

    Promise.all(errorPromises).catch((err: Error) => {
      if (currentStep === errorCatchStep) {
        throwFatalError(err);
      } else {
        debug(
          `Ignored a fatal error ${currentStep}/${errorCatchStep}:`,
          printStackTrace(err),
        );
      }
    });
  };

  return {
    errorPromise,
    registerErrorPromise: (errorPromise: Promise<undefined>) => {
      errorPromises.push(errorPromise);
      handleErrorCatch();
    },
    unregisterErrorPromise: (errorPromise: Promise<undefined>) => {
      const index = errorPromises.indexOf(errorPromise);

      if (index !== -1) {
        errorPromises.splice(index, 1);
      }

      handleErrorCatch();
    },
    throwFatalError,
  };
}

export default location(
  service(initFatalError, '$fatalError', [], true),
  import.meta.url,
);
