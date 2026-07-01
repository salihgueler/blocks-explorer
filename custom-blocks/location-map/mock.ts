import type { Coordinates, GeocoderResult, MapDescriptor } from "./types";
import { reverseGeocodeFixture } from "./geocode";

/**
 * Local-dev implementation (default export condition). Renders the bundled
 * offline SVG world map and resolves labels from the fixed location set — no
 * network, no cloud credentials.
 */
export class LocationMap {
  async reverseGeocode(coords: Coordinates): Promise<GeocoderResult | null> {
    return reverseGeocodeFixture(coords);
  }

  getMapDescriptor(): Promise<MapDescriptor> {
    return Promise.resolve({ offline: true });
  }
}
