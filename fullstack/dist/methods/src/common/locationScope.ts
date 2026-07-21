// Shared by listNearbyUsers and listFeed — both narrow "stuff near me" by
// the caller's saved location under a city/region/country scope.

export interface ScopedLocation {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
}

// Different geocoders phrase the same country differently ("United States"
// vs "United States of America"), so plain string equality on the display
// name silently splits people in the same country into two "countries."
// Prefer the ISO code both sides agree on when it's present; only fall back
// to the display-name string for older rows saved before countryCode existed.
export function sameCountry(a: ScopedLocation, b: ScopedLocation): boolean {
  if (a.countryCode && b.countryCode) return a.countryCode === b.countryCode;
  return !!a.country && a.country === b.country;
}

export function matchesScope(a: ScopedLocation, b: ScopedLocation, scope: 'city' | 'region' | 'country'): boolean {
  if (scope === 'country') return sameCountry(a, b);
  if (scope === 'region') return sameCountry(a, b) && a.region === b.region && !!b.region;
  return sameCountry(a, b) && a.region === b.region && a.city === b.city && !!b.city;
}
