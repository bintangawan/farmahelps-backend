const express = require('express');
const router = express.Router();
const { 
    getMedicines, 
    addMedicine, 
    openMedicine, 
    deleteMedicine,
    getDashboardStats // <--- Pastikan sudah di-import
} = require('../controllers/medicineController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// 1. Route Dashboard Stats (HARUS DI ATAS)
router.get('/dashboard-stats', getDashboardStats);

// 2. Route Root
router.route('/')
    .get(getMedicines)
    .post(addMedicine);

// 3. Route ID (HARUS DI BAWAH)
router.put('/:id/open', openMedicine);
router.delete('/:id', deleteMedicine);

module.exports = router;