import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
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
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Same flag CustomerCheckIn.jsx uses — the iPad kiosk lands here right after
  // a walk-in submits, and needs to show a confirmation then reset itself for
  // the next person rather than sit on one customer's personal ticket forever.
  const isKiosk = searchParams.get("kiosk") === "1";
  const KIOSK_RESET_SECONDS = 12;
  const [kioskResetIn, setKioskResetIn] = useState(KIOSK_RESET_SECONDS);

  const [ticket, setTicket] = useState(null);
  const [branch, setBranch] = useState(null);
  const [service, setService] = useState(null);
  const [position, setPosition] = useState(null);   // # of waiting tickets ahead
  const [avgServiceMin, setAvgServiceMin] = useState(15);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [justJoined, setJustJoined] = useState(false); // show success banner on fresh check-in
  const [loyaltyCard, setLoyaltyCard] = useState(null); // loaded from sessionStorage set during check-in
  const [confirmingLeave, setConfirmingLeave] = useState(false); // "are you sure?" panel
  const [leaving, setLeaving] = useState(false); // request in flight

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
        supabase.from("branches").select("id, name, city, slug, brand_color, lat, lng, wa_phone, wa_enabled").eq("id", t.branch_id).single(),
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

  // Kiosk auto-reset — once the ticket has loaded, count down and send the
  // shared iPad back to its own check-in screen so the next walk-in can use it.
  useEffect(() => {
    if (!isKiosk || !ticket || !branch?.slug) return;
    setKioskResetIn(KIOSK_RESET_SECONDS);
    const interval = setInterval(() => {
      setKioskResetIn((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate(`/q/${branch.slug}?kiosk=1`, { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isKiosk, ticket?.id, branch?.slug, navigate]);

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

  // Stop tracking once the customer is being served or done.
  // Never on the kiosk — it's a shared device, not the customer's own phone,
  // so a GPS permission prompt there doesn't make sense.
  const trackingActive = !isKiosk
    && trackingState === "granted"
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

  /* ── Leave queue (customer-initiated cancel) ─────────────────────── */
  async function handleLeaveQueue() {
    if (!ticket?.id) return;
    setLeaving(true);
    const { error: cancelErr } = await supabase
      .from("tickets")
      .update({ status: "cancelled" })
      .eq("id", ticket.id);
    setLeaving(false);
    if (cancelErr) return; // leave the confirm panel open so they can retry
    setConfirmingLeave(false);
    setTicket((prev) => ({ ...prev, status: "cancelled" }));
  }

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

  if (loading) return <Shell brandColor={branch?.brand_color}><div className="text-center py-20 ovline text-ink-mute">Loading…</div></Shell>;
  if (error)   return <Shell brandColor={branch?.brand_color}><div className="text-center py-12 text-ink-soft text-sm">{error}</div></Shell>;

  // Kiosk confirmation screen — large, no personal-device features (no leave-queue,
  // no GPS prompt, no WhatsApp link), and it resets itself for the next walk-in.
  if (isKiosk) {
    return (
      <Shell brandColor={branch?.brand_color}>
        <KioskConfirmation
          ticket={ticket}
          branch={branch}
          service={service}
          position={position}
          avg={avgServiceMin}
          resetIn={kioskResetIn}
          onReset={() => branch?.slug && navigate(`/q/${branch.slug}?kiosk=1`, { replace: true })}
        />
      </Shell>
    );
  }

  return (
    <Shell brandColor={branch?.brand_color}>
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

      {/* Need help while waiting — direct line to a live person, not just a static page */}
      {(ticket.status === "waiting" || ticket.status === "serving") && (
        <NeedHelpCard branch={branch} ticket={ticket} />
      )}

      {/* Leave queue — customer-initiated cancel, with a confirm step */}
      {ticket.status === "waiting" && (
        <LeaveQueueCard
          confirming={confirmingLeave}
          leaving={leaving}
          onRequest={() => setConfirmingLeave(true)}
          onCancel={() => setConfirmingLeave(false)}
          onConfirm={handleLeaveQueue}
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

/* ── Kiosk confirmation screen ────────────────────────────────────────
   Shown on the shared iPad right after a walk-in checks in. Big and simple
   on purpose — this is read from across a counter, not held in a hand —
   and it auto-resets so the next person isn't stuck looking at someone
   else's ticket. */
function KioskConfirmation({ ticket, branch, service, position, avg, resetIn, onReset }) {
  const etaMin = position == null ? null : Math.max(1, position * avg);
  const served = ticket.status === "serving";
  const done = ticket.status === "completed" || ticket.status === "cancelled" || ticket.status === "no_show";

  return (
    <LuxeFrame className="p-10 text-center">
      <div className="ovline text-[#9bbd9b] mb-4 flex items-center justify-center gap-2">
        <span className="pip breathe" />
        {served ? "You're up now" : done ? "All set" : "You're in the queue!"}
      </div>

      <div className="gold-text font-display text-8xl font-light tracking-tightest leading-none">
        {ticket.token}
      </div>
      <div className="text-base text-ink-soft mt-4 tracking-wide">
        {ticket.customer_name}
      </div>

      <div className="rule-ornament my-6 text-[8px]"><span>✦</span></div>

      {!done && (
        <div className="grid grid-cols-2 gap-px bg-line border border-line">
          <div className="bg-bg-elev p-4 text-center">
            <div className="ovline text-[9px]">Service</div>
            <div className="text-base mt-1">{service?.name ?? "—"}</div>
          </div>
          <div className="bg-bg-elev p-4 text-center">
            <div className="ovline text-[9px]">{served ? "Status" : "Est. wait"}</div>
            <div className="font-display text-xl mt-1 gold-text-soft">
              {served ? "Now serving" : etaMin == null ? "—" : `~${etaMin}m`}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 text-[11px] text-ink-mute tracking-wide">
        {branch?.wa_phone
          ? "A text confirmation has been sent to your phone."
          : "Please keep an eye on the screen for your number."}
      </div>

      <button
        onClick={onReset}
        className="mt-6 text-[10px] tracking-[0.2em] uppercase text-gold-soft hover:text-gold transition"
      >
        Check in next customer ({resetIn}s) →
      </button>
    </LuxeFrame>
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
      <p className="text-ink-soft text-xs leading-relaxed mb-6">
        {t("ticket.thanks_visit", { branchName: branch?.name })}
      </p>

      <Link
        to={`/survey/${branch?.slug}?ticket=${ticket.id}`}
        className="inline-block w-full mb-5"
      >
        <div className="border border-gold-deep bg-[rgba(201,168,106,0.06)] hover:bg-[rgba(201,168,106,0.12)] transition px-5 py-4 text-center">
          <div className="text-base text-gold-soft tracking-wider mb-1">
            ★ ★ ★ ★ ★
          </div>
          <div className="text-[11px] text-ink tracking-wide">Rate your visit</div>
        </div>
      </Link>

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

/* ── Need help card — direct path to a live person ──────────────────── */
function NeedHelpCard({ branch, ticket }) {
  if (!branch?.wa_enabled || !branch?.wa_phone) return null;

  const msg = encodeURIComponent(
    `Hi, I'm waiting on ticket ${ticket?.token ?? ""} at ${branch?.name ?? "your branch"} and need some help.`
  );
  const href = `https://wa.me/${branch.wa_phone.replace(/\D/g, "")}?text=${msg}`;

  return (
    <div className="mt-6 border border-line bg-bg-elev p-5 flex items-center justify-between gap-4">
      <div>
        <div className="ovline text-[9px] text-gold-soft mb-1">Need help?</div>
        <div className="text-[11px] text-ink-mute leading-relaxed">
          Message us on WhatsApp and a team member will reply directly.
        </div>
      </div>
      <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0">
        <Button size="sm">Message us →</Button>
      </a>
    </div>
  );
}

/* ── Leave queue — link + inline "are you sure?" confirm panel ───────── */
function LeaveQueueCard({ confirming, leaving, onRequest, onCancel, onConfirm }) {
  if (!confirming) {
    return (
      <div className="mt-4 text-center">
        <button
          onClick={onRequest}
          className="text-[11px] text-ink-mute hover:text-[#d49185] tracking-wide transition underline-offset-2 hover:underline"
        >
          Leave queue
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 border border-[#b56b5f]/30 bg-[#b56b5f]/08 p-5">
      <div className="text-[11px] text-[#d49185] font-medium mb-1">Leave the queue?</div>
      <p className="text-[11px] text-ink-soft leading-relaxed mb-4">
        Are you sure? You'll lose your spot and will need to check in again to rejoin.
      </p>
      <div className="flex items-center gap-3">
        <Button onClick={onConfirm} disabled={leaving} size="sm">
          {leaving ? "Leaving…" : "Yes, leave queue"}
        </Button>
        <button
          onClick={onCancel}
          disabled={leaving}
          className="text-[11px] text-ink-mute hover:text-ink transition disabled:opacity-40"
        >
          Stay in queue
        </button>
      </div>
    </div>
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
function Shell({ children, brandColor }) {
  const { t } = useTranslation();
  const color = brandColor || "#b8955a";
  const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
  const mix = (v,t2,a) => Math.round(v+(t2-v)*a).toString(16).padStart(2,"0");
  const soft = `#${mix(r,255,0.25)}${mix(g,255,0.25)}${mix(b,255,0.25)}`;
  const deep = `#${mix(r,0,0.22)}${mix(g,0,0.22)}${mix(b,0,0.22)}`;
  return (
    <div
      className="min-h-screen bg-bg text-ink flex flex-col relative overflow-hidden"
      style={{ "--aq-brand": color, "--aq-brand-soft": soft, "--aq-brand-deep": deep }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[420px] pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 80% at 50% 0%, rgba(184,149,90,0.07), transparent 70%)",
        }}
      />
      <header className="relative px-6 py-4 border-b border-line/70 flex items-center justify-between backdrop-blur-sm bg-bg/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gold rounded-sm flex items-center justify-center font-display text-[#141410] text-[10px] shadow-[0_0_24px_rgba(201,168,106,0.3)]">AQ</div>
          <span className="font-display text-base tracking-tightest">AzQueue</span>
        </div>
        <LanguagePicker />
      </header>
      <main className="relative flex-1 max-w-md w-full mx-auto px-6 py-8">
        {children}
      </main>
      <footer className="relative px-6 py-4 border-t border-line/70 text-[9px] text-ink-mute tracking-[0.2em] uppercase text-center bg-bg/60">
        {t("common.powered_by", { defaultValue: "Powered by" })} · azqueue.io · secured by 256-bit encryption
      </footer>
    </div>
  );
}

function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
