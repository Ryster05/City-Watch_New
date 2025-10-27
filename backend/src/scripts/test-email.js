import { notificationService } from '../services/notification.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEmailSending() {
  try {
    console.log('Testing email configuration...');
    console.log('Using SMTP settings:');
    console.log('- Host:', process.env.EMAIL_HOST);
    console.log('- Port:', process.env.EMAIL_PORT);
    console.log('- User:', process.env.EMAIL_USER);
    console.log('- From:', process.env.EMAIL_FROM);
    console.log('- Secure:', process.env.EMAIL_SECURE);

    // Test verification email
    console.log('\nSending test verification email...');
    const verifyResult = await notificationService.sendVerificationEmail(
      'test-id',
      process.env.EMAIL_USER, // Send to self
      'Test User',
      '123456'
    );
    console.log('Verification email result:', verifyResult);

    // Test password reset email
    console.log('\nSending test password reset email...');
    const resetResult = await notificationService.sendResetPasswordEmail(
      process.env.EMAIL_USER, // Send to self
      'Test User',
      'test-reset-token-123'
    );
    console.log('Password reset email result:', resetResult);

  } catch (error) {
    console.error('Error during email test:', error);
  }
}

testEmailSending().then(() => {
  console.log('\nEmail test complete');
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});