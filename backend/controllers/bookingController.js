const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Cancellation = require('../models/Cancellation');
const Payment = require('../models/Payment');
const Provider = require('../models/Provider');
const Review = require('../models/Review');
const Team = require('../models/Team');
const { normalizeProviderBooking, normalizeCustomerBooking } = require('../utils/bookingNormalizers');

const bookingStatuses = [
  'Request Sent',
  'Accepted',
  'On the Way',
  'Arrived',
  'Job Started',
  'Awaiting Customer Confirmation',
  'Completed',
  'Cancelled',
];
const nextBookingStatus = {
  'Request Sent': 'Accepted',
  Accepted: 'On the Way',
  'On the Way': 'Arrived',
  Arrived: 'Job Started',
  'Job Started': 'Awaiting Customer Confirmation',
};

const withPaymentDetails = async (bookings) => {
  if (!bookings.length) return [];
  const payments = await Payment.find({
    bookingId: { $in: bookings.map((booking) => booking._id) },
  })
    .select('bookingId status refundedAmount')
    .lean();
  const byBookingId = new Map(payments.map((payment) => [String(payment.bookingId), payment]));
  return bookings.map((booking) => {
    const payment = byBookingId.get(String(booking._id));
    return {
      ...booking,
      paymentStatus: payment?.status || 'pending',
      paymentRefundedAmount: payment?.refundedAmount || 0,
    };
  });
};

const getCancellationFeePercent = (booking) => {
  if (['On the Way', 'Arrived', 'Job Started'].includes(booking.status)) return 100;
  const [year, month, day] = booking.bookingDate.split('-').map(Number);
  const [hour, minute] = booking.bookingTime.split(':').map(Number);
  const offset = Number.isInteger(booking.timeZoneOffsetMinutes)
    ? booking.timeZoneOffsetMinutes
    : 0;
  const pickupAt = Date.UTC(year, month - 1, day, hour, minute) + offset * 60_000;
  const hoursUntilPickup = (pickupAt - Date.now()) / 3_600_000;
  if (!Number.isFinite(pickupAt)) return 100;
  if (hoursUntilPickup > 24) return 0;
  if (hoursUntilPickup > 1) return 50;
  return 100;
};

const recordCancellationPayment = async (booking, userId, initiatedBy, feePercent, reason) => {
  const payment = await Payment.findOne({ bookingId: booking._id });
  if (!payment) return false;

  const feeAmount = Math.round((payment.amount * feePercent) / 100);
  const refundAmount = Math.max(0, payment.amount - feeAmount);
  payment.refundedAmount = refundAmount;
  if (refundAmount >= payment.amount && refundAmount > 0) {
    payment.status = 'refunded';
  } else if (refundAmount > 0) {
    payment.status = 'partially_refunded';
  }
  await payment.save();

  await Cancellation.create({
    bookingId: booking._id,
    userId,
    reason,
    feePercent,
    feeAmount,
    refundAmount,
    initiatedBy,
    status: 'approved',
  });
  return true;
};

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

const getProviderBookings = async (req, res) => {
  try {
    const providerQuery = mongoose.isValidObjectId(req.params.userId)
      ? { $or: [{ userId: req.params.userId }, { _id: req.params.userId }] }
      : { userId: req.params.userId };
    const provider = await Provider.findOne(providerQuery).select('_id').lean();
    if (!provider) return res.status(404).json({ message: 'Worker profile not found' });

    const team = await Team.findOne({ 'members.userId': req.auth.userId }).lean();
    const providerIds = team
      ? team.members.map((member) => member.providerId)
      : [provider._id];
    const providers = await Provider.find({ _id: { $in: providerIds } }).select('_id').lean();
    const providersById = new Map(providers.map((entry) => [String(entry._id), entry]));

    const bookings = await Booking.find({
      providerId: { $in: providerIds },
      status: { $ne: 'Cancelled' },
    })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const bookingsWithPayments = await withPaymentDetails(bookings);
    return res.json(
      bookingsWithPayments.map((booking) =>
        normalizeProviderBooking(
          booking,
          providersById.get(String(booking.providerId)) || { _id: booking.providerId },
        ),
      ),
    );
  } catch (error) {
    console.error('Failed to load worker requests:', error);
    return res.status(500).json({ message: 'Failed to load worker requests' });
  }
};

