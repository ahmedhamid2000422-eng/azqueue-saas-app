import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useBranch } from "../../lib/BranchContext";
import Card, { CardHeader } from "../../components/Card";

/**
 * TicketDetail — the "click through for the full picture" page from Overview.
 *
 * Overview's "In line" list can only show one line per person before it
 * becomes the thing it replaced — a wall of text nobody reads. This is where
 * the rest of what's known about one visit actually lives: timing, what they
 * came in for, whether it was escalated and why, who's got it.
 *
 * Mostly for understanding rather than doing — calling and completing happen
 * on the Queue page, where staff already are. The one exception is cancelling:
 * a visit that should never have been in the queue, or a person who left
 * hours ago, has to be closable from wherever you noticed it, and requiring a
 * walk back to the counter is how twelve tickets sat open overnight.
 */
export default function TicketDetail() {
  const { id } = useParams();
  const { branch } = useBranch();
  const navigate = useNavigate();

  const [ticket,  setTicket]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  /* Two-step: the first press asks, the second acts. Cancelling ends
     somebody's visit, and this page is reached by tapping a name in a list —
     easy to open by accident, so it should be hard to fire by accident. */
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id || !branch?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("tickets")
        .select(`
          id, token, status, customer_name, customer_phone, customer_email,
          created_at, called_at, completed_at, expired_at,
          detail, escalated_at, escalated_reason, outcome,
          service:service_id ( name ),
          staff:staff_id ( display_name ),
          station:assigned_station_id ( name )
        `)
        .eq("id", id)
        /* Scoped to the branch already in context, not just the ticket id —
           a shared login should never be able to page through another
           branch's tickets by guessing at the URL. */
        .eq("branch_id", branch.id)
        .maybeSingle();

      if (cancelled) return;

      setTicket(data ?? null);
      setNotFound(!data);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [id, branch?.id]);

  /* Marks the visit cancelled and records expired_at rather than
     completed_at — the same distinction the nightly sweep uses. A cancelled
     visit is not a served one, and writing completed_at here would put a
     fake service time into every average. */
  async function cancelTicket() {
    if (!ticket?.id) return;
    setCancelling(true);
    const { error } = await supabase
      .from("tickets")
      .update({ status: "cancelled", expired_at: new Date().toISOString() })
      .eq("id", ticket.id)
      .eq("branch_id", branch.id);
    setCancelling(false);
    if (error) return;
    setConfirming(false);
    setTicket((t) => ({ ...t, status: "cancelled" }));
  }

  function fmtTime(iso) {
    if (!iso) return null;
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  }

  function fmtDuration(fromIso, toIso) {
    if (!fromIso || !toIso) return null;
    const min = Math.round((new Date(toIso) - new Date(fromIso)) / 60000);
    if (min < 1) return "under a minute";
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)} hr ${min % 60} min`;
  }

  const statusLabel = {
    waiting:   { label: "Waiting",   dot: "#9bbd9b" },
    serving:   { label: "Serving",   dot: "#c9a86a" },
    completed: { label: "Completed", dot: "#888" },
    cancelled: { label: "Cancelled", dot: "#888" },
  };

  return (
    <div className="atmosphere-hero p-8 max-w-2xl">
      {/* navigate(-1) rather than a relative path — this page is only ever
          reached from the Overview list, so browser back always lands there,
          without relying on relative-route math to get the segment count right. */}
      <button
        onClick={() => navigate(-1)}
        className="text-[11px] text-ink-mute hover:text-ink mb-6 flex items-center gap-1"
      >
        ‹ Back to overview
      </button>

      {loading ? (
        <div className="text-ink-mute text-sm">Loading…</div>
      ) : notFound ? (
        <div className="text-ink-mute text-sm">
          That visit isn't found — it may belong to a different branch, or the link is old.
        </div>
      ) : (
        <>
          <header className="mb-8">
            <div className="ovline mb-2 text-gold-soft flex items-center gap-2">
              <span
                className="pip"
                style={{ background: statusLabel[ticket.status]?.dot ?? "#888" }}
              />
              {statusLabel[ticket.status]?.label ?? ticket.status}
              {" · "}Ticket {ticket.token}
            </div>
            <h1 className="font-display text-3xl font-light tracking-tightest">
              {ticket.customer_name || ticket.token}
            </h1>
          </header>

          <Card luxe className="mb-4">
            <CardHeader title="Timing" />
            <div className="px-5 py-4 space-y-2 text-sm">
              <Row label="Checked in" value={fmtTime(ticket.created_at)} />
              <Row label="Called" value={fmtTime(ticket.called_at)} />
              <Row
                label="Finished"
                value={fmtTime(ticket.completed_at || ticket.expired_at)}
              />
              {ticket.created_at && ticket.called_at && (
                <Row label="Wait" value={fmtDuration(ticket.created_at, ticket.called_at)} />
              )}
              {ticket.called_at && ticket.completed_at && (
                <Row label="Service time" value={fmtDuration(ticket.called_at, ticket.completed_at)} />
              )}
            </div>
          </Card>

          <Card luxe className="mb-4">
            <CardHeader title="What they came in for" />
            <div className="px-5 py-4 space-y-2 text-sm">
              <Row label="Service" value={ticket.service?.name || "—"} />
              <Row label="Detail" value={ticket.detail || "Not recorded"} />
              <Row label="Outcome" value={ticket.outcome || "—"} />
            </div>
          </Card>

          {ticket.escalated_at && (
            <Card luxe className="mb-4" style={{ borderColor: "rgba(180,120,100,0.4)" }}>
              <CardHeader title="Escalated" />
              <div className="px-5 py-4 space-y-2 text-sm">
                <Row label="Reason" value={ticket.escalated_reason || "Not given"} />
                <Row label="When" value={fmtTime(ticket.escalated_at)} />
              </div>
            </Card>
          )}

          <Card luxe className="mb-4">
            <CardHeader title="Assigned to" />
            <div className="px-5 py-4 space-y-2 text-sm">
              <Row label="Staff" value={ticket.staff?.display_name || "Not assigned"} />
              <Row label="Station" value={ticket.station?.name || "Not assigned"} />
            </div>
          </Card>

          <Card luxe className="mb-4">
            <CardHeader title="Contact" />
            <div className="px-5 py-4 space-y-2 text-sm">
              <Row label="Phone" value={ticket.customer_phone || "—"} />
              <Row label="Email" value={ticket.customer_email || "—"} />
            </div>
          </Card>

          {/* Only offered while the visit is actually open. A completed or
              already-cancelled ticket has nothing to cancel, and showing a
              live destructive button next to finished work invites the
              accident it is guarding against. */}
          {(ticket.status === "waiting" || ticket.status === "serving") && (
            <div className="mt-6 pt-5 border-t border-line">
              {!confirming ? (
                <button
                  onClick={() => setConfirming(true)}
                  className="text-[12px] border border-red-900/60 px-4 py-2 text-[#d49185] hover:border-red-900 hover:bg-red-950/30 transition"
                >
                  Cancel this visit
                </button>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[12.5px] text-ink-soft">
                    Cancel {ticket.customer_name || ticket.token}'s visit?
                  </span>
                  <button
                    onClick={cancelTicket}
                    disabled={cancelling}
                    className="text-[12px] border border-red-900 bg-red-950/40 px-4 py-2 text-[#d49185] hover:bg-red-950/60 transition disabled:opacity-40"
                  >
                    {cancelling ? "…" : "Yes, cancel"}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    className="text-[12px] text-ink-mute hover:text-ink transition"
                  >
                    Keep it
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-ink-mute text-[12px]">{label}</span>
      <span className="text-ink text-right">{value ?? "—"}</span>
    </div>
  );
}
