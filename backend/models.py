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
    parentName: Optional[str] = ""
    parentPhone: Optional[str] = ""

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
    parentName: Optional[str] = ""
    parentPhone: Optional[str] = ""

class StudentUpdate(BaseModel):
    name: str
    usn: str
    email: str
    sectionId: str
    password: Optional[str] = None
    parentName: Optional[str] = ""
    parentPhone: Optional[str] = ""

class WhatsAppNotificationRequest(BaseModel):
    studentId: int
    parentName: str
    parentPhone: str
    studentName: str
    usn: str
    subjectName: str
    subjectCode: Optional[str] = ""
    sectionName: Optional[str] = ""
    date: Optional[str] = ""
    periodTime: Optional[str] = ""

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

class FaceEnrollRequest(BaseModel):
    studentId: int
    imageData: str

class FaceLoginRequest(BaseModel):
    emailOrUsn: str
    password: Optional[str] = ""
    imageData: str


class MarkItem(BaseModel):
    id: Optional[str] = None
    studentId: int
    studentName: str
    usn: str
    subjectId: str
    subjectCode: str
    subjectName: str
    sectionId: Optional[str] = ''
    cie1: Optional[float] = None
    cie2: Optional[float] = None
    see: Optional[float] = None
    maxCie1: Optional[float] = 50.0
    maxCie2: Optional[float] = 50.0
    maxSee: Optional[float] = 100.0
    updatedBy: Optional[str] = ''
    updatedAt: Optional[str] = ''
    locked: Optional[bool] = False

class MarksBatchRequest(BaseModel):
    marks: List[MarkItem]

class MarksLockRequest(BaseModel):
    subjectId: str
    locked: bool


class SendOtpRequest(BaseModel):
    email: str
    role: str
    purpose: Optional[str] = "verification"

class VerifyOtpRequest(BaseModel):
    email: str
    role: str
    otp: str
    purpose: Optional[str] = "verification"

class ResetPasswordRequest(BaseModel):
    email: str
    role: str
    otp: str
    newPassword: str
    confirmPassword: str

class ToggleUserStatusRequest(BaseModel):
    role: str
    userId: str
    isActive: bool

class AdminResetRequest(BaseModel):
    role: str
    userId: str
    email: str
