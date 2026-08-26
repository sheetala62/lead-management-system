# Lead Management System

A full-stack web application for recording, assigning, following up on, and tracking
enquiries for a digital marketing / web development agency. Built for the
"Developer Technical Assessment – Lead Management System" brief.

## Live Demo & Repo (fill these in before submitting)

- Live Application URL: `<add after deployment>`
- GitHub Repository: `<add after pushing>`
- Test credentials: `admin` / `Admin@123`

---

## 1. Technology Stack

| Layer     | Choice                              | Why |
|-----------|--------------------------------------|-----|
| Backend   | Node.js + Express                    | Fast to build a clean REST API with, huge ecosystem, easy to deploy anywhere. |
| Database  | SQLite (`sqlite3`)                   | Zero setup, file-based, no separate DB server to install/configure — perfect for a 72-hour assessment while still being a "proper database" (relational, indexed, ACID). Swappable for Postgres/MySQL later since all access goes through parameterized SQL in one file. |
| Auth      | JWT (JSON Web Tokens) + bcrypt       | Stateless tokens work equally well for a browser frontend and a future mobile app — no server-side session storage needed. Passwords are hashed with bcrypt, never stored in plain text. |
| Frontend  | Vanilla HTML / CSS / JavaScript      | No build step, runs by opening files directly or with a static file server, easy to review in a code editor, and keeps 100% of the logic visible (no framework "magic"). It talks to the backend only through fetch() calls to the REST API — exactly what a mobile app would also do. |

This is a deliberate "keep it simple and inspectable" stack for a scoped assessment.
Everything is designed so any layer (e.g. SQLite → Postgres, or vanilla JS → React)
can be swapped without touching the others, because the contract between them is
just the REST API.

---

## 2. Project Structure

```
lead-management-system/
├── backend/
│   ├── server.js                 # App entry point, mounts routes & middleware
│   ├── src/
│   │   ├── db.js                 # SQLite connection, schema creation, seed data
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT verification middleware
│   │   │   └── errorHandler.js   # Centralized error responses
│   │   ├── routes/
│   │   │   ├── auth.js           # POST /api/auth/login, /logout
│   │   │   ├── leads.js          # Full CRUD + search/filter/sort/pagination
│   │   │   ├── followups.js      # Nested under /api/leads/:id/followups
│   │   │   ├── dashboard.js      # GET /api/dashboard/stats
│   │   │   └── meta.js           # Dropdown option lists (services, statuses...)
│   │   └── utils/
│   │       └── validators.js     # Shared validation rules
│   ├── data/                     # lms.sqlite is created here on first run (gitignored)
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── login.html
│   ├── index.html                # Dashboard
│   ├── leads.html                # Lead listing + add/edit modal
│   ├── lead-details.html         # Lead detail + follow-up history
│   ├── css/style.css
│   └── js/
│       ├── api.js                # Single fetch() wrapper used by every page
│       ├── login.js
│       ├── dashboard.js
│       ├── leads.js
│       └── lead-details.js
├── database/
│   └── schema.sql                # Standalone SQL schema + ER diagram (text form)
├── DESIGN_NOTES.md               # Technical decisions & assumptions
├── STEP_BY_STEP_GUIDE.md         # How to run, develop, and deploy this project
└── README.md                     # This file
```

---

## 3. Running Locally

### Prerequisites
- Node.js 18+ and npm installed
- VS Code (recommended: install the "Live Server" extension for the frontend)

### Backend
```bash
cd backend
npm install
cp .env.example .env      # then edit JWT_SECRET to any long random string
npm start                 # or: npm run dev  (auto-restarts on changes, needs nodemon)
```
The API starts on **http://localhost:5000**. On first run it automatically creates
`data/lms.sqlite`, the tables, the admin user (`admin` / `Admin@123` by default,
configurable in `.env`), and default assignees — no manual DB setup required.

Verify it's running: open http://localhost:5000/api/health in a browser.

### Frontend
The frontend is plain static files — no build step. Two options:

**Option A — VS Code Live Server (easiest)**
1. Open the `frontend` folder in VS Code.
2. Install the "Live Server" extension if you don't have it.
3. Right-click `login.html` → "Open with Live Server".

**Option B — Python's built-in server**
```bash
cd frontend
python3 -m http.server 5500
```
Then open http://localhost:5500/login.html

> If your frontend runs on a port other than 5500, or you deploy the backend
> elsewhere, update `API_BASE_URL` at the top of `frontend/js/api.js`, or set
> `window.LMS_API_BASE_URL` before that script loads.

### Login
Use **admin / Admin@123** (or whatever you set in `backend/.env`).

---

## 4. API Reference

All endpoints below (except `/auth/login` and `/health`) require:
`Authorization: Bearer <token>`

| Method | Endpoint                          | Description |
|--------|------------------------------------|--------------|
| POST   | /api/auth/login                    | Returns `{ token, user }` |
| POST   | /api/auth/logout                   | Stateless no-op for client-side cleanup |
| GET    | /api/meta                          | Dropdown values: services, sources, statuses, follow-up types, assignees |
| GET    | /api/leads                         | List leads. Query: `search, status, service, assignedTo, sortBy, sortDir, page, limit` |
| GET    | /api/leads/:id                     | Single lead |
| POST   | /api/leads                         | Create lead |
| PUT    | /api/leads/:id                     | Update lead |
| DELETE | /api/leads/:id                     | Delete lead (cascades to its follow-ups) |
| GET    | /api/leads/:id/followups            | Follow-up history for a lead |
| POST   | /api/leads/:id/followups            | Add a follow-up entry |
| GET    | /api/dashboard/stats               | Live-computed counts + potential business value |
| GET    | /api/health                        | Uptime check, no auth required |

All responses follow the shape `{ success: boolean, data?, message?, errors? }` so
the frontend (and any future mobile client) can handle them uniformly.

---

## 5. Deployment (see STEP_BY_STEP_GUIDE.md for full walkthrough)

- **Backend**: Render.com (free tier) or Railway.app — both support Node.js apps
  with a persistent disk, which SQLite needs.
- **Frontend**: Netlify, Vercel, or GitHub Pages — any static host works since
  it's plain HTML/CSS/JS.

---

## 6. Testing

Manual test checklist (also see STEP_BY_STEP_GUIDE.md §7):
- Login with correct / incorrect credentials
- Access `leads.html` directly without logging in → redirected to login
- Create a lead with missing required fields → inline validation errors
- Create, edit, delete a lead
- Search, filter by status/service/assignee, sort, paginate
- Add multiple follow-ups to a lead
- Dashboard numbers update after adding/changing leads

A `curl`-based smoke test of every endpoint was run during development
(see DESIGN_NOTES.md for what was verified).
