import { useEffect, useState } from "react";
import { useDisplay } from "../hooks/useDisplay";

/**
 * Display — full-screen TV display for Az Tax Services.
 * Route: /display-tv/:branchId  (public, no auth)
 *
 * Layout:
 *   Top bar   — logo + branch name (left) · live clock (right)
 *   Main area — "NOW SERVING" with 4 station cards
 *   Bottom    — "UP NEXT" token chips (up to 6)
 *   Corner    — fullscreen toggle button
 */

/* ── Staff colour map (by known staff ID) ─────────────────────── */
const STAFF_COLORS = {
  "4285044d-be11-470b-8712-08f52c0a02fd": "#c9a86a", // Mohamed  — gold
  "38b933f0-1ed2-4d02-a643-d39cc9554521": "#74b9e8", // Benyamin — blue
  "671d5a70-fd81-4c24-bfe9-6b5ba91651fa": "#9bbd9b", // Abdul    — green
  "c084308a-270b-4077-b83a-4bc699e5ed01": "#d49185", // Nuredin  — terracotta
};

function staffColor(staffId) {
  return STAFF_COLORS[staffId] ?? "#6e6c65";
}

export default function Display() {
  const { branchName, serving, waiting, staff, stations, loading } = useDisplay();

  /* ── Live clock ─────────────────────────────────────────────── */
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = now.toLocaleTimeString([], {
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  /* ── Fullscreen toggle ──────────────────────────────────────── */
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  /* ── Build lookup maps ──────────────────────────────────────── */
  // staffId → staff row
  const staffById = {};
  staff.forEach((s) => { staffById[s.id] = s; });

  // stationId → serving ticket
  const servingByStation = {};
  serving.forEach((t) => {
    if (t.assigned_station_id) servingByStation[t.assigned_station_id] = t;
  });

  /* ── Station cards ──────────────────────────────────────────── */
  // Always show 4 cards. If DB has fewer stations, pad with placeholder cards.
  const WINDOW_LABELS = [1, 2, 3, 4];
  const stationCards = WINDOW_LABELS.map((winNum) => {
    const station = stations.find((s) => s.window_number === winNum) ?? null;
    const ticket  = station ? servingByStation[station.id] ?? null : null;
    const staffMember = station?.preparer_id ? staffById[station.preparer_id] ?? null : null;

    // Also check if any serving ticket is assigned to a staff at this window
    // (fallback for when assigned_station_id isn't set)
    const fallbackTicket = !ticket
      ? serving.find((t) => staffMember && t.staff_id === staffMember.id) ?? null
      : null;

    const activeTicket = ticket ?? fallbackTicket;
    const color = staffMember ? staffColor(staffMember.id) : "#6e6c65";

    return { winNum, station, staffMember, ticket: activeTicket, color };
  });

  /* ── Loading screen ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0b0b0c" }}
      >
        <div
          className="font-display font-light"
          style={{ color: "#c9a86a", fontSize: 48, opacity: 0.4 }}
        >
          Az Tax Services
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col select-none overflow-hidden"
      style={{ background: "#0b0b0c", color: "#f2f0ea" }}
    >
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-10 shrink-0"
        style={{
          height: 80,
          borderBottom: "1px solid #26262a",
          background: "rgba(11,11,12,0.95)",
        }}
      >
        {/* Left: logo + branch name */}
        <div className="flex items-center gap-4">
          <div
            className="flex items-center justify-center rounded-sm"
            style={{
              width: 40,
              height: 40,
              background: "#c9a86a",
              boxShadow: "0 0 28px rgba(201,168,106,0.35)",
            }}
          >
            <span
              className="font-display font-semibold"
              style={{ color: "#141410", fontSize: 18 }}
            >
              A
            </span>
          </div>
          <span
            className="font-display font-light tracking-tight"
            style={{ color: "#e4cb95", fontSize: 28 }}
          >
            {branchName || "Az Tax Services"}
          </span>
        </div>

        {/* Right: live clock */}
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 24,
            color: "#a8a69e",
            letterSpacing: "0.04em",
          }}
        >
          {timeStr}
        </div>
      </header>

      {/* ── Main area ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col px-10 py-8">
        {/* Section label */}
        <div
          className="text-center mb-8"
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#6e6c65",
          }}
        >
          Now Serving
        </div>

        {/* 4 station cards */}
        <div
          className="grid gap-5 flex-1"
          style={{
            gridTemplateColumns: "repeat(4, 1fr)",
            maxHeight: "calc(100vh - 280px)",
          }}
        >
          {stationCards.map(({ winNum, station, staffMember, ticket, color }) => {
            const isServing = !!ticket;
            return (
              <div
                key={winNum}
                className="flex flex-col p-8 transition-all duration-700"
                style={{
                  border: isServing
                    ? `2px solid ${color}44`
                    : "1px solid #26262a",
                  background: isServing
                    ? `linear-gradient(160deg, ${color}08 0%, transparent 60%)`
                    : "transparent",
                  borderRadius: 2,
                }}
              >
                {/* Window + staff name */}
                <div
                  className="mb-6"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 11,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: isServing ? color : "#6e6c65",
                  }}
                >
                  Window {winNum}
                  {staffMember && (
                    <span style={{ color: isServing ? color : "#6e6c65" }}>
                      {" "}· {staffMember.display_name}
                    </span>
                  )}
                </div>

                {/* Token — dominant element */}
                <div
                  className="font-display font-light leading-none flex-1 flex items-center"
                  style={{
                    fontSize: 120,
                    color: isServing ? color : "#26262a",
                    transition: "color 0.5s ease",
                  }}
                >
                  {ticket?.token ?? "—"}
                </div>

                {/* Customer name / Available */}
                <div
                  className="mt-4"
                  style={{
                    fontSize: 18,
                    color: isServing ? "#f2f0ea" : "#3a3a3f",
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 400,
                  }}
                >
                  {isServing ? ticket.customer_name : "Available"}
                </div>

                {/* Service name */}
                {isServing && ticket.service_id && (
                  <div
                    className="mt-1"
                    style={{
                      fontSize: 12,
                      color: "#6e6c65",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {/* service_id shown; a future join could show name */}
                    In service
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* ── Bottom strip: Up Next ───────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid #26262a",
          padding: "20px 40px",
          background: "rgba(11,11,12,0.97)",
        }}
      >
        <div
          className="mb-4"
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#6e6c65",
          }}
        >
          Up Next
        </div>

        {waiting.length === 0 ? (
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 16,
              color: "#3a3a3f",
            }}
          >
            Queue is clear
          </div>
        ) : (
          <div className="flex items-center gap-6">
            {waiting.slice(0, 6).map((t, i) => {
              const firstName = t.customer_name?.split(" ")[0] ?? "";
              return (
                <div
                  key={t.id}
                  className="flex flex-col items-center"
                  style={{
                    opacity: 1 - i * 0.12,
                  }}
                >
                  <span
                    className="font-display font-light"
                    style={{ fontSize: 28, color: "#c9a86a", lineHeight: 1 }}
                  >
                    {t.token}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#6e6c65",
                      marginTop: 4,
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {firstName}
                  </span>
                </div>
              );
            })}

            {waiting.length > 6 && (
              <div
                style={{
                  fontSize: 12,
                  color: "#3a3a3f",
                  fontFamily: "Inter, sans-serif",
                  marginLeft: 8,
                }}
              >
                +{waiting.length - 6} more
              </div>
            )}
          </div>
        )}
      </footer>

      {/* ── Fullscreen button ───────────────────────────────── */}
      <button
        onClick={toggleFullscreen}
        style={{
          position: "fixed",
          bottom: 16,
          right: 20,
          background: "transparent",
          border: "1px solid #26262a",
          color: "#3a3a3f",
          fontSize: 11,
          fontFamily: "Inter, sans-serif",
          letterSpacing: "0.1em",
          padding: "6px 10px",
          cursor: "pointer",
          transition: "color 0.2s, border-color 0.2s",
          zIndex: 50,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#a8a69e";
          e.currentTarget.style.borderColor = "#3a3a3f";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#3a3a3f";
          e.currentTarget.style.borderColor = "#26262a";
        }}
      >
        ⛶ Fullscreen
      </button>
    </div>
  );
}
