const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, requireOwnership } = require('../middleware/auth');
const providerController = require('../controllers/providerController');

router.get('/', providerController.getProviders);
router.get('/team', requireAuth, requireRole('worker'), providerController.getMyTeam);
router.post('/team', requireAuth, requireRole('worker'), providerController.createTeam);
router.post('/team/join', requireAuth, requireRole('worker'), providerController.joinTeam);
router.delete('/team', requireAuth, requireRole('worker'), providerController.leaveTeam);
router.patch('/team/members/:userId/role', requireAuth, requireRole('worker'), providerController.updateTeamMemberRole);
router.delete('/team/members/:userId', requireAuth, requireRole('worker'), providerController.removeTeamMember);
router.get('/profile/:userId', requireAuth, requireRole('worker'), requireOwnership(), providerController.getProfile);
router.post('/profile', requireAuth, requireRole('worker'), providerController.saveProfile);
router.patch('/profile/:userId/availability', requireAuth, requireRole('worker'), requireOwnership(), providerController.updateAvailability);
router.patch('/profile/:userId/settings', requireAuth, requireRole('worker'), requireOwnership(), providerController.updateSettings);
router.get('/profile/:userId/reviews', requireAuth, requireRole('worker'), requireOwnership(), providerController.getReviews);

module.exports = router;
