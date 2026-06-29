import { createLambdaHandler } from "@aws-blocks/blocks/lambda-handler";

// createLambdaHandler expects a lazy factory so Blocks can load env config
// from S3 before the backend module is imported (see its JSDoc).
export const handler = createLambdaHandler(() => import("./index.js"));
