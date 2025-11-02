import express from 'express';
import { authenticateAdmin } from '../middleware/auth.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Get all reports for admin dashboard
router.get('/reports', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category, priority, assignedTo } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    const reports = await Report.find(filter)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Report.countDocuments(filter);

    res.json({
      reports: reports.map(report => ({
        id: report._id,
        referenceNumber: report._id.toString().slice(-8).toUpperCase(),
        title: report.title,
        description: report.description,
        category: report.category,
        status: report.status,
        priority: report.priority,
        photo: report.photoPath,
        address: report.address,
        barangay: report.barangay,
        location: report.location,
        reportedBy: report.createdBy 
          ? { id: report.createdBy._id, name: report.createdBy.name, email: report.createdBy.email }
          : report.anonymousReporter,
        assignedTo: report.assignedTo 
          ? { id: report.assignedTo._id, name: report.assignedTo.name, email: report.assignedTo.email }
          : null,
        adminNotes: report.adminNotes,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        resolvedAt: report.resolvedAt,
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalReports: total,
        hasNext: skip + reports.length < total,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    console.error('Get admin reports error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update report status and assign to admin
router.patch('/reports/:reportId', authenticateAdmin, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, priority, assignedTo, adminNotes } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assignedTo) updateData.assignedTo = assignedTo;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    
    // Set resolvedAt when status is resolved
    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
    }

    const report = await Report.findByIdAndUpdate(
      reportId,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email').populate('assignedTo', 'name email');

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Create notification for report owner when admin updates status
    if (status && report.createdBy && report.createdBy._id) {
      try {
        await Notification.create({
          message: `Your report "${report.title}" status has been updated to ${status}`,
          reportId: report._id,
          userId: report.createdBy._id, // Specific user who will receive this notification
          referenceNumber: report._id.toString().slice(-8).toUpperCase(),
          data: { 
            title: report.title, 
            oldStatus: report.status, 
            newStatus: status,
            reportId: report._id,
            updatedBy: req.user.name // Add admin name who made the update
          },
          type: 'status_update',
          forAdmin: false // This will show up in user notifications
        });
      } catch(e) { console.error('User notification error:', e); }
    }

    res.json({
      message: 'Report updated successfully',
      report: {
        id: report._id,
        referenceNumber: report._id.toString().slice(-8).toUpperCase(),
        title: report.title,
        description: report.description,
        category: report.category,
        status: report.status,
        priority: report.priority,
        photo: report.photoPath,
        address: report.address,
        barangay: report.barangay,
        reportedBy: report.createdBy 
          ? { name: report.createdBy.name, email: report.createdBy.email }
          : report.anonymousReporter,
        assignedTo: report.assignedTo 
          ? { name: report.assignedTo.name, email: report.assignedTo.email }
          : null,
        adminNotes: report.adminNotes,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        resolvedAt: report.resolvedAt,
      },
    });
  } catch (err) {
    console.error('Update report error:', err);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors || {}).map(e => e.message);
      return res.status(400).json({ message: 'Validation error', errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get dashboard statistics
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const totalReports = await Report.countDocuments();
    const newReports = await Report.countDocuments({ status: 'new' });
    const inProgressReports = await Report.countDocuments({ status: 'in_progress' });
    const resolvedReports = await Report.countDocuments({ status: 'resolved' });

    // Reports by category
    const categoryStats = await Report.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Reports by priority
    const priorityStats = await Report.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Recent reports (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentReports = await Report.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // Reports resolved in last 7 days
    const recentResolved = await Report.countDocuments({
      status: 'resolved',
      resolvedAt: { $gte: sevenDaysAgo }
    });

    res.json({
      overview: {
        totalReports,
        newReports,
        inProgressReports,
        resolvedReports,
        recentReports,
        recentResolved,
      },
      categoryStats,
      priorityStats,
    });
  } catch (err) {
    console.error('Get admin stats error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Analytics for charts
// Support a demo mode: ?demo=true returns canned data without authentication (useful for local dev)
router.get('/analytics', (req, res, next) => {
  if (req.query && req.query.demo === 'true') {
    const demo = {
      monthly: [5,3,1,4,7,3,5,4,2,5,2,1],
      categories: { 'Road and Traffic': 18, 'Waste Management': 17, 'Flooding and Drainage': 17, 'Public Safety': 16, 'Utilities': 16, 'Others': 16 },
      totals: { total: 86, pending: 12, inProgress: 18, resolved: 56 }
    };
    return res.json(demo);
  }
  return next();
}, authenticateAdmin, async (req, res) => {
  try {
    const totalReports = await Report.countDocuments();
    const pending = await Report.countDocuments({ status: 'new' });
    const inProgress = await Report.countDocuments({ status: 'in_progress' });
    const resolved = await Report.countDocuments({ status: 'resolved' });

    // Monthly counts for the current year
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const monthlyAgg = await Report.aggregate([
      { $match: { createdAt: { $gte: startOfYear } } },
      { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
      { $sort: { '_id': 1 } }
    ]);
    const monthly = new Array(12).fill(0);
    for (const m of monthlyAgg) {
      const idx = (m._id || 1) - 1;
      if (idx >= 0 && idx < 12) monthly[idx] = m.count;
    }

    // Category breakdown (as percentages)
    const catAgg = await Report.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const categories = {};
    if (totalReports > 0) {
      for (const c of catAgg) {
        const pct = Math.round((c.count / totalReports) * 10000) / 100; // two decimals
        categories[c._id || 'Uncategorized'] = pct;
      }
    }

    res.json({ monthly, categories, totals: { total: totalReports, pending, inProgress, resolved } });
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Notifications
router.get('/notifications', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, unreadOnly } = req.query;
    const skip = (page - 1) * limit;
    const filter = { forAdmin: true };  // Only show admin notifications
    if (unreadOnly === 'true') filter.read = false;

    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
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
        createdAt: n.createdAt,
      })),
      pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / limit), total }
    });
  } catch (err) {
    console.error('Get notifications error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/notifications/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { read } = req.body;
    const notif = await Notification.findByIdAndUpdate(id, { read: !!read }, { new: true });
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Notification updated', notification: { id: notif._id, read: notif.read } });
  } catch (err) {
    console.error('Update notification error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark all notifications as read for admin
router.post('/notifications/mark-all-read', authenticateAdmin, async (req, res) => {
  try {
    await Notification.updateMany(
      { forAdmin: true }, // Only update admin notifications
      { read: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all notifications as read error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a notification (admin only)
router.delete('/notifications/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Find and delete the notification
    const notification = await Notification.findOneAndDelete({
      _id: id,
      forAdmin: true // Only allow deleting admin notifications
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ 
      message: 'Notification deleted successfully',
      id: notification._id 
    });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all users (admin only)
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (role) filter.role = role;

    const users = await User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      users: users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        avatarPath: user.avatarPath
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        hasNext: skip + users.length < total,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create a new user (admin only)
router.post('/users', authenticateAdmin, async (req, res) => {
  try {
    const { name, email, password, role = 'user', isActive = true } = req.body;
    // Only allow creation of admin users
    if (role !== 'admin') {
      return res.status(403).json({ message: 'Only admin users can be created through this endpoint' });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({ name, email, passwordHash, role, isActive });

    res.status(201).json({
      message: 'Admin user created',
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, avatarPath: user.avatarPath }
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a user (admin only)
router.delete('/users/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndDelete(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user role, profile or password (admin only)
router.patch('/users/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, isActive, name, email, password } = req.body;

    const updateData = {};
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (name) updateData.name = name;

    // If email is changing, ensure it's not already taken by another user
    if (email) {
      const existing = await User.findOne({ email: email.toString().toLowerCase(), _id: { $ne: userId } });
      if (existing) {
        return res.status(409).json({ message: 'Email already in use' });
      }
      updateData.email = email.toString().toLowerCase();
    }

    // If password provided, hash it and store as passwordHash
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      updateData.passwordHash = passwordHash;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        avatarPath: user.avatarPath
      },
    });
  } catch (err) {
    console.error('Update user error:', err);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors || {}).map(e => e.message);
      return res.status(400).json({ message: 'Validation error', errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

