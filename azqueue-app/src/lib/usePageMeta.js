import { useEffect } from "react";

/**
 * usePageMeta — set document.title and meta description for the current page.
 *
 * Tiny enough that we don't need react-helmet. Updates document.title
 * directly, then writes the description into the existing <meta name="description">
 * in index.html (creating it if missing).
 *
 * Run once per page mount.
 *
 *   usePageMeta({
 *     title: "Product · AzQueue",
 *     description: "What AzQueue does, in depth — kiosk, dashboard, WhatsApp, loyalty.",
 *     canonical: "/product",
 *   });
 */
export default function usePageMeta({ title, description, canonical } = {}) {
  useEffect(() => {
    if (title) document.title = title;

    if (description) {
      let tag = document.head.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", "description");
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", description);

      // Update the OG/Twitter description in parallel — these are what
      // social previews and many AI crawlers actually read.
      const ogDesc = document.head.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute("content", description);
      const twDesc = document.head.querySelector('meta[name="twitter:description"]');
      if (twDesc) twDesc.setAttribute("content", description);
    }

    if (title) {
      const ogTitle = document.head.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute("content", title);
      const twTitle = document.head.querySelector('meta[name="twitter:title"]');
      if (twTitle) twTitle.setAttribute("content", title);
    }

    if (canonical) {
      let link = document.head.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      // Always make canonical absolute
      const abs = canonical.startsWith("http")
        ? canonical
        : `https://azqueue.io${canonical.startsWith("/") ? "" : "/"}${canonical}`;
      link.setAttribute("href", abs);
    }
  }, [title, description, canonical]);
}
