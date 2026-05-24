import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import LuxeFrame from "../components/LuxeFrame";
import { CountUp } from "../components/LiveTicker";

const TOOLS = [
  {
    id: "deep",
    n: "01",
    title: "Deep Work",
    body: "A single timer, a single task. Distractions silenced, breaks scheduled, sessions logged.",
    detail: "Adaptive · prayer-aware",
  },
  {
    id: "tasks",
    n: "02",
    title: "Tasks",
    body: "One list, intelligently ordered. Today, soon, someday. No projects, no boards, no clutter.",
    detail: "Auto-prioritised",
  },
  {
    id: "docs",
    n: "03",
    title: "Docs",
    body: "Notes that find themselves. Connect ideas, link tasks, surface what matters when it matters.",
    detail: "Smart linking",
  },
  {
    id: "ai",
    n: "04",
    title: "AI Assist",
    body: "Draft, summarise, plan. Your daily co-pilot — quiet, focused, on your terms.",
    detail: "Private · on-device",
  },
  {
    id: "schedule",
    n: "05",
    title: "Schedule",
    body: "Calendar that knows your prayers, your focus blocks, and the work you actually want to do.",
    detail: "Calendar + flow",
  },
];

export default function PersonalFlow() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />
      <Hero />
      <Promise />
      <ToolGrid />
      <SessionPreview />
      <Audience />
      <CTA />
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="atmosphere-hero max-w-6xl mx-auto px-6 pt-20 pb-24">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
        <div>
          <div className="ovline mb-5 inline-flex items-center gap-2 border border-line px-3 py-1">
            <span className="pip breathe" />
            Personal Flow · for individuals
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-light tracking-tightest leading-[1.05] mb-6">
            Your day,<br />
            <em className="not-italic gold-text-soft">in flow.</em>
          </h1>
          <p className="text-ink-soft text-lg max-w-md mb-3">
            Deep work, tasks, docs and AI in one calm workspace.
          </p>
          <p className="font-display text-xl text-gold-soft italic mb-10">
            Built for the work that matters.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/select"><Button>Start free trial →</Button></Link>
            <a href="#tools"><Button variant="ghost">See the tools</Button></a>
          </div>
          <div className="text-[10px] text-ink-mute mt-5 tracking-wide">
            14-day trial · No card · Free for students
          </div>
        </div>
        <SessionMini />
      </div>
    </section>
  );
}

function SessionMini() {
  const [seconds, setSeconds] = useState(18 * 60 + 42);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <LuxeFrame className="p-7">
      <div className="flex items-center justify-between mb-4">
        <span className="ovline text-[9px]">Deep Work</span>
        <span className="ovline text-[9px] text-[#9bbd9b] flex items-center">
          <span className="pip breathe mr-1.5" /> In session
        </span>
      </div>
      <div className="gold-text font-display text-7xl font-light tracking-tightest leading-none font-mono-tabular">{mm}:{ss}</div>
      <div className="text-[10px] text-ink-mute mt-3 tracking-wide">Drafting · Q3 strategy memo</div>

      <div className="rule-ornament my-5 text-[8px]"><span>✦</span></div>

      <div className="grid grid-cols-3 gap-px bg-line border border-line">
        {[
          ["Today", "3h 12m"],
          ["Streak", 11],
          ["Focus", "94%"],
        ].map(([l, v]) => (
          <div key={l} className="bg-bg-elev p-2.5">
            <div className="ovline text-[8px]">{l}</div>
            <div className="font-display text-base mt-0.5 gold-text-soft">
              {typeof v === "number" ? <><CountUp to={v} />d</> : v}
            </div>
          </div>
        ))}
      </div>

      <div className="rule-ornament my-5 text-[8px]"><span>·</span></div>

      <div>
        <div className="ovline text-[9px] mb-3">Up next</div>
        {[
          ["09:30", "Review pull requests", "task"],
          ["10:15", "Dhuhr prayer", "pause"],
          ["10:30", "Deep work · 90 min", "focus"],
        ].map(([time, name, type]) => (
          <div key={time} className="grid grid-cols-[52px_1fr_56px] gap-2 py-1.5 items-center">
            <span className="font-display text-gold-soft text-xs">{time}</span>
            <span className="text-[11px]">{name}</span>
            <span className={`text-[9px] uppercase tracking-[0.1em] ${type === "pause" ? "text-[#74b9e8]" : type === "focus" ? "text-gold-soft" : "text-ink-mute"}`}>
              {type === "pause" ? "Prayer" : type === "focus" ? "Focus" : "Task"}
            </span>
          </div>
        ))}
      </div>
    </LuxeFrame>
  );
}

