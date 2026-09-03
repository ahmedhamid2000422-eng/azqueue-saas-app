import { Link, useLocation } from "react-router-dom";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";

/**
 * SmsPolicy — the page a carrier reviewer needs to find.
 * Routes: /sms and /sms/privacy
 *
 * WHY THIS EXISTS
 * The A2P 10DLC campaign was rejected on the website check. Two reasons, both
 * fixable:
 *
 *   1. The consent checkbox linked to /sms/privacy, which was never a route.
 *      A reviewer following it got nothing, which reads as a business with no
 *      disclosure at all.
 *   2. The actual opt-in lives at /q/:slug — a branch's check-in page. A
 *      reviewer given azqueue.io has no reason to guess that URL, so from the
 *      homepage there was no visible opt-in anywhere.
 *
 * Carriers are checking specific things, and they check them literally: what
 * the programme sends, how someone consents, how often, that rates may apply,
 * that STOP and HELP work, and — the clause that fails most submissions — an
 * explicit statement that opt-in data is never sold or shared with third
 * parties for marketing. Each of those has its own section below, worded so
 * the reviewer can tick it off without interpreting anything.
 */
export default function SmsPolicy() {
  /* Two documents, one component. Twilio asks for a Privacy URL and a Terms
     URL and checks them for different things — pointing both at one page
     invites the reasonable question of which document is which, and after
     three rejections that is a question worth not raising.

       /sms          → messaging terms (programme, frequency, rates, STOP/HELP)
       /sms/privacy  → what happens to a phone number

     The shared sections appear on both because a reviewer landing on either
     should find the opt-in described. Only the emphasis and the title change. */
  const isPrivacy = useLocation().pathname.startsWith("/sms/privacy");

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <SiteNav />

      <div className="flex-1 px-6 py-16 flex justify-center">
        <div className="max-w-2xl w-full">
          <div className="ovline text-[10px] text-gold-soft mb-3">Messaging</div>
          <h1 className="font-display text-3xl font-light tracking-tightest mb-3">
            {isPrivacy ? "SMS privacy policy" : "SMS terms of service"}
          </h1>
          <div className="text-[12px] text-ink-mute mb-1">
            AzQueue Queue Notifications
          </div>
          <p className="text-[13px] text-ink-mute leading-relaxed mb-10">
            {isPrivacy
              ? "What we collect when you ask for text updates, what we use it for, and who it is never given to."
              : "What the messaging programme sends, how often, what it costs, and how to stop it."}
          </p>

          <Section title="What we send">
            <p>
              AzQueue is queue management software for businesses such as tax
              offices and clinics. When a customer joins a queue at one of these
              businesses, they can choose to be notified by text instead of
              waiting in the room.
            </p>
            <p>
              Messages are transactional only. They confirm a place in the
              queue, give notice when it is that person's turn, and confirm an
              appointment. <strong>We never send marketing or promotional
              messages, and we never sell messaging access to anyone.</strong>
            </p>
          </Section>

          <Section title="How someone opts in">
            <p>
              Consent is given on the check-in form at the business's own
              premises or through its check-in link. The form has a checkbox,
              separate from every other field and <strong>unchecked by
              default</strong>, reading:
            </p>
            {/* Must match the live form word for word. A reviewer compares
                this against the real check-in page, and wording that differs
                reads as a policy written separately from the product. The
                form fills in the name of the business the customer is
                standing in, which is why it appears in brackets here. */}
            <blockquote className="border-l-2 border-gold-deep pl-4 my-4 text-ink-soft text-[12.5px] leading-relaxed">
              I agree to receive SMS text messages from [business name] about
              my queue status and appointment updates. Message frequency varies
              (typically 1-5 per visit). Msg &amp; data rates may apply. Reply
              STOP to cancel, HELP for help.
            </blockquote>
            <p className="text-ink-mute">
              The business name shown is whichever business the customer is
              visiting — messages are sent by AzQueue on their behalf and
              always name them, so the recipient knows who is texting.
            </p>
            <p>
              A phone number is never added to messaging by anyone other than
              the person it belongs to, and consent is never a condition of
              being served. Anyone who does not tick the box joins the queue
              exactly the same way and is notified by email or called in person.
            </p>
            <p className="text-ink-mute">
              A live example of this form is at{" "}
              <a href="/q/az-tax-services" className="text-gold-soft underline">
                azqueue.io/q/az-tax-services
              </a>
              .
            </p>
          </Section>

          {!isPrivacy && (
          <>
          {/* Carriers check this section against a literal list: programme
              name, description, message frequency, message and data rates,
              support contact, and HELP/STOP in bold. Each item below exists to
              satisfy one of those, which is why it reads as a checklist rather
              than prose. */}
          <Section title="Programme details">
            <div className="space-y-2">
              <p><strong className="text-ink">Programme name:</strong> AzQueue Queue Notifications</p>
              <p><strong className="text-ink">What it sends:</strong> Your place in the queue, notice when it is your turn, and appointment confirmations for the business you are visiting.</p>
              <p><strong className="text-ink">Message frequency:</strong> Varies — typically 1–5 messages per visit.</p>
              <p><strong className="text-ink">Cost:</strong> AzQueue does not charge for messages. Message and data rates may apply from your carrier.</p>
              <p><strong className="text-ink">Support:</strong> hello@azqueue.io</p>
              <p>
                <strong className="text-ink">To stop:</strong> reply{" "}
                <strong className="text-ink">STOP</strong> to any message.{" "}
                <strong className="text-ink">To get help:</strong> reply{" "}
                <strong className="text-ink">HELP</strong>.
              </p>
            </div>
          </Section>

          <Section title="Stopping messages">
            <p>
              Reply <strong className="text-ink">STOP</strong> to any message to
              stop all further texts immediately. Reply{" "}
              <strong className="text-ink">HELP</strong> for help, or email{" "}
              <span className="text-gold-soft">hello@azqueue.io</span>.
            </p>
            <p>
              Opting out of texts does not affect a place in the queue. Someone
              who stops messages is still served in the same order and notified
              in person.
            </p>
          </Section>

          </>
          )}

          {/* The clause carriers look for by name. Its absence is one of the
              most common reasons a campaign is rejected. Shown on both
              documents — a privacy reviewer needs it, and a terms reviewer
              seeing it does no harm. */}
          <Section title="What happens to a phone number">
            <p>
              A phone number given for queue notifications is used only to send
              those notifications for that business.
            </p>
            <p className="text-ink">
              <strong>
                Mobile opt-in information and phone numbers are never sold,
                rented, or shared with third parties or affiliates for marketing
                or promotional purposes.
              </strong>{" "}
              Numbers are shared only with the messaging carrier required to
              deliver the message, and with the business the customer visited.
            </p>
            <p>
              Numbers are held only as long as the business keeps its customer
              records, and are deleted on request. Write to{" "}
              <span className="text-gold-soft">hello@azqueue.io</span> to have a
              number removed.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              AzQueue — <span className="text-gold-soft">hello@azqueue.io</span>
            </p>
            <p>
              See also our{" "}
              <Link to="/legal/privacy" className="text-gold-soft underline">
                privacy policy
              </Link>{" "}
              and{" "}
              <Link to="/legal/terms" className="text-gold-soft underline">
                terms of service
              </Link>
              .
            </p>
          </Section>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-9">
      <h2 className="ovline text-[10px] text-gold-soft mb-3">{title}</h2>
      <div className="space-y-3 text-[13px] text-ink-soft leading-relaxed">
        {children}
      </div>
    </section>
  );
}
