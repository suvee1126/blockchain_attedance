"""
Firebase Cloud Firestore Integration for Smart Attendance
Handles:
- Firebase Admin SDK Initialization using smart-add-f776e service account
- Cloud Firestore bidirectional sync for students, teachers, sections, subjects, sessions, and attendance
- Real-time password and account data sync to Cloud
- Graceful fallback with clear diagnostic status
"""

import os
import json
from typing import Dict, Any, List, Optional

# Potential paths for Firebase service account credential JSON
POSSIBLE_KEY_PATHS = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "firebase_service_account.json"),
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "firebase_service_account.json"),
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "serviceAccountKey.json"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "serviceAccountKey.json"),
]

_firebase_app = None
_firestore_db = None
_firestore_status_cache = None

def get_service_account_path() -> Optional[str]:
    for path in POSSIBLE_KEY_PATHS:
        if os.path.exists(path):
            return path
    return None

def init_firebase():
    """Initializes the Firebase Admin SDK if service account JSON exists."""
    global _firebase_app, _firestore_db, _firestore_status_cache

    if _firestore_db is not None:
        return _firestore_db

    key_path = get_service_account_path()

    if not key_path and "FIREBASE_CONFIG_JSON" in os.environ:
        try:
            cred_dict = json.loads(os.environ["FIREBASE_CONFIG_JSON"])
            import firebase_admin
            from firebase_admin import credentials, firestore
            if not firebase_admin._apps:
                cred = credentials.Certificate(cred_dict)
                _firebase_app = firebase_admin.initialize_app(cred)
            else:
                _firebase_app = firebase_admin.get_app()
            _firestore_db = firestore.client()
            print("[+] Firebase Cloud Firestore connected successfully via ENV config!")
            return _firestore_db
        except Exception as e:
            print(f"[!] Warning: Firebase ENV initialization error: {e}")
            return None

    if key_path:
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore
            if not firebase_admin._apps:
                cred = credentials.Certificate(key_path)
                _firebase_app = firebase_admin.initialize_app(cred)
            else:
                _firebase_app = firebase_admin.get_app()
            _firestore_db = firestore.client()
            print(f"[+] Firebase Admin initialized using {os.path.basename(key_path)} (Project: {_firebase_app.project_id})")
            return _firestore_db
        except Exception as e:
            print(f"[!] Warning: Failed to initialize Firebase from {key_path}: {e}")
            return None
    else:
        return None

def is_firebase_active() -> bool:
    """Returns True if Firebase Firestore is connected and reachable."""
    global _firestore_status_cache
    db = init_firebase()
    if not db:
        return False
    try:
        # Quick ping to check if (default) database is created
        _ = list(db.collections())
        return True
    except Exception:
        return False

