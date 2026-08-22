const express = require('express');
const { TicketInputSchema } = require('../schemas/ticketTriage.schema');
const { triageTicket } = require('../services/ticketTriage.service');

const router = express.Router();

router.post('/api/tickets/triage', async (req, res) => {
  const inputCheck = TicketInputSchema.safeParse(req.body);
  if (!inputCheck.success) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid input',
      details: inputCheck.error.flatten().fieldErrors,
    });
  }

  const result = await triageTicket(inputCheck.data.message);

  if (result.ok) {
    return res.status(200).json(result);
  }

  // Model/provider genuinely failed after retries — 502, not 500.
  // This wasn't our server's bug, it was the upstream dependency's.
  return res.status(502).json(result);
});

module.exports = router;