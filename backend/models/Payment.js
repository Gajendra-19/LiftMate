const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['card', 'wallet', 'bank'], default: 'card' },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'partially_refunded', 'refunded'],
      default: 'pending',
    },
    refundedAmount: { type: Number, default: 0 },
    transactionReference: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Payment', paymentSchema);
