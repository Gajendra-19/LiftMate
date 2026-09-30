const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true },
    kind: { type: String, enum: ['Individual', 'Team'], required: true },
    phone: { type: Number, default: null },
    teamName: { type: String, default: '' },
    teamMembers: [{ type: String }],
    avatar: { type: String, default: '' },
    rating: { type: Number, default: 0 },
    jobs: { type: Number, default: 0 },
    capacity: { type: Number, default: 0 },
    distance: { type: Number, default: 0 },
    available: { type: Boolean, default: true },
    price: { type: Number, default: 0 },
    teamSize: { type: Number, default: 1 },
    equipment: [{ type: String }],
    serviceArea: { type: String, default: '' },
    reviews: [{ type: String }],
  },
  { timestamps: true },
);

module.exports = mongoose.model('Provider', providerSchema, 'providers');
