# BlocksExplorer

A geography guessing game built with AWS Blocks. Sign in, then play a session of
five rounds: guess where each photo was taken by dropping a pin on the map. The
closer your guess, the more points you score. Each player's best session is ranked
on the leaderboard.

## Getting Started

```bash
npm run dev          # Backend + React frontend (concurrent)
npm run build        # Type-check + production build
npm run sandbox      # Deploy backend to AWS, serve frontend locally
```

Open http://localhost:3000 after `npm run dev`.

## How It Works

- A **session** is a fixed run of 5 rounds (`ROUNDS_PER_SESSION`). Starting a session
  generates all five locations up front and stores their answers server-side — the
  client only ever receives the photo, hint, and difficulty for the current round.
- Each guess is scored 0–5000 from the great-circle distance to the true location.
  The session keeps a running total.
- The session auto-completes after the final round, returning the final score and
  total guess count.
- The **leaderboard** keeps each player's single best session, ranked by points
  (earliest session wins ties) and shown as "X points in Y guesses".

## Project Structure

| Path                          | Purpose                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `aws-blocks/index.ts`         | Backend: auth, session + leaderboard data models, game API     |
| `src/App.tsx`                 | Frontend: session game UI, map, and leaderboard                |
| `src/main.tsx`                | React entry point                                              |
| `custom-blocks/location-map/` | Custom Building Block: interactive map for dropping guess pins |
| `public/images/`              | Round photos the game asks players to locate                   |

## API

Methods are called via the typed client (`import { api } from 'aws-blocks'`); the
JSON-RPC transport is generated and intentionally invisible.

| Method                             | Description                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startSession()`                   | Begins a 5-round session. Returns `{ sessionId, round, progress }`, where `round` is the public view (round number, image, hint, difficulty) with no answer. Requires auth.                                                                                                                                |
| `submitGuess(sessionId, lat, lng)` | Scores the current round, advances the session, and auto-completes after the last round. Returns `score`, `distanceKm`, the revealed `actual` location, and updated `progress`; non-final rounds include `nextRound`, the final round includes `finalScore`, `totalGuesses`, and `newBest`. Requires auth. |
| `getLeaderboard()`                 | Returns `{ leaderboard: [{ username, points, guesses }] }` — each player's best session, ranked by points then earliest.                                                                                                                                                                                   |

## What's Included

- **AuthBasic** — sign up / sign in / sign out with JWT sessions
- **DistributedTable** — two tables: game sessions (with server-side answers) and the leaderboard, validated with Zod schemas
- **location-map** — a custom Building Block (`custom-blocks/location-map/`) that renders the interactive map for dropping guess pins, mocking locally and deploying to AWS like any other block
- **Server-authoritative scoring** — answers never reach the client until a round is guessed
- **Optimistic locking** — `ifFieldEquals` on the round pointer rejects duplicate or concurrent guess submissions

## Commands

| Command                | Description                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `npm run dev`          | Backend + React dev server (port 3000)                                                  |
| `npm run typecheck`    | TypeScript type checking                                                                |
| `npm run build`        | Type-check + production build                                                           |
| `npm run sandbox`      | Deploy backend to AWS, serve frontend locally                                           |
| `npm run deploy`       | Full production deploy                                                                   |
| `npm run destroy`      | Tear down the production stack, retaining DynamoDB data                                 |
| `npm run hard-destroy` | Destroy the production stack **including** all DynamoDB tables (irreversible data loss) |

## For Agents

Full Building Block documentation: `node_modules/@aws-blocks/blocks/README.md`. The
block catalog and per-block docs live under `node_modules/@aws-blocks/blocks/docs/`.

**Do not use local files or in-memory storage** — use Building Blocks for all data
persistence and cloud abstractions (they mock locally to `.bb-data/` and deploy to
AWS automatically).

Start in `aws-blocks/index.ts` (backend) and `src/App.tsx` (frontend). The API
transport (JSON-RPC) is auto-generated and intentionally invisible — import and call
the typed `api`/`authApi` directly instead of curling endpoints. Verify changes by
running `npm run dev` and playing through the app, plus `npm run build` for a
type-check.
