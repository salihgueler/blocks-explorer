// src/index.aws.ts — runs in Lambda (aws-runtime condition)
import { Scope } from '@aws-blocks/core';
import type { ScopeParent } from '@aws-blocks/core';
import type { Coordinates, GeocoderResult, MapDescriptor, LocationMapOptions } from './types.js';
import { reverseGeocodeFixture } from './geocode.js';

export class LocationMap extends Scope {
  constructor(scope: ScopeParent, id: string, private options?: LocationMapOptions) {
    super(id, { parent: scope });
  }

  async reverseGeocode(coords: Coordinates): Promise<GeocoderResult | null> {
    return reverseGeocodeFixture(coords);
  }

  async getMapDescriptor(): Promise<MapDescriptor> {
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleMapsApiKey) {
      return { offline: true };
    }
    return { offline: false, googleMapsApiKey };
  }
}
