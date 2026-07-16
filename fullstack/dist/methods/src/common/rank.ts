import type { FlightOffer, HotelOffer } from './types';
import type { User } from '../tables/users';

type Prefs = User['preferences'];

const norm = (v: number, min: number, max: number) => (max === min ? 0.5 : (v - min) / (max - min));

// Weighted score, not a model. Price and duration dominate; preferences are a
// tie-breaker/booster so "the best one" reflects this traveler.
export function rankFlights(offers: FlightOffer[], prefs?: Prefs): FlightOffer[] {
  if (offers.length <= 1) return offers.slice();
  const prices = offers.map((o) => o.priceCents);
  const durs = offers.map((o) => o.durationMin);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const minD = Math.min(...durs), maxD = Math.max(...durs);

  return offers
    .map((o) => {
      const priceScore = 1 - norm(o.priceCents, minP, maxP);
      const durScore = 1 - norm(o.durationMin, minD, maxD);
      const stopScore = o.stops === 0 ? 1 : o.stops === 1 ? 0.5 : 0.2;
      let pref = 0;
      if (prefs?.nonstopPreferred && o.stops === 0) pref += 0.15;
      const score = priceScore * 0.42 + durScore * 0.28 + stopScore * 0.2 + pref;
      return { o, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((s) => s.o);
}

export function rankHotels(offers: HotelOffer[], prefs?: Prefs): HotelOffer[] {
  if (offers.length <= 1) return offers.slice();
  const prices = offers.map((o) => o.totalCents);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const style = (prefs?.hotelStyle || '').toLowerCase();

  return offers
    .map((o) => {
      const priceScore = 1 - norm(o.totalCents, minP, maxP);
      const ratingScore = o.rating / 5;
      let pref = 0;
      if (style && (o.name.toLowerCase().includes(style) || o.neighborhood.toLowerCase().includes(style))) pref += 0.1;
      const score = priceScore * 0.4 + ratingScore * 0.5 + pref;
      return { o, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((s) => s.o);
}
