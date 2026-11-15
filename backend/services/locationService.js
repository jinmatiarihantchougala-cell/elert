function validateCoordinates({ latitude, longitude, accuracy }) {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    const error = new Error('Valid latitude and longitude are required');
    error.status = 400;
    throw error;
  }
  const lat = Number(latitude), lon = Number(longitude), acc = accuracy == null ? undefined : Number(accuracy);
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || (acc != null && acc < 0)) {
    const error = new Error('GPS coordinates are outside valid ranges');
    error.status = 400;
    throw error;
  }
  return { latitude: lat, longitude: lon, accuracy: acc };
}

function googleMapsLink(latitude, longitude) {
  return `https://www.google.com/maps?q=${Number(latitude).toFixed(7)},${Number(longitude).toFixed(7)}`;
}

module.exports = { validateCoordinates, googleMapsLink };
