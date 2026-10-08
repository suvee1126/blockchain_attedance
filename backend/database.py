import sqlite3
import json
import os
from typing import List, Dict, Any, Optional
from .firebase_db import (
    sync_doc_to_firebase, delete_doc_from_firebase,
    is_firebase_active, clear_all_firebase_data
)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "smart_attendance.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Sections table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        year TEXT NOT NULL
    );
    """)

    # Subjects table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        name TEXT NOT NULL
    );
    """)

    # Admins table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
    );
    """)

    # Teachers table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS teachers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        department TEXT NOT NULL,
        assigned_subjects TEXT DEFAULT '[]',
        assigned_sections TEXT DEFAULT '[]',
        password TEXT DEFAULT 'pass'
    );
    """)

    # Students table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        usn TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        section_id TEXT NOT NULL,
        password TEXT DEFAULT 'pass'
    );
    """)

    # Active Sessions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS active_sessions (
        id TEXT PRIMARY KEY,
        teacher_id TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        section_id TEXT NOT NULL,
        timer_minutes INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        present_students TEXT DEFAULT '[]',
        hash TEXT NOT NULL,
        teacher_lat REAL DEFAULT 0.0,
        teacher_lng REAL DEFAULT 0.0
    );
    """)

    # NC (Non-Compliance) Records table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS nc_records (
        id TEXT PRIMARY KEY,
        teacher_id TEXT NOT NULL,
        student_id INTEGER NOT NULL,
        subject_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        date TEXT NOT NULL,
        hash TEXT NOT NULL
    );
    """)

    # Attendance Records table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attendance_records (
        id TEXT PRIMARY KEY,
        student_name TEXT NOT NULL,
        usn TEXT NOT NULL,
        subject TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT NOT NULL,
        blockchain_hash TEXT NOT NULL,
        location_lat REAL DEFAULT 0.0,
        location_lng REAL DEFAULT 0.0,
        verified INTEGER DEFAULT 1,
        reason TEXT DEFAULT ''
    );
    """)

    # Blockchain Blocks table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS blockchain_blocks (
        index_num INTEGER PRIMARY KEY,
        timestamp TEXT NOT NULL,
        previous_hash TEXT NOT NULL,
        current_hash TEXT NOT NULL,
        nonce INTEGER NOT NULL,
        data_json TEXT NOT NULL,
        merkle_root TEXT NOT NULL
    );
    """)

    conn.commit()

    # Ensure default admin exists
    cursor.execute("SELECT COUNT(*) FROM admins")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO admins (id, name, email, password) VALUES (?, ?, ?, ?)",
            ('admin_1', 'System Administrator', 'admin@blockchain.edu', 'admin123')
        )
        conn.commit()

    # Ensure default sections exist
    cursor.execute("SELECT COUNT(*) FROM sections")
    if cursor.fetchone()[0] == 0:
        cursor.executemany("INSERT INTO sections (id, name, year) VALUES (?, ?, ?)", [
            ('s1', 'Section A', '4'),
            ('s2', 'Section B', '4'),
            ('s3', 'Section C', '3'),
        ])
        conn.commit()

    # Ensure default subjects exist
    cursor.execute("SELECT COUNT(*) FROM subjects")
    if cursor.fetchone()[0] == 0:
        cursor.executemany("INSERT INTO subjects (id, code, name) VALUES (?, ?, ?)", [
            ('sub1', 'CS801', 'Blockchain Technology & Cryptography'),
            ('sub2', 'CS802', 'Distributed Cloud Architecture'),
            ('sub3', 'CS803', 'Machine Learning & Neural Nets'),
        ])
        conn.commit()

    conn.close()

def clear_database() -> Dict[str, Any]:
    """
    Clears all students, teachers, active sessions, attendance records,
    and non-compliance logs to provide a fresh, clean database.
    Preserves sections, subjects, and the default admin.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM students")
    cursor.execute("DELETE FROM teachers")
    cursor.execute("DELETE FROM active_sessions")
    cursor.execute("DELETE FROM attendance_records")
    cursor.execute("DELETE FROM nc_records")
    cursor.execute("DELETE FROM blockchain_blocks")

    # Reset admin
    cursor.execute("DELETE FROM admins WHERE email != 'admin@blockchain.edu'")
    cursor.execute("SELECT COUNT(*) FROM admins WHERE email = 'admin@blockchain.edu'")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO admins (id, name, email, password) VALUES (?, ?, ?, ?)",
            ('admin_1', 'System Administrator', 'admin@blockchain.edu', 'admin123')
        )

    conn.commit()
    conn.close()

    # Clear Firebase cloud collections if active
    cloud_deleted = clear_all_firebase_data()

    # Re-sync default sections, subjects, and admin
    for s in get_sections():
        sync_doc_to_firebase("sections", s["id"], s)
    for sub in get_subjects():
        sync_doc_to_firebase("subjects", sub["id"], sub)
    for a in get_admins():
        sync_doc_to_firebase("admins", a["id"], a)

    return {
        "status": "CLEARED",
        "message": "Database wiped successfully. Ready for real user registrations.",
        "cloudDeleted": cloud_deleted
    }

