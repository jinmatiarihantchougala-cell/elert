require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

(async () => {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Usage: node scripts/seedAdmin.js "Admin Name" admin@example.com StrongPassword123');
    process.exit(1);
  }
  await connectDB();
  const normalized = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalized });
  if (existing) {
    existing.role = 'admin';
    await existing.save();
    console.log(`Updated existing account as admin: ${normalized}`);
  } else {
    await User.create({ name, email: normalized, passwordHash: await bcrypt.hash(password, 12), role: 'admin' });
    console.log(`Created admin account: ${normalized}`);
  }
  process.exit(0);
})().catch(error => { console.error(error.message); process.exit(1); });
