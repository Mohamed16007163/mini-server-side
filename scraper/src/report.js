// Stage 5 — a good job finishes its work, then tells you what happened.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * @param {string} outputPath
 * @param {object} stats
 */
export async function writeRunReport(outputPath, stats) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const report = {
    start_time: stats.startTime,
    end_time: stats.endTime,
    duration_ms: stats.durationMs,
    catalogue_pages_fetched: stats.cataloguePagesFetched,
    cache_hits: stats.cacheHits,
    real_fetches: stats.realFetches,
    detail_pages_attempted: stats.detailPagesAttempted,
    valid_records: stats.validRecords,
    invalid_records: stats.invalidRecords,
    failed_pages: stats.failedPages,
  };
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf-8");
  return report;
}