const getBookings = async (req, res) => {
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
    const bookingsWithPayments = await withPaymentDetails(bookings);
    res.json(bookingsWithPayments.map(normalizeCustomerBooking));
  } catch (error) {
    console.error('Failed to fetch bookings:', error);
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
};

const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.params.userId })
      .populate('providerId', 'name userId')
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const bookingsWithPayments = await withPaymentDetails(bookings);
    const normalized = bookingsWithPayments.map(normalizeCustomerBooking);

    res.json(normalized);
  } catch (error) {
    console.error('Failed to load booking history:', error);
    res.status(500).json({ message: 'Failed to load booking history' });
  }
};

const getBooking = async (req, res) => {
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

    const [bookingWithPayment] = await withPaymentDetails([booking]);
    return res.json(normalizeCustomerBooking(bookingWithPayment));
  } catch (error) {
    console.error('Failed to get booking:', error);
    return res.status(500).json({ message: 'Failed to get booking' });
  }
};

const createBooking = async (req, res) => {
  try {
    const { providerId, form } = req.body || {};
    const userId = req.auth.userId;

    if (!userId || !providerId || !form) {
      return res.status(400).json({ message: 'Missing booking data' });
    }

    const images = form.images ?? [];
    if (!Array.isArray(images) || images.length > 20) {
      return res.status(400).json({ message: 'Invalid booking images' });
    }

    let totalImageBytes = 0;
    for (const image of images) {
      const dataPrefix = `data:${image?.contentType};base64,`;
      const encodedImage = typeof image?.dataUrl === 'string'
        ? image.dataUrl.slice(dataPrefix.length)
        : '';
      if (
        !image ||
        typeof image.name !== 'string' ||
        image.name.length > 255 ||
        !['image/png', 'image/jpeg', 'image/svg+xml'].includes(image.contentType) ||
        !encodedImage ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encodedImage)
      ) {
        return res.status(400).json({ message: 'Invalid booking images' });
      }
      totalImageBytes += Buffer.from(encodedImage, 'base64').length;
      if (totalImageBytes > 10 * 1024 * 1024) {
        return res.status(400).json({ message: 'Booking images exceed the 10MB total limit' });
      }
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
      timeZoneOffsetMinutes: Number.isInteger(form.timeZoneOffsetMinutes)
        ? Math.max(-840, Math.min(840, form.timeZoneOffsetMinutes))
        : 0,
      durationHours: Number(form.duration || 1),
      preferences: form.preferences || '',
      images,
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
      refundedAmount: 0,
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
    console.error('Booking creation failed:', error);
    return res.status(500).json({ message: 'Booking creation failed' });
  }
};

const updateReview = async (req, res) => {
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
    console.error('Review update failed:', error);
    return res.status(500).json({ message: 'Review update failed' });
  }
};

const updateBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('providerId', 'userId');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    const isProviderOwner = String(booking.providerId?.userId) === String(req.auth.userId);
    const isTeamMember =
      !isProviderOwner &&
      Boolean(
        await Team.exists({
          members: {
            $elemMatch: {
              userId: req.auth.userId,
              providerId: booking.providerId?._id,
            },
          },
        }),
      );
    if (!isProviderOwner && !isTeamMember) {
      return res.status(403).json({ message: 'You can only update your own bookings' });
    }

    const status = req.body?.status;
    if (!bookingStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid booking status' });
    }
    const canCancel =
      status === 'Cancelled' &&
      ![
        'Awaiting Customer Confirmation',
        'Completed',
        'Completion Disputed',
        'Cancelled',
      ].includes(booking.status);
    if (status !== nextBookingStatus[booking.status] && !canCancel) {
      return res.status(400).json({
        message: `Invalid booking status transition from ${booking.status} to ${status}`,
      });
    }

    if (status === 'Completed' || status === 'Completion Disputed') {
      return res.status(400).json({ message: 'Only the customer can confirm or dispute completion' });
    }

    if (status === 'Cancelled' && !(await Payment.exists({ bookingId: booking._id }))) {
      return res.status(409).json({ message: 'Booking payment was not found' });
    }

    booking.status = status;
    if (status === 'Awaiting Customer Confirmation') {
      booking.completionConfirmation = 'pending';
      booking.completionConfirmedAt = null;
    }
    await booking.save();
    if (status === 'Cancelled') {
      const recorded = await recordCancellationPayment(
        booking,
        req.auth.userId,
        'worker',
        0,
        'Cancelled by the worker',
      );
      if (!recorded) return res.status(409).json({ message: 'Booking payment was not found' });
    }
    return res.json(booking);
  } catch (error) {
    console.error('Booking update failed:', error);
    return res.status(500).json({ message: 'Booking update failed' });
  }
};

