import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useStaffMembership } from "../../hooks/useStaffMembership";
import Card, { CardHeader } from "../../components/Card";

/**
 * StaffWaiting — live list of everyone currently waiting at this branch.
 *
 * Lets staff see the full queue so they can anticipate who's next,
 * spot priority tickets, and coordinate with teammates.
 *
 * No mutations here — read-only view. Realtime subscription keeps it current.
 */
export default function StaffWaiting() {
  const { primary, loading: membershipLoading } = useStaffMembership();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading]  = useState(true);

  const reload = useCallback(async () => {
    if (!primary?.branch_id) return;
    const { data } = await supabase
      .from("tickets")
      .select("id, token, status, customer_name, customer_phone, service_id, staff_id, priority, source, created_at, called_at")
      .eq("branch_id", primary.branch_id)
      .in("status", ["waiting", "serving"])
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true });
    setTickets(data ?? []);
    setLoading(false);
  }, [primary?.branch_id]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!primary?.branch_id) return;
    const ch = supabase
      .channel(`staff-waiting-${primary.branch_id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "tickets", filter: `branch_id=eq.${primary.branch_id}` },
        () => reload()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [primary?.branch_id, reload]);

  const waiting = useMemo(() => tickets.filter((t) => t.status === "waiting"), [tickets]);
  const serving = useMemo(() => tickets.filter((t) => t.status === "serving"), [tickets]);

  function waitMinutes(ticket) {
    if (!ticket.created_at) return null;
    return Math.floor((Date.now() - new Date(ticket.created_at)) / 60000);
  }

  if (membershipLoading || loading) {
    return (
      <div className="p-8 text-ink-mute ovline text-center py-20">Loading queue…</div>
    );
  }

  return (
    <div className="atmosphere-hero p-8 max-w-4xl">
      <header className="mb-6">
        <div className="ovline mb-2 text-gold-soft flex items-center gap-2">
          <span className="pip breathe" /> Live queue
        </div>
        <h1 className="font-display text-3xl font-light tracking-tightest">
          {primary?.branches?.name ?? "Branch"} · Waiting list
        </h1>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="border border-line p-4 text-center">
          <div className="ovline text-[9px] text-ink-mute mb-1">Waiting</div>
          <div className="font-display text-3xl gold-text-soft">{waiting.length}</div>
        </div>
        <div className="border border-line p-4 text-center">
          <div className="ovline text-[9px] text-ink-mute mb-1">Being served</div>
          <div className="font-display text-3xl gold-text-soft">{serving.length}</div>
        </div>
      </div>

      {/* Now being served */}
      {serving.length > 0 && (
        <Card luxe className="mb-4">
          <CardHeader
            title="Now being served"
            right={<span className="ovline text-[9px] text-gold-soft">{serving.length} at counter</span>}
          />
          <div className="divide-y divide-line">
            {serving.map((t) => (
              <div key={t.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-display text-gold text-lg">{t.token}</span>
                  <div>
                    <div className="text-sm text-ink">{t.customer_name}</div>
                    {t.customer_phone && (
                      <div className="text-[10px] text-ink-mute">{t.customer_phone}</div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="ovline text-[9px] text-[#9bbd9b]">Serving</span>
                  {t.called_at && (
                    <div className="text-[10px] text-ink-mute mt-0.5">
                      {Math.floor((Date.now() - new Date(t.called_at)) / 60000)} min
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Waiting list */}
      <Card luxe>
        <CardHeader
          title="Waiting"
          right={<span className="ovline text-[9px] text-ink-mute">{waiting.length} in queue</span>}
        />
        {waiting.length === 0 ? (
          <div className="px-5 py-12 text-center text-xs text-ink-mute">
            Queue is empty — no one waiting right now.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {waiting.map((t, i) => {
              const waited = waitMinutes(t);
              const isLong = waited != null && waited > 15;
              return (
                <div
                  key={t.id}
                  className="px-5 py-3 flex items-center justify-between hover:bg-[rgba(201,168,106,0.02)] transition"
                >
                  <div className="flex items-center gap-4">
                    <span className="ovline text-[9px] text-ink-mute w-5 text-right">{i + 1}</span>
                    <span className="font-display text-gold-soft text-base">{t.token}</span>
                    <div>
                      <div className="text-sm text-ink">{t.customer_name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {t.source === "booking" && (
                          <span className="ovline text-[8px] text-ink-mute">Booking</span>
                        )}
                        {(t.priority ?? 0) > 0 && (
                          <span className="ovline text-[8px] text-gold-soft">★ Priority</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {waited != null && (
                      <div className={`text-xs ${isLong ? "text-[#d49185]" : "text-ink-mute"}`}>
                        {waited} min
                      </div>
                    )}
                    <div className="ovline text-[8px] text-ink-mute mt-0.5">waiting</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {waiting.length > 0 && (
          <div className="px-5 py-3 border-t border-line text-[10px] text-ink-mute italic font-display">
            Times shown are how long each customer has been waiting. Red = over 15 min.
          </div>
        )}
      </Card>
    </div>
  );
}
