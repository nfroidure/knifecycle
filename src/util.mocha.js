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
  options,
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

function aProvider() {}

describe('reuseSpecialProps', () => {
  it('should work', () => {
    // We can safely ignore coverage here since the
    // function are here just as placeholders
    /* istanbul ignore next */
    function from() {
      return 'from';
    }
    /* istanbul ignore next */
    function to() {
      return 'to';
    }

    from.$name = 'from';
    from.$type = 'service';
    from.$inject = ['ki', 'kooo', 'lol'];
    from.$options = { singleton: false };
    from.$extra = { httpHandler: true };

    const newFn = reuseSpecialProps(from, to);

    assert.notEqual(newFn, to);
    assert.equal(newFn.$name, from.$name);
    assert.equal(newFn.$type, from.$type);
    assert.notEqual(newFn.$inject, from.$inject);
    assert.deepEqual(newFn.$inject, from.$inject);
    assert.notEqual(newFn.$options, from.$options);
    assert.deepEqual(newFn.$options, from.$options);
    assert.notEqual(newFn.$extra, from.$extra);
    assert.deepEqual(newFn.$extra, from.$extra);

    const newFn2 = reuseSpecialProps(from, to, {
      $name: 'yolo',
    });

    assert.notEqual(newFn2, to);
    assert.equal(newFn2.$name, 'yolo');
    assert.equal(newFn2.$type, from.$type);
    assert.notEqual(newFn2.$inject, from.$inject);
    assert.deepEqual(newFn2.$inject, from.$inject);
    assert.notEqual(newFn2.$options, from.$options);
    assert.deepEqual(newFn2.$options, from.$options);
    assert.notEqual(newFn.$extra, from.$extra);
    assert.deepEqual(newFn.$extra, from.$extra);
  });
});

describe('wrapInitializer', () => {
  it('should work', async () => {
    function baseInitializer() {
      return Promise.resolve(() => 'test');
    }

    baseInitializer.$name = 'baseInitializer';
    baseInitializer.$type = 'service';
    baseInitializer.$inject = ['log'];
    baseInitializer.$options = { singleton: false };
    baseInitializer.$extra = { httpHandler: false };

    const log = sinon.stub();
    const newInitializer = wrapInitializer(({ log }, service) => {
      log('Wrapping...');
      return () => service() + '-wrapped';
    }, baseInitializer);

    const service = await newInitializer({ log });
    assert.equal(service(), 'test-wrapped');
    assert.deepEqual(log.args, [['Wrapping...']]);
  });
});

