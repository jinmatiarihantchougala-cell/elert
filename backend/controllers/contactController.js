const bcrypt = require('bcryptjs');
const Contact = require('../models/Contact');
const { sendContactVerification, prepareContactVerification } = require('../services/notificationService');

const verificationFields = channel => {
  const field = channel === 'email' ? 'email' : 'phone';
  return {
    verified: `${field}Verified`,
    hash: `${field}VerificationCodeHash`,
    expires: `${field}VerificationExpiresAt`,
    attempts: `${field}VerificationAttempts`,
    lastSent: `${field}VerificationLastSentAt`
  };
};

async function sendVerification(contact, user, channel) {
  const prepared = await prepareContactVerification(contact, channel);
  await contact.save();
  const result = await sendContactVerification(contact, user, channel, prepared.code);
  if (result.status !== 'sent') {
    contact[prepared.hashField] = undefined;
    contact[prepared.expiresField] = undefined;
    contact[prepared.attemptsField] = 0;
    contact[prepared.lastSentField] = undefined;
  }
  return { channel, status: result.status, error: result.error };
}

exports.list = async (req, res, next) => {
  try {
    const contacts = await Contact.find({ user: req.user._id })
      .select('+emailVerificationExpiresAt +phoneVerificationExpiresAt')
      .sort({ createdAt: -1 });
    res.json({
      contacts: contacts.map(contact => ({
        ...contact.toObject(),
        emailVerificationPending: Boolean(contact.emailVerificationExpiresAt && contact.emailVerificationExpiresAt > new Date()),
        phoneVerificationPending: Boolean(contact.phoneVerificationExpiresAt && contact.phoneVerificationExpiresAt > new Date())
      }))
    });
  }
  catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, phone, email, relationship } = req.body;
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanName || (!cleanPhone && !cleanEmail)) return res.status(400).json({ message: 'Name and at least one contact method are required' });
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ message: 'Enter a valid email address' });
    if (cleanPhone && cleanPhone.replace(/\D/g, '').length < 7) return res.status(400).json({ message: 'Enter a valid phone number' });
    const contact = await Contact.create({
      user: req.user._id,
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      relationship: typeof relationship === 'string' ? relationship.trim() : '',
      verified: false,
      emailVerified: false,
      phoneVerified: false
    });

    const verifications = [];
    if (contact.email) verifications.push(await sendVerification(contact, req.user, 'email'));
    if (contact.phone) verifications.push(await sendVerification(contact, req.user, 'sms'));
    await contact.save();
    res.status(201).json({ contact, verifications });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const contact = await Contact.findOne({ _id: req.params.id, user: req.user._id });
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    const changedChannels = [];
    if (req.body.name !== undefined) contact.name = String(req.body.name).trim();
    if (req.body.relationship !== undefined) contact.relationship = String(req.body.relationship).trim();
    if (req.body.email !== undefined) {
      if (typeof req.body.email !== 'string') return res.status(400).json({ message: 'Email must be text' });
      const email = String(req.body.email).trim().toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address' });
      if (email !== (contact.email || '')) {
        contact.email = email;
        contact.emailVerified = false;
        contact.emailVerificationCodeHash = undefined;
        contact.emailVerificationExpiresAt = undefined;
        contact.emailVerificationAttempts = 0;
        contact.emailVerificationLastSentAt = undefined;
        if (email) changedChannels.push('email');
      }
    }
    if (req.body.phone !== undefined) {
      if (typeof req.body.phone !== 'string') return res.status(400).json({ message: 'Phone number must be text' });
      const phone = String(req.body.phone).trim();
      if (phone && phone.replace(/\D/g, '').length < 7) return res.status(400).json({ message: 'Enter a valid phone number' });
      if (phone !== (contact.phone || '')) {
        contact.phone = phone;
        contact.phoneVerified = false;
        contact.phoneVerificationCodeHash = undefined;
        contact.phoneVerificationExpiresAt = undefined;
        contact.phoneVerificationAttempts = 0;
        contact.phoneVerificationLastSentAt = undefined;
        if (phone) changedChannels.push('sms');
      }
    }
    if (!contact.phone && !contact.email) return res.status(400).json({ message: 'At least a phone number or email is required' });
    contact.verified = contact.emailVerified || contact.phoneVerified;

    const verifications = [];
    for (const channel of changedChannels) verifications.push(await sendVerification(contact, req.user, channel));
    await contact.save();
    res.json({ contact, verifications });
  } catch (error) { next(error); }
};

