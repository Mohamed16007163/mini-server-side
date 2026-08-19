// Stage 1 — fetch once, cache once.
// Every real request: identifies itself, has a timeout, waits between requests,
// checks the status code, and retries only on timeout / 5xx (never on 404 or 403).

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export const USER_AGENT =
  "FlyRankInternshipA9/1.0 (+https://github.com/Mohamed16007163/mohamed-internship)";

const TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 1500;
const POLITE_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch a page politely, reading from a local cache when available.
 * Cached reads never touch the network and never sleep.
 *
 * @param {string} url
 * @param {string} cachePath
 * @returns {Promise<{html: string|null, status: number|null, fromCache: boolean, error: string|null}>}
 */
export async function fetchPage(url, cachePath) {
  await mkdir(path.dirname(cachePath), { recursive: true });

  if (existsSync(cachePath)) {
    const html = await readFile(cachePath, "utf-8");
    console.log(`CACHE HIT  ${url} (${html.length} bytes)`);
    return { html, status: 200, fromCache: true, error: null };
  }

  let attempt = 0;
  while (attempt < 2) {
    attempt += 1;
    try {
      const res = await fetchWithTimeout(url);

      if (res.status === 200) {
        const html = await res.text();
        await writeFile(cachePath, html, "utf-8");
        console.log(`FETCH      ${url} -> 200 (${html.length} bytes)`);
        await sleep(POLITE_DELAY_MS);
        return { html, status: 200, fromCache: false, error: null };
      }

      const isServerError = res.status >= 500 && res.status < 600;
      if (isServerError && attempt < 2) {
        console.log(`FETCH      ${url} -> ${res.status}, retrying once...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      // 404, 403, or a second 5xx: stop. Asking again won't help (404) or is rude (403).
      console.log(`FETCH      ${url} -> ${res.status}, not retrying`);
      await sleep(POLITE_DELAY_MS);
      return {
        html: null,
        status: res.status,
        fromCache: false,
        error: `HTTP ${res.status}`,
      };
    } catch (err) {
      const isTimeout = err.name === "AbortError";
      if (isTimeout && attempt < 2) {
        console.log(`FETCH      ${url} -> timeout, retrying once...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      console.log(`FETCH      ${url} -> error: ${err.message}`);
      await sleep(POLITE_DELAY_MS);
      return {
        html: null,
        status: null,
        fromCache: false,
        error: isTimeout ? "timeout" : err.message,
      };
    }
  }
}
