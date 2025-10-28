import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Target user for user notifications
  referenceNumber: { type: String },
  data: { type: Object },
  read: { type: Boolean, default: false },
  type: { type: String, default: 'report' }, // 'report', 'status_update', etc
  forAdmin: { type: Boolean, default: true }, // true = admin notification, false = user notification
}, { timestamps: true });

export default mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
