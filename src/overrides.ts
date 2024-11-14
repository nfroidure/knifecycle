/**
 * A tree map to match service names to
 * their overridden values at run/build time
 */
export type Overrides = { [key: string]: Overrides | string };

export const OVERRIDES = '$overrides';

export function pickOverridenName(
  overrides: Overrides,
  servicesNames: [...string[], string],
) {
  const servicesDepth = servicesNames.length;

  for (let i = 0; i < servicesDepth; i++) {
    let currentDepth = i;
    let currentOverrides = overrides;

    while (currentDepth < servicesDepth) {
      const candidateOverride = currentOverrides[servicesNames[currentDepth]];

      if (typeof candidateOverride === 'string') {
        if (currentDepth === servicesDepth - 1) {
          return candidateOverride;
        }
      } else if (candidateOverride) {
        currentOverrides = candidateOverride;
      } else {
        break;
      }
      currentDepth++;
    }
  }

  return servicesNames[servicesDepth - 1];
}
