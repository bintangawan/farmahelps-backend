const cron = require('node-cron');
const db = require('../config/db');
const { sendEmail } = require('./emailService');
const webpush = require('web-push');
require('dotenv').config();

// =================================================================
// KONFIGURASI WEB PUSH
// =================================================================
webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

const startCronJobs = () => {
    console.log('✅ Cron Jobs started running...');

    // =================================================================
    // 1. JOB PENGINGAT MINUM OBAT (Jalan Setiap Menit)
    // =================================================================
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}%`;
        const currentDay = now.toLocaleDateString('en-US', { weekday: 'short' }); 
        
        // Ambil tanggal hari ini dalam format YYYY-MM-DD untuk query SQL
        // Kita gunakan toISOString().slice(0, 10) untuk ambil format tanggal
        // Perhatian: Pastikan timezone server sesuai, atau gunakan library 'moment'/'date-fns' jika perlu strict timezone lokal
        const offset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now - offset)).toISOString().slice(0, 10);
        const currentDateSql = localISOTime;

        try {
            // [LOGIC BARU] 
            // Tambahkan: AND ? BETWEEN s.start_date AND s.end_date
            // Artinya: Hari ini harus berada di antara tanggal mulai dan tanggal selesai
            const query = `
                SELECT s.id, s.time, s.days, s.user_id, u.email, u.name as user_name, m.name as medicine_name 
                FROM schedules s
                JOIN users u ON s.user_id = u.id
                JOIN medicines m ON s.medicine_id = m.id
                WHERE s.is_active = 1 
                AND s.time LIKE ?
                AND ? BETWEEN s.start_date AND s.end_date
            `;
            
            // Masukkan currentDateSql ke parameter query
            const [schedules] = await db.query(query, [timeString, currentDateSql]);

            for (const job of schedules) {
                let scheduledDays = job.days;
                if (typeof scheduledDays === 'string') {
                    try { scheduledDays = JSON.parse(scheduledDays); } catch (e) { scheduledDays = []; }
                }

                if (Array.isArray(scheduledDays) && scheduledDays.includes(currentDay)) {
                    console.log(`💊 [CRON] Sending reminder: ${job.medicine_name} -> User ID: ${job.user_id}`);
                    
                    // --- A. KIRIM EMAIL ---
                    const htmlContent = `
                        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                            <h2 style="color: #2563eb;">Halo ${job.user_name}! 👋</h2>
                            <p>Waktunya minum obat (Periode Aktif):</p>
                            <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin: 10px 0;">
                                <h3 style="margin: 0; color: #0284c7;">💊 ${job.medicine_name}</h3>
                            </div>
                            <small>FarmaHelps Automated Reminder</small>
                        </div>
                    `;
                    sendEmail(job.email, `💊 Waktunya Minum: ${job.medicine_name}`, htmlContent).catch(console.error);

                    // --- B. KIRIM PUSH NOTIFICATION ---
                    try {
                        const [subs] = await db.query('SELECT * FROM push_subscriptions WHERE user_id = ?', [job.user_id]);
                        if (subs.length > 0) {
                            const payload = JSON.stringify({
                                title: "Waktunya Minum Obat! 💊",
                                body: `Saatnya minum ${job.medicine_name}.`,
                                icon: "/pwa-192x192.png",
                                data: { url: '/dashboard' }
                            });

                            subs.forEach(sub => {
                                webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } }, payload)
                                    .catch(err => {
                                        if (err.statusCode === 410) {
                                            db.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                                        }
                                    });
                            });
                        }
                    } catch (pushErr) { console.error(pushErr); }

                    // --- C. LOG KE DATABASE ---
                    try {
                        const logQuery = `
                            INSERT INTO notification_logs (user_id, title, message, type, created_at)
                            VALUES (?, ?, ?, ?, NOW())
                        `;
                        await db.query(logQuery, [
                            job.user_id,
                            "Waktunya Minum Obat",
                            `Jangan lupa minum obat ${job.medicine_name} sesuai jadwal.`,
                            "email"
                        ]);
                    } catch (dbErr) { console.error("Gagal simpan log:", dbErr); }
                }
            }
        } catch (error) {
            console.error('Cron Error (Schedule):', error);
        }
    });

    // =================================================================
    // 2. JOB PENGECEKAN EXPIRED & BUD (Jalan Tiap Jam 07:00 Pagi)
    // =================================================================
    cron.schedule('0 7 * * *', async () => {
        console.log('🔍 [CRON] Running Daily Inventory Check...');
        try {
            // --- A. Cek Expired Date (H-3 dan H-7) ---
            const queryExp = `
                SELECT m.name, m.expired_date, m.user_id, u.email, u.name as user_name
                FROM medicines m
                JOIN users u ON m.user_id = u.id
                WHERE DATEDIFF(m.expired_date, NOW()) IN (7, 3)
            `;
            const [expiring] = await db.query(queryExp);

            for (const item of expiring) {
                const msg = `Obat <b>${item.name}</b> akan expired sebentar lagi. Segera cek stok Anda!`;
                await sendEmail(item.email, `⚠️ Peringatan Expired: ${item.name}`, `<p>${msg}</p>`);

                // Log ke DB (Type: system -> Ikon Lonceng)
                await db.query(`
                    INSERT INTO notification_logs (user_id, title, message, type, created_at)
                    VALUES (?, ?, ?, 'system', NOW())
                `, [item.user_id, "Peringatan Expired", `Obat ${item.name} akan segera expired.`]);
            }

            // --- B. Cek BUD (Beyond Use Date) ---
            const queryBud = `
                 SELECT m.name, m.user_id, u.email 
                 FROM medicines m
                 JOIN users u ON m.user_id = u.id
                 WHERE m.is_opened = 1 
                 AND m.bud_days IS NOT NULL
                 AND DATEDIFF(DATE_ADD(m.opened_at, INTERVAL m.bud_days DAY), NOW()) <= 3
                 AND DATEDIFF(DATE_ADD(m.opened_at, INTERVAL m.bud_days DAY), NOW()) >= 0
            `;
            const [budExpiring] = await db.query(queryBud);

            for (const item of budExpiring) {
                await sendEmail(item.email, `⚠️ Peringatan BUD: ${item.name}`, 
                    `<p>Masa simpan (BUD) obat <b>${item.name}</b> akan segera habis setelah kemasan dibuka.</p>`);
                
                // Log ke DB (Type: system -> Ikon Lonceng)
                await db.query(`
                    INSERT INTO notification_logs (user_id, title, message, type, created_at)
                    VALUES (?, ?, ?, 'system', NOW())
                `, [item.user_id, "Peringatan BUD", `Masa simpan obat ${item.name} akan segera habis.`]);
            }

        } catch (error) {
            console.error('Cron Error (Inventory):', error);
        }
    });
};

module.exports = startCronJobs;