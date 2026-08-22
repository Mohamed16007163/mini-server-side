const { callGroqModel } = require('./groqClient');
const { TicketTriageSchema } = require('../schemas/ticketTriage.schema');

const MAX_RETRIES = 2; // 3 attempts total
const BACKOFF_MS = [300, 900]; // delay before retry 1, retry 2

/**
 * Errors worth retrying:
 *  - timeout (AbortError from the fetch signal)
 *  - 5xx from Groq (their problem, might clear up)
 *  - malformed/invalid JSON from the model (model had a bad turn)
 *
 * NOT worth retrying — fail immediately:
 *  - 4xx from Groq (bad API key, bad request — retrying won't fix it)
 *  - anything else unexpected
 */
function isRetryable(err) {
  if (err.name === 'AbortError') return true;
  if (err.status && err.status >= 500) return true;
  if (err.isSchemaError) return true;
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs one full triage attempt: call the model, parse its JSON,
 * validate against the schema. Throws a tagged error if anything
 * along the way is retryable.
 */
async function attemptTriage(message) {
  let raw;
  try {
    raw = await callGroqModel(message);
  } catch (err) {
    throw err; // network/timeout/status errors are already tagged
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const err = new Error('Model returned non-JSON output');
    err.isSchemaError = true;
    throw err;
  }

  const result = TicketTriageSchema.safeParse(parsed);
  if (!result.success) {
    const err = new Error(`Model output failed schema validation: ${result.error.message}`);
    err.isSchemaError = true;
    throw err;
  }

  return result.data;
}

/**
 * Public entry point. Retries retryable failures with backoff,
 * gives up immediately on non-retryable ones, and always returns
 * either a validated triage result or a clear, typed failure.
 */
async function triageTicket(message) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await attemptTriage(message);
      return { ok: true, data, attempts: attempt + 1 };
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === MAX_RETRIES) break;
      await sleep(BACKOFF_MS[attempt]);
    }
  }

  return {
    ok: false,
    error: lastError.message,
    retryable: isRetryable(lastError),
    attempts: MAX_RETRIES + 1,
  };
}

module.exports = { triageTicket };