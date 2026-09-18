const mongoose = require('mongoose');

const bookingDocumentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    previewUrl: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('BookingDocument', bookingDocumentSchema);
