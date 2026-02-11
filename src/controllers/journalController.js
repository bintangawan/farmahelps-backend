const db = require('../config/db');
const crypto = require('crypto'); // Bawaan Node.js

// Helper: Bikin Slug
const createSlug = (title) => {
    // 1. Ubah judul jadi format url (lowercase, ganti spasi jadi strip, hapus simbol)
    const cleanTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Hapus karakter aneh
        .trim()
        .replace(/\s+/g, '-'); // Spasi jadi strip
    
    // 2. Tambah random string biar UNIK (mencegah duplikat slug)
    const randomString = crypto.randomBytes(3).toString('hex'); // Hasil: 'a1b2c3'
    
    return `${cleanTitle}-${randomString}`; 
};

// @desc    Get all journals
const getJournals = async (req, res) => {
    try {
        const [journals] = await db.query(
            'SELECT * FROM journals WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json({ success: true, data: journals });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Single Journal Detail BY SLUG (Updated)
// @route   GET /api/journals/:slug
const getJournalBySlug = async (req, res) => {
    try {
        // Ganti query dari 'id' menjadi 'slug'
        const [journal] = await db.query(
            'SELECT * FROM journals WHERE slug = ? AND user_id = ?',
            [req.params.slug, req.user.id]
        );

        if (journal.length === 0) {
            return res.status(404).json({ success: false, message: 'Jurnal tidak ditemukan.' });
        }

        res.json({ success: true, data: journal[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create new journal (Generate Slug Here)
const createJournal = async (req, res) => {
    const { title, content, mood } = req.body;

    if (!content) {
        return res.status(400).json({ success: false, message: 'Isi jurnal tidak boleh kosong.' });
    }

    const finalTitle = title || 'Tanpa Judul';
    const slug = createSlug(finalTitle); // GENERATE SLUG

    try {
        const [result] = await db.query(
            'INSERT INTO journals (user_id, title, slug, content, mood) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, finalTitle, slug, content, mood || 'neutral']
        );

        res.status(201).json({
            success: true,
            // Kembalikan slug ke frontend agar bisa langsung redirect
            data: { id: result.insertId, title: finalTitle, slug, content, mood, created_at: new Date() }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete journal (Tetap pakai ID atau Slug bisa, kita pakai ID saja biar aman/konsisten saat delete list)
const deleteJournal = async (req, res) => {
    try {
        // Kita hapus berdasarkan ID saja karena lebih simpel dari sisi frontend list
        await db.query('DELETE FROM journals WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ success: true, message: 'Jurnal berhasil dihapus.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getJournals, getJournalBySlug, createJournal, deleteJournal };