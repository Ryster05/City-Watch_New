import nodemailer from 'nodemailer';

// Lightweight notification service used by auth routes for email verification.
// This module performs lazy transporter initialization so dotenv can load
// environment variables before we attempt to create the SMTP transporter.

let transporter = null;

function ensureTransporter() {
  if (transporter) return transporter;

  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!(host && user && pass)) {
    console.warn('Email config not found in env - verification emails will not be sent');
    return null;
  }

  // Treat obvious placeholder hosts as "not configured" so development
  // falls back to Ethereal preview instead of trying to connect to an
  // unreachable host like smtp.example.com which will throw DNS errors.
  const placeholderHosts = ['smtp.example.com', 'example.com'];
  if (placeholderHosts.some(h => host.includes(h))) {
    console.warn(`Email host appears to be a placeholder (${host}); skipping SMTP initialization`);
    return null;
  }

  transporter = nodemailer.createTransport({
    host: host,
    port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587,
    secure: process.env.EMAIL_SECURE === 'true' || false,
    auth: {
      user: user,
      pass: pass,
    },
  });

  transporter.verify().then(() => {
    console.log('Notification email transporter verified');
  }).catch((err) => {
    console.warn('Notification transporter verify failed:', err && err.message);
  });

  return transporter;
}

export const notificationService = {
  async sendVerificationEmail(userId, email, name, verificationCode) {
    try {
      let tx = ensureTransporter();
      let isEthereal = false;

      if (!tx) {
        console.warn('No SMTP configured; creating Ethereal test account for development email preview');
        const testAccount = await nodemailer.createTestAccount();
        tx = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        transporter = tx;
        isEthereal = true;
      }

      const html = `
        <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto;">
          <h2 style="color:#2a65f5;">Verify Your Email</h2>
          <p>Hello ${name || ''},</p>
          <p>Use the code below to verify your City Watch account:</p>
          <div style="background:#f5f5f5;padding:15px;border-radius:5px;margin:15px 0;text-align:center;">
            <p style="font-size:24px;font-weight:700;letter-spacing:6px;color:#2a65f5;">${verificationCode}</p>
          </div>
          <p>This code will expire in 1 hour.</p>
          <p>If you didn't request this, ignore this email.</p>
          <p>— City Watch</p>
        </div>
      `;

      const info = await tx.sendMail({
        from: process.env.EMAIL_FROM || `City Watch <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verify your City Watch account',
        html,
        text: `Your verification code is ${verificationCode}`,
      });

      console.log('Verification email sent:', info.messageId);
      if (isEthereal) {
        console.log('Ethereal Preview URL:', nodemailer.getTestMessageUrl(info));
      }

      return { success: true, info };
    } catch (err) {
      console.error('Failed to send verification email', err && err.message ? err.message : err);
      return { success: false, error: err && err.message ? err.message : err };
    }
  },

  async sendResetPasswordEmail(email, name, resetToken) {
    try {
      let tx = ensureTransporter();
      let isEthereal = false;

      if (!tx) {
        console.warn('No SMTP configured; creating Ethereal test account for development email preview');
        const testAccount = await nodemailer.createTestAccount();
        tx = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        transporter = tx;
        isEthereal = true;
      }

      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5500'}/CityWatch-Reset-Password.html?token=${resetToken}`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto;">
          <h2 style="color:#2a65f5;">City Watch — Password Reset</h2>
          <p>Hello ${name || 'there'},</p>
          <p>We received a request to reset your password. Use the code below or click the link to reset your password:</p>
          <div style="background:#f5f5f5;padding:15px;border-radius:5px;margin:15px 0;text-align:center;">
            <p style="font-size:20px;font-weight:700;letter-spacing:6px;color:#2a65f5;">${resetToken}</p>
          </div>
          <p style="text-align:center;"><a href="${resetUrl}">Reset password now</a></p>
          <p>This link and code will expire in 1 hour. If you didn't request this, ignore this email.</p>
          <p>— City Watch Team</p>
        </div>
      `;

      const info = await tx.sendMail({
        from: process.env.EMAIL_FROM || `City Watch <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'City Watch — Reset your password',
        html,
        text: `Reset your password using this link: ${resetUrl} or use code: ${resetToken}`,
      });

      console.log('Password reset email sent:', info.messageId);
      if (isEthereal) {
        console.log('Ethereal Preview URL:', nodemailer.getTestMessageUrl(info));
      }

      return { success: true, info };
    } catch (err) {
      console.error('Failed to send reset password email', err && err.message ? err.message : err);
      return { success: false, error: err && err.message ? err.message : err };
    }
  },
};

export default notificationService;
