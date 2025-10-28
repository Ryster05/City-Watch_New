import express from 'express';
import ExcelJS from 'exceljs';
import User from '../models/User.js'; // adjust the path to your user model if needed

const router = express.Router();

router.get('/export', async (req, res) => {
  try {
    const users = await User.find();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Users');

    worksheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Date Registered', key: 'createdAt', width: 20 },
    ];

    users.forEach((user) => {
      worksheet.addRow(user);
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="users.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting users:', err);
    res.status(500).json({ message: 'Failed to export users' });
  }
});

export default router;
