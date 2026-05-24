import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import Card from "../../components/Card";
import Button from "../../components/Button";

/**
 * AI Assist — Personal Flow co-pilot, backed by the ai-assist edge function
 * which proxies the Anthropic Messages API. Until the function is deployed
 * with ANTHROPIC_API_KEY set, the function returns a friendly dry-run reply
 * so the UI is fully testable.
 */
const STARTERS = [
  "Summarise yesterday for me.",
  "Help me draft a polite reply to the vendor email.",
  "Plan my next 90-min focus block.",
  "Suggest three blog headlines about queue intelligence.",
];

export default function AIAssist() {
  const [messages, setMessages] = useState([]);   // {role, content}
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setError(null);
    setInput("");

    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setBusy(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-assist", {
        body: { messages: next },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error ?? "Request failed");

      setMessages((m) => [...m, { role: "assistant", content: data.content, dryRun: data.dryRun }]);
    } catch (e) {
      setError(e?.message ?? "Could not reach AI Assist. Is the edge function deployed?");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setMessages([]);
    setError(null);
  }

  return (
    <div className="atmosphere-hero p-8 max-w-3xl flex flex-col h-[calc(100vh-44px)]">
      <header className="mb-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="ovline mb-2 text-gold-soft">Personal flow · AI</div>
            <h1 className="font-display text-4xl font-light tracking-tightest">AI Assist</h1>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={reset}>↻ New chat</Button>
          )}
        </div>
        <div className="text-xs text-ink-soft mt-2">
          Quiet, focused, on your terms.
        </div>
      </header>

      <Card luxe className="flex-1 flex flex-col overflow-hidden">
        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
          {messages.length === 0 ? (
            <Empty onPick={(s) => send(s)} />
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} dryRun={m.dryRun} />)}
              {busy && <Bubble role="assistant" content="…" busy />}
            </div>
          )}
        </div>

        {error && (
          <div className="px-6 py-2 text-[11px] text-[#d49185] bg-[#b56b5f]/10 border-t border-[#b56b5f]/30">
            {error}
          </div>
        )}

        {/* Composer */}
        <div className="border-t border-line p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="grid grid-cols-[1fr_auto] gap-2 items-stretch"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything — drafting, summarising, planning…"
              className="bg-bg border border-line focus:border-gold-deep outline-none text-sm px-4 py-3 transition text-ink placeholder:text-ink-mute"
            />
            <Button type="submit" disabled={busy || !input.trim()}>
              {busy ? "…" : "Send →"}
            </Button>
          </form>
          <div className="text-[10px] text-ink-mute mt-2 tracking-wide">
            Backed by Claude. Your conversation isn't stored beyond this session.
          </div>
        </div>
      </Card>
    </div>
  );
}

function Empty({ onPick }) {
  return (
    <div className="text-center py-10">
      <div className="ovline mb-3 text-gold-soft">Try one of these</div>
      <div className="grid sm:grid-cols-2 gap-2 max-w-md mx-auto">
        {STARTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="bg-bg-elev border border-line hover:border-gold-deep text-left p-3 text-[12px] text-ink-soft hover:text-ink transition"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="rule-ornament my-7 text-[8px]"><span>·</span></div>
      <div className="text-[10px] text-ink-mute leading-relaxed max-w-sm mx-auto">
        AI Assist runs over Anthropic's Claude. Until you deploy the edge function and set
        <span className="font-mono text-gold-soft"> ANTHROPIC_API_KEY</span>, it returns dry-run replies so you can test the UI.
      </div>
    </div>
  );
}

function Bubble({ role, content, dryRun, busy }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-4 py-3 ${
          isUser
            ? "bg-[rgba(201,168,106,0.10)] border border-gold-deep"
            : "luxe-panel border border-line"
        }`}
      >
        {!isUser && (
          <div className="ovline text-[8px] mb-1 text-gold-soft flex items-center gap-2">
            AI · Claude
            {dryRun && <span className="text-[#74b9e8]">dry-run</span>}
            {busy && <span className="pip breathe" />}
          </div>
        )}
        <div className={`text-[13px] whitespace-pre-wrap leading-relaxed ${busy ? "text-ink-mute italic" : "text-ink"}`}>
          {content}
        </div>
      </div>
    </div>
  );
}
