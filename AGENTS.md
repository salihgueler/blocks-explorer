# Agent Guide

## Quick Reference

- **Backend:** `aws-blocks/index.ts` — APIs, auth, data models
- **Frontend:** `src/` — imports backend APIs via `import { api } from 'aws-blocks'`
- **Full guide:** `node_modules/@aws-blocks/blocks/README.md` — architecture, workflow, best practices, common mistakes
- **Block catalog + decision tree:** `node_modules/@aws-blocks/blocks/docs/index.md`
- **Per-block docs:** `node_modules/@aws-blocks/blocks/docs/<package-name>.md`

## Workflow

1. Make changes to backend (`aws-blocks/index.ts`) or frontend (`src/`)
2. Verify with `npm run dev` (browser at http://localhost:3000) and `npm run build` for a type-check
3. Do NOT use curl/fetch against the API unless troubleshooting connectivity

## Rules

- **Use Building Blocks** for all persistence and cloud abstractions — never local files, in-memory arrays, or local databases.
- **Read block docs** at `node_modules/@aws-blocks/blocks/docs/<package-name>.md` before using a block.
- **The JSON-RPC transport is invisible** — do not construct RPC payloads manually. Import and call the typed API directly.

## Deploying (requires AWS credentials)

- `npm run sandbox` — deploy backend to AWS, serve frontend locally
- `npm run deploy` — full production deploy to AWS
- `npm run sandbox:destroy` — tear down sandbox resources
