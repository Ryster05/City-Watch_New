import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `report-${unique}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only image files are allowed'));
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 20 * 1024 * 1024 } });

// Multer error handler to surface upload issues as 400s instead of 500s
function handleUploadError(err, req, res, next) {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err && err.message && err.message.toLowerCase().includes('image')) {
    return res.status(400).json({ message: 'Invalid file type. Only image files are allowed.' });
  }
  return res.status(400).json({ message: err.message || 'Upload failed' });
}

// Auth middleware (Bearer token)
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.sub);
    if (!user) return res.status(401).json({ message: 'Invalid token' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}

router.get('/new', (req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Submit Report</title>
      </head>
      <body>
        <h1>Submit a Report</h1>
        <form action="/api/reports" method="post" enctype="multipart/form-data">
          <div>
            <label>Description</label><br />
            <textarea name="description" rows="4" cols="50" required></textarea>
          </div>
          <div>
            <label>Photo</label><br />
            <input type="file" name="photo" accept="image/*" />
          </div>
          <button type="submit">Submit</button>
        </form>
      </body>
    </html>
  `);
});

// Anonymous report submission (no authentication required)
router.post('/anonymous', upload.single('photo'), handleUploadError, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      priority = 'medium',
      address,
      barangay,
      latitude,
      longitude,
      reporterName,
      reporterEmail,
    } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ message: 'Title, description, and category are required' });
    }

    const photo = req.file ? `/uploads/${path.basename(req.file.path)}` : undefined;

    const report = await Report.create({
      title,
      description,
      category,
      priority,
      address,
      barangay,
      photoPath: photo,
      location: {
        lat: latitude ? Number(latitude) : undefined,
        lng: longitude ? Number(longitude) : undefined,
      },
      // Store anonymous reporter info in a separate field
      anonymousReporter: {
        name: reporterName || 'Anonymous',
        email: reporterEmail || null,
      },
    });

    // Create notification for admins when a new report is submitted
    try {
      await Notification.create({
        message: `New report submitted: ${report.title}`,
        reportId: report._id,
        referenceNumber: report._id.toString().slice(-8).toUpperCase(),
        type: 'new_report',
        data: { 
          title: report.title, 
          category: report.category, 
          reporter: report.anonymousReporter,
          reportId: report._id
        },
        forAdmin: true // This will show up in admin notifications
      });
    } catch(e) { console.error('Admin notification error:', e); }

    return res.status(201).json({
      message: 'Report submitted successfully',
      report: {
        id: report._id,
        referenceNumber: report._id.toString().slice(-8).toUpperCase(), // Last 8 chars as reference
        title: report.title,
        description: report.description,
        category: report.category,
        status: report.status,
        priority: report.priority,
        photo,
        address: report.address,
        barangay: report.barangay,
        reportedBy: report.anonymousReporter,
        createdAt: report.createdAt,
      },
    });
  } catch (err) {
    console.error('Create anonymous report error:', err);
    if (err && err.name === 'ValidationError') {
      const errors = Object.values(err.errors || {}).map(e => e.message);
      return res.status(400).json({ message: 'Validation error', errors });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Authenticated report submission
router.post('/', authenticateToken, upload.single('photo'), handleUploadError, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      priority = 'medium',
      address,
      barangay,
      latitude,
      longitude,
    } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ message: 'Title, description, and category are required' });
    }

    const photo = req.file ? `/uploads/${path.basename(req.file.path)}` : undefined;

    const report = await Report.create({
      title,
      description,
      category,
      priority,
      address,
      barangay,
      photoPath: photo,
      createdBy: req.user?._id,
      location: {
        lat: latitude ? Number(latitude) : undefined,
        lng: longitude ? Number(longitude) : undefined,
      },
    });

    // Create notification for admins when a new report is submitted
    try {
      await Notification.create({
        message: `New report submitted: ${report.title}`,
        reportId: report._id,
        referenceNumber: report._id.toString().slice(-8).toUpperCase(),
        type: 'new_report',
        data: { 
          title: report.title, 
          category: report.category, 
          reporter: req.user ? { id: req.user._id, name: req.user.name } : null,
          reportId: report._id
        },
        forAdmin: true // This will show up in admin notifications
      });
    } catch(e) { console.error('Admin notification error:', e); }

    return res.status(201).json({
      message: 'Report submitted successfully',
      report: {
        id: report._id,
        referenceNumber: report._id.toString().slice(-8).toUpperCase(),
        title: report.title,
        description: report.description,
        category: report.category,
        status: report.status,
        priority: report.priority,
        photo,
        address: report.address,
        barangay: report.barangay,
        reportedBy: req.user
          ? { id: req.user._id, name: req.user.name, email: req.user.email }
          : null,
        createdAt: report.createdAt,
      },
    });
  } catch (err) {
    console.error('Create report error:', err);
    if (err && err.name === 'ValidationError') {
      const errors = Object.values(err.errors || {}).map(e => e.message);
      return res.status(400).json({ message: 'Validation error', errors });
    }
    if (err && err.code === 11000) {
      return res.status(400).json({ message: 'Duplicate value for a unique field', details: err.keyValue });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Track report by reference number (public endpoint)
router.get('/track/:referenceNumber', async (req, res) => {
  try {
    const { referenceNumber } = req.params;
    
    // Find report by the last 8 characters of the ID
    const reports = await Report.find({}).sort({ createdAt: -1 });
    const report = reports.find(r => 
      r._id.toString().slice(-8).toUpperCase() === referenceNumber.toUpperCase()
    );

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Populate user info if report was created by authenticated user
    await report.populate('createdBy', 'name email');
    await report.populate('assignedTo', 'name email');

    res.json({
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
        location: report.location,
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
    console.error('Track report error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all reports (public endpoint for viewing)
router.get('/public', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

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
        reportedBy: report.createdBy 
          ? { name: report.createdBy.name }
          : { name: report.anonymousReporter?.name || 'Anonymous' },
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
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
    console.error('Get public reports error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user's own reports (authenticated)
router.get('/my-reports', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const reports = await Report.find({ createdBy: req.user._id })
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Report.countDocuments({ createdBy: req.user._id });

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
        assignedTo: report.assignedTo 
          ? { name: report.assignedTo.name, email: report.assignedTo.email }
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
    console.error('Get user reports error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get report categories
router.get('/categories', (req, res) => {
  const categories = [
    'Road & Infrastructure',
    'Public Safety',
    'Environmental',
    'Utilities',
    'Parks & Recreation',
    'Housing',
    'Traffic & Transportation',
    'Waste Management',
    'Public Health',
    'Other'
  ];
  
  res.json({ categories });
});

// Get public statistics
router.get('/stats', async (req, res) => {
  try {
    const totalReports = await Report.countDocuments();
    const newReports = await Report.countDocuments({ status: 'new' });
    const inProgressReports = await Report.countDocuments({ status: 'in_progress' });
    const resolvedReports = await Report.countDocuments({ status: 'resolved' });

    // Recent reports (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentReports = await Report.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Reports resolved in last 30 days
    const recentResolved = await Report.countDocuments({
      status: 'resolved',
      resolvedAt: { $gte: thirtyDaysAgo }
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
    });
  } catch (err) {
    console.error('Get public stats error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;


