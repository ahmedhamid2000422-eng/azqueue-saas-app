# AzQueue — Healthcare Operations Module
## Architecture Strategy for Modular Extension

> **Principle:** AzQueue evolves from "queue management" into "operational flow infrastructure for service businesses." Healthcare is Industry Module #5. The core platform never changes — only new tables, new UI modules, and new workflow types are added.

---

## 1. ARCHITECTURE STRATEGY

### How Healthcare Maps Onto Your Existing Models

Your current abstractions already cover healthcare workflows perfectly:

| AzQueue Concept | Healthcare Equivalent |
|---|---|
| `branch` | Home care agency / office location |
| `staff` | Caregiver / care coordinator |
| `ticket` | Visit task / client appointment |
| `service` | Care service type (personal care, companionship, skilled nursing) |
| `booking` | Scheduled visit |
| `queue` | Daily caregiver dispatch board |
| `status: waiting` | Visit pending / caregiver en route |
| `status: serving` | Visit in progress (clock-in) |
| `status: completed` | Visit complete (clock-out) |
| `status: no_show` | Missed visit / no-show alert |

**Nothing new needs to exist at the core level.** Healthcare is a workflow skin on top of your existing queue/booking/ticket engine.

### Layered Architecture

```
┌─────────────────────────────────────────────────┐
│              AzQueue Core (unchanged)            │
│  branches · staff · tickets · bookings · queue   │
└─────────────────────┬───────────────────────────┘
                      │ extends via
┌─────────────────────▼───────────────────────────┐
│         Industry Module Layer (new)              │
│  branch_settings.module = "homecare"             │
│  visit_metadata · compliance_flags               │
│  caregiver_assignments · document_status         │
└─────────────────────┬───────────────────────────┘
                      │ surfaces in
┌─────────────────────▼───────────────────────────┐
│         Healthcare Dashboard UI (new)            │
│  Missing Docs Queue · Visit Board · Alerts       │
└─────────────────────────────────────────────────┘
```

---

## 2. DATABASE DESIGN

### Additive Schema — No Core Tables Modified

All additions are **new tables** that reference existing ones via foreign keys.

