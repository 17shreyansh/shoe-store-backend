// routes/paymentDummy.js
const express = require('express');
const router = express.Router();

router.post('/pay', (req, res) => {
  const { amount } = req.body;
  const success = true; // Always succeed (dummy)
  if (success) {
    res.json({ status: 'success', transactionId: 'dummy_txn_123' });
  } else {
    res.status(400).json({ status: 'failed' });
  }
});

module.exports = router;
