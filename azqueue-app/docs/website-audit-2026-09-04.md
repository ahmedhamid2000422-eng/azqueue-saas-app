# Website audit — azqueue.io, 4 September 2026

Checked live, not from source. Everything below was verified by loading the
real site.

## Does it work? Yes.

All 25 routes in the sitemap load without error. No broken pages, no 404s,
no dead links among those tested.

`robots.txt`, `sitemap.xml` and `llms.txt` are real files, not SPA shells —
confirmed by checking they don't contain a doctype. `robots.txt` explicitly
welcomes GPTBot and other AI crawlers. `llms.txt` is 7.3KB of real content.
Homepage has title, description, canonical, OG title and OG image all set.

**The crawlability worry from the roadmap was largely unfounded.** The
technical SEO setup is better than most sites at this stage.

## Two real problems

### 1. Every page has the same title until JavaScript runs

Fetching any route returns identical raw HTML: same `<title>`, same meta
description, an empty `<div id="root">`, and about 874 characters of generic
fallback text. Titles and descriptions are set client-side by `usePageMeta`
after React mounts.

The one exception is `/sms/privacy`, which is served as a real static file
and has its own title — which is why it looks different in every check.

Google executes JavaScript and will usually see the real content. Many other
crawlers do not: social preview bots, some AI crawlers, and link unfurlers
often read only the raw HTML. To those, every page on the site is called
"AzQueue — Queue & Line Management for Clinics, Banks, Salons & Service
Businesses" and says the same thing.

This is the "content only appears after JavaScript runs" item from the
roadmap. It is real. Fixing it properly means pre-rendering or SSR, which is
a build-system change, not a content edit.

### 2. Three fabricated case studies, indexed and in the sitemap

`/case-studies/meridian-health`, `/case-studies/nordic-bank`, and
`/case-studies/caelum-salons` are live, indexable (no `noindex`), carry
their own canonical URLs, and are listed in `sitemap.xml` — meaning they
have been actively submitted to search engines.

They contain:

- **Named companies that are not customers.** The only customer is Az Tax
  Services.
- **Named individuals with job titles**, e.g. "Dr. Aisha Rahman, Medical
  Director" at Meridian Health.
- **Direct quotes in quotation marks** attributed to those people.
- **Specific fabricated statistics**: 70% fewer complaints, 40% more
  patients per shift, no-shows 12% → 3%, wait down 24%, and on the Nordic
  Bank page 94%, 78%, 70%, 38%.
- **Fabricated scale**: "fourteen clinics across Malaysia and the UAE,
  ~120 staff".

There is no disclaimer on any of them — nothing saying illustrative,
example, or hypothetical.

**This is a different category from an over-optimistic marketing claim.**
An invented statistic is a bad number. An invented person with an invented
quote is a fabricated testimonial, which in the US is the kind of thing the
FTC treats as deceptive advertising. It is also the single most damaging
thing a prospect could discover — a real buyer who searches "Meridian
Health AzQueue" and finds nothing has a reason to distrust everything else
on the site.

Ahmed's own roadmap already flagged these, listing "cut perceived wait time
by 70%", "40% more patients per shift", and "named customer case studies
unless those companies are actually customers" as things to remove. Those
are these three pages, nearly word for word.

## What was actually removed, 4 September

The instruction was: nothing on the site should be fictional or outside the
codebase. A full sweep of the marketing pages found considerably more than
the three case studies.

| Removed | Where | What it claimed |
|---|---|---|
| Three case studies | `CaseStudy.jsx`, route, sitemap, two card grids | Named companies, named people, quoted testimonials, 70% / 94% / 78% / 38% figures |
| Testimonials block | `Landing.jsx` | "Ahmad R., Clinic Manager · Dubai", "Siti N.", "James O." — invented people, five-star rating, heading "Real outcomes from real businesses" |
| Logo wall | `Landing.jsx` | Ten invented company names under "Trusted by clinics, banks, and salons" |
| Savings calculator | `Landing.jsx` | Multiplied the visitor's own numbers by invented constants (1.5 staff-hours/day, no-shows → 5%, 8% walkout rate) into an annual saving and an ROI multiple |
| Company stat band | `Company.jsx` | "29 branches across case studies" (referencing the fictional ones), "4 countries served", "99.9% production uptime" — replaced with two facts checkable from the repo |
| Careers section | `Company.jsx` | Four open roles in Dubai and Kuala Lumpur, "Join the team", for a team of one |
| Six industry stats | `Industries.jsx` | "40% avg. reduction in perceived wait", "92% satisfaction", "3x faster service", "28% staff utilisation" and others |
| "15 minute setup" | `Landing.jsx` ×3 | Setup time never measured; also claimed "our team" configures WhatsApp |
| Enterprise SLA | `Support.jsx`, `Landing.jsx` | "99.9% uptime written into the Enterprise contract", "24/7 phone & WhatsApp support", "dedicated success manager" |
| WhatsApp same-day | `Landing.jsx` | "No Meta Business Manager… customers start getting updates the same day" — WhatsApp is not live at all |

**Corrected rather than removed:** the language count. The site said six
languages; there are five locale files (`ar`, `en`, `fr`, `ms`, `ur`).

**Deliberately left alone:** `Legal.jsx` says "we aim for 99.9% uptime" —
an aspiration in a terms document, not a claim of measured performance.
`ResourceArticle.jsx` uses illustrative numbers inside explanatory prose
about queue psychology, which is teaching, not evidence about AzQueue.

`CaseStudy.jsx` is left as a tombstone file explaining why it went, so the
reasoning survives in the repository rather than only in a chat log.

## Recommended order

1. **Delete the three case-study pages and their sitemap entries.** Safe
   under the deployment rule in CLAUDE.md — marketing pages, nothing to do
   with the live queue.
2. **Remove the Monetisation section** on `/product`, which advertises
   deposits, priority-queue payments and no-show fees that do not exist
   anywhere in the codebase.
3. **Audit the remaining stat blocks** on Company, Industries, Landing and
   Resources — they use the same hardcoded pattern and have not been
   checked.
4. **Pre-rendering** is worth doing eventually but is a build change, not
   urgent, and should wait for a quiet window.

Replace the case studies with nothing for now. One honest line — "Working
with our first customers" — beats three fictional ones, and there is a real
story to tell about Az Tax Services once there is enough clean data to tell
it truthfully.
