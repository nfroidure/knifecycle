/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, jest } from '@jest/globals';
import {
  reuseSpecialProps,
  wrapInitializer,
  parseDependencyDeclaration,
  name,
  autoName,
  type,
  inject,
  autoInject,
  alsoInject,
  useInject,
  mergeInject,
  parseInjections,
  singleton,
  extra,
  initializer,
  constant,
  service,
  autoService,
  provider,
  autoProvider,
  handler,
  autoHandler,
  SPECIAL_PROPS,
  unInject,
  location,
} from './util.js';
import type { Provider } from './util.js';
import type { Dependencies, ServiceInitializer } from './index.js';
import { YError } from 'yerror';

async function aProviderInitializer() {
  return {
    service: 'A_PROVIDER_SERVICE',
  };
}
async function aServiceInitializer() {
  return 'A_PROVIDER_SERVICE';
}

describe('reuseSpecialProps', () => {
  test('should work', () => {
    // We can safely ignore coverage here since the
    // function are here just as placeholders
    /* istanbul ignore next */
    async function from() {
      return 'from';
    }
    /* istanbul ignore next */
    async function to() {
      return 'to';
    }

    from.$name = 'from';
    from.$type = 'service';
    from.$inject = ['ki', 'kooo', 'lol'];
    from.$singleton = false;
    from.$extra = { httpHandler: true };

    const newFn = reuseSpecialProps(from, to);

    expect(newFn).not.toEqual(to);
    expect((newFn as any).$name).toEqual(from.$name);
    expect((newFn as any).$type).toEqual(from.$type);
    expect((newFn as any).$inject).not.toBe(from.$inject);
    expect((newFn as any).$inject).toEqual(from.$inject);
    expect((newFn as any).$singleton).toEqual(from.$singleton);
    expect((newFn as any).$extra).not.toBe(from.$extra);
    expect((newFn as any).$extra).toEqual(from.$extra);

    const newFn2 = reuseSpecialProps(from, to, {
      $name: 'yolo',
    });

    expect(newFn2).not.toEqual(to);
    expect((newFn2 as any).$name).toEqual('yolo');
    expect((newFn2 as any).$type).toEqual(from.$type);
    expect((newFn2 as any).$inject).not.toBe(from.$inject);
    expect((newFn2 as any).$inject).toEqual(from.$inject);
    expect((newFn2 as any).$singleton).toEqual(from.$singleton);
    expect((newFn as any).$extra).not.toBe(from.$extra);
    expect((newFn as any).$extra).toEqual(from.$extra);
  });
});

describe('wrapInitializer', () => {
  test('should work with a service initializer', async () => {
    async function baseServiceInitializer() {
      return () => 'test';
    }

    const log = jest.fn();
    const newInitializer = wrapInitializer(
      async ({ log }: { log: any }, service: () => string) => {
        log('Wrapping...');
        return () => service() + '-wrapped';
      },
      service(
        baseServiceInitializer,
        'baseServiceInitializer',
        ['log', '?test'],
        false,
        {
          httpHandler: false,
        },
      ),
    );

    const newService = await newInitializer({ log });
    expect(newService()).toEqual('test-wrapped');
    expect(log.mock.calls).toEqual([['Wrapping...']]);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(['log', '?test']);
  });

  test('should work with a provider initialzer', async () => {
    async function baseInitializer() {
      return { service: () => 'test' };
    }

    const log = jest.fn();
    const baseProviderInitializer = provider(
      baseInitializer,
      'baseInitializer',
      ['log', '?test'],
      false,
      {
        httpHandler: false,
      },
    );
    const newInitializer = wrapInitializer(
      async (
        { log }: { log: (message: string) => void },
        service,
      ): Promise<Provider<() => string>> => {
        log('Wrapping...');
        return { service: () => service.service() + '-wrapped' };
      },
      baseProviderInitializer,
    );

    const newService = await newInitializer({ log });
    expect(newService.service()).toEqual('test-wrapped');
    expect(log.mock.calls).toEqual([['Wrapping...']]);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(['log', '?test']);
  });
});