exports.sendVerification = async (req, res, next) => {
  try {
    const { channel } = req.body;
    if (!['email', 'sms'].includes(channel)) return res.status(400).json({ message: 'Channel must be email or sms' });
    const contact = await Contact.findOne({ _id: req.params.id, user: req.user._id })
      .select('+emailVerificationCodeHash +phoneVerificationCodeHash +emailVerificationLastSentAt +phoneVerificationLastSentAt');
    if (!contact) return res.status(404).json({ message: 'Contact not found' });
    const fields = verificationFields(channel);
    if (!contact[channel === 'email' ? 'email' : 'phone']) return res.status(400).json({ message: `No ${channel} address is saved for this contact` });
    if (contact[fields.verified]) return res.status(409).json({ message: `${channel} is already verified` });
    if (contact[fields.lastSent] && Date.now() - contact[fields.lastSent].getTime() < 60_000) {
      return res.status(429).json({ message: 'Wait one minute before requesting another verification code' });
    }

    const result = await sendVerification(contact, req.user, channel);
    await contact.save();
    if (result.status !== 'sent') return res.status(503).json({ message: result.error || 'Verification message could not be sent' });
    res.json({ message: `Verification code sent by ${channel}` });
  } catch (error) { next(error); }
};

exports.verify = async (req, res, next) => {
  try {
    const { channel, code } = req.body;
    if (!['email', 'sms'].includes(channel)) return res.status(400).json({ message: 'Channel must be email or sms' });
    if (!/^\d{6}$/.test(String(code || ''))) return res.status(400).json({ message: 'Enter the six-digit verification code' });
    const contact = await Contact.findOne({ _id: req.params.id, user: req.user._id })
      .select('+emailVerificationCodeHash +phoneVerificationCodeHash +emailVerificationExpiresAt +phoneVerificationExpiresAt +emailVerificationAttempts +phoneVerificationAttempts');
    if (!contact) return res.status(404).json({ message: 'Contact not found' });
    const fields = verificationFields(channel);
    if (contact[fields.verified]) return res.json({ contact });
    if (!contact[fields.hash] || !contact[fields.expires]) {
      return res.status(400).json({ message: 'Request a verification code first' });
    }
    if (contact[fields.expires].getTime() < Date.now()) {
      contact[fields.hash] = undefined;
      contact[fields.expires] = undefined;
      contact[fields.attempts] = 0;
      await contact.save();
      return res.status(400).json({ message: 'Verification code expired; request a new one' });
    }

    contact[fields.attempts] = (contact[fields.attempts] || 0) + 1;
    if (!(await bcrypt.compare(String(code), contact[fields.hash]))) {
      if (contact[fields.attempts] >= 5) {
        contact[fields.hash] = undefined;
        contact[fields.expires] = undefined;
        contact[fields.attempts] = 0;
        await contact.save();
        return res.status(429).json({ message: 'Too many incorrect codes; request a new one' });
      }
      await contact.save();
      return res.status(400).json({ message: 'Incorrect verification code' });
    }

    contact[fields.verified] = true;
    contact[fields.hash] = undefined;
    contact[fields.expires] = undefined;
    contact[fields.attempts] = 0;
    contact.verified = contact.emailVerified || contact.phoneVerified;
    await contact.save();
    res.json({ contact });
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    const contact = await Contact.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!contact) return res.status(404).json({ message: 'Contact not found' });
    res.json({ message: 'Contact deleted' });
  } catch (error) { next(error); }
};
