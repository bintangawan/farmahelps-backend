const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { registerUser, loginUser, googleLogin, logoutUser } = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimiter');

// Middleware: tangani error validasi
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false, 
            message: errors.array()[0].msg 
        });
    }
    next();
};

// Validasi Register
const registerValidation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Nama wajib diisi')
        .isLength({ min: 2, max: 100 }).withMessage('Nama harus 2-100 karakter'),
        // Jangan pakai .escape() karena akan mengubah karakter seperti & ' " menjadi HTML entities
    body('email')
        .trim()
        .notEmpty().withMessage('Email wajib diisi')
        .isEmail().withMessage('Format email tidak valid')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password wajib diisi')
        .isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
];

// Validasi Login
const loginValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email wajib diisi')
        .isEmail().withMessage('Format email tidak valid')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password wajib diisi'),
];

// Validasi Google Login
const googleValidation = [
    body('code')
        .notEmpty().withMessage('Authorization code wajib diisi')
        .isString().withMessage('Authorization code harus berupa string'),
];

router.post('/register', authLimiter, registerValidation, validate, registerUser);
router.post('/login', authLimiter, loginValidation, validate, loginUser);
router.post('/google', authLimiter, googleValidation, validate, googleLogin);
router.post('/logout', logoutUser);

module.exports = router;