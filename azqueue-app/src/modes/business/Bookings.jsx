import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { findOrCreateCustomer, logQueueEvent, generatePersona } from "../../lib/customers";
import { getEffectiveChecklist, buildChecklistMessage } from "../../lib/checklists";
import { sendMessage } from "../../lib/messaging";
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

    const { error } = await supabase.from("bookings").insert({
      branch_id: branch.id,
      service_id: serviceId,
      staff_id: staffId || null,
      customer_id: linkedCustomer?.id ?? null,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      scheduled_at: new Date(scheduledAt).toISOString(),
      status: "confirmed",
    });
    setBusy(false);
    if (error) return setError(error.message);

    // Non-blocking: generate persona, send checklist
    const svcName = services.find((s) => s.id === serviceId)?.name ?? "General";
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
          <Button variant="ghost" size="sm" onClick={() => exportBookings(bookings, services, branch)}>
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
          return (
            <div key={b.id} className="grid grid-cols-[100px_1fr_1fr_120px_120px] px-5 py-3 border-b border-line last:border-b-0 items-center">
              <span className="font-mono text-gold-soft text-xs">{time}</span>
              <span className="text-xs">{b.customer_name}</span>
              <span className="text-xs text-ink-soft">{svc?.name ?? "—"}</span>
              <Badge variant={b.status === "confirmed" ? "conf" : b.status === "arrived" ? "walk" : "due"}>
                {b.status}
              </Badge>
              <BookingActions booking={b} onChange={(s) => setStatus(b.id, s)} />
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

function BookingActions({ booking, onChange }) {
  if (booking.status === "arrived" || booking.status === "no_show" || booking.status === "cancelled") return null;
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="ghost" onClick={() => onChange("arrived")}>Arrived</Button>
      <Button size="sm" variant="ghost" onClick={() => onChange("no_show")}>No-show</Button>
      <Button size="sm" variant="ghost" onClick={() => onChange("cancelled")}>Cancel</Button>
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
