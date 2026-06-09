/**
 * flows.ts — Default conversation flows per business type.
 *
 * Each flow defines:
 *   welcome      : opening message (supports {{branch}} token)
 *   menu_items   : first-reply options shown as a numbered list
 *   questions    : ordered qualification questions per service
 *   handoff_msg  : final message before human takeover
 *   brand_tone   : influences Claude system prompt
 *
 * Branch owners can override any of these via wa_flow_config in Settings.
 */

export interface MenuItem {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  ask: string;    // message to send
  key: string;    // key stored in context
  optional?: boolean;
}

export interface Flow {
  welcome: string;
  menu_items: MenuItem[];
  questions: Question[];
  handoff_msg: string;
  brand_tone: string;
  lead_fields: string[];
}

// ── Design / Interior Studio ──────────────────────────────────────────────────
const designFlow: Flow = {
  welcome:
    "👋 Hi! Welcome to *{{branch}}*.\n\nI'm here to help you get started. What can I assist you with today?",
  menu_items: [
    { id: "kitchen",    label: "🍳 Kitchen Cabinet Design" },
    { id: "bathroom",   label: "🛁 Bathroom Design" },
    { id: "full_reno",  label: "🏠 Full Home Renovation" },
    { id: "commercial", label: "🏢 Commercial / Office Design" },
    { id: "furniture",  label: "🪑 Furniture & Custom Carpentry" },
    { id: "booking",    label: "📅 Book a Consultation" },
    { id: "general",    label: "💬 General Inquiry" },
  ],
  questions: [
    { id: "property_type", key: "property_type", ask: "What type of property is this for?\n_(e.g. Apartment, Landed House, Office, Condo)_" },
    { id: "location",      key: "location",      ask: "Which area is the property located in?\n_(e.g. Putrajaya, Selangor, KL)_" },
    { id: "budget",        key: "budget_range",  ask: "What is your approximate budget range?\n_(e.g. RM 30k–50k, RM 80k–120k, or 'not sure yet')_" },
    { id: "timeline",      key: "timeline",      ask: "When are you looking to start?\n1️⃣ Urgent (within a month)\n2️⃣ 1–3 months\n3️⃣ Just planning for now" },
    { id: "requirements",  key: "requirements",  ask: "Any specific requirements or style preferences? _(Optional — or just say 'skip')_", optional: true },
  ],
  handoff_msg:
    "✅ Thank you! I've passed your details to our design team.\n\nWe'll reach out within *1 business day* to discuss your project further. Talk soon! 😊",
  brand_tone: "professional and warm, like a friendly interior designer",
  lead_fields: ["property_type", "location", "budget_range", "timeline", "requirements"],
};

// ── Tax / Professional Services ───────────────────────────────────────────────
const taxFlow: Flow = {
  welcome:
    "👋 Hello! Welcome to *{{branch}}*.\n\nHow can I help you today?",
  menu_items: [
    { id: "personal_tax",  label: "👤 Personal Tax Return" },
    { id: "business_tax",  label: "🏢 Business / Company Tax" },
    { id: "gst_vat",       label: "📊 GST / VAT Filing" },
    { id: "bookkeeping",   label: "📒 Bookkeeping & Accounts" },
    { id: "payroll",       label: "💰 Payroll Services" },
    { id: "booking",       label: "📅 Book a Consultation" },
    { id: "general",       label: "💬 General Inquiry" },
  ],
  questions: [
    { id: "entity_type", key: "property_type", ask: "Are you filing as an individual or a business?\n1️⃣ Individual / Sole trader\n2️⃣ Private company (Sdn Bhd / Ltd)\n3️⃣ Partnership / LLP" },
    { id: "location",    key: "location",      ask: "Where are you based? _(city or area)_" },
    { id: "turnover",    key: "budget_range",  ask: "Roughly what is your annual income / turnover?\n_(e.g. under RM 100k, RM 500k+, 'prefer not to say')_" },
    { id: "urgency",     key: "timeline",      ask: "How soon do you need this sorted?\n1️⃣ Urgent — deadline coming up\n2️⃣ Within the next month\n3️⃣ No rush, just exploring" },
    { id: "extra",       key: "requirements",  ask: "Anything else we should know? _(Optional)_", optional: true },
  ],
  handoff_msg:
    "✅ Got it! Our team will review your details and be in touch shortly.\n\nFor anything urgent, you can also call us directly. 📞",
  brand_tone: "professional and reassuring, like a trusted accountant",
  lead_fields: ["entity_type", "location", "turnover", "timeline", "requirements"],
};

// ── Gym / Fight Studio ────────────────────────────────────────────────────────
const gymFlow: Flow = {
  welcome:
    "👊 Hey! Welcome to *{{branch}}*.\n\nWhat are you interested in?",
  menu_items: [
    { id: "beginner",     label: "🥋 Beginner Classes" },
    { id: "advanced",     label: "⚡ Advanced / Sparring" },
    { id: "pt",           label: "🏋️ Personal Training" },
    { id: "membership",   label: "🪪 Membership Info" },
    { id: "drop_in",      label: "🎟️ Drop-in / Trial Class" },
    { id: "booking",      label: "📅 Book a Trial" },
    { id: "general",      label: "💬 General Question" },
  ],
  questions: [
    { id: "level",      key: "property_type", ask: "What is your current fitness / martial arts level?\n1️⃣ Complete beginner\n2️⃣ Some experience\n3️⃣ Intermediate\n4️⃣ Advanced / competitor" },
    { id: "location",   key: "location",      ask: "Which area are you coming from? _(helps us advise on schedule)_" },
    { id: "goal",       key: "budget_range",  ask: "What is your main goal?\n1️⃣ Get fit / lose weight\n2️⃣ Learn self-defence\n3️⃣ Compete / fight\n4️⃣ Just for fun" },
    { id: "timeline",   key: "timeline",      ask: "When are you looking to start?\n1️⃣ ASAP\n2️⃣ Within the next 2 weeks\n3️⃣ Just checking out options" },
    { id: "extra",      key: "requirements",  ask: "Anything else? Age, injuries, preferred days? _(Optional)_", optional: true },
  ],
  handoff_msg:
    "🥊 Awesome! Our team will reach out to confirm your first session.\n\nSee you on the mat! 💪",
  brand_tone: "energetic and motivating, like a friendly coach",
  lead_fields: ["level", "location", "goal", "timeline", "requirements"],
};

export const DEFAULT_FLOWS: Record<string, Flow> = {
  design:  designFlow,
  queue:   taxFlow,
  gym:     gymFlow,
};

/** Merge branch-level overrides on top of the default flow. */
export function resolveFlow(businessType: string, overrides: Partial<Flow> = {}): Flow {
  const base = DEFAULT_FLOWS[businessType] ?? DEFAULT_FLOWS["queue"];
  return { ...base, ...overrides };
}
