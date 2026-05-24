import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";
import { useBranch } from "../../lib/BranchContext";
import Card from "../../components/Card";
import Button from "../../components/Button";

/**
 * Onboarding — first-run business setup wizard.
 *
 * Replaces the previous "Create demo branch" button. Walks new owners through:
 *   Step 1 — Branch basics: name + city
 *   Step 2 — Location: geolocate or skip (drives prayer times)
 *   Step 3 — Services: pick from suggested presets or add custom
 *   Step 4 — Modes: Autopilot + Islamic Mode toggles
 *   Step 5 — Done: links to print poster, set up TV, invite staff
 *
 * Used by Queue.jsx when the signed-in user has no branches yet.
 */

// Industry → sub-type → tailored service catalog. Picking a sub-type gives
// the owner the most relevant starter list with one less decision to make.
const INDUSTRY_TREE = {
  service: {
    label: "Beauty & Personal Care",
    icon:  "✂",
    blurb: "Barbershop · Salon · Spa · Nail · Massage",
    subTypes: {
      barbershop: {
        label: "Barbershop",
        services: [
          { name: "Haircut",          duration_min: 20 },
          { name: "Beard Trim",       duration_min: 12 },
          { name: "Haircut + Beard",  duration_min: 30 },
          { name: "Hot towel shave",  duration_min: 25 },
          { name: "Kids cut",         duration_min: 15 },
        ],
      },
      salon: {
        label: "Hair salon",
        services: [
          { name: "Haircut",          duration_min: 30 },
          { name: "Hair colour",      duration_min: 90 },
          { name: "Highlights",       duration_min: 120 },
          { name: "Blow dry",         duration_min: 30 },
          { name: "Treatment",        duration_min: 45 },
        ],
      },
      spa: {
        label: "Spa",
        services: [
          { name: "Facial",           duration_min: 45 },
          { name: "Body massage",     duration_min: 60 },
          { name: "Hammam",           duration_min: 90 },
          { name: "Aromatherapy",     duration_min: 60 },
        ],
      },
      nail: {
        label: "Nail studio",
        services: [
          { name: "Manicure",         duration_min: 30 },
          { name: "Pedicure",         duration_min: 45 },
          { name: "Gel polish",       duration_min: 45 },
          { name: "Nail art",         duration_min: 60 },
        ],
      },
      lash: {
        label: "Lash & brow",
        services: [
          { name: "Lash lift",        duration_min: 60 },
          { name: "Lash extensions",  duration_min: 90 },
          { name: "Brow tint",        duration_min: 30 },
          { name: "Brow lamination",  duration_min: 45 },
        ],
      },
    },
  },
  hospitality: {
    label: "Food & Hospitality",
    icon:  "🍽",
    blurb: "Restaurant · Café · Bar · Bakery",
    subTypes: {
      casual: {
        label: "Casual restaurant",
        services: [
          { name: "Table for 2",   duration_min: 60 },
          { name: "Table for 4",   duration_min: 75 },
          { name: "Table for 6",   duration_min: 90 },
          { name: "Outdoor seat",  duration_min: 75 },
        ],
      },
      finedining: {
        label: "Fine dining",
        services: [
          { name: "Tasting menu (2)", duration_min: 120 },
          { name: "Tasting menu (4)", duration_min: 150 },
          { name: "Private dining",   duration_min: 180 },
        ],
      },
      cafe: {
        label: "Café",
        services: [
          { name: "Table for 2",   duration_min: 45 },
          { name: "Bar seat",      duration_min: 30 },
          { name: "Brunch table",  duration_min: 60 },
        ],
      },
      bakery: {
        label: "Bakery / takeaway",
        services: [
          { name: "Order pickup",  duration_min: 10 },
          { name: "Custom cake consult", duration_min: 30 },
        ],
      },
    },
  },
  healthcare: {
    label: "Healthcare",
    icon:  "⚕",
    blurb: "Clinic · Dental · Pharmacy · Specialist",
    subTypes: {
      clinic: {
        label: "GP / medical clinic",
        services: [
          { name: "Consultation",   duration_min: 20 },
          { name: "New patient",    duration_min: 45 },
          { name: "Follow-up",      duration_min: 15 },
          { name: "Procedure",      duration_min: 60 },
          { name: "Vaccination",    duration_min: 10 },
        ],
      },
      dental: {
        label: "Dental clinic",
        services: [
          { name: "Cleaning",       duration_min: 45 },
          { name: "Check-up",       duration_min: 20 },
          { name: "Filling",        duration_min: 60 },
          { name: "Whitening",      duration_min: 90 },
          { name: "Extraction",     duration_min: 45 },
        ],
      },
      pharmacy: {
        label: "Pharmacy",
        services: [
          { name: "Prescription pickup",  duration_min: 10 },
          { name: "Pharmacist consult",   duration_min: 15 },
          { name: "Medication review",    duration_min: 20 },
        ],
      },
      specialist: {
        label: "Specialist / hospital",
        services: [
          { name: "Specialist consult",  duration_min: 30 },
          { name: "Lab / blood test",    duration_min: 20 },
          { name: "Imaging / X-ray",     duration_min: 30 },
          { name: "Physiotherapy",       duration_min: 45 },
        ],
      },
    },
  },
  professional: {
    label: "Professional Services",
    icon:  "💼",
    blurb: "Law · Finance · Accounting · Consulting",
    subTypes: {
      legal: {
        label: "Law firm",
        services: [
          { name: "Initial consult",  duration_min: 30 },
          { name: "Document review",  duration_min: 60 },
          { name: "Notarisation",     duration_min: 15 },
          { name: "Mediation",        duration_min: 90 },
        ],
      },
      finance: {
        label: "Finance / advisory",
        services: [
          { name: "Discovery call",   duration_min: 30 },
          { name: "Portfolio review", duration_min: 60 },
          { name: "Tax consult",      duration_min: 45 },
          { name: "Insurance review", duration_min: 30 },
        ],
      },
      accounting: {
        label: "Accounting / audit",
        services: [
          { name: "Tax filing",       duration_min: 60 },
          { name: "Bookkeeping",      duration_min: 45 },
          { name: "Audit review",     duration_min: 90 },
        ],
      },
      consulting: {
        label: "Consulting",
        services: [
          { name: "Strategy session", duration_min: 60 },
          { name: "Business review",  duration_min: 90 },
          { name: "Workshop",         duration_min: 120 },
        ],
      },
    },
  },
  fitness: {
    label: "Fitness & Wellness",
    icon:  "🏋",
    blurb: "Gym · Yoga · PT · Pilates · Martial arts",
    subTypes: {
      gym: {
        label: "Gym",
        services: [
          { name: "Drop-in workout",   duration_min: 90 },
          { name: "Personal training", duration_min: 60 },
          { name: "Group class",       duration_min: 45 },
          { name: "Induction",         duration_min: 30 },
        ],
      },
      yoga: {
        label: "Yoga studio",
        services: [
          { name: "Hatha · 60 min",   duration_min: 60 },
          { name: "Vinyasa · 75 min", duration_min: 75 },
          { name: "Yin · 90 min",     duration_min: 90 },
          { name: "Private session",  duration_min: 60 },
        ],
      },
      pt: {
        label: "PT studio",
        services: [
          { name: "1-on-1 PT · 60 min", duration_min: 60 },
          { name: "1-on-1 PT · 30 min", duration_min: 30 },
          { name: "Pair PT",            duration_min: 60 },
          { name: "Assessment",         duration_min: 45 },
        ],
      },
      pilates: {
        label: "Pilates studio",
        services: [
          { name: "Mat · 50 min",       duration_min: 50 },
          { name: "Reformer · 50 min",  duration_min: 50 },
          { name: "Private",            duration_min: 50 },
        ],
      },
      martialarts: {
        label: "Martial arts",
        services: [
          { name: "Kids class",         duration_min: 45 },
          { name: "Adult class",        duration_min: 60 },
          { name: "Private lesson",     duration_min: 60 },
          { name: "Grading / test",     duration_min: 30 },
        ],
      },
    },
  },
  retail: {
    label: "Retail",
    icon:  "🛍",
    blurb: "Fashion · Electronics · Pharmacy · Boutique",
    subTypes: {
      fashion: {
        label: "Fashion / clothing",
        services: [
          { name: "Styling session",   duration_min: 45 },
          { name: "Alterations pickup", duration_min: 15 },
          { name: "Personal shopper",  duration_min: 60 },
        ],
      },
      electronics: {
        label: "Electronics / repair",
        services: [
          { name: "Device diagnosis",  duration_min: 20 },
          { name: "Screen repair",     duration_min: 60 },
          { name: "Data recovery",     duration_min: 30 },
          { name: "Setup / install",   duration_min: 45 },
        ],
      },
      boutique: {
        label: "Specialty boutique",
        services: [
          { name: "Product consult",   duration_min: 20 },
          { name: "Gift wrapping",     duration_min: 10 },
          { name: "Click & collect",   duration_min: 10 },
        ],
      },
      optical: {
        label: "Optical / eyewear",
        services: [
          { name: "Eye test",          duration_min: 30 },
          { name: "Frame fitting",     duration_min: 20 },
          { name: "Lens collection",   duration_min: 10 },
        ],
      },
    },
  },
  automotive: {
    label: "Automotive",
    icon:  "🚗",
    blurb: "Car service · Detailing · Inspection · Tyre",
    subTypes: {
      service: {
        label: "Car service centre",
        services: [
          { name: "Oil change",        duration_min: 30 },
          { name: "Full service",      duration_min: 120 },
          { name: "Tyre change",       duration_min: 30 },
          { name: "Battery check",     duration_min: 15 },
          { name: "AC regas",          duration_min: 60 },
        ],
      },
      detailing: {
        label: "Car wash / detailing",
        services: [
          { name: "Express wash",      duration_min: 20 },
          { name: "Interior clean",    duration_min: 60 },
          { name: "Full detail",       duration_min: 180 },
          { name: "Polish & wax",      duration_min: 120 },
        ],
      },
      inspection: {
        label: "Inspection / JPJ",
        services: [
          { name: "Roadworthiness",    duration_min: 30 },
          { name: "Pre-purchase check",duration_min: 45 },
          { name: "Emission test",     duration_min: 20 },
        ],
      },
      tyres: {
        label: "Tyre shop",
        services: [
          { name: "Tyre fitting (1)",  duration_min: 15 },
          { name: "Tyre fitting (4)",  duration_min: 45 },
          { name: "Wheel alignment",   duration_min: 30 },
          { name: "Wheel balancing",   duration_min: 20 },
        ],
      },
    },
  },
  government: {
    label: "Government & Public",
    icon:  "🏛",
    blurb: "Licensing · Immigration · Utilities · Registry",
    subTypes: {
      licensing: {
        label: "Licensing / permits",
        services: [
          { name: "New application",   duration_min: 30 },
          { name: "Renewal",           duration_min: 15 },
          { name: "Amendment",         duration_min: 20 },
          { name: "Collection",        duration_min: 10 },
        ],
      },
      immigration: {
        label: "Immigration / visa",
        services: [
          { name: "Visa application",  duration_min: 45 },
          { name: "Passport renewal",  duration_min: 30 },
          { name: "Document submission", duration_min: 20 },
          { name: "Status enquiry",    duration_min: 15 },
        ],
      },
      registry: {
        label: "Registry / JPN",
        services: [
          { name: "Birth registration",  duration_min: 20 },
          { name: "Marriage cert",       duration_min: 20 },
          { name: "IC replacement",      duration_min: 15 },
          { name: "Address update",      duration_min: 10 },
        ],
      },
      utilities: {
        label: "Utilities / TNB / Telco",
        services: [
          { name: "New connection",    duration_min: 30 },
          { name: "Bill payment",      duration_min: 10 },
          { name: "Fault report",      duration_min: 20 },
          { name: "Plan upgrade",      duration_min: 20 },
        ],
      },
    },
  },
  education: {
    label: "Education & Training",
    icon:  "📚",
    blurb: "Tuition · Language · Skills · Driving school",
    subTypes: {
      tuition: {
        label: "Tuition centre",
        services: [
          { name: "Trial class",       duration_min: 60 },
          { name: "1-on-1 lesson",     duration_min: 60 },
          { name: "Group lesson",      duration_min: 90 },
          { name: "Exam prep session", duration_min: 120 },
        ],
      },
      language: {
        label: "Language school",
        services: [
          { name: "Placement test",    duration_min: 30 },
          { name: "Private lesson",    duration_min: 60 },
          { name: "Group class",       duration_min: 90 },
          { name: "Conversation club", duration_min: 60 },
        ],
      },
      skills: {
        label: "Skills / vocational",
        services: [
          { name: "Workshop",          duration_min: 120 },
          { name: "Certification class", duration_min: 180 },
          { name: "1-on-1 coaching",   duration_min: 60 },
        ],
      },
      driving: {
        label: "Driving school",
        services: [
          { name: "Theory class",      duration_min: 60 },
          { name: "Practical lesson",  duration_min: 60 },
          { name: "Test booking",      duration_min: 30 },
        ],
      },
    },
  },
};

