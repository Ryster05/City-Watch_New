import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    address: {
      type: String,
      required: false,
      trim: true,
      maxlength: 300,
    },
    barangay: {
      type: String,
      required: false,
      trim: true,
      maxlength: 150,
    },
    photoPath: {
      type: String,
      required: false,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    location: {
      lat: { type: Number, required: false },
      lng: { type: Number, required: false },
    },
    status: {
      type: String,
      enum: ['new', 'in_progress', 'resolved'],
      default: 'new',
    },
    anonymousReporter: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    resolvedAt: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Report || mongoose.model('Report', reportSchema);


