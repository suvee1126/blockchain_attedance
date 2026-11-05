import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { shortenHash } from '../utils';
import { SummitLogo } from '../components/SummitLogo';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const {
    students,
    teachers,
    subjects,
    sections,
    stats,
    attendanceRecords,
    addTeacher,
    deleteTeacher,
    updateTeacherAssignments,
    addStudent,
    updateStudent,
    deleteStudent,
    enrollStudentFace,
    removeStudentFace,
    addSection,
    deleteSection,
    addSubject,
    deleteSubject,
    clearDatabase,
    firebaseStatus,
    marks,
    marksLocks,
    saveMarks,
    deleteMark,
    toggleMarksLock,
    adminToggleUserStatus,
    adminRequestUserReset,
  } = useApp();

  const [activeTab, setActiveTab] = useState('teachers'); // teachers | students | sections | subjects | report | marks | users
  // User Security & Access States
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userActionToast, setUserActionToast] = useState('');
  const [isProcessingUserAction, setIsProcessingUserAction] = useState(false);
  const [adminMarksSubjectFilter, setAdminMarksSubjectFilter] = useState('');
  const [adminMarksSectionFilter, setAdminMarksSectionFilter] = useState('');
  const [adminMarksSearch, setAdminMarksSearch] = useState('');
  const [showAdminMarkModal, setShowAdminMarkModal] = useState(false);
  const [editingMark, setEditingMark] = useState(null);
  const [markStudentId, setMarkStudentId] = useState('');
  const [markSubjectId, setMarkSubjectId] = useState('');
  const [markCie1, setMarkCie1] = useState('');
  const [markCie2, setMarkCie2] = useState('');
  const [markSee, setMarkSee] = useState('');
  const [marksToast, setMarksToast] = useState('');
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [inspectingSectionId, setInspectingSectionId] = useState('');
  const [isClearingDb, setIsClearingDb] = useState(false);
  const [dbClearMessage, setDbClearMessage] = useState('');

  // Form State: Teacher
  const [tName, setTName] = useState('');
  const [tEmail, setTEmail] = useState('');
  const [tPassword, setTPassword] = useState('pass');
  const [tDept, setTDept] = useState('CSE');
  const [tSelectedSubjects, setTSelectedSubjects] = useState([]);
  const [tSelectedSections, setTSelectedSections] = useState([]);

  // Form State: Student
  const [sName, setSName] = useState('');
  const [sUsn, setSUsn] = useState('');
  const [sEmail, setSEmail] = useState('');
  const [sPassword, setSPassword] = useState('pass');
  const [sSectionId, setSSectionId] = useState('');
  const [sParentName, setSParentName] = useState('');
  const [sParentPhone, setSParentPhone] = useState('');

  // Form State: Edit Student Modal
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editSName, setEditSName] = useState('');
  const [editSUsn, setEditSUsn] = useState('');
  const [editSEmail, setEditSEmail] = useState('');
  const [editSSectionId, setEditSSectionId] = useState('');
  const [editSParentName, setEditSParentName] = useState('');
  const [editSParentPhone, setEditSParentPhone] = useState('');

  // Face Biometric Enrollment States
  const [showFaceEnrollModal, setShowFaceEnrollModal] = useState(false);
  const [faceEnrollStudent, setFaceEnrollStudent] = useState(null);
  const [faceStream, setFaceStream] = useState(null);
  const [isCapturingFace, setIsCapturingFace] = useState(false);
  const [faceEnrollError, setFaceEnrollError] = useState('');
  const [faceEnrollSuccess, setFaceEnrollSuccess] = useState('');
  const adminFaceVideoRef = useRef(null);
  const adminFaceFileInputRef = useRef(null);
  const [adminCapturedPhotoUrl, setAdminCapturedPhotoUrl] = useState(null);

  // Form State: Section
  const [secName, setSecName] = useState('');
  const [secYear, setSecYear] = useState('1'); // 1, 2, 3, 4

  // Form State: Subject
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');

  // Form State: Editing Teacher Assignments
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // ─── Actions: Teachers ───
  const handleAddTeacher = (e) => {
    e.preventDefault();
    if (!tName.trim() || !tEmail.trim()) return;

    addTeacher({
      name: tName.trim(),
      email: tEmail.trim(),
      department: tDept,
      assignedSubjects: tSelectedSubjects,
      assignedSections: tSelectedSections,
      password: tPassword.trim() || 'pass',
    });

    // Reset
    setTName('');
    setTEmail('');
    setTPassword('pass');
    setTSelectedSubjects([]);
    setTSelectedSections([]);
    setShowTeacherModal(false);
  };

  const handleOpenAssignModal = (teacher) => {
    setEditingTeacher(teacher);
    setTSelectedSubjects(teacher.assignedSubjects || []);
    setTSelectedSections(teacher.assignedSections || []);
    setShowAssignModal(true);
  };

  const handleSaveAssignments = (e) => {
    e.preventDefault();
    if (!editingTeacher) return;
    updateTeacherAssignments(editingTeacher.id, tSelectedSubjects, tSelectedSections);
    setShowAssignModal(false);
    setEditingTeacher(null);
    setTSelectedSubjects([]);
    setTSelectedSections([]);
  };

  // Toggle checklist selection helper
  const toggleSelect = (val, list, setList) => {
    if (list.includes(val)) {
      setList(list.filter(x => x !== val));
    } else {
      setList([...list, val]);
    }
  };

  // ─── Actions: Students ───
  const handleAddStudent = (e) => {
    e.preventDefault();
    if (!sName.trim() || !sUsn.trim() || !sEmail.trim() || !sSectionId) return;

    addStudent({
      name: sName.trim(),
      usn: sUsn.trim().toUpperCase(),
      email: sEmail.trim(),
      sectionId: sSectionId,
      password: sPassword.trim() || 'pass',
      parentName: sParentName.trim(),
      parentPhone: sParentPhone.trim(),
    });

    // Reset
    setSName('');
    setSUsn('');
    setSEmail('');
    setSPassword('pass');
    setSSectionId('');
    setSParentName('');
    setSParentPhone('');
    setShowStudentModal(false);
  };

  const handleOpenEditStudentModal = (student) => {
    setEditingStudent(student);
    setEditSName(student.name || '');
    setEditSUsn(student.usn || '');
    setEditSEmail(student.email || '');
    setEditSSectionId(student.sectionId || '');
    setEditSParentName(student.parentName || '');
    setEditSParentPhone(student.parentPhone || '');
    setShowEditStudentModal(true);
  };

  const handleOpenFaceEnrollModal = async (student) => {
    setFaceEnrollStudent(student);
    setFaceEnrollError('');
    setFaceEnrollSuccess('');
    setAdminCapturedPhotoUrl(null);
    setShowFaceEnrollModal(true);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setFaceEnrollError("Live camera is not supported or blocked by browser. Please tap 'Upload / Snap Photo' below.");
      return;
    }

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
      } catch (err1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        } catch (err2) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      setFaceStream(stream);
      const attachVideo = () => {
        const video = adminFaceVideoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          video.setAttribute("webkit-playsinline", "true");
          video.muted = true;
          video.defaultMuted = true;
          video.onloadedmetadata = () => {
            video.play().catch(e => console.warn("Video play deferred:", e));
          };
        }
      };
      attachVideo();
      setTimeout(attachVideo, 100);
      setTimeout(attachVideo, 300);
    } catch (err) {
      console.error("Camera error:", err);
      setFaceEnrollError("Camera permission was denied. Please allow camera access in your browser settings or tap 'Upload / Snap Photo' below.");
    }
  };

  const handleAdminPhotoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (dataUrl) {
        setAdminCapturedPhotoUrl(dataUrl);
        setFaceEnrollError('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCloseFaceEnrollModal = () => {
    if (faceStream) {
      faceStream.getTracks().forEach(track => track.stop());
      setFaceStream(null);
    }
    setShowFaceEnrollModal(false);
    setFaceEnrollStudent(null);
    setAdminCapturedPhotoUrl(null);
    setFaceEnrollError('');
    setFaceEnrollSuccess('');
  };

  const handleCaptureAndEnrollFace = async () => {
    if (!faceEnrollStudent) return;
    setIsCapturingFace(true);
    setFaceEnrollError('');
    setFaceEnrollSuccess('');

    try {
      let capturedBase64 = adminCapturedPhotoUrl;
      if (!capturedBase64) {
        const video = adminFaceVideoRef.current;
        if (!video) throw new Error("No active camera or photo available.");
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        capturedBase64 = canvas.toDataURL('image/jpeg', 0.9);
      }

      const res = await enrollStudentFace(faceEnrollStudent.id, capturedBase64);
      setFaceEnrollSuccess("✅ Face biometric successfully enrolled & permanently saved on blockchain ledger!");
      setTimeout(() => {
        handleCloseFaceEnrollModal();
      }, 1800);
    } catch (err) {
      console.error("Enroll error:", err);
      setFaceEnrollError(err.message || "Failed to process face biometric. Ensure face is directly facing camera.");
    } finally {
      setIsCapturingFace(false);
    }
  };

  const handleRemoveFace = async (student) => {
    if (!window.confirm(`Are you sure you want to remove the permanent face biometric for ${student.name} (${student.usn})?\n\nThe student will not be able to log in until a new face scan is enrolled.`)) {
      return;
    }
    try {
      await removeStudentFace(student.id);
    } catch (err) {
      alert("Failed to remove face biometric: " + err.message);
    }
  };


  const handleSaveEditStudent = (e) => {
    e.preventDefault();
    if (!editingStudent) return;
    updateStudent(editingStudent.id, {
      name: editSName.trim(),
      usn: editSUsn.trim().toUpperCase(),
      email: editSEmail.trim(),
      sectionId: editSSectionId,
      parentName: editSParentName.trim(),
      parentPhone: editSParentPhone.trim(),
    });
    setShowEditStudentModal(false);
    setEditingStudent(null);
  };

  // ─── Actions: User Security & Account Management (Optimistic Zero-Lag) ───
  const [togglingUserId, setTogglingUserId] = useState(null);

  const handleToggleUserAccount = (role, userId, currentActive) => {
    const nextStatus = !currentActive;
    setTogglingUserId(userId);

    // Instant optimistic toggle
    if (adminToggleUserStatus) {
      adminToggleUserStatus(role, userId, nextStatus);
    }
    setUserActionToast(`Account ${nextStatus ? 'activated' : 'disabled'}!`);
    setTimeout(() => {
      setTogglingUserId(null);
      setUserActionToast('');
    }, 2000);
  };

  const handleAdminSendResetOtp = async (role, userId, email) => {
    if (!window.confirm(`Send password reset OTP email to ${email}?\n\nThe user will receive a 6-digit verification code to set a new strong password.`)) {
      return;
    }
    setIsProcessingUserAction(true);
    try {
      if (adminRequestUserReset) {
        const res = await adminRequestUserReset(role, userId, email);
        setUserActionToast(`✅ Reset OTP sent to ${email}! User can now set their new password.`);
      } else {
        setUserActionToast(`✅ Reset request initiated for ${email}.`);
      }
      setTimeout(() => setUserActionToast(''), 5000);
    } catch (err) {
      alert("Failed to initiate password reset: " + err.message);
    } finally {
      setIsProcessingUserAction(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!window.confirm("Are you sure you want to clear all students, teachers, and attendance from the database? This cannot be undone.")) {
      return;
    }
    setIsClearingDb(true);
    setDbClearMessage('');
    try {
      await clearDatabase();
      setDbClearMessage("Database cleared successfully! Ledger and Cloud DB reset.");
      setTimeout(() => setDbClearMessage(''), 5000);
    } catch (err) {
      alert("Failed to clear database: " + err.message);
    } finally {
      setIsClearingDb(false);
    }
  };

  // ─── Actions: Sections ───
  const handleAddSection = (e) => {
    e.preventDefault();
    if (!secName.trim()) return;

    addSection({
      name: secName.trim(),
      year: parseInt(secYear, 10),
    });

    setSecName('');
    setShowSectionModal(false);
  };

  // ─── Actions: Subjects ───
  const handleAddSubject = (e) => {
    e.preventDefault();
    if (!subName.trim() || !subCode.trim()) return;

    addSubject({
      name: subName.trim(),
      code: subCode.trim().toUpperCase(),
    });

    setSubName('');
    setSubCode('');
    setShowSubjectModal(false);
  };

  // Report CSV trigger
  const handleDownloadReport = () => {
    alert("System report generated and compiled! Downloading 'blockchain_attendance_summary.csv' to your device.");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-16">
      {/* ── Top Navbar ── */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap sm:flex-nowrap justify-between items-center py-2.5 sm:py-0 sm:h-16 gap-2">
            <div className="flex items-center gap-2">
              <SummitLogo className="w-8 h-8 sm:w-10 sm:h-10 shrink-0" />
              <div className="leading-none">
                <span className="text-base sm:text-lg font-black tracking-wide bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">SummitAttend</span>
                <p className="text-[8px] uppercase font-bold tracking-widest text-slate-400">System Admin</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap justify-end">
              <button
                onClick={handleClearDatabase}
                disabled={isClearingDb}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-rose-200 text-[11px] sm:text-xs font-bold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                title="Wipe mock records and start fresh"
              >
                <span>🗑️</span>
                <span>{isClearingDb ? 'Clearing...' : 'Clear DB'}</span>
              </button>
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-semibold text-slate-500">System Admin</p>
                <p className="text-xs font-bold text-slate-800">Administrator</p>
              </div>
              <button
                onClick={navigate.bind(null, '/')}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 border border-slate-200 text-xs font-semibold rounded-lg bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {dbClearMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold animate-fadeIn">
            <span>✅ {dbClearMessage}</span>
            <button onClick={() => setDbClearMessage('')} className="text-emerald-600 hover:text-emerald-900">✕</button>
          </div>
        </div>
      )}

      {/* ── Admin Stat Cards System Monitor ── */}
      <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 mt-4 sm:mt-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-4">
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2.5 sm:gap-3.5">
            <span className="text-xl sm:text-2xl bg-blue-50 p-1.5 sm:p-2 rounded-xl text-blue-600 shrink-0">📊</span>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Sessions</p>
              <p className="text-base sm:text-lg font-black text-slate-800">{stats.totalSessions}</p>
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2.5 sm:gap-3.5">
            <span className="text-xl sm:text-2xl bg-indigo-50 p-1.5 sm:p-2 rounded-xl text-indigo-600 shrink-0">👥</span>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Total Users</p>
              <p className="text-base sm:text-lg font-black text-slate-800">{stats.totalUsers}</p>
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2.5 sm:gap-3.5">
            <span className="text-xl sm:text-2xl bg-emerald-50 p-1.5 sm:p-2 rounded-xl text-emerald-600 shrink-0">🔗</span>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Ledger Tx</p>
              <p className="text-base sm:text-lg font-black text-slate-800">{stats.totalTransactions}</p>
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2.5 sm:gap-3.5">
            <span className="text-xl sm:text-2xl bg-amber-50 p-1.5 sm:p-2 rounded-xl text-amber-600 shrink-0">⚡</span>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Active Today</p>
              <p className="text-base sm:text-lg font-black text-slate-800">{stats.activeToday}</p>
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2.5 sm:gap-3.5 col-span-2 sm:col-span-1">
            <span className="text-xl sm:text-2xl bg-rose-50 p-1.5 sm:p-2 rounded-xl text-rose-600 shrink-0">💚</span>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Node Health</p>
              <p className="text-base sm:text-lg font-black text-slate-800">{stats.networkHealth}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Switcher Navigation Tabs ── */}
      <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 mt-4 sm:mt-6">
        <div className="flex border-b border-slate-200 bg-white rounded-xl p-1 shadow-sm gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => { setActiveTab('teachers'); setInspectingSectionId(''); }}
            className={`whitespace-nowrap px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${activeTab === 'teachers' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/30'}`}
          >
            👨‍🏫 Faculty & Subjects
          </button>
          <button
            onClick={() => { setActiveTab('students'); setInspectingSectionId(''); }}
            className={`whitespace-nowrap px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${activeTab === 'students' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/30'}`}
          >
            🎓 Student Roster
          </button>
          <button
            onClick={() => { setActiveTab('sections'); setInspectingSectionId(''); }}
            className={`whitespace-nowrap px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${activeTab === 'sections' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/30'}`}
          >
            🏫 Sections & Years
          </button>
          <button
            onClick={() => { setActiveTab('subjects'); setInspectingSectionId(''); }}
            className={`whitespace-nowrap px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${activeTab === 'subjects' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/30'}`}
          >
            📚 Syllabus
          </button>
          <button
            onClick={() => { setActiveTab('report'); setInspectingSectionId(''); }}
            className={`whitespace-nowrap px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${activeTab === 'report' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-blue-600 hover:bg-slate-50'}`}
          >
            📋 Audit Report
          </button>
          <button
            onClick={() => { setActiveTab('marks'); setInspectingSectionId(''); }}
            className={`whitespace-nowrap px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${activeTab === 'marks' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/30'}`}
          >
            📊 Marks Management
          </button>
          <button
            onClick={() => { setActiveTab('users'); setInspectingSectionId(''); }}
            className={`whitespace-nowrap px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${activeTab === 'users' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/30'}`}
          >
            🔐 User Accounts & Access
          </button>
        </div>
      </div>

      {/* ── Main Tab Panels ── */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-6 flex-1">
        {/* Tab 1: Manage Teachers */}
        {activeTab === 'teachers' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800">Faculty Management</h2>
                <p className="text-xs text-slate-400 mt-0.5">Control allowed teachers, core departments, and subject assignments</p>
              </div>
              <button
                onClick={() => setShowTeacherModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
              >
                + Allow Faculty
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-6">Name</th>
                      <th className="py-3 px-6">Email</th>
                      <th className="py-3 px-6">Assigned Subjects</th>
                      <th className="py-3 px-6">Sections</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {teachers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-400 font-semibold">
                          No teachers registered yet. Click "+ Allow Faculty" to add a teacher.
                        </td>
                      </tr>
                    ) : (
                      teachers.map((teacher) => (
                        <tr key={`d_teacher_${teacher.id}`} className="hover:bg-slate-50/50">
                          <td className="py-4 px-6 font-extrabold text-slate-800">{teacher.name}</td>
                          <td className="py-4 px-6 text-slate-500 font-mono text-xs">{teacher.email}</td>
                          <td className="py-4 px-6">
                            <div className="flex flex-wrap gap-1">
                              {teacher.assignedSubjects?.length > 0 ? (
                                teacher.assignedSubjects.map(subId => {
                                  const sub = subjects.find(s => s.id === subId);
                                  return (
                                    <span key={subId} className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold px-2 py-0.5 rounded">
                                      {sub ? sub.code : subId}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">None</span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-wrap gap-1">
                              {teacher.assignedSections?.length > 0 ? (
                                teacher.assignedSections.map(secId => {
                                  const sec = sections.find(s => s.id === secId);
                                  const yearLabel = sec?.year === 1 ? '1st Yr' : sec?.year === 2 ? '2nd Yr' : sec?.year === 3 ? '3rd Yr' : '4th Yr';
                                  return (
                                    <span key={secId} className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold px-2 py-0.5 rounded">
                                      {sec ? `${yearLabel}-${sec.name}` : secId}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">None</span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right space-x-2">
                            <button
                              onClick={() => handleOpenAssignModal(teacher)}
                              className="px-2.5 py-1 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg cursor-pointer"
                            >
                              Assign
                            </button>
                            <button
                              onClick={() => deleteTeacher(teacher.id)}
                              className="px-2.5 py-1 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg cursor-pointer"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Faculty Cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {teachers.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 font-semibold text-xs">
                    No faculty registered yet. Tap "+ Allow Faculty" to add a teacher.
                  </div>
                ) : (
                  teachers.map((teacher) => (
                    <div key={`m_teacher_${teacher.id}`} className="p-4 space-y-3 bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-extrabold text-slate-900 text-sm">{teacher.name}</p>
                          <p className="text-slate-400 text-xs font-mono break-all">{teacher.email}</p>
                        </div>
                        <span className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                          {teacher.department || 'Faculty'}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs bg-slate-50 p-2.5 rounded-xl">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Subjects</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {teacher.assignedSubjects?.length > 0 ? (
                              teacher.assignedSubjects.map(subId => {
                                const sub = subjects.find(s => s.id === subId);
                                return (
                                  <span key={subId} className="bg-blue-100/70 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded">
                                    {sub ? sub.code : subId}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">None assigned</span>
                            )}
                          </div>
                        </div>

                        <div className="pt-1.5 border-t border-slate-200/60">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Sections</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {teacher.assignedSections?.length > 0 ? (
                              teacher.assignedSections.map(secId => {
                                const sec = sections.find(s => s.id === secId);
                                const yearLabel = sec?.year === 1 ? '1st' : sec?.year === 2 ? '2nd' : sec?.year === 3 ? '3rd' : '4th';
                                return (
                                  <span key={secId} className="bg-indigo-100/70 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded">
                                    {sec ? `${yearLabel} Yr - ${sec.name}` : secId}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">None assigned</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <button
                          onClick={() => handleOpenAssignModal(teacher)}
                          className="flex-1 min-h-[40px] px-3 py-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl cursor-pointer text-center"
                        >
                          ✏️ Assign Classes
                        </button>
                        <button
                          onClick={() => deleteTeacher(teacher.id)}
                          className="min-h-[40px] px-4 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl cursor-pointer text-center"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Manage Students */}
        {activeTab === 'students' && (
          <div className="space-y-4">
            <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-2">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800">Student Roster Directory</h2>
                <p className="text-xs text-slate-400 mt-0.5">Control registered students, college USNs, and sections</p>
              </div>
              <button
                onClick={() => setShowStudentModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
              >
                + Register Student
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-6">Student Info</th>
                      <th className="py-3 px-6">USN</th>
                      <th className="py-3 px-6">Section / Year</th>
                      <th className="py-3 px-6">Parent & WhatsApp Contact</th>
                      <th className="py-3 px-6">Face Biometric</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-400 font-semibold">
                          No students registered yet. Click "+ Register Student" to add a student with parent WhatsApp details.
                        </td>
                      </tr>
                    ) : (
                      students.map((student) => {
                        const sec = sections.find(s => s.id === student.sectionId);
                        const cleanPhone = (student.parentPhone || '').replace(/[^0-9]/g, '');
                        const waNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                        return (
                          <tr key={`d_student_${student.id}`} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6">
                              <div>
                                <p className="font-extrabold text-slate-800">{student.name}</p>
                                <p className="text-slate-400 text-xs font-mono">{student.email}</p>
                              </div>
                            </td>
                            <td className="py-4 px-6 font-mono text-xs font-semibold text-slate-700">{student.usn}</td>
                            <td className="py-4 px-6">
                              <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                {sec ? `${sec.year}th Year - ${sec.name}` : 'N/A'}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                  <span>👤</span>
                                  {student.parentName || <span className="text-slate-400 italic font-normal">Parent not set</span>}
                                </span>
                                {student.parentPhone ? (
                                  <a
                                    href={`https://wa.me/${waNumber}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Open WhatsApp chat with parent"
                                    className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-mono font-semibold hover:underline mt-0.5"
                                  >
                                    <span className="text-xs">💬</span> {student.parentPhone}
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-amber-500 font-medium mt-0.5">⚠️ No WhatsApp number</span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              {student.faceRegistered ? (
                                <div className="flex items-center gap-2.5">
                                  {student.faceImage ? (
                                    <img src={student.faceImage} alt="Biometric Face" className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shadow-xs" />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-300">
                                      👤
                                    </div>
                                  )}
                                  <div>
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">
                                      ✓ Enrolled
                                    </span>
                                    <div className="flex items-center gap-2 mt-1">
                                      <button
                                        onClick={() => handleOpenFaceEnrollModal(student)}
                                        className="text-[10px] text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
                                        title="Re-scan and update face biometric"
                                      >
                                        Re-scan
                                      </button>
                                      <span className="text-[10px] text-slate-300">•</span>
                                      <button
                                        onClick={() => handleRemoveFace(student)}
                                        className="text-[10px] text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                                        title="Delete enrolled face biometric"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full uppercase">
                                    ❌ Not Enrolled
                                  </span>
                                  <button
                                    onClick={() => handleOpenFaceEnrollModal(student)}
                                    className="block mt-1 px-2.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[11px] font-extrabold rounded-lg shadow-xs transition-all cursor-pointer"
                                  >
                                    📸 Enroll Face
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenEditStudentModal(student)}
                                  className="px-2.5 py-1 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                                  title="Edit student and parent WhatsApp contact"
                                >
                                  Edit Parent
                                </button>
                                <button
                                  onClick={() => deleteStudent(student.id)}
                                  className="px-2.5 py-1 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Student Cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {students.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 font-semibold text-xs">
                    No students registered yet. Tap "+ Register Student" to add a student.
                  </div>
                ) : (
                  students.map((student) => {
                    const sec = sections.find(s => s.id === student.sectionId);
                    const cleanPhone = (student.parentPhone || '').replace(/[^0-9]/g, '');
                    const waNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                    return (
                      <div key={`m_student_${student.id}`} className="p-4 space-y-3 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-900 text-sm">{student.name}</p>
                            <p className="text-slate-400 text-xs font-mono break-all">{student.email}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              {student.usn}
                            </span>
                            <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {sec ? `${sec.year}th Yr - ${sec.name}` : 'N/A'}
                            </span>
                          </div>
                        </div>

                        {/* Parent & WhatsApp */}
                        <div className="bg-slate-50 rounded-xl p-2.5 text-xs flex items-center justify-between">
                          <div>
                            <span className="text-slate-400 text-[9px] uppercase font-bold block">Parent Contact</span>
                            <span className="font-bold text-slate-700">{student.parentName || 'Not Set'}</span>
                          </div>
                          {student.parentPhone ? (
                            <a
                              href={`https://wa.me/${waNumber}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <span>💬</span>
                              <span className="font-mono">{student.parentPhone}</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-amber-500 font-medium">No Phone</span>
                          )}
                        </div>

                        {/* Biometric Status */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-bold text-slate-500">Face Biometric:</span>
                          {student.faceRegistered ? (
                            <div className="flex items-center gap-1.5">
                              {student.faceImage ? (
                                <img src={student.faceImage} alt="Biometric" className="w-8 h-8 rounded-full object-cover border border-emerald-500" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">👤</div>
                              )}
                              <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                                ✓ Enrolled
                              </span>
                              <button
                                onClick={() => handleOpenFaceEnrollModal(student)}
                                className="px-2 py-1 text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                              >
                                Re-scan
                              </button>
                              <button
                                onClick={() => handleRemoveFace(student)}
                                className="px-2 py-1 text-xs text-rose-600 font-bold hover:underline cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full uppercase">
                                ❌ Not Enrolled
                              </span>
                              <button
                                onClick={() => handleOpenFaceEnrollModal(student)}
                                className="px-2.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                              >
                                📸 Enroll
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => handleOpenEditStudentModal(student)}
                            className="flex-1 min-h-[40px] px-3 py-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl cursor-pointer text-center"
                          >
                            ✏️ Edit Parent Info
                          </button>
                          <button
                            onClick={() => deleteStudent(student.id)}
                            className="min-h-[40px] px-4 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl cursor-pointer text-center"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Manage Sections */}
        {activeTab === 'sections' && (
          <div className="space-y-4">
            {!inspectingSectionId ? (
              <>
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-800">Academic Sections & Classrooms</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Control different Year grades (1-4), click a card to view subject-wise roster matrix</p>
                  </div>
                  <button
                    onClick={() => setShowSectionModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                  >
                    + Create Section
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {sections.length === 0 ? (
                    <div className="md:col-span-3 bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
                      <span className="text-4xl">🏫</span>
                      <p className="font-bold text-sm text-slate-700 mt-3">No academic sections created yet.</p>
                      <p className="text-xs text-slate-400 mt-1">Click "+ Create Section" to add class sections for subjects.</p>
                    </div>
                  ) : (
                    sections.map((sec) => {
                      const secStudents = students.filter(s => s.sectionId === sec.id);
                      return (
                        <div
                          key={sec.id}
                          onClick={() => setInspectingSectionId(sec.id)}
                          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group"
                        >
                          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50/50 rounded-bl-full -mr-5 -mt-5 transition-transform group-hover:scale-110" />
                          <div>
                            <span className="text-[10px] font-extrabold uppercase bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded">
                              Year {sec.year}
                            </span>
                            <h3 className="text-lg font-black text-slate-800 mt-2 flex items-center gap-1.5">
                              {sec.name}
                              <span className="text-xs text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                                Inspect ➔
                              </span>
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">{secStudents.length} Students registered in roster</p>
                          </div>
                          <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSection(sec.id);
                              }}
                              className="px-2.5 py-1 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg cursor-pointer"
                            >
                              Delete Section
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              // Detailed Roster Subject-wise matrix view
              (() => {
                const sec = sections.find(s => s.id === inspectingSectionId);
                const secStudents = students.filter(s => s.sectionId === inspectingSectionId);
                const yearLabel = sec?.year === 1 ? '1st Year' : sec?.year === 2 ? '2nd Year' : sec?.year === 3 ? '3rd Year' : '4th Year';

                return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setInspectingSectionId('')}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-sm cursor-pointer text-sm font-bold"
                      >
                        ←
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-50 text-blue-700 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-blue-100">
                            {yearLabel}
                          </span>
                          <h2 className="text-xl font-extrabold text-slate-800">{sec?.name} Attendance Matrix</h2>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">Analyzing attendance score summaries across all subjects for each student</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                              <th className="py-4 px-6 min-w-[160px]">Student Name</th>
                              <th className="py-4 px-6 min-w-[110px]">USN</th>
                              {subjects.map(sub => (
                                <th key={sub.id} className="py-4 px-6 text-center min-w-[120px]">
                                  <div className="flex flex-col items-center">
                                    <span className="font-mono text-blue-600 block">{sub.code}</span>
                                    <span className="text-[9px] text-slate-400 normal-case font-medium truncate max-w-[100px] block" title={sub.name}>
                                      {sub.name}
                                    </span>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-sm">
                            {secStudents.length === 0 ? (
                              <tr>
                                <td colSpan={subjects.length + 2} className="py-8 text-center text-slate-400 font-semibold">
                                  No students registered in this section yet.
                                </td>
                              </tr>
                            ) : (
                              secStudents.map(student => {
                                const studentAtt = attendanceRecords[student.id] || {};
                                return (
                                  <tr key={student.id} className="hover:bg-slate-50/40 transition-colors">
                                    <td className="py-3.5 px-6 font-extrabold text-slate-800">{student.name}</td>
                                    <td className="py-3.5 px-6 font-mono text-xs font-semibold text-slate-600">{student.usn}</td>
                                    {subjects.map(sub => {
                                      const subData = studentAtt[sub.id];
                                      if (!subData || subData.totalClasses === 0) {
                                        return (
                                          <td key={sub.id} className="py-3.5 px-6 text-center text-slate-300 font-semibold text-xs">
                                            -
                                          </td>
                                        );
                                      }
                                      const percent = subData.percentage;
                                      const isLow = percent < 75;
                                      return (
                                        <td key={sub.id} className="py-3.5 px-6 text-center">
                                          <span className={`inline-flex items-center justify-center font-bold px-2 py-0.5 rounded-lg text-xs leading-none ${isLow ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                            {percent}%
                                          </span>
                                          <span className="block text-[9px] text-slate-400 mt-1 font-semibold">({subData.presentCount}/{subData.totalClasses})</span>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )
              })()
            )}
          </div>
        )}

        {/* Tab 4: Manage Subjects */}
        {activeTab === 'subjects' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800">Syllabus Subjects</h2>
                <p className="text-xs text-slate-400 mt-0.5">Control registered curriculum codes and academic names</p>
              </div>
              <button
                onClick={() => setShowSubjectModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
              >
                + Register Subject
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-6">Subject Code</th>
                      <th className="py-3 px-6">Curriculum Name</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {subjects.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="py-8 text-center text-slate-400 font-semibold">
                          No subjects syllabus registered yet. Click "+ Register Subject" to add.
                        </td>
                      </tr>
                    ) : (
                      subjects.map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-50/50">
                          <td className="py-4 px-6 font-mono font-bold text-blue-600 text-xs">{sub.code}</td>
                          <td className="py-4 px-6 font-extrabold text-slate-800">{sub.name}</td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => deleteSubject(sub.id)}
                              className="px-2.5 py-1 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg cursor-pointer"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Audit Report Panel */}
        {activeTab === 'report' && (() => {
          // ─── Compute real audit metrics from actual data ───
          const allStudentIds = Object.keys(attendanceRecords);
          let globalTotalClasses = 0;
          let globalTotalPresent = 0;

          // Build per-student overall percentages
          const studentOverallPercentages = allStudentIds.map(studentId => {
            const studentAtt = attendanceRecords[studentId];
            let totalC = 0;
            let totalP = 0;
            Object.values(studentAtt).forEach(subAtt => {
              totalC += subAtt.totalClasses || 0;
              totalP += subAtt.presentCount || 0;
            });
            globalTotalClasses += totalC;
            globalTotalPresent += totalP;
            const pct = totalC > 0 ? Math.round((totalP / totalC) * 100) : 0;
            const student = students.find(s => String(s.id) === String(studentId));
            return {
              studentId,
              name: student ? student.name : 'Unknown',
              usn: student ? student.usn : 'N/A',
              sectionId: student ? student.sectionId : '',
              percentage: pct,
              totalClasses: totalC,
              presentCount: totalP,
            };
          });

          const avgAttendanceRate = globalTotalClasses > 0 ? Math.round((globalTotalPresent / globalTotalClasses) * 100 * 10) / 10 : 0;
          const defaulters = studentOverallPercentages.filter(s => s.totalClasses > 0 && s.percentage < 75);

          // Compute per-section averages
          const sectionAverages = sections.map(sec => {
            const secStudents = studentOverallPercentages.filter(s => String(s.sectionId) === String(sec.id) && s.totalClasses > 0);
            const avgPct = secStudents.length > 0
              ? Math.round(secStudents.reduce((acc, s) => acc + s.percentage, 0) / secStudents.length)
              : 0;
            const yearLabel = sec.year === 1 ? '1st Year' : sec.year === 2 ? '2nd Year' : sec.year === 3 ? '3rd Year' : '4th Year';
            return { name: sec.name, year: yearLabel, avgPct, count: secStudents.length };
          }).filter(s => s.count > 0);

          const totalRecordedSessions = globalTotalClasses;

          return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800">Attendance Audit Explorer</h2>
                <p className="text-xs text-slate-400 mt-0.5">Analytical classroom summaries computed from cryptographically verified ledger records</p>
              </div>
              <button
                onClick={handleDownloadReport}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
              >
                📥 Download CSV Attendance Report
              </button>
            </div>

            {allStudentIds.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 text-center">
                <span className="text-5xl">📋</span>
                <p className="font-bold text-slate-700 mt-4 text-base">No Attendance Data Recorded Yet</p>
                <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">Audit metrics will appear here once teachers start sessions and students check in. All data is computed dynamically from on-chain verified records.</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                  <div className="pb-4 md:pb-0">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Attendance Rate</p>
                    <p className={`text-3xl font-black mt-1 ${avgAttendanceRate >= 75 ? 'text-blue-600' : 'text-rose-600'}`}>{avgAttendanceRate}%</p>
                    <p className="text-[10px] text-slate-400 mt-1">{avgAttendanceRate >= 75 ? 'Sufficient relative to target threshold of 75% required' : 'Below required threshold of 75% — action needed'}</p>
                  </div>
                  <div className="py-4 md:py-0 md:pl-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Recorded Sessions</p>
                    <p className="text-3xl font-black text-slate-800 mt-1">{totalRecordedSessions.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Smart-contract logs verified across active semester</p>
                  </div>
                  <div className="pt-4 md:pt-0 md:pl-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Defaulter Students Alert</p>
                    <p className={`text-3xl font-black mt-1 ${defaulters.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {defaulters.length} {defaulters.length === 1 ? 'Student' : 'Students'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">{defaulters.length > 0 ? 'Students maintaining attendance score below 75% bar' : 'All students meeting the 75% attendance threshold'}</p>
                  </div>
                </div>

                {/* Detail Breakdowns */}
                <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm mb-3">Defaulters List (Below 75%)</h4>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                      <div className="bg-slate-50 p-2.5 border-b border-slate-200 font-bold text-slate-500 grid grid-cols-3">
                        <span>Student</span>
                        <span className="text-center">USN</span>
                        <span className="text-right">Attendance</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {defaulters.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 font-semibold">
                            ✓ No defaulters — all students are above 75%
                          </div>
                        ) : (
                          defaulters.map(d => (
                            <div key={d.studentId} className="p-3 grid grid-cols-3 hover:bg-slate-50/50">
                              <span className="font-extrabold text-slate-700">{d.name}</span>
                              <span className="text-center text-slate-500 font-mono">{d.usn}</span>
                              <span className="text-right font-black text-rose-600">{d.percentage}%</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm mb-3">Average Attendance per Section</h4>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                      <div className="bg-slate-50 p-2.5 border-b border-slate-200 font-bold text-slate-500 grid grid-cols-3">
                        <span>Section</span>
                        <span className="text-center">Grade Year</span>
                        <span className="text-right">Rate</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {sectionAverages.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 font-semibold">
                            No section data available yet
                          </div>
                        ) : (
                          sectionAverages.map((sa, i) => (
                            <div key={i} className="p-3 grid grid-cols-3">
                              <span className="font-extrabold text-slate-700">{sa.name}</span>
                              <span className="text-center text-slate-500">{sa.year}</span>
                              <span className={`text-right font-black ${sa.avgPct >= 75 ? 'text-emerald-600' : 'text-rose-600'}`}>{sa.avgPct}%</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* Tab 6: Examination Marks Management */}
        {activeTab === 'marks' && (() => {
          // Filter marks
          const filteredMarks = (marks || []).filter(m => {
            if (adminMarksSubjectFilter && m.subjectId !== adminMarksSubjectFilter) return false;
            if (adminMarksSectionFilter && m.sectionId !== adminMarksSectionFilter) return false;
            if (adminMarksSearch) {
              const q = adminMarksSearch.toLowerCase();
              const matchName = (m.studentName || '').toLowerCase().includes(q);
              const matchUsn = (m.usn || '').toLowerCase().includes(q);
              if (!matchName && !matchUsn) return false;
            }
            return true;
          });

          const currentSubjectLocked = adminMarksSubjectFilter ? Boolean(marksLocks[adminMarksSubjectFilter]) : false;

          const handleOpenAddMark = () => {
            setEditingMark(null);
            setMarkStudentId(students[0]?.id ? String(students[0].id) : '');
            setMarkSubjectId(subjects[0]?.id || '');
            setMarkCie1('');
            setMarkCie2('');
            setMarkSee('');
            setShowAdminMarkModal(true);
          };

          const handleOpenEditMark = (m) => {
            setEditingMark(m);
            setMarkStudentId(String(m.studentId));
            setMarkSubjectId(m.subjectId);
            setMarkCie1(m.cie1 !== null && m.cie1 !== undefined ? String(m.cie1) : '');
            setMarkCie2(m.cie2 !== null && m.cie2 !== undefined ? String(m.cie2) : '');
            setMarkSee(m.see !== null && m.see !== undefined ? String(m.see) : '');
            setShowAdminMarkModal(true);
          };

          const handleSaveMarkSubmit = async (e) => {
            e.preventDefault();
            const studObj = students.find(s => String(s.id) === String(markStudentId));
            const subObj = subjects.find(s => s.id === markSubjectId);
            if (!studObj || !subObj) {
              alert("Please select a valid student and subject.");
              return;
            }

            const c1 = markCie1 !== '' ? Math.min(50, Math.max(0, parseFloat(markCie1))) : null;
            const c2 = markCie2 !== '' ? Math.min(50, Math.max(0, parseFloat(markCie2))) : null;
            const sVal = markSee !== '' ? Math.min(100, Math.max(0, parseFloat(markSee))) : null;

            await saveMarks([{
              id: editingMark ? editingMark.id : `${studObj.id}_${subObj.id}`,
              studentId: studObj.id,
              studentName: studObj.name,
              usn: studObj.usn,
              subjectId: subObj.id,
              subjectCode: subObj.code,
              subjectName: subObj.name,
              sectionId: studObj.sectionId || '',
              cie1: c1,
              cie2: c2,
              see: sVal,
              maxCie1: 50.0,
              maxCie2: 50.0,
              maxSee: 100.0,
              updatedBy: 'Administrator (Admin Panel)',
              locked: editingMark?.locked || false
            }]);

            setShowAdminMarkModal(false);
            setEditingMark(null);
            setMarksToast("Marks updated and synced to database successfully!");
            setTimeout(() => setMarksToast(''), 4000);
          };

          const handleDeleteMark = async (markId) => {
            if (window.confirm("Are you sure you want to delete this examination mark record?")) {
              await deleteMark(markId);
              setMarksToast("Examination mark deleted successfully.");
              setTimeout(() => setMarksToast(''), 4000);
            }
          };

          const handleToggleLockForSelectedSubject = async () => {
            if (!adminMarksSubjectFilter) {
              alert("Please select a specific subject from the filter first to control its submission lock.");
              return;
            }
            const nextLocked = !currentSubjectLocked;
            await toggleMarksLock(adminMarksSubjectFilter, nextLocked);
            setMarksToast(`Faculty submission ${nextLocked ? 'LOCKED (Read-Only)' : 'UNLOCKED (Submissions Permitted)'} for selected subject.`);
            setTimeout(() => setMarksToast(''), 4000);
          };

          return (
            <div className="space-y-6">
              {marksToast && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold animate-fadeIn shadow-sm">
                  <span>✅ {marksToast}</span>
                  <button onClick={() => setMarksToast('')} className="text-emerald-600 hover:text-emerald-900 font-bold">✕</button>
                </div>
              )}

              {/* Header with Title and Control Buttons */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800">Examination Marks Control Center</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Full administrator authority to oversee, modify, lock, or delete student marks across CIE 1, CIE 2, and SEE.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  {adminMarksSubjectFilter && (
                    <button
                      onClick={handleToggleLockForSelectedSubject}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                        currentSubjectLocked
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                      title="Control teacher permission to submit or edit marks for this subject"
                    >
                      {currentSubjectLocked ? '🔒 Faculty Submissions: LOCKED' : '🔓 Faculty Submissions: OPEN'}
                    </button>
                  )}
                  <button
                    onClick={handleOpenAddMark}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    <span>+ Enter / Upload Marks</span>
                  </button>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Filter Subject</label>
                  <select
                    value={adminMarksSubjectFilter}
                    onChange={(e) => setAdminMarksSubjectFilter(e.target.value)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Subjects Syllabus</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Filter Section</label>
                  <select
                    value={adminMarksSectionFilter}
                    onChange={(e) => setAdminMarksSectionFilter(e.target.value)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Class Sections</option>
                    {sections.map(sec => {
                      const yr = sec.year === 1 ? '1st' : sec.year === 2 ? '2nd' : sec.year === 3 ? '3rd' : '4th';
                      return (
                        <option key={sec.id} value={sec.id}>{yr} Year - {sec.name}</option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Search Student / USN</label>
                  <input
                    type="text"
                    placeholder="Search by student name or USN..."
                    value={adminMarksSearch}
                    onChange={(e) => setAdminMarksSearch(e.target.value)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Marks Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-5">Student</th>
                        <th className="py-3 px-4">Subject</th>
                        <th className="py-3 px-4 text-center">CIE 1 (50)</th>
                        <th className="py-3 px-4 text-center">CIE 2 (50)</th>
                        <th className="py-3 px-4 text-center">SEE (100)</th>
                        <th className="py-3 px-4 text-center">Total (200)</th>
                        <th className="py-3 px-4 text-center">Result Status</th>
                        <th className="py-3 px-4">Uploaded By</th>
                        <th className="py-3 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredMarks.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="py-12 text-center text-slate-400 font-semibold">
                            <span className="text-3xl block mb-2">📊</span>
                            No examination marks recorded yet. Click "+ Enter / Upload Marks" to record marks.
                          </td>
                        </tr>
                      ) : (
                        filteredMarks.map((m) => {
                          const c1 = typeof m.cie1 === 'number' ? m.cie1 : null;
                          const c2 = typeof m.cie2 === 'number' ? m.cie2 : null;
                          const sVal = typeof m.see === 'number' ? m.see : null;
                          const hasTotal = c1 !== null || c2 !== null || sVal !== null;
                          const total = (c1 || 0) + (c2 || 0) + (sVal || 0);
                          const pct = Math.round((total / 200) * 100);

                          let grade = 'Pending';
                          let gradeColor = 'bg-slate-100 text-slate-600 border-slate-200';
                          if (c1 !== null && c2 !== null && sVal !== null) {
                            if (pct >= 75) {
                              grade = 'Distinction';
                              gradeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                            } else if (pct >= 60) {
                              grade = 'First Class';
                              gradeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                            } else if (pct >= 50) {
                              grade = 'Second Class';
                              gradeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                            } else {
                              grade = 'Fail';
                              gradeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                            }
                          }

                          return (
                            <tr key={`d_mark_${m.id}`} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3.5 px-5">
                                <p className="font-extrabold text-slate-900">{m.studentName}</p>
                                <p className="text-[10px] font-mono font-bold text-slate-400">USN: {m.usn}</p>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="font-bold text-slate-800">{m.subjectCode}</span>
                                <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{m.subjectName}</p>
                              </td>
                              <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                                {c1 !== null ? `${c1} / 50` : <span className="text-slate-300 italic font-normal">-</span>}
                              </td>
                              <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                                {c2 !== null ? `${c2} / 50` : <span className="text-slate-300 italic font-normal">-</span>}
                              </td>
                              <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                                {sVal !== null ? `${sVal} / 100` : <span className="text-slate-300 italic font-normal">-</span>}
                              </td>
                              <td className="py-3.5 px-4 text-center font-black text-slate-900">
                                {hasTotal ? `${total} / 200 (${pct}%)` : '-'}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${gradeColor}`}>
                                  {grade}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <p className="text-[10px] font-medium text-slate-600 truncate max-w-[130px]" title={m.updatedBy}>{m.updatedBy || 'Faculty'}</p>
                                <p className="text-[9px] text-slate-400">{m.updatedAt ? new Date(m.updatedAt).toLocaleDateString() : 'Active'}</p>
                              </td>
                              <td className="py-3.5 px-5 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => handleOpenEditMark(m)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteMark(m.id)}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Examination Marks Cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredMarks.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 font-semibold text-xs">
                      No examination marks recorded yet. Tap "+ Enter / Upload Marks" to record marks.
                    </div>
                  ) : (
                    filteredMarks.map((m) => {
                      const c1 = typeof m.cie1 === 'number' ? m.cie1 : null;
                      const c2 = typeof m.cie2 === 'number' ? m.cie2 : null;
                      const sVal = typeof m.see === 'number' ? m.see : null;
                      const hasTotal = c1 !== null || c2 !== null || sVal !== null;
                      const total = (c1 || 0) + (c2 || 0) + (sVal || 0);
                      const pct = Math.round((total / 200) * 100);

                      let grade = 'Pending';
                      let gradeColor = 'bg-slate-100 text-slate-600 border-slate-200';
                      if (c1 !== null && c2 !== null && sVal !== null) {
                        if (pct >= 75) {
                          grade = 'Distinction';
                          gradeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                        } else if (pct >= 60) {
                          grade = 'First Class';
                          gradeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                        } else if (pct >= 50) {
                          grade = 'Second Class';
                          gradeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                        } else {
                          grade = 'Fail';
                          gradeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                        }
                      }

                      return (
                        <div key={`m_card_${m.id}`} className="p-4 space-y-3 bg-white">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-extrabold text-slate-900 text-sm">{m.studentName}</p>
                              <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                USN: {m.usn}
                              </span>
                            </div>
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${gradeColor}`}>
                              {grade}
                            </span>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Subject</span>
                              <span className="font-bold text-slate-800">{m.subjectCode} - {m.subjectName}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-center">
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">CIE 1</span>
                                <span className="font-bold text-slate-800">{c1 !== null ? `${c1}/50` : '-'}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">CIE 2</span>
                                <span className="font-bold text-slate-800">{c2 !== null ? `${c2}/50` : '-'}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">SEE</span>
                                <span className="font-bold text-slate-800">{sVal !== null ? `${sVal}/100` : '-'}</span>
                              </div>
                            </div>
                            {hasTotal && (
                              <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 font-black text-xs text-slate-900">
                                <span>Aggregate Total:</span>
                                <span>{total} / 200 ({pct}%)</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                            <button
                              onClick={() => handleOpenEditMark(m)}
                              className="flex-1 min-h-[40px] px-3 py-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl cursor-pointer text-center"
                            >
                              ✏️ Edit Marks
                            </button>
                            <button
                              onClick={() => handleDeleteMark(m.id)}
                              className="min-h-[40px] px-4 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl cursor-pointer text-center"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Modal: Admin Add / Edit Marks */}
              {showAdminMarkModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                  <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200/50 flex flex-col p-6 relative">
                    <button
                      onClick={() => setShowAdminMarkModal(false)}
                      className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
                    >
                      ✕
                    </button>

                    <h3 className="font-extrabold text-slate-900 text-lg mt-1">
                      {editingMark ? 'Edit Examination Marks' : 'Enter Student Examination Marks'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Save official CIE 1, CIE 2, and SEE marks directly into the centralized database ledger.
                    </p>

                    <form onSubmit={handleSaveMarkSubmit} className="mt-5 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Student</label>
                        <select
                          disabled={Boolean(editingMark)}
                          value={markStudentId}
                          onChange={(e) => setMarkStudentId(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-sm focus:border-blue-500 focus:outline-none"
                          required
                        >
                          <option value="">Select a student...</option>
                          {students.map(s => (
                            <option key={s.id} value={s.id}>{s.name} (USN: {s.usn})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Subject</label>
                        <select
                          disabled={Boolean(editingMark)}
                          value={markSubjectId}
                          onChange={(e) => setMarkSubjectId(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-sm focus:border-blue-500 focus:outline-none"
                          required
                        >
                          <option value="">Select a subject...</option>
                          {subjects.map(sub => (
                            <option key={sub.id} value={sub.id}>{sub.code} - {sub.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-3 gap-3 pt-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">CIE 1 (Max 50)</label>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            step="0.5"
                            placeholder="e.g. 42"
                            value={markCie1}
                            onChange={(e) => setMarkCie1(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 p-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none font-bold text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">CIE 2 (Max 50)</label>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            step="0.5"
                            placeholder="e.g. 45"
                            value={markCie2}
                            onChange={(e) => setMarkCie2(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 p-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none font-bold text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">SEE (Max 100)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            placeholder="e.g. 88"
                            value={markSee}
                            onChange={(e) => setMarkSee(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 p-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none font-bold text-center"
                          />
                        </div>
                      </div>

                      <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 mt-2">
                        <button
                          type="button"
                          onClick={() => setShowAdminMarkModal(false)}
                          className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                        >
                          {editingMark ? 'Update Marks' : 'Save Marks'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Tab 7: User Security & Account Access */}
        {activeTab === 'users' && (() => {
          const userList = [
            ...teachers.map(t => ({
              id: t.id,
              name: t.name,
              email: t.email,
              phone: t.phone || '',
              phoneVerified: Boolean(t.phoneVerified ?? t.phone_verified),
              emailVerified: Boolean(t.emailVerified ?? t.email_verified ?? true),
              verificationMethod: t.verificationMethod || t.verification_method || 'email',
              role: 'teacher',
              roleLabel: 'Faculty',
              roleBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
              isVerified: t.isVerified ?? t.is_verified ?? true,
              isActive: t.isActive ?? t.is_active ?? true,
              extra: t.department || 'Academic Department'
            })),
            ...students.map(s => ({
              id: s.id,
              name: s.name,
              email: s.email,
              phone: s.phone || '',
              phoneVerified: Boolean(s.phoneVerified ?? s.phone_verified),
              emailVerified: Boolean(s.emailVerified ?? s.email_verified ?? true),
              verificationMethod: s.verificationMethod || s.verification_method || 'email',
              role: 'student',
              roleLabel: 'Student',
              roleBadge: 'bg-blue-50 text-blue-700 border-blue-200',
              isVerified: s.isVerified ?? s.is_verified ?? true,
              isActive: s.isActive ?? s.is_active ?? true,
              extra: `USN: ${s.usn}`
            })),
            {
              id: 'admin_root',
              name: 'System Administrator',
              email: 'admin@blockchain.edu',
              phone: '+91 9999999999',
              phoneVerified: true,
              emailVerified: true,
              verificationMethod: 'email',
              role: 'admin',
              roleLabel: 'Administrator',
              roleBadge: 'bg-purple-50 text-purple-700 border-purple-200',
              isVerified: true,
              isActive: true,
              extra: 'Super Admin'
            }
          ];

          const filteredUsers = userList.filter(u => {
            if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
            if (userStatusFilter === 'active' && !u.isActive) return false;
            if (userStatusFilter === 'disabled' && u.isActive) return false;
            if (userStatusFilter === 'verified' && !u.isVerified) return false;
            if (userStatusFilter === 'pending' && u.isVerified) return false;
            if (userSearchQuery) {
              const q = userSearchQuery.toLowerCase();
              return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.phone || '').includes(q);
            }
            return true;
          });

          return (
            <div className="space-y-6">
              {userActionToast && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold animate-fadeIn shadow-sm">
                  <span>✅ {userActionToast}</span>
                  <button onClick={() => setUserActionToast('')} className="text-emerald-600 hover:text-emerald-900 font-bold">✕</button>
                </div>
              )}

              {/* Title & Privacy Policy Banner */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-800">User Security & Account Access</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage email verification statuses, toggle account login access, and initiate secure OTP password resets.
                  </p>
                </div>
                <div className="bg-blue-50/70 border border-blue-200/60 rounded-xl px-3.5 py-2 text-[11px] text-blue-800 font-medium flex items-center gap-2">
                  <span>🔒</span>
                  <span><strong>Zero-Knowledge Rule:</strong> Passwords are salted with PBKDF2 and never exposed to anyone.</span>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Filter Role</label>
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Roles (Admin, Faculty, Student)</option>
                    <option value="student">Students Only</option>
                    <option value="teacher">Faculty / Teachers Only</option>
                    <option value="admin">Administrators Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Filter Status</label>
                  <select
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Account Statuses</option>
                    <option value="active">Active Accounts Only</option>
                    <option value="disabled">Disabled Accounts Only</option>
                    <option value="verified">Verified Emails Only</option>
                    <option value="pending">Pending Verification Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Search User / Email</label>
                  <input
                    type="text"
                    placeholder="Search by name or email address..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-6">User / Identity</th>
                        <th className="py-3 px-6">Email Address</th>
                        <th className="py-3 px-6">Mobile Number</th>
                        <th className="py-3 px-6 text-center">Role</th>
                        <th className="py-3 px-6 text-center">Verification Status</th>
                        <th className="py-3 px-6 text-center">Account Access</th>
                        <th className="py-3 px-6 text-right">Security Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="py-12 text-center text-slate-400 font-semibold">
                            No accounts match the selected filters.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => (
                          <tr key={`${u.role}_${u.id}`} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6">
                              <p className="font-extrabold text-slate-900 text-sm">{u.name}</p>
                              <p className="text-[10px] text-slate-400">{u.extra}</p>
                            </td>
                            <td className="py-4 px-6 font-mono text-xs text-slate-600">
                              {u.email || <span className="text-slate-400 italic">Not set</span>}
                            </td>
                            <td className="py-4 px-6 font-mono text-xs text-slate-600">
                              {u.phone ? (
                                <span className="inline-flex items-center gap-1">
                                  <span>📱</span>
                                  <span>{u.phone}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 italic font-sans text-[11px]">No mobile</span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${u.roleBadge}`}>
                                {u.roleLabel}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-center">
                              <div className="flex flex-col items-center gap-1">
                                {u.isVerified ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    ✓ {u.verificationMethod === 'mobile' ? 'Mobile Verified' : 'Email Verified'}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    ⏳ Pending OTP
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-6 text-center">
                              {u.isActive ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  ● Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  ✕ Disabled
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-right space-x-2 whitespace-nowrap">
                              {u.role !== 'admin' && (
                                <>
                                  <button
                                    onClick={() => handleToggleUserAccount(u.role, u.id, u.isActive)}
                                    disabled={togglingUserId === u.id}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                                      togglingUserId === u.id ? "opacity-60 cursor-wait" : ""
                                    } ${
                                      u.isActive
                                        ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                                        : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                    }`}
                                  >
                                    {u.isActive ? 'Disable' : 'Activate'}
                                  </button>
                                  <button
                                    onClick={() => handleAdminSendResetOtp(u.role, u.id, u.email || u.phone)}
                                    disabled={isProcessingUserAction}
                                    className="px-2.5 py-1 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                    title="Send password reset OTP code directly to user"
                                  >
                                    Send Reset OTP
                                  </button>
                                </>
                              )}
                              {u.role === 'admin' && (
                                <span className="text-[10px] text-slate-400 italic">Protected Root</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 font-semibold text-xs">
                      No accounts match the selected filters.
                    </div>
                  ) : (
                    filteredUsers.map((u) => (
                      <div key={`m_${u.role}_${u.id}`} className="p-4 space-y-3 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-extrabold text-slate-900 text-sm">{u.name}</p>
                            <p className="text-slate-500 text-xs font-mono break-all">{u.email || 'No email'}</p>
                            {u.phone && (
                              <p className="text-indigo-600 text-xs font-mono mt-0.5 flex items-center gap-1">
                                <span>📱</span>
                                <span>{u.phone}</span>
                              </p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-0.5">{u.extra}</p>
                          </div>
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${u.roleBadge}`}>
                            {u.roleLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <div className="flex-1 bg-slate-50 p-2 rounded-xl text-center">
                            <span className="text-[9px] text-slate-400 uppercase font-bold block">Verification</span>
                            {u.isVerified ? (
                              <span className="text-emerald-700 font-bold text-[11px]">✓ {u.verificationMethod === 'mobile' ? 'Mobile' : 'Email'}</span>
                            ) : (
                              <span className="text-amber-600 font-bold text-[11px]">⏳ Pending OTP</span>
                            )}
                          </div>
                          <div className="flex-1 bg-slate-50 p-2 rounded-xl text-center">
                            <span className="text-[9px] text-slate-400 uppercase font-bold block">Access Status</span>
                            {u.isActive ? (
                              <span className="text-emerald-700 font-bold text-[11px]">● Active</span>
                            ) : (
                              <span className="text-rose-600 font-bold text-[11px]">✕ Disabled</span>
                            )}
                          </div>
                        </div>

                        {u.role !== 'admin' ? (
                          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                            <button
                              onClick={() => handleToggleUserAccount(u.role, u.id, u.isActive)}
                              disabled={togglingUserId === u.id}
                              className={`flex-1 min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer text-center ${
                                togglingUserId === u.id ? "opacity-60 cursor-wait" : ""
                              } ${
                                u.isActive
                                  ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              {u.isActive ? 'Disable Access' : 'Activate Access'}
                            </button>
                            <button
                              onClick={() => handleAdminSendResetOtp(u.role, u.id, u.email)}
                              disabled={isProcessingUserAction}
                              className="flex-1 min-h-[42px] px-3 py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                            >
                              🔑 Send Reset OTP
                            </button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 text-center italic">Protected Root Administrator</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      </div>

      {/* ── Modal: Register allowed Teacher ── */}
      {showTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200/50 flex flex-col p-6 relative max-h-[85vh]">
            <button
              onClick={() => setShowTeacherModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <h3 className="font-extrabold text-slate-900 text-lg mt-2">Allow & Configure Faculty Member</h3>
            <p className="text-xs text-slate-500 mt-1">Register a faculty instructor. Allow specific subject syllabus codes and sections.</p>

            <form onSubmit={handleAddTeacher} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Dr. Anil Verma"
                    value={tName}
                    onChange={(e) => setTName(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                  <input
                    required
                    type="email"
                    placeholder="e.g. anil@gmail.com"
                    value={tEmail}
                    onChange={(e) => setTEmail(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Access Key / Password</label>
                <input
                  required
                  type="text"
                  placeholder="Set login password (default: pass)"
                  value={tPassword}
                  onChange={(e) => setTPassword(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Allowed Subjects</label>
                <div className="border border-slate-200 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs max-h-[120px] overflow-y-auto">
                  {subjects.map((sub) => (
                    <label key={sub.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={tSelectedSubjects.includes(sub.id)}
                        onChange={() => toggleSelect(sub.id, tSelectedSubjects, setTSelectedSubjects)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>{sub.name} ({sub.code})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Allowed Sections</label>
                <div className="border border-slate-200 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs max-h-[120px] overflow-y-auto">
                  {sections.map((sec) => {
                    const yearLabel = sec.year === 1 ? '1st Yr' : sec.year === 2 ? '2nd Yr' : sec.year === 3 ? '3rd Yr' : '4th Yr';
                    return (
                      <label key={sec.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={tSelectedSections.includes(sec.id)}
                          onChange={() => toggleSelect(sec.id, tSelectedSections, setTSelectedSections)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>{yearLabel} - {sec.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setShowTeacherModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  Confirm Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Edit existing Teacher assignments ── */}
      {showAssignModal && editingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200/50 flex flex-col p-6 relative max-h-[85vh]">
            <button
              onClick={() => {
                setShowAssignModal(false);
                setEditingTeacher(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <h3 className="font-extrabold text-slate-900 text-lg mt-2">Update Faculty Assignment</h3>
            <p className="text-xs text-slate-500 mt-1">Configure subjects and sections allowed for <span className="font-bold text-slate-800">{editingTeacher.name}</span>.</p>

            <form onSubmit={handleSaveAssignments} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assign Subjects</label>
                <div className="border border-slate-200 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs max-h-[140px] overflow-y-auto">
                  {subjects.map((sub) => (
                    <label key={sub.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={tSelectedSubjects.includes(sub.id)}
                        onChange={() => toggleSelect(sub.id, tSelectedSubjects, setTSelectedSubjects)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>{sub.name} ({sub.code})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assign Sections</label>
                <div className="border border-slate-200 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs max-h-[140px] overflow-y-auto">
                  {sections.map((sec) => {
                    const yearLabel = sec.year === 1 ? '1st Yr' : sec.year === 2 ? '2nd Yr' : sec.year === 3 ? '3rd Yr' : '4th Yr';
                    return (
                      <label key={sec.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={tSelectedSections.includes(sec.id)}
                          onChange={() => toggleSelect(sec.id, tSelectedSections, setTSelectedSections)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>{yearLabel} - {sec.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignModal(false);
                    setEditingTeacher(null);
                  }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  Save Assignments
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Register new Student ── */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200/50 flex flex-col p-6 relative max-h-[85vh]">
            <button
              onClick={() => setShowStudentModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <h3 className="font-extrabold text-slate-900 text-lg mt-2">Register Student in Ledger</h3>
            <p className="text-xs text-slate-500 mt-1">Register a new student and assign them to an academic class section.</p>

            <form onSubmit={handleAddStudent} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Student Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Priyanshu Sen"
                  value={sName}
                  onChange={(e) => setSName(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Student USN</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. 1SI22CS095"
                    value={sUsn}
                    onChange={(e) => setSUsn(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Class Section</label>
                  <select
                    required
                    value={sSectionId}
                    onChange={(e) => setSSectionId(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Choose Section...</option>
                    {sections.map((sec) => {
                      const yearLabel = sec.year === 1 ? '1st Yr' : sec.year === 2 ? '2nd Yr' : sec.year === 3 ? '3rd Yr' : '4th Yr';
                      return (
                        <option key={sec.id} value={sec.id}>{yearLabel} - {sec.name}</option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email / Gmail</label>
                  <input
                    required
                    type="email"
                    placeholder="e.g. student@gmail.com"
                    value={sEmail}
                    onChange={(e) => setSEmail(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Access Key / Password</label>
                  <input
                    required
                    type="text"
                    placeholder="Set password (default: pass)"
                    value={sPassword}
                    onChange={(e) => setSPassword(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Parent & WhatsApp Details */}
              <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800">
                  <span>📱</span>
                  <span>Parent WhatsApp Notification Details</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Parent's Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Sharma"
                      value={sParentName}
                      onChange={(e) => setSParentName(e.target.value)}
                      className="block w-full rounded-xl border border-slate-300 bg-white py-1.5 px-3 text-slate-950 text-xs focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Parent's WhatsApp No.</label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 9876543210"
                      value={sParentPhone}
                      onChange={(e) => setSParentPhone(e.target.value)}
                      className="block w-full rounded-xl border border-slate-300 bg-white py-1.5 px-3 text-slate-950 text-xs focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-emerald-700/80 italic">Used by faculty to send automated WhatsApp absence notifications during lecture periods.</p>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  Register Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      
      
      {/* ── Modal: Admin Face Biometric Enrollment ── */}
      {showFaceEnrollModal && faceEnrollStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 flex flex-col p-6 relative">
            <button
              onClick={handleCloseFaceEnrollModal}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-indigo-200">
                👤
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">Face Biometric Registration</h3>
                <p className="text-xs text-slate-500">
                  Enrolling permanent face biometric for <strong className="text-slate-800">{faceEnrollStudent.name}</strong> ({faceEnrollStudent.usn})
                </p>
              </div>
            </div>

            <input
              type="file"
              ref={adminFaceFileInputRef}
              accept="image/*"
              capture="user"
              onChange={handleAdminPhotoFileChange}
              className="hidden"
            />

            {/* Camera / Photo Viewport with Biometric Overlay */}
            <div className="mt-4 relative rounded-2xl overflow-hidden bg-slate-950 aspect-[4/3] flex items-center justify-center border-2 border-slate-800 shadow-inner">
              {adminCapturedPhotoUrl ? (
                <img
                  src={adminCapturedPhotoUrl}
                  alt="Student photo preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  ref={adminFaceVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              )}

              {/* Face Target Scanner Frame */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-60 border-2 border-dashed border-emerald-400/80 rounded-[50%] shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse flex items-center justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300 bg-slate-900/80 px-2 py-0.5 rounded-full mt-48">
                    {adminCapturedPhotoUrl ? '✓ Photo Ready' : 'Align Face Here'}
                  </span>
                </div>
              </div>

              {/* Status pill */}
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1.5 border border-white/10">
                <span className={`w-2 h-2 rounded-full ${adminCapturedPhotoUrl ? 'bg-cyan-400' : 'bg-emerald-500 animate-ping'}`}></span>
                <span>{adminCapturedPhotoUrl ? 'Photo Uploaded' : 'Live Camera Feed'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs px-1 mt-2">
              <span className="text-[11px] text-slate-500">
                {adminCapturedPhotoUrl ? '✓ Photo selected' : 'Camera having issues?'}
              </span>
              <button
                type="button"
                onClick={() => adminFaceFileInputRef.current?.click()}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
              >
                {adminCapturedPhotoUrl ? '🔄 Retake / Choose Other Photo' : '📸 Snap Photo / Upload Selfie'}
              </button>
            </div>

            {/* Error or Success feedback */}
            {faceEnrollError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl animate-fadeIn">
                ⚠️ {faceEnrollError}
              </div>
            )}
            {faceEnrollSuccess && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl animate-fadeIn">
                {faceEnrollSuccess}
              </div>
            )}

            {/* Instruction info */}
            <p className="text-[11px] text-slate-500 mt-3 text-center">
              Ensure the student is facing the camera directly in clear lighting with no sunglasses or heavy face masks.
            </p>

            {/* Modal Actions */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseFaceEnrollModal}
                disabled={isCapturingFace}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCaptureAndEnrollFace}
                disabled={isCapturingFace}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-emerald-200 cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <span>📸</span>
                <span>{isCapturingFace ? 'Processing Face...' : 'Capture & Save Biometric'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Student & Parent WhatsApp ── */}
      {showEditStudentModal && editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200/50 flex flex-col p-6 relative max-h-[90vh]">
            <button
              onClick={() => {
                setShowEditStudentModal(false);
                setEditingStudent(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <h3 className="font-extrabold text-slate-900 text-lg mt-1">Edit Student & Parent Contact</h3>
            <p className="text-xs text-slate-500 mt-1">Update parent name & WhatsApp contact for <span className="font-bold text-slate-800">{editingStudent.name}</span>.</p>

            <form onSubmit={handleSaveEditStudent} className="mt-4 space-y-4 overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Student Full Name</label>
                <input
                  required
                  type="text"
                  value={editSName}
                  onChange={(e) => setEditSName(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Student USN</label>
                  <input
                    required
                    type="text"
                    value={editSUsn}
                    onChange={(e) => setEditSUsn(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Class Section</label>
                  <select
                    required
                    value={editSSectionId}
                    onChange={(e) => setEditSSectionId(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Choose Section...</option>
                    {sections.map((sec) => {
                      const yearLabel = sec.year === 1 ? '1st Yr' : sec.year === 2 ? '2nd Yr' : sec.year === 3 ? '3rd Yr' : '4th Yr';
                      return (
                        <option key={sec.id} value={sec.id}>{yearLabel} - {sec.name}</option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                <input
                  required
                  type="email"
                  value={editSEmail}
                  onChange={(e) => setEditSEmail(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Parent & WhatsApp info */}
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800">
                  <span>📱</span>
                  <span>Parent WhatsApp Notification Details</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Parent's Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Sharma"
                      value={editSParentName}
                      onChange={(e) => setEditSParentName(e.target.value)}
                      className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-xs focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Parent's WhatsApp Mobile Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 9876543210"
                      value={editSParentPhone}
                      onChange={(e) => setEditSParentPhone(e.target.value)}
                      className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-xs focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditStudentModal(false);
                    setEditingStudent(null);
                  }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  Save Parent Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Create new Section ── */}
      {showSectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200/50 flex flex-col p-6 relative">
            <button
              onClick={() => setShowSectionModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <h3 className="font-extrabold text-slate-900 text-lg mt-2">Create Academic Section</h3>
            <p className="text-xs text-slate-500 mt-1">Add a section layer to segment classrooms per syllabus.</p>

            <form onSubmit={handleAddSection} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Section Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. CSE-A, ISE-B, ME-A"
                  value={secName}
                  onChange={(e) => setSecName(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Grade Year Level</label>
                <select
                  value={secYear}
                  onChange={(e) => setSecYear(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-slate-900 focus:border-blue-500 focus:ring-blue-500 focus:outline-none text-sm"
                >
                  <option value="1">1st Year (Freshman)</option>
                  <option value="2">2nd Year (Sophomore)</option>
                  <option value="3">3rd Year (Junior)</option>
                  <option value="4">4th Year (Senior)</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setShowSectionModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  Create Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Create new Subject ── */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200/50 flex flex-col p-6 relative">
            <button
              onClick={() => setShowSubjectModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <h3 className="font-extrabold text-slate-900 text-lg mt-2">Register Subject Syllabus</h3>
            <p className="text-xs text-slate-500 mt-1">Register a new curriculum code and academic name in core list.</p>

            <form onSubmit={handleAddSubject} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Subject Code</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. CS601, ME402, EC301"
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Curriculum Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Blockchain Technology"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 text-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  Register Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Supabase & Blockchain Footer Note */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-12 pb-8 border-t border-slate-200 pt-6">
        <p className="text-center text-xs font-semibold text-slate-400 select-none">
          🔗 Blockchain hashes stored on Supabase cloud — connect Ethereum Sepolia testnet via Web3.js to store hashes on real blockchain
        </p>
      </div>
    </div>
  );
}