# ─── Query Operations ───

def get_admins() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT id, name, email, password FROM admins").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def insert_admin(a_id: str, name: str, email: str, password: str):
    email_clean = email.strip().lower()
    conn = get_db_connection()
    conn.execute(
        "INSERT OR REPLACE INTO admins (id, name, email, password) VALUES (?, ?, ?, ?)",
        (a_id, name.strip(), email_clean, password.strip())
    )
    conn.commit()
    conn.close()
    sync_doc_to_firebase("admins", a_id, {
        "id": a_id, "name": name.strip(), "email": email_clean, "password": password.strip()
    })

def get_sections() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT id, name, year FROM sections").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def insert_section(sec_id: str, name: str, year: str):
    conn = get_db_connection()
    conn.execute("INSERT OR REPLACE INTO sections (id, name, year) VALUES (?, ?, ?)", (sec_id, name, year))
    conn.commit()
    conn.close()
    sync_doc_to_firebase("sections", sec_id, {"id": sec_id, "name": name, "year": year})

def delete_section(sec_id: str):
    conn = get_db_connection()
    conn.execute("DELETE FROM sections WHERE id = ?", (sec_id,))
    conn.commit()
    conn.close()
    delete_doc_from_firebase("sections", sec_id)

def get_subjects() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT id, code, name FROM subjects").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def insert_subject(sub_id: str, code: str, name: str):
    conn = get_db_connection()
    conn.execute("INSERT OR REPLACE INTO subjects (id, code, name) VALUES (?, ?, ?)", (sub_id, code, name))
    conn.commit()
    conn.close()
    sync_doc_to_firebase("subjects", sub_id, {"id": sub_id, "code": code, "name": name})

def delete_subject(sub_id: str):
    conn = get_db_connection()
    conn.execute("DELETE FROM subjects WHERE id = ?", (sub_id,))
    conn.commit()
    conn.close()
    delete_doc_from_firebase("subjects", sub_id)

def get_teachers() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT id, name, email, department, assigned_subjects, assigned_sections, password FROM teachers").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d['assignedSubjects'] = json.loads(d.pop('assigned_subjects') or '[]')
        d['assignedSections'] = json.loads(d.pop('assigned_sections') or '[]')
        result.append(d)
    return result

def insert_teacher(t_id: str, name: str, email: str, department: str, assigned_subjects: list, assigned_sections: list, password: str = "pass"):
    email_clean = email.strip().lower()
    pwd_clean = password.strip() if password else "pass"
    conn = get_db_connection()
    conn.execute(
        "INSERT OR REPLACE INTO teachers (id, name, email, department, assigned_subjects, assigned_sections, password) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (t_id, name.strip(), email_clean, department, json.dumps(assigned_subjects), json.dumps(assigned_sections), pwd_clean)
    )
    conn.commit()
    conn.close()
    sync_doc_to_firebase("teachers", t_id, {
        "id": t_id, "name": name.strip(), "email": email_clean, "department": department,
        "assignedSubjects": assigned_subjects, "assignedSections": assigned_sections,
        "password": pwd_clean
    })

def update_teacher_assignments(t_id: str, assigned_subjects: list, assigned_sections: list):
    conn = get_db_connection()
    conn.execute(
        "UPDATE teachers SET assigned_subjects = ?, assigned_sections = ? WHERE id = ?",
        (json.dumps(assigned_subjects), json.dumps(assigned_sections), t_id)
    )
    conn.commit()
    conn.close()
    sync_doc_to_firebase("teachers", t_id, {
        "id": t_id, "assignedSubjects": assigned_subjects, "assignedSections": assigned_sections
    })

def delete_teacher(t_id: str):
    conn = get_db_connection()
    conn.execute("DELETE FROM teachers WHERE id = ?", (t_id,))
    conn.commit()
    conn.close()
    delete_doc_from_firebase("teachers", t_id)

def get_students() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT id, name, usn, email, section_id, password FROM students").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d['sectionId'] = d.pop('section_id')
        result.append(d)
    return result

