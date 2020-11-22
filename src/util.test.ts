import assert from 'assert';
import sinon from 'sinon';
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
} from './util';
import type { PromiseValue } from 'type-fest';
import type { Provider } from './util';

async function aProviderInitializer(_services: unknown) {
  return {
    service: 'A_PROVIDER_SERVICE',
  };
}
async function aServiceInitializer(_services: unknown) {
  return 'A_PROVIDER_SERVICE';
}

describe('reuseSpecialProps', () => {
  it('should work', () => {
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

    const newFn = reuseSpecialProps(from, to) as any;

    assert.notEqual(newFn, to);
    assert.equal(newFn.$name, from.$name);
    assert.equal(newFn.$type, from.$type);
    assert.notEqual(newFn.$inject, from.$inject);
    assert.deepEqual(newFn.$inject, from.$inject);
    assert.equal(newFn.$singleton, from.$singleton);
    assert.notEqual(newFn.$extra, from.$extra);
    assert.deepEqual(newFn.$extra, from.$extra);

    const newFn2 = reuseSpecialProps(from as any, to, {
      $name: 'yolo',
    }) as any;

    assert.notEqual(newFn2, to);
    assert.equal(newFn2.$name, 'yolo');
    assert.equal(newFn2.$type, from.$type);
    assert.notEqual(newFn2.$inject, from.$inject);
    assert.deepEqual(newFn2.$inject, from.$inject);
    assert.equal(newFn2.$singleton, from.$singleton);
    assert.notEqual(newFn.$extra, from.$extra);
    assert.deepEqual(newFn.$extra, from.$extra);
  });
});

describe('wrapInitializer', () => {
  it('should work with a service initializer', async () => {
    async function baseServiceInitializer() {
      return () => 'test';
    }

    const log = sinon.stub();
    const newInitializer = wrapInitializer(
      async ({ log }, service: () => string) => {
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
    assert.equal(newService(), 'test-wrapped');
    assert.deepEqual(log.args, [['Wrapping...']]);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], ['log', '?test']);
  });

  it('should work with a provider initialzer', async () => {
    async function baseInitializer() {
      return { service: () => 'test' };
    }

    const log = sinon.stub();
    const baseProviderInitializer = provider(
      baseInitializer,
      'baseInitializer',
      ['log', '?test'],
      false,
      {
        httpHandler: false,
      },
    );
    const newInitializer = wrapInitializer(async ({ log }, service): Promise<
      Provider<() => string>
    > => {
      log('Wrapping...');
      return { service: () => service.service() + '-wrapped' };
    }, baseProviderInitializer);

    const newService = await newInitializer({ log });
    assert.equal(newService.service(), 'test-wrapped');
    assert.deepEqual(log.args, [['Wrapping...']]);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], ['log', '?test']);
  });
});

describe('inject', () => {
  it('should allow to decorate an initializer with dependencies', () => {
    const dependencies = ['ENV'];
    const newInitializer = inject<{ ENV: string }, string>(
      dependencies,
      provider(aProviderInitializer, 'aProvider'),
    );

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
  });

  it('should allow to decorate an initializer builder with dependencies', () => {
    const dependencies = ['ENV'];
    const newInitializer = inject<{ ENV: string }, string>(
      dependencies,
      aProviderInitializer,
    );

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
  });

  it('should allow to decorate an initializer with dependencies', () => {
    const dependencies = ['ENV'];
    const newInitializer = inject<{ ENV: string }, string>(
      dependencies,
      service(aServiceInitializer, 'aService'),
    );

    assert.notEqual(newInitializer, aServiceInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
  });

  it('should allow to decorate an initializer builder with dependencies', () => {
    const dependencies = ['ENV'];
    const newInitializer = inject<{ ENV: string }, string>(
      dependencies,
      aServiceInitializer,
    );

    assert.notEqual(newInitializer, aServiceInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
  });

  it('should allow to decorate an initializer with mapped dependencies', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const newInitializer = inject(dependencies, aProviderInitializer);

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
  });

  it('should fail with a constant', () => {
    assert.throws(() => {
      inject(['test'], constant('test', 'test') as any);
    }, /E_BAD_INJECT_IN_CONSTANT/);
  });
});
describe('useInject', () => {
  it('should set the right dependencies', () => {
    const fromDependencies = ['ENV', 'CORS'];
    const fromInitializer = inject(fromDependencies, aProviderInitializer);
    const toDependencies = ['db', 'log'];
    const toInitializer = inject(toDependencies, aProviderInitializer);
    const newInitializer = useInject(fromInitializer, toInitializer);

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], fromDependencies);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], toDependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], [
      ...fromDependencies,
    ]);
  });
});

