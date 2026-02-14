const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

// Init Google Client
const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'postmessage' // Penting untuk flow auth-code dari React
);

// Helper: Buat JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Register User Manual
// @route   POST /api/auth/register
const registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // 1. Cek apakah user sudah ada
        const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }

        // 2. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Insert ke DB
        const [result] = await db.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );

        res.status(201).json({
            success: true,
            data: {
                id: result.insertId,
                name,
                email,
                token: generateToken(result.insertId)
            }
        });
    } catch (error) {
        console.error('Register Error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server. Silakan coba lagi.' });
    }
};

// @desc    Login User Manual
// @route   POST /api/auth/login
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Cari User
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        const user = users[0];

        // 2. Cek Password
        if (user && (await bcrypt.compare(password, user.password || ''))) {
            res.json({
                success: true,
                data: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    token: generateToken(user.id)
                }
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server. Silakan coba lagi.' });
    }
};

// @desc    Login with Google (Code Exchange)
// @route   POST /api/auth/google
const googleLogin = async (req, res) => {
    const { code } = req.body; // Code dari Frontend

    try {
        // 1. Tukar Code dengan Tokens (Access & Refresh)
        const { tokens } = await client.getToken(code);
        
        // 2. Verifikasi ID Token untuk dapat info user
        const ticket = await client.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        
        const { sub: googleId, email, name, picture } = payload;
        
        // 3. Cek apakah user sudah ada di DB
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        let user = users[0];

        if (user) {
            // Update Google ID & Refresh Token jika user sudah ada (misal sebelumnya login manual)
            // Refresh token disimpan agar server bisa kirim email nanti (offline access)
            await db.query(
                'UPDATE users SET google_id = ?, avatar_url = ?, refresh_token = ? WHERE id = ?',
                [googleId, picture, tokens.refresh_token || user.refresh_token, user.id]
            );
        } else {
            // Buat User Baru
            const [result] = await db.query(
                'INSERT INTO users (name, email, google_id, avatar_url, refresh_token) VALUES (?, ?, ?, ?, ?)',
                [name, email, googleId, picture, tokens.refresh_token]
            );
            user = { id: result.insertId, name, email };
        }

        // 4. Return JWT ke Frontend
        res.json({
            success: true,
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: picture,
                token: generateToken(user.id)
            }
        });

    } catch (error) {
        console.error("Google Auth Error:", error);
        res.status(400).json({ success: false, message: 'Google authentication failed' });
    }
};

// @desc    Logout User
// @route   POST /api/auth/logout
const logoutUser = async (req, res) => {
    // Karena kita pakai JWT di client-side (LocalStorage), 
    // server sebenarnya tidak perlu melakukan apa-apa ke Database.
    // Kecuali jika kita pakai Cookies, kita harus clear cookie-nya.
    
    // Opsional: Clear cookie jika nanti kita pindah ke HttpOnly Cookie
    res.cookie('jwt', '', {
        httpOnly: true,
        expires: new Date(0)
    });

    res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
};

// Update exports
module.exports = { registerUser, loginUser, googleLogin, logoutUser };