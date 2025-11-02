import mongoose from 'mongoose';

const pendingRegistrationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 60,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  verificationCode: {
    type: String,
    required: true,
  },
  verificationCodeExpires: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 // Document will be automatically deleted after 1 hour
  }
});

export default mongoose.models.PendingRegistration || mongoose.model('PendingRegistration', pendingRegistrationSchema);