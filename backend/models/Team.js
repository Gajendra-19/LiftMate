const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['Admin', 'Member'], default: 'Member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    inviteCode: { type: String, required: true, unique: true, uppercase: true },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    members: {
      type: [teamMemberSchema],
      validate: {
        validator: (members) => members.length >= 1 && members.length <= 5,
        message: 'A team must have between 1 and 5 members',
      },
    },
  },
  { timestamps: true },
);

teamSchema.index({ 'members.userId': 1 }, { unique: true });

module.exports = mongoose.model('Team', teamSchema, 'teams');
