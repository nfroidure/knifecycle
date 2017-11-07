import assert from 'assert';
import {
  buildInitializationSequence,
} from './sequence';

describe('buildInitializationSequence()', () => {
  it('should work with one level trees', () => {
    const tree = {
      __name: 'lol',
    };

    assert.deepEqual(
      buildInitializationSequence(tree),
      [
        [
          'lol',
        ],
      ]
    );
  });

  it('should work with multi-level trees', () => {
    const tree = {
      __name: 'lol',
      __childNodes: [{
        __name: 'lol 1',
        __childNodes: [{
          __name: 'lol 1.1',
          __childNodes: [{
            __name: 'lol 1.1.1',
            __childNodes: [],
          }],
        }, {
          __name: 'lol 1.2',
        }],
      }, {
        __name: 'lol 2',
        __childNodes: [{
          __name: 'lol 2.1',
          __childNodes: [],
        }],
      }, {
        __name: 'lol 3',
        __childNodes: [{
          __name: 'lol 3.1',
          __childNodes: [{
            __name: 'lol 3.1.1',
            __childNodes: [],
          }],
        }],
      }],
    };

    assert.deepEqual(
      buildInitializationSequence(tree),
      [
        [
          'lol 1.1.1',
          'lol 1.2',
          'lol 2.1',
          'lol 3.1.1',
        ],
        [
          'lol 1.1',
          'lol 2',
          'lol 3.1',
        ],
        [
          'lol 1',
          'lol 3',
        ],
        [
          'lol',
        ],
      ]
    );
  });

  it('should work with multi-level trees and cross dependencies', () => {
    const tree = {
      __name: 'lol',
      __childNodes: [{
        __name: 'lol 1',
        __childNodes: [{
          __name: 'lol 1.1',
          __childNodes: [{
            __name: 'lol 1.1.1',
            __childNodes: [],
          }],
        }, {
          __name: 'lol 1.2',
        }, {
          __name: 'lol 1.3',
          __childNodes: [{
            __name: 'lol 3',
            __childNodes: [{
              __name: 'lol 3.1',
              __childNodes: [{
                __name: 'lol 2',
                __childNodes: [{
                  __name: 'lol 2.1',
                  __childNodes: [],
                }],
              }],
            }],
          }],
        }],
      }, {
        __name: 'lol 2',
        __childNodes: [{
          __name: 'lol 2.1',
          __childNodes: [],
        }],
      }, {
        __name: 'lol 3',
        __childNodes: [{
          __name: 'lol 3.1',
          __childNodes: [{
            __name: 'lol 2',
            __childNodes: [{
              __name: 'lol 2.1',
              __childNodes: [],
            }],
          }],
        }],
      }],
    };

    assert.deepEqual(
      buildInitializationSequence(tree),
      [
        [
          'lol 1.1.1',
          'lol 1.2',
          'lol 2.1',
        ],
        [
          'lol 1.1',
          'lol 2',
        ],
        [
          'lol 3.1',
        ],
        [
          'lol 3',
        ],
        [
          'lol 1.3',
        ],
        [
          'lol 1',
        ],
        [
          'lol',
        ],
      ]
    );
  });
});
