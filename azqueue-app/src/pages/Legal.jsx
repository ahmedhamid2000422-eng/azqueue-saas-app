import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

/**
 * Legal — terms / privacy / refund pages, all on one route at /legal/:doc.
 * Starter copy. Have a lawyer review before going live to paying customers.
 */

const Section = ({ title, paragraphs }) => (
  <section>
    <h2 className="font-display text-2xl font-light tracking-tighter text-ink mb-3">{title}</h2>
    {paragraphs.map((p, i) => <p key={i} className="mb-3">{p}</p>)}
  </section>
);

const TERMS_CONTENT = (
  <>
    <Section title="Agreement" paragraphs={[
      `These Terms of Service govern your use of AzQueue's web application, dashboards, customer-facing surfaces, and APIs (collectively, the "Service"). By creating an account or using the Service, you agree to these terms.`,
      `If you're using the Service on behalf of a business, you represent that you have authority to bind that business to these terms.`,
    ]}/>
    <Section title="Your account" paragraphs={[
      `You're responsible for keeping your password secret and for all activity under your account. Notify us immediately if you suspect unauthorised access.`,
      `Each business signing up gets one workspace. Within a workspace you can invite staff with limited roles. Sharing a single login across people is not permitted on paid tiers.`,
    ]}/>
    <Section title="Acceptable use" paragraphs={[
      `Don't use the Service to send unsolicited messages, harass anyone, store illegal content, or infringe other people's rights. Don't attempt to break, scrape, or reverse-engineer the Service.`,
      `We reserve the right to suspend accounts that abuse the platform or harm other users.`,
    ]}/>
    <Section title="Subscriptions and billing" paragraphs={[
      `Paid plans are billed monthly or annually as displayed at signup. Your subscription auto-renews unless cancelled before the renewal date.`,
      `Plan prices may change with at least 30 days' notice. Existing subscribers keep their current price for the remainder of the billing period.`,
      `Refer to our Refund Policy for cancellations and refunds.`,
    ]}/>
    <Section title="Customer data and privacy" paragraphs={[
      `You retain ownership of all customer data you put into the Service. We act as a processor on your behalf. See our Privacy Policy for full details on what we collect and how we use it.`,
      `On account termination we delete your data within 30 days unless retention is required by law.`,
    ]}/>
    <Section title="Service availability" paragraphs={[
      `We aim for 99.9% uptime but the Service is provided "as is" without warranties. We're not liable for indirect or consequential damages, and our total liability is limited to the fees you paid in the 12 months before a claim.`,
      `Scheduled maintenance is announced via the dashboard banner whenever possible.`,
    ]}/>
    <Section title="Termination" paragraphs={[
      `You can cancel anytime from Settings → Billing. We can terminate accounts for non-payment, abuse, or breach of these terms — usually with notice.`,
      `Upon termination, your access ends; your data is deleted on the schedule above.`,
    ]}/>
    <Section title="Changes to these terms" paragraphs={[
      `We may update these terms occasionally. Material changes will be announced via email and a banner in the dashboard. Continued use after changes means you accept the new terms.`,
    ]}/>
    <Section title="Governing law" paragraphs={[
      `These terms are governed by the laws of Malaysia. Disputes are resolved in the courts of Kuala Lumpur unless we both agree otherwise.`,
    ]}/>
  </>
);

