# MediVault AI

A Secure Personal Health Record Platform for managing medical records, OCR-extracted information, appointments, reminders, secure sharing, and emergency access.

## Tech Stack

- **Frontend:** React.js + Vite + Tailwind CSS
- **Backend:** Node.js + Express.js
- **Database:** PostgreSQL
- **Authentication:** JWT + bcrypt
- **OCR:** Python + FastAPI + Tesseract OCR
- **Version Control:** Git + GitHub

---

# Setup Instructions

## 1. Prerequisites

Install the following before starting:

- Node.js (v20 or higher recommended)
- npm
- PostgreSQL 18
- pgAdmin 4
- Git
- VS Code

---

# 2. Clone the Repository

Open a terminal and run:

```bash
git clone https://github.com/RutujaNimje09/MediVaultAI.git
cd MediVaultAI
```

---

# 3. Backend Setup

Go to the backend folder:

```bash
cd backend
```

Install backend dependencies:

```bash
npm install
```

---

## 4. Create the Backend Environment File

Inside the `backend` folder, create a file named:

```text
.env
```

Add the following:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/medivault
JWT_SECRET=YOUR_SECRET_KEY
UPLOAD_DIR=uploads
```

Replace:

```text
YOUR_POSTGRES_PASSWORD
```

with your local PostgreSQL password.

Example:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/medivault
```

> **Important:** Never commit or upload the `.env` file to GitHub.

---

# 5. Create the PostgreSQL Database

Open **pgAdmin 4**.

Create a database named:

```text
medivault
```

The PostgreSQL server should use:

```text
Host: localhost
Port: 5432
Username: postgres
```

The database name should match the database name in your `.env` file:

```text
medivault
```

---

# 6. Start the Backend

From the `backend` folder:

```bash
npm run dev
```

The backend should run at:

```text
http://localhost:5000
```

To test the backend, open:

```text
http://localhost:5000/api/health
```

Expected response:

```json
{
  "success": true,
  "message": "MediVault backend is running"
}
```

---

# 7. Frontend Setup

Open a **new terminal**.

From the project root:

```bash
cd frontend
```

Install frontend dependencies:

```bash
npm install
```

---

# 8. Start the Frontend

Run:

```bash
npm run dev
```

The frontend will normally run at:

```text
http://localhost:5173
```

Open the address in your browser.

---

# 9. Running the Complete Project

Two terminals are required.

### Terminal 1 — Backend

```bash
cd backend
npm run dev
```

Backend:

```text
http://localhost:5000
```

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Keep both terminals running while developing.

---

# Project Structure

```text
MediVaultAI/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── server.js
│   │
│   ├── uploads/
│   ├── package.json
│   └── .env
│
├── .gitignore
└── README.md
```

---

# Important Security Notes

## Never Commit `.env`

The `.env` file contains:

- PostgreSQL credentials
- JWT secret
- Environment configuration

Each team member must create their own `.env` file locally.

Never upload it to GitHub.

---

## Never Commit Medical Documents

Uploaded medical records and documents are private user data.

Do not upload medical documents to GitHub.

The `uploads/` directory is ignored by Git.

---

# Team Development

Before starting work, always get the latest changes:

```bash
git checkout main
git pull origin main
```

Create a separate branch for your feature:

```bash
git checkout -b feature/your-feature-name
```

Example:

```bash
git checkout -b feature/medical-records
```

After completing your work:

```bash
git add .
git commit -m "Add medical records module"
git push -u origin feature/medical-records
```

Then create a **Pull Request** on GitHub.

Do not directly push feature work to `main`.

---

# Team Module Responsibilities

| Member | Responsibility |
| -------- | ------------------------------------------------------------------- |
| Person 1 | Backend foundation, PostgreSQL, Authentication, JWT, RBAC, Security |
| Person 2 | Medical Records, File Upload, OCR, Search and Filters |
| Person 3 | Timeline, Appointments, Vaccinations, Reminders, Family Profiles |
| Person 4 | Frontend/UI, Dashboard, Secure Sharing, Emergency QR |

---

# Current Project Status

### Completed

- React + Vite frontend setup
- Tailwind CSS setup
- Node.js + Express backend setup
- PostgreSQL installation
- PostgreSQL database connection
- `medivault` database creation
- Environment configuration
- Git repository setup
- GitHub repository setup

### In Development

- Authentication and registration
- JWT authentication
- Role-based access control
- Medical record management
- OCR processing
- Search and filtering
- Medical timeline
- Appointments
- Vaccinations
- Reminders
- Family profiles
- Secure record sharing
- Emergency QR access
- Audit logging

---

# Troubleshooting

## Backend does not start

Make sure PostgreSQL is running and check your `.env` file.

Run:

```bash
npm run dev
```

from the `backend` directory.

---

## Database connection error

Check:

```env
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/medivault
```

Make sure:

- PostgreSQL is running
- Username is correct
- Password is correct
- Database `medivault` exists
- Port is `5432`

---

## Frontend does not start

From the `frontend` directory run:

```bash
npm install
npm run dev
```

---

# License

This project is developed as a college major project.

## MediVault AI

**A Secure Personal Health Record Platform**
