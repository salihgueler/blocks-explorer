import * as cdk from "aws-cdk-lib";

import { Hosting, BlocksStack, BlocksPresets } from "@aws-blocks/blocks/cdk";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getStackName } from "@aws-blocks/blocks/scripts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = new cdk.App();

const sandboxMode = app.node.tryGetContext("sandboxMode") === "true";
const hardDestroy = app.node.tryGetContext("hardDestroy") === "true";
const projectRoot = app.node.tryGetContext("projectRoot") || process.cwd();

// Stack identity comes from .blocks/config.json `stackId`. It is set to
// "blocks-explorer-stack" so the production stack keeps its existing name
// (blocks-explorer-stack-prod) and sandboxes keep blocks-explorer-stack-<id>.
const stackName = getStackName({ sandbox: sandboxMode, projectRoot });

// Hard destroy reuses the sandbox preset: every resource, including the
// retained DynamoDB tables, becomes deletable. Only applies when
// `npm run hard-destroy` passes `--context hardDestroy=true`; a normal
// deploy/destroy keeps the production preset's Retain policies.
export const blocksStack = await BlocksStack.create(app, stackName, {
  backendHandlerPath: join(__dirname, "index.handler.ts"),
  backendCDKPath: join(__dirname, "index.ts"),
  defaults:
    sandboxMode || hardDestroy
      ? BlocksPresets.sandbox
      : BlocksPresets.production,
});

if (sandboxMode) {
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

// The custom LocationMap block (custom-blocks/location-map/) wires itself
// during CDK synth when index.ts is imported under the `cdk` condition.
