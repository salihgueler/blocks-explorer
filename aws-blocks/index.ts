/**
 * BlocksExplorer — Game Backend
 *
 * A geography guessing game built with AWS Blocks.
 *
 * Players complete fixed-length SESSIONS of 5 rounds. The correct answers for
 * every round are generated up front and stored server-side — they are never
 * sent to the client until a round has been guessed. The leaderboard tracks
 * each player's single best session ("X points in Y guesses").
 *
 * Uses AuthBasic + DistributedTable (no Realtime needed).
 */

import {
  Scope,
  ApiNamespace,
  DistributedTable,
  DistributedTableErrors,
  AuthBasic,
  isBlocksError,
} from "@aws-blocks/blocks";
import { z } from "zod";
import { LocationMap } from "@blocks-explorer/location-map";

const scope = new Scope("be");
const maps = new LocationMap(scope, "maps");

const ROUNDS_PER_SESSION = 5;
const MAX_SCORE = 5000;

// ─── Auth ─────────────────────────────────────────────────────────────────────
const auth = new AuthBasic(scope, "auth", {
  sessionDuration: 86400 * 7,
  passwordPolicy: { minLength: 6 },
});

// ─── Data: Sessions (answers held server-side) ──────────────────────────────────
const roundSchema = z.object({
  locationId: z.string(),
  imageUrl: z.string(),
  hint: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  // Answer — never leaked to the client until the round is guessed.
  lat: z.number(),
  lng: z.number(),
  country: z.string(),
  city: z.string(),
  // Filled in once the player guesses this round.
  guessLat: z.number().optional(),
  guessLng: z.number().optional(),
  score: z.number().optional(),
  distanceKm: z.number().optional(),
});

const sessionSchema = z.object({
  sessionId: z.string(),
  username: z.string(),
  rounds: z.array(roundSchema),
  currentRound: z.number(), // 0-indexed pointer to the next round to guess
  accumulatedScore: z.number(),
  guessesMade: z.number(),
  status: z.enum(["active", "completed"]),
  createdAt: z.number(),
});

type SessionRound = z.infer<typeof roundSchema>;
type GameSession = z.infer<typeof sessionSchema>;

const sessions = new DistributedTable(scope, "sessions", {
  schema: sessionSchema,
  key: { partitionKey: "sessionId" },
});

// ─── Data: Leaderboard (best session per user) ──────────────────────────────────
const leaderboardSchema = z.object({
  pk: z.string(), // GLOBAL
  sk: z.string(), // USER#<username>
  username: z.string(),
  points: z.number(),
  guesses: z.number(),
  achievedAt: z.number(),
});

const leaderboard = new DistributedTable(scope, "lb", {
  schema: leaderboardSchema,
  key: { partitionKey: "pk", sortKey: "sk" },
});

// ─── Game Locations ───────────────────────────────────────────────────────────
const GAME_LOCATIONS = [
  {
    id: "r01",
    lat: 35.6595,
    lng: 139.7004,
    country: "Japan",
    city: "Tokyo",
    difficulty: "medium" as const,
    imageUrl: "/images/01_shibuya_crossing.jpg",
    hint: "World's busiest pedestrian crossing",
  },
  {
    id: "r02",
    lat: 27.1751,
    lng: 78.0421,
    country: "India",
    city: "Agra",
    difficulty: "easy" as const,
    imageUrl: "/images/02_taj_mahal.jpg",
    hint: "White marble mausoleum",
  },
  {
    id: "r03",
    lat: 52.5163,
    lng: 13.3777,
    country: "Germany",
    city: "Berlin",
    difficulty: "medium" as const,
    imageUrl: "/images/03_brandenburg_gate.jpg",
    hint: "Neoclassical gate with quadriga",
  },
  {
    id: "r04",
    lat: 50.0865,
    lng: 14.4114,
    country: "Czech Republic",
    city: "Prague",
    difficulty: "medium" as const,
    imageUrl: "/images/04_charles_bridge.jpg",
    hint: "Medieval stone bridge with 30 statues",
  },
  {
    id: "r05",
    lat: 52.5076,
    lng: 13.4396,
    country: "Germany",
    city: "Berlin",
    difficulty: "hard" as const,
    imageUrl: "/images/05_east_side_gallery.jpg",
    hint: "Longest remaining section of the Wall",
  },
  {
    id: "r06",
    lat: 51.5007,
    lng: -0.1246,
    country: "United Kingdom",
    city: "London",
    difficulty: "easy" as const,
    imageUrl: "/images/06_big_ben.jpg",
    hint: "Iconic clock tower by the Thames",
  },
  {
    id: "r07",
    lat: 40.758,
    lng: -73.9855,
    country: "United States",
    city: "New York",
    difficulty: "easy" as const,
    imageUrl: "/images/07_times_square.jpg",
    hint: "Neon billboards and Broadway",
  },
  {
    id: "r08",
    lat: -22.9519,
    lng: -43.2105,
    country: "Brazil",
    city: "Rio de Janeiro",
    difficulty: "easy" as const,
    imageUrl: "/images/08_christ_redeemer.jpg",
    hint: "Arms wide open above the city",
  },
  {
    id: "r09",
    lat: 39.9254,
    lng: 32.8369,
    country: "Turkey",
    city: "Ankara",
    difficulty: "hard" as const,
    imageUrl: "/images/09_anitkabir.jpg",
    hint: "Mausoleum of the republic's founder",
  },
  {
    id: "r10",
    lat: 41.0054,
    lng: 28.9768,
    country: "Turkey",
    city: "Istanbul",
    difficulty: "medium" as const,
    imageUrl: "/images/10_blue_mosque.jpg",
    hint: "Six minarets and blue İznik tiles",
  },
];

