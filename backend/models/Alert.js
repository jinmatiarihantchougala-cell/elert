const mongoose = require('mongoose');
const crypto = require('crypto');

const alertSchema = new mongoose.Schema({
  alertId: { type: String, unique: true, required: true, default: () => `SOS-${crypto.randomBytes(4).toString('hex').toUpperCase()}` },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userName: { type: String, required: true },
  triggerTime: { type: Date, required: true, default: Date.now },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  accuracy: { type: Number, min: 0 },
  locationLink: { type: String, required: true },
  status: { type: String, enum: ['Active', 'Acknowledged', 'Resolved'], default: 'Active', index: true },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acknowledgedAt: { type: Date },
  lastLocationUpdate: { type: Date, default: Date.now },
  resolutionTime: { type: Date },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Alert', alertSchema);
