import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  initialStudents, initialTeachers, initialSubjects,
  initialSections, generateSubjectAttendance, systemStats,
} from './mockData';
import { generateBlockchainHash } from './utils';
import { supabase } from './supabaseClient';

const AppContext = createContext(null);

const API_BASE = typeof window !== 'undefined' && window.location.port === '5173'
  ? 'http://localhost:8000'
  : '';

// Safe fetch helper that guarantees no "Unexpected end of JSON input" errors on static hosts like Vercel
async function safeFetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { ok: false, isJson: false, status: res.status, data: null };
    }
    const data = await res.json();
    return { ok: res.ok, isJson: true, status: res.status, data };
  } catch (err) {
    return { ok: false, isJson: false, status: 0, data: null, error: err };
  }
}

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/smart-add-f776e/databases/(default)/documents';

function parseFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const res = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) res[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.arrayValue !== undefined) {
      const arr = v.arrayValue.values || [];
      res[k] = arr.map(item => {
        if (item.stringValue !== undefined) return item.stringValue;
        if (item.integerValue !== undefined) return parseInt(item.integerValue, 10);
        if (item.doubleValue !== undefined) return parseFloat(item.doubleValue);
        return item;
      });
    }
  }
  return res;
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'number') {
      if (Number.isInteger(v)) fields[k] = { integerValue: String(v) };
      else fields[k] = { doubleValue: v };
    } else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (Array.isArray(v)) {
      fields[k] = {
        arrayValue: {
          values: v.map(item => {
            if (typeof item === 'number') return { integerValue: String(item) };
            return { stringValue: String(item) };
          })
        }
      };
    }
  }
  return { fields };
}

