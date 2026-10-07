const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, requireOwnership } = require('../middleware/auth');
const providerController = require('../controllers/providerController');

router.get('/', providerController.getProviders);
router.get('/profile/:userId', requireAuth, requireRole('worker'), requireOwnership(), providerController.getProfile);
router.post('/profile', requireAuth, requireRole('worker'), providerController.saveProfile);
router.patch('/profile/:userId/availability', requireAuth, requireRole('worker'), requireOwnership(), providerController.updateAvailability);
router.patch('/profile/:userId/settings', requireAuth, requireRole('worker'), requireOwnership(), providerController.updateSettings);
router.get('/profile/:userId/reviews', requireAuth, requireRole('worker'), requireOwnership(), providerController.getReviews);

module.exports = router;
