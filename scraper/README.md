# The Polite Scraper — Books to Scrape

A small scraping pipeline that downloads the first three catalogue pages of
[Books to Scrape](https://books.toscrape.com), visits all 60 book pages, and
turns the messy HTML into clean, schema-validated JSON — without hammering
the server and without crashing on a broken page.

## Target classification

- **Site:** `books.toscrape.com`
- **What it is:** a public sandbox, described on [toscrape.com](https://toscrape.com)
  as *"a fictional bookstore that desperately wants to be scraped... a safe
  place for beginners learning web scraping."* That description is the
  permission this project relies on.
- **Scope:** the first 3 catalogue pages only (`page-1.html` → `page-2.html`
  → `page-3.html`, followed via the site's own "next" link — never hardcoded),
  which covers exactly 60 books.
- **Data collected:** title, price, availability, star rating, description,
  and provenance (source page + fetch time) for each book. No personal data,
  no login, no paywall.
- **robots.txt result:** `GET https://books.toscrape.com/robots.txt` → **404
  Not Found**. No robots file exists. A missing file is not permission by
  itself — the actual permission is the site's own description of itself as
  a scraping sandbox (above).

**I will not reuse this code on another site without checking its rules and
terms first.**

## Ethics note

- Use an official API when one exists — scraping is a fallback, not a
  default.
- Never bypass logins, paywalls, CAPTCHAs, or explicit blocks (a `403` means
  stop, not retry).
- Collect only the fields actually needed for the task.
- Identify the scraper honestly (see the user-agent below) so a site owner
  can find out who's requesting their pages.

## Politeness rules this scraper follows

| Rule | Implementation |
|---|---|
| Identify itself | Every real request sends `User-Agent: FlyRankInternshipA9/1.0 (+https://github.com/Mohamed16007163/mohamed-internship)` |
| Timeout | Every request aborts after 8 seconds — never waits forever |
| Delay | Waits 500ms after every real network request (cached reads never sleep, since they never leave the machine) |
| Status check | Only `200` is treated as a page; anything else is a failed fetch, not HTML to parse |
| Retry | Retries once, after a short pause, only on timeout or `5xx`. Never retries `404` (page doesn't exist) or `403` (site said no) |
| Cache | Every fetched page is saved to `cache/`; subsequent runs during development read the cache instead of re-asking the site |

## Record schema

Every entry in `output/books.json` is validated against this shape
(defined with Zod in `src/schema.js`) before it's allowed to land:

```
title              string, non-empty
product_url        string, https URL — this is the record's canonical identity
price_gbp           number, > 0            — cleaned from price_text
price_text         string                 — raw text, e.g. "£51.77", kept alongside price_gbp
availability_text  string                 — raw text, e.g. "In stock (22 available)"
in_stock           boolean                — derived from availability_text
rating_text        "One"|"Two"|"Three"|"Four"|"Five"
rating_out_of_5    integer 1-5            — derived from rating_text
description        string | null          — null when the book genuinely has none
source_page        string, URL            — which catalogue page this was discovered on
fetched_at         string, ISO 8601 datetime
```

Records that fail validation are written to `output/errors.json` with the
reason, instead of silently entering `books.json`.

## Why this needed no browser

The data (title, price, availability, rating, description) is already
present in the HTML the server sends on first load — there's no JavaScript
rendering step hiding it behind an API call. A tool like Playwright would
only add startup cost (spinning up a full browser) for zero extra data, so
a plain HTTP request + HTML parser is the right-sized tool here.

## How to run it

Requires **Node.js 20+**.

```powershell
cd scraper
npm install

# Stage 0 — run once, by hand, to see the robots.txt result yourself
npm run check-robots

# Full pipeline: fetch, extract, normalize, validate, store, report
npm start

# Stage 5 checkpoint — inject one deliberately broken URL and confirm
# the run still finishes with 60 good records and failed_pages: 1
npm start -- --inject-broken-url

# Unit tests (price normalization, URL resolution, missing description,
# duplicate dedupe, a malformed-page fixture, whitespace cleanup)
npm test
```

A normal run prints progress line by line (`FETCH` / `CACHE HIT` per page),
then a full run report, and writes:

- `output/books.json` — 60 validated, unique records
- `output/errors.json` — any records that failed validation, with reasons
- `output/run-report.json` — counts and timing for the run

Run it twice — the second run should read mostly from `cache/` and still
produce exactly 60 records in `books.json`, not 120.

## Sample run report

```json
{
  "start_time": "2026-08-19T12:00:00.000Z",
  "end_time": "2026-08-19T12:00:42.311Z",
  "duration_ms": 42311,
  "catalogue_pages_fetched": 3,
  "cache_hits": 0,
  "real_fetches": 63,
  "detail_pages_attempted": 60,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": []
}
```
*(Replace this with your own real `output/run-report.json` after running it
locally — this is a template, not a claim that this exact run happened.)*

## Known limitation

`source_page` currently records the catalogue *start* URL rather than the
exact one of the three catalogue pages each book was linked from, since book
links are deduplicated across pages before the detail-fetch stage. If exact
per-page provenance mattered more than deduplication, links would need to
carry their origin page through the pipeline instead of being flattened into
a `Set`.

## Project structure

```
scraper/
├── src/
│   ├── index.js            # orchestrator — runs all stages
│   ├── fetcher.js          # Stage 1: polite fetch + cache
│   ├── extractCatalogue.js # Stage 2: book links + next-page link
│   ├── extractBook.js      # Stage 3: raw record from a book page
│   ├── normalize.js        # Stage 4: raw -> clean values, dedupe
│   ├── schema.js           # Stage 4: Zod validation schema
│   ├── report.js           # Stage 5: run-report writer
│   └── checkTarget.js      # Stage 0: one-off robots.txt check
├── tests/
│   └── normalize.test.js   # 7 unit tests, run with `npm test`
├── cache/                  # gitignored — saved HTML, built on first run
├── output/                 # books.json, errors.json, run-report.json
└── package.json
```