describe('mergeInject', () => {
  it('should amend dependencies', () => {
    const fromDependencies = ['ENV', 'CORS'];
    const fromInitializer = inject<
      {
        db: 'db';
        log: 'log';
      },
      PromiseValue<ReturnType<typeof aProviderInitializer>>
    >(fromDependencies, aProviderInitializer);
    const toDependencies = ['db', 'log'];
    const toInitializer = inject(toDependencies, aProviderInitializer);
    const newInitializer = mergeInject(fromInitializer, toInitializer);

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], fromDependencies);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], toDependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], [
      ...toDependencies,
      ...fromDependencies,
    ]);
  });
});

describe('autoInject', () => {
  it('should allow to decorate an initializer with dependencies', () => {
    const baseProvider = async ({ ENV, mysql: db }) => async () => ({
      ENV,
      db,
    });
    const dependencies = ['ENV', 'mysql'];
    const newInitializer = autoInject(baseProvider);

    assert.notEqual(newInitializer, baseProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
  });

  it('should allow to decorate an initializer with a function name', () => {
    async function baseProvider({ ENV, mysql: db }) {
      async () => ({
        ENV,
        db,
      });
    }
    const dependencies = ['ENV', 'mysql'];
    const newInitializer = autoInject(baseProvider);

    assert.notEqual(newInitializer, baseProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
  });

  it('should allow to decorate an initializer with optional dependencies', () => {
    const noop = () => undefined;
    const baseProvider = async ({
      ENV,
      log = noop,
      debug: aDebug = noop,
    }) => async () => ({
      ENV,
      log,
      aDebug,
    });
    const dependencies = ['ENV', '?log', '?debug'];
    const newInitializer = autoInject(baseProvider);

    assert.notEqual(newInitializer, baseProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
  });

  it('should allow to decorate an initializer with several arguments', () => {
    const noop = () => undefined;
    const baseProvider = async ({
      ENV,
      log = noop,
      debug: aDebug = noop,
    }) => async () => ({
      ENV,
      log,
      aDebug,
    });
    const dependencies = ['ENV', '?log', '?debug'];
    const newInitializer = autoInject(baseProvider);

    assert.notEqual(newInitializer, baseProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
  });

  it('should allow to decorate an initializer with complex arguments', () => {
    const noop = () => undefined;
    const baseProvider = async ({
      ENV,
      log = noop,
      debug: aDebug = noop,
    }) => async () => ({
      ENV,
      log,
      aDebug,
    });
    const dependencies = ['ENV', '?log', '?debug'];
    const newInitializer = autoInject(baseProvider);

    assert.notEqual(newInitializer, baseProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
  });

  it('should fail with non async initializers', () => {
    assert.throws(() => {
      autoInject((({ foo: bar = { bar: 'foo' } }) => {
        return bar;
      }) as any);
    }, /E_NON_ASYNC_INITIALIZER/);
  });

  it('should fail with too complex injections', () => {
    assert.throws(() => {
      autoInject(async ({ foo: bar = { bar: 'foo' } }) => {
        return bar;
      });
    }, /E_AUTO_INJECTION_FAILURE/);
  });

  it('should fail with no injections', () => {
    assert.throws(() => {
      autoInject(async () => undefined);
    }, /E_AUTO_INJECTION_FAILURE/);
  });
});

describe('alsoInject', () => {
  it('should allow to decorate an initializer with dependencies', () => {
    const newInitializer = alsoInject(
      ['ENV'],
      inject(['TEST'], aProviderInitializer),
    );

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], ['TEST', 'ENV']);
  });

  it('should allow to decorate an initializer with dependencies', () => {
    const newInitializer = alsoInject(['ENV'], aProviderInitializer);

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], ['ENV']);
  });

  it('should dedupe dependencies', () => {
    const baseProvider = inject(['?TEST'], aProviderInitializer);
    const newInitializer = alsoInject(
      ['ENV', '?NODE_ENV', '?TEST', 'TEST2', 'db>mysql'],
      alsoInject(['ENV', 'NODE_ENV', '?TEST', '?TEST2', 'mysql'], baseProvider),
    );

    assert.notEqual(newInitializer, baseProvider);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], [
      'mysql',
      'ENV',
      'NODE_ENV',
      '?TEST',
      'TEST2',
      'db>mysql',
    ]);
  });

  it('should preserve single optional dependencies', () => {
    const baseProvider = inject(['ENV', '?TEST'], aProviderInitializer);
    const newInitializer = alsoInject(
      ['ENV', '?TEST2'],
      alsoInject(['ENV', '?TEST3'], baseProvider),
    );

    assert.notEqual(newInitializer, baseProvider);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], [
      '?TEST',
      '?TEST3',
      'ENV',
      '?TEST2',
    ]);
  });

  it('should preserve mapped dependencies', () => {
    const baseProvider = inject(['mysql', '?sftp'], aProviderInitializer);
    const newInitializer = alsoInject(['db>mysql', '?ftp>sftp'], baseProvider);

    assert.notEqual(newInitializer, baseProvider);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], [
      'mysql',
      '?sftp',
      'db>mysql',
      '?ftp>sftp',
    ]);
  });

  it('should solve dependencies alias name clash', () => {
    const baseProvider = inject(['?TEST'], aProviderInitializer);
    const newInitializer = alsoInject(
      ['ENV', '?NODE_ENV', '?TEST', 'db>mysql', '?log>logly'],
      alsoInject(
        ['ENV', 'NODE_ENV', '?TEST', 'db>pg', '?log>logger'],
        baseProvider,
      ),
    );

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], [
      'ENV',
      'NODE_ENV',
      '?TEST',
      'db>mysql',
      '?log>logly',
    ]);
  });

  it('should solve dependencies alias name clash', () => {
    const baseProvider = inject(['?TEST'], aProviderInitializer);
    const newInitializer = alsoInject(
      ['ENV', '?NODE_ENV', '?TEST', 'db>mysql', '?log>logly'],
      alsoInject(
        ['ENV', 'NODE_ENV', '?TEST', 'db>pg', '?log>logger'],
        baseProvider,
      ),
    );

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], [
      'ENV',
      'NODE_ENV',
      '?TEST',
      'db>mysql',
      '?log>logly',
    ]);
  });
});

