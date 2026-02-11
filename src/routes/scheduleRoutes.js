const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
    getSchedules, 
    addSchedule, 
    toggleSchedule, 
    deleteSchedule, 
    markAsTaken // Import
} = require('../controllers/scheduleController');

router.use(protect);

router.route('/')
    .get(getSchedules)
    .post(addSchedule);

router.put('/:id/toggle', toggleSchedule);
router.delete('/:id', deleteSchedule);

// Route Baru: Aksi minum obat
router.post('/:id/take', markAsTaken);

module.exports = router;