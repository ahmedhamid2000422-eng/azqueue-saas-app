/**
 * checklists.js — Document & item checklists per service type.
 *
 * ARCHITECTURE
 *   DEFAULT_CHECKLISTS  — built-in checklists keyed by normalized service name.
 *                         Each entry: { items: string[], reminder?: string, needsChecklist: bool }
 *   getChecklist()      — matches a service name to the right checklist (fuzzy).
 *   buildChecklistMessage() — formats the SMS/WhatsApp message to send the customer.
 *   loadCustomChecklists()  — reads branch overrides from localStorage.
 *   saveCustomChecklist()   — persists a branch override to localStorage.
 *
 * CUSTOMIZATION
 *   Staff can override any default from Settings → Checklists.
 *   Overrides are stored in localStorage as:
 *     azqueue_checklists_<branchId>  →  { [serviceKey]: { items, reminder } }
 *
 * EXTENDING
 *   Add a new key to DEFAULT_CHECKLISTS. The key is a lowercase match pattern
 *   checked against the service name (partial match).  More specific patterns
 *   should come first in the object literal order — the matcher picks the
 *   first hit.
 */

// ── Default checklists by service keyword ────────────────────────────────

export const DEFAULT_CHECKLISTS = {

  // ── Immigration ────────────────────────────────────────────────────────

  "n-400": {
    label: "Naturalization (N-400)",
    needsChecklist: true,
    reminder: "Bring originals AND photocopies of every document.",
    items: [
      "Government-issued photo ID (passport or driver's license)",
      "Green Card (Permanent Resident Card)",
      "Social Security Card",
      "Two passport-style photos (2x2 in, white background)",
      "Tax returns for the last 3 years (IRS transcripts accepted)",
      "Proof of continuous residence (lease, utility bills, bank statements)",
      "Marriage certificate (if applying based on marriage)",
      "Divorce decrees for any prior marriages",
      "Travel history for last 5 years (list of trips outside the US)",
      "Any prior immigration documents (visas, I-94, EAD cards)",
      "Check or money order for filing fee (currently $640 + $85 biometrics)",
    ],
  },

  "i-485": {
    label: "Adjustment of Status (I-485 / Green Card)",
    needsChecklist: true,
    reminder: "Bring originals AND photocopies. Medical exam (I-693) must be sealed by doctor.",
    items: [
      "Valid passport",
      "Birth certificate with certified English translation",
      "Two passport-style photos (2x2 in, white background)",
      "Current visa/I-94 Arrival/Departure record",
      "Approved I-130 or I-140 petition notice",
      "Affidavit of Support (Form I-864) with sponsor's tax return",
      "Medical examination report (Form I-693, sealed envelope from civil surgeon)",
      "Police clearance certificates (if lived abroad 6+ months since age 16)",
      "Evidence of marriage/relationship to petitioner (if applicable)",
      "Employment authorization card (if currently on EAD)",
    ],
  },

  "i-130": {
    label: "Family Petition (I-130)",
    needsChecklist: true,
    items: [
      "Petitioner's proof of US citizenship or Green Card",
      "Petitioner's valid photo ID",
      "Marriage certificate (if petitioning for spouse)",
      "Birth certificates for both petitioner and beneficiary",
      "Divorce decrees for any prior marriages",
      "Recent passport-style photo of each person",
      "Filing fee payment (check/money order)",
    ],
  },

  "daca": {
    label: "DACA Renewal / Application",
    needsChecklist: true,
    reminder: "File at least 4-5 months before your current DACA expires.",
    items: [
      "Government-issued photo ID",
      "Proof of continuous US residence since June 15, 2007",
      "School records, transcripts, or diplomas",
      "Employment records or pay stubs",
      "Proof of arrival before age 16 (I-94, passport stamps, school records)",
      "Any prior DACA approval notices",
      "Two passport-style photos",
      "Filing fee ($495 — waiver available for severe financial hardship)",
    ],
  },

  "asylum": {
    label: "Asylum Application",
    needsChecklist: true,
    reminder: "You must apply within 1 year of arriving in the US.",
    items: [
      "Completed Form I-589",
      "Passport or other travel documents",
      "Two passport-style photos",
      "Evidence of persecution or fear of persecution (police reports, news articles, medical records, affidavits)",
      "Country conditions documentation (US State Dept reports, news)",
      "Birth certificate (with certified translation)",
      "Any prior immigration documents",
    ],
  },

  "immigration": {
    label: "Immigration Consultation",
    needsChecklist: true,
    reminder: "Bring all immigration documents you currently have — we will review and advise.",
    items: [
      "Passport(s) — current and any expired",
      "All immigration documents (visas, Green Card, EAD, I-94)",
      "Social Security card or ITIN",
      "Government-issued photo ID",
      "Marriage / divorce / birth certificates (if applicable)",
      "Any prior USCIS notices or rejection letters",
      "List of countries lived in since age 16",
    ],
  },

  // ── Tax & Accounting ───────────────────────────────────────────────────

  "tax preparation": {
    label: "Tax Preparation",
    needsChecklist: true,
    reminder: "The more documents you bring, the faster we can process your return.",
    items: [
      "Government-issued photo ID",
      "Social Security cards for yourself, spouse, and all dependents",
      "W-2 forms (from all employers)",
      "1099 forms (freelance, interest, dividends, retirement, SSA)",
      "Previous year's federal and state tax returns",
      "Bank account and routing number (for direct deposit refund)",
      "Mortgage interest statement (Form 1098) — if applicable",
      "Receipts for deductible expenses (medical, charitable donations, business)",
      "Childcare provider name, address, and Tax ID/SSN",
      "Education expense records (Form 1098-T)",
      "Health insurance statements (Form 1095-A/B/C)",
    ],
  },


  "business tax": {
    label: "Business Tax Preparation",
    needsChecklist: true,
    reminder: "Business taxes are significantly more complex than personal returns. Book a longer appointment and bring everything — we cannot start without the complete picture.",
    items: [
      "Business entity documents (Articles of Incorporation, LLC Operating Agreement)",
      "Employer Identification Number (EIN) letter from IRS",
      "Business bank statements — ALL accounts (full year)",
      "Business credit card statements (full year)",
      "Profit & Loss statement (if you have one from accounting software)",
      "All 1099-NEC forms received (from clients who paid you $600+)",
      "All 1099-K forms (from payment processors: Stripe, PayPal, Square, etc.)",
      "Payroll records and W-2s issued to employees",
      "Quarterly payroll tax returns (Form 941) — all 4 quarters",
      "Business expenses: rent/lease, utilities, software, subscriptions",
      "Receipts for equipment purchases and capital expenditures",
      "Mileage log (if using a vehicle for business)",
      "Home office measurements (if claiming home office deduction)",
      "Business insurance payments",
      "Previous year's business tax return (Form 1120, 1120-S, or 1065)",
      "Owner's personal Social Security number or ITIN",
      "List of all business owners and their ownership percentage",
    ],
  },

  "corporate tax": {
    label: "Corporate Tax (C-Corp / S-Corp)",
    needsChecklist: true,
    reminder: "C-Corp and S-Corp returns have strict deadlines. Bring everything — late filings trigger automatic penalties.",
    items: [
      "Articles of Incorporation and corporate bylaws",
      "EIN confirmation letter",
      "Shareholder list with ownership percentages and SSNs",
      "Minutes from all shareholder/director meetings",
      "All corporate bank statements (full year)",
      "Payroll records and officer W-2s",
      "Form 941 (quarterly payroll tax returns) for all 4 quarters",
      "1099s issued to independent contractors",
      "Balance sheet as of December 31",
      "Profit & Loss statement (full year)",
      "Fixed asset schedule (equipment, vehicles, property)",
      "Depreciation schedule from prior year",
      "Loan agreements and interest statements",
      "Previous year's corporate tax return (1120 or 1120-S)",
      "Any IRS correspondence or audit notices",
      "State business license and registration",
    ],
  },

  "llc tax": {
    label: "LLC Tax Preparation",
    needsChecklist: true,
    reminder: "Single-member LLCs file on Schedule C; multi-member LLCs file Form 1065. Bring everything either way.",
    items: [
      "LLC Operating Agreement",
      "EIN letter (if LLC has employees or is multi-member)",
      "All LLC bank and credit card statements (full year)",
      "Revenue records (invoices, 1099s received)",
      "Business expense receipts and records",
      "Payroll records (if you have employees or pay yourself a salary)",
      "Previous year's return (Schedule C or Form 1065)",
      "Mileage log (if using a vehicle for business)",
      "Home office details (square footage, total home size)",
      "Equipment and asset purchase receipts",
      "All member SSNs/ITINs and ownership percentages",
    ],
  },

  "tax consult": {
    label: "Tax Consultation",
    needsChecklist: true,
    items: [
      "Government-issued photo ID",
      "Social Security card",
      "Last year's tax return",
      "Any IRS correspondence or notices",
      "Summary of income sources",
      "List of questions or concerns",
    ],
  },

  "bookkeeping": {
    label: "Bookkeeping / Accounting",
    needsChecklist: true,
    items: [
      "Business bank statements (last 3-12 months)",
      "Credit card statements",
      "Invoices issued and received",
      "Payroll records",
      "Business license",
      "Previous year's financial statements or tax return",
      "Login access to accounting software (QuickBooks, Xero, etc.)",
    ],
  },

  "tax": {
    label: "Tax Services",
    needsChecklist: true,
    reminder: "Bring all income documents. We will let you know if anything is missing.",
    items: [
      "Government-issued photo ID",
      "Social Security card",
      "All income documents (W-2, 1099, etc.)",
      "Previous year's tax return",
      "Bank account number for direct deposit",
      "Any IRS or state tax notices received",
    ],
  },

  // ── Medical & Healthcare ───────────────────────────────────────────────

  "dental": {
    label: "Dental Appointment",
    needsChecklist: true,
    items: [
      "Insurance card (dental and/or medical)",
      "Government-issued photo ID",
      "List of current medications and allergies",
      "Previous X-rays or dental records (if new patient)",
      "Referral letter (if required by your insurance)",
      "Payment method for copay or balance due",
    ],
  },

  "optometry": {
    label: "Eye Exam / Optometry",
    needsChecklist: true,
    items: [
      "Vision insurance card",
      "Government-issued photo ID",
      "Current glasses and/or contact lenses",
      "Previous prescription (if available)",
      "List of current medications",
    ],
  },

  "general practice": {
    label: "General Practice / Doctor Visit",
    needsChecklist: true,
    items: [
      "Health insurance card",
      "Government-issued photo ID",
      "Referral letter (if required)",
      "List of current medications and dosages",
      "List of allergies",
      "Previous test results or medical records (if new patient)",
      "Payment for copay",
    ],
  },

  "medical": {
    label: "Medical Appointment",
    needsChecklist: true,
    items: [
      "Health insurance card",
      "Government-issued photo ID",
      "List of current medications",
      "List of allergies",
      "Any relevant prior test results or medical records",
      "Referral letter (if required by insurance)",
      "Payment for copay",
    ],
  },

  "physical therapy": {
    label: "Physical Therapy",
    needsChecklist: true,
    items: [
      "Health insurance card",
      "Government-issued photo ID",
      "Doctor's referral or prescription",
      "Comfortable workout clothing",
      "List of current medications",
    ],
  },

  "vaccination": {
    label: "Vaccination / Immunization",
    needsChecklist: true,
    items: [
      "Immunization / vaccination records (if available)",
      "Health insurance card",
      "Government-issued photo ID",
      "List of current medications and allergies",
    ],
  },

  // ── Legal ──────────────────────────────────────────────────────────────

  "notary": {
    label: "Notary Services",
    needsChecklist: true,
    reminder: "Do NOT sign the document before the notary — sign in their presence only.",
    items: [
      "The unsigned document to be notarized",
      "Government-issued photo ID (passport, driver's license — must be original, not a copy)",
      "All signatories must be present in person",
      "Any witnesses required by the document (bring them with you)",
    ],
  },

  "legal consult": {
    label: "Legal Consultation",
    needsChecklist: true,
    items: [
      "Government-issued photo ID",
      "All relevant documents related to your case",
      "Timeline of key events (written summary)",
      "Any court notices, letters, or legal correspondence",
      "Prior attorney correspondence or retainer agreements",
      "Contact information for witnesses or other parties",
    ],
  },

  "contract": {
    label: "Contract Review",
    needsChecklist: true,
    items: [
      "The contract(s) to be reviewed (digital or printed)",
      "Government-issued photo ID",
      "Background on the other party",
      "Your questions and concerns about the contract",
    ],
  },

  "legal": {
    label: "Legal Services",
    needsChecklist: true,
    reminder: "Bring originals and copies of all relevant documents.",
    items: [
      "Government-issued photo ID",
      "All documents related to your matter",
      "Any correspondence with opposing parties",
      "Court orders or prior judgments (if applicable)",
      "Your written summary of the situation",
    ],
  },

  // ── Automotive ────────────────────────────────────────────────────────

  "oil change": {
    label: "Oil Change",
    needsChecklist: false,
    items: [
      "Your vehicle",
      "Preferred oil type (if you have one — we can advise)",
    ],
  },

  "inspection": {
    label: "Vehicle Inspection",
    needsChecklist: true,
    items: [
      "Vehicle registration",
      "Proof of insurance",
      "Valid driver's license",
      "Payment for inspection fee",
    ],
  },

  "registration": {
    label: "Vehicle Registration",
    needsChecklist: true,
    items: [
      "Current title or prior registration",
      "Proof of valid insurance",
      "Government-issued photo ID",
      "Odometer reading",
      "Payment for registration fees",
      "Passed inspection certificate (if required in your state)",
    ],
  },

  "car service": {
    label: "Vehicle Service / Repair",
    needsChecklist: true,
    items: [
      "Vehicle registration and insurance card",
      "Driver's license",
      "Keys (including spare if available)",
      "Description of the issue or symptoms",
      "Prior service records (if available)",
    ],
  },

  "automotive": {
    label: "Automotive Services",
    needsChecklist: false,
    items: [
      "Vehicle registration",
      "Insurance card",
      "Driver's license",
    ],
  },

  // ── Government & DMV ──────────────────────────────────────────────────

  "driver's license": {
    label: "Driver's License",
    needsChecklist: true,
    reminder: "Requirements vary by state — verify on your DMV website.",
    items: [
      "Proof of identity (birth certificate, passport, or US citizenship certificate)",
      "Proof of Social Security number (SSN card, W-2, or 1099)",
      "Two proofs of state residency (utility bill, bank statement, lease dated within 90 days)",
      "Existing driver's license or ID card (if renewing or transferring)",
      "Payment for license fee",
    ],
  },

  "dmv": {
    label: "DMV / Motor Vehicle",
    needsChecklist: true,
    items: [
      "Government-issued photo ID",
      "Proof of residency (utility bill, bank statement)",
      "Social Security card or proof of SSN",
      "Vehicle title and registration (if vehicle-related)",
      "Payment for applicable fees",
    ],
  },

  "passport": {
    label: "Passport Application",
    needsChecklist: true,
    reminder: "Standard processing takes 6-8 weeks. Expedited available for ~$60 extra.",
    items: [
      "Completed Form DS-11 (new) or DS-82 (renewal) — do not sign until instructed",
      "Proof of US citizenship (birth certificate, prior US passport, naturalization certificate)",
      "Government-issued photo ID + photocopy",
      "Two passport-style photos (2x2 in, taken within last 6 months)",
      "Payment: $130 (book) + $35 execution fee — exact amount or check payable to US Dept of State",
    ],
  },

  "social security": {
    label: "Social Security Services",
    needsChecklist: true,
    items: [
      "Government-issued photo ID",
      "Birth certificate",
      "Proof of US citizenship or immigration status",
      "Social Security card (if replacing)",
      "Any Social Security correspondence or notices",
    ],
  },

  "government": {
    label: "Government Services",
    needsChecklist: true,
    items: [
      "Government-issued photo ID",
      "Social Security card",
      "Proof of residency",
      "Relevant prior correspondence or application numbers",
    ],
  },

  // ── Banking & Finance ──────────────────────────────────────────────────

  "mortgage": {
    label: "Mortgage Consultation",
    needsChecklist: true,
    reminder: "Pre-approval typically takes 1-3 business days after submitting documents.",
    items: [
      "Government-issued photo ID",
      "Social Security number",
      "Last 2 years' W-2s and federal tax returns",
      "Recent pay stubs (last 30 days)",
      "Last 3 months' bank statements (all accounts)",
      "List of current debts (car loans, student loans, credit cards)",
      "Proof of other income (rental, alimony, etc.)",
      "Down payment source documentation (gift letter if gifted funds)",
      "Current lease agreement or proof of rent payment history",
    ],
  },

  "bank account": {
    label: "Bank Account Opening",
    needsChecklist: true,
    items: [
      "Government-issued photo ID",
      "Social Security card or ITIN",
      "Proof of address (utility bill, bank statement)",
      "Initial deposit amount",
      "Co-applicant ID (for joint accounts)",
    ],
  },

  "loan": {
    label: "Loan Application",
    needsChecklist: true,
    items: [
      "Government-issued photo ID",
      "Social Security card",
      "Recent pay stubs (last 2-3 months)",
      "Last 2 years' tax returns",
      "Bank statements (last 3 months)",
      "Proof of address",
      "Information on collateral (for secured loans)",
    ],
  },

  "financial": {
    label: "Financial Services",
    needsChecklist: true,
    items: [
      "Government-issued photo ID",
      "Social Security card",
      "Proof of income (pay stubs or tax returns)",
      "Relevant financial statements or documents",
    ],
  },

  // ── Education ─────────────────────────────────────────────────────────

  "enrollment": {
    label: "School Enrollment",
    needsChecklist: true,
    items: [
      "Birth certificate",
      "Government-issued photo ID (parent or guardian)",
      "Proof of residency in the school district",
      "Immunization records",
      "Previous school records and transcripts",
      "IEP or 504 plan documentation (if applicable)",
      "Custody documents (if applicable)",
    ],
  },

  "tutoring": {
    label: "Tutoring / Academic Support",
    needsChecklist: false,
    items: [
      "Current textbooks and class materials",
      "Recent tests or assignments with teacher feedback",
      "List of specific topics or skills to work on",
    ],
  },

  "education": {
    label: "Educational Services",
    needsChecklist: false,
    items: [
      "Any relevant prior transcripts or records",
      "List of your goals and questions",
    ],
  },

  // ── Personal Services (no checklist needed) ────────────────────────────

  "haircut": { label: "Haircut", needsChecklist: false, items: [] },
  "barber":  { label: "Barber", needsChecklist: false, items: [] },
  "salon":   { label: "Salon",  needsChecklist: false, items: [] },
  "nails":   { label: "Nails",  needsChecklist: false, items: [] },
  "massage": { label: "Massage",needsChecklist: false, items: [] },
  "spa":     { label: "Spa",    needsChecklist: false, items: [] },

  // ── Food & Hospitality (no checklist needed) ───────────────────────────

  "restaurant": { label: "Restaurant", needsChecklist: false, items: [] },
  "cafe":       { label: "Cafe",       needsChecklist: false, items: [] },
  "food":       { label: "Food",       needsChecklist: false, items: [] },
  "coffee":     { label: "Coffee",     needsChecklist: false, items: [] },

  // ── General fallback ──────────────────────────────────────────────────

  "general": {
    label: "General Appointment",
    needsChecklist: false,
    items: [
      "Government-issued photo ID",
      "Any relevant documents for your visit",
    ],
  },
};

