const rateLimit = require('express-rate-limit');

// Rate Limiter untuk Auth (Login, Register, Google) 
// Mencegah brute-force attack
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 30,                   // Maksimal 30 percobaan login/register per IP per 15 menit
    message: {
        success: false,
        message: 'Terlalu banyak percobaan. Coba lagi setelah 15 menit.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate Limiter umum untuk seluruh API
// Harus cukup besar karena frontend melakukan polling notifikasi tiap 30 detik
// + multiple request saat page load (dashboard-stats, schedules, notifications, subscribe, dll)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 1000,                 // Maksimal 1000 request per IP per 15 menit (~1 req/detik)
    message: {
        success: false,
        message: 'Terlalu banyak request. Coba lagi nanti.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = { authLimiter, apiLimiter };
