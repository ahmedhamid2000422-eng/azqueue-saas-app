import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";

/**
 * Contact — the way in, while AzQueue is still being proven.
 *
 * WHY THERE ISN'T A SIGNUP BUTTON
 * Self-serve signup assumes the product configures itself well for a business
 * nobody has met. That's a claim, and right now there's exactly one live
 * office to base it on. Every front desk turns out to run differently — the
 * services, what needs the owner present, what people must bring, when it's
 * quiet — and getting those wrong makes the first week look broken.
 *
 * So the first setup is a conversation. That's also the cheapest way to keep
 * learning what actually varies between offices, which is the thing that
 * decides whether self-serve is ever possible.
 */
export default function Contact() {
  const [params] = useSearchParams();
  const [sent, setSent]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    name: "", business: "", email: "", phone: "", about: "",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.email.trim() || !form.name.trim()) {
      return setError("Please leave a name and an email so we can reply.");
    }
    setError(null);
    setBusy(true);
    try {
      /* Stored, not emailed into a void. If the table isn't there yet the
         request still shouldn't be lost in front of the person — so failure
         falls back to showing the address to write to. */
      const { error: e2 } = await supabase.from("contact_requests").insert({
        name: form.name.trim(),
        business_name: form.business.trim() || null,
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        message: form.about.trim() || null,
        tier: params.get("tier") || null,
      });
      if (e2) throw e2;
      setSent(true);
    } catch (err) {
      console.error("[Contact]", err);
      setError("Something went wrong — please email hello@azqueue.io and we'll pick it up.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Shell>
        <div className="max-w-lg">
          <div className="ovline text-[10px] text-gold-soft mb-3">Thank you</div>
          <h1 className="font-display text-3xl font-light tracking-tightest mb-4">
            We'll be in touch.
          </h1>
          <p className="text-[14px] text-ink-soft leading-relaxed">
            Usually within a day. We'll ask about how your front desk runs
            now — what people come in for, what needs you personally, and when
            it gets busy — and set the first version up with you.
          </p>
          <Link to="/" className="ovline text-[11px] text-ink-mute hover:text-ink transition mt-8 inline-block">
            ← Back
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-lg">
        <div className="ovline text-[10px] text-gold-soft mb-3">Get in touch</div>
        <h1 className="font-display text-3xl font-light tracking-tightest mb-4">
          Tell us about your front desk.
        </h1>
        <p className="text-[14px] text-ink-soft leading-relaxed mb-2">
          There's no signup button yet, on purpose. Every office we've looked
          at runs differently — what people come in for, what needs the owner
          in the room, what they're supposed to bring — and a setup that
          guesses those wrong makes the first week look broken.
        </p>
        <p className="text-[13px] text-ink-mute leading-relaxed mb-7">
          So we set the first one up with you. It takes about an hour.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Your name" value={form.name} onChange={set("name")} autoFocus />
          <Field label="Business" value={form.business} onChange={set("business")} optional />
          <Field label="Email" value={form.email} onChange={set("email")} type="email" />
          <Field label="Phone" value={form.phone} onChange={set("phone")} optional />

          <div>
            <label className="ovline text-[9px] text-ink-mute block mb-1.5">
              What does a busy day look like? <span className="opacity-60">optional</span>
            </label>
            <textarea
              value={form.about}
              onChange={set("about")}
              rows={4}
              placeholder="How many people come in, what they come for, what's frustrating about it now."
              className="w-full bg-bg-elev border border-line focus:border-gold-deep outline-none px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-mute leading-relaxed"
            />
          </div>

          {error && (
            <p className="text-[12px] text-[#d49185] leading-relaxed">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="ovline text-[11px] border border-gold-deep px-5 py-3 text-gold-soft hover:bg-[rgba(201,168,106,0.1)] transition disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send"}
          </button>
        </form>

        <p className="text-[11px] text-ink-mute leading-relaxed mt-8">
          Or email <span className="text-gold-soft">hello@azqueue.io</span> directly.
        </p>
      </div>
    </Shell>
  );
}

function Field({ label, value, onChange, type = "text", optional, autoFocus }) {
  return (
    <div>
      <label className="ovline text-[9px] text-ink-mute block mb-1.5">
        {label} {optional && <span className="opacity-60">optional</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        autoFocus={autoFocus}
        className="w-full bg-bg-elev border border-line focus:border-gold-deep outline-none px-3 py-2.5 text-[13px] text-ink"
      />
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <SiteNav />
      <div className="flex-1 px-6 py-16 flex justify-center">{children}</div>
      <SiteFooter />
    </div>
  );
}
