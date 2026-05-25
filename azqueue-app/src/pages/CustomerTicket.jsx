import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { distanceMeters, estimateEtaSec, arrivalState, formatDistance, formatEta } from "../lib/arrival";
import { punchDots, hasUnclaimedReward } from "../lib/loyalty";
import LuxeFrame from "../components/LuxeFrame";
import Button from "../components/Button";
import LanguagePicker from "../components/LanguagePicker";

/**
 * Public live-ticket page — what the customer sees after they check in.
 * Route: /t/:ticketId
 *
 * Updates in realtime via Supabase channel subscription. Shows position in queue
 * and a soft ETA. Big celebratory state when they're up.
 */
export default function CustomerTicket() {
  const { ticketId } = useParams();

  const [ticket, setTicket] = useState(null);
  const [branch, setBranch] = useState(null);
  const [service, setService] = useState(null);
  const [position, setPosition] = useState(null);   // # of waiting tickets ahead
  const [avgServiceMin, setAvgServiceMin] = useState(15);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [justJoined, setJustJoined] = useState(false); // show success banner on fresh check-in
  const [loyaltyCard, setLoyaltyCard] = useState(null); // loaded from sessionStorage set during check-in

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: t, error: tErr } = await supabase
        .from("tickets")
        .select("*")
        .eq("id", ticketId)
        .single();

      if (tErr || !t) {
        if (!cancelled) {
          setError("Ticket not found.");
          setLoading(false);
        }
        return;
      }

      const [{ data: b }, { data: s }] = await Promise.all([
        supabase.from("branches").select("id, name, city, slug").eq("id", t.branch_id).single(),
        t.service_id
          ? supabase.from("services").select("id, name, duration_min").eq("id", t.service_id).single()
          : Promise.resolve({ data: null }),
      ]);

      if (!cancelled) {
        setTicket(t);
        setBranch(b);
        setService(s);
        if (s?.duration_min) setAvgServiceMin(s.duration_min);
        setLoading(false);
        // Show success banner if the ticket was created in the last 90 seconds
        const ageMs = Date.now() - new Date(t.created_at).getTime();
        if (ageMs < 90_000 && t.status === "waiting") {
          setJustJoined(true);
          setTimeout(() => setJustJoined(false), 8_000);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [ticketId]);

  // Load loyalty card stored during check-in
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("loyalty_card");
      if (raw) setLoyaltyCard(JSON.parse(raw));
    } catch {}
  }, []);

  // Recompute position whenever the ticket or its branch changes
  useEffect(() => {
    if (!ticket?.branch_id) return;
    refreshPosition(ticket);
  }, [ticket?.branch_id, ticket?.status]);

  async function refreshPosition(t) {
    if (t.status !== "waiting") {
      setPosition(0);
      return;
    }
    const { count } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", t.branch_id)
      .eq("status", "waiting")
      .lt("created_at", t.created_at);
    setPosition(count ?? 0);
  }

  // Realtime: subscribe to changes on this specific ticket + the branch's queue
  useEffect(() => {
    if (!ticket?.id || !ticket?.branch_id) return;

    const channel = supabase
      .channel(`ticket-${ticket.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tickets", filter: `id=eq.${ticket.id}` },
        (payload) => setTicket((prev) => ({ ...prev, ...payload.new }))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets", filter: `branch_id=eq.${ticket.branch_id}` },
        () => refreshPosition(ticket)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ticket?.id, ticket?.branch_id]);

  /* ── GPS arrival tracking (opt-in) ───────────────────────────────── */
  const [trackingState, setTrackingState] = useState("idle"); // idle | granted | denied | unsupported
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) setTrackingState("unsupported");
  }, []);

  // Stop tracking once the customer is being served or done
  const trackingActive = trackingState === "granted"
    && ticket?.status === "waiting"
    && branch?.lat != null
    && branch?.lng != null;

  useEffect(() => {
    if (!trackingActive) return;

    let cancelled = false;
    let watchId = null;

    function postLocation(pos) {
      if (cancelled) return;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const dist = distanceMeters(lat, lng, branch.lat, branch.lng);
      const eta = estimateEtaSec(dist);
      const state = arrivalState(dist);
      const update = {
        customer_lat: lat,
        customer_lng: lng,
        customer_distance_m: dist,
        customer_eta_sec: eta,
        last_location_at: new Date().toISOString(),
      };
      if (state === "arrived" && !ticket.arrived_at) {
        update.arrived_at = new Date().toISOString();
      }
      supabase.from("tickets").update(update).eq("id", ticket.id);
    }

    // Browser's `watchPosition` gives us callbacks as the customer moves —
    // typically every 5–30s on mobile, perfect for our use case.
    watchId = navigator.geolocation.watchPosition(
      postLocation,
      (err) => console.warn("geolocation error", err),
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 60_000 }
    );

    return () => {
      cancelled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [trackingActive, branch?.lat, branch?.lng, ticket?.id, ticket?.status, ticket?.arrived_at]);

  function enableTracking() {
    if (!("geolocation" in navigator)) {
      setTrackingState("unsupported");
      return;
    }
    // Trigger the permission prompt with a one-shot getCurrentPosition
    navigator.geolocation.getCurrentPosition(
      () => setTrackingState("granted"),
      () => setTrackingState("denied"),
      { enableHighAccuracy: false, timeout: 10_000 }
    );
  }

  if (loading) return <Shell><div className="text-center py-20 ovline text-ink-mute">Loading…</div></Shell>;
  if (error)   return <Shell><div className="text-center py-12 text-ink-soft text-sm">{error}</div></Shell>;

  return (
    <Shell>
      {/* Branch */}
      <div className="atmosphere-hero -mx-6 px-6 -mt-8 pt-6 pb-2 text-center">
        <div className="ovline text-gold-soft mb-2">{branch?.name}</div>
        <div className="text-[10px] text-ink-mute tracking-wide">{branch?.city}</div>
      </div>

      {/* Success confirmation banner — shown for ~8s after a fresh check-in */}
      {justJoined && (
        <div className="mt-6 flex items-start gap-3 border border-[#506b50] bg-[rgba(80,107,80,0.08)] px-4 py-3 animate-pulse-once">
          <span className="text-[#9bbd9b] text-lg leading-none mt-0.5">✓</span>
          <div>
            <div className="text-[#9bbd9b] text-xs font-medium tracking-wide">You're in the queue!</div>
            <div className="text-ink-soft text-[11px] mt-0.5">
              Your ticket <span className="font-mono text-ink">{ticket?.token}</span> has been issued.
              {ticket?.customer_phone && " A confirmation has been sent to your phone."}
            </div>
          </div>
        </div>
      )}

      {/* The ticket */}
      <div className="mt-8">
        {ticket.status === "waiting"   && <Waiting ticket={ticket} service={service} position={position} avg={avgServiceMin} />}
        {ticket.status === "serving"   && <Serving ticket={ticket} />}
        {ticket.status === "completed" && <Completed ticket={ticket} branch={branch} />}
        {ticket.status === "no_show"   && <NoShow />}
        {ticket.status === "cancelled" && <Cancelled />}
      </div>

      {/* Arrival tracking — only while waiting + branch has coords */}
      {ticket.status === "waiting" && branch?.lat != null && branch?.lng != null && (
        <ArrivalCard
          ticket={ticket}
          trackingState={trackingState}
          onEnable={enableTracking}
        />
      )}

      {/* Detail panel */}
      <div className="mt-6 grid grid-cols-2 gap-px bg-line border border-line text-center">
        <div className="bg-bg-elev p-4">
          <div className="ovline text-[8px]">Service</div>
          <div className="text-sm mt-1">{service?.name ?? "—"}</div>
        </div>
        <div className="bg-bg-elev p-4">
          <div className="ovline text-[8px]">Issued</div>
          <div className="text-sm mt-1 font-mono">{fmtTime(ticket.created_at)}</div>
        </div>
      </div>

      {/* Loyalty punch card — shown if the branch has a program */}
      {loyaltyCard && <LoyaltyCardDisplay card={loyaltyCard} />}

      <div className="mt-6 text-[10px] text-ink-mute text-center tracking-wide">
        {t("ticket.keep_open")}
      </div>
    </Shell>
  );
}

/* ── Status panels ─────────────────────────────────────────────────── */

function Waiting({ ticket, position, avg }) {
  const { t } = useTranslation();
  // Soft ETA based on position × avg service time
  const etaMin = position == null ? null : Math.max(1, position * avg);
  const almostUp = position != null && position <= 1;

  return (
    <LuxeFrame className="p-7">
      <div className="flex items-center justify-between mb-4">
        <span className="ovline text-[9px] text-[#9bbd9b] flex items-center gap-1.5">
          <span className="pip breathe" />
          {almostUp ? t("ticket.almost_up") : t("ticket.spot_secured")}
        </span>
        <span className="ovline text-[9px] text-ink-mute flex items-center gap-1">
          <span className="pip breathe" style={{ background: "#52525b" }} /> {t("ticket.live")}
        </span>
      </div>

      <div className="gold-text font-display text-7xl font-light tracking-tightest leading-none">
        {ticket.token}
      </div>
      <div className="text-[10px] text-ink-mute mt-3 tracking-wide">
        {ticket.customer_name}
      </div>

      <div className="rule-ornament my-5 text-[8px]"><span>✦</span></div>

      <div className="grid grid-cols-2 gap-px bg-line border border-line">
        <div className="bg-bg-elev p-3 text-center">
          <div className="ovline text-[8px]">{t("ticket.ahead")}</div>
          <div className={`font-display text-2xl mt-1 ${almostUp ? "text-[#9bbd9b]" : "gold-text-soft"}`}>
            {position == null ? "—" : position}
          </div>
        </div>
        <div className="bg-bg-elev p-3 text-center">
          <div className="ovline text-[8px]">{t("ticket.eta")}</div>
          <div className="font-display text-2xl mt-1 gold-text-soft">
            {etaMin == null ? "—" : `~${etaMin}m`}
          </div>
        </div>
      </div>
    </LuxeFrame>
  );
}

function Serving({ ticket }) {
  return (
    <LuxeFrame className="p-7 text-center">
      <div className="ovline text-[#9bbd9b] mb-3 flex items-center justify-center gap-2">
        <span className="pip breathe" />
        You're up now
      </div>
      <div className="gold-text font-display text-8xl font-light tracking-tightest leading-none">
        {ticket.token}
      </div>
      <div className="rule-ornament my-5 text-[8px]"><span>✦</span></div>
      <div className="text-sm text-ink">{ticket.customer_name}</div>
      <div className="text-[10px] text-ink-mute mt-2 tracking-wide">
        Walk in now — staff is ready for you.
      </div>
    </LuxeFrame>
  );
}

function Completed({ ticket, branch }) {
  const { t } = useTranslation();
  return (
    <LuxeFrame className="p-7 text-center">
      <div className="ovline text-gold-soft mb-3">{t("ticket.thank_you")}</div>
      <h2 className="font-display text-3xl font-light tracking-tightest mb-3">
        {t("ticket.service_complete")}
      </h2>
      <div className="rule-ornament my-5 text-[8px]"><span>✦</span></div>
      <p className="text-ink-soft text-xs leading-relaxed mb-5">
        {t("ticket.thanks_visit", { branchName: branch?.name })}
      </p>
      <Link
        to={`/q/${branch?.slug}`}
        className="inline-block text-[10px] tracking-[0.2em] uppercase text-gold-soft hover:text-gold"
      >
        {t("ticket.checkin_again")} →
      </Link>
    </LuxeFrame>
  );
}

function NoShow() {
  return (
    <LuxeFrame className="p-7 text-center">
      <div className="ovline text-[#d49185] mb-3">Marked no-show</div>
      <p className="text-ink-soft text-xs">This ticket was closed because we couldn't reach you.</p>
    </LuxeFrame>
  );
}

function Cancelled() {
  return (
    <LuxeFrame className="p-7 text-center">
      <div className="ovline text-ink-mute mb-3">Cancelled</div>
      <p className="text-ink-soft text-xs">This ticket was cancelled.</p>
    </LuxeFrame>
  );
}

/* ── Arrival card (opt-in GPS) ─────────────────────────────────────── */
function ArrivalCard({ ticket, trackingState, onEnable }) {
  const dist = ticket.customer_distance_m;
  const eta = ticket.customer_eta_sec;
  const state = arrivalState(dist);

  // Pre-permission state — invitation to share location
  if (trackingState === "idle") {
    return (
      <div className="mt-6 border border-[#506b50] bg-[rgba(80,107,80,0.04)] p-5">
        <div className="ovline text-[#9bbd9b] mb-2">Optional</div>
        <div className="text-sm text-ink mb-2">Share your live location?</div>
        <p className="text-[11px] text-ink-soft leading-relaxed mb-4">
          We'll see when you're close and pace your call to your real arrival — so you don't have to guess. Tracking auto-stops when you're served.
        </p>
        <Button onClick={onEnable} size="sm">Share live location →</Button>
      </div>
    );
  }

  if (trackingState === "denied" || trackingState === "unsupported") {
    return (
      <div className="mt-6 border border-line bg-bg-elev p-4">
        <div className="text-[11px] text-ink-mute">
          {trackingState === "denied"
            ? "Location sharing was declined — that's fine. Watch this page for updates instead."
            : "Your browser doesn't support location sharing — watch this page for updates."}
        </div>
      </div>
    );
  }

  // Granted — render arrival status
  const stateColor = state === "arrived" ? "#9bbd9b" : state === "approaching" ? "#e4cb95" : "#74b9e8";
  const stateLabel = state === "arrived" ? "You're here" : state === "approaching" ? "At the door" : "On the way";

  return (
    <div className="mt-6 border border-[#506b50] bg-[rgba(80,107,80,0.04)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="ovline flex items-center" style={{ color: stateColor }}>
          <span className="pip breathe mr-1.5" style={{ background: stateColor }} />
          {stateLabel}
        </div>
        <div className="text-[9px] text-ink-mute font-mono">
          {ticket.last_location_at ? `updated ${fmtAgo(ticket.last_location_at)}` : "starting…"}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-line border border-line">
        <div className="bg-bg-elev p-3 text-center">
          <div className="ovline text-[8px]">Distance</div>
          <div className="font-display text-base mt-1 gold-text-soft">{formatDistance(dist)}</div>
        </div>
        <div className="bg-bg-elev p-3 text-center">
          <div className="ovline text-[8px]">ETA</div>
          <div className="font-display text-base mt-1 gold-text-soft">{formatEta(eta)}</div>
        </div>
      </div>
      <div className="text-[10px] text-ink-mute mt-3 tracking-wide text-center">
        Tracking stops automatically when you're served. We don't keep this data after.
      </div>
    </div>
  );
}

/* ── Loyalty card display ──────────────────────────────────────────── */
function LoyaltyCardDisplay({ card }) {
  const program = card?.program;
  if (!program) return null;

  const dots = punchDots(card, program);
  const unclaimed = hasUnclaimedReward(card);
  const remaining = program.punches_required - card.current_punches;

  return (
    <div className="mt-6 border border-line bg-bg-elev p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="ovline text-[9px] text-gold-soft">{program.name ?? "Loyalty Card"}</div>
        {unclaimed && (
          <div className="text-[9px] tracking-wide bg-gold text-[#141410] px-2 py-0.5 font-medium">
            🎁 Reward ready!
          </div>
        )}
      </div>

      {/* Punch dots */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {dots.map((filled, i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full border transition ${
              filled
                ? "bg-gold border-gold shadow-[0_0_6px_rgba(201,168,106,0.4)]"
                : "border-line-2 bg-bg"
            }`}
          />
        ))}
      </div>

      <div className="text-[11px] text-ink-soft">
        {unclaimed
          ? `You've earned: ${program.reward_description} — let staff know to claim it.`
          : `${remaining} more visit${remaining === 1 ? "" : "s"} to earn: ${program.reward_description}`}
      </div>
    </div>
  );
}

function fmtAgo(iso) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  return `${Math.floor(ms / 60_000)}m ago`;
}

/* ── Shell ─────────────────────────────────────────────────────────── */
function Shell({ children }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <header className="px-6 py-4 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gold rounded-sm flex items-center justify-center font-display text-[#141410] text-xs shadow-[0_0_18px_rgba(201,168,106,0.25)]">A</div>
          <span className="font-display text-base">AzQueue</span>
        </div>
        <LanguagePicker />
      </header>
      <main className="flex-1 max-w-md w-full mx-auto px-6 py-8">
        {children}
      </main>
      <footer className="px-6 py-5 border-t border-line text-[9px] text-ink-mute tracking-[0.2em] uppercase text-center">
        {t("common.powered_by")} · azqueue.io
      </footer>
    </div>
  );
}

function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
