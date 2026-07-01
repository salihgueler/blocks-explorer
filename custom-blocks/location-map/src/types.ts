// src/types.ts — zero runtime dependencies, types only

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationMapOptions {
  googleMapsApiKey?: string;
}

export interface GeocoderResult {
  coordinates: Coordinates;
  label: string;
  placeId: string;
}

/**
 * What the frontend needs to render the map. Local/mock returns `offline` and
 * the app falls back to the bundled SVG; the deployed runtime returns the
 * Google Maps JS API key the browser uses to load an interactive map.
 */
export type MapDescriptor =
  | { offline: true }
  | { offline: false; googleMapsApiKey: string };
