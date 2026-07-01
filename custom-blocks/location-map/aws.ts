import type { Coordinates, GeocoderResult, MapDescriptor } from "./types";
import { reverseGeocodeFixture } from "./geocode";

/**
 * Deployed implementation (aws-runtime export condition). The browser renders
 * an interactive Google map, so the runtime's only map job is to hand the
 * frontend the Google Maps JS API key (injected as an env var by the block's
 * CDK construct from `.env.production` — never committed). Reverse geocoding
 * uses the fixed location set, so no external geocoding API is required.
 */
export class LocationMap {
  async reverseGeocode(coords: Coordinates): Promise<GeocoderResult | null> {
    return reverseGeocodeFixture(coords);
  }

  async getMapDescriptor(): Promise<MapDescriptor> {
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleMapsApiKey) {
      // No key configured — fall back to the offline SVG rather than rendering
      // a broken Google map.
      return { offline: true };
    }
    return { offline: false, googleMapsApiKey };
  }
}
