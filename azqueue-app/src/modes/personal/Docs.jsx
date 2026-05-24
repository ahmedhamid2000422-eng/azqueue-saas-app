import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";
import Card from "../../components/Card";
import Button from "../../components/Button";

export default function Docs() {
  const { user } = useAuth();
  const [docs, setDocs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("docs")
      .select("*")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error && /relation .* does not exist/i.test(error.message || "")) {
      setDbReady(false);
      setLoading(false);
      return;
    }
    setDocs(data ?? []);
    if (!activeId && data?.length) {
      setActiveId(data[0].id);
      setTitle(data[0].title || "");
      setBody(data[0].body || "");
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  // Autosave 700ms after typing stops
  useEffect(() => {
    if (!activeId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await supabase.from("docs").update({ title, body }).eq("id", activeId);
      setDocs((ds) => ds.map((d) => d.id === activeId ? { ...d, title, body, updated_at: new Date().toISOString() } : d));
      setSaving(false);
    }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [title, body, activeId]);

  async function newDoc() {
    const { data } = await supabase.from("docs").insert({
      owner_id: user.id,
      title: "Untitled",
      body: "",
    }).select("*").single();
    if (data) {
      setDocs((ds) => [data, ...ds]);
      setActiveId(data.id);
      setTitle(data.title);
      setBody(data.body || "");
    }
  }

  async function pinToggle(d) {
    await supabase.from("docs").update({ pinned: !d.pinned }).eq("id", d.id);
    load();
  }

  async function del(d) {
    await supabase.from("docs").delete().eq("id", d.id);
    if (activeId === d.id) {
      setActiveId(null); setTitle(""); setBody("");
    }
    load();
  }

  function open(d) {
    setActiveId(d.id);
    setTitle(d.title || "");
    setBody(d.body || "");
  }

  if (!dbReady) {
    return <div className="p-8 max-w-xl"><h1 className="font-display text-3xl font-light tracking-tightest mb-3">Docs</h1><p className="text-ink-soft text-sm">Run the personal tables migration (0005) to enable docs.</p></div>;
  }

  const activeDoc = docs.find((d) => d.id === activeId);

  return (
    <div className="grid grid-cols-[260px_1fr] min-h-[calc(100vh-44px)]">
      <aside className="border-r border-line bg-bg-elev flex flex-col">
        <div className="p-4 border-b border-line">
          <Button onClick={newDoc} size="sm" className="w-full">+ New doc</Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-8 text-center text-ink-mute text-xs">Loading…</div>
          ) : docs.length === 0 ? (
            <div className="px-4 py-8 text-center text-ink-mute text-xs">No docs yet.</div>
          ) : docs.map((d) => {
            const active = d.id === activeId;
            return (
              <button
                key={d.id}
                onClick={() => open(d)}
                className={`w-full text-left px-4 py-3 border-b border-line transition ${
                  active ? "bg-[rgba(201,168,106,0.06)] border-l-2 border-l-gold" : "hover:bg-surface-2"
                }`}
              >
                <div className="text-xs text-ink truncate flex items-center gap-2">
                  {d.pinned && <span className="text-gold-soft">★</span>}
                  {d.title || "Untitled"}
                </div>
                <div className="text-[9px] text-ink-mute mt-1">{fmtAgo(d.updated_at)}</div>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="atmosphere-hero p-8 max-w-3xl w-full">
        {!activeId ? (
          <div className="text-ink-mute text-sm py-20 text-center">Select or create a doc.</div>
        ) : (
          <>
            <header className="mb-6 flex items-center justify-between">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled"
                className="bg-transparent border-none outline-none font-display text-3xl font-light tracking-tighter text-ink flex-1"
              />
              <div className="flex items-center gap-3 text-[10px] text-ink-mute">
                {saving ? <span className="ovline text-gold-soft">Saving…</span> : <span className="ovline">Saved</span>}
                <Button variant="ghost" size="sm" onClick={() => activeDoc && pinToggle(activeDoc)}>
                  {activeDoc?.pinned ? "Unpin" : "Pin"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => activeDoc && del(activeDoc)}>Delete</Button>
              </div>
            </header>

            <Card luxe className="p-6">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Start typing — it autosaves."
                className="w-full bg-transparent border-none outline-none text-sm text-ink leading-relaxed min-h-[60vh] resize-none placeholder:text-ink-mute"
              />
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function fmtAgo(iso) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
}
