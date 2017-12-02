import assert from 'assert';

import Knifecycle from './index';
import $ from './instance';

describe('Knifecycle instance module', () => {
  it('should provide the singleton instance', () => {
    assert.equal($, Knifecycle.getInstance());
  });
});
