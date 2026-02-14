const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const startCronJobs = require('./services/cronService');
const { apiLimiter } = require('./middleware/rateLimiter');

// Load env vars
dotenv.config();

// Connect Database
require('./config/db');

// Routes Import
const authRoutes = require('./routes/authRoutes');
const medicineRoutes = require('./routes/medicineRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const journalRoutes = require('./routes/journalRoutes');

const app = express();

// ==========================================
// KEMANAN CORS (Strict Mode) 🔒
// ==========================================
const whitelist = [
    'http://localhost:9000', // Frontend Development
    'https://farmahelps.bintangin.com', // Frontend Production
    process.env.CLIENT_URL   // Domain Production (set di .env nanti)
];

const corsOptions = {
    origin: function (origin, callback) {
        // (!origin) itu untuk membolehkan request dari server-to-server atau tools seperti Postman
        if (!origin || whitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.error(`Blocked by CORS: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Method yang diizinkan
    allowedHeaders: ['Content-Type', 'Authorization'], // Header yang diizinkan
    credentials: true // Penting jika nanti main cookies/session
};

app.use(cors(corsOptions));
// ==========================================

// ==========================================
// SECURITY HEADERS 🔒
// ==========================================
app.use((req, res, next) => {
    // Fix COOP: izinkan popup Google OAuth berkomunikasi dengan window parent
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    // Cegah browser menebak MIME type
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Cegah clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Aktifkan XSS Protection di browser lama
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Cegah browser mengirim Referer header berlebihan
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Batasi permission API browser
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});
// ==========================================

app.use(express.json({ limit: '10kb' })); // Batasi ukuran body request

// Global Rate Limiter
app.use('/api', apiLimiter);

// Routes Registration
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/journals', journalRoutes);

// Start Cron Jobs
startCronJobs();

// Health Check
app.get('/', (req, res) => {
    res.status(200).send('API FarmaHelps is secure & running.');
});

// Global Error Handler
app.use((err, req, res, next) => {
    // console.error(err.stack); // Uncomment untuk debug
    
    // Tangani error CORS secara spesifik agar pesan lebih jelas di frontend
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak oleh CORS Policy (Origin tidak dikenali).'
        });
    }

    res.status(500).json({ 
        success: false, 
        message: 'Internal Server Error' 
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

module.exports = app;