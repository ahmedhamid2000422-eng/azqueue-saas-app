/**
 * CaseStudy — REMOVED 4 September 2026.
 *
 * This file used to serve /case-studies/:slug for three customers:
 * "Meridian Health", "Nordic Bank" and "Caelum Salons".
 *
 * None of them existed. The pages carried named individuals with job titles,
 * direct quotes in quotation marks attributed to those people, and specific
 * fabricated statistics (70% fewer complaints, 40% more patients per shift,
 * 94%, 78%, 38%). They had no disclaimer, no noindex, their own canonical
 * URLs, and they were listed in sitemap.xml — actively submitted to search
 * engines as real customer evidence.
 *
 * AzQueue has one customer: Az Tax Services in Aurora, Colorado.
 *
 * An invented statistic is a bad number. An invented person with an invented
 * quote is a fabricated testimonial, which US advertising rules treat as
 * deceptive, and which costs more than it ever gains — any prospect who
 * searches for "Meridian Health AzQueue" finds nothing, and then has reason
 * to doubt every other claim on the site.
 *
 * The route, both card grids (Landing and Resources), the footer link and
 * the sitemap entries were removed at the same time. The homepage
 * Testimonials block went with them, for the same reason: "Ahmad R., Clinic
 * Manager, Dubai" and the other two were also invented.
 *
 * DO NOT restore any of this. When Az Tax Services has enough clean data to
 * support a real claim, write that one instead — it will be worth more than
 * three fictional ones, because it will survive being checked.
 *
 * See docs/website-audit-2026-09-04.md.
 *
 * This file is left as a tombstone rather than deleted so the reasoning
 * survives in the repository. It is not imported anywhere.
 */

export default function CaseStudy() {
  return null;
}
