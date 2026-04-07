import { printStackTrace } from 'yerror';
import { location, service } from './util.js';
import initDebug from 'debug';

const debug = initDebug('knifecycle');

/**
 * Allow to manage processes lifecycle fatal
 * errors.
 */
export interface FatalErrorService {
  errorPromise: Promise<void>;
  registerErrorPromise: (errorPromise: Promise<void>) => void;
  unregisterErrorPromise: (errorPromise: Promise<void>) => void;
  throwFatalError: (err: Error) => void;
}

async function initFatalError(): Promise<FatalErrorService> {
  const errorPromises: Promise<void>[] = [];
  let errorCatchStep = 0;
  let rejectFatalError: (reason?: Error) => void;
  const errorPromise = new Promise<void>((_resolve, reject) => {
    rejectFatalError = reject;
  });
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
    registerErrorPromise: (errorPromise: Promise<void>) => {
      errorPromises.push(errorPromise);
      handleErrorCatch();
    },
    unregisterErrorPromise: (errorPromise: Promise<void>) => {
      errorPromises.filter((anErrorPromise) => anErrorPromise !== errorPromise);
      handleErrorCatch();
    },
    throwFatalError,
  };
}

export default location(
  service(initFatalError, '$fatalError', [], true),
  import.meta.url,
);
