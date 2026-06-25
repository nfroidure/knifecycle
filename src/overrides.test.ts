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

    test('with a nested map and a `__self` override', () => {
      expect(
        pickOverriddenName(
          {
            originalService: {
              __self: 'overriddenService',
              dependencyService: 'overriddenDependencyService',
            },
          },
          ['originalService'],
        ),
      ).toMatch('overriddenService');
    });

    test('with a nested map and a `__self` override on parent path', () => {
      expect(
        pickOverriddenName(
          {
            parentService: {
              originalService: {
                __self: 'overriddenService',
                dependencyService: 'overriddenDependencyService',
              },
            },
          },
          ['parentService', 'originalService'],
        ),
      ).toMatch('overriddenService');
    });

    test('with dependencies of a nested `__self` override', () => {
      expect(
        pickOverriddenName(
          {
            sendApplicationMessage: {
              __self: 'sendSlackMessage',
              SLACK_CONFIG: 'SLACK_APPLICATION_CONFIG',
            },
          },
          ['sendMessage', 'sendSlackMessage', 'SLACK_CONFIG'],
        ),
      ).toMatch('SLACK_APPLICATION_CONFIG');
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
