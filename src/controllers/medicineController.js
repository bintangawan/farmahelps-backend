const db = require('../config/db');

// @desc    Get all medicines
const getMedicines = async (req, res) => {
    try {
        const [medicines] = await db.query(
            'SELECT * FROM medicines WHERE user_id = ? ORDER BY created_at DESC', 
            [req.user.id]
        );
        res.json({ success: true, data: medicines });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Add new medicine (UPDATED)
const addMedicine = async (req, res) => {
    // Tambahkan field description, medicine_type, indication
    const { name, description, medicine_type, indication, stock, unit, expired_date, bud_days } = req.body;

    try {
        const [result] = await db.query(
            `INSERT INTO medicines 
            (user_id, name, description, medicine_type, indication, stock, unit, expired_date, bud_days) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, name, description, medicine_type, indication, stock, unit, expired_date, bud_days]
        );

        res.status(201).json({
            success: true,
            data: { id: result.insertId, ...req.body }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Open seal (Update opened_at)
// @route   PUT /api/medicines/:id/open
const openMedicine = async (req, res) => {
    const { id } = req.params;
    const today = new Date();

    try {
        // Pastikan obat milik user
        const [check] = await db.query('SELECT * FROM medicines WHERE id = ? AND user_id = ?', [id, req.user.id]);
        if (check.length === 0) return res.status(404).json({ message: 'Medicine not found' });

        await db.query(
            'UPDATE medicines SET is_opened = TRUE, opened_at = ? WHERE id = ?',
            [today, id]
        );

        res.json({ success: true, message: 'Medicine opened successfully', opened_at: today });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete medicine
// @route   DELETE /api/medicines/:id
const deleteMedicine = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM medicines WHERE id = ? AND user_id = ?', [id, req.user.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Medicine not found' });
        
        res.json({ success: true, message: 'Medicine deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Total Obat & Attention Needed (Tetap Sama)
        const [totalMed] = await db.query('SELECT COUNT(*) as total FROM medicines WHERE user_id = ?', [userId]);
        
        const [attentionMed] = await db.query(`
            SELECT COUNT(*) as total FROM medicines 
            WHERE user_id = ? 
            AND (
                DATEDIFF(expired_date, NOW()) <= 30 
                OR 
                (is_opened = 1 AND DATEDIFF(DATE_ADD(opened_at, INTERVAL bud_days DAY), NOW()) <= 7)
            )
        `, [userId]);

        // 2. Active Schedules & Today Schedules
        // Hitung total jadwal aktif
        const [allActiveSchedules] = await db.query(`
            SELECT COUNT(*) as total FROM schedules 
            WHERE user_id = ? AND is_active = 1
        `, [userId]);

        // Ambil jadwal HARI INI saja (filter by day name + date range + is_active)
        // Termasuk status is_taken dan taken_at dari schedule_logs
        const [todaySchedules] = await db.query(`
            SELECT 
                s.id, 
                s.time, 
                m.name as medicine_name,
                CASE WHEN sl.id IS NOT NULL THEN 1 ELSE 0 END as is_taken,
                sl.taken_at
            FROM schedules s
            JOIN medicines m ON s.medicine_id = m.id
            LEFT JOIN schedule_logs sl ON s.id = sl.schedule_id 
                AND sl.scheduled_date = CURDATE()
                AND sl.user_id = ?
            WHERE s.user_id = ? 
                AND s.is_active = 1
                AND CURDATE() BETWEEN s.start_date AND s.end_date
                AND JSON_CONTAINS(s.days, CONCAT('"', DATE_FORMAT(CURDATE(), '%a'), '"'))
            ORDER BY s.time ASC
        `, [userId, userId]);

        // 3. STATISTIK KEPATUHAN (7 HARI TERAKHIR) -- BARU
        // Query ini menghitung jumlah log 'taken' per tanggal
        const [complianceStats] = await db.query(`
            SELECT 
                DATE_FORMAT(calendar.date, '%Y-%m-%d') as date,
                DAYNAME(calendar.date) as day_name,
                COUNT(sl.id) as taken_count
            FROM (
                SELECT CURDATE() - INTERVAL (a.a + (10 * b.a)) DAY as date
                FROM (SELECT 0 as a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) as a
                CROSS JOIN (SELECT 0 as a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) as b
            ) as calendar
            LEFT JOIN schedule_logs sl ON sl.scheduled_date = calendar.date AND sl.user_id = ? AND sl.status = 'taken'
            WHERE calendar.date BETWEEN CURDATE() - INTERVAL 6 DAY AND CURDATE()
            GROUP BY calendar.date
            ORDER BY calendar.date ASC
        `, [userId]);

        /* Catatan: Query 'calendar' di atas adalah cara MySQL membuat deret tanggal dinamis 
           tanpa tabel kalender fisik. Ini memastikan jika hari itu tidak ada log, 
           tanggalnya tetap muncul dengan count 0.
        */

        // Hitung target harian (Total jadwal aktif * 1, asumsi sederhana)
        // Idealnya target dihitung berdasarkan historical schedule, tapi untuk dashboard sederhana,
        // kita gunakan jumlah jadwal aktif saat ini sebagai baseline target.
        const dailyTarget = todaySchedules.length;

        // Format data untuk Recharts
        const chartData = complianceStats.map(item => ({
            date: item.day_name.substring(0, 3), // Mon, Tue, Wed
            fullDate: item.date,
            taken: item.taken_count,
            target: dailyTarget > 0 ? dailyTarget : 0 // Hindari target 0 biar grafik gak aneh
        }));

        res.json({
            success: true,
            data: {
                total_medicines: totalMed[0].total,
                attention_needed: attentionMed[0].total,
                active_schedules: allActiveSchedules[0].total,
                today_schedules: todaySchedules.map(s => ({
                    id: s.id,
                    medicine_name: s.medicine_name,
                    time: s.time,
                    is_taken: Boolean(s.is_taken),
                    taken_at: s.taken_at || null
                })),
                chart_data: chartData
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// JANGAN LUPA UPDATE EXPORT DI BAWAH:
module.exports = { 
    getMedicines, 
    addMedicine, 
    openMedicine, 
    deleteMedicine,
    getDashboardStats // <--- Tambahkan ini
};
