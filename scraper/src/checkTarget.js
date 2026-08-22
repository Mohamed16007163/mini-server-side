// Stage 0 — check before you collect.
// Run this ONCE by hand (`npm run check-robots`), read the result, and paste
// it into the README's Target classification section. It is deliberately
// separate from the main pipeline — you check a site's rules once, not on
// every run.

import { USER_AGENT } from "./fetcher.js";

const ROBOTS_URL = "https://books.toscrape.com/robots.txt";

console.log(`Requesting ${ROBOTS_URL} once, as: ${USER_AGENT}\n`);

try {
  const res = await fetch(ROBOTS_URL, {
    headers: { "User-Agent": USER_AGENT },
  });

  console.log(`Status: ${res.status}`);

  if (res.status === 200) {
    const body = await res.text();
    console.log("\nrobots.txt contents:\n" + body);
  } else if (res.status === 404) {
    console.log(
      "\nResult: no robots file found (404). This is not permission — " +
        "it's simply the absence of a file. Books to Scrape describes itself " +
        "on toscrape.com as a sandbox built for scraping practice, which is " +
        "the actual permission this assignment relies on."
    );
  } else {
    console.log(`\nUnexpected status ${res.status} — investigate before scraping.`);
  }
} catch (err) {
  console.error(`Request failed: ${err.message}`);
}
