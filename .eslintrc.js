module.exports = {
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module',
    modules: true,
    ecmaFeatures: {
      experimentalObjectRestSpread: true,
    },
  },
  env: {
    es6: true,
    node: true,
    jest: true,
    mocha: true,
  },
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': 'error',
  },
};
