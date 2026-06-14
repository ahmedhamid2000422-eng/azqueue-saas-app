/**
 * MarketSurveyPage — WhatsApp-style market research survey
 * Route: /market-survey  (public, no auth)
 * Data saved to: supabase public.survey_responses
 */
import { useState, useEffect, useRef } from "react";

const SUPABASE_URL  = "https://haiighdwffvbjfepfttf.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhaWlnaGR3ZmZ2YmpmZXBmdHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MTg3MzIsImV4cCI6MjA5MzE5NDczMn0.tYp8SdXvNKvOOPffQG58_lqvlKBNOwtM57_3_9Lqjik";

const QUESTIONS = [
  {
    id: "intro",
    text: "👋 Hey! I'm doing a 2-min survey about queues and waiting at businesses. Totally anonymous — your answers help us build better software. Ready?",
    options: [{ label: "Let's go 🚀", value: "yes" }],
    multi: false,
    skip: true,
  },
  {
    id: "role",
    text: "First — who are you?",
    options: [
      { label: "🎓 Student", value: "student" },
      { label: "💼 Business owner / manager", value: "owner" },
      { label: "Both", value: "both" },
    ],
    multi: false,
  },
  {
    id: "businesses",
    text: "Which of these do you visit most often? (tap all that apply)",
    options: [
      { label: "🏋️ Gym / fitness studio", value: "gym" },
      { label: "🥋 Martial arts / dance studio", value: "studio" },
      { label: "📊 Tax office / accountant", value: "tax" },
      { label: "🏛️ Immigration / government office", value: "immigration" },
      { label: "🏥 Clinic / pharmacy", value: "clinic" },
      { label: "🏦 Bank", value: "bank" },
      { label: "✂️ Salon / barber", value: "salon" },
      { label: "🎓 University admin office", value: "uni_admin" },
    ],
    multi: true,
  },
  {
    id: "frustration",
    text: "What frustrates you most when visiting these places?",
    options: [
      { label: "⏳ Don't know how long the wait is", value: "unknown_wait" },
      { label: "📍 Have to physically stay the whole time", value: "cant_leave" },
      { label: "📵 No way to book ahead", value: "no_booking" },
      { label: "😬 Miss my turn if I step away", value: "miss_turn" },
      { label: "✅ I don't usually have a problem", value: "no_issue" },
    ],
    multi: false,
  },
  {
    id: "would_use_wa",
    text: "If you could join a queue via WhatsApp and get a message when it's almost your turn — would you use it?",
    options: [
      { label: "Yes, definitely 🙌", value: "yes" },
      { label: "Probably", value: "probably" },
      { label: "Not sure", value: "not_sure" },
      { label: "Probably not", value: "no" },
    ],
    multi: false,
  },
  {
    id: "top_feature",
    text: "What feature matters most to you? (pick one)",
    options: [
      { label: "📱 WhatsApp check-in", value: "wa_checkin" },
      { label: "🔔 Live wait time updates", value: "live_updates" },
      { label: "📅 Book a slot in advance", value: "booking" },
      { label: "⏰ Auto-reminders", value: "reminders" },
      { label: "🚫 No-show tracking", value: "noshow" },
    ],
    multi: false,
  },
  {
    id: "pain_points",
    text: "As a business owner — what are your biggest headaches? (tap all that apply)",
    ownerOnly: true,
    options: [
      { label: "😤 Long queues frustrating customers", value: "long_queues" },
      { label: "🚫 No-shows and cancellations", value: "noshows" },
      { label: "📢 Staff manually calling names", value: "manual_calling" },
      { label: "📵 No automatic reminders", value: "no_reminders" },
      { label: "📋 Everything on paper / WhatsApp groups", value: "manual_system" },
    ],
    multi: true,
  },
  {
    id: "willingness_to_pay",
    text: "What would you expect to pay for a system that handles all of this automatically?",
    ownerOnly: true,
    options: [
      { label: "🆓 Free only", value: "free" },
      { label: "💸 Up to RM 50/month", value: "rm50" },
      { label: "💳 RM 50–150/month", value: "rm150" },
      { label: "💰 RM 150–400/month", value: "rm400" },
      { label: "🏆 More if it saves real time", value: "more" },
    ],
    multi: false,
  },
];

