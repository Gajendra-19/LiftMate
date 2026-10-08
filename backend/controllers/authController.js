const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Provider = require('../models/Provider');
const { getSecret } = require('../middleware/auth');
const { isValidPhone, sanitizeValue, validatePassword } = require('../utils/validation');

const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const verifyPassword = async (inputPassword, storedPassword) => {
  if (!inputPassword || !storedPassword) return false;
  return bcrypt.compare(inputPassword, storedPassword);
};

const issueToken = (user) => jwt.sign(
  { userId: String(user._id), role: user.role },
  getSecret(),
  { expiresIn: '7d' },
);

const signup = async (req, res) => {
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
    console.error('Signup failed:', error);
    return res.status(500).json({ message: 'Signup failed' });
  }
};

const login = async (req, res) => {
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

    return res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: issueToken(user),
    });
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({ message: 'Login failed' });
  }
};

const demoLogin = async (req, res) => {
  const demoEmails = {
    customer: 'demo.customer@liftmate.test',
    'individual-worker': 'demo.individual@liftmate.test',
    'team-worker': 'demo.team@liftmate.test',
  };
  const role = req.body?.role;
  const email = typeof role === 'string' && Object.hasOwn(demoEmails, role) ? demoEmails[role] : null;
  if (!email) return res.status(400).json({ message: 'Invalid demo account role' });

  try {
    const user = await User.findOne({ email });
    const expectedRole = role === 'customer' ? 'customer' : 'worker';
    if (!user || user.isDemo !== true || user.role !== expectedRole) {
      return res.status(404).json({ message: 'Demo account is not configured' });
    }

    if (role !== 'customer') {
      const provider = await Provider.findOne({ userId: user._id }).select('_id kind').lean();
      const expectedKind = role === 'team-worker' ? 'Team' : 'Individual';
      if (!provider || provider.kind !== expectedKind) {
        return res.status(404).json({ message: 'Demo account is not configured' });
      }
    }

    return res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: issueToken(user),
    });
  } catch (error) {
    console.error('Demo login failed:', error);
    return res.status(500).json({ message: 'Demo login failed' });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('name email role location address').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ ...user, _id: String(user._id) });
  } catch (error) {
    console.error('Failed to fetch profile:', error);
    return res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

const updateProfile = async (req, res) => {
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
    console.error('Failed to update profile:', error);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
};

module.exports = { signup, login, demoLogin, getProfile, updateProfile };
