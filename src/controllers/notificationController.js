const db = require('../config/db');

// @desc    Cek apakah user punya subscription aktif
// @route   GET /api/notifications/check-subscription
const checkSubscription = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id FROM push_subscriptions WHERE user_id = ? LIMIT 1',
            [req.user.id]
        );
        res.json({ success: true, hasSubscription: rows.length > 0 });
    } catch (error) {
        console.error('Check subscription error:', error);
        res.status(500).json({ success: false, hasSubscription: false });
    }
};

// @desc    Subscribe / Refresh Token Browser
const subscribePush = async (req, res) => {
    const { endpoint, keys } = req.body;
    const userId = req.user.id;

    try {
        // 1. Hapus subscription LAMA milik user ini
        await db.query('DELETE FROM push_subscriptions WHERE user_id = ?', [userId]);
        // 2. Hapus subscription dengan endpoint yang sama (misal: user lain pernah login di browser ini)
        await db.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);

        await db.query(
            'INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?, ?)',
            [userId, endpoint, keys.p256dh, keys.auth]
        );

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

module.exports = { subscribePush, getNotifications, checkSubscription };