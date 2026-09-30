const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const Provider = require('../models/Provider');
const { requireAuth, requireOwnership, getSecret } = require('../middleware/auth');

const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const isValidPhone = (value) => Number.isInteger(Number(value)) && /^\d{10}$/.test(String(value));

const sanitizeValue = (value) => {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').trim();
};

const validatePassword = (password) => {
  if (typeof password !== 'string') return false;
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
};

const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$/.test(value);

const verifyPassword = async (inputPassword, storedPassword) => {
  if (!inputPassword || !storedPassword) return false;

  const bcryptMatch = await bcrypt.compare(inputPassword, storedPassword).catch(() => false);
  if (bcryptMatch) return true;

  return storedPassword === inputPassword;
};

const issueToken = (user) => jwt.sign(
  { userId: String(user._id), role: user.role },
  getSecret(),
  { expiresIn: '7d' },
);

router.post('/signup', async (req, res) => {
  try {
    const name = sanitizeValue(req.body.name);
    const email = sanitizeValue(req.body.email).toLowerCase();
    const password = String(req.body.password || '').trim();
    const requestedRole = String(req.body.role || 'customer').toLowerCase();
    const finalRole = requestedRole === 'worker' ? 'worker' : 'customer';

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!emailPattern.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include uppercase, lowercase, and a number',
      });
    }

    if (finalRole === 'worker' && !isValidPhone(req.body.workerProfile?.phone)) {
      return res.status(400).json({ message: 'Worker phone number must contain exactly 10 digits' });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: finalRole,
    });

    if (finalRole === 'worker') {
      const workerProfile = req.body.workerProfile || {};
      const equipment = Array.isArray(workerProfile.equipment)
        ? workerProfile.equipment
        : typeof workerProfile.equipment === 'string'
          ? workerProfile.equipment
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          : [];

      const profile = {
        userId: user._id,
        name: name,
        kind: workerProfile.kind === 'Team' ? 'Team' : 'Individual',
        phone: Number(workerProfile.phone || 0),
        teamName: String(workerProfile.teamName || '').trim(),
        teamSize: Number(workerProfile.teamSize || 1),
        serviceArea: String(workerProfile.serviceArea || '').trim(),
        equipment,
        capacity: Number(workerProfile.capacity || 0),
        price: Number(workerProfile.rate || workerProfile.price || 0),
        available: false,
        rating: 0,
        jobs: 0,
        reviews: [],
      };

      await Provider.findOneAndUpdate(
        { userId: user._id },
        { $set: profile },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    return res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: issueToken(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Signup failed', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = sanitizeValue(req.body.email).toLowerCase();
    const password = String(req.body.password || '').trim();

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!emailPattern.test(email)) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const passwordMatches = await verifyPassword(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!isBcryptHash(user.password) && user.password === password) {
      user.password = await bcrypt.hash(password, 12);
      await user.save();
    }

    return res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: issueToken(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

router.get('/profile/:userId', requireAuth, requireOwnership(), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('name email role location address').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ ...user, _id: String(user._id) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
  }
});

router.patch('/profile/:userId', requireAuth, requireOwnership(), async (req, res) => {
  try {
    const name = sanitizeValue(req.body.name);
    const location = sanitizeValue(req.body.location);
    const address = sanitizeValue(req.body.address);
    if (!name || !location || !address) {
      return res.status(400).json({ message: 'Name, location, and address are required' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: { name, location, address } },
      { new: true, runValidators: true },
    ).select('name email role location address').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ ...user, _id: String(user._id) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
});

module.exports = router;
