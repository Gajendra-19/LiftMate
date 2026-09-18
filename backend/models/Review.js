const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    reviewText: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Review', reviewSchema);