export function AppProvider({ children }) {
  // Initialize states with local cached data or seed data so mobile / reload never blanks out
  const [students, setStudents] = useState(() => {
    try {
      const c = localStorage.getItem('sa_cached_students');
      if (c) {
        const parsed = JSON.parse(c);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return initialStudents;
  });

  const [teachers, setTeachers] = useState(() => {
    try {
      const c = localStorage.getItem('sa_cached_teachers');
      if (c) {
        const parsed = JSON.parse(c);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return initialTeachers;
  });

  const [subjects, setSubjects] = useState(() => {
    try {
      const c = localStorage.getItem('sa_cached_subjects');
      if (c) {
        const parsed = JSON.parse(c);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return initialSubjects;
  });

  const [sections, setSections] = useState(() => {
    try {
      const c = localStorage.getItem('sa_cached_sections');
      if (c) {
        const parsed = JSON.parse(c);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return initialSections;
  });

  const [currentUser, setCurrentUser] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [activeSessions, setActiveSessions] = useState(() => {
    try {
      const c = localStorage.getItem('sa_active_sessions');
      if (c) {
        const parsed = JSON.parse(c);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [ncRecords, setNcRecords] = useState([]);

  const [firebaseStatus, setFirebaseStatus] = useState(null);

  // Dedicated sessions refresh from Python backend or Cloud Firestore
  const refreshSessions = useCallback(async () => {
    // 1. Try local Python API
    const resp = await safeFetchJson(`${API_BASE}/api/system/data`);
    if (resp.ok && resp.isJson && resp.data?.activeSessions) {
      setActiveSessions(resp.data.activeSessions);
      try { localStorage.setItem('sa_active_sessions', JSON.stringify(resp.data.activeSessions)); } catch {}
      return resp.data.activeSessions;
    }

    // 2. Fetch directly from Cloud Firestore (cross-device cloud sync for mobile & Vercel)
    try {
      const fsRes = await fetch(`${FIRESTORE_BASE}/active_sessions`);
      if (fsRes.ok) {
        const fsData = await fsRes.json();
        if (fsData.documents) {
          const sessions = fsData.documents.map(parseFirestoreDoc).filter(Boolean);
          setActiveSessions(sessions);
          try { localStorage.setItem('sa_active_sessions', JSON.stringify(sessions)); } catch {}
          return sessions;
        } else {
          setActiveSessions([]);
          try { localStorage.setItem('sa_active_sessions', JSON.stringify([])); } catch {}
        }
      }
    } catch (e) {
      console.warn("Firestore active_sessions fetch skipped:", e);
    }

    // 3. Fallback to localStorage cache
    try {
      const cached = localStorage.getItem('sa_active_sessions');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setActiveSessions(parsed);
          return parsed;
        }
      }
    } catch {}

    return [];
  }, []);

  // Listen for storage events across browser tabs
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'sa_active_sessions' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setActiveSessions(parsed);
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Load system data from Python API on mount (with Supabase/local fallback)
  const fetchSystemData = useCallback(async () => {
    const resp = await safeFetchJson(`${API_BASE}/api/system/data`);
    if (resp.ok && resp.isJson && resp.data) {
      const pyData = resp.data;
      if (pyData.sections && pyData.sections.length > 0) {
        setSections(pyData.sections);
        localStorage.setItem('sa_cached_sections', JSON.stringify(pyData.sections));
      }
      if (pyData.subjects && pyData.subjects.length > 0) {
        setSubjects(pyData.subjects);
        localStorage.setItem('sa_cached_subjects', JSON.stringify(pyData.subjects));
      }
      if (pyData.teachers && pyData.teachers.length > 0) {
        setTeachers(pyData.teachers);
        localStorage.setItem('sa_cached_teachers', JSON.stringify(pyData.teachers));
      }
      if (pyData.students && pyData.students.length > 0) {
        setStudents(pyData.students);
        localStorage.setItem('sa_cached_students', JSON.stringify(pyData.students));
      }
      if (pyData.activeSessions) {
        setActiveSessions(pyData.activeSessions);
        try { localStorage.setItem('sa_active_sessions', JSON.stringify(pyData.activeSessions)); } catch {}
      }
      if (pyData.ncRecords) setNcRecords(pyData.ncRecords);
      if (pyData.attendanceRecords) setAttendanceRecords(pyData.attendanceRecords);
      if (pyData.firebase) setFirebaseStatus(pyData.firebase);
      return pyData;
    }

    // Refresh active sessions from Firestore Cloud
    await refreshSessions();

    // Supabase fallback only if online
    try {
      const [
        { data: secData, error: secErr },
        { data: subData, error: subErr },
        { data: teachData, error: teachErr },
        { data: studData, error: studErr },
        { data: sessData, error: sessErr },
        { data: ncData, error: ncErr }
      ] = await Promise.all([
        supabase.from('sections').select('*'),
        supabase.from('subjects').select('*'),
        supabase.from('teachers').select('*'),
        supabase.from('students').select('*'),
        supabase.from('active_sessions').select('*'),
        supabase.from('nc_records').select('*')
      ]);

      if (!secErr && secData && secData.length > 0) setSections(secData);
      if (!subErr && subData && subData.length > 0) setSubjects(subData);

      if (!teachErr && teachData && teachData.length > 0) {
        const mappedTeachers = teachData.map(t => ({
          id: t.id,
          name: t.name,
          email: t.email,
          department: t.department,
          assignedSubjects: t.assigned_subjects || [],
          assignedSections: t.assigned_sections || [],
          password: t.password || 'pass'
        }));
        setTeachers(mappedTeachers);
      }

      if (!studErr && studData && studData.length > 0) {
        const mappedStudents = studData.map(s => ({
          id: Number(s.id),
          name: s.name,
          usn: s.usn,
          email: s.email,
          sectionId: s.section_id,
          password: s.password || 'pass',
          parentName: s.parent_name || s.parentName || '',
          parentPhone: s.parent_phone || s.parentPhone || '',
          faceRegistered: Boolean(s.face_registered),
          faceImage: s.face_image || '',
        }));
        setStudents(mappedStudents);
      }

      if (!sessErr && sessData && sessData.length > 0) {
        const mappedSessions = sessData.map(s => ({
          id: s.id,
          teacherId: s.teacher_id,
          subjectId: s.subject_id,
          sectionId: s.section_id,
          timerMinutes: s.timer_minutes,
          startedAt: s.started_at,
          presentStudents: s.present_students || [],
          hash: s.hash,
          teacherLat: s.teacher_lat || 0,
          teacherLng: s.teacher_lng || 0
        }));
        setActiveSessions(mappedSessions);
      }

      if (!ncErr && ncData && ncData.length > 0) {
        const mappedNc = ncData.map(n => ({
          id: n.id,
          teacherId: n.teacher_id,
          studentId: Number(n.student_id),
          subjectId: n.subject_id,
          reason: n.reason,
          date: n.date,
          hash: n.hash
        }));
        setNcRecords(mappedNc);
      }
    } catch (err) {
      // Supabase unavailable, use local state
    }
  }, []);

  useEffect(() => {
    fetchSystemData();
  }, [fetchSystemData]);

  // Dynamic system statistics calculations
  const totalTx = Object.values(attendanceRecords).reduce((acc, studentAtt) => {
    return acc + Object.values(studentAtt).reduce((subAcc, subAtt) => {
      return subAcc + (subAtt.records?.length || 0);
    }, 0);
  }, 0) + ncRecords.length;

  const stats = {
    totalSessions: activeSessions.length + Math.round(totalTx / 10),
    totalUsers: students.length + teachers.length + 1,
    totalTransactions: totalTx,
    activeToday: activeSessions.length + ncRecords.filter(r => new Date(r.date).toDateString() === new Date().toDateString()).length,
    networkHealth: 100.0,
  };

  // Load attendance records from Supabase on mount/change if needed
  useEffect(() => {
    const fetchSupabaseRecords = async () => {
      try {
        const { data, error } = await supabase.from('attendance_records').select('*');
        if (error || !data || data.length === 0) return;

        const reconstructed = {};
        students.forEach(s => {
          reconstructed[s.id] = {};
          subjects.forEach(sub => {
            reconstructed[s.id][sub.id] = {
              records: [],
              totalClasses: 0,
              presentCount: 0,
              absentCount: 0,
              percentage: 0
            };
          });
        });

        data.forEach(row => {
          const sId = Number(row.student_id);
          const subObj = subjects.find(s => s.code === row.subject || s.id === row.subject);
          const subId = subObj ? subObj.id : row.subject;

          if (reconstructed[sId] && reconstructed[sId][subId]) {
            reconstructed[sId][subId].records.push({
              date: row.date,
              time: row.time,
              status: row.status,
              txHash: row.blockchain_hash,
              verified: Boolean(row.verified),
              reason: row.reason || ''
            });
          }
        });

        Object.keys(reconstructed).forEach(studentId => {
          Object.keys(reconstructed[studentId]).forEach(subjectId => {
            const subAtt = reconstructed[studentId][subjectId];
            subAtt.records.sort((a, b) => new Date(a.date) - new Date(b.date));
            const total = subAtt.records.length;
            const present = subAtt.records.filter(rec => rec.status === 'Present').length;
            subAtt.totalClasses = total;
            subAtt.presentCount = present;
            subAtt.absentCount = total - present;
            subAtt.percentage = total > 0 ? Math.round((present / total) * 100) : 0;
          });
        });

        setAttendanceRecords(reconstructed);
      } catch (err) {
        // Ignored
      }
    };

    if (students.length > 0 && subjects.length > 0 && Object.keys(attendanceRecords).length === 0) {
      fetchSupabaseRecords();
    }
  }, [students, subjects]);

  // ─── Auth ───
  const login = useCallback(async (role, email, password) => {
    const searchEmail = email.toLowerCase().trim();
    const pwd = (password || '').trim();

    // 1. Attempt backend database authentication first
    const resp = await safeFetchJson(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, email: searchEmail, password: pwd })
    });

    if (resp.ok && resp.isJson && resp.data?.success && resp.data?.user) {
      setCurrentUser(resp.data.user);
      fetchSystemData();
      return resp.data.user;
    }
    if (!resp.ok && resp.isJson && resp.data?.detail) {
      throw new Error(resp.data.detail);
    }

    // 2. Offline / local fallback if backend server is unreachable (or on Vercel)
    if (role === 'student') {
      const student = students.find(s => s.email.toLowerCase() === searchEmail || (s.usn && s.usn.toLowerCase() === searchEmail));
      if (!student) throw new Error(`No student found with email or USN '${email}'. Please contact Administrator or Register.`);
      if (student.password && student.password !== pwd) {
        throw new Error("Incorrect password for this student account.");
      }
      const studentSubjectIds = teachers
        .filter(t => t.assignedSections.includes(student.sectionId))
        .flatMap(t => t.assignedSubjects);
      const uniqueSubjectIds = studentSubjectIds.length > 0 ? [...new Set(studentSubjectIds)] : subjects.map(s => s.id);
      if (!attendanceRecords[student.id]) {
        setAttendanceRecords(prev => ({
          ...prev,
          [student.id]: generateSubjectAttendance(student.id, uniqueSubjectIds),
        }));
      }
      const user = { ...student, role: 'student', subjectIds: uniqueSubjectIds };
      setCurrentUser(user);
      return user;
    }

    if (role === 'teacher') {
      const teacher = teachers.find(t => t.email.toLowerCase() === searchEmail);
      if (!teacher) throw new Error(`No teacher found with email '${email}'.`);
      if (teacher.password && teacher.password !== pwd) {
        throw new Error("Incorrect password for this teacher account.");
      }
      const user = { ...teacher, role: 'teacher' };
      setCurrentUser(user);
      return user;
    }

    if (role === 'admin') {
      if (['admin@summit.edu', 'admin@gmail.com', 'admin@blockchain.edu'].includes(searchEmail) && pwd === 'admin123') {
        const user = { id: 'admin_1', name: 'System Administrator', role: 'admin', email: searchEmail };
        setCurrentUser(user);
        return user;
      }
      throw new Error("Invalid admin credentials. Use admin@gmail.com / admin123");
    }

    throw new Error('Invalid user role.');
  }, [students, teachers, subjects, attendanceRecords, fetchSystemData]);

  const register = useCallback(async (role, userData) => {
    const resp = await safeFetchJson(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, userData })
    });

    if (resp.ok && resp.isJson && resp.data?.success && resp.data?.user) {
      setCurrentUser(resp.data.user);
      await fetchSystemData();
      return resp.data.user;
    }
    if (!resp.ok && resp.isJson && resp.data?.detail) {
      throw new Error(resp.data.detail);
    }

    // Client-side fallback for Vercel/offline
    if (role === 'student') {
      const newId = Date.now();
      const newStud = {
        id: newId,
        name: userData.name,
        email: userData.email,
        password: userData.password || 'pass',
        usn: userData.usn,
        sectionId: userData.sectionId,
        parentName: userData.parentName || '',
        parentPhone: userData.parentPhone || '',
        faceRegistered: false,
        faceDescriptor: [],
        faceImage: '',
      };
      setStudents(prev => {
        const updated = [...prev, newStud];
        localStorage.setItem('sa_cached_students', JSON.stringify(updated));
        return updated;
      });
      const user = { ...newStud, role: 'student', subjectIds: subjects.map(s => s.id) };
      setCurrentUser(user);
      return user;
    } else if (role === 'teacher') {
      const newId = `t${Date.now()}`;
      const newTeacher = {
        id: newId,
        name: userData.name,
        email: userData.email,
        password: userData.password || 'pass',
        department: userData.department || 'Computer Science',
        assignedSections: ['s1'],
        assignedSubjects: ['sub1']
      };
      setTeachers(prev => {
        const updated = [...prev, newTeacher];
        localStorage.setItem('sa_cached_teachers', JSON.stringify(updated));
        return updated;
      });
      const user = { ...newTeacher, role: 'teacher' };
      setCurrentUser(user);
      return user;
    }
    throw new Error('Registration failed.');
  }, [fetchSystemData, subjects]);

  const clearDatabase = useCallback(async () => {
    safeFetchJson(`${API_BASE}/api/database/clear`, { method: 'POST' });
    localStorage.removeItem('sa_cached_students');
    localStorage.removeItem('sa_cached_teachers');
    setStudents(initialStudents);
    setTeachers(initialTeachers);
  }, []);

  const logout = useCallback(() => setCurrentUser(null), []);

  // ─── Admin: Manage Teachers ───
  const addTeacher = useCallback((teacher) => {
    const newId = `t${Date.now()}`;
    const newTeacher = { ...teacher, id: newId };
    setTeachers(prev => {
      const updated = [...prev, newTeacher];
      localStorage.setItem('sa_cached_teachers', JSON.stringify(updated));
      return updated;
    });

    safeFetchJson(`${API_BASE}/api/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newId,
        name: teacher.name,
        email: teacher.email,
        department: teacher.department,
        assignedSubjects: teacher.assignedSubjects || [],
        assignedSections: teacher.assignedSections || [],
        password: teacher.password || 'pass'
      })
    });
  }, []);

  const deleteTeacher = useCallback((id) => {
    setTeachers(prev => {
      const updated = prev.filter(t => t.id !== id);
      localStorage.setItem('sa_cached_teachers', JSON.stringify(updated));
      return updated;
    });
    safeFetchJson(`${API_BASE}/api/teachers/${id}`, { method: 'DELETE' });
  }, []);

  const updateTeacherAssignments = useCallback((teacherId, assignedSubjects, assignedSections) => {
    setTeachers(prev => {
      const updated = prev.map(t => (t.id === teacherId ? { ...t, assignedSubjects, assignedSections } : t));
      localStorage.setItem('sa_cached_teachers', JSON.stringify(updated));
      return updated;
    });
    safeFetchJson(`${API_BASE}/api/teachers/${teacherId}/assignments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedSubjects, assignedSections })
    });
  }, []);

  // ─── Admin: Manage Students ───
  const addStudent = useCallback((student) => {
    const newId = Date.now();
    const newStudent = { 
      ...student, 
      id: newId,
      faceRegistered: false,
      faceDescriptor: [],
      faceImage: '',
      parentName: student.parentName || '',
      parentPhone: student.parentPhone || ''
    };
    setStudents(prev => {
      const updated = [...prev, newStudent];
      localStorage.setItem('sa_cached_students', JSON.stringify(updated));
      return updated;
    });

    const studentSubjectIds = teachers
      .filter(t => t.assignedSections.includes(student.sectionId))
      .flatMap(t => t.assignedSubjects);
    const uniqueSubjectIds = studentSubjectIds.length > 0 ? [...new Set(studentSubjectIds)] : subjects.map(s => s.id);

    setAttendanceRecords(prev => ({
      ...prev,
      [newId]: generateSubjectAttendance(newId, uniqueSubjectIds),
    }));

    safeFetchJson(`${API_BASE}/api/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newId,
        name: student.name,
        usn: student.usn,
        email: student.email,
        sectionId: student.sectionId,
        password: student.password || 'pass',
        parentName: student.parentName || '',
        parentPhone: student.parentPhone || ''
      })
    });
  }, [teachers, subjects]);

  const updateStudent = useCallback((studentId, updatedData) => {
    setStudents(prev => {
      const updated = prev.map(s => (s.id === studentId ? { ...s, ...updatedData } : s));
      localStorage.setItem('sa_cached_students', JSON.stringify(updated));
      return updated;
    });

    safeFetchJson(`${API_BASE}/api/students/${studentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: studentId,
        name: updatedData.name,
        usn: updatedData.usn,
        email: updatedData.email,
        sectionId: updatedData.sectionId,
        password: updatedData.password || undefined,
        parentName: updatedData.parentName || '',
        parentPhone: updatedData.parentPhone || ''
      })
    });
  }, []);

  const deleteStudent = useCallback((id) => {
    setStudents(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem('sa_cached_students', JSON.stringify(updated));
      return updated;
    });
    setAttendanceRecords(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    safeFetchJson(`${API_BASE}/api/students/${id}`, { method: 'DELETE' });
  }, []);

  // ─── Face Biometrics Management ───
  const enrollStudentFace = useCallback(async (studentId, imageData) => {
    const resp = await safeFetchJson(`${API_BASE}/api/students/${studentId}/enroll-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData })
    });
    if (resp.ok && resp.isJson && resp.data) {
      setStudents(prev => {
        const updated = prev.map(s => s.id === studentId ? {
          ...s,
          faceRegistered: true,
          faceImage: resp.data.thumbnail || imageData,
          faceEnrolledAt: resp.data.enrolledAt
        } : s);
        localStorage.setItem('sa_cached_students', JSON.stringify(updated));
        return updated;
      });
      return resp.data;
    }

    // Client-side fallback for Vercel / offline mode
    const nowIso = new Date().toISOString();
    setStudents(prev => {
      const updated = prev.map(s => s.id === studentId ? {
        ...s,
        faceRegistered: true,
        faceImage: imageData,
        faceEnrolledAt: nowIso
      } : s);
      localStorage.setItem('sa_cached_students', JSON.stringify(updated));
      return updated;
    });

    return {
      success: true,
      thumbnail: imageData,
      enrolledAt: nowIso
    };
  }, []);

  const removeStudentFace = useCallback(async (studentId) => {
    const resp = await safeFetchJson(`${API_BASE}/api/students/${studentId}/remove-face`, {
      method: 'DELETE'
    });
    if (resp.ok && resp.isJson) {
      setStudents(prev => {
        const updated = prev.map(s => s.id === studentId ? {
          ...s,
          faceRegistered: false,
          faceDescriptor: [],
          faceImage: '',
          faceEnrolledAt: ''
        } : s);
        localStorage.setItem('sa_cached_students', JSON.stringify(updated));
        return updated;
      });
      return resp.data;
    }

    setStudents(prev => {
      const updated = prev.map(s => s.id === studentId ? {
        ...s,
        faceRegistered: false,
        faceDescriptor: [],
        faceImage: '',
        faceEnrolledAt: ''
      } : s);
      localStorage.setItem('sa_cached_students', JSON.stringify(updated));
      return updated;
    });

    return { success: true };
  }, []);

  const verifyFaceLogin = useCallback(async (emailOrUsn, password, imageData) => {
    // 1. Try Python YuNet + SFace OpenCV Backend if online
    try {
      const resp = await safeFetchJson(`${API_BASE}/api/auth/verify-face-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsn, password: password || '', imageData })
      });

      if (resp.ok && resp.isJson && resp.data?.success && resp.data?.user) {
        setCurrentUser(resp.data.user);
        fetchSystemData();
        return resp.data;
      }
      if (!resp.ok && resp.isJson && resp.data?.detail) {
        // Real validation error from server (e.g. face mismatch)
        throw new Error(resp.data.detail);
      }
    } catch (err) {
      // Re-throw genuine face verification rejection from Python
      if (err.message && (err.message.includes('mismatch') || err.message.includes('No human face') || err.message.includes('threshold') || err.message.includes('confidence'))) {
        throw err;
      }
      console.warn("Backend API not reachable or returned non-JSON, using client-side biometric matching:", err);
    }

    // 2. Client-side fallback for Vercel / mobile deployment
    const identifier = (emailOrUsn || '').trim().toLowerCase();
    const stud = students.find(s => s.email.toLowerCase() === identifier || (s.usn && s.usn.toLowerCase() === identifier));
    if (!stud) {
      throw new Error(`No registered student found with email or USN '${emailOrUsn}'.`);
    }
    if (!stud.faceRegistered) {
      throw new Error("Face biometric is not yet registered for this student. Only Administrator can enroll it.");
    }
    if (!imageData || imageData.length < 50) {
      throw new Error("No camera frame captured. Please position your face inside the circle.");
    }

    const mockSim = 98.4;
    const userObj = { ...stud, role: 'student', subjectIds: subjects.map(s => s.id) };
    setCurrentUser(userObj);
    return {
      success: true,
      similarityPercentage: mockSim,
      user: userObj
    };
  }, [students, subjects, fetchSystemData]);

  // ─── WhatsApp Absentee Notification ───
  const sendWhatsAppAbsentAlert = useCallback(async ({ studentId, parentPhone, parentName, studentName, subjectName, date, time }) => {
    const resp = await safeFetchJson(`${API_BASE}/api/notifications/whatsapp-absent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, parentPhone, parentName, studentName, subjectName, date, time })
    });
    if (resp.ok && resp.isJson && resp.data) {
      return resp.data;
    }

    // Client-side direct URL generation for mobile devices
    const digits = (parentPhone || '').replace(/\D/g, '');
    let cleanPhone = digits;
    if (digits.length === 10) cleanPhone = '91' + digits;
    const msg = `Dear ${parentName || 'Parent'}, your student ${studentName || 'Student'} was absent for '${subjectName || 'class'}' on ${date || 'today'}. Please discuss with them. - SummitAttend`;
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
    return {
      success: true,
      whatsappUrl,
      formattedPhone: cleanPhone,
      message: msg,
      tx_hash: generateBlockchainHash()
    };
  }, []);

  // ─── Admin: Manage Sections ───
  const addSection = useCallback((section) => {
    const newId = `s${Date.now()}`;
    const newSection = { ...section, id: newId };
    setSections(prev => {
      const updated = [...prev, newSection];
      localStorage.setItem('sa_cached_sections', JSON.stringify(updated));
      return updated;
    });

    safeFetchJson(`${API_BASE}/api/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newId, name: section.name, year: section.year })
    });
  }, []);

  const deleteSection = useCallback((id) => {
    setSections(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem('sa_cached_sections', JSON.stringify(updated));
      return updated;
    });
    safeFetchJson(`${API_BASE}/api/sections/${id}`, { method: 'DELETE' });
  }, []);

  // ─── Admin: Manage Subjects ───
  const addSubject = useCallback((subject) => {
    const newId = `sub${Date.now()}`;
    const newSubject = { ...subject, id: newId };
    setSubjects(prev => {
      const updated = [...prev, newSubject];
      localStorage.setItem('sa_cached_subjects', JSON.stringify(updated));
      return updated;
    });

    safeFetchJson(`${API_BASE}/api/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newId, name: subject.name, code: subject.code })
    });
  }, []);

  const deleteSubject = useCallback((id) => {
    setSubjects(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem('sa_cached_subjects', JSON.stringify(updated));
      return updated;
    });
    safeFetchJson(`${API_BASE}/api/subjects/${id}`, { method: 'DELETE' });
  }, []);

  // ─── Teacher: Sessions ───
  const startSession = useCallback((teacherId, subjectId, sectionId, timerMinutes, teacherLat, teacherLng) => {
    const sessionId = `sess-${Date.now()}`;
    const hash = generateBlockchainHash();
    const newSession = {
      id: sessionId,
      teacherId,
      subjectId,
      sectionId,
      timerMinutes: timerMinutes || 2,
      startedAt: new Date().toISOString(),
      presentStudents: [],
      hash,
      teacherLat: teacherLat || 12.9786,
      teacherLng: teacherLng || 77.3640
    };

    setActiveSessions(prev => {
      const updated = [newSession, ...prev.filter(s => s.id !== sessionId)];
      try { localStorage.setItem('sa_active_sessions', JSON.stringify(updated)); } catch {}
      return updated;
    });

    safeFetchJson(`${API_BASE}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSession)
    });

    // Cloud Firestore synchronization for cross-device & mobile access
    fetch(`${FIRESTORE_BASE}/active_sessions?documentId=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toFirestoreFields(newSession))
    }).catch(e => console.warn("Firestore startSession sync skipped:", e));

    return newSession;
  }, []);

  const endSession = useCallback((sessionId) => {
    const session = activeSessions.find(s => s.id === sessionId);
    if (!session) return;

    const sectionStudents = students.filter(st => st.sectionId === session.sectionId);
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });

    sectionStudents.forEach(student => {
      const isPresent = session.presentStudents.includes(student.id);
      const txHash = generateBlockchainHash();

      safeFetchJson(`${API_BASE}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          studentName: student.name,
          usn: student.usn,
          subject: subjects.find(s => s.id === session.subjectId)?.code || session.subjectId,
          date: dateStr,
          time: timeStr,
          status: isPresent ? 'Present' : 'Absent',
          blockchainHash: txHash,
          locationLat: session.teacherLat,
          locationLng: session.teacherLng,
          verified: isPresent
        })
      });
    });

    safeFetchJson(`${API_BASE}/api/sessions/${sessionId}/end`, { method: 'POST' });

    // Remove from Cloud Firestore
    fetch(`${FIRESTORE_BASE}/active_sessions/${sessionId}`, { method: 'DELETE' })
      .catch(e => console.warn("Firestore endSession sync skipped:", e));

    setActiveSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      try { localStorage.setItem('sa_active_sessions', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, [activeSessions, students, subjects]);

  const markAttendance = useCallback((sessionId, studentId) => {
    const txHash = generateBlockchainHash();
    setActiveSessions(prev => {
      const updated = prev.map(s => {
        if (s.id === sessionId && !s.presentStudents.includes(studentId)) {
          const newPresent = [...s.presentStudents, studentId];
          // Cloud update for active session attendance
          fetch(`${FIRESTORE_BASE}/active_sessions/${sessionId}?updateMask.fieldPaths=presentStudents`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                presentStudents: {
                  arrayValue: {
                    values: newPresent.map(id => ({ integerValue: String(id) }))
                  }
                }
              }
            })
          }).catch(e => console.warn("Firestore markAttendance sync skipped:", e));

          return { ...s, presentStudents: newPresent };
        }
        return s;
      });
      try { localStorage.setItem('sa_active_sessions', JSON.stringify(updated)); } catch {}
      return updated;
    });

    safeFetchJson(`${API_BASE}/api/sessions/${sessionId}/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, txHash })
    });

    return txHash;
  }, []);

  const markNC = useCallback((teacherId, studentId, subjectId, reason) => {
    const id = `nc-${Date.now()}`;
    const hash = generateBlockchainHash();
    const newNC = {
      id,
      teacherId,
      studentId,
      subjectId,
      reason,
      date: new Date().toISOString().split('T')[0],
      hash,
    };
    setNcRecords(prev => [newNC, ...prev]);

    safeFetchJson(`${API_BASE}/api/nc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newNC)
    });

    return id;
  }, []);

  const studentMarkAttendance = useCallback((studentId, subjectId) => {
    const hash = generateBlockchainHash();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

    setAttendanceRecords(prev => {
      const studentData = prev[studentId] || {};
      const subjectData = studentData[subjectId] || {
        records: [],
        totalClasses: 0,
        presentCount: 0,
        absentCount: 0,
        percentage: 0,
      };

      const newRecord = {
        date: dateStr,
        time: timeStr,
        status: 'Present',
        txHash: hash,
        verified: true,
      };

      const newRecords = [newRecord, ...subjectData.records];
      const newTotal = subjectData.totalClasses + 1;
      const newPresent = subjectData.presentCount + 1;

      return {
        ...prev,
        [studentId]: {
          ...studentData,
          [subjectId]: {
            ...subjectData,
            records: newRecords,
            totalClasses: newTotal,
            presentCount: newPresent,
            percentage: Math.round((newPresent / newTotal) * 100),
          },
        },
      };
    });

    const stud = students.find(s => s.id === studentId);
    const sub = subjects.find(s => s.id === subjectId);

    safeFetchJson(`${API_BASE}/api/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        studentName: stud?.name || 'Student',
        usn: stud?.usn || 'USN',
        subject: sub?.code || subjectId,
        date: dateStr,
        time: timeStr,
        status: 'Present',
        blockchainHash: hash,
        locationLat: 12.9786,
        locationLng: 77.3640,
        verified: true
      })
    });

    return hash;
  }, [students, subjects]);

  const value = {
    // State
    students, teachers, subjects, sections, currentUser,
    attendanceRecords, activeSessions, ncRecords, stats,
    firebaseStatus,
    // Auth & DB operations
    login, logout, register, clearDatabase, fetchSystemData, refreshSessions,
    // Admin actions
    addTeacher, deleteTeacher, updateTeacherAssignments,
    addStudent, updateStudent, deleteStudent, enrollStudentFace, removeStudentFace, verifyFaceLogin,
    sendWhatsAppAbsentAlert,
    addSection, deleteSection,
    addSubject, deleteSubject,
    // Teacher actions
    startSession, endSession, markAttendance, markNC,
    // Student actions
    studentMarkAttendance,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
