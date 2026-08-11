import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";

/**
 * BusinessLegal — business-specific privacy policy and SMS terms of service.
 * Accessible at /b/:slug/privacy and /b/:slug/terms
 * Used as Twilio A2P 10DLC campaign policy URLs for each business.
 *
 * IMPORTANT: content renders immediately from the slug so automated
 * reviewers (Twilio's crawler) never see a "Loading..." shell.
 */

/* Per-tenant contact details. Keyed by branch slug. */
const TENANT_CONTACTS = {
  "az-tax-services": {
    name:  "Az Tax Services",
    phone: "(303) 368-4322",
    email: "aztaxservices1@gmail.com",
  },
};

/* Turn a slug into a readable name as a fallback (az-tax-services → Az Tax Services) */
function slugToName(slug) {
  return (slug || "")
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const Section = ({ title, children }) => (
  <section>
    <h2 className="font-display text-2xl font-light tracking-tighter text-ink mb-3">{title}</h2>
    {children}
  </section>
);

const P = ({ children }) => <p className="mb-3">{children}</p>;

function PrivacyContent({ name, phone, email, slug }) {
  return (
    <>
      <Section title="Overview">
        <P>
          {name} ("we," "us," or "our") is committed to protecting your personal information.
          This Privacy Policy explains how we collect, use, and protect the information you
          provide when interacting with our services, including our SMS text messaging program.
        </P>
      </Section>

      <Section title="Information we collect">
        <P>
          When you check in, book an appointment, or opt in to receive SMS notifications,
          we collect your name and mobile phone number.
        </P>
        <P>
          We may also collect the date and time of your appointment or visit, the service
          you requested, and your position in our queue.
        </P>
      </Section>

      <Section title="How we use your information">
        <P>
          We use your phone number to send you transactional SMS messages, including:
          appointment confirmations, queue position updates (e.g., "You're next in line"),
          service completion notices, and reminders about upcoming appointments.
        </P>
        <P>
          This SMS program is used only for transactional appointment and queue notifications.
          We do not use this SMS program to send advertising, affiliate-marketing,
          lead-generation, or third-party promotional messages.
        </P>
      </Section>

      <Section title="Mobile information and data sharing">
        <P>
          <strong className="text-ink">
            No mobile information or text-messaging originator opt-in data and consent will be
            shared with third parties or affiliates for marketing or promotional purposes.
          </strong>
        </P>
        <P>
          We do not sell or rent personal information. {name} uses service providers, including
          AzQueue for queue management and Twilio for SMS delivery, solely to operate the
          appointment and queue-notification program. These providers may process information
          only to provide services on behalf of {name} and may not use it for their own marketing.
        </P>
        <P>
          All categories of data sharing described in this Privacy Policy exclude text-messaging
          originator opt-in data and consent from sharing with third parties or affiliates for
          marketing or promotional purposes.
        </P>
        <P>
          We share your information only as required by law or to deliver the services you requested.
        </P>
      </Section>

      <Section title="SMS messaging program">
        <P>
          By providing your phone number and checking the optional SMS consent box, you consent
          to receive text messages from {name}. Message frequency varies based on your
          appointment activity — typically 1–5 messages per visit.
        </P>
        <P>Message and data rates may apply.</P>
        <P>
          To opt out at any time, reply STOP to any message we send. You will receive one final
          confirmation message and will not receive further SMS messages from us. To re-subscribe,
          reply START. For help, reply HELP or contact us using the details below.
        </P>
      </Section>

      <Section title="Data retention">
        <P>
          We retain your contact information and visit history for up to 2 years to support
          future appointments and service continuity. You may request deletion of your data
          at any time by contacting us.
        </P>
      </Section>

      <Section title="Your rights">
        <P>
          You have the right to access, correct, or request deletion of your personal information.
          To exercise these rights, contact us using the information below.
        </P>
      </Section>

      <Section title="Related documents">
        <P>
          Read the{" "}
          <Link to={`/b/${slug}/terms`} className="text-gold-soft underline hover:text-gold">
            {name} SMS Terms &amp; Conditions
          </Link>.
        </P>
      </Section>

      <ContactBlock name={name} phone={phone} email={email} />
    </>
  );
}

function TermsContent({ name, phone, email, slug }) {
  return (
    <>
      <Section title="SMS terms of service">
        <P>
          These Terms of Service govern your participation in the {name} SMS text messaging
          program. By checking the optional SMS consent box on our booking or check-in form,
          you agree to these terms.
        </P>
      </Section>

      <Section title="Program description">
        <P>
          {name} uses SMS messaging to send you appointment confirmations, queue position
          updates, and service notifications. These are transactional messages sent only in
          connection with a service you have requested or are waiting for.
        </P>
        <P>
          This program does not send advertising, affiliate-marketing, lead-generation, or
          third-party promotional messages.
        </P>
      </Section>

      <Section title="Consent and opt-in">
        <P>
          You consent to receive SMS messages from {name} by entering your mobile number and
          checking the separate, unchecked-by-default SMS consent checkbox on our online
          booking form or QR-code check-in form. Consent is optional and is not a condition
          of booking an appointment or receiving service.
        </P>
      </Section>

      <Section title="Message frequency and cost">
        <P>
          Message frequency varies — typically 1–5 messages per visit or appointment.
          Message and data rates may apply. Check with your mobile carrier for details.
        </P>
      </Section>

      <Section title="Opt-out">
        <P>
          You may opt out of the SMS program at any time by replying STOP to any message from us.
          You will receive a single confirmation and will not be contacted via SMS again unless
          you re-subscribe.
        </P>
        <P>To re-subscribe, reply START to our number. For assistance, reply HELP.</P>
      </Section>

      <Section title="Mobile information and data sharing">
        <P>
          <strong className="text-ink">
            No mobile information or text-messaging originator opt-in data and consent will be
            shared with third parties or affiliates for marketing or promotional purposes.
          </strong>
        </P>
        <P>
          {name} uses service providers, including AzQueue for queue management and Twilio for
          SMS delivery, solely to operate this notification program. These providers may not
          use your information for their own marketing.
        </P>
      </Section>

      <Section title="Carrier disclaimer">
        <P>Carriers are not liable for delayed or undelivered messages.</P>
      </Section>

      <Section title="Changes to these terms">
        <P>
          We may update these terms from time to time. Continued participation in the SMS
          program after changes constitutes your acceptance of the updated terms.
        </P>
      </Section>

      <Section title="Related documents">
        <P>
          Read the{" "}
          <Link to={`/b/${slug}/privacy`} className="text-gold-soft underline hover:text-gold">
            {name} Privacy Policy
          </Link>.
        </P>
      </Section>

      <ContactBlock name={name} phone={phone} email={email} />
    </>
  );
}

function ContactBlock({ name, phone, email }) {
  return (
    <Section title="Contact">
      <div className="border border-line bg-bg-elev px-5 py-4 mb-3">
        <div className="text-ink font-medium mb-2">{name}</div>
        {phone && (
          <div className="mb-1">
            Phone: <a href={`tel:${phone.replace(/\D/g, "")}`} className="text-gold-soft hover:text-gold">{phone}</a>
          </div>
        )}
        {email && (
          <div>
            Email: <a href={`mailto:${email}`} className="text-gold-soft hover:text-gold">{email}</a>
          </div>
        )}
      </div>
      <P>
        For technical assistance with the booking platform, you may also contact
        support@azqueue.io.
      </P>
    </Section>
  );
}

export default function BusinessLegal() {
  const { slug } = useParams();
  const { pathname } = useLocation();

  const isPrivacy = pathname.endsWith("/privacy");
  const contact   = TENANT_CONTACTS[slug] ?? {};

  // Render immediately from the slug — no loading state. If Supabase returns a
  // different display name we upgrade it, but the reviewer always sees content.
  const [businessName, setBusinessName] = useState(contact.name ?? slugToName(slug));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("branches")
          .select("name")
          .eq("slug", slug)
          .maybeSingle();
        if (!cancelled && data?.name) setBusinessName(data.name);
      } catch { /* keep the slug-derived name */ }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const title = isPrivacy ? "Privacy Policy" : "SMS Terms & Conditions";

  // Set a descriptive document title for automated reviewers
  useEffect(() => {
    document.title = `${businessName} ${title}`;
    window.scrollTo(0, 0);
  }, [businessName, title]);

  return (
    <div className="min-h-screen bg-bg text-ink pt-[60px]">
      <SiteNav solid />

      <main className="max-w-3xl mx-auto px-6 pt-20 pb-20">
        <div className="ovline text-gold-soft mb-3">{businessName}</div>
        <h1 className="font-display text-5xl font-light tracking-tightest mb-3">{title}</h1>
        <div className="text-[10px] text-ink-mute tracking-wide mb-10">
          Last updated · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </div>

        <article className="text-ink-soft text-sm leading-relaxed space-y-6">
          {isPrivacy
            ? <PrivacyContent name={businessName} phone={contact.phone} email={contact.email} slug={slug} />
            : <TermsContent   name={businessName} phone={contact.phone} email={contact.email} slug={slug} />
          }
        </article>

        <div className="rule-ornament my-12 text-[8px]"><span>✦</span></div>

        <div className="text-[10px] text-ink-mute italic font-display text-center">
          These policies apply to {businessName}.
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
