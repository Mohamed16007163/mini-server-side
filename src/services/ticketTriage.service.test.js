const test = require('node:test');
const assert = require('node:assert/strict');
const { triageTicket } = require('./ticketTriage.service');
const { TicketInputSchema } = require('../schemas/ticketTriage.schema');

const VALID_RESPONSE = JSON.stringify({
  category: 'billing',
  priority: 'high',
  confidence: 0.95,
  reason: 'Customer reports duplicate charge.',
});

// --- 1. Happy path: valid JSON on the first try -----------------------
test('valid model output on first attempt returns ok:true with attempts:1', async () => {
  const fakeCall = async () => VALID_RESPONSE;
  const result = await triageTicket('I was charged twice', { callModel: fakeCall });

  assert.equal(result.ok, true);
  assert.equal(result.attempts, 1);
  assert.equal(result.data.category, 'billing');
});

// --- 2. Model returns an invalid enum value ----------------------------
test('invalid category value fails schema validation and retries then fails', async () => {
  const fakeCall = async () =>
    JSON.stringify({ category: 'shipping', priority: 'high', confidence: 0.9, reason: 'x' });
  const result = await triageTicket('some message', { callModel: fakeCall });

  assert.equal(result.ok, false);
  assert.equal(result.retryable, true);
  assert.equal(result.attempts, 3); // exhausted all retries
});

// --- 3. Model returns non-JSON text -------------------------------------
test('non-JSON model output is treated as a retryable schema error', async () => {
  const fakeCall = async () => 'Sorry, I cannot classify this.';
  const result = await triageTicket('some message', { callModel: fakeCall });

  assert.equal(result.ok, false);
  assert.equal(result.retryable, true);
  assert.match(result.error, /non-JSON/);
});

// --- 4. Model fails once, then succeeds on retry ------------------------
test('recovers after one bad attempt, succeeding on attempt 2', async () => {
  let callCount = 0;
  const fakeCall = async () => {
    callCount += 1;
    if (callCount === 1) return 'not json';
    return VALID_RESPONSE;
  };
  const result = await triageTicket('some message', { callModel: fakeCall });

  assert.equal(result.ok, true);
  assert.equal(result.attempts, 2);
});

// --- 5. Timeout (AbortError) is retryable --------------------------------
test('a timeout is retried and eventually reported as retryable failure', async () => {
  const fakeCall = async () => {
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    throw err;
  };
  const result = await triageTicket('some message', { callModel: fakeCall });

  assert.equal(result.ok, false);
  assert.equal(result.retryable, true);
  assert.equal(result.attempts, 3);
});

// --- 6. A 401 (bad auth) fails immediately, no retries -------------------
test('a 401 from the provider is NOT retried and fails on attempt 1', async () => {
  const fakeCall = async () => {
    const err = new Error('Groq API returned 401');
    err.status = 401;
    throw err;
  };
  const result = await triageTicket('some message', { callModel: fakeCall });

  assert.equal(result.ok, false);
  assert.equal(result.retryable, false);
  assert.equal(result.attempts, 1); // proves we did NOT waste retries on a hopeless error
});

// --- 7. A 500 from the provider is retryable ------------------------------
test('a 500 from the provider is retried up to the max', async () => {
  const fakeCall = async () => {
    const err = new Error('Groq API returned 500');
    err.status = 500;
    throw err;
  };
  const result = await triageTicket('some message', { callModel: fakeCall });

  assert.equal(result.ok, false);
  assert.equal(result.retryable, true);
  assert.equal(result.attempts, 3);
});

// --- 8. Input validation rejects a too-short message ----------------------
test('input schema rejects a message under the minimum length', () => {
  const result = TicketInputSchema.safeParse({ message: 'hi' });
  assert.equal(result.success, false);
});