describe('inject', () => {
  test('should allow to decorate an initializer with dependencies', () => {
    const dependencies = ['ENV'];
    const newInitializer = inject<{ ENV: string }, string>(
      dependencies,
      provider(aProviderInitializer, 'aProvider'),
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
  });

  test('should allow to decorate an initializer builder with dependencies', () => {
    const dependencies = ['ENV'];
    const newInitializer = inject<{ ENV: string }, string>(
      dependencies,
      aProviderInitializer,
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
  });

  test('should allow to decorate an initializer with dependencies', () => {
    const dependencies = ['ENV'];
    const newInitializer = inject<{ ENV: string }, string>(
      dependencies,
      service(aServiceInitializer, 'aService'),
    );

    expect(newInitializer).not.toEqual(aServiceInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
  });

  test('should allow to decorate an initializer builder with dependencies', () => {
    const dependencies = ['ENV'];
    const newInitializer = inject<{ ENV: string }, string>(
      dependencies,
      aServiceInitializer,
    );

    expect(newInitializer).not.toEqual(aServiceInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
  });

  test('should allow to decorate an initializer with mapped dependencies', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const newInitializer = inject(dependencies, aProviderInitializer);

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
  });

  test('should fail with a constant', () => {
    try {
      inject(
        ['test'],
        constant('test', 'test') as unknown as ServiceInitializer<
          Dependencies,
          unknown
        >,
      );
      throw new YError('E_UNEXPECTED_SUCCESS');
    } catch (err) {
      expect((err as YError).code).toEqual('E_BAD_INJECT_IN_CONSTANT');
    }
  });
});
describe('useInject', () => {
  test('should set the right dependencies', () => {
    const fromDependencies = ['ENV', 'CORS'];
    const fromInitializer = inject(fromDependencies, aProviderInitializer);
    const toDependencies = ['db', 'log'];
    const toInitializer = inject(toDependencies, aProviderInitializer);
    const newInitializer = useInject(fromInitializer, toInitializer);

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(fromDependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toEqual(toDependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual([...fromDependencies]);
  });
});

describe('mergeInject', () => {
  test('should amend dependencies', () => {
    const fromDependencies = ['ENV', 'CORS'];
    const fromInitializer = inject<
      {
        db: 'db';
        log: 'log';
      },
      Awaited<ReturnType<typeof aProviderInitializer>>
    >(fromDependencies, aProviderInitializer);
    const toDependencies = ['db', 'log'];
    const toInitializer = inject(toDependencies, aProviderInitializer);
    const newInitializer = mergeInject(fromInitializer, toInitializer);

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(fromDependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toEqual(toDependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual([
      ...toDependencies,
      ...fromDependencies,
    ]);
  });
});

describe('unInject', () => {
  test('should work with empty dependencies', () => {
    const baseProvider =
      async ({ ENV, mysql: db }) =>
      async () => ({
        ENV,
        db,
      });
    const removedDependencies = [];
    const leftDependencies = [];
    const dependencies = [...removedDependencies, ...leftDependencies];
    const initializer = inject(dependencies, baseProvider);
    const newInitializer = unInject(removedDependencies, initializer);

    expect(newInitializer).not.toEqual(baseProvider);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(leftDependencies);
  });

  test('should allow to remove dependencies', () => {
    const baseProvider =
      async ({ ENV, mysql: db }) =>
      async () => ({
        ENV,
        db,
      });
    const removedDependencies = ['mysql'];
    const leftDependencies = ['ENV'];
    const dependencies = [...removedDependencies, ...leftDependencies];
    const initializer = inject(dependencies, baseProvider);
    const newInitializer = unInject(removedDependencies, initializer);

    expect(newInitializer).not.toEqual(baseProvider);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toEqual(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(leftDependencies);
  });

  test('should allow to remove mapped dependencies', () => {
    const baseProvider =
      async ({ ENV, mysql: db }) =>
      async () => ({
        ENV,
        db,
      });
    const removedDependencies = ['mysql>myMysql'];
    const leftDependencies = ['ENV>myENV'];
    const dependencies = ['mysql>anotherMysql', ...leftDependencies];
    const initializer = inject(dependencies, baseProvider);
    const newInitializer = unInject(removedDependencies, initializer);

    expect(newInitializer).not.toEqual(baseProvider);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toEqual(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(leftDependencies);
  });
});

describe('autoInject', () => {
  test('should allow to decorate an initializer with dependencies', () => {
    const baseProvider =
      async ({ ENV, mysql: db }) =>
      async () => ({
        ENV,
        db,
      });
    const dependencies = ['ENV', 'mysql'];
    const newInitializer = autoInject(baseProvider);

    expect(newInitializer).not.toEqual(baseProvider);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
  });

  test('should allow to decorate an initializer with a function name', () => {
    async function baseProvider({ ENV, mysql: db }) {
      async () => ({
        ENV,
        db,
      });
    }
    const dependencies = ['ENV', 'mysql'];
    const newInitializer = autoInject(baseProvider);

    expect(newInitializer).not.toEqual(baseProvider);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
  });

  test('should allow to decorate a service initializer with its location', () => {
    async function baseService({ ENV, mysql: db }) {
      return { my: 'service' };
    }

    const newInitializer = location(
      autoService(baseService),
      'file://here',
      'prop',
    );

    expect(newInitializer).not.toEqual(baseService);
    expect(newInitializer[SPECIAL_PROPS.LOCATION]).toEqual({
      url: 'file://here',
      exportName: 'prop',
    });
  });

  test('should allow to decorate a constant initializer with its location', () => {
    const baseConstant = constant('test', 'test');
    const newConstant = location(baseConstant, 'file://here');

    expect(newConstant).not.toEqual(baseConstant);
    expect(newConstant[SPECIAL_PROPS.TYPE]).toEqual('constant');
    expect(newConstant[SPECIAL_PROPS.LOCATION]).toEqual({
      url: 'file://here',
      exportName: 'default',
    });
  });

  test('should allow to decorate an initializer with optional dependencies', () => {
    const noop = () => undefined;
    const baseProvider =
      async ({ ENV, log = noop, debug: aDebug = noop }) =>
      async () => ({
        ENV,
        log,
        aDebug,
      });
    const dependencies = ['ENV', '?log', '?debug'];
    const newInitializer = autoInject(baseProvider);

    expect(newInitializer).not.toEqual(baseProvider);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
  });

  test('should allow to decorate an initializer with several arguments', () => {
    const noop = () => undefined;
    const baseProvider =
      async ({ ENV, log = noop, debug: aDebug = noop }) =>
      async () => ({
        ENV,
        log,
        aDebug,
      });
    const dependencies = ['ENV', '?log', '?debug'];
    const newInitializer = autoInject(baseProvider);

    expect(newInitializer).not.toEqual(baseProvider);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
  });

  test('should allow to decorate an initializer with complex arguments', () => {
    const noop = () => undefined;
    const baseProvider =
      async ({ ENV, log = noop, debug: aDebug = noop }) =>
      async () => ({
        ENV,
        log,
        aDebug,
      });
    const dependencies = ['ENV', '?log', '?debug'];
    const newInitializer = autoInject(baseProvider);

    expect(newInitializer).not.toEqual(baseProvider);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
  });

  test('should fail with non async initializers', () => {
    try {
      autoInject((({ foo: bar = { bar: 'foo' } }) => {
        return bar;
      }) as any);
      throw new YError('E_UNEXPECTED_SUCCESS');
    } catch (err) {
      expect((err as YError).code).toEqual('E_NON_ASYNC_INITIALIZER');
    }
  });

  test('should fail with too complex injections', () => {
    try {
      autoInject(async ({ foo: bar = { bar: 'foo' } }) => {
        return bar;
      });
      throw new YError('E_UNEXPECTED_SUCCESS');
    } catch (err) {
      expect((err as YError).code).toEqual('E_AUTO_INJECTION_FAILURE');
    }
  });

  test('should fail with no injections', () => {
    try {
      autoInject(async () => undefined);
      throw new YError('E_UNEXPECTED_SUCCESS');
    } catch (err) {
      expect((err as YError).code).toEqual('E_AUTO_INJECTION_FAILURE');
    }
  });
});

describe('alsoInject', () => {
  test('should allow to decorate an initializer with dependencies', () => {
    const newInitializer = alsoInject(
      ['ENV'],
      inject(['TEST'], aProviderInitializer),
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(['TEST', 'ENV']);
  });

  test('should allow to decorate an initializer with dependencies', () => {
    const newInitializer = alsoInject(['ENV'], aProviderInitializer);

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(['ENV']);
  });

  test('should dedupe dependencies', () => {
    const baseProvider = inject(['?TEST'], aProviderInitializer);
    const newInitializer = alsoInject(
      ['ENV', '?NODE_ENV', '?TEST', 'TEST2', 'db>mysql'],
      alsoInject(['ENV', 'NODE_ENV', '?TEST', '?TEST2', 'mysql'], baseProvider),
    );

    expect(newInitializer).not.toEqual(baseProvider);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual([
      'mysql',
      'ENV',
      'NODE_ENV',
      '?TEST',
      'TEST2',
      'db>mysql',
    ]);
  });

  test('should preserve single optional dependencies', () => {
    const baseProvider = inject(['ENV', '?TEST'], aProviderInitializer);
    const newInitializer = alsoInject(
      ['ENV', '?TEST2'],
      alsoInject(['ENV', '?TEST3'], baseProvider),
    );

    expect(newInitializer).not.toEqual(baseProvider);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual([
      '?TEST',
      '?TEST3',
      'ENV',
      '?TEST2',
    ]);
  });

  test('should preserve mapped dependencies', () => {
    const baseProvider = inject(['mysql', '?sftp'], aProviderInitializer);
    const newInitializer = alsoInject(['db>mysql', '?ftp>sftp'], baseProvider);

    expect(newInitializer).not.toEqual(baseProvider);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual([
      'mysql',
      '?sftp',
      'db>mysql',
      '?ftp>sftp',
    ]);
  });

  test('should solve dependencies alias name clash', () => {
    const baseProvider = inject(['?TEST'], aProviderInitializer);
    const newInitializer = alsoInject(
      ['ENV', '?NODE_ENV', '?TEST', 'db>mysql', '?log>logly'],
      alsoInject(
        ['ENV', 'NODE_ENV', '?TEST', 'db>pg', '?log>logger'],
        baseProvider,
      ),
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual([
      'ENV',
      'NODE_ENV',
      '?TEST',
      'db>mysql',
      '?log>logly',
    ]);
  });

  test('should solve dependencies alias name clash', () => {
    const baseProvider = inject(['?TEST'], aProviderInitializer);
    const newInitializer = alsoInject(
      ['ENV', '?NODE_ENV', '?TEST', 'db>mysql', '?log>logly'],
      alsoInject(
        ['ENV', 'NODE_ENV', '?TEST', 'db>pg', '?log>logger'],
        baseProvider,
      ),
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual([
      'ENV',
      'NODE_ENV',
      '?TEST',
      'db>mysql',
      '?log>logly',
    ]);
  });
});

describe('parseInjections', () => {
  test('should work with TypeScript dependencies', () => {
    expect(
      parseInjections(`async function initNexmo({
      ENV,
      NEXMO,
      log = noop,
    }: {
      ENV: any;
      NEXMO: any;
      log: Function;
    }): Promise<SMSService> {}`),
    ).toEqual(['ENV', 'NEXMO', '?log']);
  });

  test('should allow to decorate an initializer with dependencies', () => {
    const newInitializer = alsoInject(['ENV'], aProviderInitializer);

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(['ENV']);
  });
});

describe('singleton', () => {
  test('should allow to decorate an initializer with singleton option', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const newInitializer = inject(
      dependencies,
      singleton(aProviderInitializer, true),
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
    expect(newInitializer[SPECIAL_PROPS.SINGLETON]).toEqual(true);
  });

  test('should allow to be used several times', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const newInitializer = inject(
      dependencies,
      singleton(singleton(aProviderInitializer), false),
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
    expect(newInitializer[SPECIAL_PROPS.SINGLETON]).toEqual(false);
  });
});

describe('name', () => {
  test('should allow to decorate an initializer with a name', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseName = 'hash';
    const newInitializer = inject(
      dependencies,
      name(baseName, aProviderInitializer),
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
    expect(newInitializer[SPECIAL_PROPS.NAME]).toEqual(baseName);
  });
});

describe('autoName', () => {
  test('should allow to decorate an initializer with its function name', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseName = 'hash';
    const newInitializer = inject(
      dependencies,
      autoName(async function hash() {
        return undefined;
      }),
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
    expect(newInitializer[SPECIAL_PROPS.NAME]).toEqual(baseName);
  });

  test('should allow to decorate an initializer with its init like function name', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseName = 'hash';
    const newInitializer = inject(
      dependencies,
      autoName(async function initHash() {
        return undefined;
      }),
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
    expect(newInitializer[SPECIAL_PROPS.NAME]).toEqual(baseName);
  });

  test('should allow to decorate an initializer with its initialize like function name', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseName = 'hash';
    const newInitializer = inject(
      dependencies,
      autoName(async function initializeHash() {
        return undefined;
      }),
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
    expect(newInitializer[SPECIAL_PROPS.NAME]).toEqual(baseName);
  });

  test('should allow to decorate a bounded initializer', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseName = 'hash';
    const newInitializer = autoName(
      inject(
        dependencies,
        singleton(async function initializeHash() {
          return undefined;
        }),
      ),
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
    expect(newInitializer[SPECIAL_PROPS.SINGLETON]).toEqual(true);
    expect(newInitializer[SPECIAL_PROPS.NAME]).toEqual(baseName);
  });

  test('should fail with anonymous functions', () => {
    try {
      autoName(async () => undefined);
      throw new YError('E_UNEXPECTED_SUCCESS');
    } catch (err) {
      expect((err as YError).code).toEqual('E_AUTO_NAMING_FAILURE');
    }
  });
});

describe('extra', () => {
  test('should allow to decorate an initializer with extra infos', () => {
    const extraInformations = { httpHandler: true };
    const newInitializer = extra(extraInformations, aProviderInitializer);

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.EXTRA]).not.toBe(extraInformations);
    expect(newInitializer[SPECIAL_PROPS.EXTRA]).toEqual(extraInformations);
  });

  test('should allow to decorate an initializer with extra infos', () => {
    const extraInformations = { httpHandler: true };
    const newInitializer = extra(extraInformations, aProviderInitializer, true);

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.EXTRA]).not.toBe(extraInformations);
    expect(newInitializer[SPECIAL_PROPS.EXTRA]).toEqual(extraInformations);
  });

  test('should allow to decorate an initializer with additional extra infos', () => {
    const baseExtraInformations = { yolo: true, httpHandler: false };
    const additionalExtraInformations = { httpHandler: true };
    const newInitializer = extra(
      baseExtraInformations,
      extra(additionalExtraInformations, aProviderInitializer),
      true,
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.EXTRA]).not.toBe(baseExtraInformations);
    expect(newInitializer[SPECIAL_PROPS.EXTRA]).not.toEqual(
      additionalExtraInformations,
    );
    expect(newInitializer[SPECIAL_PROPS.EXTRA]).toEqual({
      ...additionalExtraInformations,
      ...baseExtraInformations,
    });
  });
});

describe('type', () => {
  test('should allow to decorate an initializer with a type', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseName = 'hash';
    const baseType = 'service';
    const newInitializer = inject(
      dependencies,
      name(baseName, type(baseType, aProviderInitializer)),
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
    expect(newInitializer[SPECIAL_PROPS.NAME]).toEqual(baseName);
    expect(newInitializer[SPECIAL_PROPS.TYPE]).toEqual(baseType);
  });
});

describe('initializer', () => {
  test('should allow to decorate an initializer with every properties', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseName = 'hash';
    const baseType = 'service';
    const newInitializer = initializer(
      {
        type: baseType,
        inject: dependencies,
        singleton: true,
        name: baseName,
      },
      aServiceInitializer,
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
    expect(newInitializer[SPECIAL_PROPS.SINGLETON]).toEqual(true);
    expect(newInitializer[SPECIAL_PROPS.NAME]).toEqual(baseName);
    expect(newInitializer[SPECIAL_PROPS.TYPE]).toEqual(baseType);
  });

  test('should fail with bad properties', () => {
    try {
      initializer(
        {
          name: 'yolo',
          yolo: '',
        } as any,
        async () => undefined,
      );
      throw new YError('E_UNEXPECTED_SUCCESS');
    } catch (err) {
      expect((err as YError).code).toEqual('E_BAD_PROPERTY');
    }
  });
});

describe('constant', () => {
  test('should allow to create an initializer from a constant', async () => {
    const baseName = 'THE_VALUE';
    const baseValue = 42;
    const constantInitializer = constant(baseName, baseValue);

    expect(constantInitializer[SPECIAL_PROPS.NAME]).toEqual(baseName);
    expect(constantInitializer[SPECIAL_PROPS.TYPE]).toEqual('constant');
    expect(constantInitializer[SPECIAL_PROPS.VALUE]).toEqual(baseValue);
  });

  test('should fail with dependencies since it makes no sense', () => {
    try {
      constant(
        'time',
        inject(['hash3'], async () => undefined),
      );
      throw new YError('E_UNEXPECTED_SUCCESS');
    } catch (err) {
      expect((err as YError).code).toEqual('E_CONSTANT_INJECTION');
    }
  });
});

describe('service', () => {
  test('should allow to create an initializer from a service builder', async () => {
    const aServiceBuilder = async (_services: unknown) => 'A_SERVICE';
    const dependencies = ['ANOTHER_ENV>ENV'];
    const extraData = { cool: true };
    const baseName = 'hash';
    const baseType = 'service';
    const newInitializer = service(
      aServiceBuilder,
      baseName,
      dependencies,
      true,
      extraData,
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
    expect(newInitializer[SPECIAL_PROPS.SINGLETON]).toEqual(true);
    expect(newInitializer[SPECIAL_PROPS.EXTRA]).toEqual(extraData);
    expect(newInitializer[SPECIAL_PROPS.NAME]).toEqual(baseName);
    expect(newInitializer[SPECIAL_PROPS.TYPE]).toEqual(baseType);
  });

  test('should allow to create an initializer from a generic service builder', async () => {
    const aServiceBuilder = async <T>(_services: T) => '';
    const dependencies = ['ANOTHER_ENV>ENV'];
    const extraData = { nice: true };
    const baseName = 'hash';
    const baseType = 'service';
    const newInitializer = service(
      aServiceBuilder,
      baseName,
      dependencies,
      true,
      extraData,
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
    expect(newInitializer[SPECIAL_PROPS.SINGLETON]).toEqual(true);
    expect(newInitializer[SPECIAL_PROPS.EXTRA]).toEqual(extraData);
    expect(newInitializer[SPECIAL_PROPS.NAME]).toEqual(baseName);
    expect(newInitializer[SPECIAL_PROPS.TYPE]).toEqual(baseType);
  });

  test('should fail with no service builder', () => {
    try {
      service(undefined as any);
      throw new YError('E_UNEXPECTED_SUCCESS');
    } catch (err) {
      expect((err as YError).code).toEqual('E_NO_SERVICE_BUILDER');
    }
  });
});

describe('autoService', () => {
  test('should detect the service details', () => {
    const baseServiceBuilder = async function initializeMySQL({ ENV }) {
      return ENV;
    };
    const newInitializer = autoService(baseServiceBuilder);

    expect(newInitializer).not.toEqual(baseServiceBuilder);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(['ENV']);
    expect(newInitializer[SPECIAL_PROPS.NAME]).toEqual('mySQL');
    expect(newInitializer[SPECIAL_PROPS.TYPE]).toEqual('service');
  });

  test('should detect the service details even with no dependencies', () => {
    const baseServiceBuilder = async function initializeMySQL() {
      return;
    };
    const newInitializer = autoService(baseServiceBuilder);

    expect(newInitializer).not.toEqual(baseServiceBuilder);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual([]);
    expect(newInitializer[SPECIAL_PROPS.NAME]).toEqual('mySQL');
    expect(newInitializer[SPECIAL_PROPS.TYPE]).toEqual('service');
  });
});

describe('provider', () => {
  test('should allow to create an initializer from a provider builder', async () => {
    const aProviderInitializerBuilder = async () => ({ service: 'A_SERVICE' });
    const dependencies = ['ANOTHER_ENV>ENV'];
    const extraData = { singleton: true };
    const baseName = 'hash';
    const baseType = 'provider';
    const newInitializer = provider(
      aProviderInitializerBuilder,
      baseName,
      dependencies,
      true,
      extraData,
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
    expect(newInitializer[SPECIAL_PROPS.SINGLETON]).toEqual(true);
    expect(newInitializer[SPECIAL_PROPS.EXTRA]).toEqual(extraData);
    expect(newInitializer[SPECIAL_PROPS.NAME]).toEqual(baseName);
    expect(newInitializer[SPECIAL_PROPS.TYPE]).toEqual(baseType);
  });

  test('should allow to create an initializer from a provider builder', async () => {
    const aServiceBuilder = async (_services: unknown) => ({
      service: 'A_SERVICE',
    });
    const dependencies = ['ANOTHER_ENV>ENV'];
    const extraData = { extra: true };
    const baseName = 'hash';
    const baseType = 'provider';
    const newInitializer = provider(
      name(
        baseName,
        inject(dependencies, singleton(extra(extraData, aServiceBuilder))),
      ),
    );

    expect(newInitializer).not.toEqual(aProviderInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).not.toBe(dependencies);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(dependencies);
    expect(newInitializer[SPECIAL_PROPS.SINGLETON]).toEqual(true);
    expect(newInitializer[SPECIAL_PROPS.EXTRA]).toEqual(extraData);
    expect(newInitializer[SPECIAL_PROPS.NAME]).toEqual(baseName);
    expect(newInitializer[SPECIAL_PROPS.TYPE]).toEqual(baseType);
  });

  test('should fail with no provider builder', () => {
    try {
      provider(undefined as any);
      throw new YError('E_UNEXPECTED_SUCCESS');
    } catch (err) {
      expect((err as YError).code).toEqual('E_NO_PROVIDER_BUILDER');
    }
  });
});

describe('autoProvider', () => {
  test('should detect the provider details', () => {
    const baseInitializer = async function initializeMySQL({
      ENV,
    }: {
      ENV: unknown;
    }) {
      return { service: ENV };
    };
    const newInitializer = autoProvider(baseInitializer);

    expect(newInitializer).not.toEqual(baseInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual(['ENV']);
    expect(newInitializer[SPECIAL_PROPS.NAME]).toEqual('mySQL');
    expect(newInitializer[SPECIAL_PROPS.TYPE]).toEqual('provider');
  });

  test('should detect the provider details even with no dependencies', () => {
    const baseInitializer = async function initializeMySQL() {
      return { service: 'A_SERVICE' };
    };
    const newInitializer = autoProvider(baseInitializer);

    expect(newInitializer).not.toEqual(baseInitializer);
    expect(newInitializer[SPECIAL_PROPS.INJECT]).toEqual([]);
    expect(newInitializer[SPECIAL_PROPS.NAME]).toEqual('mySQL');
    expect(newInitializer[SPECIAL_PROPS.TYPE]).toEqual('provider');
  });
});

describe('handler', () => {
  test('should work', async () => {
    const baseName = 'sampleHandler';
    const injectedServices = ['kikooo', 'lol'];
    const services = {
      kikooo: 'kikooo',
      lol: 'lol',
    };
    const theInitializer = handler(sampleHandler, baseName, injectedServices);

    expect((theInitializer as any).$name).toEqual(baseName);
    expect((theInitializer as any).$inject).toEqual(injectedServices);

    const theHandler = await theInitializer(services);
    const result = await theHandler('test');
    expect(result).toEqual({
      deps: services,
      args: ['test'],
    });

    async function sampleHandler(deps, ...args) {
      return { deps, args };
    }
  });

  test('should fail with no name', () => {
    try {
      handler(async () => undefined);
      throw new YError('E_UNEXPECTED_SUCCESS');
    } catch (err) {
      expect((err as YError).code).toEqual('E_NO_HANDLER_NAME');
    }
  });
});

describe('autoHandler', () => {
  test('should work', async () => {
    const services = {
      kikooo: 'kikooo',
      lol: 'lol',
    };
    const theInitializer = autoHandler(sampleHandler);

    expect((theInitializer as any).$name).toEqual(sampleHandler.name);
    expect((theInitializer as any).$inject).toEqual(['kikooo', 'lol']);

    const theHandler = await theInitializer(services);
    const result = await theHandler('test');

    expect(result).toEqual({
      deps: services,
      args: ['test'],
    });

    async function sampleHandler({ kikooo, lol }, ...args) {
      return { deps: { kikooo, lol }, args };
    }
  });

  test('should work with spread services', async () => {
    const services = {
      kikooo: 'kikooo',
      lol: 'lol',
    };
    const theInitializer = autoHandler(sampleHandler);

    expect((theInitializer as any).$name).toEqual(sampleHandler.name);
    expect((theInitializer as any).$inject).toEqual(['kikooo', 'lol']);

    const theHandler = await theInitializer(services);
    const result = await theHandler('test');

    expect(result).toEqual({
      deps: services,
      args: ['test'],
    });

    async function sampleHandler({ kikooo, lol, ...services }, ...args) {
      return { deps: { kikooo, lol, ...services }, args };
    }
  });

  test('should fail for anonymous functions', () => {
    try {
      autoHandler(async () => undefined);
      throw new YError('E_UNEXPECTED_SUCCESS');
    } catch (err) {
      expect((err as YError).code).toEqual('E_AUTO_NAMING_FAILURE');
    }
  });
});

describe('parseDependencyDeclaration', () => {
  test('should work', () => {
    expect(parseDependencyDeclaration('db>pgsql')).toEqual({
      serviceName: 'db',
      mappedName: 'pgsql',
      optional: false,
    });
  });

  test('should work with unmapped names', () => {
    expect(parseDependencyDeclaration('?pgsql')).toEqual({
      serviceName: 'pgsql',
      mappedName: 'pgsql',
      optional: true,
    });
  });
});