```sql
-- Enable healthcare module for a branch
ALTER TABLE branches ADD COLUMN module TEXT DEFAULT 'standard';
-- values: 'standard' | 'homecare' | 'logistics' | 'field_service'

-- Visit metadata (extends tickets)
CREATE TABLE visit_metadata (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID REFERENCES tickets(id) ON DELETE CASCADE,
  branch_id   UUID REFERENCES branches(id),
  client_ref  TEXT,                    -- tokenized client identifier (NOT full name/SSN)
  visit_type  TEXT,                    -- personal_care | companionship | skilled | respite
  clock_in_at TIMESTAMPTZ,
  clock_out_at TIMESTAMPTZ,
  location_verified BOOLEAN DEFAULT FALSE,
  notes_submitted BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance flags (missing docs, late arrivals, etc.)
CREATE TABLE compliance_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID REFERENCES branches(id),
  ticket_id   UUID REFERENCES tickets(id),
  flag_type   TEXT NOT NULL,           -- missing_notes | late_arrival | no_evv | unsigned_plan
  severity    TEXT DEFAULT 'medium',   -- low | medium | high | critical
  resolved    BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES staff(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Caregiver-to-client assignments (extends staff-branch relationship)
CREATE TABLE caregiver_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    UUID REFERENCES branches(id),
  staff_id     UUID REFERENCES staff(id),
  client_ref   TEXT,                   -- tokenized, not raw PHI
  service_type TEXT,
  active       BOOLEAN DEFAULT TRUE,
  start_date   DATE,
  end_date     DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Document status tracker
CREATE TABLE document_status (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID REFERENCES branches(id),
  client_ref  TEXT,
  doc_type    TEXT NOT NULL,           -- care_plan | auth_letter | evv_record | progress_note
  status      TEXT DEFAULT 'pending',  -- pending | submitted | approved | denied | expired
  due_date    DATE,
  submitted_at TIMESTAMPTZ,
  denial_reason TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow events (audit log — append-only)
CREATE TABLE workflow_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID REFERENCES branches(id),
  event_type  TEXT NOT NULL,
  actor_id    UUID REFERENCES staff(id),
  payload     JSONB,                   -- PHI-free metadata only
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Migration Strategy
1. Deploy new tables — zero impact on existing queries
2. Add `module` column to branches with DEFAULT 'standard' — backward compatible
3. Existing branches continue working exactly as before
4. Healthcare features only activate when `branch.module = 'homecare'`

---

## 3. FEATURE DESIGNS

Each feature is a new dashboard view. No existing queue logic changes.

### Feature 1: Missing Documentation Queue
Maps to: `compliance_flags WHERE flag_type = 'missing_notes' AND resolved = FALSE`

```
┌─────────────────────────────────────┐
│ Missing Documentation Queue    [12] │
├──────────────┬─────────┬────────────┤
│ Client Ref   │ Type    │ Days Late  │
│ CLIENT-0042  │ Progress│ 3 days     │ ← High
│ CLIENT-0087  │ Care Plan│ 1 day     │ ← Medium
│ CLIENT-0021  │ EVV     │ 5 days     │ ← Critical
└──────────────┴─────────┴────────────┘
```

**Integrated as:** A filtered view of compliance_flags, surfaced as a queue card in the business dashboard. Staff click to see which caregiver owns the visit, then trigger a reminder.

### Feature 2: Caregiver Late Arrival Alerts
Maps to: `tickets WHERE status = 'waiting' AND scheduled_at < NOW() - interval '15 minutes'`

This **already works** with your existing tickets table. A late arrival is just a ticket that hasn't moved to 'serving' within N minutes of its scheduled_at. No new table needed — add a UI alert layer and a Supabase edge function.

```js
// Edge function (no schema change)
const lateVisits = await supabase
  .from('tickets')
  .select('*, caregiver_assignments(*)')
  .eq('status', 'waiting')
  .lt('scheduled_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());
// → trigger WhatsApp alert to coordinator
```

### Feature 3: Pending Approval Queue
Maps to: `document_status WHERE status = 'pending' ORDER BY due_date ASC`

Coordinators see all authorizations/care plans awaiting approval, sorted by urgency. Clicking opens a detail panel with action buttons (Send reminder, Mark received, Escalate).

### Feature 4: Visit Completion Verification
Maps to: `visit_metadata WHERE clock_out_at IS NULL AND tickets.status = 'completed'`

Flags visits where the ticket was marked complete but EVV clock-out was not recorded. Surfaces as a compliance alert, not an automated submission.

### Feature 5: Denial Resolution Workflow
Maps to: `document_status WHERE status = 'denied'`

```
Denial received → Flag created → Coordinator assigned
→ AI drafts appeal letter (human reviews) → Submitted manually
→ Status updated to 'resubmitted' → Resolved or escalated
```

---

## 4. AI ASSISTANT LAYER

### Safe AI Design — What It Can Do

| Allowed | Forbidden |
|---|---|
| Summarize which visits have missing notes | Fabricate visit notes |
| Explain what a denial reason typically means | Submit claims |
| Draft a coordinator reminder message | Alter timestamps |
| Flag incomplete form fields | Invent billing codes |
| Recommend next action (human decides) | Generate fake documentation |
| Summarize daily compliance status | Access raw PHI |

### Implementation Pattern

```js
// AI receives tokenized, PHI-free context only
const aiContext = {
  branch_id: branch.id,
  open_flags: flagCount,          // numbers only
  late_visits: lateCount,
  missing_docs: missingDocTypes,  // ['progress_note', 'evv'] — type names, not client names
  pending_approvals: pendingCount,
};

// AI prompt pattern
const prompt = `
You are a workflow assistant for a home care agency coordinator.
You NEVER see or generate client names, SSNs, dates of birth, or medical data.
You only see operational workflow metadata.

Current status:
- ${aiContext.open_flags} open compliance flags
- ${aiContext.late_visits} late visits today
- ${aiContext.missing_docs.join(', ')} documents missing
- ${aiContext.pending_approvals} pending approvals

Summarize what the coordinator should focus on first and why.
Recommend 3 specific next actions.
`;
```

### Denial Letter Drafting (Safe Pattern)

```js
// Coordinator provides: denial code, service type, non-PHI context
// AI drafts: appeal letter template with [COORDINATOR TO FILL] placeholders
// Human reviews and submits manually — AI never submits

const draftPrompt = `
Draft an appeal letter template for a ${denialCode} denial 
on a ${serviceType} authorization. 
Use [CLIENT NAME], [DATE OF SERVICE], [COORDINATOR NAME] as placeholders.
Do not fabricate any clinical details.
`;
```

---

## 5. HIPAA-SAFE ARCHITECTURE

### Data Isolation Strategy

```
┌─────────────────────────────────────────────────┐
│  PHI Zone (Supabase, RLS-protected)              │
│  - client full names (only in caregiver_assignments.client_ref → tokenized) │
│  - visit notes (stored in external EHR, not AzQueue) │
│  - diagnoses (never stored in AzQueue)           │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Operations Zone (AzQueue handles this)          │
│  - workflow status, flags, document types        │
│  - scheduling, assignments, queue position       │
│  - compliance counts and alert types             │
│  - tokenized client references (CLIENT-0042)     │
└─────────────────────────────────────────────────┘
```

### Tokenization Pattern

```js
// Never store: "Sarah Johnson, DOB 1942-03-15, Medicaid #123456789"
// Store: "CLIENT-0042" (agency-assigned reference, maps in their own system)

// All AI calls use tokens only:
// ✓ "CLIENT-0042 has 2 missing documents"
// ✗ "Sarah Johnson has 2 missing documents"
```

### Row-Level Security (Supabase RLS)

```sql
-- Healthcare data only visible to branch staff
CREATE POLICY "homecare_rls" ON visit_metadata
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM staff WHERE user_id = auth.uid()
    )
  );
