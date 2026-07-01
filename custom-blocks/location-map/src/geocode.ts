import type { Coordinates, GeocoderResult } from "./types";

// The game uses a fixed set of locations, so reverse geocoding is a nearest
// match against these known places. This keeps the block self-contained — no
// external geocoding API (and no cloud auth) is needed to label a guess.
const FIXTURE_PLACES = [
  { name: "Shibuya Crossing", coordinates: { lat: 35.6595, lng: 139.7004 }, country: "Japan", city: "Tokyo" },
  { name: "Taj Mahal", coordinates: { lat: 27.1751, lng: 78.0421 }, country: "India", city: "Agra" },
  { name: "Brandenburg Gate", coordinates: { lat: 52.5163, lng: 13.3777 }, country: "Germany", city: "Berlin" },
  { name: "Charles Bridge", coordinates: { lat: 50.0865, lng: 14.4114 }, country: "Czech Republic", city: "Prague" },
  { name: "East Side Gallery", coordinates: { lat: 52.5076, lng: 13.4396 }, country: "Germany", city: "Berlin" },
  { name: "Big Ben", coordinates: { lat: 51.5007, lng: -0.1246 }, country: "United Kingdom", city: "London" },
  { name: "Times Square", coordinates: { lat: 40.758, lng: -73.9855 }, country: "United States", city: "New York" },
  { name: "Christ the Redeemer", coordinates: { lat: -22.9519, lng: -43.2105 }, country: "Brazil", city: "Rio de Janeiro" },
  { name: "Anıtkabir", coordinates: { lat: 39.9254, lng: 32.8369 }, country: "Turkey", city: "Ankara" },
  { name: "Blue Mosque", coordinates: { lat: 41.0054, lng: 28.9768 }, country: "Turkey", city: "Istanbul" },
];

function haversineDistance(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Nearest known place to the given coordinates, as a geocoder-style result. */
export function reverseGeocodeFixture(coords: Coordinates): GeocoderResult {
  let nearest = FIXTURE_PLACES[0];
  let minDist = Infinity;
  for (const place of FIXTURE_PLACES) {
    const dist = haversineDistance(coords, place.coordinates);
    if (dist < minDist) {
      minDist = dist;
      nearest = place;
    }
  }
  return {
    coordinates: nearest.coordinates,
    label: `${nearest.name}, ${nearest.city}, ${nearest.country}`,
    placeId: `fixture-${nearest.name.toLowerCase().replace(/\s+/g, "-")}`,
  };
}
