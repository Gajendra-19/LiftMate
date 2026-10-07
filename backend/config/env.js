module.exports = {
  get PORT() {
    return process.env.PORT || 5000;
  },
  get JWT_SECRET() {
    return process.env.JWT_SECRET;
  },
  get MONGODB_URI() {
    return process.env.MONGODB_URI;
  },
  get MONGODB_DB_NAME() {
    return process.env.MONGODB_DB_NAME || 'liftmate';
  },
  get SEED_MONGODB_DB_NAME() {
    return process.env.MONGODB_DB_NAME || 'LiftMate';
  },
  get CLIENT_ORIGIN() {
    return process.env.CLIENT_ORIGIN || 'http://localhost:4200';
  },
};