// ── Lookup ───────────────────────────────────────────────────────────────

/**
 * Find the best matching checklist for a given service name.
 * Tries exact match first, then partial keyword match in priority order.
 *
 * @param {string} serviceName   — e.g. "N-400 Naturalization", "Tax Preparation", "Haircut"
 * @returns {{ key, label, needsChecklist, items, reminder? } | null}
 */
export function getChecklist(serviceName) {
  if (!serviceName) return DEFAULT_CHECKLISTS["general"];
  const lower = serviceName.toLowerCase().trim();

  // 1. Try exact key match
  if (DEFAULT_CHECKLISTS[lower]) return { key: lower, ...DEFAULT_CHECKLISTS[lower] };

  // 2. Try partial match in priority order (object key order = priority)
  for (const [key, val] of Object.entries(DEFAULT_CHECKLISTS)) {
    if (lower.includes(key) || key.split(" ").every((w) => lower.includes(w))) {
      return { key, ...val };
    }
  }

  // 3. Fallback
  return { key: "general", ...DEFAULT_CHECKLISTS["general"] };
}

// ── Message formatter ────────────────────────────────────────────────────

/**
 * Build the WhatsApp/SMS checklist message to send the customer.
 *
 * @param {{
 *   customerName: string,
 *   businessName: string,
 *   serviceName: string,
 *   token: string | number,
 *   checklist: { items: string[], reminder?: string },
 * }} opts
 * @returns {string}
 */