describe('parseInjections', () => {
  it('should work with TypeScript dependencies', () => {
    assert.deepEqual(
      parseInjections(`async function initNexmo({
      ENV,
      NEXMO,
      log = noop,
    }: {
      ENV: any;
      NEXMO: any;
      log: Function;
    }): Promise<SMSService> {}`),
      ['ENV', 'NEXMO', '?log'],
    );
  });

  it('should allow to decorate an initializer with dependencies', () => {
    const newInitializer = alsoInject(['ENV'], aProviderInitializer);

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], ['ENV']);
  });
});

describe('singleton', () => {
  it('should allow to decorate an initializer with singleton option', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const newInitializer = inject(
      dependencies,
      singleton(aProviderInitializer, true),
    );

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.equal(newInitializer[SPECIAL_PROPS.SINGLETON], true);
  });

  it('should allow to be used several times', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const newInitializer = inject(
      dependencies,
      singleton(singleton(aProviderInitializer), false),
    );

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.equal(newInitializer[SPECIAL_PROPS.SINGLETON], false);
  });
});

describe('name', () => {
  it('should allow to decorate an initializer with a name', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseName = 'hash';
    const newInitializer = inject(
      dependencies,
      name(baseName, aProviderInitializer),
    );

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
  });
});

describe('autoName', () => {
  it('should allow to decorate an initializer with its function name', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseName = 'hash';
    const newInitializer = inject(
      dependencies,
      autoName(async function hash() {
        return undefined;
      }),
    );

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
  });

  it('should allow to decorate an initializer with its init like function name', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseName = 'hash';
    const newInitializer = inject(
      dependencies,
      autoName(async function initHash() {
        return undefined;
      }),
    );

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
  });

  it('should allow to decorate an initializer with its initialize like function name', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseName = 'hash';
    const newInitializer = inject(
      dependencies,
      autoName(async function initializeHash() {
        return undefined;
      }),
    );

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
  });

  it('should allow to decorate a bounded initializer', () => {
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

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.equal(newInitializer[SPECIAL_PROPS.SINGLETON], true);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
  });

  it('should fail with anonymous functions', () => {
    assert.throws(() => {
      autoName(async () => undefined);
    }, /E_AUTO_NAMING_FAILURE/);
  });
});

