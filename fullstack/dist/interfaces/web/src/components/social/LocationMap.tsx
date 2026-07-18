import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useStore } from '../../lib/store';
import { api } from '../../lib/api';
import { IconMapPin, IconMaximize, IconMinimize, IconSparkles } from '../icons';
import type { TrendingPlace } from '../../lib/types';

// Leaflet's default marker icon references relative image URLs baked into
// its own CSS/JS, which break once bundled — the standard fix is to clear
// the built-in resolver and point it at the bundler-resolved asset URLs.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const CATEGORY_COLOR: Record<TrendingPlace['category'], string> = {
  restaurant: '#e5484d',
  cafe: '#a2673f',
  attraction: '#3b82f6',
  shop: '#8b5cf6',
  activity: '#ff7a2e',
};

const CATEGORY_EMOJI: Record<TrendingPlace['category'], string> = {
  restaurant: '🍽️',
  cafe: '☕',
  attraction: '⭐',
  shop: '🛍️',
  activity: '🎯',
};

// A proper teardrop map pin (the classic "circle with a point" shape, via
// the standard CSS trick: a square rotated 45° with three rounded corners),
// not a flat dot — big enough to actually spot on the map, with a category
// emoji riding upright inside it (counter-rotated so it doesn't tilt).
function placeDivIcon(category: TrendingPlace['category']) {
  const color = CATEGORY_COLOR[category] ?? CATEGORY_COLOR.activity;
  const emoji = CATEGORY_EMOJI[category] ?? '📍';
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:34px;height:34px">
        <div style="
          position:absolute;inset:0;
          background:${color};
          border:2.5px solid #fff;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 3px 8px rgba(0,0,0,.4);
        "></div>
        <div style="
          position:absolute;top:2px;left:0;width:34px;height:34px;
          display:flex;align-items:center;justify-content:center;
          font-size:16px;line-height:1;
        ">${emoji}</div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 32],
    popupAnchor: [0, -30],
  });
}

const CATEGORY_LABEL: Record<TrendingPlace['category'], string> = {
  restaurant: 'Restaurant',
  cafe: 'Cafe',
  attraction: 'Attraction',
  shop: 'Shop',
  activity: 'Activity',
};

function popupHtml(p: TrendingPlace) {
  const color = CATEGORY_COLOR[p.category] ?? CATEGORY_COLOR.activity;
  return `
    <div style="min-width:200px;max-width:240px">
      <span style="display:inline-flex;align-items:center;gap:5px;font-family:var(--font-system);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;color:${color};margin-bottom:6px">
        <span style="width:7px;height:7px;border-radius:50%;background:${color};display:inline-block"></span>
        ${CATEGORY_LABEL[p.category] ?? 'Place'}
      </span>
      <div style="font-family:var(--font-display,var(--font-system));font-size:15px;font-weight:600;color:var(--text);margin-bottom:4px;line-height:1.25">
        ${p.name}
      </div>
      ${p.blurb ? `<div style="font-family:var(--font-system);font-size:13px;line-height:1.45;color:var(--text-2)">${p.blurb}</div>` : ''}
    </div>
  `;
}

// Straight-line distance in miles — good enough for "is this actually near
// the traveler," which is all we use it for.
function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Safety-net filter, not the primary mechanism — the backend now scopes
// recommendations to a real geographic grid cell (~6-9 miles across, see
// gridKeyFor in getTrendingPlaces.ts) rather than a city-name label, so this
// mainly guards against a rare Nominatim mismatch, not city sprawl.
const NEARBY_RADIUS_MILES = 10;

// Mirrors the backend's own grid step (getTrendingPlaces.ts) so the
// "have I already asked about this spot" check is keyed the same way the
// server buckets things — the same physical spot always matches, even if
// the reported city label flips between calls (e.g. "Lake Mary" vs
// "Orlando" for the same coordinates).
const GRID_STEP = 0.1;
function gridKeyFor(lat: number, lng: number): string {
  return `${(Math.round(lat / GRID_STEP) * GRID_STEP).toFixed(1)},${(Math.round(lng / GRID_STEP) * GRID_STEP).toFixed(1)}`;
}

// How often to quietly re-check the current cell while the map stays open,
// so genuinely new discoveries (from other travelers passing through) can
// appear without a full page reload. Nearly free on the server — almost
// every one of these lands on the cache, not a fresh scan.
const RECHECK_INTERVAL_MS = 3 * 60 * 1000;

