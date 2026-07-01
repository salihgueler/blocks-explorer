// src/index.cdk.ts — runs during CDK synth
import { Scope, synthGuard } from '@aws-blocks/core/cdk';
import type { ScopeParent } from '@aws-blocks/core';
import type { LocationMapOptions } from './types.js';

// Re-export types for consumers
export type { Coordinates, GeocoderResult, MapDescriptor, LocationMapOptions } from './types.js';

export class LocationMap extends Scope {
  constructor(scope: ScopeParent, id: string, options?: LocationMapOptions) {
    super(id, { parent: scope });

    // Inject the Google Maps API key into the Lambda environment.
    // The aws-runtime layer reads this via process.env.GOOGLE_MAPS_API_KEY.
    this.handler.addEnvironment(
      'GOOGLE_MAPS_API_KEY',
      options?.googleMapsApiKey ?? process.env.GOOGLE_MAPS_API_KEY ?? ''
    );
  }

  // Runtime methods are NOT available during CDK synth.
  // synthGuard() throws a clear error if called at synth time.
  reverseGeocode(..._args: unknown[]): never { return synthGuard('LocationMap', 'reverseGeocode'); }
  getMapDescriptor(): never { return synthGuard('LocationMap', 'getMapDescriptor'); }
}