// First-tier "what kind of business" labels (still used in Step 1 picker)
const INDUSTRY_LABELS = Object.fromEntries(
  Object.entries(INDUSTRY_TREE).map(([id, v]) => [id, v.blurb])
);

// Default sub-type per industry (the most common one)
const DEFAULT_SUBTYPE = {
  service:      "barbershop",
  hospitality:  "casual",
  healthcare:   "clinic",
  professional: "legal",
  fitness:      "gym",
  retail:       "electronics",
  automotive:   "service",
  government:   "licensing",
  education:    "tuition",
};

export default function Onboarding() {
  const { user } = useAuth();
  const { reload } = useBranch();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Step 1
  const [name, setName]     = useState(user?.user_metadata?.business_name ?? "");
  const [city, setCity]     = useState("");
  const [industry, setIndustry] = useState("service");
  const [subType, setSubType]   = useState(DEFAULT_SUBTYPE.service);

  // Step 2
  const [location, setLocation] = useState(null); // {lat, lng} or null
  const [locStatus, setLocStatus] = useState("idle"); // idle | granted | denied

  // Step 3
  const initialServices = INDUSTRY_TREE.service.subTypes.barbershop.services;
  const [services, setServices] = useState(initialServices);
  const [picked, setPicked] = useState(new Set(initialServices.map((_, i) => i)));
  const [customDraft, setCustomDraft] = useState("");
  const [customDuration, setCustomDuration] = useState("20");

  // Step 4
  const [autopilot, setAutopilot] = useState(true);
  const [islamic, setIslamic]     = useState(true);
  const [maxAppts, setMaxAppts]   = useState("50");

  // ── Helpers ───────────────────────────────────────────────────────
  function pickIndustry(id) {
    setIndustry(id);
    const defaultSub = DEFAULT_SUBTYPE[id];
    setSubType(defaultSub);
    const svcs = INDUSTRY_TREE[id].subTypes[defaultSub].services;
    setServices(svcs);
    setPicked(new Set(svcs.map((_, i) => i)));
  }

  function pickSubType(id) {
    setSubType(id);
    const svcs = INDUSTRY_TREE[industry].subTypes[id].services;
    setServices(svcs);
    setPicked(new Set(svcs.map((_, i) => i)));
  }

  function togglePick(i) {
    const next = new Set(picked);
    if (next.has(i)) next.delete(i); else next.add(i);
    setPicked(next);
  }

  function addCustom() {
    const trimmed = customDraft.trim();
    if (!trimmed) return;
    const dur = parseInt(customDuration, 10) || 20;
    const next = [...services, { name: trimmed, duration_min: dur }];
    const newIdx = next.length - 1;
    setServices(next);
    setPicked(new Set([...picked, newIdx]));
    setCustomDraft(""); setCustomDuration("20");
  }

  function geolocate() {
    if (!("geolocation" in navigator)) {
      setLocStatus("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("granted");
      },
      () => setLocStatus("denied"),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  function slugify(s) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      || "branch";
  }

  // ── Final commit ──────────────────────────────────────────────────
  async function finish() {
    if (!user) return;
    setBusy(true);
    setError(null);

    const slug = slugify(name) + "-" + Math.random().toString(36).slice(2, 5);
    const { data: b, error: bErr } = await supabase.from("branches").insert({
      owner_id: user.id,
      slug,
      name: name.trim() || "My branch",
      city: city.trim() || null,
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      autopilot,
      islamic_mode: islamic,
    }).select("*").single();

    if (bErr || !b) {
      setBusy(false);
      return setError(bErr?.message ?? "Could not create branch.");
    }

    const chosen = [...picked].map((i) => services[i]).filter(Boolean);
    if (chosen.length > 0) {
      await supabase.from("services").insert(
        chosen.map((s) => ({ branch_id: b.id, name: s.name, duration_min: s.duration_min }))
      );
    }

    // Save daily capacity limit so Queue picks it up immediately
    const cap = parseInt(maxAppts, 10);
    if (cap > 0) {
      localStorage.setItem(`azq_cap_${b.id}`, String(cap));
    }

    await reload();
    setBusy(false);
    setStep(5);
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="atmosphere-hero min-h-[calc(100vh-44px)] p-8">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8 text-center">
          <div className="ovline mb-2 text-gold-soft">Welcome</div>
          <h1 className="font-display text-4xl font-light tracking-tightest">
            Set up your <em className="not-italic gold-text-soft">first branch.</em>
          </h1>
          <Stepper step={step} />
        </header>

        {error && (
          <div className="mb-3 text-[11px] text-[#d49185] bg-[#b56b5f]/10 border border-[#b56b5f]/30 px-3 py-2">
            {error}
          </div>
        )}

        {step === 1 && (
          <Card luxe className="p-8">
            <Section eyebrow="Step 1" title="What's your business?">
              <Field label="Business or branch name" value={name} onChange={setName} placeholder="Khalifa Premier Services" autoFocus />
              <Field label="City" value={city} onChange={setCity} placeholder="Bukit Bintang, KL" />

              <div>
                <div className="ovline mb-2 text-[9px]">Industry</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-line border border-line">
                  {Object.entries(INDUSTRY_TREE).map(([id, info]) => {
                    const active = industry === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => pickIndustry(id)}
                        className={`bg-bg-elev p-3 text-left transition group ${active ? "ring-1 ring-gold-deep ring-inset" : "hover:bg-bg"}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-lg leading-none ${active ? "opacity-100" : "opacity-60 group-hover:opacity-80"}`}>
                            {info.icon}
                          </span>
                          <div className={`ovline text-[8px] ${active ? "text-gold-soft" : "text-ink-mute"}`}>
                            {active ? "✓ Selected" : "Select"}
                          </div>
                        </div>
                        <div className={`text-xs font-medium ${active ? "text-ink" : "text-ink-soft"}`}>{info.label}</div>
                        <div className="text-[9px] text-ink-mute mt-0.5 leading-snug">{info.blurb}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-ink-mute mt-2">We'll suggest services tailored to your industry in the next step.</div>
              </div>
            </Section>

            <Footer
              right={<Button onClick={() => setStep(2)} disabled={!name.trim()}>Continue →</Button>}
            />
          </Card>
        )}

        {step === 2 && (
          <Card luxe className="p-8">
            <Section eyebrow="Step 2" title="Where are you?">
              <p className="text-ink-soft text-sm">
                We use your location to fetch <span className="text-ink">accurate prayer times</span> and to power
                "customer is here" arrival alerts. Skip if you'd rather configure later.
              </p>

              {locStatus === "granted" && location ? (
                <div className="border border-[#506b50] bg-[rgba(80,107,80,0.06)] p-4">
                  <div className="ovline text-[#9bbd9b] mb-1">Location set</div>
                  <div className="font-mono text-[11px] text-gold-soft">
                    {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </div>
                  <div className="text-[10px] text-ink-mute mt-1">Prayer times will be calculated for this point.</div>
                </div>
              ) : locStatus === "denied" ? (
                <div className="border border-line p-4">
                  <div className="ovline text-ink-mute mb-1">Location skipped</div>
                  <div className="text-[11px] text-ink-soft">
                    No problem — we'll use Kuala Lumpur as a default. You can set a real location later in Settings.
                  </div>
                </div>
              ) : (
                <div className="border border-line p-4">
                  <div className="ovline mb-1">Permission</div>
                  <div className="text-[11px] text-ink-soft mb-3">
                    Your browser will ask once. We don't track you — we just store the lat/lng for prayer-time math.
                  </div>
                  <Button onClick={geolocate}>Use my current location</Button>
                </div>
              )}
            </Section>

            <Footer
              left={<Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>}
              right={<Button onClick={() => setStep(3)}>Continue →</Button>}
            />
          </Card>
        )}

        {step === 3 && (
          <Card luxe className="p-8">
            <Section eyebrow="Step 3" title="Pick your services">
              {/* Sub-type picker — refines the industry into something concrete */}
              <div>
                <div className="ovline mb-2 text-[9px]">What kind of {INDUSTRY_TREE[industry].label.toLowerCase()}?</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border border-line">
                  {Object.entries(INDUSTRY_TREE[industry].subTypes).map(([id, st]) => {
                    const active = subType === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => pickSubType(id)}
                        className={`bg-bg-elev p-3 text-left transition ${active ? "ring-1 ring-gold-deep ring-inset" : "hover:bg-bg"}`}
                      >
                        <div className={`ovline text-[8px] mb-1 ${active ? "text-gold-soft" : ""}`}>
                          {active ? "Selected" : "Choose"}
                        </div>
                        <div className="text-xs">{st.label}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-ink-mute mt-2">
                  Suggestions tailored for <span className="text-ink">{INDUSTRY_TREE[industry].subTypes[subType].label}</span>.
                </div>
              </div>

              <p className="text-ink-soft text-sm">
                Uncheck any you don't offer.
              </p>

              <div className="space-y-px bg-line border border-line max-h-72 overflow-y-auto">
                {services.map((s, i) => {
                  const on = picked.has(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => togglePick(i)}
                      className={`w-full text-left bg-bg-elev p-3 flex items-center justify-between transition ${on ? "" : "opacity-50"}`}
                    >
                      <span className="flex items-center gap-3">
                        <span className={`w-4 h-4 border ${on ? "border-gold bg-gold flex items-center justify-center text-[#141410] text-[10px]" : "border-line-2"}`}>
                          {on ? "✓" : ""}
                        </span>
                        <span className="text-sm text-ink">{s.name}</span>
                      </span>
                      <span className="text-[10px] text-ink-mute font-mono">~{s.duration_min}m</span>
                    </button>
                  );
                })}
              </div>

              <div className="border border-line p-3">
                <div className="ovline text-[9px] mb-2">Add a custom service</div>
                <div className="grid grid-cols-[1fr_80px_60px] gap-2">
                  <input
                    value={customDraft}
                    onChange={(e) => setCustomDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
                    placeholder="Name"
                    className="bg-bg border border-line focus:border-gold-deep outline-none text-xs px-3 py-2 text-ink placeholder:text-ink-mute"
                  />
                  <input
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                    type="number"
                    placeholder="20"
                    className="bg-bg border border-line focus:border-gold-deep outline-none text-xs px-3 py-2 text-ink"
                  />
                  <Button size="sm" onClick={addCustom} disabled={!customDraft.trim()}>Add</Button>
                </div>
              </div>
            </Section>

            <Footer
              left={<Button variant="ghost" onClick={() => setStep(2)}>← Back</Button>}
              right={<Button onClick={() => setStep(4)} disabled={picked.size === 0}>Continue →</Button>}
            />
          </Card>
        )}

        {step === 4 && (
          <Card luxe className="p-8">
            <Section eyebrow="Step 4" title="Two final choices">
              <Toggle
                label="Autopilot"
                desc="Auto-call the next customer at an adaptive pace based on real service times."
                on={autopilot} setOn={setAutopilot}
              />
              <Toggle
                label="Islamic Mode"
                desc="Prayer-aware queue with auto-pause around the five daily prayers."
                on={islamic} setOn={setIslamic} green
              />
              <div className="text-[10px] text-ink-mute">Both can be toggled later in Settings → Modes.</div>
            </Section>

            <div className="mt-6 border-t border-line pt-6">
              <div className="ovline text-[9px] mb-1">Daily appointment limit</div>
              <p className="text-[11px] text-ink-soft mb-3">
                Maximum check-ins per day. The queue shows a warning when you're approaching capacity.
                You can change this anytime from the queue view.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={maxAppts}
                  onChange={(e) => setMaxAppts(e.target.value)}
                  className="w-24 bg-bg-elev border border-line focus:border-gold-deep outline-none text-ink text-sm px-3 py-2 font-mono"
                />
                <span className="text-[11px] text-ink-mute">appointments / day</span>
              </div>
            </div>

            <Footer
              left={<Button variant="ghost" onClick={() => setStep(3)}>← Back</Button>}
              right={<Button onClick={finish} disabled={busy}>{busy ? "Setting up…" : "Create branch →"}</Button>}
            />
          </Card>
        )}

        {step === 5 && (
          <Card luxe className="p-9 text-center">
            <div className="ovline mb-3 text-gold-soft">All set</div>
            <h2 className="font-display text-3xl font-light tracking-tightest mb-3">
              Your branch is <em className="not-italic gold-text-soft">live.</em>
            </h2>
            <div className="rule-ornament my-5 text-[8px]"><span>✦</span></div>
            <p className="text-ink-soft text-sm mb-6 max-w-sm mx-auto">
              Take 5 minutes to print your QR poster, set up the TV display, and call your first ticket.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Button onClick={() => navigate("/business/display")} className="w-full">Set up display →</Button>
              <Button variant="ghost" onClick={() => navigate("/business/settings")} className="w-full">Edit settings</Button>
              <Button variant="ghost" onClick={() => navigate("/business")} className="w-full">Open queue</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── Pieces ───────────────────────────────────────────────────────── */
function Stepper({ step }) {
  return (
    <div className="flex justify-center gap-2 mt-5">
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className={`h-1 transition-all ${n === step ? "w-10 bg-gold" : n < step ? "w-6 bg-gold-deep" : "w-6 bg-line"}`}
        />
      ))}
    </div>
  );
}

function Section({ eyebrow, title, children }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="ovline text-gold-soft mb-1">{eyebrow}</div>
        <h2 className="font-display text-2xl font-light tracking-tighter">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Footer({ left, right }) {
  return (
    <div className="flex items-center justify-between mt-8 pt-5 border-t border-line">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, autoFocus }) {
  return (
    <div>
      <div className="ovline mb-1.5 text-[9px]">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-bg-elev border border-line focus:border-gold-deep outline-none text-sm px-4 py-2.5 transition text-ink placeholder:text-ink-mute"
      />
    </div>
  );
}

function Toggle({ label, desc, on, setOn, green }) {
  const onColor = green ? "bg-[#506b50]" : "bg-gold-deep";
  return (
    <div className="flex items-center justify-between cursor-pointer p-3 border border-line hover:border-gold-deep transition" onClick={() => setOn(!on)}>
      <div className="flex-1">
        <div className="text-sm">{label}</div>
        <div className="text-[10px] text-ink-mute mt-0.5">{desc}</div>
      </div>
      <div className={`relative w-9 h-5 rounded-full transition shrink-0 ${on ? onColor : "bg-line"}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-ink transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </div>
    </div>
  );
}