export function buildChecklistMessage({ customerName, businessName, serviceName, token, checklist }) {
  const greeting = customerName ? `Hi ${customerName.split(" ")[0]}!` : "Hi!";
  const lines = [
    `${greeting} You're in the queue at ${businessName} (ticket #${token}).`,
    "",
    `Your appointment: *${serviceName}*`,
    "",
    "Please bring the following:",
  ];

  for (const item of checklist.items) {
    lines.push(`  - ${item}`);
  }

  if (checklist.reminder) {
    lines.push("");
    lines.push(`Note: ${checklist.reminder}`);
  }

  lines.push("");
  lines.push("See you soon!");

  return lines.join("\n");
}

// ── Branch-level customization (localStorage) ────────────────────────────

const storageKey = (branchId) => `azqueue_checklists_${branchId}`;

/**
 * Load any staff-customized checklists for this branch.
 * Returns object: { [serviceKey]: { items: string[], reminder?: string } }
 */
export function loadCustomChecklists(branchId) {
  try {
    const raw = localStorage.getItem(storageKey(branchId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Save a custom checklist override for a specific service at this branch.
 */
export function saveCustomChecklist(branchId, serviceKey, { items, reminder }) {
  try {
    const existing = loadCustomChecklists(branchId);
    existing[serviceKey] = { items, reminder: reminder || undefined };
    localStorage.setItem(storageKey(branchId), JSON.stringify(existing));
    return true;
  } catch {
    return false;
  }
}

/**
 * Reset a service checklist back to the system default.
 */
export function resetCustomChecklist(branchId, serviceKey) {
  try {
    const existing = loadCustomChecklists(branchId);
    delete existing[serviceKey];
    localStorage.setItem(storageKey(branchId), JSON.stringify(existing));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the effective checklist for a service at a branch
 * (custom override takes precedence over default).
 */
export function getEffectiveChecklist(branchId, serviceName) {
  const base = getChecklist(serviceName);
  if (!base || !base.needsChecklist) return base;

  const customs = loadCustomChecklists(branchId);
  const override = customs[base.key];
  if (!override) return base;

  return { ...base, ...override };
}
