const jwt = require('jsonwebtoken');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Ambil token dari header "Bearer <token>"
            token = req.headers.authorization.split(' ')[1];

            // Verifikasi token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Simpan data user ke request object (kecuali password)
            // Di MySQL native kita simpan ID saja cukup
            req.user = { id: decoded.id };

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ success: false, message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
};

module.exports = { protect };