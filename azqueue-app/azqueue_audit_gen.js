const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TableOfContents
} = require('/usr/local/lib/node_modules_global/lib/node_modules/docx');
const fs = require('fs');

const GOLD="C9A86A",DARK="141410",RED="D9534F",AMBER="E6A817",GREEN="4CAF50",BLUE="4A90D9",GRAY="7A7870",LGRAY="D0CEC8";
const b1={style:BorderStyle.SINGLE,size:1,color:"CCCCCC"};
const bd={top:b1,bottom:b1,left:b1,right:b1};
const nb={style:BorderStyle.NONE,size:0,color:"FFFFFF"};
const nbd={top:nb,bottom:nb,left:nb,right:nb};

const h1=(t)=>new Paragraph({heading:HeadingLevel.HEADING_1,spacing:{before:360,after:120},children:[new TextRun({text:t,font:"Arial",size:36,bold:true,color:DARK})]});
const h2=(t)=>new Paragraph({heading:HeadingLevel.HEADING_2,spacing:{before:280,after:100},children:[new TextRun({text:t,font:"Arial",size:28,bold:true,color:DARK})]});
const h3=(t,c=DARK)=>new Paragraph({heading:HeadingLevel.HEADING_3,spacing:{before:200,after:80},children:[new TextRun({text:t,font:"Arial",size:24,bold:true,color:c})]});
const body=(t,c="333333")=>new Paragraph({spacing:{after:120},children:[new TextRun({text:t,font:"Arial",size:22,color:c})]});
const bullet=(t,lv=0)=>new Paragraph({numbering:{reference:"bullets",level:lv},spacing:{after:80},children:[new TextRun({text:t,font:"Arial",size:21,color:"333333"})]});
const numbered=(t)=>new Paragraph({numbering:{reference:"numbers",level:0},spacing:{after:80},children:[new TextRun({text:t,font:"Arial",size:21,color:"333333"})]});
const code=(t)=>new Paragraph({spacing:{after:80},indent:{left:360},children:[new TextRun({text:t,font:"Courier New",size:18,color:"993333"})]});
const divider=()=>new Paragraph({spacing:{before:160,after:160},border:{bottom:{style:BorderStyle.SINGLE,size:4,color:LGRAY,space:1}},children:[]});
const sp=(n=1)=>Array.from({length:n},()=>new Paragraph({children:[new TextRun("")]}));
const pb=()=>new Paragraph({children:[new PageBreak()]});

const tHead=(cols,widths)=>new TableRow({tableHeader:true,children:cols.map((c,i)=>new TableCell({borders:bd,width:{size:widths[i],type:WidthType.DXA},shading:{fill:"2A2A2E",type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:c,font:"Arial",size:20,bold:true,color:"E8E0D4"})]})]}))} );

const issueRow=(sev,area,desc,fix)=>{
  const sc=sev==="CRITICAL"?RED:sev==="HIGH"?AMBER:sev==="MEDIUM"?BLUE:GRAY;
  return new TableRow({children:[
    new TableCell({borders:bd,width:{size:1200,type:WidthType.DXA},shading:{fill:sc,type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80},verticalAlign:VerticalAlign.TOP,children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:sev,font:"Arial",size:17,bold:true,color:"FFFFFF"})]})]  }),
    new TableCell({borders:bd,width:{size:1500,type:WidthType.DXA},margins:{top:80,bottom:80,left:80,right:80},verticalAlign:VerticalAlign.TOP,children:[new Paragraph({children:[new TextRun({text:area,font:"Arial",size:19,bold:true,color:DARK})]})] }),
    new TableCell({borders:bd,width:{size:3300,type:WidthType.DXA},margins:{top:80,bottom:80,left:80,right:80},verticalAlign:VerticalAlign.TOP,children:[new Paragraph({children:[new TextRun({text:desc,font:"Arial",size:19,color:"222222"})]})] }),
    new TableCell({borders:bd,width:{size:3360,type:WidthType.DXA},shading:{fill:"F8F8F5",type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80},verticalAlign:VerticalAlign.TOP,children:[new Paragraph({children:[new TextRun({text:fix,font:"Arial",size:19,color:"333333",italics:true})]})]}),
  ]});
};

const featureRow=(feat,pri,tier,effort,value)=>{
  const pc=pri==="P0"?RED:pri==="P1"?AMBER:BLUE;
  return new TableRow({children:[
    new TableCell({borders:bd,width:{size:3200,type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:feat,font:"Arial",size:20,color:DARK})]})]}),
    new TableCell({borders:bd,width:{size:700,type:WidthType.DXA},shading:{fill:pc,type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:60,right:60},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:pri,font:"Arial",size:19,bold:true,color:"FFFFFF"})]})]}),
    new TableCell({borders:bd,width:{size:1600,type:WidthType.DXA},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:tier,font:"Arial",size:19,color:"444444"})]})] }),
    new TableCell({borders:bd,width:{size:1300,type:WidthType.DXA},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:effort,font:"Arial",size:19,color:GRAY})]})]}),
    new TableCell({borders:bd,width:{size:2560,type:WidthType.DXA},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:value,font:"Arial",size:19,color:"333333"})]})]}),
  ]});
};

const scoreRow=(label,score,max,color,note)=>new TableRow({children:[
  new TableCell({borders:bd,width:{size:3400,type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:label,font:"Arial",size:21,bold:true,color:DARK})]})]}),
  new TableCell({borders:bd,width:{size:1200,type:WidthType.DXA},shading:{fill:color,type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`${score}/${max}`,font:"Arial",size:22,bold:true,color:"FFFFFF"})]})]}),
  new TableCell({borders:bd,width:{size:4760,type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:note,font:"Arial",size:19,color:"333333"})]})]  }),
]});

const rmRow=(phase,task,owner,outcome)=>{
  const pc=phase.includes("1")?RED:phase.includes("2")?AMBER:BLUE;
  return new TableRow({children:[
    new TableCell({borders:bd,width:{size:1400,type:WidthType.DXA},shading:{fill:pc,type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:phase,font:"Arial",size:18,bold:true,color:"FFFFFF"})]})]}),
    new TableCell({borders:bd,width:{size:3560,type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:task,font:"Arial",size:20,color:DARK})]})]}),
    new TableCell({borders:bd,width:{size:1400,type:WidthType.DXA},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:owner,font:"Arial",size:19,color:GRAY})]})]}),
    new TableCell({borders:bd,width:{size:3000,type:WidthType.DXA},shading:{fill:"F8F8F5",type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:outcome,font:"Arial",size:19,color:"333333",italics:true})]})]}),
  ]});
};

