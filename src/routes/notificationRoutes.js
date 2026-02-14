const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { subscribePush, getNotifications, checkSubscription } = require('../controllers/notificationController');

router.post('/subscribe', protect, subscribePush);
router.get('/check-subscription', protect, checkSubscription);
router.get('/', protect, getNotifications);
module.exports = router;