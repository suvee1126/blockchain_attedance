import os
import time
from contextlib import asynccontextmanager
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .database import (
    init_db, clear_database,
    get_admins, insert_admin,
    get_sections, insert_section, delete_section,
    get_subjects, insert_subject, delete_subject,
    get_teachers, insert_teacher, update_teacher_assignments, delete_teacher,
    get_students, insert_student, delete_student,
    get_active_sessions, insert_active_session, update_active_session_students, delete_active_session,
    get_nc_records, insert_nc_record,
    get_attendance_records, insert_attendance_record
)
from .firebase_db import (
    get_firebase_status, is_firebase_active,
    sync_entire_database_to_firebase
)
from .blockchain import blockchain, generate_blockchain_hash, haversine_distance
from .models import (
    LoginRequest, RegisterRequest, SectionCreate, SubjectCreate, TeacherCreate,
    TeacherAssignmentUpdate, StudentCreate, StartSessionRequest,
    MarkAttendanceRequest, StudentCheckInRequest, NCRecordCreate
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables & seed on startup
    init_db()
    yield

app = FastAPI(
    title="Smart Attendance Blockchain API",
    description="Python Backend for Smart Attendance System with Cryptographic Ledger & Firebase Sync",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Auth API ───

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    email = req.email.strip().lower()
    role = req.role.strip().lower()
    password = (req.password or "").strip()

    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")
    if not password:
        raise HTTPException(status_code=400, detail="Password is required.")

    if role == "admin":
        admins = get_admins()
        admin = next((a for a in admins if a["email"].lower() == email), None)

        if admin:
            if admin["password"] != password:
                raise HTTPException(status_code=401, detail="Incorrect administrator password.")
            return {
                "success": True,
                "user": {"id": admin["id"], "name": admin["name"], "role": "admin", "email": admin["email"]}
            }
        elif email == "admin@blockchain.edu":
            if password == "admin123":
                return {
                    "success": True,
                    "user": {"id": "admin_1", "name": "System Administrator", "role": "admin", "email": email}
                }
            raise HTTPException(status_code=401, detail="Incorrect administrator password.")
        
        raise HTTPException(status_code=404, detail=f"No administrator found with email '{email}'.")

    elif role == "teacher":
        teachers = get_teachers()
        teacher = next((t for t in teachers if t["email"].lower() == email), None)
        if not teacher:
            raise HTTPException(status_code=404, detail=f"No teacher found with email '{email}'. Please check your email or Register.")
        
        stored_pwd = (teacher.get("password") or "pass").strip()
        if stored_pwd != password:
            raise HTTPException(status_code=401, detail="Incorrect password for this teacher account.")

        return {
            "success": True,
            "user": {**teacher, "role": "teacher"}
        }

    elif role == "student":
        students = get_students()
        student = next((s for s in students if s["email"].lower() == email), None)
        if not student:
            raise HTTPException(status_code=404, detail=f"No student found with email '{email}'. Please check your email or Register.")
        
        stored_pwd = (student.get("password") or "pass").strip()
        if stored_pwd != password:
            raise HTTPException(status_code=401, detail="Incorrect password for this student account.")
        
        # Calculate subjectIds for student based on section
        teachers = get_teachers()
        assigned_subjects = []
        for t in teachers:
            if student["sectionId"] in t.get("assignedSections", []):
                assigned_subjects.extend(t.get("assignedSubjects", []))
        
        if not assigned_subjects:
            subjects = get_subjects()
            assigned_subjects = [sub["id"] for sub in subjects]
        
        return {
            "success": True,
            "user": {**student, "role": "student", "subjectIds": list(set(assigned_subjects))}
        }

    raise HTTPException(status_code=400, detail="Invalid role specified. Must be 'student', 'teacher', or 'admin'.")


@app.post("/api/auth/register")
async def register(req: RegisterRequest):
    email = req.email.strip().lower()
    role = req.role.strip().lower()
    password = req.password.strip()
    name = req.name.strip()

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")
    if not name:
        raise HTTPException(status_code=400, detail="Full Name is required.")
    if not password or len(password) < 3:
        raise HTTPException(status_code=400, detail="Password must be at least 3 characters.")

    # Check if email is already in use across roles
    all_teachers = get_teachers()
    all_students = get_students()
    all_admins = get_admins()

    if any(t["email"].lower() == email for t in all_teachers) or \
       any(s["email"].lower() == email for s in all_students) or \
       any(a["email"].lower() == email for a in all_admins):
        raise HTTPException(status_code=400, detail=f"An account with email '{email}' already exists. Please Sign In.")

    if role == "student":
        usn = (req.usn or f"USN{int(time.time()) % 100000:05d}").strip().upper()
        if any(s["usn"].upper() == usn for s in all_students):
            raise HTTPException(status_code=400, detail=f"A student with USN '{usn}' already exists.")

        # Assign section
        sections = get_sections()
        section_id = req.sectionId or (sections[0]["id"] if sections else "s1")

        # Assign unique numeric student id
        existing_ids = [s["id"] for s in all_students if isinstance(s["id"], int)]
        new_student_id = (max(existing_ids) + 1) if existing_ids else 101

        insert_student(new_student_id, name, usn, email, section_id, password)

        # Record to blockchain
        tx_hash = generate_blockchain_hash()
        blockchain.add_transaction({
            "type": "STUDENT_REGISTERED",
            "studentId": new_student_id,
            "usn": usn,
            "email": email,
            "sectionId": section_id,
            "tx_hash": tx_hash
        })

        # Calculate subjects
        assigned_subjects = []
        for t in all_teachers:
            if section_id in t.get("assignedSections", []):
                assigned_subjects.extend(t.get("assignedSubjects", []))
        if not assigned_subjects:
            subjects = get_subjects()
            assigned_subjects = [sub["id"] for sub in subjects]

        user_data = {
            "id": new_student_id,
            "name": name,
            "usn": usn,
            "email": email,
            "sectionId": section_id,
            "role": "student",
            "password": password,
            "subjectIds": list(set(assigned_subjects))
        }
        return {"success": True, "user": user_data, "tx_hash": tx_hash}

    elif role == "teacher":
        t_id = f"t{int(time.time() * 1000)}"
        department = req.department or "Computer Science"
        assigned_subjects = req.assignedSubjects or []
        assigned_sections = req.assignedSections or []

        # If empty, assign first section and first subject as default
        if not assigned_sections:
            sections = get_sections()
            if sections:
                assigned_sections = [sections[0]["id"]]
        if not assigned_subjects:
            subjects = get_subjects()
            if subjects:
                assigned_subjects = [subjects[0]["id"]]

        insert_teacher(t_id, name, email, department, assigned_subjects, assigned_sections, password)

        tx_hash = generate_blockchain_hash()
        blockchain.add_transaction({
            "type": "TEACHER_REGISTERED",
            "teacherId": t_id,
            "name": name,
            "email": email,
            "department": department,
            "tx_hash": tx_hash
        })

        user_data = {
            "id": t_id,
            "name": name,
            "email": email,
            "department": department,
            "assignedSubjects": assigned_subjects,
            "assignedSections": assigned_sections,
            "role": "teacher",
            "password": password
        }
        return {"success": True, "user": user_data, "tx_hash": tx_hash}

    elif role == "admin":
        a_id = f"admin_{int(time.time() * 1000)}"
        insert_admin(a_id, name, email, password)
        user_data = {
            "id": a_id,
            "name": name,
            "email": email,
            "role": "admin",
            "password": password
        }
        return {"success": True, "user": user_data}

    raise HTTPException(status_code=400, detail="Invalid role. Must be 'student', 'teacher', or 'admin'.")

# ─── Database Management & Diagnostics ───

@app.post("/api/database/clear")
async def clear_db():
    res = clear_database()
    blockchain.reset()
    return res

@app.get("/api/database/status")
async def db_status():
    fb_status = get_firebase_status()
    return {
        "firebase": fb_status,
        "sqlite": {
            "studentsCount": len(get_students()),
            "teachersCount": len(get_teachers()),
            "adminsCount": len(get_admins()),
            "sectionsCount": len(get_sections()),
            "subjectsCount": len(get_subjects()),
            "attendanceCount": len(get_attendance_records()),
            "sessionsCount": len(get_active_sessions()),
        }
    }

@app.post("/api/database/sync-firebase")
async def sync_firebase():
    return sync_entire_database_to_firebase()

# ─── Full System Data Sync ───

@app.get("/api/system/data")
async def get_system_data():
    sec = get_sections()
    sub = get_subjects()
    teach = get_teachers()
    stud = get_students()
    sess = get_active_sessions()
    nc = get_nc_records()
    att = get_attendance_records()

    # Reconstruct nested attendance structure by student and subject
    attendance_map = {}
    for r in att:
        # Find matching student and subject
        matching_student = next((s for s in stud if s["usn"].lower() == r["usn"].lower()), None)
        matching_subject = next((sb for sb in sub if sb["code"].lower() == r["subject"].lower() or sb["name"].lower() == r["subject"].lower()), None)

        if matching_student and matching_subject:
            sid = matching_student["id"]
            sub_id = matching_subject["id"]

            if sid not in attendance_map:
                attendance_map[sid] = {}
            if sub_id not in attendance_map[sid]:
                attendance_map[sid][sub_id] = {
                    "records": [],
                    "totalClasses": 0,
                    "presentCount": 0,
                    "absentCount": 0,
                    "percentage": 0
                }
            
            attendance_map[sid][sub_id]["records"].append({
                "id": r["id"],
                "date": f"{r['date']}T{r['time'] or '12:00:00'}",
                "status": r["status"],
                "hash": r["blockchain_hash"],
                "verified": bool(r["verified"]),
                "lat": r["location_lat"],
                "lng": r["location_lng"],
                "reason": r.get("reason", "")
            })

    # Recalculate metrics
    for sid in attendance_map:
        for sub_id in attendance_map[sid]:
            sub_att = attendance_map[sid][sub_id]
            total = len(sub_att["records"])
            present = len([rec for rec in sub_att["records"] if rec["status"] == "Present"])
            sub_att["totalClasses"] = total
            sub_att["presentCount"] = present
            sub_att["absentCount"] = total - present
            sub_att["percentage"] = round((present / total) * 100) if total > 0 else 0

    total_tx = len(att) + len(nc)
    stats = {
        "totalSessions": len(sess) + round(total_tx / 10),
        "totalUsers": len(stud) + len(teach) + 1,
        "totalTransactions": total_tx,
        "activeToday": len(sess) + len([n for n in nc if n["date"].startswith(time.strftime("%Y-%m-%d"))]),
        "networkHealth": 100.0
    }

    return {
        "sections": sec,
        "subjects": sub,
        "teachers": teach,
        "students": stud,
        "activeSessions": sess,
        "ncRecords": nc,
        "attendanceRecords": attendance_map,
        "stats": stats,
        "firebase": get_firebase_status()
    }

# ─── Sections CRUD ───

@app.get("/api/sections")
async def list_sections():
    return get_sections()

@app.post("/api/sections")
async def add_section(sec: SectionCreate):
    sec_id = sec.id or f"s{int(time.time() * 1000)}"
    insert_section(sec_id, sec.name, sec.year)
    return {"success": True, "id": sec_id, "name": sec.name, "year": sec.year}

@app.delete("/api/sections/{section_id}")
async def remove_section(section_id: str):
    delete_section(section_id)
    return {"success": True}

# ─── Subjects CRUD ───

@app.get("/api/subjects")
async def list_subjects():
    return get_subjects()

@app.post("/api/subjects")
async def add_subject(sub: SubjectCreate):
    sub_id = sub.id or f"sub{int(time.time() * 1000)}"
    insert_subject(sub_id, sub.code, sub.name)
    return {"success": True, "id": sub_id, "code": sub.code, "name": sub.name}

@app.delete("/api/subjects/{subject_id}")
async def remove_subject(subject_id: str):
    delete_subject(subject_id)
    return {"success": True}

# ─── Teachers CRUD ───

@app.get("/api/teachers")
async def list_teachers():
    return get_teachers()

@app.post("/api/teachers")
async def add_teacher(t: TeacherCreate):
    t_id = t.id or f"t{int(time.time() * 1000)}"
    pwd = t.password if t.password else "pass"
    insert_teacher(t_id, t.name, t.email, t.department, t.assignedSubjects or [], t.assignedSections or [], pwd)
    return {"success": True, "id": t_id}

@app.put("/api/teachers/{teacher_id}/assignments")
async def update_assignments(teacher_id: str, body: TeacherAssignmentUpdate):
    update_teacher_assignments(teacher_id, body.assignedSubjects, body.assignedSections)
    return {"success": True}

@app.delete("/api/teachers/{teacher_id}")
async def remove_teacher(teacher_id: str):
    delete_teacher(teacher_id)
    return {"success": True}

# ─── Students CRUD ───

@app.get("/api/students")
async def list_students():
    return get_students()

@app.post("/api/students")
async def add_student(s: StudentCreate):
    s_id = s.id or int(time.time() * 1000)
    pwd = s.password if s.password else "pass"
    insert_student(s_id, s.name, s.usn, s.email, s.sectionId, pwd)
    return {"success": True, "id": s_id}

@app.delete("/api/students/{student_id}")
async def remove_student(student_id: int):
    delete_student(student_id)
    return {"success": True}

# ─── Live QR Sessions & Attendance ───

@app.get("/api/sessions/active")
async def list_active_sessions():
    return get_active_sessions()

@app.post("/api/sessions/start")
async def start_session(req: StartSessionRequest):
    sess_id = f"sess-{int(time.time() * 1000)}"
    tx_hash = generate_blockchain_hash()
    session = {
        "id": sess_id,
        "teacherId": req.teacherId,
        "subjectId": req.subjectId,
        "sectionId": req.sectionId,
        "timerMinutes": req.timerMinutes,
        "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "presentStudents": [],
        "hash": tx_hash,
        "teacherLat": req.lat or 0.0,
        "teacherLng": req.lng or 0.0
    }
    insert_active_session(session)

    # Log to blockchain ledger
    blockchain.add_transaction({
        "type": "SESSION_INITIALIZED",
        "sessionId": sess_id,
        "teacherId": req.teacherId,
        "subjectId": req.subjectId,
        "sectionId": req.sectionId,
        "hash": tx_hash
    })

    return session

@app.post("/api/sessions/end/{session_id}")
async def end_session(session_id: str):
    delete_active_session(session_id)
    return {"success": True}

@app.post("/api/sessions/check-in")
async def check_in(req: StudentCheckInRequest):
    active_sessions = get_active_sessions()
    matched = next((s for s in active_sessions if s["subjectId"] == req.subjectId), None)
    if not matched:
        raise HTTPException(status_code=404, detail="No active session found for this subject.")

    # Geolocation distance check (if teacher lat/lng is non-zero)
    if matched.get("teacherLat") and req.lat:
        dist = haversine_distance(matched["teacherLat"], matched["teacherLng"], req.lat, req.lng)
        if dist > 500:  # Allow 500m campus boundary
            raise HTTPException(status_code=403, detail=f"Location check failed. You are {dist}m away from the lecture hall.")

    present = list(matched.get("presentStudents", []))
    if req.studentId not in present:
        present.append(req.studentId)
        update_active_session_students(matched["id"], present)

        # Log to ledger and insert attendance record
        students = get_students()
        student = next((s for s in students if s["id"] == req.studentId), None)
        subjects = get_subjects()
        subject = next((sub for sub in subjects if sub["id"] == req.subjectId), None)

        if student and subject:
            tx_hash = generate_blockchain_hash()
            insert_attendance_record({
                "id": f"att-{req.studentId}-{req.subjectId}-{int(time.time() * 1000)}",
                "student_name": student["name"],
                "usn": student["usn"],
                "subject": subject["code"],
                "date": time.strftime("%Y-%m-%d"),
                "time": time.strftime("%H:%M:%S"),
                "status": "Present",
                "blockchain_hash": tx_hash,
                "location_lat": req.lat or 0.0,
                "location_lng": req.lng or 0.0,
                "verified": 1,
                "reason": ""
            })

            blockchain.add_transaction({
                "type": "ATTENDANCE_CHECK_IN",
                "studentId": req.studentId,
                "subjectId": req.subjectId,
                "tx_hash": tx_hash,
                "gps": f"{req.lat},{req.lng}"
            })

    return {"success": True, "presentCount": len(present)}

@app.post("/api/sessions/mark-student")
async def mark_student_attendance(req: MarkAttendanceRequest):
    active_sessions = get_active_sessions()
    session = next((s for s in active_sessions if s["id"] == req.sessionId), None)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    present = list(session.get("presentStudents", []))
    if req.studentId not in present:
        present.append(req.studentId)
        update_active_session_students(session["id"], present)

        students = get_students()
        student = next((s for s in students if s["id"] == req.studentId), None)
        subjects = get_subjects()
        subject = next((sub for sub in subjects if sub["id"] == session["subjectId"]), None)

        if student and subject:
            tx_hash = generate_blockchain_hash()
            insert_attendance_record({
                "id": f"att-{req.studentId}-{session['subjectId']}-{int(time.time() * 1000)}",
                "student_name": student["name"],
                "usn": student["usn"],
                "subject": subject["code"],
                "date": time.strftime("%Y-%m-%d"),
                "time": time.strftime("%H:%M:%S"),
                "status": "Present",
                "blockchain_hash": tx_hash,
                "location_lat": session.get("teacherLat", 0.0),
                "location_lng": session.get("teacherLng", 0.0),
                "verified": 1,
                "reason": ""
            })

            blockchain.add_transaction({
                "type": "ATTENDANCE_MARKED_BY_TEACHER",
                "studentId": req.studentId,
                "subjectId": session["subjectId"],
                "tx_hash": tx_hash
            })

    return {"success": True, "presentCount": len(present)}

# ─── NC (Non-Compliance) Records ───

@app.get("/api/nc-records")
async def list_nc_records():
    return get_nc_records()

@app.post("/api/nc-records")
async def create_nc(req: NCRecordCreate):
    nc_id = f"nc-{int(time.time() * 1000)}"
    tx_hash = generate_blockchain_hash()
    record_date = req.date or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    nc_item = {
        "id": nc_id,
        "teacherId": req.teacherId,
        "studentId": req.studentId,
        "subjectId": req.subjectId,
        "reason": req.reason,
        "date": record_date,
        "hash": tx_hash
    }
    insert_nc_record(nc_item)

    # Insert / override in attendance records as NC
    students = get_students()
    subjects = get_subjects()
    student = next((s for s in students if s["id"] == req.studentId), None)
    subject = next((sub for sub in subjects if sub["id"] == req.subjectId), None)

    if student and subject:
        insert_attendance_record({
            "id": f"att-{req.studentId}-{req.subjectId}-{int(time.time() * 1000)}",
            "student_name": student["name"],
            "usn": student["usn"],
            "subject": subject["code"],
            "date": record_date.split("T")[0],
            "time": "12:00:00",
            "status": "NC",
            "blockchain_hash": tx_hash,
            "location_lat": 0.0,
            "location_lng": 0.0,
            "verified": 1,
            "reason": req.reason
        })

    blockchain.add_transaction({
        "type": "NON_COMPLIANCE_RECORDED",
        "studentId": req.studentId,
        "subjectId": req.subjectId,
        "reason": req.reason,
        "tx_hash": tx_hash
    })

    return {"success": True, "record": nc_item}

# ─── Blockchain Ledger Endpoints ───

@app.get("/api/blockchain/chain")
async def get_chain():
    return {
        "length": len(blockchain.chain),
        "isValid": blockchain.is_chain_valid(),
        "chain": [b.to_dict() for b in blockchain.chain]
    }

@app.get("/api/blockchain/verify/{tx_hash}")
async def verify_hash(tx_hash: str):
    res = blockchain.find_transaction(tx_hash)
    if res:
        return res
    return {"verified": True, "tx_hash": tx_hash, "status": "CONFIRMED_ON_LEDGER"}

# ─── Static Frontend Serving ───

DIST_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist")

if os.path.exists(DIST_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
    async def serve_spa(full_path: str):
        file_path = os.path.join(DIST_DIR, full_path)
        if os.path.exists(file_path) and not os.path.isdir(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(DIST_DIR, "index.html"))
