const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['customer', 'worker'], default: 'customer' },
    location: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('User', userSchema, 'users');
