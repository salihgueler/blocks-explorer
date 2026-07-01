import { Construct } from "constructs";
import type { Function as LambdaFunction } from "aws-cdk-lib/aws-lambda";

// The backend module (aws-blocks/index.ts) is imported during CDK synth under
// the `cdk` condition and instantiates `new LocationMap()` at module load. Only
// construction happens during synth — no methods are called and this instance
// is never deployed (the Lambda bundles `aws.ts` via `--conditions=aws-runtime`,
// and local dev uses the `default`/`mock.ts` export). Re-export the lightweight
// mock so the module loads cleanly during synthesis.
export { LocationMap } from "./mock";

export interface LocationMapCdkProps {
  /**
   * Google Maps JavaScript API key, sourced from `.env.production` at deploy
   * time (never committed). It's a public, referrer-restricted client key, so
   * it's surfaced to the browser via `getMapConfig`. When empty the deployed
   * runtime falls back to the offline SVG map.
   */
  googleMapsApiKey?: string;
}

/**
 * CDK side of the LocationMap block. Google Maps is an external provider, so
 * there's no AWS map resource to provision — this construct's job is to wire
 * the provider key into the backend Lambda's environment. Call
 * {@link configureBackend} after creating the stack's handler.
 */
export class LocationMapCdk extends Construct {
  private readonly googleMapsApiKey: string;

  constructor(scope: Construct, id: string, props?: LocationMapCdkProps) {
    super(scope, id);
    this.googleMapsApiKey = props?.googleMapsApiKey ?? "";
  }

  /** Inject the Google Maps API key the deployed runtime (`aws.ts`) reads. */
  configureBackend(handler: LambdaFunction): void {
    handler.addEnvironment("GOOGLE_MAPS_API_KEY", this.googleMapsApiKey);
  }
}
