const Alert = require('../models/Alert');
const Notification = require('../models/Notification');
const { validateCoordinates, googleMapsLink } = require('../services/locationService');
const { sendAlertNotifications } = require('../services/notificationService');

exports.trigger = async (req, res, next) => {
  try {
    const coords = validateCoordinates(req.body);
    const active = await Alert.findOne({ user: req.user._id, status: { $in: ['Active', 'Acknowledged'] } }).sort({ createdAt: -1 });
    if (active) return res.status(409).json({ message: 'An active emergency already exists', alert: active });
    const alert = await Alert.create({
      user: req.user._id, userName: req.user.name, ...coords,
      locationLink: googleMapsLink(coords.latitude, coords.longitude), triggerTime: new Date()
    });
    const notifications = await sendAlertNotifications(alert);
    res.status(201).json({ alert, notifications });
  } catch (error) { next(error); }
};

exports.list = async (req, res, next) => {
  try {
    const alerts = await Alert.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
    res.json({ alerts });
  } catch (error) { next(error); }
};

exports.getOne = async (req, res, next) => {
  try {
    const alert = await Alert.findOne({ _id: req.params.id, user: req.user._id });
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    const notifications = await Notification.find({ alert: alert._id }).populate('contact', 'name');
    res.json({ alert, notifications });
  } catch (error) { next(error); }
};

exports.updateLocation = async (req, res, next) => {
  try {
    const coords = validateCoordinates(req.body);
    const alert = await Alert.findOne({ _id: req.params.id, user: req.user._id });
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    if (alert.status === 'Resolved') return res.status(409).json({ message: 'Resolved alerts cannot receive location updates' });
    alert.latitude = coords.latitude; alert.longitude = coords.longitude; alert.accuracy = coords.accuracy;
    alert.locationLink = googleMapsLink(coords.latitude, coords.longitude); alert.lastLocationUpdate = new Date();
    await alert.save();
    res.json({ alert });
  } catch (error) { next(error); }
};

exports.resolve = async (req, res, next) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id, status: { $in: ['Active', 'Acknowledged'] } },
      { $set: { status: 'Resolved', resolutionTime: new Date(), resolvedBy: req.user._id } },
      { new: true, runValidators: true }
    );
    if (alert) return res.json({ alert });

    const existing = await Alert.findOne({ _id: req.params.id, user: req.user._id });
    if (!existing) return res.status(404).json({ message: 'Alert not found' });
    if (existing.status === 'Resolved') return res.json({ alert: existing });
    res.status(409).json({ message: 'Alert could not be resolved; refresh and try again' });
  } catch (error) { next(error); }
};
