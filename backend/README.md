# City Watch - Municipal Issue Reporting Platform

A comprehensive backend API for a municipal issue reporting and tracking platform that allows citizens to report community issues and track their resolution status.

## Features

- **Anonymous Report Submission**: Citizens can submit reports without creating an account
- **User Authentication**: Registered users can create accounts and track their reports
- **Report Tracking**: Track report status using reference numbers
- **Admin Dashboard**: Administrative interface for managing reports and users
- **File Upload**: Support for photo attachments with reports
- **Real-time Statistics**: Public and admin statistics for transparency

## Tech Stack

- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **Multer** for file uploads
- **bcryptjs** for password hashing

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```env
   MONGO_URI=mongodb://127.0.0.1:27017/city_watch_db
   JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
   PORT=3000
   ADMIN_EMAIL=admin@citywatch.com
   ADMIN_PASSWORD=admin123
   ```

4. Start the server:
   ```bash
   npm run dev  # Development mode with nodemon
   # or
   npm start    # Production mode
   ```

5. Set up the initial admin user:
   ```bash
   npm run setup-admin
   ```

## API Endpoints

### Authentication

#### POST `/api/auth/signup`
Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "token": "jwt_token"
}
```

#### POST `/api/auth/login`
Login with email and password.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "token": "jwt_token"
}
```

### Reports

#### POST `/api/reports/anonymous`
Submit a report without authentication.

**Request Body (multipart/form-data):**
```
title: "Pothole on Main Street"
description: "Large pothole causing traffic issues"
category: "Road & Infrastructure"
priority: "medium"
address: "123 Main Street"
latitude: 40.7128
longitude: -74.0060
reporterName: "John Doe" (optional)
reporterEmail: "john@example.com" (optional)
photo: [file] (optional)
```

**Response:**
```json
{
  "message": "Report submitted successfully",
  "report": {
    "id": "report_id",
    "referenceNumber": "ABC12345",
    "title": "Pothole on Main Street",
    "description": "Large pothole causing traffic issues",
    "category": "Road & Infrastructure",
    "status": "new",
    "priority": "medium",
    "photo": "/uploads/report-photo.jpg",
    "address": "123 Main Street",
    "reportedBy": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "createdAt": "2025-01-27T10:00:00.000Z"
  }
}
```

#### POST `/api/reports`
Submit a report with authentication (requires Bearer token).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:** Same as anonymous submission (without reporterName/reporterEmail)

#### GET `/api/reports/track/:referenceNumber`
Track a report using its reference number.

**Response:**
```json
{
  "report": {
    "id": "report_id",
    "referenceNumber": "ABC12345",
    "title": "Pothole on Main Street",
    "description": "Large pothole causing traffic issues",
    "category": "Road & Infrastructure",
    "status": "in_progress",
    "priority": "medium",
    "photo": "/uploads/report-photo.jpg",
    "address": "123 Main Street",
    "location": {
      "lat": 40.7128,
      "lng": -74.0060
    },
    "reportedBy": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "assignedTo": {
      "name": "Jane Smith",
      "email": "jane@city.gov"
    },
    "adminNotes": "Work crew assigned, estimated completion in 3 days",
    "createdAt": "2025-01-27T10:00:00.000Z",
    "updatedAt": "2025-01-28T14:30:00.000Z",
    "resolvedAt": null
  }
}
```

#### GET `/api/reports/public`
Get all public reports with pagination and filtering.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `status`: Filter by status (new, in_progress, resolved)
- `category`: Filter by category

**Response:**
```json
{
  "reports": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalReports": 50,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### GET `/api/reports/my-reports`
Get authenticated user's reports (requires Bearer token).

#### GET `/api/reports/categories`
Get list of available report categories.

#### GET `/api/reports/stats`
Get public statistics about reports.

### Admin Endpoints

All admin endpoints require Bearer token with admin role.

#### GET `/api/admin/reports`
Get all reports for admin dashboard with advanced filtering.

#### PATCH `/api/admin/reports/:reportId`
Update report status, priority, assignment, or admin notes.

**Request Body:**
```json
{
  "status": "in_progress",
  "priority": "high",
  "assignedTo": "admin_user_id",
  "adminNotes": "Work crew assigned, estimated completion in 3 days"
}
```

#### GET `/api/admin/stats`
Get detailed admin statistics including category and priority breakdowns.

#### GET `/api/admin/users`
Get all users with pagination and role filtering.

#### PATCH `/api/admin/users/:userId`
Update user role or active status.

## Report Categories

- Road & Infrastructure
- Public Safety
- Environmental
- Utilities
- Parks & Recreation
- Housing
- Traffic & Transportation
- Waste Management
- Public Health
- Other

## Report Statuses

- `new`: Newly submitted report
- `in_progress`: Report is being worked on
- `resolved`: Report has been resolved

## Report Priorities

- `low`: Low priority issue
- `medium`: Medium priority issue (default)
- `high`: High priority issue
- `urgent`: Urgent issue requiring immediate attention

## File Upload

- Supported formats: JPEG, PNG, WebP, GIF
- Maximum file size: 5MB
- Files are stored in the `uploads/reports/` directory
- Files are served statically at `/uploads/` endpoint

## Database Schema

### User Model
```javascript
{
  email: String (unique, required)
  passwordHash: String (required)
  name: String (required)
  role: String (enum: ['user', 'admin'], default: 'user')
  isActive: Boolean (default: true)
  createdAt: Date
  updatedAt: Date
}
```

### Report Model
```javascript
{
  title: String (required)
  description: String (required)
  category: String (required)
  priority: String (enum: ['low', 'medium', 'high', 'urgent'])
  address: String (optional)
  photoPath: String (optional)
  createdBy: ObjectId (ref: 'User', optional)
  location: {
    lat: Number (optional)
    lng: Number (optional)
  }
  status: String (enum: ['new', 'in_progress', 'resolved'])
  anonymousReporter: {
    name: String (optional)
    email: String (optional)
  }
  assignedTo: ObjectId (ref: 'User', optional)
  adminNotes: String (optional)
  resolvedAt: Date (optional)
  createdAt: Date
  updatedAt: Date
}
```

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- `400`: Bad Request - Invalid input data
- `401`: Unauthorized - Missing or invalid authentication
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource not found
- `409`: Conflict - Duplicate resource (e.g., email already exists)
- `500`: Internal Server Error - Server-side error

Error response format:
```json
{
  "message": "Error description",
  "errors": ["Detailed validation errors"] // Optional
}
```

## Security Features

- Password hashing with bcryptjs
- JWT token authentication
- Role-based access control
- File upload validation
- Input sanitization and validation
- CORS enabled for cross-origin requests

## Development

To run in development mode with auto-restart:
```bash
npm run dev
```

To set up the initial admin user:
```bash
npm run setup-admin
```

## Production Deployment

1. Set secure environment variables
2. Use a production MongoDB instance
3. Set up proper file storage (consider cloud storage)
4. Configure reverse proxy (nginx)
5. Enable HTTPS
6. Set up monitoring and logging

## License

ISC License
