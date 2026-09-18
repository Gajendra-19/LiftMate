const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const User = require('../models/User');

const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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

router.post('/signup', async (req, res) => {
  try {
    const name = sanitizeValue(req.body.name);
    const email = sanitizeValue(req.body.email).toLowerCase();
    const password = String(req.body.password || '').trim();

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

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'customer',
    });

    return res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
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
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

module.exports = router;
