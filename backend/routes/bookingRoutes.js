const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Provider = require('../models/Provider');
const Review = require('../models/Review');
const { requireAuth, requireRole, requireOwnership } = require('../middleware/auth');

const resolveProviderId = async (providerId) => {
  if (!providerId) return null;

  if (mongoose.isValidObjectId(providerId)) {
    return String(providerId);
  }

  const provider = await Provider.findOne({
    $or: [{ _id: providerId }, { id: Number(providerId) }, { id: String(providerId) }],
  }).lean();

  if (!provider) return null;
  return String(provider._id);
};

const recalculateProviderRating = async (provider) => {
  const ratingRows = await Review.find({ providerId: provider._id }).select('rating').lean();
  const ratingTotal = ratingRows.reduce((total, row) => total + Number(row.rating || 0), 0);
  provider.rating = ratingRows.length ? ratingTotal / ratingRows.length : 0;
  await provider.save();
};

router.get('/provider/:userId', requireAuth, requireRole('worker'), requireOwnership(), async (req, res) => {
  try {
    const providerQuery = mongoose.isValidObjectId(req.params.userId)
      ? { $or: [{ userId: req.params.userId }, { _id: req.params.userId }] }
      : { userId: req.params.userId };
    const provider = await Provider.findOne(providerQuery).select('_id').lean();
    if (!provider) return res.status(404).json({ message: 'Worker profile not found' });

    const bookings = await Booking.find({
      providerId: provider._id,
      status: { $ne: 'Cancelled' },
    })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    return res.json(
      bookings.map((booking) => ({
        ...booking,
        _id: String(booking._id),
        customerName: booking.userId?.name || 'Customer',
        userId: booking.userId?._id?.toString?.() ?? booking.userId?.toString?.() ?? booking.userId,
        providerId: String(provider._id),
      })),
    );
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load worker requests', error: error.message });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    let query = { userId: req.auth.userId };
    if (req.auth.role === 'worker') {
      const provider = await Provider.findOne({ userId: req.auth.userId }).select('_id').lean();
      query = { providerId: provider?._id };
    }
    const bookings = await Booking.find(query)
      .populate('providerId', 'name userId')
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .lean();
    res.json(bookings.map((booking) => ({
      ...booking,
      _id: booking._id.toString(),
      customerName: booking.userId?.name || '',
      userId: booking.userId?._id?.toString?.() ?? booking.userId?.toString?.() ?? booking.userId,
      providerId: booking.providerId
        ? {
            _id: booking.providerId._id.toString(),
            name: booking.providerId.name,
            userId: booking.providerId.userId?.toString?.() ?? booking.providerId.userId,
          }
        : null,
    })));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch bookings', error: error.message });
  }
});

router.get('/user/:userId', requireAuth, requireRole('customer'), requireOwnership(), async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.params.userId })
      .populate('providerId', 'name userId')
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const normalized = bookings.map((booking) => ({
      ...booking,
      _id: booking._id.toString(),
      customerName: booking.userId?.name || '',
      userId: booking.userId?._id?.toString?.() ?? booking.userId?.toString?.() ?? booking.userId,
      providerId: booking.providerId
        ? {
            _id: booking.providerId._id.toString(),
            name: booking.providerId.name,
            userId: booking.providerId.userId?.toString?.() ?? booking.providerId.userId,
          }
        : null,
    }));

    res.json(normalized);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load booking history', error: error.message });
  }
});

router.get('/:id([a-fA-F0-9]{24})', requireAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('providerId', 'name userId')
      .populate('userId', 'name')
      .lean();
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    const providerUserId = booking.providerId?.userId?.toString?.();
    if (String(booking.userId?._id || booking.userId) !== String(req.auth.userId) && providerUserId !== String(req.auth.userId)) {
      return res.status(403).json({ message: 'You can only access your own bookings' });
    }

    return res.json({
      ...booking,
      _id: booking._id.toString(),
      customerName: booking.userId?.name || '',
      userId: booking.userId?._id?.toString?.() ?? booking.userId?.toString?.() ?? booking.userId,
      providerId: booking.providerId
        ? {
            _id: booking.providerId._id.toString(),
            name: booking.providerId.name,
            userId: booking.providerId.userId?.toString?.() ?? booking.providerId.userId,
          }
        : null,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to get booking', error: error.message });
  }
});