def insert_student(s_id: int, name: str, usn: str, email: str, section_id: str, password: str = "pass"):
    email_clean = email.strip().lower()
    usn_clean = usn.strip().upper()
    pwd_clean = password.strip() if password else "pass"
    conn = get_db_connection()
    conn.execute(
        "INSERT OR REPLACE INTO students (id, name, usn, email, section_id, password) VALUES (?, ?, ?, ?, ?, ?)",
        (s_id, name.strip(), usn_clean, email_clean, section_id, pwd_clean)
    )
    conn.commit()
    conn.close()
    sync_doc_to_firebase("students", str(s_id), {
        "id": s_id, "name": name.strip(), "usn": usn_clean, "email": email_clean,
        "sectionId": section_id, "password": pwd_clean
    })

def delete_student(s_id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM students WHERE id = ?", (s_id,))
    conn.commit()
    conn.close()
    delete_doc_from_firebase("students", str(s_id))

def get_active_sessions() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT id, teacher_id, subject_id, section_id, timer_minutes, started_at, present_students, hash, teacher_lat, teacher_lng FROM active_sessions").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        result.append({
            "id": d["id"],
            "teacherId": d["teacher_id"],
            "subjectId": d["subject_id"],
            "sectionId": d["section_id"],
            "timerMinutes": d["timer_minutes"],
            "startedAt": d["started_at"],
            "presentStudents": json.loads(d["present_students"] or '[]'),
            "hash": d["hash"],
            "teacherLat": d["teacher_lat"] or 0.0,
            "teacherLng": d["teacher_lng"] or 0.0
        })
    return result

def insert_active_session(session: Dict[str, Any]):
    conn = get_db_connection()
    conn.execute(
        "INSERT OR REPLACE INTO active_sessions (id, teacher_id, subject_id, section_id, timer_minutes, started_at, present_students, hash, teacher_lat, teacher_lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            session["id"],
            session["teacherId"],
            session["subjectId"],
            session["sectionId"],
            session["timerMinutes"],
            session["startedAt"],
            json.dumps(session.get("presentStudents", [])),
            session["hash"],
            session.get("teacherLat", 0.0),
            session.get("teacherLng", 0.0)
        )
    )
    conn.commit()
    conn.close()
    sync_doc_to_firebase("active_sessions", session["id"], session)

def update_active_session_students(session_id: str, present_students: list):
    conn = get_db_connection()
    conn.execute(
        "UPDATE active_sessions SET present_students = ? WHERE id = ?",
        (json.dumps(present_students), session_id)
    )
    conn.commit()
    conn.close()
    sync_doc_to_firebase("active_sessions", session_id, {"presentStudents": present_students})

def delete_active_session(session_id: str):
    conn = get_db_connection()
    conn.execute("DELETE FROM active_sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()
    delete_doc_from_firebase("active_sessions", session_id)

def get_nc_records() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT id, teacher_id, student_id, subject_id, reason, date, hash FROM nc_records").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        result.append({
            "id": d["id"],
            "teacherId": d["teacher_id"],
            "studentId": d["student_id"],
            "subjectId": d["subject_id"],
            "reason": d["reason"],
            "date": d["date"],
            "hash": d["hash"]
        })
    return result

def insert_nc_record(record: Dict[str, Any]):
    conn = get_db_connection()
    conn.execute(
        "INSERT OR REPLACE INTO nc_records (id, teacher_id, student_id, subject_id, reason, date, hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            record["id"],
            record["teacherId"],
            record["studentId"],
            record["subjectId"],
            record["reason"],
            record["date"],
            record["hash"]
        )
    )
    conn.commit()
    conn.close()
    sync_doc_to_firebase("nc_records", record["id"], record)

def get_attendance_records() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT id, student_name, usn, subject, date, time, status, blockchain_hash, location_lat, location_lng, verified, reason FROM attendance_records").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def insert_attendance_record(record: Dict[str, Any]):
    conn = get_db_connection()
    conn.execute(
        "INSERT OR REPLACE INTO attendance_records (id, student_name, usn, subject, date, time, status, blockchain_hash, location_lat, location_lng, verified, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            record.get("id"),
            record.get("student_name"),
            record.get("usn"),
            record.get("subject"),
            record.get("date"),
            record.get("time"),
            record.get("status"),
            record.get("blockchain_hash"),
            record.get("location_lat", 0.0),
            record.get("location_lng", 0.0),
            1 if record.get("verified", True) else 0,
            record.get("reason", "")
        )
    )
    conn.commit()
    conn.close()
    sync_doc_to_firebase("attendance_records", record.get("id"), record)
