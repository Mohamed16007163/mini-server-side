const { z } = require('zod');

// What the caller sends in
const TicketInputSchema = z.object({
  message: z.string()
    .min(3, 'Message too short to triage')
    .max(5000, 'Message too long — truncate before sending'),
});

// What the model must return — this is the contract we don't trust
// the model to honor on its own, so we validate it every time.
const TicketTriageSchema = z.object({
  category: z.enum(['billing', 'technical', 'account', 'feature_request', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(200),
});

module.exports = { TicketInputSchema, TicketTriageSchema };