const deleteReview = async (req, res) => {
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
    console.error('Review delete failed:', error);
    return res.status(500).json({ message: 'Review delete failed' });
  }
};

const confirmBookingCompletion = async (req, res) => {
  try {
    if (typeof req.body?.confirmed !== 'boolean') {
      return res.status(400).json({ message: 'Completion confirmation must be true or false' });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      userId: req.auth.userId,
      status: 'Awaiting Customer Confirmation',
    });
    if (!booking) {
      return res.status(404).json({ message: 'A booking awaiting your confirmation was not found' });
    }

    const payment = await Payment.findOne({ bookingId: booking._id });
    if (!payment) return res.status(409).json({ message: 'Booking payment was not found' });

    if (req.body.confirmed) {
      booking.status = 'Completed';
      booking.completionConfirmation = 'confirmed';
      booking.completionConfirmedAt = new Date();
    } else {
      payment.refundedAmount = payment.amount;
      payment.status = 'refunded';
      await payment.save();
      booking.status = 'Completion Disputed';
      booking.completionConfirmation = 'disputed';
      booking.completionConfirmedAt = new Date();
    }
    await booking.save();

    return res.json({
      id: String(booking._id),
      status: booking.status,
      completionConfirmation: booking.completionConfirmation,
      completionConfirmedAt: booking.completionConfirmedAt,
      paymentStatus: payment.status,
      paymentRefundedAmount: payment.refundedAmount,
    });
  } catch (error) {
    console.error('Booking completion confirmation failed:', error);
    return res.status(500).json({ message: 'Booking completion confirmation failed' });
  }
};

const deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('providerId', 'userId');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    const providerUserId = booking.providerId?.userId?.toString?.();
    const isCustomerOwner = String(booking.userId) === String(req.auth.userId);
    const isProviderOwner = providerUserId === String(req.auth.userId);
    const isTeamMember =
      req.auth.role === 'worker' &&
      Boolean(
        await Team.exists({
          members: {
            $elemMatch: {
              userId: req.auth.userId,
              providerId: booking.providerId?._id,
            },
          },
        }),
      );
    if (
      !['customer', 'worker'].includes(req.auth.role) ||
      (req.auth.role === 'customer' && !isCustomerOwner) ||
      (req.auth.role === 'worker' && !isProviderOwner && !isTeamMember)
    ) {
      return res.status(403).json({ message: 'You can only delete your own bookings' });
    }
    if (['Completed', 'Completion Disputed', 'Cancelled', 'Awaiting Customer Confirmation'].includes(booking.status)) {
      return res.status(400).json({ message: 'This booking can no longer be cancelled' });
    }
    const feePercent = req.auth.role === 'customer' ? getCancellationFeePercent(booking) : 0;
    const cancellationReason = String(req.body?.reason || '').trim().slice(0, 500);
    if (!(await Payment.exists({ bookingId: booking._id }))) {
      return res.status(409).json({ message: 'Booking payment was not found' });
    }
    booking.status = 'Cancelled';
    await booking.save();
    const recorded = await recordCancellationPayment(
      booking,
      req.auth.userId,
      req.auth.role === 'customer' ? 'customer' : 'worker',
      feePercent,
      cancellationReason || (isCustomerOwner ? 'Cancelled by the customer' : 'Cancelled by the worker'),
    );
    if (!recorded) return res.status(409).json({ message: 'Booking payment was not found' });
    return res.json({ message: 'Booking cancelled successfully', id: req.params.id });
  } catch (error) {
    console.error('Booking delete failed:', error);
    return res.status(500).json({ message: 'Booking delete failed' });
  }
};

const createReview = async (req, res) => {
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
    console.error('Review save failed:', error);
    return res.status(500).json({ message: 'Review save failed' });
  }
};

const getReviews = async (req, res) => {
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
    console.error('Failed to fetch reviews:', error);
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
};

module.exports = {
  getProviderBookings,
  getBookings,
  getUserBookings,
  getBooking,
  createBooking,
  updateReview,
  updateBooking,
  confirmBookingCompletion,
  deleteReview,
  deleteBooking,
  createReview,
  getReviews,
};
