'use strict';

const SAUCE_TIMEOUT = 240000;

module.exports = function buildKarmeConf(config) {
  const baseConfig = {
    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['browserify', 'mocha'],

    // list of files / patterns to load in the browser
    files: ['dist/**/*.js'],

    // list of files to exclude
    exclude: [],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'dist/**/*.js': ['browserify'],
    },

    browserify: {
      debug: false,
    },

    // web server port
    port: 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging
    logLevel: config.LOG_INFO,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity,
  };

  if (
    !process.env.SAUCE_USERNAME ||
    (process.env.TRAVIS_PULL_REQUEST &&
      'false' !== process.env.TRAVIS_PULL_REQUEST)
  ) {
    config.set(
      Object.assign({}, baseConfig, {
        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: ['progress'],

        // start these browsers
        // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
        browsers: ['Firefox'].concat(
          'true' === process.env.TRAVIS ? [] : ['Chrome'],
        ),
      }),
    );
    return;
  }

  // Browsers to run on Sauce Labs
  const customLaunchers = {
    SL_Chrome: {
      base: 'SauceLabs',
      browserName: 'chrome',
    },
    SL_Firefox: {
      base: 'SauceLabs',
      browserName: 'firefox',
    },
    SL_Opera: {
      base: 'SauceLabs',
      browserName: 'opera',
    },
    SL_IEEdge: {
      base: 'SauceLabs',
      browserName: 'microsoftedge',
      version: null,
      platform: 'Windows 10',
    },
    SL_IE10: {
      base: 'SauceLabs',
      browserName: 'internet explorer',
      version: '10',
      platform: 'Windows 2012',
    },
    SL_IE11: {
      base: 'SauceLabs',
      browserName: 'internet explorer',
      version: '11',
      platform: 'Windows 8.1',
    },
  };

  config.set(
    Object.assign({}, baseConfig, {
      reporters: ['dots', 'saucelabs'],
      customLaunchers,

      // Increase timeouts to prevent the issue with disconnected tests (https://goo.gl/nstA69)
      captureTimeout: SAUCE_TIMEOUT,
      browserDisconnectTimeout: 10000,
      browserDisconnectTolerance: 1,
      browserNoActivityTimeout: SAUCE_TIMEOUT,

      // SauceLabs config
      sauceLabs: {
        recordScreenshots: false,
        connectOptions: {
          port: 5757,
          logfile: 'sauce_connect.log',
        },
        public: 'public',
      },

      // start these browsers
      // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
      browsers: Object.keys(customLaunchers),
    }),
  );
};
