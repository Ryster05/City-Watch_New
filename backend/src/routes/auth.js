import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import PendingRegistration from '../models/PendingRegistration.js';
import { notificationService } from '../services/notification.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role = 'user' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Validate role
    if (role && !['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be either "user" or "admin"' });
    }

    // Check if email is already in use (either in active users or pending registrations)
    const [existingUser, existingPending] = await Promise.all([
      User.findOne({ email }),
      PendingRegistration.findOne({ email })
    ]);

    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    if (existingPending) {
      // If there's a pending registration, delete it so we can create a new one
      await PendingRegistration.deleteOne({ _id: existingPending._id });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate verification code
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const verificationCodeExpires = new Date(Date.now() + 3600000); // 1 hour

    // Create pending registration instead of actual user
    const pending = await PendingRegistration.create({
      name,
      email,
      passwordHash,
      role,
      verificationCode,
      verificationCodeExpires
    });

    // Send verification email
    const emailResult = await notificationService.sendVerificationEmail(
      pending._id.toString(),
      email,
      name,
      verificationCode
    );

    console.log('sendVerificationEmail result:', emailResult ? (emailResult.messageId || 'sent') : 'not-sent');

    res.status(201).json({
      message: 'Registration pending! Please check your email and verify your address to complete signup.',
      email: pending.email
    });
  } catch (err) {
    console.error('Signup error:', err);
    console.error('Error details:', {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    res.status(500).json({ 
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if email is verified. Allow admin accounts to login even if not
    // verified so administrators can access the system without email delivery
    // (useful for local development or when SMTP is not configured).
    if (!user.isEmailVerified && user.role !== 'admin') {
      return res.status(403).json({
        message: 'Please verify your email before logging in',
        needsVerification: true,
        email: user.email
      });
    }

    // Optional: Validate role if provided (for additional security)
    // Note: some clients may send a role field; do not reject login solely because
    // the provided role doesn't match the server record. The admin/user authorization
    // will still be enforced by route middleware (authenticateAdmin / authenticateUser).
    if (role && user.role !== role) {
      console.warn(`Login role mismatch for ${email}: requested='${role}' actual='${user.role}'`);
      // Continue login flow — do not return 403 here to avoid false rejections
    }

    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      user: { id: user._id, name: user.name, email: user.email, role: user.role }, 
      token 
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/auth/profile - Get current user profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/logout - Logout (client-side token removal)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/verify-email - Verify email with code
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

    const pending = await PendingRegistration.findOne({
      email,
      verificationCode: code,
      verificationCodeExpires: { $gt: Date.now() }
    });

    if (!pending) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    // Create the verified user account
    const user = await User.create({
      name: pending.name,
      email: pending.email,
      passwordHash: pending.passwordHash,
      role: pending.role,
      isEmailVerified: true
    });

    // Delete the pending registration
    await PendingRegistration.deleteOne({ _id: pending._id });

    // Generate token for auto-login
    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Email verified and account created successfully',
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token
    });
  } catch (err) {
    console.error('Email verification error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/resend-verification - Resend verification code
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const pending = await PendingRegistration.findOne({ email });
    if (!pending) {
      return res.status(404).json({ message: 'No pending registration found for this email' });
    }

    // Generate new verification code
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const verificationCodeExpires = new Date(Date.now() + 3600000); // 1 hour

    pending.verificationCode = verificationCode;
    pending.verificationCodeExpires = verificationCodeExpires;
    await pending.save();

      // Send new verification code via email
      await notificationService.sendVerificationEmail(
        user._id.toString(),
        email,
        user.name,
        verificationCode
      );

    res.json({
        message: 'Verification code resent successfully. Please check your email.'
    });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/forgot-password
// Creates a reset token and stores it on the user. In production this should
// send an email with a one-time link; for local/dev it returns the token in
// the JSON response so developers can test the flow.
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) {
      // Do not reveal whether the email exists for privacy reasons — but still
      // return a success-style message so clients can display a friendly note.
      return res.json({ message: 'If an account with that email exists, a reset token has been generated.' });
    }

    // Generate a 6-digit reset token
    const token = crypto.randomInt(100000, 999999).toString();
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send reset token via email
    await notificationService.sendResetPasswordEmail(email, user.name, token);
    
    res.json({ message: 'If an account with that email exists, password reset instructions have been sent.' });
  } catch (err) {
    console.error('Forgot-password error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/reset-password
// Accepts { token, newPassword } to update the user's password.
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ message: 'Token and newPassword are required' });

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset-password error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;


