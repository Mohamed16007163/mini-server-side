// Stage 2 — find all three pages.
// Reads one catalogue page: every book link (turned into an absolute URL)
// and the "next" link, if one exists. Never hardcodes page counts or URLs.

import * as cheerio from "cheerio";

/**
 * @param {string} html
 * @param {string} pageUrl - the absolute URL this HTML was fetched from
 * @returns {{ bookLinks: string[], nextUrl: string|null }}
 */
export function parseCataloguePage(html, pageUrl) {
  const $ = cheerio.load(html);

  const bookLinks = [];
  $("article.product_pod h3 a").each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      bookLinks.push(new URL(href, pageUrl).toString());
    }
  });

  const nextHref = $("ul.pager li.next a").attr("href");
  const nextUrl = nextHref ? new URL(nextHref, pageUrl).toString() : null;

  return { bookLinks, nextUrl };
}
