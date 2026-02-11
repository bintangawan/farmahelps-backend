const express = require('express');
const router = express.Router();
const { registerUser, loginUser, googleLogin, logoutUser } = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleLogin);
router.post('/logout', logoutUser); // <--- Tambahkan ini

module.exports = router;