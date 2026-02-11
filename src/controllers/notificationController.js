const db = require('../config/db');

// @desc    Subscribe / Refresh Token Browser
const subscribePush = async (req, res) => {
    const { endpoint, keys } = req.body;
    const userId = req.user.id;

    try {
        // Query "UPSERT" (Update if exists, Insert if new)
        // Jika endpoint sudah ada, kita update user_id-nya (berjaga-jaga kalau user ganti akun di browser sama)
        // Dan kita tidak perlu Select dulu (hemat query)
        const query = `
            INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                user_id = VALUES(user_id),
                keys_p256dh = VALUES(keys_p256dh),
                keys_auth = VALUES(keys_auth)
        `;

        await db.query(query, [userId, endpoint, keys.p256dh, keys.auth]);

        res.status(200).json({ success: true, message: 'Subscription synced.' });
    } catch (error) {
        console.error("Subscribe Error:", error);
        res.status(500).json({ success: false, message: 'Gagal sync subscription.' });
    }
};

// @desc    Get User Notifications
// @route   GET /api/notifications
const getNotifications = async (req, res) => {
    try {
        const [notifs] = await db.query(
            'SELECT * FROM notification_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
            [req.user.id]
        );

        // FIX UTAMA DISINI:
        // Bungkus array 'notifs' ke dalam object { data: ... }
        // agar sesuai dengan format yang diminta frontend (api.ts)
        res.json({
            success: true,
            data: notifs 
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

module.exports = { subscribePush, getNotifications };