// src/index.cdk.ts — runs during CDK synth
import { Scope, registerConfig, synthGuard } from '@aws-cdk-blocks/core/cdk';
import type { ScopeParent } from '@aws-cdk-blocks/core';
import type { LocationMapOptions } from './types.js';

// Re-export types for consumers
export type { Coordinates, GeocoderResult, MapDescriptor, LocationMapOptions } from './types.js';

export class LocationMap extends Scope {
  constructor(scope: ScopeParent, id: string, options?: LocationMapOptions) {
    super(id, { parent: scope });

    // Register the Google Maps API key as Blocks config. Every compute loads
    // it into process.env at cold start (registerConfig replaced
    // `this.handler.addEnvironment` in 0.8.0), so the aws-runtime layer still
    // reads it via process.env.GOOGLE_MAPS_API_KEY.
    registerConfig(
      this,
      'GOOGLE_MAPS_API_KEY',
      options?.googleMapsApiKey ?? process.env.GOOGLE_MAPS_API_KEY ?? ''
    );
  }

  // Runtime methods are NOT available during CDK synth.
  // synthGuard() throws a clear error if called at synth time.
  reverseGeocode(..._args: unknown[]): never { return synthGuard('LocationMap', 'reverseGeocode'); }
  getMapDescriptor(): never { return synthGuard('LocationMap', 'getMapDescriptor'); }
}
