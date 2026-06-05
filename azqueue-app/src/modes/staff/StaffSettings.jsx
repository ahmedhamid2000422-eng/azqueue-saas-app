import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";
import { useStaffMembership } from "../../hooks/useStaffMembership";
import Card, { CardHeader } from "../../components/Card";
import Button from "../../components/Button";

/**
 * StaffSettings — personal settings for a staff member.
 *
 * Sections:
 *   · Profile      — edit display name
 *   · Security     — send password reset email
 *   · Notifications — toggle SMS alerts when it's their turn to call
 *   · Station      — choose which window/station they're working at
 */
export default function StaffSettings() {
  const { user } = useAuth();
  const { primary, reload: reloadMembership } = useStaffMembership();

  // ── Profile ──────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null); // { ok, text }

  useEffect(() => {
    if (primary?.display_name) setDisplayName(primary.display_name);
  }, [primary?.display_name]);

  async function saveProfile(e) {
    e.preventDefault();
    if (!primary?.id || !displayName.trim()) return;
    setSavingProfile(true);
    setProfileMsg(null);
    const { error } = await supabase
      .from("staff")
      .update({ display_name: displayName.trim() })
      .eq("id", primary.id);
    setSavingProfile(false);
    if (error) {
      setProfileMsg({ ok: false, text: "Couldn't save — please try again." });
    } else {
      reloadMembership();
      setProfileMsg({ ok: true, text: "Name updated." });
    }
  }

  // ── Password reset ────────────────────────────────────────────
  const { sendPasswordReset } = useAuth();
  const [resetSent, setResetSent] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  async function handlePasswordReset() {
    if (!user?.email) return;
    setResetBusy(true);
    await sendPasswordReset(user.email);
    setResetBusy(false);
    setResetSent(true);
  }

  // ── Notifications ─────────────────────────────────────────────
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [savingNotif, setSavingNotif] = useState(false);

  useEffect(() => {
    // Load from staff row if column exists
    if (primary && "notifications_enabled" in primary) {
      setNotifEnabled(primary.notifications_enabled ?? true);
    }
  }, [primary]);

  async function toggleNotif() {
    if (!primary?.id) return;
    const next = !notifEnabled;
    setNotifEnabled(next);
    setSavingNotif(true);
    await supabase
      .from("staff")
      .update({ notifications_enabled: next })
      .eq("id", primary.id);
    setSavingNotif(false);
  }

  // ── Station assignment ────────────────────────────────────────
  const [stations,       setStations]       = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [savingStation,  setSavingStation]  = useState(false);
  const [stationMsg,     setStationMsg]     = useState(null);

  useEffect(() => {
    if (!primary?.branch_id) return;
    supabase
      .from("stations")
      .select("id, name, window_number")
      .eq("branch_id", primary.branch_id)
      .order("window_number", { ascending: true })
      .then(({ data }) => setStations(data ?? []));
  }, [primary?.branch_id]);

  useEffect(() => {
    if (primary?.station_id) setSelectedStation(primary.station_id);
  }, [primary?.station_id]);

  async function saveStation() {
    if (!primary?.id) return;
    setSavingStation(true);
    setStationMsg(null);
    const { error } = await supabase
      .from("staff")
      .update({ station_id: selectedStation })
      .eq("id", primary.id);
    setSavingStation(false);
    if (error) {
      setStationMsg({ ok: false, text: "Couldn't save station — please try again." });
    } else {
      reloadMembership();
      setStationMsg({ ok: true, text: "Station saved." });
    }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto px-6 py-10 space-y-6">

      <div className="mb-2">
        <h1 className="font-display text-2xl font-light tracking-tightest text-ink mb-1">Settings</h1>
        <p className="text-ink-mute text-xs">Manage your profile and preferences.</p>
      </div>

      {/* ── Profile ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>Profile</CardHeader>
        <div className="p-5 space-y-4">
          <div>
            <label className="ovline text-[9px] text-ink-mute block mb-2">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-bg-elev border border-line focus:border-gold-deep outline-none px-4 py-2.5 text-sm text-ink placeholder:text-ink-mute transition"
              placeholder="Your name"
            />
          </div>

          {profileMsg && (
            <p className={`text-[11px] ${profileMsg.ok ? "text-[#9bbd9b]" : "text-[#d49185]"}`}>
              {profileMsg.text}
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-ink-mute">
              Shown to customers and on the TV display.
            </p>
            <Button
              size="sm"
              onClick={saveProfile}
              disabled={savingProfile || !displayName.trim()}
            >
              {savingProfile ? "Saving…" : "Save name"}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Security ────────────────────────────────────────── */}
      <Card>
        <CardHeader>Security</CardHeader>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-ink mb-1">Password</p>
              <p className="text-[11px] text-ink-mute leading-relaxed">
                We'll send a reset link to{" "}
                <span className="text-ink">{user?.email ?? "your email"}</span>.
              </p>
              {resetSent && (
                <p className="text-[11px] text-[#9bbd9b] mt-2">
                  Reset link sent — check your inbox.
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePasswordReset}
              disabled={resetBusy || resetSent}
            >
              {resetSent ? "Sent ✓" : resetBusy ? "Sending…" : "Reset password"}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Notifications ───────────────────────────────────── */}
      <Card>
        <CardHeader>Notifications</CardHeader>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink mb-1">Queue alerts</p>
              <p className="text-[11px] text-ink-mute leading-relaxed max-w-xs">
                Receive an SMS when a new customer is waiting and you're available.
              </p>
            </div>
            <button
              onClick={toggleNotif}
              disabled={savingNotif}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                notifEnabled ? "bg-gold" : "bg-line"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-[#141410] shadow transition-transform ${
                  notifEnabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </Card>

      {/* ── Station assignment ──────────────────────────────── */}
      {stations.length > 0 && (
        <Card>
          <CardHeader>Station</CardHeader>
          <div className="p-5 space-y-4">
            <p className="text-[11px] text-ink-mute">
              Select the window or counter you're working at today.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {stations.map((s) => {
                const active = selectedStation === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStation(s.id)}
                    className={`p-3 border text-left transition ${
                      active
                        ? "border-gold bg-[rgba(201,168,106,0.08)] text-gold-soft"
                        : "border-line text-ink-soft hover:border-[#3a3a3f] hover:text-ink"
                    }`}
                  >
                    <div className="text-xs font-medium">
                      Window {s.window_number}
                    </div>
                    <div className="text-[10px] text-ink-mute mt-0.5">{s.name}</div>
                  </button>
                );
              })}
            </div>

            {stationMsg && (
              <p className={`text-[11px] ${stationMsg.ok ? "text-[#9bbd9b]" : "text-[#d49185]"}`}>
                {stationMsg.text}
              </p>
            )}

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={saveStation}
                disabled={savingStation || !selectedStation}
              >
                {savingStation ? "Saving…" : "Save station"}
              </Button>
            </div>
          </div>
        </Card>
      )}

    </div>
  );
}
