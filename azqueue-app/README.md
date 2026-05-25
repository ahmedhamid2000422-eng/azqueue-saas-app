# AzQueue — Walk-in & Queue Management SaaS

**Live at:** https://azqueue.io  
**Repository:** https://github.com/ahmedhamid2000422-eng/azqueue-saas-app  
**Stack:** React 18 · Vite · Supabase · Tailwind CSS · Deno Edge Functions

---

## What it is

AzQueue is a full-stack SaaS platform for walk-in service businesses (clinics, law firms, government offices, salons, repair shops). It replaces paper ticketing and disconnected booking calendars with one intelligent system that handles walk-ins, appointments, customer communication, and AI-powered staff intelligence.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, React Router v6, Tailwind CSS |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Edge Functions | Deno (TypeScript), deployed on Supabase |
| AI | OpenAI GPT-4o-mini (customer personas + AI reply drafts) |
| Messaging | Twilio WhatsApp API + Meta WhatsApp Cloud API |
| Payments | Stripe (subscriptions, customer portal) |
| CRM | Freshdesk REST API (ticket enrichment) |
| Deployment | Vercel (frontend) + Supabase Cloud (backend) |
| Fonts | Inter, Fraunces, JetBrains Mono |

---

## Core Features

### Queue Management
- Walk-ins and bookings merged into one real-time queue
- QR code self-check-in (no staff intervention needed)
- Multilingual kiosk (English, Bahasa, Arabic, Chinese, Tamil, Urdu)
- Complexity scoring: Simple / Standard / Complex / Extended
- Split-lane mode: Fast Lane and Complex Lane running in parallel
- Autopilot: adaptive calling pace based on real service time

### Bookings
- Public booking page per branch
- Service selection, time slots, staff preference
- Document checklist auto-sent via WhatsApp on confirmation

### AI Customer Intelligence
- `findOrCreateCustomer()` — phone-based identity resolution
- `generatePersona()` — GPT-4o-mini synthesises visit history into plain-language staff briefing
- New vs. returning detection with visit count
- Satisfaction score history linked to customer profile
- Freshdesk enrichment: open tickets pulled into customer panel

### Notifications
- Supabase Edge Function `send-notification` — Twilio WhatsApp API
- Templates: confirm / call / thanks / prayer_pause
- Dry-run mode when credentials absent (logs to notifications_log)
- Fallback: Meta WhatsApp Cloud API via channel_connections

### Staff & Operations
- Multi-staff assignment with workload balancing
- Reassign tickets between staff in real time
- SLA escalation engine with configurable thresholds
- Manager Intelligence: break-pattern analysis, anomaly detection, wellness alerts

