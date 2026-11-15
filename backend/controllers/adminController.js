const User = require('../models/User');
const Alert = require('../models/Alert');
const Notification = require('../models/Notification');

exports.dashboard = async (req, res, next) => {
  try {
    const [users, alerts, active, acknowledged, resolved, recent] = await Promise.all([
      User.countDocuments({ role: { $in: ['user', 'police'] } }),
      Alert.countDocuments(),
      Alert.countDocuments({ status: 'Active' }),
      Alert.countDocuments({ status: 'Acknowledged' }),
      Alert.countDocuments({ status: 'Resolved' }),
      Alert.find().sort({ createdAt: -1 }).limit(10).lean()
    ]);
    res.json({ stats: { users, alerts, active, acknowledged, resolved }, recent });
  } catch (error) { next(error); }
};

exports.alerts = async (req, res, next) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 }).limit(200).lean();
    const notificationMap = {};
    const notifications = await Notification.find({ alert: { $in: alerts.map(a => a._id) } }).lean();
    for (const n of notifications) (notificationMap[n.alert] ||= []).push(n);
    res.json({ alerts: alerts.map(a => ({ ...a, notifications: notificationMap[a._id] || [] })) });
  } catch (error) { next(error); }
};

exports.users = async (req, res, next) => {
  try {
    res.json({ users: await User.find().select('-passwordHash').sort({ createdAt: -1 }).limit(500) });
  } catch (error) { next(error); }
};
