const Provider = require('../models/Provider');
const Review = require('../models/Review');
const Team = require('../models/Team');
const User = require('../models/User');
const crypto = require('crypto');
const { isValidPhone, normalizeEquipment } = require('../utils/validation');

const getTeamCreatorId = (team) => String(team.creatorId || team.members[0]?.userId || '');

const normalizeTeam = (team, requestingUserId) => {
  const creatorId = getTeamCreatorId(team);
  const isCreator = creatorId === String(requestingUserId);
  const currentMember = team.members.find(
    (member) => String(member.userId) === String(requestingUserId),
  );
  return {
    id: String(team._id),
    name: team.name,
    inviteCode: isCreator ? team.inviteCode : null,
    isCreator,
    canManageMembers: isCreator || currentMember?.role === 'Admin',
    members: team.members.map((member) => ({
      userId: String(member.userId),
      providerId: String(member.providerId),
      name: member.name,
      role: String(member.userId) === creatorId ? 'Admin' : member.role || 'Member',
      joinedAt: member.joinedAt,
    })),
  };
};

const canManageTeam = (team, userId) =>
  getTeamCreatorId(team) === String(userId) ||
  team.members.some(
    (member) => String(member.userId) === String(userId) && member.role === 'Admin',
  );

const getMyTeam = async (req, res) => {
  try {
    const team = await Team.findOne({ 'members.userId': req.auth.userId }).lean();
    return res.json(team ? normalizeTeam(team, req.auth.userId) : null);
  } catch (error) {
    console.error('Failed to load worker team:', error);
    return res.status(500).json({ message: 'Failed to load worker team' });
  }
};

const createTeam = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ message: 'Team name must be between 2 and 60 characters' });
    }

    const userId = req.auth.userId;
    const provider = await Provider.findOne({ userId }).select('_id name').lean();
    if (!provider) return res.status(404).json({ message: 'Worker profile not found' });

    const existingTeam = await Team.findOne({ 'members.userId': userId }).select('_id').lean();
    if (existingTeam) return res.status(409).json({ message: 'You are already part of a team' });

    const member = { userId, providerId: provider._id, name: provider.name, role: 'Admin' };
    let team;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      try {
        team = await Team.create({ name, inviteCode, creatorId: userId, members: [member] });
        break;
      } catch (error) {
        if (error.code === 11000 && error.keyPattern?.inviteCode && attempt < 2) continue;
        if (error.code === 11000 && error.keyPattern?.['members.userId']) {
          return res.status(409).json({ message: 'You are already part of a team' });
        }
        throw error;
      }
    }

    if (!team) {
      return res.status(503).json({ message: 'Could not generate a team invite code. Please try again' });
    }

    return res.status(201).json(normalizeTeam(team, userId));
  } catch (error) {
    console.error('Failed to create worker team:', error);
    return res.status(500).json({ message: 'Failed to create worker team' });
  }
};

const joinTeam = async (req, res) => {
  try {
    const inviteCode = String(req.body?.inviteCode || '').trim().toUpperCase();
    if (!/^[A-F0-9]{8}$/.test(inviteCode)) {
      return res.status(400).json({ message: 'Enter a valid 8-character team invite code' });
    }

    const userId = req.auth.userId;
    const provider = await Provider.findOne({ userId }).select('_id name').lean();
    if (!provider) return res.status(404).json({ message: 'Worker profile not found' });

    const existingTeam = await Team.findOne({ 'members.userId': userId }).select('_id').lean();
    if (existingTeam) return res.status(409).json({ message: 'You are already part of a team' });

    const updatedTeam = await Team.findOneAndUpdate(
      {
        inviteCode,
        'members.userId': { $ne: userId },
        'members.4': { $exists: false },
      },
      {
        $push: {
          members: { userId, providerId: provider._id, name: provider.name, joinedAt: new Date() },
        },
      },
      { new: true },
    ).lean();

    if (updatedTeam) return res.json(normalizeTeam(updatedTeam, userId));

    const team = await Team.findOne({ inviteCode }).select('_id').lean();
    if (!team) return res.status(404).json({ message: 'Team invite code not found' });
    return res.status(409).json({ message: 'This team is full or you already belong to it' });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.['members.userId']) {
      return res.status(409).json({ message: 'You are already part of a team' });
    }
    console.error('Failed to join worker team:', error);
    return res.status(500).json({ message: 'Failed to join worker team' });
  }
};

