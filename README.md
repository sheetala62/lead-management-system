# LeadMS – Full Stack Lead Management System

A modern Full Stack Lead Management System developed to help organizations efficiently manage customer enquiries, assign leads to employees, track follow-ups, monitor lead progress, and analyze business performance through an intuitive dashboard.

---

# Live Demo

### Frontend

https://lead-management-system.hegdesheetala62.workers.dev

### Backend API

https://lead-management-system-1-whf8.onrender.com

### GitHub Repository

https://github.com/sheetala62/lead-management-system

---

# Project Overview

LeadMS is a CRM-style Lead Management application that allows organizations to manage potential customers from initial enquiry to successful conversion.

The system provides secure authentication, lead assignment, follow-up management, employee management, dashboard analytics, search, filtering, and responsive user interfaces for desktop, tablet, and mobile devices.

---

# Tech Stack

## Frontend

- HTML5
- CSS3
- JavaScript (ES6)

## Backend

- Node.js
- Express.js

## Database

- PostgreSQL

## Authentication

- JSON Web Token (JWT)
- bcrypt

## Deployment

- Frontend – Cloudflare Workers (or Netlify if applicable)
- Backend – Render
- Database – Neon PostgreSQL

## Version Control

- Git
- GitHub

---

# Features

## Authentication

- Secure Login
- JWT Authentication
- Protected Routes
- Password Encryption

## Dashboard

- Total Leads
- New Leads
- Won Leads
- Lost Leads
- Revenue Overview
- Lead Status Statistics

## Lead Management

- Add Lead
- View Lead
- Edit Lead
- Delete Lead
- Assign Lead to Employees
- Update Lead Status
- Estimated Business Value
- Remarks

## Lead Status

- New
- Contacted
- Proposal Sent
- Negotiation
- Won
- Lost

## Employees

- Employee Listing
- Lead Assignment

## Follow-ups

- Schedule Follow-ups
- Track Follow-up Activities

## Search & Filter

- Search by Lead Name
- Filter by Status
- Filter by Service
- Filter by Employee
- Sorting

## Profile

- View User Profile

## Settings

- Application Settings

## Responsive Design

- Desktop
- Tablet
- Mobile

---

# Services Supported

- Website Development
- Mobile Application Development
- UI/UX Design
- Digital Marketing
- SEO Optimization
- CRM Development
- Software Development
- E-Commerce Development

---

# Lead Sources

- Website
- WhatsApp
- Facebook
- Instagram
- LinkedIn
- Email
- Referral
- Cold Call

---

# Project Structure

```
lead-management-system/
│
├── backend/
│   ├── server.js
│   ├── src/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── db.js
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── login.html
│   ├── index.html
│   ├── leads.html
│   ├── employees.html
│   ├── followups.html
│   ├── profile.html
│   ├── settings.html
│   ├── css/
│   └── js/
│
├── database/
│   ├── migration.sql
│   └── migration2.sql
│
└── README.md
```

---

# Test Credentials

Username

```
admin
```

Password

```
Admin@123
```

---

# API Endpoints

| Method | Endpoint | Description |
|---------|----------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/dashboard/stats | Dashboard Statistics |
| GET | /api/leads | Get All Leads |
| GET | /api/leads/:id | Get Lead |
| POST | /api/leads | Add Lead |
| PUT | /api/leads/:id | Update Lead |
| DELETE | /api/leads/:id | Delete Lead |
| GET | /api/users | Employee List |
| GET | /api/followups | Follow-up List |

---

# Installation

## Clone Repository

```bash
git clone https://github.com/sheetala62/lead-management-system.git
```

## Backend

```bash
cd backend
npm install
```

Create a `.env` file using `.env.example`.

Example:

```
PORT=5000
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=8h
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@123
CORS_ORIGIN=http://localhost:5500

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lms
```

Run backend

```bash
npm start
```

---

## Frontend

Open the frontend folder.

Run using Live Server.

Open

```
login.html
```

---

# Database

The project uses PostgreSQL as the primary database.

Database scripts are available in

```
database/migration.sql
```

---

# Technical Design

- RESTful API
- JWT Authentication
- bcrypt Password Hashing
- PostgreSQL Database
- Modular Backend Architecture
- Responsive UI
- Clean JavaScript Code
- Role-based Dashboard
- Secure API Communication

---

# Future Enhancements

- Dashboard Charts
- Email Notifications
- File Uploads
- Activity Logs
- Advanced Reports
- Multi-role Permission System
- Dark Mode
- Mobile App

---

# Author

**Sheetala Hegde**

GitHub

https://github.com/sheetala62