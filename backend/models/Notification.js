const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  alert: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert', required: true, index: true },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
  channel: { type: String, enum: ['email', 'sms'], required: true },
  destination: { type: String, required: true },
  status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  providerId: { type: String },
  error: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