router.post('/create', requireAuth, requireRole('customer'), async (req, res) => {
  try {
    const { providerId, form } = req.body || {};
    const userId = req.auth.userId;

    if (!userId || !providerId || !form) {
      return res.status(400).json({ message: 'Missing booking data' });
    }

    const resolvedProviderId = await resolveProviderId(providerId);
    if (!resolvedProviderId) {
      return res.status(400).json({ message: 'Invalid provider id' });
    }

    const provider = await Provider.findById(resolvedProviderId).select('price');
    if (!provider) return res.status(404).json({ message: 'Provider not found' });
    const totalPrice = provider.price;

    const booking = await Booking.create({
      userId,
      providerId: resolvedProviderId,
      category: form.category || 'General',
      description: form.description || '',
      weight: Number(form.weight || 0),
      items: Number(form.items || 0),
      pickupLocation: form.pickup || '',
      deliveryLocation: form.delivery || '',
      bookingDate: form.date || new Date().toISOString().slice(0, 10),
      bookingTime: form.time || '09:00',
      durationHours: Number(form.duration || 1),
      preferences: form.preferences || '',
      status: 'Request Sent',
      totalPrice,
      paymentMethod: form.paymentMethod || 'card',
    });

    // Payment processing is simulated; success is a demo placeholder.
    const payment = await Payment.create({
      bookingId: booking._id,
      userId: booking.userId,
      amount: totalPrice,
      paymentMethod: booking.paymentMethod,
      status: 'success',
    });

    return res.status(201).json({
      _id: booking._id,
      userId: booking.userId,
      providerId: booking.providerId,
      status: booking.status,
      paymentId: payment._id,
      paymentStatus: payment.status,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Booking creation failed', error: error.message });
  }
});

router.put('/reviews/:id', requireAuth, requireRole('customer'), async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    if (String(review.userId) !== String(req.auth.userId)) {
      return res.status(403).json({ message: 'You can only update your own reviews' });
    }

    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const updates = {};
    if (Object.prototype.hasOwnProperty.call(body, 'rating')) {
      const rating = Number(body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
      }
      updates.rating = rating;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'reviewText')) {
      if (typeof body.reviewText !== 'string') {
        return res.status(400).json({ message: 'Review text must be a string' });
      }
      updates.reviewText = body.reviewText;
    }

    const provider = await Provider.findById(review.providerId);
    if (!provider) return res.status(404).json({ message: 'Provider not found' });
    review.set(updates);
    await review.save();
    await recalculateProviderRating(provider);
    return res.json(review);
  } catch (error) {
    return res.status(500).json({ message: 'Review update failed', error: error.message });
  }
});

router.put('/:id', requireAuth, requireRole('worker'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('providerId', 'userId');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (String(booking.providerId?.userId) !== String(req.auth.userId)) {
      return res.status(403).json({ message: 'You can only update your own bookings' });
    }
    booking.status = req.body.status;
    await booking.save();
    return res.json(booking);
  } catch (error) {
    return res.status(500).json({ message: 'Booking update failed', error: error.message });
  }
});

router.delete('/reviews/:id', requireAuth, requireRole('customer'), async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    if (String(review.userId) !== String(req.auth.userId)) {
      return res.status(403).json({ message: 'You can only delete your own reviews' });
    }

    const provider = await Provider.findById(review.providerId);
    if (!provider) return res.status(404).json({ message: 'Provider not found' });
    await review.deleteOne();
    await recalculateProviderRating(provider);
    return res.json({ message: 'Review deleted successfully', id: req.params.id });
  } catch (error) {
    return res.status(500).json({ message: 'Review delete failed', error: error.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('providerId', 'userId');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    const providerUserId = booking.providerId?.userId?.toString?.();
    if (String(booking.userId) !== String(req.auth.userId) && providerUserId !== String(req.auth.userId)) {
      return res.status(403).json({ message: 'You can only delete your own bookings' });
    }
    const deleted = await Booking.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Booking not found' });
    return res.json({ message: 'Booking deleted successfully', id: req.params.id });
  } catch (error) {
    return res.status(500).json({ message: 'Booking delete failed', error: error.message });
  }
});

router.post('/:bookingId/reviews', requireAuth, requireRole('customer'), async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { providerId, rating, reviewText } = req.body || {};
    const userId = req.auth.userId;

    if (!bookingId || !userId || !providerId || !rating) {
      return res.status(400).json({ message: 'Missing review data' });
    }

    const booking = await Booking.findOne({ _id: bookingId, userId, providerId }).lean();
    if (!booking) return res.status(403).json({ message: 'You can only review your own booking' });

    const resolvedProviderId = await resolveProviderId(providerId);
    if (!resolvedProviderId) {
      return res.status(400).json({ message: 'Invalid provider id' });
    }

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    if (booking.status !== 'Completed') {
      return res.status(400).json({ message: 'You can only review completed bookings' });
    }

    if (await Review.exists({ bookingId })) {
      return res.status(409).json({ message: 'A review already exists for this booking' });
    }

    const provider = await Provider.findById(resolvedProviderId);
    if (!provider) return res.status(404).json({ message: 'Provider not found' });

    const review = await Review.create({
      bookingId,
      userId,
      providerId: resolvedProviderId,
      rating: numericRating,
      reviewText: reviewText || '',
    });

    const reviews = Array.isArray(provider.reviews) ? provider.reviews : [];
    if (!reviews.includes(reviewText || '')) reviews.push(reviewText || '');
    provider.reviews = reviews;
    await recalculateProviderRating(provider);

    return res.status(201).json({
      _id: review._id,
      bookingId: review.bookingId,
      rating: review.rating,
      reviewText: review.reviewText,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Review save failed', error: error.message });
  }
});

router.get('/:bookingId/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({ bookingId: req.params.bookingId }).sort({ createdAt: -1 }).lean();
    res.json(reviews.map((review) => ({
      ...review,
      _id: review._id.toString(),
      bookingId: review.bookingId?.toString?.() ?? review.bookingId,
      userId: review.userId?.toString?.() ?? review.userId,
      providerId: review.providerId?.toString?.() ?? review.providerId,
    })));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch reviews', error: error.message });
  }
});

module.exports = router;
