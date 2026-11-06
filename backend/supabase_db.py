"""
Supabase PostgreSQL & REST Integration for Smart Attendance
Replaces Firebase Firestore with Supabase PostgreSQL.
Provides bidirectional sync for students, teachers, sections, subjects, sessions, and attendance.
"""

import os
import json
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = (
    os.environ.get("VITE_SUPABASE_URL") or
    os.environ.get("SUPABASE_URL") or
    "https://qheqjumkbqczmygfymwe.supabase.co"
).rstrip("/")

SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or
    os.environ.get("VITE_SUPABASE_ANON_KEY") or
    os.environ.get("SUPABASE_KEY") or
    "sb_publishable_hp-QiVaif8bW6GDtWzweyw_O3But7xN"
).strip()

_supabase_status_cache = None

def get_supabase_headers() -> Dict[str, str]:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

def is_supabase_active() -> bool:
    """Returns True if Supabase is connected and reachable."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return False
    try:
        url = f"{SUPABASE_URL}/rest/v1/sections?limit=1"
        req = urllib.request.Request(url, headers=get_supabase_headers())
        with urllib.request.urlopen(req, timeout=4) as resp:
            return resp.status in (200, 204)
    except Exception:
        return False

def get_supabase_status() -> Dict[str, Any]:
    """Returns detailed diagnostics of the Supabase setup."""
    global _supabase_status_cache
    if not SUPABASE_URL or not SUPABASE_KEY:
        return {
            "configured": False,
            "connected": False,
            "url": None,
            "message": "Supabase credentials missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env."
        }

    active = is_supabase_active()
    return {
        "configured": True,
        "connected": active,
        "url": SUPABASE_URL,
        "provider": "Supabase PostgreSQL",
        "message": "Connected to Supabase PostgreSQL cloud." if active else "Supabase reachable."
    }

def sync_doc_to_supabase(table: str, doc_id: str, data: Dict[str, Any]) -> bool:
    """Syncs/upserts a single record to Supabase table."""
    if not SUPABASE_URL or not SUPABASE_KEY or not data:
        return False
    try:
        payload = dict(data)

        # Normalize camelCase to snake_case for Supabase PostgreSQL
        key_mappings = {
            "expiresAt": "expires_at",
            "isActive": "is_active",
            "isVerified": "is_verified",
            "faceRegistered": "face_registered",
            "faceDescriptor": "face_descriptor",
            "faceImage": "face_image",
            "faceEnrolledAt": "face_enrolled_at",
            "parentName": "parent_name",
            "parentPhone": "parent_phone",
            "sectionId": "section_id",
            "subjectId": "subject_id",
            "teacherId": "teacher_id",
            "studentId": "student_id",
            "studentName": "student_name",
            "blockchainHash": "blockchain_hash",
            "timerMinutes": "timer_minutes",
            "startedAt": "started_at",
            "presentStudents": "present_students",
            "assignedSubjects": "assigned_subjects",
            "assignedSections": "assigned_sections",
            "teacherLat": "teacher_lat",
            "teacherLng": "teacher_lng",
            "locationLat": "location_lat",
            "locationLng": "location_lng"
        }
        for camel, snake in key_mappings.items():
            if camel in payload:
                payload[snake] = payload.pop(camel)

        if table == "otp_verifications":
            # Primary key is (identifier, purpose), no id column
            payload.pop("id", None)
        elif table == "students":
            if "id" not in payload and doc_id:
                try:
                    payload["id"] = int(doc_id)
                except ValueError:
                    payload["id"] = doc_id
        elif "id" not in payload and doc_id:
            payload["id"] = doc_id

        # Clean JSON fields
        for k in ["assigned_subjects", "assigned_sections", "present_students", "face_descriptor"]:
            if k in payload and isinstance(payload[k], str):
                try:
                    payload[k] = json.loads(payload[k])
                except Exception:
                    pass

        url = f"{SUPABASE_URL}/rest/v1/{table}"
        req_data = json.dumps([payload]).encode("utf-8")
        req = urllib.request.Request(url, data=req_data, headers=get_supabase_headers(), method="POST")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status in (200, 201, 204)
    except Exception as e:
        print(f"[Supabase Sync Error for {table}]:", e)
        return False

def update_doc_in_supabase(table: str, data: Dict[str, Any], filters: Dict[str, str]) -> bool:
    """Updates matching records in Supabase table via PATCH."""
    if not SUPABASE_URL or not SUPABASE_KEY or not data or not filters:
        return False
    try:
        query_parts = [f"{k}=eq.{urllib.parse.quote(str(v))}" for k, v in filters.items()]
        query_str = "&".join(query_parts)
        url = f"{SUPABASE_URL}/rest/v1/{table}?{query_str}"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
        req_data = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(url, data=req_data, headers=headers, method="PATCH")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status in (200, 204)
    except Exception as e:
        print(f"[Supabase Update Error for {table}]:", e)
        return False

def delete_doc_from_supabase(table: str, doc_id: str) -> bool:
    """Deletes a document from Supabase table."""
    if not SUPABASE_URL or not SUPABASE_KEY or not doc_id:
        return False
    try:
        url = f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{urllib.parse.quote(str(doc_id))}"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}"
        }
        req = urllib.request.Request(url, headers=headers, method="DELETE")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status in (200, 204)
    except Exception:
        return False

def get_table_from_supabase(table: str) -> List[Dict[str, Any]]:
    """Retrieves all rows from a Supabase table."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return []
    try:
        url = f"{SUPABASE_URL}/rest/v1/{table}?select=*"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}"
        }
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode("utf-8"))
        return []
    except Exception:
        return []

def clear_all_supabase_data():
    """Clears all records in Supabase tables for reset."""
    tables = ["nc_records", "attendance_records", "active_sessions", "marks", "students", "teachers", "subjects", "sections", "otp_verifications"]
    for t in tables:
        try:
            url = f"{SUPABASE_URL}/rest/v1/{t}?id=neq.placeholder"
            req = urllib.request.Request(url, headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}, method="DELETE")
            urllib.request.urlopen(req, timeout=3)
        except Exception:
            pass