const PRIVACY_CONTENT = (
  <>
    <Section title="What we collect" paragraphs={[
      `Account data: your email, name, password (hashed), business name, plan tier.`,
      `Operational data: branches, services, staff, tickets, bookings, queue events. Customer phone numbers and names that you collect via QR check-in or booking link.`,
      `Optional location data: customer GPS coordinates while their ticket is active, only if they grant permission. Discarded once their service ends.`,
      `Technical data: IP address, browser, device — for security and abuse prevention only.`,
    ]}/>
    <Section title="How we use it" paragraphs={[
      `To run the Service for you. To send transactional messages — WhatsApp confirmations to your customers, billing emails to you. To improve the Service through aggregated usage analytics.`,
      `We do not sell your data. We do not show ads inside the Service.`,
    ]}/>
    <Section title="Where it's stored" paragraphs={[
      `Your data is stored on Supabase infrastructure. WhatsApp messages route through Twilio. Payments are handled by Stripe — we never see card numbers.`,
      `Data is encrypted in transit and at rest.`,
    ]}/>
    <Section title="Sharing" paragraphs={[
      `We share data only with service providers we use to run AzQueue (Supabase, Twilio, Stripe, Anthropic for AI Assist), each bound by data-protection contracts. We share with law enforcement only when legally required.`,
      `Aggregated, anonymous data may be used for product research — never anything that identifies a person.`,
    ]}/>
    <Section title="Your rights" paragraphs={[
      `You can export, edit, or delete your data anytime from your dashboard. Request deletion of your account by emailing support — we'll process within 30 days.`,
      `EU/UK residents have GDPR rights of access, rectification, erasure, and portability. Malaysian residents have rights under the PDPA. Same rights apply, contact support to exercise them.`,
    ]}/>
    <Section title="Cookies" paragraphs={[
      `We use minimal cookies — a session cookie for sign-in, a localStorage entry for your selected language, branch, and dismissed onboarding cards. No tracking pixels.`,
    ]}/>
    <Section title="Children" paragraphs={[
      `The Service is not intended for users under 16. Don't create an account if you're under 16. We delete accounts as soon as we learn they belong to a child.`,
    ]}/>
    <Section title="Contact" paragraphs={[
      `Privacy questions: privacy@azqueue.io. We respond within 5 business days.`,
    ]}/>
  </>
);

const REFUND_CONTENT = (
  <>
    <Section title="14-day free trial" paragraphs={[
      `Every new business workspace starts with a 14-day free trial of the Professional plan. No card required to start. If you don't add a payment method by day 14, your workspace pauses; data is held for 30 days while you decide.`,
    ]}/>
    <Section title="Monthly subscriptions" paragraphs={[
      `Cancel anytime from Settings → Billing. You keep access until the end of the current billing period — no immediate cut-off.`,
      `We don't refund partial months. You're not charged for the next period after cancellation.`,
    ]}/>
    <Section title="Annual subscriptions" paragraphs={[
      `Annual plans get a discount in exchange for prepayment. If you cancel mid-year, we'll refund the unused portion on a pro-rated basis, less a 10% admin fee.`,
    ]}/>
    <Section title="Service issues" paragraphs={[
      `If the Service is materially broken for more than 24 consecutive hours and we couldn't fix it, contact support — we'll credit you for the affected days.`,
    ]}/>
    <Section title="Mistakes happen" paragraphs={[
      `Charged the wrong amount? Subscribed by accident? Email support within 7 days and we'll sort it. Genuine errors get full refunds without argument.`,
    ]}/>
    <Section title="How to request a refund" paragraphs={[
      `Email refunds@azqueue.io from the email on the account, including your workspace name and the reason. We respond within 3 business days.`,
    ]}/>
  </>
);

const DOCS = {
  terms:   { title: "Terms of Service", eyebrow: "Legal", updated: "May 2026", body: TERMS_CONTENT   },
  privacy: { title: "Privacy Policy",   eyebrow: "Legal", updated: "May 2026", body: PRIVACY_CONTENT },
  refund:  { title: "Refund Policy",    eyebrow: "Legal", updated: "May 2026", body: REFUND_CONTENT  },
};

export default function Legal() {
  const { doc = "terms" } = useParams();
  const meta = DOCS[doc] ?? DOCS.terms;

  useEffect(() => { window.scrollTo(0, 0); }, [doc]);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-6 pt-20 pb-20">
        <div className="ovline text-gold-soft mb-3">{meta.eyebrow}</div>
        <h1 className="font-display text-5xl font-light tracking-tightest mb-3">{meta.title}</h1>
        <div className="text-[10px] text-ink-mute tracking-wide mb-10">
          Last updated · {meta.updated}
        </div>

        <div className="flex border-b border-line mb-10">
          {Object.entries(DOCS).map(([id, d]) => {
            const active = doc === id;
            return (
              <Link
                key={id}
                to={`/legal/${id}`}
                className={`relative px-5 py-3 text-[10px] tracking-[0.22em] uppercase transition ${
                  active ? "text-gold" : "text-ink-mute hover:text-ink"
                }`}
              >
                {d.title.split(" ")[0]}
                {active && <span className="absolute left-0 right-0 -bottom-px h-px bg-gold" />}
              </Link>
            );
          })}
        </div>

        <article className="text-ink-soft text-sm leading-relaxed space-y-6">
          {meta.body}
        </article>

        <div className="rule-ornament my-12 text-[8px]"><span>✦</span></div>

        <div className="text-[10px] text-ink-mute italic font-display text-center">
          Questions? Email <span className="text-gold-soft">support@azqueue.io</span>.
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
