const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');
const controller = require('../controllers/adminController');
router.use(auth, admin);
router.get('/dashboard', controller.dashboard);
router.get('/alerts', controller.alerts);
router.get('/users', controller.users);
module.exports = router;