const doc = new Document({
  numbering:{config:[
    {reference:"bullets",levels:[
      {level:0,format:LevelFormat.BULLET,text:"•",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:520,hanging:260}}}},
      {level:1,format:LevelFormat.BULLET,text:"–",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:900,hanging:260}}}},
    ]},
    {reference:"numbers",levels:[{level:0,format:LevelFormat.DECIMAL,text:"%1.",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:520,hanging:260}}}}]},
  ]},
  styles:{
    default:{document:{run:{font:"Arial",size:22,color:"333333"}}},
    paragraphStyles:[
      {id:"Heading1",name:"Heading 1",basedOn:"Normal",next:"Normal",quickFormat:true,run:{size:36,bold:true,font:"Arial",color:DARK},paragraph:{spacing:{before:360,after:120},outlineLevel:0}},
      {id:"Heading2",name:"Heading 2",basedOn:"Normal",next:"Normal",quickFormat:true,run:{size:28,bold:true,font:"Arial",color:DARK},paragraph:{spacing:{before:280,after:100},outlineLevel:1}},
      {id:"Heading3",name:"Heading 3",basedOn:"Normal",next:"Normal",quickFormat:true,run:{size:24,bold:true,font:"Arial",color:DARK},paragraph:{spacing:{before:200,after:80},outlineLevel:2}},
    ]
  },
  sections:[{
    properties:{page:{size:{width:12240,height:15840},margin:{top:1080,right:1080,bottom:1080,left:1080}}},
    headers:{default:new Header({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:"AzQueue · Production Readiness Audit — CONFIDENTIAL",font:"Arial",size:18,color:GRAY})]  })]})},
    footers:{default:new Footer({children:[new Paragraph({children:[new TextRun({text:"AzQueue Architecture Audit  |  June 2026  |  Page ",font:"Arial",size:18,color:GRAY}),new TextRun({children:[PageNumber.CURRENT],font:"Arial",size:18,color:GRAY})]  })]})},
    children:[

      // ── COVER ──────────────────────────────────────────────────
      ...sp(3),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:60},children:[new TextRun({text:"AzQueue",font:"Arial",size:80,bold:true,color:DARK})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:40},children:[new TextRun({text:"Production Readiness & Architecture Audit",font:"Arial",size:32,color:GRAY})]}),
      new Paragraph({alignment:AlignmentType.CENTER,border:{bottom:{style:BorderStyle.SINGLE,size:8,color:GOLD,space:1}},children:[new TextRun({text:" ",size:2})]}),
      ...sp(1),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:40},children:[new TextRun({text:"June 2026  |  CONFIDENTIAL — Internal Use Only",font:"Arial",size:22,bold:true,color:RED})]}),
      ...sp(2),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[1800,7560],rows:[new TableRow({children:[
        new TableCell({borders:bd,width:{size:1800,type:WidthType.DXA},shading:{fill:GOLD,type:ShadingType.CLEAR},margins:{top:120,bottom:120,left:160,right:160},verticalAlign:VerticalAlign.CENTER,children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"Overall Score",font:"Arial",size:44,bold:true,color:DARK})]})]}),
        new TableCell({borders:bd,width:{size:7560,type:WidthType.DXA},shading:{fill:"FAFAF8",type:ShadingType.CLEAR},margins:{top:120,bottom:120,left:200,right:200},children:[
          new Paragraph({children:[new TextRun({text:"54 / 120",font:"Arial",size:56,bold:true,color:AMBER})]}),
          new Paragraph({children:[new TextRun({text:"ENTERPRISE READINESS: EMERGING",font:"Arial",size:24,bold:true,color:DARK})]}),
          new Paragraph({spacing:{before:80},children:[new TextRun({text:"AzQueue has a strong architectural foundation: real-time queue with atomic claim, comprehensive RLS, smart auto-routing, multi-mode platform (queue + gym + bookings), WhatsApp AI Receptionist, and genuine competitive moats. Three critical security issues, a missing public API layer, no embeddable widget system, and scalability gaps prevent enterprise deployment today. This audit maps every gap with exact fixes and a 90-day plan to reach 85+/120.",font:"Arial",size:20,color:"444444"})]})
        ]}),
      ]})]  }),
      pb(),

      // ── TOC ────────────────────────────────────────────────────
      h1("Table of Contents"),
      new TableOfContents("Contents",{hyperlink:true,headingStyleRange:"1-2"}),
      pb(),

      // ── SECTION 1 ──────────────────────────────────────────────
      h1("1. Architecture Overview"),
      body("AzQueue runs on React 18 + Vite + Tailwind (frontend), Supabase (PostgreSQL 15 + Realtime + Auth + Edge Functions), Twilio for SMS/WhatsApp, and Stripe for billing. The stack choices are excellent for this stage. The real-time queue loop, RLS implementation, and atomic claim_next_ticket RPC are all enterprise-grade."),
      ...sp(1),
      h2("1.1 Stack Assessment"),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[2200,3680,3480],rows:[
        tHead(["Layer","Technology","Status"],[2200,3680,3480]),
        ...[
          ["Frontend","React 18 + Vite + Tailwind CSS","✓ Solid"],
          ["Backend / DB","Supabase (PostgreSQL 15), 24 migrations","✓ Solid"],
          ["Auth","Supabase Auth (email/password)","⚠ Missing SSO/SAML"],
          ["Real-Time","Supabase Realtime (postgres_changes)","✓ Working — needs hardening"],
          ["SMS / WhatsApp","Twilio REST — browser-side","✗ CRITICAL: credentials exposed"],
          ["AI","Claude Haiku via Anthropic API (Edge Function)","✓ Correct architecture"],
          ["Billing","Stripe + Supabase Edge Functions","✓ Solid"],
          ["Email","Not implemented","✗ Missing"],
          ["Push Notifications","Not implemented","✗ Missing"],
          ["Public API","Not implemented (tier gate exists, nothing behind it)","✗ Missing"],
          ["Embeddable Widgets","Not implemented","✗ Missing"],
        ].map(([a,b,c])=>new TableRow({children:[
          new TableCell({borders:bd,width:{size:2200,type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:a,font:"Arial",size:20,bold:true})]})] }),
          new TableCell({borders:bd,width:{size:3680,type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:b,font:"Arial",size:20,color:"333333"})]})] }),
          new TableCell({borders:bd,width:{size:3480,type:WidthType.DXA},shading:{fill:c.startsWith("✓")?"F0FFF0":c.startsWith("✗")?"FFF0F0":"FFFEF0",type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:c,font:"Arial",size:20,color:c.startsWith("✓")?"2E7D32":c.startsWith("✗")?"C62828":"E65100"})]})]}),
        ]}))
      ]}),
      ...sp(1),
      h2("1.2 Real-Time Implementation Assessment"),
      bullet("useQueue.js: One Supabase Realtime channel per branch, subscribed to postgres_changes on INSERT/UPDATE/DELETE. Optimistic updates with snapshot/rollback. CORRECT."),
      bullet("claim_next_ticket RPC: Uses FOR UPDATE SKIP LOCKED — the correct PostgreSQL pattern for concurrent queue systems. This is enterprise-grade concurrency control."),
      bullet("useDisplay.js: Separate display-{branchId} channel, independent of staff channels. Correct channel lifecycle (subscribe/cleanup). CORRECT."),
      body("What the current real-time system does NOT cover:","C62828"),
      bullet("No reconnection logic — silent channel drops leave staff dashboards stale with no UI warning"),
      bullet("Every Realtime event triggers a full SELECT of all tickets — no diff-based updates"),
      bullet("Booking changes do not push to the customer ticket page in real time"),
      bullet("No server-sent push to mobile devices — relies on browser tab staying open"),
      pb(),

      // ── SECTION 2 ──────────────────────────────────────────────
      h1("2. Critical Bugs"),
      body("Items marked CRITICAL must be resolved before any production deployment or enterprise client onboarding."),
      ...sp(1),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[1200,1500,3300,3360],rows:[
        tHead(["Severity","Area","Issue","Fix"],[1200,1500,3300,3360]),
        issueRow("CRITICAL","Security","Twilio Auth Token exposed via VITE_ environment variables. Any user who opens Chrome DevTools can read the token and make calls on your Twilio account.","Move all Twilio calls to a Supabase Edge Function (send-sms). Store credentials as Supabase Secrets. Remove all VITE_TWILIO_* variables."),
        issueRow("CRITICAL","Auth","getTier() in tier.js defaults to 'manager' when user_metadata.tier is absent. Every new signup gets the highest paid tier for free until tier is explicitly set.","Change default to 'essential'. Seed tier='essential' in the signup trigger or onboarding flow."),
        issueRow("CRITICAL","Security","WhatsApp webhook (wa-bot Edge Function) does not verify Twilio's X-Twilio-Signature header. Anyone can POST fake messages to generate leads, bookings, or trigger WhatsApp sends.","Add HMAC-SHA1 verification of the X-Twilio-Signature header before processing any request body."),
        issueRow("HIGH","Database","Two migrations share the 0008_ prefix (0008_staff_profile.sql and 0008_stations.sql). Supabase CLI applies alphabetically — behavior on fresh deployments is undefined.","Rename 0008_staff_profile.sql to 0021_staff_profile.sql (next available number after 0019)."),
        issueRow("HIGH","Privacy","branches_public_read policy is using(true) — anon can read ALL branches including owner_id UUIDs, lat/lng coordinates, and hours of every client.","Restrict to safe columns only via a DB view, or change policy to use (slug IS NOT NULL) and SELECT only id, name, slug, city, hours, lat, lng."),
        issueRow("HIGH","Queue","Daily capacity limit stored in localStorage. Each browser has independent limits; the setting resets on cache clear; limits can be bypassed by opening a different browser.","Add daily_capacity_limit INT to the branches table. Enforce with a Postgres trigger on ticket INSERT."),
        issueRow("HIGH","Realtime","No reconnection logic or stale-data detection. If Supabase Realtime drops (inactivity, network blip), the staff dashboard silently serves from a stale state.","Subscribe to channel.status events. On CLOSED or CHANNEL_ERROR, show a 'Reconnecting...' banner and re-subscribe. Add a 30-second polling fallback."),
        issueRow("MEDIUM","Database","generate_ticket_token() uses SELECT MAX() then computes the next number. Two simultaneous check-ins on a busy kiosk can produce duplicate tokens.","Replace with a Postgres SEQUENCE per branch or move token generation into the claim logic under a FOR UPDATE lock."),
        issueRow("MEDIUM","Scale","useQueue.js fetches all waiting+serving tickets on every Realtime event with no pagination. A branch with 500+ customers triggers a full table scan on every status change.","Add .limit(200) and cursor-based pagination. Apply diffs from Realtime events rather than full refetches."),
        issueRow("MEDIUM","Repo","src/modes/staff/Dashboard.jsx.bak is committed to the repository. Backup files can contain stale logic or leaked secrets.","Delete the file. Run: git rm src/modes/staff/Dashboard.jsx.bak. Add *.bak to .gitignore."),
        issueRow("LOW","Security","No rate limiting on the public ticket INSERT endpoint. A bot can flood any branch with thousands of fake tickets.","Proxy check-in through an Edge Function with IP-based rate limiting (max 5 tickets per IP per hour)."),
        issueRow("LOW","Analytics","Insights cache is computed on-demand when the dashboard is opened. No scheduled job — if no one opens Insights, no cache is built.","Add a pg_cron or Supabase scheduled Edge Function to run nightly. Fall back to live compute if cache is stale."),
      ]}),
      pb(),

      // ── SECTION 3 ──────────────────────────────────────────────
      h1("3. Missing Features"),
      body("Features are rated P0 (ship-blocker for enterprise sales), P1 (required for growth), P2 (competitive differentiator)."),
      ...sp(1),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[3200,700,1600,1300,2560],rows:[
        tHead(["Feature","Pri","Tier","Effort","Business Value"],[3200,700,1600,1300,2560]),
        featureRow("Public REST API + API Key Management","P0","Executive+","3 weeks","Unlocks integrations with tax/immigration/CRM platforms"),
        featureRow("Webhook Event System (ticket + booking events)","P0","Executive+","2 weeks","External systems react to queue events in real time"),
        featureRow("Embeddable Booking Widget (<script> tag)","P0","Pro+","3 weeks","Businesses add booking to their own website in minutes"),
        featureRow("Embeddable Queue Status Widget","P0","Pro+","1 week","Live queue depth + join-queue button on client's website"),
        featureRow("Staff Photos & Department Tags","P1","All","3 days","Required for visibility settings and customer booking trust"),
        featureRow("Staff Availability Calendar (working hours)","P1","Pro+","2 weeks","Prevents bookings outside staff availability"),
        featureRow("Direct Client-to-Staff Messaging","P1","Executive+","2 weeks","Replaces phone calls for appointment prep and follow-up"),
        featureRow("Customer Self-Serve Portal (/portal)","P1","Pro+","2 weeks","View history, reschedule, upload docs — reduces front-desk calls 40%"),
        featureRow("Email Notifications (Resend / SendGrid)","P1","All","1 week","Required for enterprise compliance; backup for SMS failures"),
        featureRow("Browser Push Notifications (Web Push / FCM)","P1","Pro+","1 week","Staff get called-customer alerts on mobile without keeping tab open"),
        featureRow("Staff Visibility Controls (owner configurable)","P1","All","3 days","Owner decides if customers see staff names and photos"),
        featureRow("White-Label: Custom Domain + Logo Upload","P1","Executive+","1 week","Reseller model; clients present AzQueue as their own product"),
        featureRow("GDPR / Data Deletion Tools","P1","All","1 week","Required for EU/UK clients; blocks enterprise procurement otherwise"),
        featureRow("Audit Log (all admin actions)","P1","Executive+","1 week","Required for enterprise compliance and support tickets"),
        featureRow("No-Show Prediction Model","P2","Executive+","2 weeks","Reduce empty slots by 15-25% with proactive overbooking"),
        featureRow("Queue Bottleneck Detection Alerts","P2","Executive+","1 week","Alert managers before queue backs up, not after"),
        featureRow("Staffing Recommendations Engine","P2","Manager","2 weeks","AI-driven: 'Add one agent at 2pm Thursdays'"),
        featureRow("SSO / SAML Authentication","P2","Manager","3 weeks","Required for enterprise IT procurement"),
        featureRow("Multi-Language Customer Flow (Check-In)","P2","Pro+","1 week","i18n files already exist; wire to CustomerCheckIn.jsx"),
        featureRow("CRM Sync: HubSpot, Salesforce","P2","Executive+","3 weeks","Customers + bookings sync to CRM automatically"),
      ]}),
      pb(),

      // ── SECTION 4 ──────────────────────────────────────────────
      h1("4. Missing Settings"),
      body("The Settings page has 9 tabs today. The following additional tabs and controls are required for a production-grade platform."),
      ...sp(1),
      h2("4.1 Queue Settings (New Tab)"),
      bullet("Auto-cancel rule: Mark tickets as no_show after N minutes of no response after being called"),
      bullet("Max daily walk-ins: Database-backed (not localStorage) capacity cap per branch"),
      bullet("Priority boost rules: +N priority for VIP customers, returning customers, or specific services"),
      bullet("Walk-in window: Block new check-ins X minutes before branch closing time"),
      bullet("Smart Sort toggle: Persist per-branch in database (currently only in React state)"),
      bullet("Queue pause / resume: Manual override with optional reason for display TV"),
      h2("4.2 Scheduling Settings (New Tab)"),
      bullet("Booking advance window: How many days ahead customers can book (1–90)"),
      bullet("Buffer time: Mandatory gap in minutes between bookings per staff member"),
      bullet("Same-day cutoff: No bookings accepted within X hours of the slot time"),
      bullet("Booking confirmation: Manual approval required vs. instant confirmation"),
      bullet("Cancellation policy: Deadline in hours and messaging to customer"),
      h2("4.3 Notification Settings (New Tab)"),
      bullet("Per-channel toggles: SMS, WhatsApp, Email on/off per notification event"),
      bullet("Template editor: Customise each message body per branch"),
      bullet("Send delay: Wait N seconds after ticket is called before sending notification"),
      bullet("Reminder schedule: Hours before booking to send class/appointment reminder"),
      h2("4.4 API Settings (New Tab — Gated to Executive+)"),
      bullet("API key generation: Create, name, copy, rotate, and revoke keys per branch"),
      bullet("Key permissions: Read-only vs. read-write vs. admin scope"),
      bullet("Webhook endpoint registration: URL, secret, and event subscription checkboxes"),
      bullet("Webhook delivery log: Last 50 attempts with status code, payload, and retry count"),
      h2("4.5 White-Label Settings (New Tab — Gated to Executive+)"),
      bullet("Brand color: Migration 0020_brand_color.sql exists in the DB but is not exposed in Settings or gated in tier.js — wire this up first"),
      bullet("Logo upload: Replace 'AQ' monogram in Topbar, Display TV, and check-in pages"),
      bullet("Custom domain: Point yourbrand.com to the AzQueue customer portal (CNAME + TLS)"),
      bullet("Remove 'Powered by AzQueue' footer from all customer-facing pages"),
      h2("4.6 Visibility Settings (New Tab)"),
      bullet("Show staff names to customers: Yes/No per branch"),
      bullet("Show staff photos: Yes/No per branch"),
      bullet("Show estimated wait time on check-in page: Yes/No"),
      bullet("Show queue position: Yes/No (some businesses prefer not showing queue length)"),
      bullet("Allow client-to-staff messaging: Yes/No per branch"),
      h2("4.7 Staff Controls (Expand Existing Staff Tab)"),
      bullet("Working hours per staff member: Mon–Sun availability grid"),
      bullet("Profile photo upload field (photo_url column needs to be added to staff table)"),
      bullet("Department assignment: Front Desk, Specialist, Manager, etc."),
      bullet("Max concurrent: How many customers this staff member handles simultaneously (default 1)"),
      bullet("Visible to customers: Toggle whether name appears on Display TV and booking page"),
      pb(),

      // ── SECTION 5 ──────────────────────────────────────────────
      h1("5. Scalability Risks"),
      ...sp(1),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[2000,3800,3560],rows:[
        tHead(["Risk","Current Behavior","Failure Mode at Scale"],[2000,3800,3560]),
        ...[
          ["Full-table refetch","Every Realtime event triggers SELECT all waiting+serving tickets (no limit, no diff)","At 500+ queue depth, 1,000 branches × 10 staff = 10,000 concurrent full-table scans on each status change."],
          ["Realtime channels","One channel per staff dashboard + one per TV display. No pooling.","100 branches × 12 users = 1,200 persistent WebSocket connections. Supabase free tier caps at 200."],
          ["Public branch read","Anon can SELECT * all branches with using(true). No index on slug.","10,000 branches: every check-in page load triggers a full table scan to find the branch by slug."],
          ["Token generation","SELECT MAX(token) + compute. Two concurrent inserts produce same token.","In a 20-kiosk urgent-care lobby, duplicate tokens occur daily causing customer confusion and staff errors."],
          ["Insights cache","Computed client-side on page open. No background job.","50 staff open Insights simultaneously on a busy Monday → 50 parallel compute queries on the same tables."],
          ["Edge Function cold starts","wa-bot and send-notification spin up cold after inactivity (2-3 second delay).","Customer receives their queue-called SMS 2-3 seconds late. At high volume this causes missed calls and complaints."],
        ].map(([a,b,c])=>new TableRow({children:[
          new TableCell({borders:bd,width:{size:2000,type:WidthType.DXA},shading:{fill:"FFF8F0",type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:a,font:"Arial",size:20,bold:true,color:"E65100"})]})] }),
          new TableCell({borders:bd,width:{size:3800,type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:b,font:"Arial",size:19,color:"333333"})]})] }),
          new TableCell({borders:bd,width:{size:3560,type:WidthType.DXA},shading:{fill:"FFF0F0",type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:c,font:"Arial",size:19,color:"C62828"})]})] }),
        ]}))
      ]}),
      ...sp(1),
      h2("5.1 Required Database Indexes"),
      code("CREATE INDEX IF NOT EXISTS branches_slug_idx ON public.branches(slug);"),
      code("CREATE INDEX IF NOT EXISTS bookings_staff_time_idx ON public.bookings(staff_id, scheduled_at);"),
      code("CREATE INDEX IF NOT EXISTS tickets_status_created_idx ON public.tickets(branch_id, status, created_at);"),
      code("CREATE INDEX IF NOT EXISTS staff_status_idx ON public.staff(branch_id, status);"),
      pb(),

      // ── SECTION 6 ──────────────────────────────────────────────
      h1("6. API Strategy"),
      body("The apiAccess flag in tier.js exists but there is nothing behind it. AzQueue needs a public REST API to integrate with tax platforms, immigration systems, CRM tools, and third-party kiosks."),
      ...sp(1),
      h2("6.1 Recommended Architecture"),
      body("Use Supabase PostgREST as the underlying data layer (already exists). Wrap it behind an Edge Function API proxy for key validation, rate limiting, and event dispatching. Zero new infrastructure required."),
      ...sp(1),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[2800,6560],rows:[
        tHead(["Endpoint","Description"],[2800,6560]),
        ...[
          ["GET /api/v1/queue","Live queue state: waiting count, average wait, currently serving tokens."],
          ["GET /api/v1/tickets/:id","Customer ticket status + estimated wait. No auth needed if ID is UUID."],
          ["POST /api/v1/tickets","Create a walk-in ticket programmatically (external kiosks, reception apps)."],
          ["GET /api/v1/bookings","List bookings for a date range. Requires API key with read scope."],
          ["POST /api/v1/bookings","Create a booking from CRM, tax platform, or immigration portal."],
          ["PATCH /api/v1/bookings/:id","Reschedule or cancel. External systems stay in sync automatically."],
          ["GET /api/v1/services","Available services for a branch. Powers external booking forms and embeds."],
          ["GET /api/v1/staff/availability","Available slots for a date + service. Required for the booking widget embed."],
          ["POST /api/v1/webhooks","Register a webhook: URL, secret, event subscriptions."],
          ["GET /api/v1/analytics/summary","Daily KPIs: served, avg_wait, no_show_rate. For external dashboards."],
        ].map(([a,b])=>new TableRow({children:[
          new TableCell({borders:bd,width:{size:2800,type:WidthType.DXA},shading:{fill:"F5F5FF",type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:a,font:"Courier New",size:18,color:"333399"})]})] }),
          new TableCell({borders:bd,width:{size:6560,type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:b,font:"Arial",size:19,color:"333333"})]})] }),
        ]}))
      ]}),
      ...sp(1),
      h2("6.2 API Security Model"),
      bullet("api_keys table: id, branch_id, key_hash (SHA-256), scopes (JSONB), last_used_at, expires_at"),
      bullet("Keys validated in Edge Function middleware before reaching PostgREST"),
      bullet("Rate limit: 100 req/min per key. Return 429 with Retry-After header on breach"),
      bullet("Webhook payloads signed with HMAC-SHA256 using a per-endpoint secret"),
      bullet("Key rotation: Old key works for 24 hours after new key is issued — zero downtime rotation"),
      bullet("All responses include X-Request-Id for debugging; logs stored in Supabase"),
      h2("6.3 Webhook Events"),
      bullet("ticket.created, ticket.called, ticket.completed, ticket.no_show, ticket.cancelled"),
      bullet("booking.created, booking.updated, booking.cancelled, booking.arrived"),
      bullet("queue.paused, queue.resumed, queue.capacity_reached"),
      bullet("Delivery: HTTP POST with JSON + X-AzQueue-Signature header"),
      bullet("Retry policy: 3 attempts with 5s / 30s / 5min exponential backoff"),
      pb(),

      // ── SECTION 7 ──────────────────────────────────────────────
      h1("7. Embeddable Platform"),
      body("The ability to embed AzQueue on any website via a single script tag is a P0 competitive requirement. Skiplino and Qminder both offer this. AzQueue does not yet."),
      ...sp(1),
      h2("7.1 Implementation"),
      code('<script src="https://cdn.azqueue.io/embed.js" data-branch="kl-downtown" data-widget="book"></script>'),
      ...sp(1),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[2000,3680,3680],rows:[
        tHead(["Widget","Function","Key Config Attributes"],[2000,3680,3680]),
        ...[
          ["Booking Widget","Service + slot picker embedded directly on the business's website. Posts booking to AzQueue API.","data-widget=\"book\", data-service, data-theme, data-accent-color"],
          ["Queue Status","Shows live queue depth and estimated wait. Optional 'Join queue' button.","data-widget=\"queue\", data-show-join=\"true\", data-max-wait-show"],
          ["Check-In Kiosk","Full-screen check-in flow in an iframe. Designed for lobby tablets.","data-widget=\"checkin\", data-kiosk=\"true\", data-lang=\"ar\""],
        ].map(([a,b,c])=>new TableRow({children:[
          new TableCell({borders:bd,width:{size:2000,type:WidthType.DXA},shading:{fill:"F0F8FF",type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:a,font:"Arial",size:20,bold:true,color:"1A237E"})]})] }),
          new TableCell({borders:bd,width:{size:3680,type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:b,font:"Arial",size:19})]})]}),
          new TableCell({borders:bd,width:{size:3680,type:WidthType.DXA},shading:{fill:"F8F8F5",type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:c,font:"Courier New",size:17,color:"333399"})]})]}),
        ]}))
      ]}),
      pb(),

      // ── SECTION 8 ──────────────────────────────────────────────
      h1("8. Staff Management Gaps"),
      body("The staff table (id, branch_id, user_id, display_name, role, status, status_since) is functional for queue routing but missing every field needed for client-facing staff management and availability blocking."),
      ...sp(1),
      h2("8.1 Required Schema Changes"),
      code("ALTER TABLE public.staff ADD COLUMN photo_url       TEXT;"),
      code("ALTER TABLE public.staff ADD COLUMN department      TEXT;"),
      code("ALTER TABLE public.staff ADD COLUMN bio             TEXT;"),
      code("ALTER TABLE public.staff ADD COLUMN visible_to_customers BOOLEAN NOT NULL DEFAULT true;"),
      code("ALTER TABLE public.staff ADD COLUMN max_concurrent  INT NOT NULL DEFAULT 1;"),
      code("ALTER TABLE public.staff ADD COLUMN working_hours   JSONB; -- {mon:[\"09:00\",\"17:00\"],...}"),
      ...sp(1),
      h2("8.2 Missing Staff Features"),
      bullet("Photo upload: Display on TV display and customer booking page for trust"),
      bullet("Department: Groups staff for auto-routing (Front Desk, Specialist, Manager)"),
      bullet("Working hours: Block booking slots outside available hours per staff member"),
      bullet("Break calendar: Pre-schedule prayer and lunch breaks that auto-block time slots"),
      bullet("Performance metrics: Avg service time per staff, satisfaction score, daily throughput"),
      bullet("Staff mobile PWA: Add web app manifest + service worker for 'install to phone' capability"),
      pb(),

      // ── SECTION 9 ──────────────────────────────────────────────
      h1("9. AI Feature Strategy"),
      body("The correct AI strategy for a queue platform is operational intelligence — invisible to staff and customers, but continuously improving throughput and reducing waste."),
      ...sp(1),
      h2("9.1 Build This (High ROI, Low Complexity)"),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[2600,2400,4360],rows:[
        tHead(["Feature","Input Signals","Output"],[2600,2400,4360]),
        ...[
          ["No-Show Prediction","Historical no_show status, day of week, booking lead time, weather API, customer visit history","Flag bookings > 40% no-show risk. Suggest overbooking 1 slot on high-risk days."],
          ["Queue Bottleneck Detection","service_times vs. service.duration_min estimates","Alert: 'Tax Return averaging 23m over estimate — add agent or split service.'"],
          ["Wait-Time Forecasting","Historical tickets per hour, staff on shift, current queue depth","Accurate predicted wait shown to customer before joining. Updates every 5 minutes."],
          ["Staffing Recommendations","Busy periods by hour/day (last 8 weeks), no-show rates, service mix","Weekly brief: 'Thursday 2-4pm needs 2 more agents based on 8 weeks of data.'"],
          ["Autopilot Confidence","service_times sample count, variance, recent vs. historical averages","Flag when autopilot diverges > 30% from reality. Show confidence interval to manager."],
        ].map(([a,b,c])=>new TableRow({children:[
          new TableCell({borders:bd,width:{size:2600,type:WidthType.DXA},shading:{fill:"F0FFF4",type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:a,font:"Arial",size:20,bold:true,color:"1B5E20"})]})] }),
          new TableCell({borders:bd,width:{size:2400,type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:b,font:"Arial",size:18,color:GRAY})]})]}),
          new TableCell({borders:bd,width:{size:4360,type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:c,font:"Arial",size:19})]})]}),
        ]}))
      ]}),
      ...sp(1),
      h2("9.2 Do NOT Build"),
      bullet("AI-generated check-in greetings — adds latency with zero operational value"),
      bullet("Sentiment analysis on customer names — invasive and inaccurate"),
      bullet("AI service recommendations during check-in — confuses customers and reduces throughput"),
      body("The WhatsApp AI Receptionist is exactly right: invisible, always available, scores leads without human intervention.","2E7D32"),
      pb(),

      // ── SECTION 10 ──────────────────────────────────────────────
      h1("10. UX Improvement Recommendations"),
      h2("10.1 Staff Dashboard"),
      bullet("'Next in queue' preview card below Call Next button — name, service, notes. Staff should see who they're calling before they call."),
      bullet("Keyboard shortcuts: Space = Call next, Esc = Return to queue, Enter = Complete. High-volume staff never reach for the mouse."),
      bullet("SLA color change: Elapsed timer should turn yellow at 80% of SLA threshold, red at 100%. Currently stays gold throughout."),
      bullet("Personal daily stats bar: Tickets served, avg time, satisfaction score. Creates accountability without a separate dashboard."),
      h2("10.2 Customer Check-In"),
      bullet("Show estimated wait BEFORE the customer confirms joining. '~12 min wait — join?' converts better than showing wait after commitment."),
      bullet("CustomerTicket.jsx should auto-refresh queue position using Realtime — currently requires manual reload."),
      bullet("Add a 'Leave the queue' button. No self-cancellation currently exists for customers."),
      h2("10.3 Booking Page"),
      bullet("Replace the time slot dropdown with a visual calendar grid (Calendly-style). Visual slot selection reduces booking abandonment by ~30%."),
      bullet("Show staff availability indicators on the booking page (green = available, gray = fully booked today)."),
      bullet("Booking confirmation page should include a QR code that pre-fills the check-in form on arrival."),
      h2("10.4 Settings"),
      bullet("At 9+ tabs the horizontal tab strip is becoming unmanageable. Move to a left sidebar navigation for Settings — more scannable and scales to 15+ sections."),
      bullet("Wire brand_color from migration 0020 into the General Settings tab. It exists in the DB but has no UI."),
      pb(),

      // ── SECTION 11 ──────────────────────────────────────────────
      h1("11. Enterprise Readiness Score"),
      ...sp(1),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[3400,1200,4760],rows:[
        tHead(["Dimension","Score","Notes"],[3400,1200,4760]),
        scoreRow("Real-Time Architecture",14,20,BLUE,"Supabase Realtime + optimistic updates + atomic RPC = solid. Loses 6 points for no reconnection handling, no diff updates, and no mobile push."),
        scoreRow("Security",6,20,RED,"Three critical vulnerabilities (Twilio exposed, tier default, no webhook HMAC). RLS is correct and saves this from being lower. Recovers to 16/20 after fixes."),
        scoreRow("Data Model & Multi-Tenancy",14,20,GREEN,"Comprehensive RLS, 24 disciplined migrations. Loses points for missing staff columns, no audit log, duplicate migration prefix."),
        scoreRow("API & Integration Layer",3,20,RED,"No public API, no API keys, no webhooks, no embeds. The tier gate (apiAccess) exists but nothing is behind it."),
        scoreRow("Scalability",8,20,AMBER,"Full-table refetch on each event, no rate limiting, localStorage for capacity, token race condition, no pagination."),
        scoreRow("Feature Completeness",9,20,AMBER,"Queue + gym + bookings + loyalty + WhatsApp AI are strong. Missing: embeds, customer portal, email, GDPR, white-label, SSO."),
        new TableRow({children:[
          new TableCell({borders:bd,width:{size:3400,type:WidthType.DXA},shading:{fill:DARK,type:ShadingType.CLEAR},margins:{top:100,bottom:100,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:"TOTAL ENTERPRISE READINESS",font:"Arial",size:22,bold:true,color:GOLD})]})]}),
          new TableCell({borders:bd,width:{size:1200,type:WidthType.DXA},shading:{fill:AMBER,type:ShadingType.CLEAR},margins:{top:100,bottom:100,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"54/120",font:"Arial",size:24,bold:true,color:DARK})]})]}),
          new TableCell({borders:bd,width:{size:4760,type:WidthType.DXA},shading:{fill:"2A2A2E",type:ShadingType.CLEAR},margins:{top:100,bottom:100,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:"Fix 3 security issues + build API layer = reaches 85+/120 within 90 days",font:"Arial",size:20,color:"D0CEC8"})]})]}),
        ]}),
      ]}),
      pb(),

      // ── SECTION 12 ──────────────────────────────────────────────
      h1("12. Competitive Advantages"),
      body("AzQueue has genuine differentiators that Skiplino, Qminder, and Timely do not offer. These should anchor the positioning and marketing."),
      ...sp(1),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[2600,2960,3800],rows:[
        tHead(["Advantage","vs. Competitors","Why It Matters"],[2600,2960,3800]),
        ...[
          ["Islamic Mode","No competitor has this. Qminder and Skiplino are Western tools.","Auto-pauses at Asr, Maghrib, Jumah. Massive differentiator in GCC, Malaysia, Pakistan, North Africa — 1.8B people."],
          ["WhatsApp AI Receptionist","Competitors use email and SMS. WhatsApp penetration in SEA/Gulf is 90%+.","Customers book, check status, and get reminders entirely in WhatsApp. Zero app download. Zero friction."],
          ["Multi-Mode Platform","Competitors solve queues only. AzQueue covers queues + gym + clinics + tax.","One platform for an entire business portfolio. Switching cost is near zero — reduces churn dramatically."],
          ["Autopilot Duration Learning","Qminder has static estimates. Skiplino uses manual input.","Wait time estimates improve weekly from real data, automatically. Staff never need to update durations manually."],
          ["Atomic Claim RPC","Most queue apps use naive SELECT + UPDATE — double-serving is a known bug.","FOR UPDATE SKIP LOCKED guarantees zero double-calling. Clients never see two staff racing for one customer."],
          ["Customer Persona AI","No competitor builds history + AI summaries at this price point.","Staff see returning customer history before saying hello. Feels premium; costs almost nothing in Haiku tokens."],
          ["Loyalty Built-In","Loyalty is a separate product everywhere else (Stamp, Square Loyalty).","Every completed visit automatically punches the card. No extra app, no extra cost, no integration needed."],
          ["Smart Staff Routing","Competitors assign randomly or by load only.","Complex cases route to specialists; simple cases preserve specialist capacity. Reduces average service time measurably."],
        ].map(([a,b,c])=>new TableRow({children:[
          new TableCell({borders:bd,width:{size:2600,type:WidthType.DXA},shading:{fill:"FFF9F0",type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:a,font:"Arial",size:20,bold:true,color:"7D4E00"})]})] }),
          new TableCell({borders:bd,width:{size:2960,type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:b,font:"Arial",size:19,color:GRAY})]})]}),
          new TableCell({borders:bd,width:{size:3800,type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({children:[new TextRun({text:c,font:"Arial",size:19,color:"222222"})]})]}),
        ]}))
      ]}),
      pb(),

      // ── SECTION 13 ──────────────────────────────────────────────
      h1("13. 90-Day Roadmap to Enterprise Readiness"),
      body("Month 1 = security and foundation (these are ship-blockers). Month 2 = API + embeds (growth enablers). Month 3 = intelligence + compliance (enterprise sales unlockers)."),
      ...sp(1),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[1400,3560,1400,3000],rows:[
        tHead(["Phase","Task","Owner","Business Outcome"],[1400,3560,1400,3000]),
        rmRow("Month 1\nDays 1–7","Move Twilio to Edge Function, store credentials as Supabase Secrets, remove all VITE_TWILIO_ vars","Backend","Production-safe credentials; can now onboard enterprise clients"),
        rmRow("Month 1\nDays 1–7","Fix getTier() default from 'manager' to 'essential'; seed tier on signup","Auth","Stops all new signups getting paid features for free"),
        rmRow("Month 1\nDays 1–7","Add Twilio HMAC-SHA1 verification to wa-bot Edge Function","Security","Closes webhook injection attack vector"),
        rmRow("Month 1\nDays 1–7","Rename 0008_staff_profile.sql → 0021_staff_profile.sql","DB","Fixes fresh-deploy breakage; unblocks new client onboarding"),
        rmRow("Month 1\nDays 8–14","Move capacity limit from localStorage to branches.daily_capacity_limit","DB + UI","Consistent limits across all devices and browsers"),
        rmRow("Month 1\nDays 8–14","Add Realtime reconnect logic + stale-data banner to useQueue","Frontend","Eliminates silent stale-queue bug that causes double-calls"),
        rmRow("Month 1\nDays 8–14","Restrict branches_public_read to safe columns only","Security","Stops anon enumeration of all client owner UUIDs"),
        rmRow("Month 1\nDays 15–21","Add staff.photo_url, department, working_hours, visible_to_customers columns + UI","DB + UI","Unblocks staff profiles, visibility settings, booking availability"),
        rmRow("Month 1\nDays 15–21","Add Queue Settings tab (auto-cancel, daily cap, smart sort persist)","Settings","Owners control queue behavior without code changes"),
        rmRow("Month 1\nDays 22–30","Add Notification Settings tab + per-branch template editor","Settings","Owners customize every customer message; removes brand friction"),
        rmRow("Month 1\nDays 22–30","Add pagination to ticket queries (cursor-based, 100 items) + diff-based realtime","Performance","Queue handles 500+ tickets without full-table scan on every event"),
        rmRow("Month 2\nDays 31–40","Build api_keys table + API Key Management tab in Settings","Backend + UI","Unlocks Executive tier API; required for all enterprise integrations"),
        rmRow("Month 2\nDays 31–40","Build webhook event system: table + Edge Function dispatcher + delivery log","Backend","External systems react to queue events without polling"),
        rmRow("Month 2\nDays 41–50","Build Booking Widget embed (script tag, React micro-app, theming)","Frontend","Businesses embed booking on their own site in under 10 minutes"),
        rmRow("Month 2\nDays 41–50","Build Queue Status embed (live count + join-queue button)","Frontend","Customers see wait time on client's website before arriving"),
        rmRow("Month 2\nDays 51–60","Build Customer Self-Serve Portal (/portal)","Full-stack","Reduces front-desk phone volume by ~40%"),
        rmRow("Month 2\nDays 51–60","Add email notifications (Resend or SendGrid via Edge Function)","Backend","Enterprise compliance requirement; backup for SMS failures"),
        rmRow("Month 2\nDays 51–60","Wire brand_color from 0020 migration into Settings General tab","UI","Clients have been paying for Executive tier without this being accessible"),
        rmRow("Month 3\nDays 61–70","No-show prediction model (logistic regression on service_times + bookings)","AI","Reduces empty slots 15-25% through proactive overbooking"),
        rmRow("Month 3\nDays 61–70","Queue bottleneck detection alerts","Analytics","Managers get actionable alert before queue backs up"),
        rmRow("Month 3\nDays 71–80","Staffing recommendations engine (weekly brief from 8 weeks of history)","AI","Saves managers 2-4 hours/week on scheduling decisions"),
        rmRow("Month 3\nDays 71–80","Rate limiting on check-in Edge Function proxy (5 tickets/IP/hour)","Security","Prevents bot floods on public check-in endpoint"),
        rmRow("Month 3\nDays 81–90","GDPR data deletion tools + full admin audit log","Compliance","Unblocks EU/UK client sales; required for enterprise procurement"),
        rmRow("Month 3\nDays 81–90","Browser Push Notifications via Web Push API + PWA manifest","Mobile","Staff get alerts on phone without keeping the browser tab open"),
      ]}),
      pb(),

      // ── SECTION 14 ──────────────────────────────────────────────
      h1("14. Quick Wins — Ship This Week"),
      body("These changes each take under 30 minutes and immediately improve the product:"),
      ...sp(1),
      numbered("Fix getTier() — change the default from 'manager' to 'essential' in src/lib/tier.js (one line)."),
      numbered("Delete Dashboard.jsx.bak — run: git rm src/modes/staff/Dashboard.jsx.bak && echo '*.bak' >> .gitignore"),
      numbered("Rename migration 0008_staff_profile.sql → 0021_staff_profile.sql to fix the numbering collision."),
      numbered("Add .limit(200) to the ticket SELECT in useQueue.js to prevent accidental full-table loads today."),
      numbered("Fix branches_public_read: change to using(slug IS NOT NULL) and SELECT only safe columns."),
      numbered("Wire brand_color from migration 0020 into Settings General tab — the column exists, it just needs a UI input and the tier gate."),
      numbered("Add the slug index: CREATE INDEX IF NOT EXISTS branches_slug_idx ON public.branches(slug);"),
      numbered("Add *.bak and .env.local to .gitignore if not already there."),
      ...sp(2),
      divider(),
      body("AzQueue has a genuinely strong foundation for its stage. The queue loop is clean, the RLS is correct, the auto-routing is intelligent, and Islamic Mode + WhatsApp AI are authentic competitive moats no Western competitor has. The path to enterprise readiness is clear: fix the three security issues this week, build the API layer next month, then layer in intelligence in Month 3. Following this plan, AzQueue reaches 85+/120 enterprise readiness within 90 days and is a credible competitor to Skiplino and Qminder across GCC and SEA.","444444"),
      ...sp(1),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:160},children:[new TextRun({text:"AzQueue Production Readiness Audit  |  June 2026  |  CONFIDENTIAL",font:"Arial",size:18,color:GRAY})]}),
    ]
  }]
});

Packer.toBuffer(doc).then(buf=>{
  fs.writeFileSync('/sessions/sharp-magical-mendel/mnt/azqueue-app/AzQueue_Architecture_Audit.docx',buf);
  console.log('SUCCESS');
}).catch(e=>{console.error('FAILED:',e.message);process.exit(1);});
