import { describe, expect, test } from '@jest/globals';
import { pickOverridenName } from './overrides.js';

describe('pickOverridenName()', () => {
  describe('should not replace the non-matching services', () => {
    test('with simple maps', () => {
      expect(
        pickOverridenName(
          {
            originalService: 'overriddenService',
          },
          ['anotherService'],
        ),
      ).toMatch('anotherService');
    });
  });

  describe('should replace the matching services', () => {
    test('with simple maps', () => {
      expect(
        pickOverridenName(
          {
            originalService: 'overriddenService',
          },
          ['originalService'],
        ),
      ).toMatch('overriddenService');
    });

    test('with simple maps and some parents', () => {
      expect(
        pickOverridenName(
          {
            originalService: 'overriddenService',
          },
          [
            'parentService1',
            'parentService2',
            'parentService3',
            'parentService4',
            'originalService',
          ],
        ),
      ).toMatch('overriddenService');
    });

    test('with 1 level tree maps', () => {
      expect(
        pickOverridenName(
          {
            parentService: {
              originalService: 'overriddenService',
            },
          },
          ['parentService', 'originalService'],
        ),
      ).toMatch('overriddenService');
    });

    test('with lots of levels tree maps', () => {
      expect(
        pickOverridenName(
          {
            parentService1: {
              parentService2: {
                parentService3: {
                  parentService4: {
                    originalService: 'overriddenService',
                  },
                },
              },
            },
          },
          [
            'parentService1',
            'parentService2',
            'parentService3',
            'parentService4',
            'originalService',
          ],
        ),
      ).toMatch('overriddenService');
    });

    test('with lots of levels tree maps and partial parents path', () => {
      expect(
        pickOverridenName(
          {
            parentService3: {
              parentService4: {
                originalService: 'overriddenService',
              },
            },
          },
          [
            'parentService1',
            'parentService2',
            'parentService3',
            'parentService4',
            'originalService',
          ],
        ),
      ).toMatch('overriddenService');
    });
  });
});
