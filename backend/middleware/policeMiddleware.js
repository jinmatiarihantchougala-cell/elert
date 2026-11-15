module.exports = function police(req, res, next) {
  if (!req.user || req.user.role !== 'police') {
    return res.status(403).json({ message: 'Police account access required' });
  }
  next();
};
