const mysql = require('mysql2');
require('dotenv').config();

// Buat Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'farmahelps_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Ubah jadi Promise agar bisa pakai async/await
const db = pool.promise();

// Cek koneksi saat start
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Connected to MySQL Database');
        connection.release();
    }
});

module.exports = db;