def get_firebase_status() -> Dict[str, Any]:
    """Returns detailed diagnostics of the Firebase setup."""
    key_path = get_service_account_path()
    if not key_path:
        return {
            "configured": False,
            "connected": False,
            "projectId": None,
            "message": "No firebase_service_account.json found."
        }
    
    project_id = "smart-add-f776e"
    try:
        with open(key_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            project_id = data.get("project_id", project_id)
    except Exception:
        pass

    db = init_firebase()
    if not db:
        return {
            "configured": True,
            "connected": False,
            "projectId": project_id,
            "message": "Firebase Admin SDK initialization failed."
        }

    try:
        _ = list(db.collections())
        return {
            "configured": True,
            "connected": True,
            "projectId": project_id,
            "message": f"Connected to Firestore in project '{project_id}'."
        }
    except Exception as e:
        err_msg = str(e)
        if "The database (default) does not exist" in err_msg or "404" in err_msg:
            return {
                "configured": True,
                "connected": False,
                "projectId": project_id,
                "needsFirestoreCreation": True,
                "firestoreConsoleUrl": f"https://console.firebase.google.com/project/{project_id}/firestore",
                "message": f"Service account key is loaded for '{project_id}', but Firestore database needs to be enabled once in Firebase Console. Click 'Create Database' at https://console.firebase.google.com/project/{project_id}/firestore (Select Test Mode)."
            }
        return {
            "configured": True,
            "connected": False,
            "projectId": project_id,
            "message": f"Firebase connection error: {err_msg}"
        }

def sync_doc_to_firebase(collection: str, doc_id: str, data: Dict[str, Any]) -> bool:
    """Syncs a single record/document to Firebase Firestore."""
    db = init_firebase()
    if not db:
        return False
    try:
        db.collection(collection).document(str(doc_id)).set(data, merge=True)
        return True
    except Exception as e:
        # Log concisely without crashing
        return False

def delete_doc_from_firebase(collection: str, doc_id: str) -> bool:
    """Deletes a document from Firebase Firestore."""
    db = init_firebase()
    if not db:
        return False
    try:
        db.collection(collection).document(str(doc_id)).delete()
        return True
    except Exception as e:
        return False

def get_collection_from_firebase(collection: str) -> List[Dict[str, Any]]:
    """Retrieves all documents from a Firebase Firestore collection."""
    db = init_firebase()
    if not db:
        return []
    try:
        docs = db.collection(collection).stream()
        return [doc.to_dict() for doc in docs]
    except Exception as e:
        return []

def clear_firebase_collection(collection: str) -> int:
    """Deletes all documents in a collection."""
    db = init_firebase()
    if not db:
        return 0
    count = 0
    try:
        docs = db.collection(collection).limit(200).stream()
        for doc in docs:
            doc.reference.delete()
            count += 1
    except Exception:
        pass
    return count

def clear_all_firebase_data():
    """Clears all smart attendance collections from Firestore."""
    collections = [
        "students", "teachers", "admins", "attendance_records",
        "active_sessions", "nc_records", "blockchain_ledger"
    ]
    total_deleted = 0
    for col in collections:
        total_deleted += clear_firebase_collection(col)
    return total_deleted

def sync_entire_database_to_firebase() -> Dict[str, Any]:
    """Syncs all current SQLite records and Blockchain Ledger to Firebase Cloud."""
    from .database import (
        get_sections, get_subjects, get_teachers,
        get_students, get_active_sessions, get_attendance_records, get_nc_records, get_admins
    )
    from .blockchain import blockchain

    if not is_firebase_active():
        status = get_firebase_status()
        return {
            "success": False,
            "status": "FIREBASE_OFFLINE_OR_NOT_CREATED",
            "message": status.get("message", "Firestore not connected.")
        }

    synced_counts = {}

    # 1. Sections
    for s in get_sections():
        sync_doc_to_firebase("sections", s["id"], s)
    synced_counts["sections"] = len(get_sections())

    # 2. Subjects
    for sub in get_subjects():
        sync_doc_to_firebase("subjects", sub["id"], sub)
    synced_counts["subjects"] = len(get_subjects())

    # 3. Admins
    for a in get_admins():
        sync_doc_to_firebase("admins", a["id"], a)
    synced_counts["admins"] = len(get_admins())

    # 4. Teachers
    for t in get_teachers():
        sync_doc_to_firebase("teachers", t["id"], t)
    synced_counts["teachers"] = len(get_teachers())

    # 5. Students
    for stud in get_students():
        sync_doc_to_firebase("students", stud["id"], stud)
    synced_counts["students"] = len(get_students())

    # 6. Attendance Records
    for att in get_attendance_records():
        sync_doc_to_firebase("attendance_records", att["id"], att)
    synced_counts["attendance_records"] = len(get_attendance_records())

    # 7. Blockchain Blocks
    for block in blockchain.chain:
        sync_doc_to_firebase("blockchain_ledger", f"block_{block.index}", block.to_dict())
    synced_counts["blockchain_blocks"] = len(blockchain.chain)

    return {
        "success": True,
        "status": "SYNCED",
        "synced": synced_counts
    }
