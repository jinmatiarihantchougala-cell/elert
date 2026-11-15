module.exports = function user(req, res, next) {
  if (!req.user || req.user.role !== 'user') {
    return res.status(403).json({ message: 'User account access required' });
  }
  next();
};