const leaveTeam = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const team = await Team.findOne({ 'members.userId': userId });
    if (!team) return res.status(404).json({ message: 'You are not part of a team' });

    if (getTeamCreatorId(team) === String(userId) && team.members.length > 1) {
      const nextCreator = team.members
        .filter((member) => String(member.userId) !== String(userId))
        .sort((left, right) => left.joinedAt - right.joinedAt)[0];
      team.creatorId = nextCreator.userId;
      nextCreator.role = 'Admin';
    }
    team.members = team.members.filter((member) => String(member.userId) !== String(userId));
    if (team.members.length === 0) {
      await Team.deleteOne({ _id: team._id });
      return res.json({ message: 'Team closed' });
    }

    await team.save();
    return res.json(normalizeTeam(team, userId));
  } catch (error) {
    console.error('Failed to leave worker team:', error);
    return res.status(500).json({ message: 'Failed to leave worker team' });
  }
};

const updateTeamMemberRole = async (req, res) => {
  try {
    const role = req.body?.role;
    if (role !== 'Admin' && role !== 'Member') {
      return res.status(400).json({ message: 'Role must be Admin or Member' });
    }

    const userId = String(req.auth.userId);
    const team = await Team.findOne({ 'members.userId': userId });
    if (!team) return res.status(404).json({ message: 'You are not part of a team' });
    if (!canManageTeam(team, userId)) {
      return res.status(403).json({ message: 'Only a team admin can manage members' });
    }

    const creatorId = getTeamCreatorId(team);
    const target = team.members.find(
      (member) => String(member.userId) === String(req.params.userId),
    );
    if (!target) return res.status(404).json({ message: 'Team member not found' });
    if (String(target.userId) === creatorId) {
      return res.status(400).json({ message: 'The team creator must remain an admin' });
    }

    target.role = role;
    await team.save();
    return res.json(normalizeTeam(team, userId));
  } catch (error) {
    console.error('Failed to update team member role:', error);
    return res.status(500).json({ message: 'Failed to update team member role' });
  }
};

const removeTeamMember = async (req, res) => {
  try {
    const userId = String(req.auth.userId);
    const team = await Team.findOne({ 'members.userId': userId });
    if (!team) return res.status(404).json({ message: 'You are not part of a team' });
    if (!canManageTeam(team, userId)) {
      return res.status(403).json({ message: 'Only a team admin can manage members' });
    }

    if (String(req.params.userId) === getTeamCreatorId(team)) {
      return res.status(400).json({ message: 'The team creator cannot be removed' });
    }
    const originalLength = team.members.length;
    team.members = team.members.filter(
      (member) => String(member.userId) !== String(req.params.userId),
    );
    if (team.members.length === originalLength) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    await team.save();
    return res.json(normalizeTeam(team, userId));
  } catch (error) {
    console.error('Failed to remove team member:', error);
    return res.status(500).json({ message: 'Failed to remove team member' });
  }
};

const getProviders = async (req, res) => {
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
};

const getProfile = async (req, res) => {
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
};

const saveProfile = async (req, res) => {
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
};

const updateAvailability = async (req, res) => {
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
};

const updateSettings = async (req, res) => {
  try {
    const profile = req.body || {};
    const name = typeof profile.name === 'string' ? profile.name.trim() : '';
    const equipment = Array.isArray(profile.equipment)
      ? profile.equipment
      : String(profile.equipment || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);

    if (!String(profile.serviceArea || '').trim() || !equipment.length) {
      return res.status(400).json({ message: 'Service area and equipment are required' });
    }
    if (profile.name !== undefined && (name.length < 2 || name.length > 80)) {
      return res.status(400).json({ message: 'Name must be between 2 and 80 characters' });
    }

    const updates = {
      serviceArea: String(profile.serviceArea).trim(),
      equipment,
      capacity: Number(profile.capacity || 0),
      price: Number(profile.price || profile.rate || 0),
    };
    if (profile.name !== undefined) updates.name = name;

    const provider = await Provider.findOneAndUpdate(
      { userId: req.params.userId },
      { $set: updates },
      { new: true },
    ).lean();

    if (!provider) return res.status(404).json({ message: 'Worker profile not found' });
    if (profile.name !== undefined) {
      await User.findByIdAndUpdate(req.params.userId, { $set: { name } });
      await Team.updateOne(
        { 'members.userId': req.params.userId },
        { $set: { 'members.$.name': name } },
      );
    }
    return res.json({ ...provider, id: String(provider._id), equipment });
  } catch (error) {
    console.error('Failed to update worker settings:', error);
    return res.status(500).json({ message: 'Failed to update worker settings' });
  }
};

const getReviews = async (req, res) => {
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
};

module.exports = {
  getProviders,
  getProfile,
  saveProfile,
  updateAvailability,
  updateSettings,
  getReviews,
  getMyTeam,
  createTeam,
  joinTeam,
  leaveTeam,
  updateTeamMemberRole,
  removeTeamMember,
};
