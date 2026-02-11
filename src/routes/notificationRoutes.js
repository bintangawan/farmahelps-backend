const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { subscribePush, getNotifications } = require('../controllers/notificationController');

router.post('/subscribe', protect, subscribePush);
router.get('/', protect, getNotifications);
module.exports = router;