function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MarketSurveyPage() {
  const [messages, setMessages]     = useState([]);
  const [currentQ, setCurrentQ]     = useState(0);
  const [answers, setAnswers]       = useState({});
  const [multiSel, setMultiSel]     = useState([]);
  const [phase, setPhase]           = useState("chat"); // chat | typing | options | done
  const [progress, setProgress]     = useState(0);
  const chatRef = useRef(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, phase]);

  // Kick off
  useEffect(() => { startQuestion(0, {}); }, []);

  function visibleQs(ans) {
    return QUESTIONS.filter(q => !q.ownerOnly || ans.role === "owner" || ans.role === "both")
                    .filter(q => !q.skip);
  }

  function calcProgress(ans) {
    const qs = visibleQs(ans);
    const done = qs.filter(q => ans[q.id] !== undefined).length;
    return Math.round((done / qs.length) * 100);
  }

  async function startQuestion(idx, currentAnswers) {
    setPhase("typing");
    await sleep(700);
    setMessages(prev => [...prev, { dir: "in", text: QUESTIONS[idx].text, time: getTime() }]);
    setCurrentQ(idx);
    setMultiSel([]);
    setPhase("options");
  }

  async function selectSingle(q, opt) {
    setPhase("chat");
    const newAnswers = { ...answers, [q.id]: opt.value };
    setAnswers(newAnswers);
    setMessages(prev => [...prev, { dir: "out", text: opt.label, time: getTime() }]);
    setProgress(calcProgress(newAnswers));
    await advanceFrom(q, newAnswers);
  }

  async function confirmMulti(q) {
    if (multiSel.length === 0) return;
    setPhase("chat");
    const selectedLabels = q.options.filter(o => multiSel.includes(o.value)).map(o => o.label).join(", ");
    const newAnswers = { ...answers, [q.id]: [...multiSel] };
    setAnswers(newAnswers);
    setMessages(prev => [...prev, { dir: "out", text: selectedLabels, time: getTime() }]);
    setProgress(calcProgress(newAnswers));
    await advanceFrom(q, newAnswers);
  }

  async function advanceFrom(q, newAnswers) {
    let next = QUESTIONS.indexOf(q) + 1;
    while (next < QUESTIONS.length) {
      const nq = QUESTIONS[next];
      if (nq.ownerOnly && newAnswers.role !== "owner" && newAnswers.role !== "both") { next++; continue; }
      break;
    }
    if (next >= QUESTIONS.length) {
      await submitAndFinish(newAnswers);
      return;
    }
    await startQuestion(next, newAnswers);
  }

  async function submitAndFinish(finalAnswers) {
    setPhase("chat");
    const payload = {
      role:               finalAnswers.role || null,
      businesses:         Array.isArray(finalAnswers.businesses) ? finalAnswers.businesses : null,
      frustration:        finalAnswers.frustration || null,
      would_use_wa:       finalAnswers.would_use_wa || null,
      top_feature:        finalAnswers.top_feature || null,
      pain_points:        Array.isArray(finalAnswers.pain_points) ? finalAnswers.pain_points : null,
      willingness_to_pay: finalAnswers.willingness_to_pay || null,
      user_agent:         navigator.userAgent.slice(0, 200),
      referrer:           document.referrer.slice(0, 200) || null,
    };
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/survey_responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON,
          "Authorization": `Bearer ${SUPABASE_ANON}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) console.warn("Survey submit failed:", res.status, await res.text());
    } catch (e) {
      console.warn("Survey network error:", e.message);
    }
    setProgress(100);
    setPhase("done");
  }

  const q = QUESTIONS[currentQ];

  return (
    <div style={{ fontFamily: '-apple-system,"Segoe UI",Roboto,sans-serif', background: "#ECE5DD", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ background: "#075E54", color: "#fff", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10, boxShadow: "0 1px 3px rgba(0,0,0,.3)" }}>
        <div style={{ width: 40, height: 40, background: "#25D366", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>AQ</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>AzQueue Survey</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>{phase === "done" ? "thank you 🙏" : "online"}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "rgba(255,255,255,.2)", position: "sticky", top: 64, zIndex: 9 }}>
        <div style={{ height: "100%", background: "#25D366", width: `${progress}%`, transition: "width .4s ease" }} />
      </div>

      {/* Chat */}
      {phase !== "done" && (
        <div ref={chatRef} style={{ flex: 1, padding: "16px 12px 140px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
          <div style={{ textAlign: "center", fontSize: 12, color: "#54656f", background: "rgba(255,255,255,.55)", padding: "4px 12px", borderRadius: 8, alignSelf: "center", margin: "8px 0" }}>Today</div>

          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.dir === "in" ? "flex-start" : "flex-end", animation: "fadeUp .25s ease both" }}>
              <div style={{
                maxWidth: "78%", padding: "8px 12px 6px", borderRadius: 8,
                borderTopLeftRadius: m.dir === "in" ? 2 : 8,
                borderTopRightRadius: m.dir === "out" ? 2 : 8,
                background: m.dir === "in" ? "#fff" : "#DCF8C6",
                fontSize: 14.5, lineHeight: 1.45, color: "#111B21",
                boxShadow: "0 1px 1px rgba(0,0,0,.12)",
              }}>
                {m.text}
                <div style={{ fontSize: 11, color: "#667781", textAlign: "right", marginTop: 2 }}>
                  {m.time}{m.dir === "out" && <span style={{ color: "#53bdeb", marginLeft: 3 }}>✓✓</span>}
                </div>
              </div>
            </div>
          ))}

          {phase === "typing" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "#fff", borderRadius: 8, borderTopLeftRadius: 2, width: "fit-content", boxShadow: "0 1px 1px rgba(0,0,0,.1)" }}>
              {[0, 200, 400].map((delay, i) => (
                <div key={i} style={{ width: 7, height: 7, background: "#aaa", borderRadius: "50%", animation: `bounce 1.2s ${delay}ms infinite ease-in-out` }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Done screen */}
      {phase === "done" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px 24px", gap: 16 }}>
          <div style={{ fontSize: 64 }}>🙌</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#075E54" }}>Thank you!</div>
          <div style={{ fontSize: 15, color: "#667781", maxWidth: 280, lineHeight: 1.5 }}>Your answers have been recorded. You're helping us build something that actually works for people like you.</div>
        </div>
      )}

      {/* Options bar */}
      {phase === "options" && q && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#f0f2f5", borderTop: "1px solid #d1d7db", padding: "10px 12px 20px", display: "flex", flexDirection: "column", gap: 8, zIndex: 20 }}>
          <div style={{ fontSize: 11, color: "#667781", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>
            {q.multi ? "Tap all that apply" : "Choose one"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {q.options.map(opt => {
              const sel = q.multi && multiSel.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (q.multi) {
                      setMultiSel(prev => prev.includes(opt.value) ? prev.filter(x => x !== opt.value) : [...prev, opt.value]);
                    } else {
                      selectSingle(q, opt);
                    }
                  }}
                  style={{
                    padding: "9px 14px", borderRadius: 20,
                    border: `1.5px solid #128C7E`,
                    background: sel ? "#128C7E" : "#fff",
                    color: sel ? "#fff" : "#128C7E",
                    fontSize: 14, fontWeight: 500, cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >{opt.label}</button>
              );
            })}
          </div>
          {q.multi && multiSel.length > 0 && (
            <button
              onClick={() => confirmMulti(q)}
              style={{ marginTop: 2, padding: 11, borderRadius: 24, border: "none", background: "#25D366", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
            >Send ✓</button>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes bounce { 0%,60%,100% { transform:translateY(0) } 30% { transform:translateY(-6px) } }
      `}</style>
    </div>
  );
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
