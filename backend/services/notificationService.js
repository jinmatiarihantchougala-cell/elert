const nodemailer = require('nodemailer');
const Notification = require('../models/Notification');
const Contact = require('../models/Contact');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

function createMailTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

function buildAlertMessage(alert) {
  return [
    `EMERGENCY: ${alert.userName} needs help and activated Silent SOS.`,
    `Time: ${alert.triggerTime.toISOString()}`,
    `Last known location: ${alert.locationLink}`,
    'Please contact them and call local emergency services if needed.',
    `Alert ID: ${alert.alertId}`
  ].join('\n');
}

async function sendAlertNotifications(alert) {
  const contacts = await Contact.find({ user: alert.user, verified: true });
  const isDev = (process.env.NOTIFICATION_MODE || 'dev') !== 'production';
  const alertMessage = buildAlertMessage(alert);
  const mailer = createMailTransport();
  let twilioClient = null;
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }

  const records = [];
  for (const contact of contacts) {
    const legacyVerified = contact.verified && !contact.emailVerified && !contact.phoneVerified;
    const emailVerified = contact.emailVerified || legacyVerified;
    const phoneVerified = contact.phoneVerified || legacyVerified;
    if (contact.email && emailVerified && mailer && !isDev) {
      const record = await Notification.create({ alert: alert._id, contact: contact._id, channel: 'email', destination: contact.email, status: 'pending' });
      try {
        const info = await mailer.sendMail({
          from: process.env.NOTIFICATION_FROM || process.env.SMTP_USER,
          to: contact.email,
          subject: `Silent SOS emergency alert ${alert.alertId}`,
          text: alertMessage
        });
        record.status = 'sent'; record.providerId = info.messageId; await record.save();
      } catch (error) {
        record.status = 'failed'; record.error = error.message; await record.save();
      }
      records.push(record);
    } else if (contact.email && emailVerified) {
      records.push(await Notification.create({
        alert: alert._id, contact: contact._id, channel: 'email', destination: contact.email,
        status: 'failed', error: isDev ? 'Development mode: real email provider not enabled' : 'SMTP is not configured'
      }));
    }

    if (contact.phone && phoneVerified && twilioClient && process.env.TWILIO_FROM_NUMBER && !isDev) {
      const record = await Notification.create({ alert: alert._id, contact: contact._id, channel: 'sms', destination: contact.phone, status: 'pending' });
      try {
        const message = await twilioClient.messages.create({
          from: process.env.TWILIO_FROM_NUMBER,
          to: contact.phone,
          body: alertMessage
        });
        record.status = 'sent'; record.providerId = message.sid; await record.save();
      } catch (error) {
        record.status = 'failed'; record.error = error.message; await record.save();
      }
      records.push(record);
    } else if (contact.phone && phoneVerified) {
      records.push(await Notification.create({
        alert: alert._id, contact: contact._id, channel: 'sms', destination: contact.phone,
        status: 'failed', error: isDev ? 'Development mode: real SMS provider not enabled' : 'Twilio is not configured'
      }));
    }
  }
  return records;
}

async function sendContactVerification(contact, user, channel, code) {
  const isDev = (process.env.NOTIFICATION_MODE || 'dev') !== 'production';
  if (isDev) return { channel, status: 'failed', error: 'Development mode: real email/SMS provider not enabled' };

  if (channel === 'email') {
    const mailer = createMailTransport();
    if (!mailer) return { channel, status: 'failed', error: 'SMTP is not configured' };
    try {
      const info = await mailer.sendMail({
        from: process.env.NOTIFICATION_FROM || process.env.SMTP_USER,
        to: contact.email,
        subject: 'Verify your Silent SOS emergency contact email',
        text: `${user.name} added this address as an emergency contact in Silent SOS. Your verification code is ${code}. It expires in 10 minutes. If you did not expect this message, you can ignore it.`
      });
      return { channel, status: 'sent', providerId: info.messageId };
    } catch (error) {
      return { channel, status: 'failed', error: error.message };
    }
  }

  if (channel === 'sms') {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER) {
      return { channel, status: 'failed', error: 'Twilio is not fully configured' };
    }
    try {
      const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const message = await twilioClient.messages.create({
        from: process.env.TWILIO_FROM_NUMBER,
        to: contact.phone,
        body: `${user.name} added this number as a Silent SOS emergency contact. Verification code: ${code}. Expires in 10 minutes. If unexpected, ignore this message.`
      });
      return { channel, status: 'sent', providerId: message.sid };
    } catch (error) {
      return { channel, status: 'failed', error: error.message };
    }
  }

  throw new Error('Unsupported contact verification channel');
}

function createVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

async function prepareContactVerification(contact, channel) {
  const code = createVerificationCode();
  const field = channel === 'email' ? 'email' : 'phone';
  const hashField = `${field}VerificationCodeHash`;
  const expiresField = `${field}VerificationExpiresAt`;
  const attemptsField = `${field}VerificationAttempts`;
  const lastSentField = `${field}VerificationLastSentAt`;

  contact[hashField] = await bcrypt.hash(code, 10);
  contact[expiresField] = new Date(Date.now() + 10 * 60 * 1000);
  contact[attemptsField] = 0;
  contact[lastSentField] = new Date();
  return { code, hashField, expiresField, attemptsField, lastSentField };
}

module.exports = { sendAlertNotifications, sendContactVerification, prepareContactVerification, buildAlertMessage };
