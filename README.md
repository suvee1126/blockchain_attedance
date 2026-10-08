# 🚀 Smart Attendance System (Blockchain Attendance Ledger)

A modern, blockchain-verified attendance tracking web application built with a **Python (FastAPI & SQLite) backend** and an interactive, high-fidelity responsive frontend.

---

## 🛠 Features

- **🔒 Blockchain Cryptographic Ledger**: SHA-256 tamper-proof proof-of-attendance verification for every session and student check-in.
- **📍 Geolocation Radius Verification**: Haversine distance algorithm validating student physical presence relative to the classroom beacon.
- **📱 Live QR Attendance Sessions**: Dynamic countdown timer, animated QR codes, and real-time scanned student roster updates.
- **👨‍🏫 Teacher Dashboard**: Session launcher, live check-in monitoring, disciplinary NC (Non-Compliance) logging, date-wise history.
- **👨‍🎓 Student Dashboard**: Face verification gate, QR code check-in, subject-wise attendance percentages, tamper-proof blockchain badges.
- **🔑 Admin Control Center**: Full management of Sections, Subjects, Teachers, and Students with system network health monitoring.
- **💾 Local SQLite Persistence**: Zero-setup standalone database with automatic migrations and seed data.

---

## ⚡ Quick Start

### 1. Install Requirements
```bash
pip install -r requirements.txt
```

### 2. Run the Application
```bash
python main.py
```
or run with auto-browser launch:
```bash
python run.py
```

- **Web Application**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Interactive Swagger API Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc Specification**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 🔑 Default Credentials

### Administrator
- **Email**: `admin@blockchain.edu`
- **Password**: `admin123`

### Teachers (Pre-seeded)
- `turing@blockchain.edu` (Password: `pass`)
- `ada@blockchain.edu` (Password: `pass`)

### Students (Pre-seeded)
- `john@blockchain.edu` (Password: `pass`)
- `emily@blockchain.edu` (Password: `pass`)
- `marcus@blockchain.edu` (Password: `pass`)

---

## 📂 Project Architecture

```
Smart Attendance/
├── backend/
│   ├── __init__.py
│   ├── database.py       # SQLite database queries & state persistence
│   ├── blockchain.py     # Cryptographic SHA-256 Proof-of-Attendance Ledger
│   ├── models.py         # Pydantic request/response schemas
│   └── main.py           # FastAPI REST API & static web serving
├── src/                  # React UI (Admin, Teacher, Student Dashboards)
├── dist/                 # Compiled production web assets served by Python
├── main.py               # Main Python execution entry point
├── run.py                # Python runner with auto-browser launcher
├── test_api.py           # Automated test suite for Python endpoints
├── requirements.txt      # Python dependencies
└── smart_attendance.db   # SQLite Database
```
>>>>>>> 5d34ea0 (Implement real database authentication, registration, Firebase Firestore sync, and blockchain ledger)
