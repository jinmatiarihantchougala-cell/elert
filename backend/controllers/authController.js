const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, phone, accountType = 'user' } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    if (!['user', 'police'].includes(accountType)) return res.status(400).json({ message: 'Invalid account type' });
    const role = accountType === 'police' ? 'police' : 'user';
    const normalizedEmail = String(email).toLowerCase().trim();
    if (await User.findOne({ email: normalizedEmail })) return res.status(409).json({ message: 'An account already exists with this email' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name: String(name).trim(), email: normalizedEmail, phone: phone ? String(phone).trim() : '', passwordHash, role });
    res.status(201).json({ token: signToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) { next(error); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password, accountType } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
    if (accountType !== undefined && !['user', 'police', 'admin'].includes(accountType)) return res.status(400).json({ message: 'Invalid account type' });
    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ message: 'Invalid email or password' });
    if (accountType && user.role !== accountType) return res.status(403).json({ message: `This account is registered as ${user.role}` });
    if (!user.isActive) return res.status(403).json({ message: 'This account has been disabled' });
    res.json({ token: signToken(user), user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, discreetMode: user.discreetMode } });
  } catch (error) { next(error); }
};

exports.me = async (req, res) => {
  res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, phone: req.user.phone, role: req.user.role, discreetMode: req.user.discreetMode } });
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, discreetMode, password } = req.body;
    if (name !== undefined) req.user.name = String(name).trim();
    if (phone !== undefined) req.user.phone = String(phone).trim();
    if (discreetMode !== undefined) req.user.discreetMode = Boolean(discreetMode);
    if (password) {
      if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
      req.user.passwordHash = await bcrypt.hash(password, 12);
    }
    await req.user.save();
    res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, phone: req.user.phone, role: req.user.role, discreetMode: req.user.discreetMode } });
  } catch (error) { next(error); }
};
