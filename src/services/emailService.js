const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Konfigurasi Transporter Email
 * Menggunakan OAuth2 agar tidak perlu 'Less Secure Apps'
 */
const createTransporter = () => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: process.env.MAIL_USERNAME, // Email pengirim (Admin)
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            refreshToken: process.env.MAIL_REFRESH_TOKEN,
        },
    });

    return transporter;
};

/**
 * Fungsi kirim email generic
 * @param {string} to - Email penerima
 * @param {string} subject - Judul Email
 * @param {string} htmlContent - Isi email (HTML)
 */
const sendEmail = async (to, subject, htmlContent) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: `"FarmaHelps Assistant" <${process.env.MAIL_USERNAME}>`,
            to: to,
            subject: subject,
            html: htmlContent,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${to} | ID: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error("❌ Error sending email:", error.message);
        // Jangan throw error agar cron job tidak crash total jika satu email gagal
        return false;
    }
};

module.exports = { sendEmail };