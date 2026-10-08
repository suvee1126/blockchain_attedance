from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict

class LoginRequest(BaseModel):
    role: str
    email: str
    password: Optional[str] = ""

class RegisterRequest(BaseModel):
    role: str
    name: str
    email: str
    password: str
    usn: Optional[str] = None
    sectionId: Optional[str] = None
    department: Optional[str] = "Computer Science"
    assignedSubjects: Optional[List[str]] = []
    assignedSections: Optional[List[str]] = []

class SectionCreate(BaseModel):
    id: Optional[str] = None
    name: str
    year: str

class SubjectCreate(BaseModel):
    id: Optional[str] = None
    code: str
    name: str

class TeacherCreate(BaseModel):
    id: Optional[str] = None
    name: str
    email: str
    department: str
    assignedSubjects: Optional[List[str]] = []
    assignedSections: Optional[List[str]] = []
    password: Optional[str] = "pass"

class TeacherAssignmentUpdate(BaseModel):
    assignedSubjects: List[str]
    assignedSections: List[str]

class StudentCreate(BaseModel):
    id: Optional[int] = None
    name: str
    usn: str
    email: str
    sectionId: str
    password: Optional[str] = "pass"

class StartSessionRequest(BaseModel):
    teacherId: str
    subjectId: str
    sectionId: str
    timerMinutes: int
    lat: Optional[float] = 0.0
    lng: Optional[float] = 0.0

class MarkAttendanceRequest(BaseModel):
    sessionId: str
    studentId: int

class StudentCheckInRequest(BaseModel):
    studentId: int
    subjectId: str
    lat: Optional[float] = 0.0
    lng: Optional[float] = 0.0

class NCRecordCreate(BaseModel):
    teacherId: str
    studentId: int
    subjectId: str
    reason: str
    date: Optional[str] = None
