const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/authMiddleware');
const user = require('../middleware/userMiddleware');
const controller = require('../controllers/contactController');
const contactWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ message: 'Too many contact changes. Wait 15 minutes before trying again.' })
});
const verificationSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ message: 'Too many verification messages requested. Wait 15 minutes before trying again.' })
});
const verificationCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ message: 'Too many code attempts. Wait 15 minutes before trying again.' })
});
router.use(auth, user);
router.get('/', controller.list);
router.post('/', contactWriteLimiter, controller.create);
router.post('/:id/verification', verificationSendLimiter, controller.sendVerification);
router.post('/:id/verify', verificationCheckLimiter, controller.verify);
router.put('/:id', contactWriteLimiter, controller.update);
router.delete('/:id', controller.remove);
module.exports = router;
