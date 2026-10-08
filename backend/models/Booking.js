const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    weight: { type: Number, required: true },
    items: { type: Number, required: true },
    pickupLocation: { type: String, required: true },
    deliveryLocation: { type: String, required: true },
    bookingDate: { type: String, required: true },
    bookingTime: { type: String, required: true },
    timeZoneOffsetMinutes: { type: Number, default: 0 },
    durationHours: { type: Number, required: true },
    preferences: { type: String, default: '' },
    images: {
      type: [
        {
          name: { type: String, required: true },
          contentType: { type: String, required: true },
          dataUrl: { type: String, required: true },
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: [
        'Request Sent',
        'Accepted',
        'On the Way',
        'Arrived',
        'Job Started',
        'Awaiting Customer Confirmation',
        'Completed',
        'Completion Disputed',
        'Cancelled',
      ],
      default: 'Request Sent',
    },
    completionConfirmation: {
      type: String,
      enum: ['pending', 'confirmed', 'disputed'],
      default: null,
    },
    completionConfirmedAt: { type: Date, default: null },
    totalPrice: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['card', 'wallet', 'bank'], default: 'card' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Booking', bookingSchema, 'orders');
