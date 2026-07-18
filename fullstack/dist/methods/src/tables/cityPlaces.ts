import { db } from '@mindstudio-ai/agent';

export interface TrendingPlace {
  name: string;
  category: 'restaurant' | 'cafe' | 'attraction' | 'shop' | 'activity';
  blurb: string;
  lat: number;
  lng: number;
}

// One row per geographic grid cell (keyed by rounded lat/lng, NOT by city
// name — see gridKeyFor in getTrendingPlaces.ts) so the shared cache is tied
// to where people literally are, not to whatever label a geocoder happened
// to return for that spot. The same physical location always lands in the
// same cell regardless of whether it gets reverse-geocoded as "Lake Mary" or
// "Orlando" on a given call. city/region/country here are just the last
// traveler's label, kept for display — they're never part of the lookup key.
export interface CityPlaces {
  gridKey: string;
  city: string;
  region?: string;
  country?: string;
  places: TrendingPlace[];
  lastScannedAt: number;
  // How many times someone has asked about this cell — areas that see more
  // traffic get rescanned more often (see RESCAN_INTERVAL_MS in
  // getTrendingPlaces.ts), so places genuinely fill in faster the more the
  // platform's users pass through.
  visitCount: number;
}

export const CityPlaces = db.defineTable<CityPlaces>('city_places');
