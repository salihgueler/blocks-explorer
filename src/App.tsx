import { CSSProperties, useEffect, useState, useCallback, useRef } from "react";
import {
  createLocationMap,
  type LocationMapViewConfig,
  type LocationMapHandle,
} from "@blocks-explorer/location-map/ui";
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

// ─── Theme ──────────────────────────────────────────────────────────────────────
// Single source of truth for the brand palette. Mirrors the CSS variables in
// index.html so inline styles (and gradients) can reference concrete values.
const theme = {
  coral: "#FF5A5F",
  coralDark: "#E54A4F",
  teal: "#00C2C3",
  tealDark: "#00A3A4",
  yellow: "#FFD151",
  lilac: "#E0B0FF",
  slate: "#2F4F4F",
  panel: "#244040",
  panel2: "#2C4D4D",
  panelRaised: "#36595A",
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.18)",
  text: "#EEF5F4",
  textMuted: "#9FBCBB",
} as const;

const card = {
  background: `linear-gradient(180deg, ${theme.panel2}, ${theme.panel})`,
  border: `1px solid ${theme.border}`,
  borderRadius: 16,
  boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
} as const;

// Layout-only styles for the large call-to-action buttons; color/hover come
// from the .btn-* utility classes defined in index.html.
const actionButton = { padding: "13px 30px", fontSize: "1.05rem" } as const;

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<"game" | "leaderboard">("game");
  const [lbRefresh, setLbRefresh] = useState(0);
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
    <>
      <BackgroundDecor />
      <div
        className="app-shell"
        style={{
          fontFamily: "'Open Sans', system-ui, -apple-system, sans-serif",
          color: theme.text,
        }}
      >
        <header className="topbar">
          <Brand />
          {user && (
            <nav className="topnav">
              <button
                onClick={() => setView("game")}
                className={`tab ${view === "game" ? "is-active" : ""}`}
              >
                Play
              </button>
              <button
                onClick={() => setView("leaderboard")}
                className={`tab ${view === "leaderboard" ? "is-active" : ""}`}
              >
                Leaderboard
              </button>
            </nav>
          )}
          <div
            ref={menuRef}
            className="account-menu"
            style={{ marginLeft: user ? 0 : "auto" }}
          />
        </header>
        {!user && <SignedOut />}
        {user && view === "game" && (
          <GameScreen
            onSessionComplete={() => setLbRefresh((v) => v + 1)}
            onGoToLeaderboard={() => setView("leaderboard")}
          />
        )}
        {user && view === "leaderboard" && (
          <Leaderboard currentUser={user.username} refreshKey={lbRefresh} />
        )}
      </div>
    </>
  );
}

// ─── Decorative travel-collage frame behind the floating app panel ──────────────
function BackgroundDecor() {
  const marks: { e: string; s: CSSProperties }[] = [
    { e: "🗼", s: { top: "5%", left: "2.5%", fontSize: 132 } },
    { e: "🌉", s: { top: "4%", right: "3%", fontSize: 150 } },
    { e: "🎡", s: { top: "12%", right: "21%", fontSize: 86 } },
    { e: "🕌", s: { top: "41%", left: "1%", fontSize: 104 } },
    { e: "🏛️", s: { top: "45%", right: "1.5%", fontSize: 104 } },
    { e: "🔺", s: { bottom: "7%", left: "5%", fontSize: 120 } },
    { e: "🗽", s: { bottom: "11%", left: "23%", fontSize: 96 } },
    { e: "⛰️", s: { bottom: "5%", right: "4.5%", fontSize: 128 } },
  ];
  return (
    <div className="bg-decor" aria-hidden="true">
      {marks.map((m, i) => (
        <span key={i} style={m.s}>
          {m.e}
        </span>
      ))}
    </div>
  );
}

