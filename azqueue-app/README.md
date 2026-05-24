# AzQueue

Flow Management System — one engine, two modes.

## Quickstart

```bash
npm install
npm run dev      # http://localhost:3000
```

## Structure

```
src/
├── App.jsx                      router
├── main.jsx                     entry
├── index.css                    Tailwind + tokens
├── components/                  shared UI primitives
│   ├── Sidebar.jsx
│   ├── Card.jsx
│   ├── Button.jsx
│   ├── Section.jsx
│   ├── Stat.jsx
│   ├── Badge.jsx
│   └── IslamicBar.jsx           top bar (works in both modes)
├── pages/
│   ├── Landing.jsx              public landing with all 8 sections
│   └── ModeSelect.jsx           mode picker
└── modes/
    ├── business/                Business Mode dashboard
    │   ├── Dashboard.jsx        layout + tab routing
    │   ├── Queue.jsx            ★ Now Serving + queue list + stats
    │   ├── Bookings.jsx
    │   ├── Schedule.jsx
    │   ├── Insights.jsx
    │   └── Settings.jsx
    └── personal/                Personal Flow Mode dashboard
        ├── Dashboard.jsx
        ├── DeepWork.jsx         ★ large timer + task title
        ├── Tasks.jsx
        ├── Docs.jsx
        ├── AIAssist.jsx
        └── Schedule.jsx
```

## Routes

```
/                     Landing
/select               Mode selection
/business             Business Mode (Queue tab default)
/business/bookings    Bookings
/business/schedule    Schedule
/business/insights    Insights
/business/settings    Settings
/personal             Personal Mode (Deep Work default)
/personal/tasks       Tasks
/personal/docs        Docs
/personal/ai          AI Assist
/personal/schedule    Schedule
```

## Design tokens

Locked in `tailwind.config.js`. Don't edit without coordinating across both modes.

| Token | Value |
|---|---|
| `bg` | `#0b0b0c` |
| `bg-elev` | `#131315` |
| `surface` | `#17171a` |
| `line` | `#26262a` |
| `gold` | `#c9a86a` |
| `gold-soft` | `#e4cb95` |
| `ink` | `#f2f0ea` |
| `ink-soft` | `#a8a69e` |
| `font-display` | Fraunces |
| `font-sans` | Inter |
| `font-mono` | JetBrains Mono |
