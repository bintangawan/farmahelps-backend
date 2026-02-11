const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const startCronJobs = require('./services/cronService');

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
    'http://localhost:5173', // Frontend Development
    'http://localhost:4173', // Frontend Preview
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

app.use(express.json());

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