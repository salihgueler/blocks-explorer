import { useEffect, useState, useCallback, useRef } from "react";
import { api, authApi } from "aws-blocks";
import { AccountMenuBar, onAuthChange } from "@aws-blocks/blocks/ui";

// ─── Types ────────────────────────────────────────────────────────────────────
type User = { username: string; userId: string };

interface PublicRound {
  roundNumber: number;
  totalRounds: number;
  imageUrl: string;
  hint: string;
  difficulty: "easy" | "medium" | "hard";
}

interface Progress {
  currentRound: number;
  totalRounds: number;
  accumulatedScore: number;
  guessesMade: number;
}

interface Actual {
  lat: number;
  lng: number;
  country: string;
  city: string;
  label: string;
}

interface GuessResult {
  score: number;
  distanceKm: number;
  actual: Actual;
  maxScore: number;
  progress: Progress;
  completed: boolean;
  nextRound?: PublicRound;
  finalScore?: number;
  totalGuesses?: number;
  newBest?: boolean;
}

interface LeaderboardEntry {
  username: string;
  points: number;
  guesses: number;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [user, setUser] = useState<User | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (menuRef.current && !menuRef.current.hasChildNodes()) {
      menuRef.current.appendChild(AccountMenuBar(authApi));
    }
  }, []);

  useEffect(() => {
    return onAuthChange(authApi, (u) => setUser(u));
  }, []);

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: 1200,
        margin: "0 auto",
        padding: "0 20px",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 0",
          borderBottom: "1px solid #eee",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>🌍 BlocksExplorer</h1>
        <div ref={menuRef} />
      </header>
      {!user && (
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <p style={{ fontSize: "1.2rem", color: "#666" }}>
            Sign in to start playing!
          </p>
        </div>
      )}
      {user && <GameApp user={user} />}
    </div>
  );
}

// ─── Game shell ─────────────────────────────────────────────────────────────────
function GameApp({ user }: { user: User }) {
  const [view, setView] = useState<"game" | "leaderboard">("game");
  const [lbRefresh, setLbRefresh] = useState(0);

  const tabStyle = (active: boolean) => ({
    fontWeight: active ? ("bold" as const) : ("normal" as const),
    padding: "8px 16px",
    borderRadius: 6,
    border: active ? "2px solid #10b981" : "1px solid #ddd",
    background: active ? "#ecfdf5" : "white",
    cursor: "pointer",
  });

  return (
    <div>
      <nav style={{ display: "flex", gap: 8, padding: "16px 0" }}>
        <button
          onClick={() => setView("game")}
          style={tabStyle(view === "game")}
        >
          🎮 Play
        </button>
        <button
          onClick={() => setView("leaderboard")}
          style={tabStyle(view === "leaderboard")}
        >
          🏆 Leaderboard
        </button>
      </nav>
      {view === "game" && (
        <GameScreen
          onSessionComplete={() => setLbRefresh((v) => v + 1)}
          onGoToLeaderboard={() => setView("leaderboard")}
        />
      )}
      {view === "leaderboard" && (
        <Leaderboard currentUser={user.username} refreshKey={lbRefresh} />
      )}
    </div>
  );
}

