const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
    getJournals, 
    getJournalBySlug, // Ganti nama import
    createJournal, 
    deleteJournal 
} = require('../controllers/journalController');

router.use(protect);

router.route('/')
    .get(getJournals)
    .post(createJournal);

// Route Delete tetap pakai ID (karena tombol delete ada di list yang punya ID)
router.delete('/:id', deleteJournal);

// Route Detail pakai SLUG
router.get('/:slug', getJournalBySlug); 

module.exports = router;