```

### Audit Logging

Every state change writes to `workflow_events` (append-only, no deletes):
```js
await supabase.from('workflow_events').insert({
  branch_id: branch.id,
  event_type: 'flag_resolved',
  actor_id: staff.id,
  payload: { flag_id: flag.id, flag_type: flag.flag_type }, // no PHI
});
```

---

## 6. PRODUCT POSITIONING

### What AzQueue Is (in healthcare context)

> **"Operational coordination software for home care agencies."**

- Workflow orchestration — who needs to do what, by when
- Compliance task management — what's missing, what's late
- Staff coordination — who's where, who's behind
- Administrative flow — approvals, reminders, escalations

### What AzQueue Is NOT (be explicit in marketing)

- Not an EHR or medical records platform
- Not a claims submission system
- Not a replacement for your state's EVV system
- Not a diagnostic or clinical tool
- Not a Medicaid billing processor

### Positioning Statement for Sales

> "AzQueue is the coordination layer between your caregivers in the field and your admin team at the office — so nothing falls through the cracks. It doesn't replace your EVV system or EHR. It makes sure your team actually uses them correctly and on time."

---

## 7. MVP IMPLEMENTATION PLAN

### Phase 1 — Zero backend risk (week 1–2)

1. Add `module` column to branches (`ALTER TABLE ... ADD COLUMN`, default 'standard')
2. Build Healthcare Dashboard UI as a new route (`/business/homecare`)
3. Display existing tickets/bookings with healthcare vocabulary
4. Late arrival alerts using existing tickets query (no new table)

### Phase 2 — Compliance layer (week 3–4)

5. Create `compliance_flags` table
6. Build Missing Documentation Queue view
7. Manual flag creation by coordinators
8. WhatsApp reminder trigger (uses existing notifications system)

### Phase 3 — Document tracking (week 5–6)

9. Create `document_status` table
10. Pending Approval Queue view
11. Denial tracking and status updates
12. Basic AI summary (PHI-free context only)

### Phase 4 — Visit verification (week 7–8)

13. Create `visit_metadata` table
14. Clock-in/clock-out workflow (caregiver mobile view)
15. EVV gap detection (flag missing clock-outs)
16. Audit log (`workflow_events`)

### Backend Changes Ranked by Risk

| Change | Risk | Notes |
|---|---|---|
| Add `module` column | Very Low | Default value, backward compatible |
| New `compliance_flags` table | Low | No FK changes to core tables |
| New `document_status` table | Low | Standalone, additive |
| New `visit_metadata` table | Low | References tickets via FK only |
| New `workflow_events` table | Low | Append-only audit log |
| Existing ticket status system | None | Reused as-is |
| Existing booking system | None | Reused as-is |

---

## 8. UI/UX — Healthcare in the AzQueue Visual Language

### Dashboard Card Vocabulary

```
Standard queue card:          Healthcare queue card:
┌───────────────────┐        ┌───────────────────┐
│ A102 · Haircut    │        │ HC042 · Home Visit │
│ Ali Khan          │        │ CLIENT-0042        │
│ ~8 min wait       │        │ Caregiver: Fatima  │
│ [status: waiting] │        │ [status: en route] │
└───────────────────┘        └───────────────────┘
```

### Escalation Indicators (reuse existing patterns)

```
● green pip  = Visit in progress / on time
● gold pip   = En route / approaching  
● red pip    = Late / flag triggered
● grey pip   = Pending / not started
```

### Compliance Dashboard Layout

```
┌──────────────────────────────────────────────────────┐
│ Today's Operations          [Mon 12 May · 9 visits]  │
├────────────┬───────────────┬───────────────────────── ┤
│ 3 On Time  │ 1 Late        │ 2 Missing Docs           │
│ ●●● green  │ ● red         │ ⚠ amber                  │
└────────────┴───────────────┴──────────────────────────┘
```

**Design rule:** Never make it look like hospital software. Use the same dark luxury AzQueue aesthetic — gold accents, sharp borders, display typography. Healthcare coordinators deserve beautiful software too.

---

## 9. CODE EXAMPLES

### Healthcare Branch Detection

```js
// BranchContext already provides branch — just check module
const { branch } = useBranch();
const isHomecare = branch?.module === 'homecare';

