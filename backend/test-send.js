import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  // Create test SMTP transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  try {
    // Verify connection
    await transporter.verify();
    console.log('✓ SMTP connection verified');

    // Send test email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_USER, // Send to self for testing
      subject: 'City Watch Email Test',
      text: 'This is a test email from your City Watch application.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto;">
          <h2 style="color:#2a65f5;">City Watch Email Test</h2>
          <p>This is a test email from your City Watch application.</p>
          <p>If you received this, your email configuration is working!</p>
          <hr>
          <p style="color:#666; font-size:12px">Sent from: ${process.env.EMAIL_FROM}</p>
        </div>
      `
    });

    console.log('✓ Test email sent:', info.messageId);
    console.log('Check your Gmail inbox (and Spam folder) for the test message');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.message.includes('auth')) {
      console.log('\nTips for auth errors:');
      console.log('1. Ensure 2-Step Verification is enabled in your Google Account');
      console.log('2. Use an App Password, not your regular Gmail password');
      console.log('3. Check that EMAIL_USER matches your Gmail address exactly');
    }
  }
  
  process.exit();
}

main();