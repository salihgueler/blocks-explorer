export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationMapConfig {
  mapStyle?: string;
  indexName?: string;
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

export interface LocationMapService {
  reverseGeocode(coords: Coordinates): Promise<GeocoderResult | null>;
  getMapDescriptor(): Promise<MapDescriptor>;
}

/**
 * Type-only contract for the runtime `LocationMap` class. The package's
 * `types` export condition resolves here, so this declaration is what the
 * type-checker sees for `import { LocationMap }`. The concrete implementations
 * live in `mock.ts` (default/local) and `aws.ts` (aws-runtime/deployed); both
 * satisfy this shape. `declare` means it emits no JS and is never loaded at
 * runtime.
 */
export declare class LocationMap implements LocationMapService {
  reverseGeocode(coords: Coordinates): Promise<GeocoderResult | null>;
  getMapDescriptor(): Promise<MapDescriptor>;
}