describe('extra', () => {
  it('should allow to decorate an initializer with extra infos', () => {
    const extraInformations = { httpHandler: true };
    const newInitializer = extra(extraInformations, aProviderInitializer);

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.EXTRA], extraInformations);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.EXTRA], extraInformations);
  });

  it('should allow to decorate an initializer with extra infos', () => {
    const extraInformations = { httpHandler: true };
    const newInitializer = extra(extraInformations, aProviderInitializer, true);

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.EXTRA], extraInformations);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.EXTRA], extraInformations);
  });

  it('should allow to decorate an initializer with additional extra infos', () => {
    const baseExtraInformations = { yolo: true, httpHandler: false };
    const additionalExtraInformations = { httpHandler: true };
    const newInitializer = extra(
      baseExtraInformations,
      extra(additionalExtraInformations, aProviderInitializer),
      true,
    );

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.EXTRA], baseExtraInformations);
    assert.notEqual(newInitializer[SPECIAL_PROPS.EXTRA], baseExtraInformations);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.EXTRA], {
      ...baseExtraInformations,
      ...baseExtraInformations,
    });
  });
});

describe('type', () => {
  it('should allow to decorate an initializer with a type', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseName = 'hash';
    const baseType = 'service';
    const newInitializer = inject(
      dependencies,
      name(baseName, type(baseType, aProviderInitializer)),
    );

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], baseType);
  });
});

describe('initializer', () => {
  it('should allow to decorate an initializer with every properties', () => {
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

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.equal(newInitializer[SPECIAL_PROPS.SINGLETON], true);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], baseType);
  });

  it('should fail with bad properties', () => {
    assert.throws(() => {
      initializer(
        {
          name: 'yolo',
          yolo: '',
        } as any,
        async () => undefined,
      );
    }, /E_BAD_PROPERTY/);
  });
});

describe('constant', () => {
  it('should allow to create an initializer from a constant', async () => {
    const baseName = 'THE_VALUE';
    const baseValue = 42;
    const constantInitializer = constant(baseName, baseValue);

    assert.equal(constantInitializer[SPECIAL_PROPS.NAME], baseName);
    assert.equal(constantInitializer[SPECIAL_PROPS.TYPE], 'constant');
    assert.equal(constantInitializer[SPECIAL_PROPS.VALUE], baseValue);
  });

  it('should fail with dependencies since it makes no sense', () => {
    assert.throws(() => {
      constant(
        'time',
        inject(['hash3'], async () => undefined),
      );
    }, /E_CONSTANT_INJECTION/);
  });
});

describe('service', () => {
  it('should allow to create an initializer from a service builder', async () => {
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

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.equal(newInitializer[SPECIAL_PROPS.SINGLETON], true);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.EXTRA], extraData);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], baseType);
  });

  it('should allow to create an initializer from a generic service builder', async () => {
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

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.equal(newInitializer[SPECIAL_PROPS.SINGLETON], true);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.EXTRA], extraData);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], baseType);
  });

  it('should fail with no service builder', () => {
    assert.throws(() => {
      service(undefined as any);
    }, /E_NO_SERVICE_BUILDER/);
  });
});

describe('autoService', () => {
  it('should detect the service details', () => {
    const baseServiceBuilder = async function initializeMySQL({ ENV }) {
      return ENV;
    };
    const newInitializer = autoService(baseServiceBuilder);

    assert.notEqual(newInitializer, baseServiceBuilder);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], ['ENV']);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], 'mySQL');
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], 'service');
  });

  it('should detect the service details even with no dependencies', () => {
    const baseServiceBuilder = async function initializeMySQL() {
      return;
    };
    const newInitializer = autoService(baseServiceBuilder);

    assert.notEqual(newInitializer, baseServiceBuilder);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], []);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], 'mySQL');
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], 'service');
  });
});

