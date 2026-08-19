// Entry point — wires fetch -> extract -> normalize -> validate -> store -> report.
// Run with: npm start
// Stage 5 checkpoint: npm start -- --inject-broken-url

import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { fetchPage } from "./fetcher.js";
import { parseCataloguePage } from "./extractCatalogue.js";
import { parseBookPage } from "./extractBook.js";
import { normalizeRecord, dedupeByUrl } from "./normalize.js";
import { BookRecordSchema } from "./schema.js";
import { writeRunReport } from "./report.js";

const CATALOGUE_START = "https://books.toscrape.com/catalogue/page-1.html";
const MAX_CATALOGUE_PAGES = 3;
const CACHE_DIR = "cache";
const OUTPUT_DIR = "output";

const injectBrokenUrl = process.argv.includes("--inject-broken-url");

function slugFromUrl(url) {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  // .../catalogue/<slug>/index.html  or  .../catalogue/page-2.html
  return parts[parts.length - 2] || parts[parts.length - 1] || "page";
}

async function main() {
  const startTime = new Date();
  console.log(`\n=== Polite scraper run started ${startTime.toISOString()} ===\n`);

  let cacheHits = 0;
  let realFetches = 0;
  const failedPages = [];

  // --- Stage 2: discover catalogue pages + book links ---
  console.log("--- Stage 2: discovering catalogue pages ---");
  const bookLinks = new Set();
  let pageUrl = CATALOGUE_START;
  let pagesFetched = 0;

  while (pageUrl && pagesFetched < MAX_CATALOGUE_PAGES) {
    pagesFetched += 1;
    const cachePath = path.join(CACHE_DIR, `catalogue-page-${pagesFetched}.html`);
    const result = await fetchPage(pageUrl, cachePath);

    if (result.fromCache) cacheHits += 1;
    else if (result.status === 200) realFetches += 1;

    if (result.status !== 200) {
      console.log(`  Catalogue page ${pagesFetched} failed (${result.error}). Stopping discovery.`);
      failedPages.push({ url: pageUrl, reason: result.error || `status ${result.status}` });
      break;
    }

    const { bookLinks: links, nextUrl } = parseCataloguePage(result.html, pageUrl);
    links.forEach((l) => bookLinks.add(l));
    pageUrl = nextUrl;
  }

  const uniqueBookLinks = [...bookLinks];
  console.log(
    `\ncatalogue_pages=${pagesFetched} discovered=${uniqueBookLinks.length} unique_urls=${uniqueBookLinks.length}\n`
  );

  if (injectBrokenUrl) {
    const fakeUrl =
      "https://books.toscrape.com/catalogue/this-book-does-not-exist_00000/index.html";
    uniqueBookLinks.push(fakeUrl);
    console.log(`[--inject-broken-url] added a deliberately broken URL: ${fakeUrl}\n`);
  }

  // --- Stage 3 + 4: fetch each book, extract, normalize, validate ---
  console.log("--- Stage 3-4: extracting, normalizing, and validating book records ---");
  const validRecords = [];
  const errorRecords = [];

  for (const bookUrl of uniqueBookLinks) {
    const cachePath = path.join(CACHE_DIR, `book-${slugFromUrl(bookUrl)}.html`);
    // source_page: the catalogue page we discovered this link on. Since we
    // dedupe across pages, we record the original catalogue start as a
    // reasonable provenance root; per-page mapping is preserved in cache filenames.
    const result = await fetchPage(bookUrl, cachePath);

    if (result.fromCache) cacheHits += 1;
    else if (result.status === 200) realFetches += 1;

    if (result.status !== 200) {
      console.log(`  SKIP ${bookUrl} (${result.error})`);
      failedPages.push({ url: bookUrl, reason: result.error || `status ${result.status}` });
      continue;
    }

    try {
      const raw = parseBookPage(result.html, bookUrl, CATALOGUE_START);
      const normalized = normalizeRecord(raw);
      const check = BookRecordSchema.safeParse(normalized);

      if (check.success) {
        validRecords.push(check.data);
      } else {
        const reason = check.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        errorRecords.push({ product_url: bookUrl, reason });
      }
    } catch (err) {
      errorRecords.push({ product_url: bookUrl, reason: `parse error: ${err.message}` });
    }
  }

  const dedupedValid = dedupeByUrl(validRecords);

  // --- Stage 4: store ---
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUTPUT_DIR, "books.json"),
    JSON.stringify(dedupedValid, null, 2),
    "utf-8"
  );
  await writeFile(
    path.join(OUTPUT_DIR, "errors.json"),
    JSON.stringify(errorRecords, null, 2),
    "utf-8"
  );

  // --- Stage 5: report ---
  const endTime = new Date();
  const report = await writeRunReport(path.join(OUTPUT_DIR, "run-report.json"), {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    durationMs: endTime - startTime,
    cataloguePagesFetched: pagesFetched,
    cacheHits,
    realFetches,
    detailPagesAttempted: uniqueBookLinks.length,
    validRecords: dedupedValid.length,
    invalidRecords: errorRecords.length,
    failedPages,
  });

  console.log("\n=== Run report ===");
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${dedupedValid.length} records to output/books.json`);
  console.log(`Wrote ${errorRecords.length} rejected records to output/errors.json`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
