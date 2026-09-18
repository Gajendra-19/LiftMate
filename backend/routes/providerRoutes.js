const express = require('express');
const router = express.Router();

router.get('/test', (req, res) => {
  res.json({ message: 'Provider route working' });
});

module.exports = router;