describe('provider', () => {
  it('should allow to create an initializer from a provider builder', async () => {
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

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.equal(newInitializer[SPECIAL_PROPS.SINGLETON], true);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.EXTRA], extraData);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], baseType);
  });

  it('should allow to create an initializer from a provider builder', async () => {
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

    assert.notEqual(newInitializer, aProviderInitializer);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.equal(newInitializer[SPECIAL_PROPS.SINGLETON], true);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.EXTRA], extraData);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], baseType);
  });

  it('should fail with no provider builder', () => {
    assert.throws(() => {
      provider(undefined as any);
    }, /E_NO_PROVIDER_BUILDER/);
  });
});

describe('autoProvider', () => {
  it('should detect the provider details', () => {
    const baseInitializer = async function initializeMySQL({
      ENV,
    }: {
      ENV: unknown;
    }) {
      return { service: ENV };
    };
    const newInitializer = autoProvider(baseInitializer);

    assert.notEqual(newInitializer, baseInitializer);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], ['ENV']);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], 'mySQL');
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], 'provider');
  });

  it('should detect the provider details even with no dependencies', () => {
    const baseInitializer = async function initializeMySQL() {
      return { service: 'A_SERVICE' };
    };
    const newInitializer = autoProvider(baseInitializer);

    assert.notEqual(newInitializer, baseInitializer);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], []);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], 'mySQL');
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], 'provider');
  });
});

describe('handler', () => {
  it('should work', async () => {
    const baseName = 'sampleHandler';
    const injectedServices = ['kikooo', 'lol'];
    const services = {
      kikooo: 'kikooo',
      lol: 'lol',
    };
    const theInitializer = handler(sampleHandler, baseName, injectedServices);

    assert.deepEqual((theInitializer as any).$name, baseName);
    assert.deepEqual((theInitializer as any).$inject, injectedServices);

    const theHandler = await theInitializer(services);
    const result = await theHandler('test');
    assert.deepEqual(result, {
      deps: services,
      args: ['test'],
    });

    async function sampleHandler(deps, ...args) {
      return { deps, args };
    }
  });

  it('should fail with no name', () => {
    assert.throws(() => {
      handler(() => undefined);
    }, /E_NO_HANDLER_NAME/);
  });
});

describe('autoHandler', () => {
  it('should work', async () => {
    const services = {
      kikooo: 'kikooo',
      lol: 'lol',
    };
    const theInitializer = autoHandler(sampleHandler);

    assert.deepEqual((theInitializer as any).$name, sampleHandler.name);
    assert.deepEqual((theInitializer as any).$inject, ['kikooo', 'lol']);

    const theHandler = await theInitializer(services);
    const result = await theHandler('test');
    assert.deepEqual(result, {
      deps: services,
      args: ['test'],
    });

    async function sampleHandler({ kikooo, lol }, ...args) {
      return { deps: { kikooo, lol }, args };
    }
  });

  it('should work with spread services', async () => {
    const services = {
      kikooo: 'kikooo',
      lol: 'lol',
    };
    const theInitializer = autoHandler(sampleHandler);

    assert.deepEqual((theInitializer as any).$name, sampleHandler.name);
    assert.deepEqual((theInitializer as any).$inject, ['kikooo', 'lol']);

    const theHandler = await theInitializer(services);
    const result = await theHandler('test');
    assert.deepEqual(result, {
      deps: services,
      args: ['test'],
    });

    async function sampleHandler({ kikooo, lol, ...services }, ...args) {
      return { deps: { kikooo, lol, ...services }, args };
    }
  });

  it('should fail for anonymous functions', () => {
    assert.throws(() => {
      autoHandler(() => undefined);
    }, /E_AUTO_NAMING_FAILURE/);
  });
});

describe('parseDependencyDeclaration', () => {
  it('should work', () => {
    assert.deepEqual(parseDependencyDeclaration('db>pgsql'), {
      serviceName: 'db',
      mappedName: 'pgsql',
      optional: false,
    });
  });

  it('should work with unmapped names', () => {
    assert.deepEqual(parseDependencyDeclaration('?pgsql'), {
      serviceName: 'pgsql',
      mappedName: 'pgsql',
      optional: true,
    });
  });
});
