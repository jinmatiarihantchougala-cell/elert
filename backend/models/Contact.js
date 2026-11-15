const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, trim: true, maxlength: 30 },
  email: { type: String, lowercase: true, trim: true },
  relationship: { type: String, trim: true, maxlength: 50 },
  verified: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  emailVerificationCodeHash: { type: String, select: false },
  emailVerificationExpiresAt: { type: Date, select: false },
  emailVerificationAttempts: { type: Number, default: 0, select: false },
  emailVerificationLastSentAt: { type: Date, select: false },
  phoneVerificationCodeHash: { type: String, select: false },
  phoneVerificationExpiresAt: { type: Date, select: false },
  phoneVerificationAttempts: { type: Number, default: 0, select: false },
  phoneVerificationLastSentAt: { type: Date, select: false }
}, { timestamps: true });

contactSchema.pre('validate', function (next) {
  if (!this.phone && !this.email) next(new Error('At least a phone number or email is required'));
  else next();
});

module.exports = mongoose.model('Contact', contactSchema);
