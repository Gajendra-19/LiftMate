const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const env = require('./config/env');

dotenv.config({ path: path.join(__dirname, '.env') });

if (!env.JWT_SECRET?.trim()) {
  console.error('JWT_SECRET is required. Set it in backend/.env before starting the server.');
  process.exit(1);
}

const app = require('./app');
const PORT = env.PORT;

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
