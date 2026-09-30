const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Provider = require('../models/Provider');
const User = require('../models/User');
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

router.get('/test', (req, res) => {
  res.json({ message: 'Booking route working' });
});

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

router.get('/:id', requireAuth, async (req, res) => {
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
      totalPrice: Number(form.totalPrice || 0),
      paymentMethod: form.paymentMethod || 'card',
    });

    const payment = await Payment.create({
      bookingId: booking._id,
      userId: booking.userId,
      amount: booking.totalPrice,
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

    const review = await Review.create({
      bookingId,
      userId,
      providerId: resolvedProviderId,
      rating: Number(rating),
      reviewText: reviewText || '',
    });

    const provider = await Provider.findById(resolvedProviderId);
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    const reviews = Array.isArray(provider.reviews) ? provider.reviews : [];
    if (!reviews.includes(reviewText || '')) reviews.push(reviewText || '');
    const ratingRows = await Review.find({ providerId: resolvedProviderId }).select('rating').lean();
    const ratingTotal = ratingRows.reduce((total, row) => total + Number(row.rating || 0), 0);
    provider.reviews = reviews;
    provider.rating = ratingRows.length ? ratingTotal / ratingRows.length : 0;
    await provider.save();

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

router.put('/reviews/:id', async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!review) return res.status(404).json({ message: 'Review not found' });
    return res.json(review);
  } catch (error) {
    return res.status(500).json({ message: 'Review update failed', error: error.message });
  }
});

router.delete('/reviews/:id', async (req, res) => {
  try {
    const deleted = await Review.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Review not found' });
    return res.json({ message: 'Review deleted successfully', id: req.params.id });
  } catch (error) {
    return res.status(500).json({ message: 'Review delete failed', error: error.message });
  }
});

router.post('/seed-demo', async (req, res) => {
  try {
    const userEmail = 'tim@gmail.com';
    const user = await User.findOneAndUpdate(
      { email: userEmail },
      {
        $setOnInsert: {
          name: 'Tim Parker',
          email: userEmail,
          password: '$2b$12$D9zV1I1TgW7i4YkW1G4Rteh9tthgE0gXE1Q7TYsM9lMRbKGa8YvTW',
          role: 'customer',
        },
      },
      { upsert: true, new: true },
    );

    const provider = await Provider.findOneAndUpdate(
      { name: 'Rahul Kumar' },
      {
        $setOnInsert: {
          userId: user._id,
          name: 'Rahul Kumar',
          kind: 'Individual',
          avatar: 'RK',
          rating: 4.8,
          jobs: 124,
          capacity: 100,
          distance: 1.2,
          available: true,
          price: 450,
          teamSize: 1,
          equipment: ['Hand trolley', 'Rope set'],
          serviceArea: 'Andheri, Mumbai',
          reviews: ['Fast and careful with our office move.', 'Very professional and punctual.'],
        },
      },
      { upsert: true, new: true },
    );

    const sampleBookings = [
      {
        userId: user._id,
        providerId: provider._id,
        category: 'Office furniture',
        description: 'Office furniture delivery',
        weight: 120,
        items: 8,
        pickupLocation: 'Andheri East, Mumbai',
        deliveryLocation: 'Powai, Mumbai',
        bookingDate: '2026-09-18',
        bookingTime: '10:30',
        durationHours: 3,
        preferences: 'Handle with care',
        status: 'Completed',
        totalPrice: 450,
        paymentMethod: 'card',
      },
      {
        userId: user._id,
        providerId: provider._id,
        category: 'Home appliance',
        description: 'Home appliance move',
        weight: 200,
        items: 5,
        pickupLocation: 'Bandra West, Mumbai',
        deliveryLocation: 'Dadar, Mumbai',
        bookingDate: '2026-09-12',
        bookingTime: '09:00',
        durationHours: 4,
        preferences: 'Need careful handling',
        status: 'Request Sent',
        totalPrice: 1200,
        paymentMethod: 'wallet',
      },
    ];

    const created = await Promise.all(
      sampleBookings.map(async (booking) => {
        const existing = await Booking.findOne({ userId: booking.userId, description: booking.description });
        if (existing) return existing;
        return Booking.create(booking);
      }),
    );

    res.status(200).json({
      message: 'Demo booking data seeded successfully',
      userId: user._id.toString(),
      providerId: provider._id.toString(),
      createdCount: created.length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to seed demo data', error: error.message });
  }
});

module.exports = router;