// ─── GameScreen — drives a full 5-round session ─────────────────────────────────
function GameScreen({
  onSessionComplete,
  onGoToLeaderboard,
}: {
  onSessionComplete: () => void;
  onGoToLeaderboard: () => void;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [round, setRound] = useState<PublicRound | null>(null);
  const [guess, setGuess] = useState<{ lat: number; lng: number } | null>(null);
  const [result, setResult] = useState<GuessResult | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setGuess(null);
    setResult(null);
    setShowSummary(false);
    try {
      const data = await api.startSession();
      setSessionId(data.sessionId);
      setRound(data.round);
      setProgress(data.progress);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitGuess = useCallback(async () => {
    if (!sessionId || !guess || result) return; // result guard blocks double-submit
    setIsLoading(true);
    setError(null);
    try {
      const data: GuessResult = await api.submitGuess(
        sessionId,
        guess.lat,
        guess.lng,
      );
      setResult(data);
      setProgress(data.progress);
      if (data.completed) onSessionComplete();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, guess, result, onSessionComplete]);

  const advance = useCallback(() => {
    if (!result) return;
    if (result.completed) {
      setShowSummary(true);
      return;
    }
    if (result.nextRound) {
      setRound(result.nextRound);
      setGuess(null);
      setResult(null);
    }
  }, [result]);

  // ── Idle: start screen ──
  if (!sessionId || !round) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <h2 style={{ fontSize: "2rem", marginBottom: 8 }}>🌍 BlocksExplorer</h2>
        <p style={{ color: "#666", marginBottom: 24 }}>
          Five rounds. Guess each location from its photo — the closer you are,
          the more points you score.
        </p>
        {error && <p style={{ color: "#dc2626", marginBottom: 16 }}>{error}</p>}
        <button
          onClick={startSession}
          disabled={isLoading}
          style={primaryButton(!isLoading)}
        >
          {isLoading ? "Loading..." : "Start Game"}
        </button>
      </div>
    );
  }

  // ── Summary: end-of-session screen ──
  if (showSummary && result?.completed) {
    return (
      <div style={{ textAlign: "center", padding: "48px 20px" }}>
        <h2 style={{ fontSize: "1.75rem", marginBottom: 4 }}>
          Session complete! 🎉
        </h2>
        {result.newBest && (
          <div
            style={{
              display: "inline-block",
              margin: "12px 0",
              padding: "6px 14px",
              borderRadius: 999,
              background: "#fef3c7",
              color: "#92400e",
              fontWeight: 700,
            }}
          >
            ⭐ New personal best!
          </div>
        )}
        <div
          style={{
            fontSize: "3rem",
            fontWeight: 800,
            color: "#059669",
            margin: "8px 0",
          }}
        >
          {(result.finalScore ?? 0).toLocaleString()}
        </div>
        <p style={{ color: "#374151", fontSize: "1.1rem" }}>
          points in {result.totalGuesses ?? round.totalRounds} guesses
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            marginTop: 24,
          }}
        >
          <button
            onClick={startSession}
            disabled={isLoading}
            style={primaryButton(!isLoading)}
          >
            {isLoading ? "Loading..." : "Play again"}
          </button>
          <button onClick={onGoToLeaderboard} style={secondaryButton}>
            🏆 View leaderboard
          </button>
        </div>
      </div>
    );
  }

  // ── Playing: image + map ──
  const runningScore = progress?.accumulatedScore ?? 0;
  return (
    <div style={{ marginTop: 8 }}>
      <SessionHeader round={round} runningScore={runningScore} />
      {error && <p style={{ color: "#dc2626" }}>{error}</p>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginTop: 12,
        }}
      >
        {/* Left: Image */}
        <div>
          <div
            style={{
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid #e5e7eb",
              aspectRatio: "4/3",
            }}
          >
            <img
              src={round.imageUrl}
              alt="Where is this?"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <p
            style={{
              marginTop: 12,
              padding: "12px 16px",
              background: "#f9fafb",
              borderRadius: 8,
              fontSize: "0.9rem",
            }}
          >
            💡 <strong>Hint:</strong> {round.hint}
          </p>
          {result && (
            <div
              style={{
                marginTop: 12,
                padding: 16,
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: "#059669",
                  }}
                >
                  {result.score} / {result.maxScore}
                </span>
                <span style={{ color: "#666" }}>
                  {result.distanceKm < 1
                    ? `${Math.round(result.distanceKm * 1000)}m`
                    : `${result.distanceKm.toLocaleString()} km`}{" "}
                  away
                </span>
              </div>
              <p style={{ margin: "8px 0 0", color: "#374151" }}>
                📍 {result.actual.label}
              </p>
              <div
                style={{
                  marginTop: 8,
                  height: 8,
                  background: "#d1d5db",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round((result.score / result.maxScore) * 100)}%`,
                    background:
                      "linear-gradient(to right, #ef4444, #eab308, #10b981)",
                    borderRadius: 4,
                    transition: "width 0.7s ease",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Map */}
        <div>
          <MapClickInput
            onSelect={setGuess}
            guess={guess}
            actual={result?.actual || null}
            locked={!!result}
          />
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            {!result ? (
              <button
                onClick={submitGuess}
                disabled={!guess || isLoading}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 8,
                  border: "none",
                  background: guess ? "#10b981" : "#d1d5db",
                  color: "white",
                  cursor: guess ? "pointer" : "not-allowed",
                  fontWeight: 600,
                  fontSize: "1rem",
                }}
              >
                {isLoading
                  ? "Submitting..."
                  : guess
                    ? "Submit Guess"
                    : "Click the map to guess"}
              </button>
            ) : (
              <button
                onClick={advance}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 8,
                  border: "none",
                  background: "#10b981",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "1rem",
                }}
              >
                {result.completed ? "See Results →" : "Next Round →"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Session header: round progress + running score ─────────────────────────────
function SessionHeader({
  round,
  runningScore,
}: {
  round: PublicRound;
  runningScore: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        background: "#f9fafb",
        borderRadius: 8,
        border: "1px solid #eee",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <strong style={{ fontSize: "1.05rem" }}>
          Round {round.roundNumber} of {round.totalRounds}
        </strong>
        <span style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: round.totalRounds }, (_, i) => (
            <span
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: i < round.roundNumber ? "#10b981" : "#d1d5db",
              }}
            />
          ))}
        </span>
      </div>
      <span style={{ color: "#374151" }}>
        Score:{" "}
        <strong style={{ color: "#059669", fontFamily: "monospace" }}>
          {runningScore.toLocaleString()}
        </strong>
      </span>
    </div>
  );
}

// ─── Button styles ──────────────────────────────────────────────────────────────
function primaryButton(enabled: boolean) {
  return {
    padding: "12px 32px",
    fontSize: "1.1rem",
    borderRadius: 8,
    border: "none",
    background: enabled ? "#10b981" : "#9ca3af",
    color: "white",
    cursor: enabled ? "pointer" : "not-allowed",
    fontWeight: 600,
  } as const;
}
const secondaryButton = {
  padding: "12px 24px",
  fontSize: "1.1rem",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "white",
  color: "#374151",
  cursor: "pointer",
  fontWeight: 600,
} as const;

// ─── Map Input (click-to-select using Leaflet on window.L) ──────────────────────
function MapClickInput({
  onSelect,
  guess,
  actual,
  locked,
}: {
  onSelect: (coords: { lat: number; lng: number }) => void;
  guess: { lat: number; lng: number } | null;
  actual: { lat: number; lng: number } | null;
  locked: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const guessMarkerRef = useRef<any>(null);
  const actualMarkerRef = useRef<any>(null);
  const lockedRef = useRef(locked);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const map = L.map(mapRef.current).setView([20, 0], 2);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(map);

    map.on("click", (e: any) => {
      if (lockedRef.current) return;
      onSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapInstanceRef.current = map;
    return () => {
      map.stop();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update guess marker; recenter to the world view when a new round clears it.
  useEffect(() => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    if (guessMarkerRef.current) {
      guessMarkerRef.current.remove();
    }
    if (guess) {
      guessMarkerRef.current = L.marker([guess.lat, guess.lng], {
        icon: L.divIcon({
          html: "📍",
          className: "",
          iconSize: [24, 24],
          iconAnchor: [12, 24],
        }),
      }).addTo(map);
    } else if (!actual) {
      map.setView([20, 0], 2, { animate: false });
    }
  }, [guess]);

  // Update actual marker
  useEffect(() => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    if (actualMarkerRef.current) {
      actualMarkerRef.current.remove();
      actualMarkerRef.current = null;
    }
    if (actual) {
      actualMarkerRef.current = L.marker([actual.lat, actual.lng], {
        icon: L.divIcon({
          html: "✅",
          className: "",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(map);
      if (guess) {
        map.fitBounds(
          [
            [guess.lat, guess.lng],
            [actual.lat, actual.lng],
          ],
          { padding: [50, 50], animate: false },
        );
      }
    }
  }, [actual]);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: 400,
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
      }}
    />
  );
}

// ─── Leaderboard — best session per player: "X points in Y guesses" ─────────────
function Leaderboard({
  currentUser,
  refreshKey,
}: {
  currentUser: string;
  refreshKey: number;
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    api
      .getLeaderboard()
      .then((data) => {
        setEntries(data.leaderboard);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [refreshKey]);

  if (isLoading) return <p>Loading leaderboard...</p>;
  if (entries.length === 0)
    return (
      <p style={{ textAlign: "center", padding: 40, color: "#666" }}>
        🏆 No scores yet. Be the first to play!
      </p>
    );

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <h2>🏆 Leaderboard</h2>
      <p style={{ color: "#6b7280", marginTop: -8 }}>
        Each player's best session.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
            <th style={{ padding: 8, width: 48 }}>#</th>
            <th style={{ padding: 8 }}>Player</th>
            <th style={{ padding: 8, textAlign: "right" }}>Best session</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const isYou = e.username === currentUser;
            return (
              <tr
                key={e.username}
                style={{
                  borderBottom: "1px solid #f3f4f6",
                  background: isYou ? "#ecfdf5" : "transparent",
                }}
              >
                <td style={{ padding: 8 }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </td>
                <td style={{ padding: 8, fontWeight: isYou ? 700 : 500 }}>
                  {e.username}
                  {isYou && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: "0.75rem",
                        color: "#059669",
                      }}
                    >
                      (you)
                    </span>
                  )}
                </td>
                <td style={{ padding: 8, textAlign: "right" }}>
                  <strong style={{ fontFamily: "monospace", color: "#059669" }}>
                    {e.points.toLocaleString()}
                  </strong>
                  <span style={{ color: "#6b7280" }}>
                    {" "}
                    points in {e.guesses} guesses
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
