import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRecord, dedupeByUrl } from "../src/normalize.js";
import { parseCataloguePage } from "../src/extractCatalogue.js";
import { parseBookPage } from "../src/extractBook.js";
import { BookRecordSchema } from "../src/schema.js";

// --- 1. Price normalization ---
test("normalizeRecord turns '£51.77' into the number 51.77", () => {
  const raw = {
    title: "A Light in the Attic",
    product_url: "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
    price_text: "£51.77",
    availability_text: "In stock (22 available)",
    rating_text: "Three",
    description: "Some description",
    source_page: "https://books.toscrape.com/catalogue/page-1.html",
    fetched_at: new Date().toISOString(),
  };
  const clean = normalizeRecord(raw);
  assert.equal(clean.price_gbp, 51.77);
  assert.equal(clean.price_text, "£51.77"); // raw kept alongside clean
  assert.equal(clean.in_stock, true);
  assert.equal(clean.rating_out_of_5, 3);
});

// --- 2. Relative -> absolute URL resolution ---
test("parseCataloguePage resolves relative book links to absolute URLs", () => {
  const html = `
    <article class="product_pod">
      <h3><a href="a-light-in-the-attic_1000/index.html" title="A Light in the Attic">A Light...</a></h3>
    </article>
    <ul class="pager"><li class="next"><a href="page-2.html">next</a></li></ul>
  `;
  const { bookLinks, nextUrl } = parseCataloguePage(
    html,
    "https://books.toscrape.com/catalogue/page-1.html"
  );
  assert.equal(bookLinks[0], "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html");
  assert.equal(nextUrl, "https://books.toscrape.com/catalogue/page-2.html");
});

test("parseCataloguePage returns nextUrl=null on the last page (no next link)", () => {
  const html = `
    <article class="product_pod"><h3><a href="some-book/index.html">Some Book</a></h3></article>
    <ul class="pager"></ul>
  `;
  const { nextUrl } = parseCataloguePage(html, "https://books.toscrape.com/catalogue/page-3.html");
  assert.equal(nextUrl, null);
});

// --- 3. Missing description ---
test("parseBookPage stores null when there is no description section", () => {
  const html = `
    <div class="product_main">
      <h1>No Description Book</h1>
      <p class="price_color">£10.00</p>
      <p class="instock availability">In stock (5 available)</p>
      <p class="star-rating Two"></p>
    </div>
  `;
  const record = parseBookPage(
    html,
    "https://books.toscrape.com/catalogue/no-description-book/index.html",
    "https://books.toscrape.com/catalogue/page-1.html"
  );
  assert.equal(record.description, null);
  assert.equal(record.rating_text, "Two");
});

// --- 4. Duplicate URL dedupe ---
test("dedupeByUrl collapses records with the same product_url", () => {
  const url = "https://books.toscrape.com/catalogue/dup-book/index.html";
  const records = [
    { product_url: url, title: "First pass" },
    { product_url: url, title: "Second pass (should win)" },
  ];
  const result = dedupeByUrl(records);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Second pass (should win)");
});

// --- 5. Malformed fixture doesn't crash, fails schema validation cleanly ---
test("a malformed page produces a record that safely fails schema validation", () => {
  const html = `<html><body><p>this page has none of the expected structure</p></body></html>`;
  const raw = parseBookPage(
    html,
    "https://books.toscrape.com/catalogue/broken-page/index.html",
    "https://books.toscrape.com/catalogue/page-1.html"
  );
  const clean = normalizeRecord(raw);
  const check = BookRecordSchema.safeParse(clean);

  assert.equal(check.success, false); // must fail, not throw
  assert.ok(check.error.issues.length > 0);
});

// --- 6. Whitespace-heavy availability text is cleaned ---
test("parseBookPage collapses whitespace in availability text", () => {
  const html = `
    <div class="product_main">
      <h1>Whitespace Book</h1>
      <p class="price_color">£12.34</p>
      <p class="instock availability">
      
          In stock (3 available)
      
      </p>
      <p class="star-rating Five"></p>
    </div>
  `;
  const record = parseBookPage(
    html,
    "https://books.toscrape.com/catalogue/whitespace-book/index.html",
    "https://books.toscrape.com/catalogue/page-1.html"
  );
  assert.equal(record.availability_text, "In stock (3 available)");
});