describe('inject', () => {
  it('should allow to decorate an initializer with dependencies', () => {
    const dependencies = ['ENV'];
    const newInitializer = inject(dependencies, aProvider);

    assert.notEqual(newInitializer, aProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
  });

  it('should allow to decorate an initializer with mapped dependencies', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const newInitializer = inject(dependencies, aProvider);

    assert.notEqual(newInitializer, aProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
  });

  it('should fail with a constant', () => {
    assert.throws(() => {
      inject(['test'], constant('test', 'test'));
    }, /E_BAD_INJECT_IN_CONSTANT/);
  });
});
describe('useInject', () => {
  it('should set the right dependencies', () => {
    const fromDependencies = ['ENV', 'CORS'];
    const fromInitializer = inject(fromDependencies, aProvider);
    const toDependencies = ['db', 'log'];
    const toInitializer = inject(toDependencies, aProvider);
    const newInitializer = useInject(fromInitializer, toInitializer);

    assert.notEqual(newInitializer, aProvider);
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
    const fromInitializer = inject(fromDependencies, aProvider);
    const toDependencies = ['db', 'log'];
    const toInitializer = inject(toDependencies, aProvider);
    const newInitializer = mergeInject(fromInitializer, toInitializer);

    assert.notEqual(newInitializer, aProvider);
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
    const noop = () => {};
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
    const noop = () => {};
    const baseProvider = async (
      { ENV, log = noop, debug: aDebug = noop },
      { userId },
    ) => async () => ({
      ENV,
      log,
      aDebug,
      userId,
    });
    const dependencies = ['ENV', '?log', '?debug'];
    const newInitializer = autoInject(baseProvider);

    assert.notEqual(newInitializer, baseProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
  });

  it('should allow to decorate an initializer with complex arguments', () => {
    const noop = () => {};
    const baseProvider = async (
      { ENV, log = noop, debug: aDebug = noop },
      { userId, currentTime = Date.now() },
    ) => async () => ({
      ENV,
      log,
      aDebug,
      userId,
      currentTime,
    });
    const dependencies = ['ENV', '?log', '?debug'];
    const newInitializer = autoInject(baseProvider);

    assert.notEqual(newInitializer, baseProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
  });

  it('should fail with non async initializers', () => {
    assert.throws(() => {
      autoInject(({ foo: bar = { bar: 'foo' } }) => {
        return bar;
      });
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
      autoInject(async () => {});
    }, /E_AUTO_INJECTION_FAILURE/);
  });
});

describe('alsoInject', () => {
  it('should allow to decorate an initializer with dependencies', () => {
    const newInitializer = alsoInject(['ENV'], inject(['TEST'], aProvider));

    assert.notEqual(newInitializer, aProvider);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], ['TEST', 'ENV']);
  });

  it('should allow to decorate an initializer with dependencies', () => {
    const newInitializer = alsoInject(['ENV'], aProvider);

    assert.notEqual(newInitializer, aProvider);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], ['ENV']);
  });

  it('should dedupe dependencies', () => {
    const baseProvider = inject(['?TEST'], aProvider);
    const newInitializer = alsoInject(
      ['ENV', '?NODE_ENV', '?TEST', 'TEST2', 'mysql>db'],
      alsoInject(['ENV', 'NODE_ENV', '?TEST', '?TEST2', 'mysql'], baseProvider),
    );

    assert.notEqual(newInitializer, baseProvider);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], [
      'mysql',
      'ENV',
      'NODE_ENV',
      '?TEST',
      'TEST2',
      'mysql>db',
    ]);
  });

  it('should solve final dependencies name clash', () => {
    const baseProvider = inject(['?TEST'], aProvider);
    const newInitializer = alsoInject(
      ['ENV', '?NODE_ENV', '?TEST', 'mysql>db', 'log'],
      alsoInject(
        ['ENV', 'NODE_ENV', '?TEST', 'db', 'logger>log'],
        baseProvider,
      ),
    );

    assert.notEqual(newInitializer, aProvider);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], [
      'ENV',
      'NODE_ENV',
      '?TEST',
      'mysql>db',
      'log',
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
    const newInitializer = alsoInject(['ENV'], aProvider);

    assert.notEqual(newInitializer, aProvider);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], ['ENV']);
  });
});

describe('options', () => {
  it('should allow to decorate an initializer with options', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseOptions = { singleton: true };
    const newInitializer = inject(
      dependencies,
      options(baseOptions, aProvider, false),
    );

    assert.notEqual(newInitializer, aProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.notEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
  });

  it('should allow to decorate an initializer with options', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const rootOptions = { yolo: true, singleton: false };
    const baseOptions = { singleton: true };
    const newInitializer = inject(
      dependencies,
      options(baseOptions, options(rootOptions, aProvider), true),
    );

    assert.notEqual(newInitializer, aProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.notEqual(newInitializer[SPECIAL_PROPS.OPTIONS], rootOptions);
    assert.notEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.OPTIONS], {
      ...rootOptions,
      ...baseOptions,
    });
  });
});

describe('name', () => {
  it('should allow to decorate an initializer with a name', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseOptions = { singleton: true };
    const baseName = 'hash';
    const newInitializer = inject(
      dependencies,
      options(baseOptions, name(baseName, aProvider)),
    );

    assert.notEqual(newInitializer, aProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.notEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
  });
});

