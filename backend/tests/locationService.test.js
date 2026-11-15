const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCoordinates, googleMapsLink } = require('../services/locationService');

test('accepts valid GPS coordinates', () => {
  const result = validateCoordinates({ latitude: '12.9716', longitude: '77.5946', accuracy: '18' });
  assert.deepEqual(result, { latitude: 12.9716, longitude: 77.5946, accuracy: 18 });
});

test('rejects invalid latitude and longitude ranges', () => {
  assert.throws(() => validateCoordinates({ latitude: 91, longitude: 10 }), /outside valid ranges/);
  assert.throws(() => validateCoordinates({ latitude: 10, longitude: 181 }), /outside valid ranges/);
});

test('creates a Google Maps coordinates link', () => {
  assert.equal(googleMapsLink(12.9716, 77.5946), 'https://www.google.com/maps?q=12.9716000,77.5946000');
});
