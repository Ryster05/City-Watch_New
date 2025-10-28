import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// Get user notifications (authenticated)
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    // Get notifications for this specific user that are not admin notifications
    const filter = {
      userId: req.user._id,
      forAdmin: false
    };

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(filter);

    res.json({
      notifications: notifications.map(n => ({
        id: n._id,
        message: n.message,
        type: n.type,
        reportId: n.reportId,
        referenceNumber: n.referenceNumber,
        data: n.data,
        read: n.read,
        createdAt: n.createdAt
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (err) {
    console.error('Get user notifications error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark notification as read
router.patch('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { read } = req.body;

    // Only allow user to update their own notifications
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { read: !!read },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({
      message: 'Notification updated',
      notification: {
        id: notification._id,
        read: notification.read
      }
    });
  } catch (err) {
    console.error('Update notification error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;