const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { prepareContactVerification, sendContactVerification, buildAlertMessage } = require('../services/notificationService');

test('builds an emergency message with a clear request for help and the map location', () => {
  const message = buildAlertMessage({
    userName: 'Alex',
    triggerTime: new Date('2026-11-14T07:00:00.000Z'),
    locationLink: 'https://www.google.com/maps?q=12.3450000,67.8900000',
    alertId: 'SOS-123'
  });

  assert.match(message, /EMERGENCY: Alex needs help and activated Silent SOS/);
  assert.match(message, /Last known location: https:\/\/www\.google\.com\/maps\?q=12\.3450000,67\.8900000/);
  assert.match(message, /Please contact them and call local emergency services if needed/);
  assert.match(message, /Alert ID: SOS-123/);
});

test('prepares a six-digit contact code as a hash with a ten-minute expiry', async () => {
  const contact = {};
  const before = Date.now();
  const result = await prepareContactVerification(contact, 'email');

  assert.match(result.code, /^\d{6}$/);
  assert.notEqual(contact.emailVerificationCodeHash, result.code);
  assert.equal(await bcrypt.compare(result.code, contact.emailVerificationCodeHash), true);
  assert.ok(contact.emailVerificationExpiresAt.getTime() >= before + 9 * 60 * 1000);
  assert.ok(contact.emailVerificationExpiresAt.getTime() <= before + 11 * 60 * 1000);
  assert.equal(contact.emailVerificationAttempts, 0);
});

test('development mode reports verification as failed instead of claiming delivery', async () => {
  const originalMode = process.env.NOTIFICATION_MODE;
  process.env.NOTIFICATION_MODE = 'dev';
  try {
    const result = await sendContactVerification(
      { email: 'contact@example.test' },
      { name: 'Test User' },
      'email',
      '123456'
    );
    assert.equal(result.status, 'failed');
    assert.match(result.error, /Development mode/);
  } finally {
    if (originalMode === undefined) delete process.env.NOTIFICATION_MODE;
    else process.env.NOTIFICATION_MODE = originalMode;
  }
});
