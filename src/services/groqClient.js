const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 8000;

const SYSTEM_PROMPT = `You are a support ticket triage assistant. Given a customer message, classify it.

Respond with ONLY a JSON object, no markdown, no explanation outside the JSON:
{
  "category": one of "billing" | "technical" | "account" | "feature_request" | "other",
  "priority": one of "low" | "medium" | "high" | "urgent",
  "confidence": number between 0 and 1,
  "reason": one short sentence (max 200 chars) explaining the call
}`;

/**
 * Calls the Groq model with a hard timeout. Throws on timeout, network
 * failure, or non-2xx response — the caller decides what's retryable.
 * Returns the raw string content; does NOT validate its shape.
 */
async function callGroqModel(ticketMessage) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: ticketMessage },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const status = response.status;
      const err = new Error(`Groq API returned ${status}`);
      err.status = status;
      throw err;
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { callGroqModel, TIMEOUT_MS };