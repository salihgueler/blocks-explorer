import * as cdk from "aws-cdk-lib";
import { RemovalPolicies, Mixins } from "aws-cdk-lib";

import {
  Hosting,
  BlocksStack,
  SandboxDisableDeletionProtection,
} from "@aws-blocks/blocks/cdk";
import { LocationMapCdk } from "@blocks-explorer/location-map/cdk";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getSandboxId } from "./scripts/sandbox-id.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = new cdk.App();

const sandboxMode = app.node.tryGetContext("sandboxMode") === "true";
const hardDestroy = app.node.tryGetContext("hardDestroy") === "true";
const projectRoot = app.node.tryGetContext("projectRoot") || process.cwd();

const stackName = sandboxMode
  ? `blocks-explorer-stack-${getSandboxId(projectRoot)}`
  : "blocks-explorer-stack-prod";
export const blocksStack = await BlocksStack.create(app, stackName, {
  backendHandlerPath: join(__dirname, "index.handler.ts"),
  backendCDKPath: join(__dirname, "index.ts"),
});

if (sandboxMode) {
  // Make all resources deletable so sandbox:destroy can clean up the entire stack.
  // This overrides removal policies and deletion protection (e.g. RDS) for every
  // resource in the stack, including any you add below.
  // Remove these lines if you want to manage teardown behavior yourself.
  RemovalPolicies.of(blocksStack).destroy();
  Mixins.of(blocksStack).apply(new SandboxDisableDeletionProtection());

  // Tell the runtime that cookies need cross-domain attributes (frontend on
  // localhost, API on API Gateway — different registrable domains).
  blocksStack.handler.addEnvironment("BLOCKS_SANDBOX", "true");
}

// Add static site hosting only when deploying (not in sandbox mode)
if (!sandboxMode) {
  new Hosting(blocksStack, "Hosting", {
    root: join(__dirname, ".."),
    buildCommand: "npm run build",
    buildOutputDir: "dist",
    api: blocksStack,
  });
}

// Wire the custom LocationMap block into the backend Lambda. Google Maps is an
// external provider (no AWS map resource to provision), so the block's CDK
// construct just forwards the Google Maps API key — read from the environment,
// which `npm run deploy` loads from `.env.production` (never committed). Local
// dev needs no key; it uses the offline SVG map.
const locationMap = new LocationMapCdk(blocksStack, "LocationMap", {
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
});
locationMap.configureBackend(blocksStack.handler);

// Hard destroy: force every production resource — including retained data
// stores like the DynamoDB tables — to be deletable so `npm run hard-destroy`
// can tear the whole stack down. Only takes effect when explicitly requested
// via `--context hardDestroy=true`; the normal deploy/destroy keep the
// data-protecting Retain policies intact.
if (hardDestroy) {
  RemovalPolicies.of(blocksStack).destroy();
  Mixins.of(blocksStack).apply(new SandboxDisableDeletionProtection());
}
