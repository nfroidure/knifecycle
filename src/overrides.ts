/**
 * A tree map to match service names to
 * their overridden values at run/build time
 */
export interface Overrides {
  [key: string]: Overrides | string | undefined;
  __self?: string;
}

export function pickOverriddenName(
  overrides: Overrides,
  servicesNames: [...string[], string],
) {
  const servicesDepth = servicesNames.length;

  for (let i = 0; i < servicesDepth; i++) {
    let currentDepth = i;
    let currentOverrides = overrides;

    while (currentDepth < servicesDepth) {
      const candidateOverride =
        currentOverrides[servicesNames[currentDepth]] ??
        Object.values(currentOverrides).find(
          (override): override is Overrides =>
            typeof override === 'object' &&
            typeof override?.__self === 'string' &&
            override.__self === servicesNames[currentDepth],
        );

      if (typeof candidateOverride === 'string') {
        if (currentDepth === servicesDepth - 1) {
          return candidateOverride;
        }
      } else if (candidateOverride) {
        if (
          currentDepth === servicesDepth - 1 &&
          typeof candidateOverride.__self === 'string'
        ) {
          return candidateOverride.__self;
        }
        currentOverrides = candidateOverride;
      } else {
        break;
      }
      currentDepth++;
    }
  }

  return servicesNames[servicesDepth - 1];
}
