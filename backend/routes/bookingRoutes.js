const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, requireOwnership } = require('../middleware/auth');
const bookingController = require('../controllers/bookingController');

router.get('/provider/:userId', requireAuth, requireRole('worker'), requireOwnership(), bookingController.getProviderBookings);
router.get('/', requireAuth, bookingController.getBookings);
router.get('/user/:userId', requireAuth, requireRole('customer'), requireOwnership(), bookingController.getUserBookings);
router.post('/:id/confirm-completion', requireAuth, requireRole('customer'), bookingController.confirmBookingCompletion);
router.get('/:id([a-fA-F0-9]{24})', requireAuth, bookingController.getBooking);
router.post('/create', requireAuth, requireRole('customer'), bookingController.createBooking);
router.put('/reviews/:id', requireAuth, requireRole('customer'), bookingController.updateReview);
router.put('/:id', requireAuth, requireRole('worker'), bookingController.updateBooking);
router.delete('/reviews/:id', requireAuth, requireRole('customer'), bookingController.deleteReview);
router.delete('/:id', requireAuth, bookingController.deleteBooking);
router.post('/:bookingId/reviews', requireAuth, requireRole('customer'), bookingController.createReview);
router.get('/:bookingId/reviews', bookingController.getReviews);

module.exports = router;
