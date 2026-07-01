// src/index.mock.ts — runs during local dev, no network needed
import { Scope } from '@aws-blocks/blocks';
import type { ScopeParent } from '@aws-blocks/core';
import { getMockDataDir } from '@aws-blocks/core/bb-utils';
import type { Coordinates, GeocoderResult, MapDescriptor, LocationMapOptions } from './types.js';
import { reverseGeocodeFixture } from './geocode.js';

export class LocationMap extends Scope {
  private dataDir: string;

  constructor(scope: ScopeParent, id: string, options?: LocationMapOptions) {
    super(id, { parent: scope });
    this.dataDir = getMockDataDir(this);
  }

  async reverseGeocode(coords: Coordinates): Promise<GeocoderResult | null> {
    return reverseGeocodeFixture(coords);
  }

  async getMapDescriptor(): Promise<MapDescriptor> {
    return { offline: true };
  }
}
