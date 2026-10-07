const express = require('express');
const router = express.Router();
const { requireAuth, requireOwnership } = require('../middleware/auth');
const authController = require('../controllers/authController');

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/profile/:userId', requireAuth, requireOwnership(), authController.getProfile);
router.patch('/profile/:userId', requireAuth, requireOwnership(), authController.updateProfile);

module.exports = router;
