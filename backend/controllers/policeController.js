const Alert = require('../models/Alert');
const Notification = require('../models/Notification');

async function getRecentAlerts() {
  const alerts = await Alert.find()
    .sort({ triggerTime: -1 })
    .limit(100)
    .lean();
  const notifications = await Notification.find({ alert: { $in: alerts.map(alert => alert._id) } })
    .select('alert channel status')
    .lean();
  const notificationMap = new Map();
  for (const notification of notifications) {
    const key = String(notification.alert);
    if (!notificationMap.has(key)) notificationMap.set(key, []);
    notificationMap.get(key).push(notification);
  }
  return alerts.map(alert => ({ ...alert, notifications: notificationMap.get(String(alert._id)) || [] }));
}

exports.dashboard = async (req, res, next) => {
  try {
    const [active, acknowledged, resolved, alerts] = await Promise.all([
      Alert.countDocuments({ status: 'Active' }),
      Alert.countDocuments({ status: 'Acknowledged' }),
      Alert.countDocuments({ status: 'Resolved' }),
      getRecentAlerts()
    ]);
    res.json({ stats: { active, acknowledged, resolved }, alerts });
  } catch (error) { next(error); }
};

exports.alerts = async (req, res, next) => {
  try {
    res.json({ alerts: await getRecentAlerts() });
  } catch (error) { next(error); }
};

exports.resolve = async (req, res, next) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ['Active', 'Acknowledged'] } },
      { $set: { status: 'Resolved', resolutionTime: new Date(), resolvedBy: req.user._id } },
      { new: true, runValidators: true }
    );
    if (alert) return res.json({ alert });

    const existing = await Alert.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Alert not found' });
    if (existing.status === 'Resolved') return res.json({ alert: existing });
    res.status(409).json({ message: 'Alert could not be resolved; refresh and try again' });
  } catch (error) { next(error); }
};

exports.acknowledge = async (req, res, next) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, status: 'Active' },
      { $set: { status: 'Acknowledged', acknowledgedBy: req.user._id, acknowledgedAt: new Date() } },
      { new: true, runValidators: true }
    );
    if (alert) return res.json({ alert });

    const existing = await Alert.findOne({ _id: req.params.id, status: { $in: ['Acknowledged', 'Resolved'] } });
    if (!existing) return res.status(404).json({ message: 'Active alert not found' });
    if (existing.status === 'Resolved') return res.status(409).json({ message: 'Resolved alerts cannot be acknowledged' });
    res.json({ alert: existing });
  } catch (error) { next(error); }
};
