import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";
import Card, { CardHeader } from "../../components/Card";
import Button from "../../components/Button";

const DUE_OPTIONS = ["Today", "Tomorrow", "Soon", "Someday"];

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [draft, setDraft] = useState("");
  const [draftDue, setDraftDue] = useState("Today");
  const [draftPriority, setDraftPriority] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("done")
      .order("priority", { ascending: false })
      .order("created_at");
    if (error && /relation .* does not exist/i.test(error.message || "")) {
      setDbReady(false);
      setLoading(false);
      return;
    }
    setTasks(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`user-${user.id}-tasks`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `owner_id=eq.${user.id}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  async function add() {
    if (!draft.trim()) return;
    await supabase.from("tasks").insert({
      owner_id: user.id,
      title: draft.trim(),
      due_label: draftDue,
      priority: draftPriority,
    });
    setDraft(""); setDraftPriority(false);
  }

  async function toggle(t) {
    await supabase.from("tasks").update({ done: !t.done }).eq("id", t.id);
  }

  async function del(t) {
    await supabase.from("tasks").delete().eq("id", t.id);
  }

  if (!dbReady) {
    return <div className="p-8 max-w-xl"><h1 className="font-display text-3xl font-light tracking-tightest mb-3">Tasks</h1><p className="text-ink-soft text-sm">Run the personal tables migration (0005) to enable tasks.</p></div>;
  }

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="atmosphere-hero p-8 max-w-3xl">
      <header className="mb-8">
        <div className="ovline mb-2 text-gold-soft">Today · personal flow</div>
        <h1 className="font-display text-4xl font-light tracking-tightest">Tasks</h1>
        <div className="text-xs text-ink-soft mt-2">
          {open.length} open <span className="text-ink-mute">·</span> {done.length} done
        </div>
      </header>

      <Card luxe className="p-5 mb-3">
        <div className="grid sm:grid-cols-[1fr_120px_36px_80px] gap-2 items-stretch">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="What needs doing?"
            className="bg-bg border border-line focus:border-gold-deep outline-none text-sm px-3 py-2 transition text-ink placeholder:text-ink-mute"
          />
          <select
            value={draftDue}
            onChange={(e) => setDraftDue(e.target.value)}
            className="bg-bg border border-line focus:border-gold-deep outline-none text-xs px-3 py-2 text-ink"
          >
            {DUE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setDraftPriority((p) => !p)}
            title="Mark as priority"
            className={`border transition ${draftPriority ? "border-gold-deep bg-gold/[0.08] text-gold" : "border-line text-ink-mute hover:text-ink"}`}
          >
            ★
          </button>
          <Button onClick={add} disabled={!draft.trim()} size="sm">Add</Button>
        </div>
      </Card>

      <Card luxe className="mb-3">
        <CardHeader title="Open" right={<span className="ovline text-[9px]">{open.length}</span>} />
        {loading ? (
          <div className="px-5 py-10 text-center text-ink-mute text-xs">Loading…</div>
        ) : open.length === 0 ? (
          <div className="px-5 py-10 text-center text-ink-mute text-xs">Nothing open. Add one above.</div>
        ) : open.map((t) => (
          <div key={t.id} className="px-5 py-3 border-b border-line last:border-b-0 grid grid-cols-[20px_60px_1fr_24px] gap-3 items-center">
            <button onClick={() => toggle(t)} className={`w-4 h-4 border ${t.priority ? "border-gold" : "border-line-2"} hover:border-gold-soft transition`} />
            <span className="ovline text-[8px]">{t.due_label ?? "Today"}</span>
            <span className="text-sm text-ink truncate">
              {t.priority && <span className="text-gold mr-1">★</span>}
              {t.title}
            </span>
            <button onClick={() => del(t)} className="text-ink-mute hover:text-[#d49185] text-xs">×</button>
          </div>
        ))}
      </Card>

      {done.length > 0 && (
        <Card luxe>
          <CardHeader title="Done today" right={<span className="ovline text-[9px]">{done.length}</span>} />
          {done.map((t) => (
            <div key={t.id} className="px-5 py-2 border-b border-line last:border-b-0 grid grid-cols-[20px_60px_1fr_24px] gap-3 items-center">
              <button onClick={() => toggle(t)} className="w-4 h-4 border border-gold-deep bg-gold-deep flex items-center justify-center text-[10px] text-[#141410]">✓</button>
              <span className="ovline text-[8px] text-ink-mute">{t.due_label ?? "—"}</span>
              <span className="text-xs text-ink-mute line-through truncate">{t.title}</span>
              <button onClick={() => del(t)} className="text-ink-mute hover:text-[#d49185] text-xs">×</button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
