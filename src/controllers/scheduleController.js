// backend/src/controllers/scheduleController.js

const db = require('../config/db');

// @desc    Get user schedules (Updated with is_taken check)
// @route   GET /api/schedules
const getSchedules = async (req, res) => {
    try {
        const query = `
            SELECT 
                s.*, 
                m.name as medicine_name,
                m.unit,
                CASE WHEN sl.id IS NOT NULL THEN 1 ELSE 0 END as is_taken
            FROM schedules s
            JOIN medicines m ON s.medicine_id = m.id
            LEFT JOIN schedule_logs sl ON s.id = sl.schedule_id 
                AND sl.scheduled_date = CURDATE()
            WHERE s.user_id = ?
            ORDER BY s.time ASC
        `;
        const [schedules] = await db.query(query, [req.user.id]);
        
        const formatted = schedules.map(s => ({
            ...s,
            is_taken: Boolean(s.is_taken),
            is_active: Boolean(s.is_active)
        }));

        res.json({ success: true, data: formatted });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create schedule (Support Multiple Times like 3x1)
// @route   POST /api/schedules
const addSchedule = async (req, res) => {
    // times sekarang menerima ARRAY string jam ["07:00", "13:00", "19:00"]
    const { medicine_id, times, days, start_date, end_date } = req.body; 

    // Validasi
    if (!start_date || !end_date) {
        return res.status(400).json({ success: false, message: 'Tanggal mulai dan selesai wajib diisi.' });
    }
    if (!times || !Array.isArray(times) || times.length === 0) {
        return res.status(400).json({ success: false, message: 'Minimal satu waktu minum obat harus dipilih.' });
    }

    const connection = await db.getConnection(); // Pakai transaction biar aman

    try {
        await connection.beginTransaction();

        const daysJson = JSON.stringify(days); 

        // Loop setiap jam yang dipilih, lalu insert satu per satu
        for (const time of times) {
            await connection.query(
                `INSERT INTO schedules (user_id, medicine_id, time, days, start_date, end_date) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [req.user.id, medicine_id, time, daysJson, start_date, end_date]
            );
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: `Berhasil membuat ${times.length} jadwal pengingat.`
        });
    } catch (error) {
        await connection.rollback(); // Batalkan semua jika ada error
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal membuat jadwal.' });
    } finally {
        connection.release();
    }
};

// @desc    Mark schedule as TAKEN for today
const markAsTaken = async (req, res) => {
    const { id } = req.params; 
    const today = new Date().toISOString().slice(0, 10); 

    try {
        const [check] = await db.query('SELECT id, medicine_id FROM schedules WHERE id = ? AND user_id = ?', [id, req.user.id]);
        if (check.length === 0) return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });

        await db.query(`
            INSERT IGNORE INTO schedule_logs (schedule_id, user_id, scheduled_date, status)
            VALUES (?, ?, ?, 'taken')
        `, [id, req.user.id, today]);

        // Kurangi stok
        await db.query('UPDATE medicines SET stock = stock - 1 WHERE id = ? AND stock > 0', [check[0].medicine_id]);

        res.json({ success: true, message: 'Obat berhasil diminum!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Toggle Active Status
const toggleSchedule = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query(
            'UPDATE schedules SET is_active = NOT is_active WHERE id = ? AND user_id = ?',
            [id, req.user.id]
        );
        res.json({ success: true, message: 'Status jadwal diperbarui' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete schedule
const deleteSchedule = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM schedules WHERE id = ? AND user_id = ?', [id, req.user.id]);
        res.json({ success: true, message: 'Jadwal dihapus' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getSchedules, addSchedule, toggleSchedule, deleteSchedule, markAsTaken };