function Promise() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="grid md:grid-cols-2 gap-12">
        <div>
          <div className="ovline mb-3 text-[#d49185]">The noise</div>
          <h3 className="font-display text-2xl font-light mb-6 tracking-tighter">Most days run you.</h3>
          <ul className="space-y-4 text-ink-soft text-sm">
            {[
              "Notes in five apps. Tasks in a sixth. Calendar in a seventh.",
              "Notifications break focus before it starts.",
              "AI tools live in tabs you forget to open.",
              "End of day, you're tired but can't say what got done.",
            ].map((p) => (
              <li key={p} className="flex gap-3">
                <span className="w-1 h-1 rounded-full bg-[#b56b5f] mt-2 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="ovline mb-3 text-gold-soft">The flow</div>
          <h3 className="font-display text-2xl font-light mb-6 tracking-tighter">Personal Flow runs with you.</h3>
          <ul className="space-y-4 text-ink-soft text-sm">
            {[
              "One workspace. Deep work, tasks, docs, AI, schedule.",
              "Notifications only when the work allows it.",
              "AI sits inside your flow, not in a separate tab.",
              "End of day, you see exactly what you finished.",
            ].map((p) => (
              <li key={p} className="flex gap-3">
                <span className="w-1 h-1 rounded-full bg-good mt-2 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ToolGrid() {
  return (
    <section id="tools" className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="text-center mb-14">
        <div className="ovline mb-3 text-gold-soft">The tools</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">
          Five tools. <em className="not-italic gold-text-soft">One workspace.</em>
        </h2>
      </div>
      <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-px bg-line border border-line">
        {TOOLS.map((tool) => (
          <div key={tool.id} className="luxe-panel p-7 flex flex-col">
            <div className="flex items-baseline justify-between mb-4">
              <div className="font-display gold-text text-3xl font-light leading-none">{tool.n}</div>
              <ToolIcon id={tool.id} />
            </div>
            <div className="font-display text-lg mb-2">{tool.title}</div>
            <p className="text-ink-soft text-xs leading-relaxed mb-5 flex-1">{tool.body}</p>
            <ToolMock id={tool.id} />
            <div className="ovline text-[9px] text-gold-soft border-t border-line pt-3 mt-4">{tool.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* Tiny tool icons rendered as SVG ornaments — silver-thin lines */
function ToolIcon({ id }) {
  const stroke = "#8a7246";
  const props = { stroke, strokeWidth: 1, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      {id === "deep" && (
        <g {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 4 v8 l5 3" />
        </g>
      )}
      {id === "tasks" && (
        <g {...props}>
          <path d="M5 7 h14 M5 12 h14 M5 17 h10" />
          <circle cx="3" cy="7" r="0.8" fill={stroke} />
          <circle cx="3" cy="12" r="0.8" fill={stroke} />
          <circle cx="3" cy="17" r="0.8" fill={stroke} />
        </g>
      )}
      {id === "docs" && (
        <g {...props}>
          <path d="M7 4 h7 l4 4 v12 H7 Z" />
          <path d="M14 4 v4 h4" />
          <path d="M10 13 h6 M10 16 h4" />
        </g>
      )}
      {id === "ai" && (
        <g {...props}>
          <path d="M12 3 l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1 z" />
        </g>
      )}
      {id === "schedule" && (
        <g {...props}>
          <rect x="4" y="6" width="16" height="14" />
          <path d="M4 10 h16 M9 4 v4 M15 4 v4" />
          <circle cx="9" cy="14" r="0.8" fill={stroke} />
        </g>
      )}
    </svg>
  );
}

/* Tiny in-card mock visuals — give each tool a hint of its actual UI */
function ToolMock({ id }) {
  if (id === "deep") {
    return (
      <div className="border border-line bg-bg p-3 text-center">
        <div className="ovline text-[7px] mb-1">In session</div>
        <div className="gold-text font-display text-xl font-light leading-none">18:42</div>
        <div className="h-px bg-line my-2" />
        <div className="text-[8px] text-ink-mute">71 min remaining</div>
      </div>
    );
  }
  if (id === "tasks") {
    return (
      <div className="border border-line bg-bg p-3 space-y-2">
        {[
          ["Today", "Ship pricing page", true],
          ["Today", "Investor reply", false],
          ["Soon", "Q3 memo draft", false],
        ].map(([when, what, done], i) => (
          <div key={i} className="flex items-center gap-2 text-[9px] min-w-0">
            <span className={`shrink-0 ${done ? "text-gold-soft" : "text-ink-mute"}`}>{done ? "●" : "○"}</span>
            <span className={`shrink-0 ovline text-[6px] w-9 ${done ? "text-ink-mute" : ""}`}>{when}</span>
            <span className={`truncate min-w-0 ${done ? "text-ink-mute line-through" : "text-ink-soft"}`}>{what}</span>
          </div>
        ))}
      </div>
    );
  }
  if (id === "docs") {
    return (
      <div className="border border-line bg-bg p-3">
        <div className="ovline text-[7px] mb-2">Q3 strategy memo</div>
        <div className="space-y-1">
          <div className="h-1 bg-line w-11/12" />
          <div className="h-1 bg-line w-10/12" />
          <div className="h-1 bg-line w-8/12" />
          <div className="h-1 bg-gold-soft/30 w-9/12" />
          <div className="h-1 bg-line w-11/12" />
        </div>
        <div className="ovline text-[7px] text-gold-soft mt-2">↳ linked: 2 tasks</div>
      </div>
    );
  }
  if (id === "ai") {
    return (
      <div className="border border-line bg-bg p-3">
        <div className="text-[9px] text-ink-mute mb-1.5 italic">"summarise yesterday"</div>
        <div className="bg-bg-elev border border-line p-2 space-y-1">
          <div className="h-1 bg-gold-soft/40 w-full" />
          <div className="h-1 bg-gold-soft/30 w-10/12" />
          <div className="h-1 bg-gold-soft/30 w-9/12" />
        </div>
        <div className="ovline text-[7px] text-gold-soft mt-2">on-device · private</div>
      </div>
    );
  }
  if (id === "schedule") {
    return (
      <div className="border border-line bg-bg p-3 space-y-1">
        {[
          ["09:30", "Deep work", "focus"],
          ["10:15", "Dhuhr", "pause"],
          ["13:00", "Tasks", "task"],
        ].map(([t, label, kind]) => (
          <div key={t} className="grid grid-cols-[36px_1fr_8px] gap-2 items-center">
            <span className="font-mono text-[9px] text-gold-soft">{t}</span>
            <span className="text-[9px] text-ink-soft truncate">{label}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${
              kind === "pause" ? "bg-[#74b9e8]" :
              kind === "focus" ? "bg-gold-soft" :
              "bg-ink-mute"
            }`} />
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function SessionPreview() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="grid md:grid-cols-[1fr_1.2fr] gap-12 items-center">
        <div>
          <div className="ovline mb-3 text-gold-soft">Feature · Deep Work</div>
          <h2 className="font-display text-4xl font-light tracking-tighter mb-5">
            One timer. <em className="not-italic text-gold-soft">One task.</em>
          </h2>
          <p className="text-ink-soft text-sm mb-6">
            Pick the work. Start the session. Personal Flow silences notifications, hides everything else, and logs what you finished. Prayer-aware pauses built in.
          </p>
          <ul className="space-y-3 text-sm">
            {[
              ["Adaptive sessions", "Lengths calibrated to your real focus span."],
              ["Prayer-aware", "Pauses gracefully, resumes where you left off."],
              ["Streak intelligence", "Tracks rhythm, not just minutes."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="pip mt-2 shrink-0" />
                <div>
                  <div className="text-ink">{t}</div>
                  <div className="text-ink-mute text-xs">{d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <LuxeFrame className="p-9">
          <div className="flex justify-between items-center mb-5 pb-4 border-b border-line">
            <div className="flex items-center gap-2">
              <span className="pip breathe" />
              <span className="text-xs text-[#9bbd9b]">In deep work</span>
            </div>
            <span className="text-[10px] text-ink-mute font-mono">session 03 of 04</span>
          </div>
          <div className="text-center py-8">
            <div className="ovline text-[9px] mb-4">Drafting · Q3 strategy memo</div>
            <div className="gold-text font-display text-9xl font-light tracking-tightest leading-none">18:42</div>
            <div className="rule-ornament my-5 text-[8px]"><span>✦</span></div>
            <div className="text-[10px] text-ink-mute tracking-wide">90 minute session · 71 min remaining</div>
          </div>
          <div className="border-t border-line pt-4 grid grid-cols-3 gap-px bg-line">
            {[
              ["Today", "3h 12m"],
              ["Week", "21h"],
              ["Streak", "11 days"],
            ].map(([l, v]) => (
              <div key={l} className="bg-bg-elev p-3 text-center">
                <div className="ovline text-[8px]">{l}</div>
                <div className="font-display text-base mt-1 gold-text-soft">{v}</div>
              </div>
            ))}
          </div>
        </LuxeFrame>
      </div>
    </section>
  );
}

function Audience() {
  const groups = [
    { title: "Students", body: "Study sessions, lecture notes, exam-week schedules — all aware of prayer times and your real energy." },
    { title: "Founders", body: "Strategy memos, investor updates, the one task that moves the company. AI Assist drafts the rest." },
    { title: "Creators", body: "Long-form writing, research, idea capture. Deep work sessions that protect the craft." },
  ];
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="text-center mb-12">
        <div className="ovline mb-3 text-gold-soft">For</div>
        <h2 className="font-display text-4xl font-light tracking-tighter">
          Built for <em className="not-italic text-gold-soft">deep work.</em>
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-px bg-line border border-line">
        {groups.map((g) => (
          <div key={g.title} className="bg-bg-elev p-7">
            <div className="font-display text-2xl font-light mb-3">{g.title}</div>
            <p className="text-ink-soft text-xs leading-relaxed">{g.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-24 border-t border-line text-center">
      <h2 className="font-display text-4xl sm:text-5xl font-light tracking-tightest mb-5 leading-tight">
        Stop running the day.<br />
        <em className="not-italic text-gold-soft">Start flowing through it.</em>
      </h2>
      <p className="text-ink-soft text-sm mb-8">14-day trial · no card · free forever for students.</p>
      <Link to="/select"><Button size="lg">Start free trial →</Button></Link>
    </section>
  );
}
