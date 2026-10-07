const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const providerRoutes = require('./routes/providerRoutes');
const bookingRoutes = require('./routes/bookingRoutes');

dotenv.config({ path: path.join(__dirname, '.env') });

if (!process.env.JWT_SECRET?.trim()) {
  console.error('JWT_SECRET is required. Set it in backend/.env before starting the server.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

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

connectDB();

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use. LiftMate backend is already running.`);
    process.exit(0);
  }

  throw error;
});
