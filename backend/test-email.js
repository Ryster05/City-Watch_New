import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const testEmail = async (toEmail) => {
  try {
    console.log('Creating SMTP transporter...');
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('✓ SMTP connection verified successfully');

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: `"City Watch" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: 'City Watch - Verify Your Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto;">
          <h2 style="color:#2a65f5;">Verify Your Email</h2>
          <p>Thank you for signing up with City Watch!</p>
          <p>Your verification code is:</p>
          <div style="background:#f5f5f5;padding:15px;border-radius:5px;margin:15px 0;text-align:center;">
            <p style="font-size:24px;font-weight:700;letter-spacing:6px;color:#2a65f5;">${verificationCode}</p>
          </div>
          <p>This code will expire in 1 hour.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <p>— City Watch Team</p>
        </div>
      `
    });

    console.log('✓ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.message.includes('auth')) {
      console.log('\nTroubleshooting tips:');
      console.log('1. Check that your Gmail address is correct in .env');
      console.log('2. Make sure you\'re using an App Password from Google Account settings');
      console.log('3. Verify 2-Step Verification is enabled on your Google Account');
    }
  }
};

// Get email from command line argument or use default test email
const testEmailAddress = process.argv[2] || 'test@example.com';
console.log(`Testing email delivery to: ${testEmailAddress}`);
testEmail(testEmailAddress);