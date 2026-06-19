import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { findOrCreateCustomer, logQueueEvent, generatePersona } from "../../lib/customers";
import { getEffectiveChecklist, buildChecklistMessage } from "../../lib/checklists";
import { sendMessage } from "../../lib/messaging";
import { sendSlackNotification } from "../../lib/slack";
import { sendBookingConfirmation } from "../../lib/notifications";
import { useBranch } from "../../lib/BranchContext";
import { downloadCSV, exportFilename } from "../../lib/export";
import Button from "../../components/Button";
import Card, { CardHeader } from "../../components/Card";
import Badge from "../../components/Badge";

export default function Bookings() {
  const { branch, dbReady } = useBranch();
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  // form
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d.toISOString().slice(0, 16); // datetime-local format
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Checklist resend: bookingId → "sending" | "sent" | "error"
  const [checklistSent, setChecklistSent] = useState({});

  // Detail panel
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [customerProfile, setCustomerProfile] = useState(null);

  async function load() {
    if (!branch?.id) return;
    setLoading(true);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

    const [{ data: bks }, { data: svcs }, { data: stf }] = await Promise.all([
      supabase.from("bookings")
        .select("*")
        .eq("branch_id", branch.id)
        .gte("scheduled_at", todayStart.toISOString())
        .lt("scheduled_at",  todayEnd.toISOString())
        .order("scheduled_at"),
      supabase.from("services").select("id, name, duration_min").eq("branch_id", branch.id).eq("active", true).order("name"),
      supabase.from("staff").select("id, display_name").eq("branch_id", branch.id).order("display_name"),
    ]);
    setBookings(bks ?? []);
    setServices(svcs ?? []);
    setStaff(stf ?? []);
    if (svcs?.length && !serviceId) setServiceId(svcs[0].id);
    setLoading(false);
  }

  useEffect(() => { load(); }, [branch?.id]);

  // realtime — appear on dashboard the moment a booking is added
  useEffect(() => {
    if (!branch?.id) return;
    const ch = supabase
      .channel(`branch-${branch.id}-bookings`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `branch_id=eq.${branch.id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [branch?.id]);

  async function add() {
    setError(null);
    if (!name.trim() || !phone.trim() || !serviceId || !scheduledAt) {
      return setError("Fill in name, phone, service and time.");
    }
    setBusy(true);

    // Resolve/create the customer record up front so we can link the booking
    // to it directly — this is what powers gym-mode student tracking
    // (sessions attended, no-show strikes) on the Classes roster.
    let linkedCustomer = null;
    if (name.trim() || phone.trim()) {
      try {
        linkedCustomer = await findOrCreateCustomer(branch.id, { name: name.trim(), phone: phone.trim() });
      } catch { /* non-fatal — booking still proceeds without a linked profile */ }
    }

    const { data: newBooking, error } = await supabase.from("bookings").insert({
      branch_id: branch.id,
      service_id: serviceId,
      staff_id: staffId || null,
      customer_id: linkedCustomer?.id ?? null,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      scheduled_at: new Date(scheduledAt).toISOString(),
      status: "confirmed",
    }).select("id").single();
    setBusy(false);
    if (error) return setError(error.message);

    // WhatsApp booking confirmation (QA bug B8) — this was previously never
    // sent for staff-created bookings; only a Slack notice to the assigned
    // staff member, plus a checklist message IF the service required one.
    // A plain confirmation should always go out regardless of checklist.
    if (newBooking?.id) {
      sendBookingConfirmation(newBooking.id).catch(() => {});
    }

    // Non-blocking: generate persona, send checklist
    const svcName = services.find((s) => s.id === serviceId)?.name ?? "General";

    // Notify Slack who got assigned, what the task is, and when — no-ops
    // silently if Slack isn't connected or no staff member was assigned.
    if (staffId) {
      const staffName = staff.find((s) => s.id === staffId)?.display_name ?? "Unassigned";
      const when = new Date(scheduledAt).toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      });
      sendSlackNotification(
        branch.id,
        `📅 *${staffName}* was assigned *${svcName}* for ${name.trim()} — ${when}`
      ).catch(() => {});
    }

    if (linkedCustomer) {
      Promise.resolve(linkedCustomer)
        .then((customer) => {
          // Generate persona so staff have a profile ready when the customer arrives
          generatePersona(customer.id, branch.id).catch(() => {});

          // Send document checklist if this service requires one
          const checklist = getEffectiveChecklist(branch.id, svcName);
          if (checklist?.needsChecklist && checklist.items.length > 0 && phone.trim()) {
            const msg = buildChecklistMessage({
              customerName: name.trim(),
              businessName: branch.name,
              serviceName:  svcName,
              token: "see your booking confirmation",
              checklist,
            });
            sendMessage(branch.id, customer, "whatsapp", msg, null).catch(() => {});
          }
        })
        .catch(() => {});
    }

    setName(""); setPhone(""); setShowForm(false);
    load();
  }

  async function openDetail(booking) {
    setSelectedBooking(booking);
    setCustomerProfile(null);
    if (booking.customer_id) {
      const { data } = await supabase
        .from("customers")
        .select("id, name, phone, sessions_attended, no_show_strikes, student_track, persona_summary, created_at")
        .eq("id", booking.customer_id)
        .single();
      setCustomerProfile(data ?? null);
    }
  }

  async function setStatus(id, status) {
    setError(null);
    // 1. Mark the booking
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) return setError(error.message);

    // 2. When a booked customer arrives, create a live queue ticket for them
    //    so staff can call them and route them to a station.
    if (status === "arrived") {
      const booking = bookings.find((b) => b.id === id);
      if (booking) {
        const { data: token, error: tErr } = await supabase.rpc("generate_ticket_token", {
          b_id: branch.id,
          src:  "book",
        });
        if (!tErr && token) {
          const { data: newTicket } = await supabase.from("tickets").insert({
            branch_id:      branch.id,
            service_id:     booking.service_id   ?? null,
            staff_id:       booking.staff_id     ?? null,
            token,
            source:         "book",
            status:         "waiting",
            customer_name:  booking.customer_name  ?? null,
            customer_phone: booking.customer_phone ?? null,
          }).select("id").single();

          // Create / update the customer profile (non-blocking — never fails the arrival)
          if (booking.customer_name || booking.customer_phone) {
            findOrCreateCustomer(branch.id, {
              name:  booking.customer_name,
              phone: booking.customer_phone,
            })
              .then(async (customer) => {
                const arrivalSvc = services.find((s) => s.id === booking.service_id)?.name;
                await logQueueEvent(customer.id, branch.id, "queue_join", {
                  ticketId: newTicket?.id,
                  token,
                  service: arrivalSvc,
                }).catch(() => {});
                // Refresh persona with latest data so staff see an up-to-date profile
                generatePersona(customer.id, branch.id).catch(() => {});
              })
              .catch(() => {});
          }
        }
      }
    }

    // 3. Refresh the list — realtime will also fire, but explicit reload is faster
    load();
  }

  // Manually re-send the document checklist to a customer via WhatsApp
  async function resendChecklist(booking) {
    if (!booking.customer_phone) return;
    setChecklistSent((prev) => ({ ...prev, [booking.id]: "sending" }));
    const svcName = services.find((s) => s.id === booking.service_id)?.name ?? "General";
    try {
      const checklist = getEffectiveChecklist(branch.id, svcName);
      if (!checklist?.needsChecklist || checklist.items.length === 0) {
        // No checklist configured for this service — send a plain confirmation instead
        const msg = `Hi ${booking.customer_name ?? "there"}, this is a reminder of your upcoming appointment for ${svcName} at ${branch.name}. Please bring any relevant documents. Thank you!`;
        const customer = await findOrCreateCustomer(branch.id, {
          name: booking.customer_name,
          phone: booking.customer_phone,
        });
        await sendMessage(branch.id, customer, "whatsapp", msg, null);
      } else {
        const msg = buildChecklistMessage({
          customerName: booking.customer_name ?? "Customer",
          businessName: branch.name,
          serviceName:  svcName,
          token: "see your booking confirmation",
          checklist,
        });
        const customer = await findOrCreateCustomer(branch.id, {
          name: booking.customer_name,
          phone: booking.customer_phone,
        });
        await sendMessage(branch.id, customer, "whatsapp", msg, null);
      }
      setChecklistSent((prev) => ({ ...prev, [booking.id]: "sent" }));
      setTimeout(() => setChecklistSent((prev) => {
        const next = { ...prev }; delete next[booking.id]; return next;
      }), 4000);
    } catch {
      setChecklistSent((prev) => ({ ...prev, [booking.id]: "error" }));
      setTimeout(() => setChecklistSent((prev) => {
        const next = { ...prev }; delete next[booking.id]; return next;
      }), 4000);
    }
  }

  if (!dbReady) {
    return <div className="p-8 max-w-xl"><h1 className="font-display text-3xl font-light tracking-tightest mb-3">Bookings</h1><p className="text-ink-soft text-sm">Run the database migration to enable bookings.</p></div>;
  }
  if (!branch) return <div className="p-8 text-ink-mute ovline">Select a branch.</div>;

  const todayLabel = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });

  return (
    <div className="atmosphere-hero p-8 max-w-6xl">
      <header className="flex justify-between items-start mb-8">
        <div>
          <div className="ovline mb-2 text-gold-soft">Live · today's bookings</div>
          <h1 className="font-display text-4xl font-light tracking-tightest">Bookings</h1>
          <div className="text-xs text-ink-soft mt-2">
            {bookings.length} today <span className="text-ink-mute">·</span> {todayLabel} <span className="text-ink-mute">·</span> {branch.name}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              try {
                exportBookings(bookings, services, branch);
              } catch (err) {
                setError(err?.message ?? "Could not export CSV.");
              }
            }}
          >
            Export CSV
          </Button>
          <Button onClick={() => setShowForm((x) => !x)}>
            {showForm ? "Cancel" : "+ New booking"}
          </Button>
        </div>
      </header>

      {/* Error banner — visible even when the new-booking form is closed */}
      {error && !showForm && (
        <div className="mb-3 text-[11px] text-[#d49185] bg-[#b56b5f]/10 border border-[#b56b5f]/30 px-3 py-2">
          {error}
        </div>
      )}

      {showForm && (
        <Card luxe className="p-6 mb-3">
          <div className="ovline text-gold-soft mb-3">New booking</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <Field label="Name" value={name} onChange={setName} placeholder="Customer name" />
            <Field label="Phone" value={phone} onChange={setPhone} placeholder="+60 12 ..." />
            <Select label="Service" value={serviceId} onChange={setServiceId}
              options={services.map((s) => [s.id, `${s.name} · ${s.duration_min}m`])} />
            <Select label="Staff (optional)" value={staffId} onChange={setStaffId}
              options={[["", "Any"], ...staff.map((s) => [s.id, s.display_name])]} />
            <Field label="When" type="datetime-local" value={scheduledAt} onChange={setScheduledAt} />
          </div>
          {error && <div className="text-[11px] text-[#d49185] mt-3">{error}</div>}
          <div className="rule-ornament my-4 text-[8px]"><span>·</span></div>
          <Button onClick={add} disabled={busy}>{busy ? "Saving…" : "Save booking"}</Button>
        </Card>
      )}

      {/* Detail panel overlay */}
      {selectedBooking && (
        <BookingDetailPanel
          booking={selectedBooking}
          service={services.find((s) => s.id === selectedBooking.service_id)}
          staffMember={staff.find((s) => s.id === selectedBooking.staff_id)}
          customerProfile={customerProfile}
          checklistState={checklistSent[selectedBooking.id]}
          onClose={() => { setSelectedBooking(null); setCustomerProfile(null); }}
          onStatusChange={(status) => { setStatus(selectedBooking.id, status); setSelectedBooking((b) => b ? { ...b, status } : b); }}
          onResendChecklist={() => resendChecklist(selectedBooking)}
        />
      )}

      <Card luxe>
        <CardHeader title="Today's bookings" subtitle="Confirmed customers expected" right={<span className="ovline text-[9px]">{bookings.length}</span>} />
        <div className="grid grid-cols-[100px_1fr_1fr_120px_120px] px-5 py-2.5 border-b border-line bg-[rgba(201,168,106,0.03)]">
          {["Time", "Name", "Service", "Status", ""].map((h, i) => (
            <div key={i} className="ovline text-[8px]">{h}</div>
          ))}
        </div>
        {loading ? (
          <div className="px-5 py-10 text-center text-ink-mute text-xs">Loading…</div>
        ) : bookings.length === 0 ? (
          <div className="px-5 py-10 text-center text-ink-mute text-xs">No bookings for today yet.</div>
        ) : bookings.map((b) => {
          const svc = services.find((s) => s.id === b.service_id);
          const time = new Date(b.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const isSelected = selectedBooking?.id === b.id;
          return (
            <div
              key={b.id}
              onClick={() => openDetail(b)}
              className={`grid grid-cols-[90px_1fr_1fr_110px_1fr] px-5 py-3 border-b border-line last:border-b-0 items-center gap-2 cursor-pointer transition-colors ${isSelected ? "bg-[rgba(201,168,106,0.05)]" : "hover:bg-[rgba(255,255,255,0.02)]"}`}
            >
              <span className="font-mono text-gold-soft text-xs">{time}</span>
              <div>
                <div className="text-xs">{b.customer_name}</div>
                {b.customer_phone && (
                  <div className="text-[10px] text-ink-mute font-mono">{b.customer_phone}</div>
                )}
              </div>
              <span className="text-xs text-ink-soft">{svc?.name ?? "—"}</span>
              <Badge variant={b.status === "confirmed" ? "conf" : b.status === "arrived" ? "walk" : "due"}>
                {b.status}
              </Badge>
              <BookingActions
                booking={b}
                onChange={(s) => setStatus(b.id, s)}
                onResendChecklist={() => resendChecklist(b)}
                checklistState={checklistSent[b.id]}
              />
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function exportBookings(bookings, services, branch) {
  const svcMap = Object.fromEntries(services.map((s) => [s.id, s.name]));
  const rows = bookings.map((b) => ({
    time:    new Date(b.scheduled_at).toLocaleString(),
    name:    b.customer_name,
    phone:   b.customer_phone,
    service: svcMap[b.service_id] ?? "",
    status:  b.status,
  }));
  downloadCSV(exportFilename(branch?.slug, "bookings"), rows, [
    { key: "time",    label: "Time"    },
    { key: "name",    label: "Name"    },
    { key: "phone",   label: "Phone"   },
    { key: "service", label: "Service" },
    { key: "status",  label: "Status"  },
  ]);
}


function BookingDetailPanel({ booking, service, staffMember, customerProfile, checklistState, onClose, onStatusChange, onResendChecklist }) {
  const isDone = booking.status === "arrived" || booking.status === "no_show" || booking.status === "cancelled";
  const fmt = (dt) => dt ? new Date(dt).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

  const statusColor = {
    confirmed: "#b8955a",
    pending:   "#60a5fa",
    arrived:   "#4ade80",
    no_show:   "#f87171",
    cancelled: "#6b7280",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 40, backdropFilter: "blur(2px)" }}
      />
      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 420, maxWidth: "100vw",
        background: "#0f0e0d", borderLeft: "1px solid rgba(255,255,255,0.07)",
        zIndex: 50, display: "flex", flexDirection: "column", overflowY: "auto",
        boxShadow: "-24px 0 64px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "#60605a", marginBottom: 4 }}>Booking details</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 400, color: "#f0ede6", fontFamily: "Georgia, serif" }}>
                {new Date(booking.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
                color: statusColor[booking.status] ?? "#60605a",
                border: `1px solid ${statusColor[booking.status] ?? "#60605a"}`,
                padding: "2px 8px", borderRadius: 2,
              }}>{booking.status}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#60605a", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4 }}>&#x2715;</button>
        </div>

        <div style={{ flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Customer */}
          <DSection label="Customer">
            <DRow label="Name"  value={booking.customer_name ?? "—"} />
            <DRow label="Phone" value={booking.customer_phone ?? "—"} mono />
            {customerProfile && (
              <>
                {customerProfile.sessions_attended > 0 && (
                  <DRow label="Sessions attended" value={String(customerProfile.sessions_attended)} highlight />
                )}
                {customerProfile.no_show_strikes > 0 && (
                  <DRow label="No-show strikes" value={String(customerProfile.no_show_strikes)} warn />
                )}
                {customerProfile.student_track && (
                  <DRow label="Track" value={customerProfile.student_track} />
                )}
                {customerProfile.persona_summary && (
                  <div style={{ marginTop: 8, padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 9, color: "#60605a", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>AI profile</div>
                    <div style={{ fontSize: 11, color: "#999896", lineHeight: 1.6 }}>{customerProfile.persona_summary}</div>
                  </div>
                )}
              </>
            )}
            {!customerProfile && booking.customer_id && (
              <div style={{ fontSize: 10, color: "#60605a" }}>Loading profile…</div>
            )}
          </DSection>

          {/* Appointment */}
          <DSection label="Appointment">
            <DRow label="Service"  value={service?.name ?? "—"} />
            {service?.duration_min && <DRow label="Duration" value={`${service.duration_min} min`} />}
            <DRow label="Staff"    value={staffMember?.display_name ?? "Any available"} />
            <DRow label="Date"     value={fmt(booking.scheduled_at)} />
          </DSection>

          {/* Timeline */}
          <DSection label="Timeline">
            <DRow label="Booked at"             value={fmt(booking.created_at)} />
            {booking.confirmed_at     && <DRow label="Customer confirmed" value={fmt(booking.confirmed_at)} highlight />}
            {booking.reminder_sent_at && <DRow label="Reminder sent"      value={fmt(booking.reminder_sent_at)} />}
          </DSection>

          {/* Actions */}
          <DSection label="Actions">
            {!isDone && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                <DBtn onClick={() => onStatusChange("arrived")}  color="#4ade80">&#x2713; Mark arrived</DBtn>
                <DBtn onClick={() => onStatusChange("no_show")}  color="#f87171">&#x2715; No-show</DBtn>
                <DBtn onClick={() => onStatusChange("cancelled")} color="#6b7280">Cancel</DBtn>
              </div>
            )}
            {booking.customer_phone && (
              <DBtn
                onClick={onResendChecklist}
                disabled={checklistState === "sending"}
                color="#b8955a"
              >
                {checklistState === "sent" ? "Sent ✓" : checklistState === "error" ? "Failed ✗" : checklistState === "sending" ? "Sending…" : "📋 Resend checklist"}
              </DBtn>
            )}
          </DSection>

        </div>
      </div>
    </>
  );
}

function DSection({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "#b8955a", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{children}</div>
    </div>
  );
}

function DRow({ label, value, mono, highlight, warn }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontSize: 10, color: "#60605a", flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: mono ? 10 : 11,
        fontFamily: mono ? "monospace" : "inherit",
        color: highlight ? "#4ade80" : warn ? "#f87171" : "#c8c4bc",
        textAlign: "right", wordBreak: "break-all",
      }}>{value}</span>
    </div>
  );
}

function DBtn({ onClick, color, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "transparent",
        border: `1px solid ${disabled ? "rgba(255,255,255,0.1)" : color}`,
        color: disabled ? "#60605a" : color,
        fontSize: 11, padding: "6px 12px", borderRadius: 4,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "opacity 0.15s",
      }}
    >{children}</button>
  );
}

function BookingActions({ booking, onChange, onResendChecklist, checklistState }) {
  const isDone = booking.status === "arrived" || booking.status === "no_show" || booking.status === "cancelled";
  return (
    <div className="flex flex-wrap gap-1 items-center" onClick={(e) => e.stopPropagation()}>
      {!isDone && (
        <>
          <Button size="sm" variant="ghost" onClick={() => onChange("arrived")}>Arrived</Button>
          <Button size="sm" variant="ghost" onClick={() => onChange("no_show")}>No-show</Button>
          <Button size="sm" variant="ghost" onClick={() => onChange("cancelled")}>Cancel</Button>
        </>
      )}
      {booking.customer_phone && (
        <button
          onClick={(e) => { e.stopPropagation(); onResendChecklist(); }}
          disabled={checklistState === "sending"}
          title="Re-send document checklist via WhatsApp"
          className={`text-[10px] px-2 py-1 border leading-none transition-colors ${
            checklistState === "sent"
              ? "border-[#506b50] text-[#9bbd9b]"
              : checklistState === "error"
              ? "border-red-800 text-red-400"
              : checklistState === "sending"
              ? "border-line text-ink-mute cursor-wait"
              : "border-line text-ink-mute hover:border-[#74b9e8] hover:text-[#74b9e8]"
          }`}
        >
          {checklistState === "sent" ? "Sent ✓" : checklistState === "error" ? "Failed ✗" : checklistState === "sending" ? "…" : "📋 Checklist"}
        </button>
      )}
    </div>
  );
}

function Field({ label, type = "text", value, onChange, placeholder }) {
  return (
    <div>
      <div className="ovline mb-1.5 text-[9px]">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-bg-elev border border-line focus:border-gold-deep outline-none text-xs px-3 py-2 transition text-ink placeholder:text-ink-mute"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <div className="ovline mb-1.5 text-[9px]">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg-elev border border-line focus:border-gold-deep outline-none text-xs px-3 py-2 transition text-ink"
      >
        {options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </div>
  );
}
