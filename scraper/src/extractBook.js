// Stage 3 — extract the raw records.
// Aims selectors at the product area specifically, not "the first thing that
// looks like a price". Missing descriptions are stored as null, never invented.

import * as cheerio from "cheerio";

/**
 * @param {string} html
 * @param {string} productUrl - absolute URL of the book detail page
 * @param {string} sourcePage - absolute URL of the catalogue page it was found on
 * @returns {object} raw record with exactly the 8 fields the assignment specifies
 */
export function parseBookPage(html, productUrl, sourcePage) {
  const $ = cheerio.load(html);
  const main = $(".product_main");

  const title = main.find("h1").first().text().trim();
  const priceText = main.find(".price_color").first().text().trim();
  const availabilityText = main
    .find(".availability")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  const ratingClass = main.find(".star-rating").first().attr("class") || "";
  const ratingText =
    ratingClass
      .split(/\s+/)
      .find((c) => c && c !== "star-rating") || null;

  // Product description lives in a <p> immediately after #product_description.
  // Some books genuinely have none — store null, never fabricate text.
  const descriptionEl = $("#product_description").next("p");
  const description = descriptionEl.length ? descriptionEl.text().trim() : null;

  return {
    title,
    product_url: productUrl,
    price_text: priceText,
    availability_text: availabilityText,
    rating_text: ratingText,
    description,
    source_page: sourcePage,
    fetched_at: new Date().toISOString(),
  };
}