// In the dashboard nav, show healthcare routes conditionally
{ isHomecare && <Route path="homecare" element={<HomecareBoard />} /> }
```

### Missing Docs Queue Query

```js
async function getMissingDocsQueue(branchId) {
  const { data } = await supabase
    .from('compliance_flags')
    .select('*, staff(display_name)')
    .eq('branch_id', branchId)
    .eq('flag_type', 'missing_notes')
    .eq('resolved', false)
    .order('created_at', { ascending: true });
  return data;
}
```

### Late Visit Detection (no new table)

```js
async function getLateVisits(branchId) {
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('tickets')
    .select('*, caregiver_assignments(staff_id)')
    .eq('branch_id', branchId)
    .eq('status', 'waiting')
    .lt('scheduled_at', fifteenMinsAgo);
  return data;
}
```

### Workflow Event Logger

```js
async function logEvent(branchId, staffId, eventType, payload) {
  // Strip any PHI from payload before logging
  const safePayloa = sanitizePayload(payload); // remove names, DOBs, IDs
  await supabase.from('workflow_events').insert({
    branch_id: branchId,
    actor_id: staffId,
    event_type: eventType,
    payload: safePayload,
  });
}
```

### AI Summary Call (PHI-free)

```js
async function getCoordinatorBriefing(branchId) {
  // Fetch counts only — never raw client data
  const [flags, lateVisits, pendingDocs] = await Promise.all([
    supabase.from('compliance_flags').select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId).eq('resolved', false),
    getLateVisits(branchId),
    supabase.from('document_status').select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId).eq('status', 'pending'),
  ]);

  const context = {
    openFlags: flags.count,
    lateVisits: lateVisits.length,
    pendingDocs: pendingDocs.count,
  };

  // Call your AI with PHI-free context
  const summary = await callAI(context); // numbers and types only
  return summary;
}
```

---

## 10. LONG-TERM STRATEGY

### The Module Architecture Scales to Any Industry

```
branch.module = 'standard'      → Queue + bookings (current)
branch.module = 'homecare'      → Visit tracking + compliance
branch.module = 'logistics'     → Delivery tasks + route tracking
branch.module = 'field_service' → Technician dispatch + job completion
branch.module = 'restaurant'    → Table management + covers
branch.module = 'clinic'        → Patient flow + appointment types
```

Every module reuses:
- The same `tickets` table (just different status vocabulary)
- The same `staff` and `branches` tables
- The same `bookings` table for scheduling
- The same WhatsApp notification system
- The same queue display infrastructure

Each module adds only:
- A metadata table (e.g., `visit_metadata`, `delivery_metadata`)
- A compliance/task table if needed
- A module-specific dashboard UI route
- Industry vocabulary in the UI (no backend vocabulary changes)

### Revenue Model Extension

| Tier | Feature |
|---|---|
| Essential | Standard queue only |
| Professional | Industry module (one) |
| Executive | Multiple modules + AI briefings |
| Manager | Compliance dashboard + audit log + team analytics |

### The Platform Pitch (12 months from now)

> "AzQueue is operational flow infrastructure. We started with barbershops. We now run home care agencies, logistics dispatch, and field service teams — all on the same engine. Your industry, our platform."

---

*Last updated: 2026-05-17 | Version: 1.0 — Healthcare Module MVP*