export function LocationMap() {
  const location = useStore((s) => s.profile?.location);
  const scanning = useStore((s) => s.placesScanning);
  const setScanning = useStore((s) => s.setPlacesScanning);
  const showPlacesUpdate = useStore((s) => s.showPlacesUpdate);
  const [fullscreen, setFullscreen] = useState(false);
  const [places, setPlaces] = useState<TrendingPlace[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const placesCountRef = useRef(0);

  const cityKey = location?.lat != null && location?.lng != null ? gridKeyFor(location.lat, location.lng) : null;

  // Create the map once we have coordinates; re-center if location changes.
  useEffect(() => {
    if (!location?.lat || !location?.lng || !containerRef.current) return;
    if (!mapRef.current) {
      const map = L.map(containerRef.current).setView([location.lat, location.lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      L.marker([location.lat, location.lng])
        .addTo(map)
        .bindPopup(
          `<div style="font-family:var(--font-display,var(--font-system));font-size:14px;font-weight:600;color:var(--text)">You are here</div>`,
          { className: 'wp-popup' },
        );
      mapRef.current = map;
    } else {
      mapRef.current.setView([location.lat, location.lng], mapRef.current.getZoom());
    }
  }, [location?.lat, location?.lng]);

  // Ask Waypoint to scout the area — a fresh scan the first time we've seen
  // this exact spot, a light "anything new?" pass on repeat visits (handled
  // server-side by getTrendingPlaces itself, which also scans faster the
  // more often a cell gets visited). Repeats on a timer while the map stays
  // open, and always leaves the mascot with something to say afterward —
  // "found N new spots" or "that's everything so far" — so the check never
  // just happens silently.
  useEffect(() => {
    if (location?.lat == null || location?.lng == null) return;
    const lat = location.lat;
    const lng = location.lng;
    const city = location.city;
    const region = location.region;
    const country = location.country;

    const check = () => {
      setScanning(true);
      api
        .getTrendingPlaces({ city, region, country, lat, lng })
        .then((res) => {
          setPlaces(res.places);
          const newCount = res.places.length - placesCountRef.current;
          placesCountRef.current = res.places.length;
          if (res.freshlyScanned && newCount > 0) {
            showPlacesUpdate(`Found ${newCount} new spot${newCount === 1 ? '' : 's'} near you!`);
          } else {
            showPlacesUpdate("That's everything I've found so far near you.");
          }
        })
        .catch((err) => console.error('[trending] getTrendingPlaces failed', err))
        .finally(() => setScanning(false));
    };

    check();
    const id = window.setInterval(check, RECHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [cityKey, location?.city, location?.region, location?.country, location?.lat, location?.lng]);

  // Only show places actually near the traveler's real coordinates — a
  // shared "city" cache can hold spots from all over a sprawling metro area.
  const nearbyPlaces =
    location?.lat && location?.lng
      ? places.filter((p) => milesBetween(location.lat!, location.lng!, p.lat, p.lng) <= NEARBY_RADIUS_MILES)
      : places;

  // Redraw place markers whenever the list changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = nearbyPlaces.map((p) => {
      const marker = L.marker([p.lat, p.lng], { icon: placeDivIcon(p.category) }).addTo(map);
      marker.bindPopup(popupHtml(p), { className: 'wp-popup' });
      return marker;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearbyPlaces]);

  // The container just changed size (fullscreen toggled) — Leaflet caches
  // its measured size, so it needs to be told to re-measure after the CSS
  // layout settles.
  useEffect(() => {
    const id = setTimeout(() => mapRef.current?.invalidateSize(), 250);
    return () => clearTimeout(id);
  }, [fullscreen]);

  if (!location?.lat || !location?.lng) {
    return (
      <div className="mt-4 rounded-2xl border border-[var(--border-warm)] p-5" style={{ background: 'var(--surface)' }}>
        <div className="mb-2 flex items-center gap-2">
          <IconMapPin size={18} style={{ color: 'var(--live)' }} />
          <span className="font-display text-sm font-semibold text-[var(--text)]">Your location</span>
        </div>
        <p className="font-space text-xs text-[var(--text-3)]">Turn on location access to see yourself on the map.</p>
      </div>
    );
  }

  const label = [location.city, location.region, location.country].filter(Boolean).join(', ') || 'Your location';

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 flex flex-col'
          : 'mt-4 flex flex-col overflow-hidden rounded-2xl border border-[var(--border-warm)]'
      }
      style={{ background: 'var(--surface)', zIndex: fullscreen ? 999000 : undefined }}
    >
      {/* One header row in both modes — label left, loud toggle button
          right. Previously the fullscreen exit button floated separately
          over the map and visually collided with this same label bar. */}
      <div
        className={`relative z-10 flex items-center justify-between gap-3 ${fullscreen ? 'px-5 py-4' : 'px-5 py-3'}`}
        style={{ background: 'var(--surface)' }}
      >
        <span className="font-display flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-[var(--text)]">
          <IconMapPin size={18} style={{ color: 'var(--live)' }} />
          <span className="truncate">{label}</span>
        </span>
        {fullscreen ? (
          <button className="map-toggle-btn shrink-0" onClick={() => setFullscreen(false)} aria-label="Exit fullscreen map">
            <IconMinimize size={18} />
            <span>Exit fullscreen</span>
          </button>
        ) : (
          <button className="map-toggle-btn shrink-0" onClick={() => setFullscreen(true)} aria-label="Expand map to fullscreen">
            <IconMaximize size={16} />
            <span>Fullscreen</span>
          </button>
        )}
      </div>
      <div ref={containerRef} className={fullscreen ? 'relative z-0 flex-1' : 'relative z-0 h-56 w-full'} />
      {scanning ? (
        <div className="font-space flex items-center gap-1.5 border-t border-[var(--border-warm)] px-4 py-2 text-xs text-[var(--text-3)]">
          <IconSparkles size={13} style={{ color: 'var(--live)' }} />
          Scouting recommended spots near you…
        </div>
      ) : (
        nearbyPlaces.length === 0 && (
          <div className="font-space border-t border-[var(--border-warm)] px-4 py-2 text-xs text-[var(--text-3)]">
            No standout recommendations found within {NEARBY_RADIUS_MILES} miles yet.
          </div>
        )
      )}
    </div>
  );
}
