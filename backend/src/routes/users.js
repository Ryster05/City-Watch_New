import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/avatars';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// PATCH /api/users/profile - Update user profile
router.patch('/profile', authenticate, upload.single('avatar'), async (req, res) => {
  try {
    const { name, password } = req.body;
    const updateFields = {};

    if (name) {
      updateFields.name = name;
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateFields.passwordHash = await bcrypt.hash(password, salt);
    }

    if (req.file) {
      // If user already has an avatar, delete it
      if (req.user.avatarPath) {
        const oldAvatarPath = path.join(process.cwd(), req.user.avatarPath);
        if (fs.existsSync(oldAvatarPath)) {
          fs.unlinkSync(oldAvatarPath);
        }
      }
      updateFields.avatarPath = req.file.path.replace(/\\/g, '/');
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateFields,
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarPath: user.avatarPath
      }
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/users/profile/avatar/:filename - Serve avatar images
router.get('/profile/avatar/:filename', (req, res) => {
  const filepath = path.join(process.cwd(), 'uploads/avatars', req.params.filename);
  res.sendFile(filepath);
});

export default router;