// ─── Brand mark ─────────────────────────────────────────────────────────────────
function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
      <span
        aria-hidden
        style={{
          display: "grid",
          placeItems: "center",
          width: 46,
          height: 46,
          borderRadius: 14,
          fontSize: "1.6rem",
          background: `linear-gradient(135deg, ${theme.coral}, ${theme.yellow})`,
          boxShadow: "0 8px 20px rgba(255,90,95,0.35)",
        }}
      >
        🧭
      </span>
      <div style={{ lineHeight: 1 }}>
        <div
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 800,
            fontSize: "1.25rem",
            letterSpacing: "0.04em",
          }}
        >
          GLOBETROTTER
        </div>
        <div
          style={{
            marginTop: 5,
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 800,
            fontSize: "1.25rem",
            letterSpacing: "0.04em",
            color: theme.coral,
          }}
        >
          BLITZ
        </div>
      </div>
    </div>
  );
}

// ─── How-to-play cards (colorful cards — mirrors the reference UI) ──────────────
function ModesSection() {
  const steps: { label: string; text: string; cls: string; emoji: string }[] = [
    {
      label: "Read the Photo",
      text: "Study the scene for clues — signs, scenery, architecture.",
      cls: "coral",
      emoji: "📸",
    },
    {
      label: "Drop a Pin",
      text: "Click the world map where you think the photo was taken.",
      cls: "teal",
      emoji: "📍",
    },
    {
      label: "Score Points",
      text: "The closer your guess, the more points you earn.",
      cls: "yellow",
      emoji: "🎯",
    },
    {
      label: "Climb the Board",
      text: "Beat your best session and top the leaderboard.",
      cls: "lilac",
      emoji: "🏆",
    },
  ];
  return (
    <section className="modes-section">
      <h3 className="modes-title">HOW TO PLAY</h3>
      <div className="modes-grid">
        {steps.map((s) => (
          <div key={s.label} className={`mode-card ${s.cls}`}>
            {s.label}
            <p className="mode-text">{s.text}</p>
            <span className="mode-emoji" aria-hidden>
              {s.emoji}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Signed-out splash — playful, animated hero ─────────────────────────────────
function SignedOut() {
  return (
    <div className="hero">
      <div className="hero-main">
        <div className="hero-globe" aria-hidden>
          🌍
          <span className="hero-pin hero-pin-1">📍</span>
          <span className="hero-pin hero-pin-2">✈️</span>
          <span className="hero-pin hero-pin-3">🧭</span>
        </div>
        <div className="hero-copy">
          <span className="hero-eyebrow">5 ROUNDS · ONE WORLD</span>
          <h2 className="hero-title">
            Guess where on Earth
            <br />
            the photo was taken
          </h2>
          <p className="hero-sub">
            A fast-paced photo challenge. Spot the location, drop a pin, and
            race the clock to climb the leaderboard.
          </p>
          <div className="hero-cta">
            <span className="hero-cta-pill">
              👉 Hit <strong>Sign In</strong> up top to play
            </span>
          </div>
        </div>
      </div>
      <ModesSection />
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
      <>
        <div
          style={{
            ...card,
            textAlign: "center",
            padding: "56px 28px",
            maxWidth: 620,
            margin: "8px auto 0",
          }}
        >
          <div style={{ fontSize: "3rem" }}>🌍</div>
          <h2
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: "2rem",
              margin: "8px 0",
            }}
          >
            Ready to explore?
          </h2>
          <p
            style={{
              color: theme.textMuted,
              marginBottom: 24,
              lineHeight: 1.6,
            }}
          >
            Five rounds. Guess each location from its photo — the closer you
            are, the more points you score.
          </p>
          {error && (
            <p style={{ color: theme.coral, marginBottom: 16 }}>{error}</p>
          )}
          <button
            onClick={startSession}
            disabled={isLoading}
            className="btn-coral"
            style={actionButton}
          >
            {isLoading ? "Loading..." : "Start Game"}
          </button>
        </div>
        <ModesSection />
      </>
    );
  }

  // ── Summary: end-of-session screen ──
  if (showSummary && result?.completed) {
    return (
      <div
        style={{
          ...card,
          textAlign: "center",
          padding: "48px 28px",
          maxWidth: 620,
          margin: "8px auto 0",
        }}
      >
        <h2
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "1.8rem",
            marginBottom: 4,
          }}
        >
          Session complete! 🎉
        </h2>
        {result.newBest && (
          <div
            style={{
              display: "inline-block",
              margin: "12px 0",
              padding: "6px 16px",
              borderRadius: 999,
              background: "rgba(255,209,81,0.16)",
              border: "1px solid rgba(255,209,81,0.5)",
              color: theme.yellow,
              fontWeight: 700,
            }}
          >
            ⭐ New personal best!
          </div>
        )}
        <div
          style={{
            fontSize: "3.4rem",
            fontWeight: 800,
            fontFamily: "'Montserrat', sans-serif",
            color: theme.teal,
            margin: "8px 0",
          }}
        >
          {(result.finalScore ?? 0).toLocaleString()}
        </div>
        <p style={{ color: theme.textMuted, fontSize: "1.1rem" }}>
          points in {result.totalGuesses ?? round.totalRounds} guesses
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            marginTop: 24,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={startSession}
            disabled={isLoading}
            className="btn-coral"
            style={actionButton}
          >
            {isLoading ? "Loading..." : "Play again"}
          </button>
          <button
            onClick={onGoToLeaderboard}
            className="btn-ghost"
            style={actionButton}
          >
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
      {error && <p style={{ color: theme.coral }}>{error}</p>}
      <div className="game-grid">
        {/* Left: Photo stage with the round info overlaid on top */}
        <div>
          <div
            className="stage"
            style={{
              ...card,
              padding: 0,
              position: "relative",
              overflow: "hidden",
              aspectRatio: "16 / 11",
            }}
          >
            {/* The location photo, now a full-bleed background */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(${round.imageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            {/* Scrim so the overlay card stays legible over bright photos */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(105deg, rgba(8,16,16,0.62) 0%, rgba(8,16,16,0.12) 45%, rgba(8,16,16,0) 70%)",
              }}
            />
            {/* Overlaid round-info card (top-left) */}
            <div
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                width: 200,
                background: "rgba(11,21,21,0.86)",
                backdropFilter: "blur(6px)",
                border: `1px solid ${theme.borderStrong}`,
                borderRadius: 14,
                padding: "14px 16px",
                boxShadow: "0 14px 32px rgba(0,0,0,0.45)",
              }}
            >
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  letterSpacing: "0.04em",
                  color: "#fff",
                  marginBottom: 14,
                }}
              >
                ROUND {round.roundNumber} / {round.totalRounds}
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <div
                    style={{
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      color: theme.textMuted,
                      textTransform: "uppercase",
                    }}
                  >
                    Current map:
                  </div>
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 800,
                      fontSize: "1.1rem",
                      color: "#fff",
                      marginTop: 2,
                      textTransform: "capitalize",
                    }}
                  >
                    {result?.actual?.country ?? "?????"}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      color: theme.textMuted,
                      textTransform: "uppercase",
                    }}
                  >
                    Points:
                  </div>
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 800,
                      fontSize: "1.1rem",
                      color: "#fff",
                      marginTop: 2,
                    }}
                  >
                    {runningScore.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      color: theme.textMuted,
                      textTransform: "uppercase",
                    }}
                  >
                    Guesses left:
                  </div>
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 800,
                      fontSize: "1.1rem",
                      color: "#fff",
                      marginTop: 2,
                    }}
                  >
                    {round.totalRounds - round.roundNumber + (result ? 0 : 1)}
                  </div>
                </div>
              </div>
            </div>
            {/* Fullscreen icon (top-right, decorative) */}
            <button
              type="button"
              className="icon-btn"
              style={{ position: "absolute", top: 16, right: 16 }}
              aria-label="Fullscreen"
              onClick={(e) => {
                const el = (e.currentTarget.closest(".stage") ||
                  null) as HTMLElement | null;
                if (!el) return;
                if (document.fullscreenElement) document.exitFullscreen();
                else el.requestFullscreen?.();
              }}
            >
              ⛶
            </button>
          </div>
          <ProgressStrip
            roundNumber={round.roundNumber}
            totalRounds={round.totalRounds}
          />
          {result && (
            <div
              style={{
                ...card,
                marginTop: 14,
                padding: 16,
                border: "1px solid rgba(0,194,195,0.4)",
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
                    fontSize: "1.6rem",
                    fontWeight: 800,
                    fontFamily: "'Montserrat', sans-serif",
                    color: theme.teal,
                  }}
                >
                  {result.score} / {result.maxScore}
                </span>
                <span style={{ color: theme.textMuted }}>
                  {result.distanceKm < 1
                    ? `${Math.round(result.distanceKm * 1000)}m`
                    : `${result.distanceKm.toLocaleString()} km`}{" "}
                  away
                </span>
              </div>
              <p style={{ margin: "8px 0 0", color: theme.text }}>
                📍 {result.actual.label}
              </p>
              <div
                style={{
                  marginTop: 10,
                  height: 10,
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round((result.score / result.maxScore) * 100)}%`,
                    background: `linear-gradient(to right, ${theme.coral}, ${theme.yellow}, ${theme.teal})`,
                    borderRadius: 999,
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
          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            {!result ? (
              <button
                onClick={submitGuess}
                disabled={!guess || isLoading}
                className="btn-teal"
                style={{ flex: 1, padding: "14px", fontSize: "1.02rem" }}
              >
                {isLoading
                  ? "Submitting..."
                  : guess
                    ? "Guess Location"
                    : "Click the map to guess"}
              </button>
            ) : (
              <button
                onClick={advance}
                className="btn-coral"
                style={{ flex: 1, padding: "14px", fontSize: "1.02rem" }}
              >
                {result.completed ? "See Results →" : "Next Round →"}
              </button>
            )}
          </div>
          <TipCard text={round.hint} />
        </div>
      </div>
      <ModesSection />
    </div>
  );
}

// ─── Tip of the day card (yellow) — surfaces the round's hint ───────────────────
function TipCard({ text }: { text: string }) {
  return (
    <div className="tip-yellow" style={{ marginTop: 14 }}>
      <div className="tip-head">💡 Tip of the Day</div>
      <p>{text}</p>
    </div>
  );
}

// ─── Progress + countdown strip beneath the photo ───────────────────────────────
function ProgressStrip({
  roundNumber,
  totalRounds,
}: {
  roundNumber: number;
  totalRounds: number;
}) {
  const [seconds, setSeconds] = useState(154); // 02:34 like the reference
  useEffect(() => {
    setSeconds(154);
    const id = window.setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [roundNumber]);
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  const pct = Math.round((roundNumber / totalRounds) * 100);
  return (
    <div className="progress-strip">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="time-left">
        <small>Time Left:</small>
        {mm}:{ss}
      </div>
    </div>
  );
}

// ─── Map Input (offline SVG or Amazon Location vector map, driven by getMapConfig) ────────
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
  const [config, setConfig] = useState<LocationMapViewConfig | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<LocationMapHandle | null>(null);

  // Keep latest inputs in refs so map creation can seed them without
  // re-creating the map on every change.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const guessRef = useRef(guess);
  guessRef.current = guess;
  const actualRef = useRef(actual);
  actualRef.current = actual;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  // Fetch map config once on mount
  useEffect(() => {
    api.getMapConfig().then((cfg) =>
      setConfig({
        isOffline: cfg.isOffline,
        googleMapsApiKey: cfg.googleMapsApiKey,
      }),
    );
  }, []);

  // Create the block's map view once config + container are ready
  useEffect(() => {
    if (!config || !containerRef.current) return;
    const handle = createLocationMap({
      config,
      onSelect: (c: { lat: number; lng: number }) => onSelectRef.current(c),
    });
    containerRef.current.appendChild(handle.element);
    handleRef.current = handle;
    // Seed current state into the freshly created map
    handle.setLocked(lockedRef.current);
    handle.setGuess(guessRef.current);
    handle.setActual(actualRef.current);
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
  }, [config]);

  // Push ongoing state changes to the map
  useEffect(() => {
    handleRef.current?.setGuess(guess);
  }, [guess]);
  useEffect(() => {
    handleRef.current?.setActual(actual);
  }, [actual]);
  useEffect(() => {
    handleRef.current?.setLocked(locked);
  }, [locked]);

  return (
    <div style={{ ...card, padding: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          margin: "2px 4px 10px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "0.95rem",
            letterSpacing: "0.06em",
          }}
        >
          📍 DROP A PIN
        </h3>
        <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>
          {config && !config.isOffline
            ? "Click the map to guess"
            : "Click a country to guess"}
        </span>
      </div>
      {config === null ? (
        <div
          style={{
            width: "100%",
            height: 380,
            borderRadius: 10,
            border: `1px solid ${theme.border}`,
            display: "grid",
            placeItems: "center",
            color: theme.textMuted,
          }}
        >
          Loading map...
        </div>
      ) : (
        <div ref={containerRef} style={{ width: "100%" }} />
      )}
    </div>
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

  if (isLoading)
    return (
      <div
        style={{
          ...card,
          maxWidth: 720,
          margin: "8px auto 0",
          padding: 32,
          textAlign: "center",
          color: theme.textMuted,
        }}
      >
        Loading leaderboard...
      </div>
    );
  if (entries.length === 0)
    return (
      <div
        style={{
          ...card,
          maxWidth: 720,
          margin: "8px auto 0",
          padding: 40,
          textAlign: "center",
          color: theme.textMuted,
        }}
      >
        🏆 No scores yet. Be the first to play!
      </div>
    );

  return (
    <div style={{ maxWidth: 720, margin: "8px auto 0" }}>
      <div style={{ ...card, padding: "22px 24px" }}>
        <h2
          style={{ margin: "0 0 2px", fontFamily: "'Montserrat', sans-serif" }}
        >
          🏆 Leaderboard
        </h2>
        <p style={{ color: theme.textMuted, margin: "0 0 18px" }}>
          Each player's best session.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{
                textAlign: "left",
                color: theme.textMuted,
                fontSize: "0.72rem",
                letterSpacing: "0.1em",
              }}
            >
              <th style={{ padding: "0 8px 10px", width: 48 }}>#</th>
              <th style={{ padding: "0 8px 10px" }}>PLAYER</th>
              <th style={{ padding: "0 8px 10px", textAlign: "right" }}>
                BEST SESSION
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const isYou = e.username === currentUser;
              return (
                <tr
                  key={e.username}
                  style={{
                    borderTop: `1px solid ${theme.border}`,
                    background: isYou ? "rgba(0,194,195,0.12)" : "transparent",
                  }}
                >
                  <td
                    style={{
                      padding: "12px 8px",
                      fontSize: i < 3 ? "1.1rem" : "1rem",
                    }}
                  >
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </td>
                  <td
                    style={{
                      padding: "12px 8px",
                      fontWeight: isYou ? 700 : 600,
                    }}
                  >
                    {e.username}
                    {isYou && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: "0.75rem",
                          color: theme.teal,
                        }}
                      >
                        (you)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "right" }}>
                    <strong
                      style={{
                        fontFamily: "'Montserrat', sans-serif",
                        color: theme.yellow,
                      }}
                    >
                      {e.points.toLocaleString()}
                    </strong>
                    <span style={{ color: theme.textMuted }}>
                      {" "}
                      pts · {e.guesses} guesses
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
