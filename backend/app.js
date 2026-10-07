const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');
const providerRoutes = require('./routes/providerRoutes');
const bookingRoutes = require('./routes/bookingRoutes');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:4200' }));
app.use(express.json({ limit: '100kb' }));

const authRateLimitOptions = { windowMs: 15 * 60 * 1000, limit: 10 };
app.use('/api/auth/login', rateLimit(authRateLimitOptions));
app.use('/api/auth/signup', rateLimit(authRateLimitOptions));

app.use('/api/auth', authRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/bookings', bookingRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'LiftMate backend is running' });
});

module.exports = app;
