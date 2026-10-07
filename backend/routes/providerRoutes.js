const express = require('express');
const router = express.Router();
const Provider = require('../models/Provider');
const Review = require('../models/Review');
const User = require('../models/User');
const { requireAuth, requireRole, requireOwnership } = require('../middleware/auth');
const { isValidPhone, normalizeEquipment } = require('../utils/validation');

router.get('/', async (req, res) => {
  try {
    const providers = await Provider.find({}).lean();
    res.json(
      providers.map((provider) => ({
        id: String(provider._id),
        name: provider.name,
        kind: provider.kind,
        avatar: provider.avatar,
        rating: provider.rating,
        jobs: provider.jobs,
        capacity: provider.capacity,
        distance: provider.distance,
        available: provider.available,
        price: provider.price,
        teamSize: provider.teamSize,
        equipment: Array.isArray(provider.equipment) ? provider.equipment : [],
        serviceArea: provider.serviceArea,
        reviews: Array.isArray(provider.reviews) ? provider.reviews : [],
      })),
    );
  } catch (error) {
    console.error('Failed to fetch providers:', error);
    res.status(500).json({ message: 'Failed to fetch providers' });
  }
});

router.get('/profile/:userId', requireAuth, requireRole('worker'), requireOwnership(), async (req, res) => {
  try {
    const provider = await Provider.findOne({ userId: req.params.userId }).lean();

    if (!provider) {
      return res.status(404).json({ message: 'Worker profile not found' });
    }

    const reviewRows = await Review.find({ providerId: provider._id }).select('rating').lean();
    const ratingTotal = reviewRows.reduce((total, review) => total + Number(review.rating || 0), 0);
    provider.rating = reviewRows.length ? ratingTotal / reviewRows.length : 0;

    return res.json({
      ...provider,
      id: provider._id ? String(provider._id) : provider.id,
      userId: provider.userId ? String(provider.userId) : null,
      equipment: Array.isArray(provider.equipment) ? provider.equipment : [],
      teamMembers: Array.isArray(provider.teamMembers) ? provider.teamMembers : [],
    });
  } catch (error) {
    console.error('Failed to fetch worker profile:', error);
    return res.status(500).json({ message: 'Failed to fetch worker profile' });
  }
});

router.post('/profile', requireAuth, requireRole('worker'), async (req, res) => {
  try {
    const userId = String(req.auth.userId);
    const profile = req.body.profile || req.body;

    if (!userId || !profile.name) {
      return res.status(400).json({ message: 'Worker profile details are required' });
    }

    if (!isValidPhone(profile.phone)) {
      return res.status(400).json({ message: 'Worker phone number must contain exactly 10 digits' });
    }

    const payload = {
      name: String(profile.name || '').trim(),
      kind: profile.kind === 'Team' ? 'Team' : 'Individual',
      phone: Number(profile.phone || 0),
      teamName: String(profile.teamName || '').trim(),
      teamSize: Number(profile.teamSize || 1),
      serviceArea: String(profile.serviceArea || '').trim(),
      equipment: normalizeEquipment(profile.equipment),
      capacity: Number(profile.capacity || 0),
      price: Number(profile.rate || profile.price || 0),
      available: true,
    };

    const saved = await Provider.findOneAndUpdate(
      { userId },
      {
        $set: payload,
        $setOnInsert: { userId, rating: 0, jobs: 0, reviews: [] },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await User.findByIdAndUpdate(userId, { $set: { role: 'worker' } });

    return res.status(201).json({
      ...saved.toObject(),
      id: String(saved._id),
      userId: String(saved.userId),
      equipment: Array.isArray(saved.equipment) ? saved.equipment : [],
    });
  } catch (error) {
    console.error('Failed to save worker profile:', error);
    return res.status(500).json({ message: 'Failed to save worker profile' });
  }
});

router.patch('/profile/:userId/availability', requireAuth, requireRole('worker'), requireOwnership(), async (req, res) => {
  try {
    const available = req.body.available === true || req.body.available === 'true';
    const provider = await Provider.findOneAndUpdate(
      { userId: req.params.userId },
      { $set: { available } },
      { new: true },
    ).lean();

    if (!provider) return res.status(404).json({ message: 'Worker profile not found' });
    return res.json({ available: provider.available });
  } catch (error) {
    console.error('Failed to update availability:', error);
    return res.status(500).json({ message: 'Failed to update availability' });
  }
});

router.patch('/profile/:userId/settings', requireAuth, requireRole('worker'), requireOwnership(), async (req, res) => {
  try {
    const profile = req.body || {};
    const equipment = Array.isArray(profile.equipment)
      ? profile.equipment
      : String(profile.equipment || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);

    if (!String(profile.serviceArea || '').trim() || !equipment.length) {
      return res.status(400).json({ message: 'Service area and equipment are required' });
    }

    const provider = await Provider.findOneAndUpdate(
      { userId: req.params.userId },
      {
        $set: {
          serviceArea: String(profile.serviceArea).trim(),
          equipment,
          capacity: Number(profile.capacity || 0),
          price: Number(profile.price || profile.rate || 0),
        },
      },
      { new: true },
    ).lean();

    if (!provider) return res.status(404).json({ message: 'Worker profile not found' });
    return res.json({ ...provider, id: String(provider._id), equipment });
  } catch (error) {
    console.error('Failed to update worker settings:', error);
    return res.status(500).json({ message: 'Failed to update worker settings' });
  }
});

router.get('/profile/:userId/reviews', requireAuth, requireRole('worker'), requireOwnership(), async (req, res) => {
  try {
    const provider = await Provider.findOne({ userId: req.params.userId }).select('_id').lean();
    if (!provider) return res.status(404).json({ message: 'Worker profile not found' });

    const reviews = await Review.find({ providerId: provider._id })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    return res.json(
      reviews.map((review) => ({
        id: String(review._id),
        rating: review.rating,
        reviewText: review.reviewText,
        customerName: review.userId?.name || 'Customer',
        createdAt: review.createdAt,
      })),
    );
  } catch (error) {
    console.error('Failed to fetch worker reviews:', error);
    return res.status(500).json({ message: 'Failed to fetch worker reviews' });
  }
});

module.exports = router;