describe('autoName', () => {
  it('should allow to decorate an initializer with its function name', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseOptions = { singleton: true };
    const baseName = 'hash';
    const newInitializer = inject(
      dependencies,
      options(
        baseOptions,
        autoName(async function hash() {}),
      ),
    );

    assert.notEqual(newInitializer, aProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.notEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
  });

  it('should allow to decorate an initializer with its init like function name', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseOptions = { singleton: true };
    const baseName = 'hash';
    const newInitializer = inject(
      dependencies,
      options(
        baseOptions,
        autoName(async function initHash() {}),
      ),
    );

    assert.notEqual(newInitializer, aProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.notEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
  });

  it('should allow to decorate an initializer with its initialize like function name', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseOptions = { singleton: true };
    const baseName = 'hash';
    const newInitializer = inject(
      dependencies,
      options(
        baseOptions,
        autoName(async function initializeHash() {}),
      ),
    );

    assert.notEqual(newInitializer, aProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.notEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
  });

  it('should allow to decorate a bounded initializer', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseOptions = { singleton: true };
    const baseName = 'hash';
    const newInitializer = autoName(
      inject(
        dependencies,
        options(baseOptions, async function initializeHash() {}),
      ),
    );

    assert.notEqual(newInitializer, aProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.notEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
  });

  it('should fail with anonymous functions', () => {
    assert.throws(() => {
      autoName(async () => {});
    }, /E_AUTO_NAMING_FAILURE/);
  });
});

describe('extra', () => {
  it('should allow to decorate an initializer with extra infos', () => {
    const extraInformations = { httpHandler: true };
    const newInitializer = extra(extraInformations, aProvider);

    assert.notEqual(newInitializer, aProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.EXTRA], extraInformations);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.EXTRA], extraInformations);
  });

  it('should allow to decorate an initializer with extra infos', () => {
    const extraInformations = { httpHandler: true };
    const newInitializer = extra(extraInformations, aProvider, true);

    assert.notEqual(newInitializer, aProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.EXTRA], extraInformations);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.EXTRA], extraInformations);
  });

  it('should allow to decorate an initializer with additional extra infos', () => {
    const baseExtraInformations = { yolo: true, httpHandler: false };
    const additionalExtraInformations = { httpHandler: true };
    const newInitializer = extra(
      baseExtraInformations,
      extra(additionalExtraInformations, aProvider),
      true,
    );

    assert.notEqual(newInitializer, aProvider);
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
    const baseOptions = { singleton: true };
    const baseName = 'hash';
    const baseType = 'service';
    const newInitializer = inject(
      dependencies,
      options(baseOptions, name(baseName, type(baseType, aProvider))),
    );

    assert.notEqual(newInitializer, aProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.notEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], baseType);
  });
});

describe('initializer', () => {
  it('should allow to decorate an initializer with every properties', () => {
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseOptions = { singleton: true };
    const baseName = 'hash';
    const baseType = 'service';
    const newInitializer = initializer(
      {
        inject: dependencies,
        options: baseOptions,
        type: baseType,
        name: baseName,
      },
      aProvider,
    );

    assert.notEqual(newInitializer, aProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.notEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], baseType);
  });

  it('should fail with bad properties', () => {
    assert.throws(() => {
      initializer(
        {
          name: 'yolo',
          yolo: '',
        },
        async () => {},
      );
    }, /E_BAD_PROPERTY/);
  });
});

describe('constant', () => {
  it('should allow to create an initializer from a constant', async () => {
    const baseValue = 'THE_VALUE';
    const baseName = 42;
    const newInitializer = constant(baseName, baseValue);

    assert.notEqual(newInitializer, aProvider);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], []);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.OPTIONS], {
      singleton: true,
    });
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], 'constant');
    assert.equal(newInitializer[SPECIAL_PROPS.VALUE], baseValue);
    assert.equal(await newInitializer(), baseValue);
  });

  it('should fail with dependencies since it makes no sense', () => {
    assert.throws(() => {
      constant(
        'time',
        inject(['hash3'], async () => {}),
      );
    }, /E_CONSTANT_INJECTION/);
  });
});

