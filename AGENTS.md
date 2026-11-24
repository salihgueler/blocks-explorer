# Agent Guide

## Quick Reference

- **Backend:** `cdk-blocks/index.ts` — APIs, auth, data models
- **Frontend:** `src/` — imports backend APIs via `import { api } from 'cdk-blocks'`
- **Full guide:** `node_modules/aws-cdk-blocks/README.md` — architecture, workflow, best practices, common mistakes
- **Block catalog + decision tree:** `node_modules/aws-cdk-blocks/docs/README.md`
- **Per-block docs:** `node_modules/aws-cdk-blocks/docs/<package-name>/`

## Workflow

1. Make changes to backend (`cdk-blocks/index.ts`) or frontend (`src/`)
2. Verify with `npm run dev` (browser at http://localhost:3000) and `npm run build` for a type-check
3. Do NOT use curl/fetch against the API unless troubleshooting connectivity

## Rules

- **Use Building Blocks** for all persistence and cloud abstractions — never local files, in-memory arrays, or local databases.
- **Read block docs** at `node_modules/aws-cdk-blocks/docs/<package-name>/` before using a block.
- **The JSON-RPC transport is invisible** — do not construct RPC payloads manually. Import and call the typed API directly.

## Deploying (requires AWS credentials)

- `npm run sandbox` — deploy backend to AWS, serve frontend locally
- `npm run deploy` — full production deploy to AWS
- `npm run sandbox:destroy` — tear down sandbox resources
