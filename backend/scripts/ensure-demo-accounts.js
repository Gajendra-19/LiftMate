const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const env = require('../config/env');
const User = require('../models/User');
const Provider = require('../models/Provider');
const Team = require('../models/Team');

const demoAccounts = [
  {
    email: 'demo.customer@liftmate.test',
    name: 'Demo Customer',
    role: 'customer',
  },
  {
    email: 'demo.individual@liftmate.test',
    name: 'Demo Individual Worker',
    role: 'worker',
    provider: {
      name: 'Demo Individual Worker',
      kind: 'Individual',
      phone: 9000000001,
      serviceArea: 'Central City',
      equipment: ['Lift straps', 'Dolly'],
      capacity: 1000,
      price: 2500,
      available: true,
    },
  },
  {
    email: 'demo.team@liftmate.test',
    name: 'Demo Team Worker',
    role: 'worker',
    provider: {
      name: 'Demo Team Worker',
      kind: 'Team',
      phone: 9000000002,
      teamName: 'LiftMate Demo Team',
      teamSize: 3,
      serviceArea: 'Central City',
      equipment: ['Lift straps', 'Dolly'],
      capacity: 2000,
      price: 3500,
      available: true,
    },
    teamName: 'LiftMate Demo Team',
  },
];

const ensureDemoAccount = async (account) => {
  let user = await User.findOne({ email: account.email });

  if (user && (user.isDemo !== true || user.role !== account.role)) {
    throw new Error(`Refusing to modify an existing non-demo account: ${account.email}`);
  }

  if (!user) {
    const randomPassword = crypto.randomBytes(32).toString('hex');
    user = await User.create({
      name: account.name,
      email: account.email,
      password: await bcrypt.hash(randomPassword, 12),
      role: account.role,
      isDemo: true,
    });
    console.log(`Created demo ${account.role} account.`);
  }

  if (!account.provider) return;

  let provider = await Provider.findOne({ userId: user._id });
  if (provider && provider.kind !== account.provider.kind) {
    throw new Error(`Demo account has an unexpected provider type: ${account.email}`);
  }
  if (!provider) {
    provider = await Provider.create({ ...account.provider, userId: user._id });
  }

  if (account.teamName) {
    const existingTeam = await Team.findOne({ 'members.userId': user._id });
    if (!existingTeam) {
      await Team.create({
        name: account.teamName,
        inviteCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
        creatorId: user._id,
        members: [{ userId: user._id, providerId: provider._id, name: account.name, role: 'Admin' }],
      });
    }
  }
};

const main = async () => {
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is required to create demo accounts.');

  await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB_NAME });
  for (const account of demoAccounts) await ensureDemoAccount(account);
  console.log('Demo accounts are ready.');
};

main()
  .catch((error) => {
    console.error('Could not create demo accounts:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