describe('service', () => {
  it('should allow to create an initializer from a service builder', async () => {
    const aServiceBuilder = async () => {};
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseOptions = { singleton: true };
    const baseName = 'hash';
    const baseType = 'service';
    const newInitializer = service(
      aServiceBuilder,
      baseName,
      dependencies,
      baseOptions,
    );

    assert.notEqual(newInitializer, aProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.notEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], baseType);
  });

  it('should allow to create an initializer from a service builder', async () => {
    const aServiceBuilder = async () => {};
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseOptions = { singleton: true };
    const baseName = 'hash';
    const baseType = 'service';
    const newInitializer = service(
      name(
        baseName,
        inject(dependencies, options(baseOptions, aServiceBuilder)),
      ),
    );

    assert.notEqual(newInitializer, aProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.notEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], baseType);
  });

  it('should fail with no service builder', () => {
    assert.throws(() => {
      service();
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
    const aServiceBuilder = async () => {};
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseOptions = { singleton: true };
    const baseName = 'hash';
    const baseType = 'provider';
    const newInitializer = provider(
      aServiceBuilder,
      baseName,
      dependencies,
      baseOptions,
    );

    assert.notEqual(newInitializer, aProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.notEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], baseType);
  });

  it('should allow to create an initializer from a provider builder', async () => {
    const aServiceBuilder = async () => {};
    const dependencies = ['ANOTHER_ENV>ENV'];
    const baseOptions = { singleton: true };
    const baseName = 'hash';
    const baseType = 'provider';
    const newInitializer = provider(
      name(
        baseName,
        inject(dependencies, options(baseOptions, aServiceBuilder)),
      ),
    );

    assert.notEqual(newInitializer, aProvider);
    assert.notEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], dependencies);
    assert.notEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.OPTIONS], baseOptions);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], baseName);
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], baseType);
  });

  it('should fail with no provider builder', () => {
    assert.throws(() => {
      provider();
    }, /E_NO_PROVIDER_BUILDER/);
  });
});

describe('autoProvider', () => {
  it('should detect the provider details', () => {
    const baseInitializer = async function initializeMySQL({ ENV }) {
      return ENV;
    };
    const newInitializer = autoProvider(baseInitializer);

    assert.notEqual(newInitializer, baseInitializer);
    assert.deepEqual(newInitializer[SPECIAL_PROPS.INJECT], ['ENV']);
    assert.equal(newInitializer[SPECIAL_PROPS.NAME], 'mySQL');
    assert.equal(newInitializer[SPECIAL_PROPS.TYPE], 'provider');
  });

  it('should detect the provider details even with no dependencies', () => {
    const baseInitializer = async function initializeMySQL() {
      return;
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

    assert.deepEqual(theInitializer.$name, baseName);
    assert.deepEqual(theInitializer.$inject, injectedServices);

    const theHandler = await theInitializer(services);
    const result = await theHandler('test');
    assert.deepEqual(result, {
      deps: services,
      args: ['test'],
    });

    function sampleHandler(deps, ...args) {
      return Promise.resolve({ deps, args });
    }
  });

  it('should fail with no name', () => {
    assert.throws(() => {
      handler(() => {});
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

    assert.deepEqual(theInitializer.$name, sampleHandler.name);
    assert.deepEqual(theInitializer.$inject, ['kikooo', 'lol']);

    const theHandler = await theInitializer(services);
    const result = await theHandler('test');
    assert.deepEqual(result, {
      deps: services,
      args: ['test'],
    });

    async function sampleHandler({ kikooo, lol }, ...args) {
      return Promise.resolve({ deps: { kikooo, lol }, args });
    }
  });

  it('should work with spread services', async () => {
    const services = {
      kikooo: 'kikooo',
      lol: 'lol',
    };
    const theInitializer = autoHandler(sampleHandler);

    assert.deepEqual(theInitializer.$name, sampleHandler.name);
    assert.deepEqual(theInitializer.$inject, ['kikooo', 'lol']);

    const theHandler = await theInitializer(services);
    const result = await theHandler('test');
    assert.deepEqual(result, {
      deps: services,
      args: ['test'],
    });

    async function sampleHandler({ kikooo, lol, ...services }, ...args) {
      return Promise.resolve({ deps: { kikooo, lol, ...services }, args });
    }
  });

  it('should fail for anonymous functions', () => {
    assert.throws(() => {
      autoHandler(() => {});
    }, /E_AUTO_NAMING_FAILURE/);
  });
});

describe('parseDependencyDeclaration', () => {
  it('should work', () => {
    assert.deepEqual(parseDependencyDeclaration('pgsql>db'), {
      serviceName: 'pgsql',
      mappedName: 'db',
      optional: false,
    });
  });
});
