import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";

/**
 * BusinessLegal — business-specific privacy policy and terms of service.
 * Accessible at /b/:slug/privacy and /b/:slug/terms
 * Used as Twilio A2P 10DLC campaign policy URLs for each business.
 */

const Section = ({ title, paragraphs }) => (
  <section>
    <h2 className="font-display text-2xl font-light tracking-tighter text-ink mb-3">{title}</h2>
    {paragraphs.map((p, i) => <p key={i} className="mb-3">{p}</p>)}
  </section>
);

function PrivacyContent({ name }) {
  return (
    <>
      <Section title="Overview" paragraphs={[
        `${name} ("we," "us," or "our") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and protect the information you provide when interacting with our services, including our SMS text messaging program.`,
      ]}/>
      <Section title="Information we collect" paragraphs={[
        `When you check in, book an appointment, or opt in to receive SMS notifications, we collect your name and mobile phone number.`,
        `We may also collect the date and time of your appointment or visit, the service you requested, and your position in our queue.`,
      ]}/>
      <Section title="How we use your information" paragraphs={[
        `We use your phone number to send you transactional SMS messages, including: appointment confirmations, queue position updates (e.g., "You're next in line"), service completion notices, and reminders about upcoming appointments.`,
        `We do not sell your personal information to third parties. We do not use your information for advertising or marketing purposes without your separate consent.`,
      ]}/>
      <Section title="SMS messaging program" paragraphs={[
        `By providing your phone number and opting in, you consent to receive text messages from ${name}. Message frequency varies based on your appointment activity — typically 1–5 messages per visit.`,
        `Standard message and data rates may apply depending on your carrier plan.`,
        `To opt out at any time, reply STOP to any message we send. You will receive one final confirmation message and will not receive further SMS messages from us.`,
        `To re-subscribe, reply START. For help, reply HELP or contact us at the information below.`,
      ]}/>
      <Section title="Data sharing" paragraphs={[
        `Your information is processed through AzQueue, our queue management platform (azqueue.io). SMS messages are delivered via Twilio. Both are bound by data protection agreements and do not use your information for their own marketing.`,
        `We share your information only as required by law or to deliver the services you requested.`,
      ]}/>
      <Section title="Data retention" paragraphs={[
        `We retain your contact information and visit history for up to 2 years to support future appointments and service continuity. You may request deletion of your data at any time by contacting us.`,
      ]}/>
      <Section title="Your rights" paragraphs={[
        `You have the right to access, correct, or request deletion of your personal information. To exercise these rights, contact us using the information below.`,
      ]}/>
      <Section title="Contact" paragraphs={[
        `Questions about this policy or your data? Contact ${name} directly at your nearest location, or email support@azqueue.io.`,
      ]}/>
    </>
  );
}

function TermsContent({ name }) {
  return (
    <>
      <Section title="SMS terms of service" paragraphs={[
        `These Terms of Service govern your participation in the ${name} SMS text messaging program. By opting in — whether via web form, QR code check-in, or verbally at the front desk — you agree to these terms.`,
      ]}/>
      <Section title="Program description" paragraphs={[
        `${name} uses SMS messaging to send you appointment confirmations, queue position updates, and service notifications. These are transactional messages sent only in connection with a service you have requested or are waiting for.`,
      ]}/>
      <Section title="Consent and opt-in" paragraphs={[
        `You consent to receive SMS messages from ${name} when you provide your phone number during check-in or booking and agree to receive text notifications. Consent is not a condition of receiving service.`,
      ]}/>
      <Section title="Message frequency and cost" paragraphs={[
        `Message frequency varies — typically 1–5 messages per visit or appointment. Message and data rates may apply. Check with your mobile carrier for details.`,
      ]}/>
      <Section title="Opt-out" paragraphs={[
        `You may opt out of the SMS program at any time by replying STOP to any message from us. You will receive a single confirmation and will not be contacted via SMS again unless you re-subscribe.`,
        `To re-subscribe, reply START to our number. For assistance, reply HELP.`,
      ]}/>
      <Section title="Carrier disclaimer" paragraphs={[
        `Carriers are not liable for delayed or undelivered messages.`,
      ]}/>
      <Section title="Changes to these terms" paragraphs={[
        `We may update these terms from time to time. Continued participation in the SMS program after changes constitutes your acceptance of the updated terms.`,
      ]}/>
      <Section title="Contact" paragraphs={[
        `Questions? Contact ${name} at your nearest location or email support@azqueue.io.`,
      ]}/>
    </>
  );
}

export default function BusinessLegal() {
  const { slug, doc } = useParams();
  const [businessName, setBusinessName] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from("branches")
          .select("name")
          .eq("slug", slug)
          .maybeSingle();
        setBusinessName(data?.name ?? slug);
      } catch {
        setBusinessName(slug);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  useEffect(() => { window.scrollTo(0, 0); }, [doc]);

  const isPrivacy = doc === "privacy";
  const title = isPrivacy ? "Privacy Policy" : "Terms of Service";

  return (
    <div className="min-h-screen bg-bg text-ink pt-[60px]">
      <SiteNav solid />

      <main className="max-w-3xl mx-auto px-6 pt-20 pb-20">
        {loading ? (
          <div className="text-ink-mute text-sm">Loading…</div>
        ) : (
          <>
            <div className="ovline text-gold-soft mb-3">{businessName}</div>
            <h1 className="font-display text-5xl font-light tracking-tightest mb-3">{title}</h1>
            <div className="text-[10px] text-ink-mute tracking-wide mb-10">
              Last updated · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </div>

            <article className="text-ink-soft text-sm leading-relaxed space-y-6">
              {isPrivacy
                ? <PrivacyContent name={businessName} />
                : <TermsContent name={businessName} />
              }
            </article>

            <div className="rule-ornament my-12 text-[8px]"><span>✦</span></div>

            <div className="text-[10px] text-ink-mute italic font-display text-center">
              Questions? Contact <span className="text-gold-soft">{businessName}</span> directly.
            </div>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