// ─── Scoring ──────────────────────────────────────────────────────────────────
function calculateScore(distanceKm: number): number {
  if (distanceKm < 0.05) return MAX_SCORE;
  if (distanceKm > 5000) return 0;
  return Math.round(MAX_SCORE * Math.exp(-distanceKm / 1500));
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Session helpers ────────────────────────────────────────────────────────────
/** Pick ROUNDS_PER_SESSION distinct locations in random order (Fisher–Yates). */
function pickSessionRounds(): SessionRound[] {
  const pool = [...GAME_LOCATIONS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, ROUNDS_PER_SESSION).map((loc) => ({
    locationId: loc.id,
    imageUrl: loc.imageUrl,
    hint: loc.hint,
    difficulty: loc.difficulty,
    lat: loc.lat,
    lng: loc.lng,
    country: loc.country,
    city: loc.city,
  }));
}

/** The client-safe view of a round — no answer coordinates or place names. */
function toPublicRound(round: SessionRound, index: number) {
  return {
    roundNumber: index + 1,
    totalRounds: ROUNDS_PER_SESSION,
    imageUrl: round.imageUrl,
    hint: round.hint,
    difficulty: round.difficulty,
  };
}

function toProgress(session: GameSession) {
  return {
    currentRound: Math.min(session.currentRound + 1, ROUNDS_PER_SESSION),
    totalRounds: ROUNDS_PER_SESSION,
    accumulatedScore: session.accumulatedScore,
    guessesMade: session.guessesMade,
  };
}

/**
 * Upsert the player's leaderboard row only when this session beats their
 * current best. Ties keep the earlier session (so ranking tiebreaks by
 * earliest achievedAt). Returns whether a new best was recorded.
 */
async function recordBestSession(session: GameSession): Promise<boolean> {
  const sk = `USER#${session.username}`;
  const existing = await leaderboard.get({ pk: "GLOBAL", sk });
  if (existing && existing.points >= session.accumulatedScore) return false;

  await leaderboard.put({
    pk: "GLOBAL",
    sk,
    username: session.username,
    points: session.accumulatedScore,
    guesses: session.guessesMade,
    achievedAt: Date.now(),
  });
  return true;
}

// ─── API ──────────────────────────────────────────────────────────────────────
export const authApi = auth.createApi();

export const api = new ApiNamespace(scope, "api", (context) => ({
  /** Returns map configuration — offline SVG for local dev, Google Maps key for deployed. */
  async getMapConfig() {
    const descriptor = await maps.getMapDescriptor();
    return {
      isOffline: descriptor.offline,
      googleMapsApiKey: descriptor.offline ? null : descriptor.googleMapsApiKey,
      attribution: descriptor.offline ? "Offline SVG Map" : "© Google",
    };
  },

  /**
   * Start a fresh 5-round session. Generates the rounds (with answers) and
   * stores them server-side. Returns only the first round's public view.
   */
  async startSession() {
    const user = await auth.requireAuth(context);

    const rounds = pickSessionRounds();
    const session: GameSession = {
      sessionId: crypto.randomUUID(),
      username: user.username,
      rounds,
      currentRound: 0,
      accumulatedScore: 0,
      guessesMade: 0,
      status: "active",
      createdAt: Date.now(),
    };

    await sessions.put(session, { ifNotExists: true });

    return {
      sessionId: session.sessionId,
      round: toPublicRound(rounds[0], 0),
      progress: toProgress(session),
    };
  },

  /**
   * Submit a guess for the current round of a session. Scores the round,
   * accumulates the total, advances the pointer, and auto-completes the
   * session after the final round. A double-submit is rejected via an
   * optimistic-lock condition on the round pointer.
   */
  async submitGuess(sessionId: string, guessLat: number, guessLng: number) {
    const user = await auth.requireAuth(context);

    const session = await sessions.get({ sessionId });
    if (!session) throw new Error("Session not found");
    if (session.username !== user.username)
      throw new Error("This session belongs to another player");
    if (session.status !== "active")
      throw new Error("This session is already complete");

    const index = session.currentRound;
    const round = session.rounds[index];
    if (!round) throw new Error("No active round to guess");

    const distanceKm = haversineDistance(
      guessLat,
      guessLng,
      round.lat,
      round.lng,
    );
    const score = calculateScore(distanceKm);
    const roundedDistance = Math.round(distanceKm * 10) / 10;

    const isLastRound = index === ROUNDS_PER_SESSION - 1;

    // Build the next state immutably. The local mock's get() returns the stored
    // item by reference, so mutating `session`/`round` in place would corrupt
    // the very value the ifFieldEquals optimistic-lock check reads below (and it
    // would also diverge from real DynamoDB, where get() returns a fresh copy).
    const updatedRound: SessionRound = {
      ...round,
      guessLat,
      guessLng,
      score,
      distanceKm: roundedDistance,
    };
    const updatedSession: GameSession = {
      ...session,
      rounds: session.rounds.map((r, i) => (i === index ? updatedRound : r)),
      accumulatedScore: session.accumulatedScore + score,
      guessesMade: session.guessesMade + 1,
      currentRound: index + 1,
      status: isLastRound ? "completed" : session.status,
    };

    // Optimistic lock: only commit if the stored pointer is still at `index`.
    // A concurrent / duplicate submit will have already advanced it.
    try {
      await sessions.put(updatedSession, {
        ifFieldEquals: { currentRound: index },
      });
    } catch (e) {
      if (isBlocksError(e, DistributedTableErrors.ConditionalCheckFailed)) {
        throw new Error("That round was already submitted");
      }
      throw e;
    }

    const placeInfo = await maps.reverseGeocode({
      lat: round.lat,
      lng: round.lng,
    });
    const actual = {
      lat: round.lat,
      lng: round.lng,
      country: round.country,
      city: round.city,
      label: placeInfo?.label ?? `${round.city}, ${round.country}`,
    };

    const result = {
      score,
      distanceKm: roundedDistance,
      actual,
      maxScore: MAX_SCORE,
      progress: toProgress(updatedSession),
      completed: isLastRound,
    };

    if (!isLastRound) {
      return {
        ...result,
        nextRound: toPublicRound(updatedSession.rounds[index + 1], index + 1),
      };
    }

    const newBest = await recordBestSession(updatedSession);
    return {
      ...result,
      finalScore: updatedSession.accumulatedScore,
      totalGuesses: updatedSession.guessesMade,
      newBest,
    };
  },

  /** Ranked leaderboard of each player's best session: most points first, earliest wins ties. */
  async getLeaderboard() {
    const rows: Array<{
      username: string;
      points: number;
      guesses: number;
      achievedAt: number;
    }> = [];

    for await (const entry of leaderboard.query({
      where: { pk: { equals: "GLOBAL" } },
    })) {
      rows.push({
        username: entry.username,
        points: entry.points,
        guesses: entry.guesses,
        achievedAt: entry.achievedAt,
      });
    }

    rows.sort((a, b) => b.points - a.points || a.achievedAt - b.achievedAt);

    return {
      leaderboard: rows.slice(0, 20).map(({ username, points, guesses }) => ({
        username,
        points,
        guesses,
      })),
    };
  },
}));