### Islamic Mode
- Prayer time integration (all 5 prayers + Jumu'ah)
- Auto-pause queue 10 min before prayer
- Customers receive WhatsApp prayer-pause notification

### Satisfaction Scores
- 5-emoji survey appears when staff complete a ticket
- Scores linked to customer profile permanently
- Branch-level stats: today vs. all-time average

### Billing
- Stripe subscription tiers: Essential / Professional / Executive / Manager
- Customer portal for self-service upgrades/cancellations
- Stripe webhook handled via Edge Function

---

## Database — 16 Migrations

| Migration | Purpose |
|---|---|
| 0001_init | Core tables: branches, staff, services, tickets |
| 0002_staff_invite_link | Staff onboarding via invite URL |
| 0003_staff_status_log | Shift tracking (clock-in/out) |
| 0004_arrival_tracking | Customer arrival events |
| 0005_personal_tables | Personal mode: tasks, docs, focus sessions |
| 0006_public_bookings | Public booking page + availability slots |
| 0007_billing | Stripe subscription + plan tier tracking |
| 0008_stations | Counter/station management |
| 0009_sla | SLA thresholds + escalation rules |
| 0010_station_events_insert_rls | RLS policy for station event inserts |
| 0011_customers | Customer profiles + event timeline + AI personas |
| 0012_messaging | Channel connections + message log |
| 0013_bounce_escalation | Bounce detection + auto-escalation |
| 0014_ticket_email | Email field on tickets |
| 0015_satisfaction_scores | Post-visit 1-5 star scores |
| 0016_notifications_log | Outbound WhatsApp/SMS delivery log |

All tables use Row Level Security (RLS) — branch staff can only access their own branch data.

---

## Edge Functions (Deno/TypeScript)

| Function | Purpose |
|---|---|
| `send-notification` | Twilio WhatsApp for queue events (confirm/call/thanks/prayer) |
| `send-email` | SMTP email via branch config |
| `ai-assist` | OpenAI GPT-4o-mini for customer persona generation |
| `admin-stats` | Aggregate stats for admin dashboard |
| `create-checkout-session` | Stripe subscription checkout |
| `customer-portal-session` | Stripe self-service portal |
| `stripe-webhook` | Handles Stripe events (subscription updates) |

---

## File Structure

```
src/
├── App.jsx                    Router + auth guards
├── main.jsx                   Entry point
├── index.css                  Tailwind + design tokens + animations
├── lib/
│   ├── supabase.js            Supabase client
│   ├── AuthContext.jsx        Auth state + session management
│   ├── BranchContext.jsx      Active branch state
│   ├── customers.js           Customer CRUD + AI persona generation
│   ├── messaging.js           Multi-channel message dispatcher
│   ├── notifications.js       Twilio WhatsApp via Edge Function
│   ├── satisfaction.js        Score saving + stats helpers
│   ├── autopilot.js           Adaptive queue pacing engine
│   ├── autoAssign.js          Staff workload-based ticket routing
│   ├── complexity.js          Ticket complexity scoring
│   ├── sla.js                 SLA monitoring + escalation
│   ├── checklists.js          Document checklist templates
│   ├── prayerTimes.js         Prayer time calculation + auto-pause
│   ├── i18n.js                Multilingual string lookup
│   ├── freshdesk.js           Freshdesk CRM integration
│   ├── insights.js            Analytics aggregation
│   ├── managerIntel.js        Break patterns + anomaly detection
│   ├── wellness.js            Staff wellness scoring
│   ├── stations.js            Counter/station management
│   ├── arrival.js             Customer arrival tracking
│   ├── tier.js                Plan tier feature gating
│   └── export.js              Data export helpers
├── components/                Shared UI primitives
├── pages/
│   ├── Landing.jsx            Public marketing site
│   ├── CustomerCheckIn.jsx    QR check-in kiosk page
│   ├── PublicBooking.jsx      Public booking form
│   └── ModeSelect.jsx         Mode picker
└── modes/
    ├── business/
    │   ├── Queue.jsx          ★ Main queue dashboard
    │   ├── Bookings.jsx       Appointment management
    │   ├── Customers.jsx      Customer profiles + AI personas
    │   ├── Schedule.jsx       Staff scheduling
    │   ├── Insights.jsx       Analytics dashboard
    │   └── Settings.jsx       Branch + channel configuration
    └── personal/
        ├── DeepWork.jsx       Focus timer
        ├── Tasks.jsx
        ├── Docs.jsx
        ├── AIAssist.jsx
        └── Schedule.jsx
supabase/
├── migrations/                16 SQL migration files
└── functions/                 7 Deno Edge Functions
```

---

## Deployment

- **Frontend:** Vercel (auto-deploys on push to `main`)
- **Backend:** Supabase Cloud (managed PostgreSQL + Auth + Realtime)
- **Domain:** azqueue.io (purchased and configured via Vercel)
- **Environment variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_OPENAI_API_KEY`

---

## Local Development

```bash
npm install
npm run dev      # http://localhost:3000
```

Requires a `.env.local` with:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_OPENAI_API_KEY=...
```
