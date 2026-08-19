// Stage 4 — clean it, check it, store it (the "clean it" half).
// Turns raw scraped text into typed values a program can sort and compare,
// while keeping the original raw text alongside every derived value.

const RATING_WORDS = { One: 1, Two: 2, Three: 3, Four: 4, Five: 5 };

/**
 * @param {object} raw - output of parseBookPage
 * @returns {object} normalized record (still needs schema validation)
 */
export function normalizeRecord(raw) {
  const priceMatch = (raw.price_text || "").match(/[\d.]+/);
  const price_gbp = priceMatch ? parseFloat(priceMatch[0]) : NaN;

  return {
    title: raw.title,
    product_url: raw.product_url,
    price_gbp,
    price_text: raw.price_text,
    availability_text: raw.availability_text,
    in_stock: /in stock/i.test(raw.availability_text || ""),
    rating_text: raw.rating_text,
    rating_out_of_5: RATING_WORDS[raw.rating_text] ?? null,
    description: raw.description,
    source_page: raw.source_page,
    fetched_at: raw.fetched_at,
  };
}

/**
 * Removes duplicate records by canonical product_url, keeping the last write.
 * This is what makes a rerun idempotent instead of duplicating records.
 * @param {object[]} records
 */
export function dedupeByUrl(records) {
  const map = new Map();
  for (const record of records) {
    map.set(record.product_url, record);
  }
  return [...map.values()];
}
