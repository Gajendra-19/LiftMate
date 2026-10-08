const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const env = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const providerRoutes = require('./routes/providerRoutes');
const bookingRoutes = require('./routes/bookingRoutes');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use('/api/bookings/create', express.json({ limit: '15mb' }));
app.use(express.json({ limit: '100kb' }));

const loginRateLimitOptions = { windowMs: 5 * 60 * 1000, limit: 10 };
const signupRateLimitOptions = { windowMs: 15 * 60 * 1000, limit: 10 };
app.use('/api/auth/login', rateLimit(loginRateLimitOptions));
app.use('/api/auth/demo-login', rateLimit(loginRateLimitOptions));
app.use('/api/auth/signup', rateLimit(signupRateLimitOptions));

app.use('/api/auth', authRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/bookings', bookingRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'LiftMate backend is running' });
});

module.exports = app;
