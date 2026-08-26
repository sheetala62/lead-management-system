# Lead Management System

A full-stack Lead Management System developed as part of a technical assessment. The application helps organizations manage customer enquiries by allowing users to create, assign, update, track, and follow up on leads through a simple and responsive web interface.

---

# Live Application

Frontend:
https://cosmic-dragon-fedc5f.netlify.app/login.html

Backend API:
https://lead-management-system-zja6.onrender.com

GitHub Repository:
https://github.com/sheetala62/lead-management-system

---

# Project Overview

This application enables employees to efficiently manage customer enquiries for services such as:

- Website Development
- Mobile Application Development
- SEO
- Digital Marketing
- E-Commerce Solutions

The system provides authentication, lead management, follow-up tracking, dashboard analytics, and search/filter functionality through a REST API.

---

# Technology Stack

## Frontend

- HTML5
- CSS3
- JavaScript (Vanilla JS)

## Backend

- Node.js
- Express.js

## Database

- SQLite

## Authentication

- JSON Web Token (JWT)
- bcrypt

---

# Features

### Authentication

- Secure Login
- JWT Authentication
- Protected Routes

### Dashboard

- Total Leads
- Lead Status Statistics
- Potential Business Value

### Lead Management

- Create Lead
- View Lead
- Edit Lead
- Delete Lead
- Assign Leads
- Update Lead Status

### Search & Filtering

- Search Leads
- Filter by Status
- Filter by Service
- Filter by Assignee
- Sorting
- Pagination

### Follow-up Management

- Add Follow-up
- View Follow-up History

### Database

- SQLite Database
- Automatic Database Creation
- Seeded Admin User

---

# Project Structure

```
lead-management-system/

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
│   ├── lead-details.html
│   ├── css/
│   └── js/
│
├── database/
│   └── schema.sql
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
|--------|----------|-------------|
| POST | /api/auth/login | User Login |
| POST | /api/auth/logout | User Logout |
| GET | /api/dashboard/stats | Dashboard Statistics |
| GET | /api/meta | Metadata |
| GET | /api/leads | Get All Leads |
| GET | /api/leads/:id | Get Single Lead |
| POST | /api/leads | Create Lead |
| PUT | /api/leads/:id | Update Lead |
| DELETE | /api/leads/:id | Delete Lead |
| GET | /api/leads/:id/followups | Get Follow-ups |
| POST | /api/leads/:id/followups | Add Follow-up |

---

# Run the Project Locally

## Clone Repository

```bash
git clone https://github.com/sheetala62/lead-management-system.git
```

## Backend Setup

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
```

Start the backend:

```bash
npm start
```

---

## Frontend Setup

Open the **frontend** folder in VS Code.

Run using **Live Server** or any static server.

Open:

```
login.html
```

---

# Database

The project uses SQLite.

Database schema is available in:

```
database/schema.sql
```

---

# Technical Design

- RESTful API architecture
- JWT-based authentication
- Password hashing using bcrypt
- SQLite relational database
- Parameterized SQL queries
- Modular backend structure
- Separate frontend and backend
- Responsive user interface
- Clean and reusable JavaScript code

---

# Future Improvements

- Email notifications
- Role-based access control
- File attachments
- Advanced dashboard charts
- Export leads to Excel/PDF
- Email reminders for follow-ups

---

# Author

Sheetala Hegde

GitHub:
https://github.com/sheetala62