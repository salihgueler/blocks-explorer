import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// cross-spawn (a transitive dep, also used by the blocks scripts) resolves the
// `npx`/`cdk` `.cmd` shims on Windows and quotes args safely. It ships no type
// declarations, so load it via require and type the bits we use ourselves
// rather than pulling in an extra @types dependency.
const require = createRequire(import.meta.url);
const spawn = require("cross-spawn") as {
  sync: (
    command: string,
    args: string[],
    options: Record<string, unknown>,
  ) => { error?: Error; signal?: string | null; status: number | null };
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");

/**
 * Run a command to completion with inherited stdio and throw on failure.
 * Uses cross-spawn so the `npx`/`cdk` shims resolve on Windows too.
 */
function runSync(command: string, args: string[]): void {
  const result = spawn.sync(command, args, {
    stdio: "inherit",
    cwd: projectRoot,
    env: {
      ...process.env,
      BLOCKS_STAGE: "production",
      NODE_OPTIONS: "--conditions=cdk",
    },
  });
  if (result.error) {
    throw result.error;
  }
  if (result.signal) {
    throw new Error(`${command} was terminated by signal ${result.signal}`);
  }
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited with code ${result.status}`,
    );
  }
}

async function hardDestroy(): Promise<void> {
  console.log("💣 HARD DESTROY — production stack: blocks-explorer-stack-prod");
  console.log(
    "   This permanently deletes ALL resources, including the DynamoDB",
  );
  console.log(
    "   tables (auth users/codes, sessions, lb) that the normal destroy",
  );
  console.log("   intentionally retains. Any data in them will be lost.\n");

  // DeletionPolicy is read from the template that is currently deployed in
  // CloudFormation — `cdk destroy` does not push a new template first. So we
  // must deploy the policy change before destroying:
  //
  //   1. Deploy with hardDestroy=true so every resource (incl. the retained
  //      DynamoDB tables) flips to DeletionPolicy: Delete and deletion
  //      protection is disabled on the live stack.
  //   2. Destroy — CloudFormation now removes everything.
  console.log("1/2 🛠️  Rewriting removal policies on the live stack...");
  runSync("npx", [
    "cdk",
    "deploy",
    "--require-approval",
    "never",
    "--context",
    `projectRoot=${projectRoot}`,
    "--context",
    "hardDestroy=true",
  ]);

  console.log("\n2/2 🗑️  Destroying the stack...");
  runSync("npx", [
    "cdk",
    "destroy",
    "--force",
    "--context",
    `projectRoot=${projectRoot}`,
    "--context",
    "hardDestroy=true",
  ]);

  console.log("\n✅ Production stack hard-destroyed.");
}

hardDestroy().catch((error) => {
  console.error("\n❌ Hard destroy failed.");
  console.error(error);
  process.exit(1);
});
