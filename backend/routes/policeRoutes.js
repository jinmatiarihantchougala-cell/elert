const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const police = require('../middleware/policeMiddleware');
const controller = require('../controllers/policeController');

router.use(auth, police);
router.get('/dashboard', controller.dashboard);
router.get('/alerts', controller.alerts);
router.put('/alerts/:id/acknowledge', controller.acknowledge);
router.put('/alerts/:id/resolve', controller.resolve);

module.exports = router;
