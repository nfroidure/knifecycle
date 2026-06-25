import { describe, expect, test } from '@jest/globals';
import { pickOverriddenName } from './overrides.js';

describe('pickOverriddenName()', () => {
  describe('should not replace the non-matching services', () => {
    test('with simple maps', () => {
      expect(
        pickOverriddenName(
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
        pickOverriddenName(
          {
            originalService: 'overriddenService',
          },
          ['originalService'],
        ),
      ).toMatch('overriddenService');
    });

    test('with simple maps and some parents', () => {
      expect(
        pickOverriddenName(
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
        pickOverriddenName(
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
        pickOverriddenName(
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
        pickOverriddenName(
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
