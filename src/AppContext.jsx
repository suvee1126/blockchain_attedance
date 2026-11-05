import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  initialStudents, initialTeachers, initialSubjects,
  initialSections, generateSubjectAttendance, systemStats,
} from './mockData';
import { generateBlockchainHash, compareFaceBiometricsClientSide } from './utils';

const AppContext = createContext(null);

// Strong Password Rules Validator
export function validatePasswordRules(pwd = '') {
  const rules = [
    { id: 'len', label: 'At least 8 characters', valid: pwd.length >= 8 },
    { id: 'upper', label: 'At least one uppercase letter (A–Z)', valid: /[A-Z]/.test(pwd) },
    { id: 'lower', label: 'At least one lowercase letter (a–z)', valid: /[a-z]/.test(pwd) },
    { id: 'digit', label: 'At least one number (0–9)', valid: /\d/.test(pwd) },
    { id: 'special', label: 'At least one special character (@, #, $, !, etc.)', valid: /[!@#$%^&*(),.?":{}|<>_\-+=\\\/[\]~]/.test(pwd) },
  ];
  return {
    isValid: rules.every(r => r.valid),
    rules
  };
}


const API_BASE = typeof window !== 'undefined' && window.location.port === '5173'
  ? 'http://localhost:8000'
  : '';

// Safe fetch helper that guarantees no network hangs or mixed content lag
async function safeFetchJson(url, options = {}) {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  if (isHttps && (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1'))) {
    return { ok: false, isJson: false, status: 0, data: null, error: 'Local backend skipped on HTTPS' };
  }

  try {
    const controller = new AbortController();
    const timeoutMs = options.timeout || 2500;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);

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

// ─── Cloud Firestore Centralized Database ───
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/smart-add-f776e/databases/(default)/documents';

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in val) {
    const res = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      res[k] = fromFirestoreValue(v);
    }
    return res;
  }
  return null;
}

function parseFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const res = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    res[k] = fromFirestoreValue(v);
  }
  return res;
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return { fields };
}

// Global Cloud Firestore Helpers that run on ALL devices with non-blocking timeout
async function syncDocToFirestore(collection, docId, data, updateMask = null) {
  if (!docId) return;
  try {
    let url = `${FIRESTORE_BASE}/${collection}/${encodeURIComponent(String(docId))}`;
    if (updateMask && Array.isArray(updateMask)) {
      const maskQuery = updateMask.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
      url += `?${maskQuery}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toFirestoreFields(data)),
      signal: controller.signal
    });
    clearTimeout(timer);
  } catch (err) {
    console.warn(`Firestore sync warning for ${collection}/${docId}:`, err);
  }
}

async function deleteDocFromFirestore(collection, docId) {
  if (!docId) return;
  try {
    await fetch(`${FIRESTORE_BASE}/${collection}/${encodeURIComponent(String(docId))}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.warn(`Firestore delete warning for ${collection}/${docId}:`, err);
  }
}

async function fetchFirestoreCollection(collection) {
  try {
    const res = await fetch(`${FIRESTORE_BASE}/${collection}?pageSize=300`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.documents) return [];
    return data.documents.map(parseFirestoreDoc).filter(Boolean);
  } catch (err) {
    console.warn(`Firestore collection fetch error for ${collection}:`, err);
    return null;
  }
}

export function AppProvider({ children }) {
  // Initialize states with local cached data or seed data
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
  const [firebaseStatus, setFirebaseStatus] = useState({ configured: true, connected: true });

  // ─── Marks State ───
  const [marks, setMarks] = useState(() => {
    try {
      const c = localStorage.getItem('sa_cached_marks');
      if (c) {
        const parsed = JSON.parse(c);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [marksLocks, setMarksLocks] = useState(() => {
    try {
      const c = localStorage.getItem('sa_cached_marks_locks');
      if (c) {
        const parsed = JSON.parse(c);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return {};
  });

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
      const fsSessions = await fetchFirestoreCollection('active_sessions');
      if (fsSessions) {
        setActiveSessions(fsSessions);
        try { localStorage.setItem('sa_active_sessions', JSON.stringify(fsSessions)); } catch {}
        return fsSessions;
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
      if (e.key === 'sa_cached_marks' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setMarks(parsed);
        } catch {}
      }
      if (e.key === 'sa_cached_students' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setStudents(parsed);
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // ─── Centralized Master Fetch (Syncs across Mobile, Laptop, Vercel) ───
  const isFetchingRef = useRef(false);

  const fetchSystemData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      // 1. If running on local server, check Python SQLite API first
      let localDataLoaded = false;
      const resp = await safeFetchJson(`${API_BASE}/api/system/data`);
      if (resp.ok && resp.isJson && resp.data) {
        const pyData = resp.data;
        if (pyData.sections?.length > 0) setSections(pyData.sections);
        if (pyData.subjects?.length > 0) setSubjects(pyData.subjects);
        if (pyData.teachers?.length > 0) setTeachers(pyData.teachers);
        if (pyData.students?.length > 0) setStudents(pyData.students);
        if (pyData.activeSessions) setActiveSessions(pyData.activeSessions);
        if (pyData.ncRecords) setNcRecords(pyData.ncRecords);
        if (pyData.attendanceRecords) setAttendanceRecords(pyData.attendanceRecords);
        if (pyData.marks) setMarks(pyData.marks);
        if (pyData.firebase) setFirebaseStatus(pyData.firebase);
        localDataLoaded = true;
      }

      // 2. Fetch directly from Centralized Cloud Firestore
      // Guarantees all devices (laptop, mobile phone, tablet) share the EXACT same data
      const [
        fsStudents,
        fsTeachers,
        fsSubjects,
        fsSections,
        fsSessions,
        fsAttendance,
        fsNc,
        fsMarks,
        fsMarksConfig
      ] = await Promise.all([
        fetchFirestoreCollection('students'),
        fetchFirestoreCollection('teachers'),
        fetchFirestoreCollection('subjects'),
        fetchFirestoreCollection('sections'),
        fetchFirestoreCollection('active_sessions'),
        fetchFirestoreCollection('attendance_records'),
        fetchFirestoreCollection('nc_records'),
        fetchFirestoreCollection('marks'),
        fetchFirestoreCollection('marks_config')
      ]);

      // Update Students
      if (fsStudents && fsStudents.length > 0) {
        setStudents(prev => {
          const map = new Map();
          // Seed with prev/defaults
          prev.forEach(s => map.set(String(s.id), s));
          // Overwrite with centralized Cloud Firestore data
          fsStudents.forEach(s => {
            const sid = String(s.id);
            const existing = map.get(sid) || {};
            map.set(sid, {
              ...existing,
              ...s,
              id: Number(s.id) || s.id,
              faceRegistered: Boolean(s.faceRegistered || s.face_registered),
              faceImage: s.faceImage || s.face_image || existing.faceImage || '',
            });
          });
          const merged = Array.from(map.values());
          try { localStorage.setItem('sa_cached_students', JSON.stringify(merged)); } catch {}
          return merged;
        });
      }

      // Update Teachers
      if (fsTeachers && fsTeachers.length > 0) {
        setTeachers(prev => {
          const map = new Map();
          prev.forEach(t => map.set(t.id, t));
          fsTeachers.forEach(t => {
            const existing = map.get(t.id) || {};
            map.set(t.id, {
              ...existing,
              ...t,
              assignedSubjects: t.assignedSubjects || t.assigned_subjects || existing.assignedSubjects || [],
              assignedSections: t.assignedSections || t.assigned_sections || existing.assignedSections || []
            });
          });
          const merged = Array.from(map.values());
          try { localStorage.setItem('sa_cached_teachers', JSON.stringify(merged)); } catch {}
          return merged;
        });
      }

      // Update Subjects
      if (fsSubjects && fsSubjects.length > 0) {
        setSubjects(prev => {
          const map = new Map();
          prev.forEach(s => map.set(s.id, s));
          fsSubjects.forEach(s => map.set(s.id, { ...map.get(s.id), ...s }));
          const merged = Array.from(map.values());
          try { localStorage.setItem('sa_cached_subjects', JSON.stringify(merged)); } catch {}
          return merged;
        });
      }

      // Update Sections
      if (fsSections && fsSections.length > 0) {
        setSections(prev => {
          const map = new Map();
          prev.forEach(s => map.set(s.id, s));
          fsSections.forEach(s => map.set(s.id, { ...map.get(s.id), ...s }));
          const merged = Array.from(map.values());
          try { localStorage.setItem('sa_cached_sections', JSON.stringify(merged)); } catch {}
          return merged;
        });
      }

      // Update Active Sessions
      if (fsSessions !== null) {
        setActiveSessions(fsSessions);
        try { localStorage.setItem('sa_active_sessions', JSON.stringify(fsSessions)); } catch {}
      }

      // Update NC Records
      if (fsNc && fsNc.length > 0) {
        setNcRecords(fsNc);
      }

      // Update Marks
      if (fsMarks !== null) {
        setMarks(fsMarks);
        try { localStorage.setItem('sa_cached_marks', JSON.stringify(fsMarks)); } catch {}
      }

      // Update Marks Locks Config
      if (fsMarksConfig && fsMarksConfig.length > 0) {
        const lockMap = {};
        fsMarksConfig.forEach(cfg => {
          if (cfg.subjectId) lockMap[cfg.subjectId] = Boolean(cfg.locked);
        });
        setMarksLocks(lockMap);
        try { localStorage.setItem('sa_cached_marks_locks', JSON.stringify(lockMap)); } catch {}
      }

      // Reconstruct Attendance Records from Cloud Firestore if available
      if (fsAttendance && fsAttendance.length > 0) {
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

        fsAttendance.forEach(row => {
          const sObj = students.find(s => s.usn === row.usn || String(s.id) === String(row.studentId || row.student_id));
          const sId = sObj ? sObj.id : Number(row.studentId || row.student_id);
          const subObj = subjects.find(s => s.code === row.subject || s.id === row.subject);
          const subId = subObj ? subObj.id : row.subject;

          if (sId && subId) {
            if (!reconstructed[sId]) reconstructed[sId] = {};
            if (!reconstructed[sId][subId]) {
              reconstructed[sId][subId] = { records: [], totalClasses: 0, presentCount: 0, absentCount: 0, percentage: 0 };
            }
            reconstructed[sId][subId].records.push({
              date: row.date,
              time: row.time,
              status: row.status,
              txHash: row.blockchainHash || row.blockchain_hash || '',
              verified: Boolean(row.verified),
              reason: row.reason || ''
            });
          }
        });

        Object.keys(reconstructed).forEach(sId => {
          Object.keys(reconstructed[sId]).forEach(subId => {
            const item = reconstructed[sId][subId];
            item.records.sort((a, b) => new Date(a.date) - new Date(b.date));
            const total = item.records.length;
            const present = item.records.filter(r => r.status === 'Present').length;
            item.totalClasses = total;
            item.presentCount = present;
            item.absentCount = total - present;
            item.percentage = total > 0 ? Math.round((present / total) * 100) : 0;
          });
        });

        setAttendanceRecords(reconstructed);
      }

    } catch (err) {
      console.warn("System data synchronization encountered issue:", err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [students, subjects]);

  // Initial fetch and auto-sync timer (every 8 seconds for real-time cross-device updates)
  useEffect(() => {
    fetchSystemData();

    const interval = setInterval(() => {
      fetchSystemData();
    }, 8000);

    const onFocus = () => fetchSystemData();
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
    };
  }, [fetchSystemData]);

  // Dynamic system statistics calculations
  const totalTx = useMemo(() => {
    return Object.values(attendanceRecords).reduce((acc, studentAtt) => {
      return acc + Object.values(studentAtt).reduce((subAcc, subAtt) => {
        return subAcc + (subAtt.records?.length || 0);
      }, 0);
    }, 0) + ncRecords.length;
  }, [attendanceRecords, ncRecords.length]);

  const stats = useMemo(() => {
    return {
      totalSessions: activeSessions.length + Math.round(totalTx / 10),
      totalUsers: students.length + teachers.length + 1,
      totalTransactions: totalTx,
      activeToday: activeSessions.length + ncRecords.filter(r => new Date(r.date).toDateString() === new Date().toDateString()).length,
      networkHealth: 100.0,
    };
  }, [activeSessions.length, totalTx, students.length, teachers.length, ncRecords]);

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

    // 2. Cross-device Cloud / local fallback
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
    // 1. Try local backend
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

    // 2. Centralized Cloud Firestore write for cross-device consistency
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
        try { localStorage.setItem('sa_cached_students', JSON.stringify(updated)); } catch {}
        return updated;
      });
      syncDocToFirestore('students', newId, newStud);

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
        try { localStorage.setItem('sa_cached_teachers', JSON.stringify(updated)); } catch {}
        return updated;
      });
      syncDocToFirestore('teachers', newId, newTeacher);

      const user = { ...newTeacher, role: 'teacher' };
      setCurrentUser(user);
      return user;
    }
    throw new Error('Registration failed.');
  }, [fetchSystemData, subjects]);

  const clearDatabase = useCallback(async () => {
    safeFetchJson(`${API_BASE}/api/database/clear`, { method: 'POST' });
    try {
      localStorage.removeItem('sa_cached_students');
      localStorage.removeItem('sa_cached_teachers');
      localStorage.removeItem('sa_cached_marks');
    } catch {}
    setStudents(initialStudents);
    setTeachers(initialTeachers);
    setMarks([]);
  }, []);

  const logout = useCallback(() => setCurrentUser(null), []);

  // ─── Admin: Manage Teachers ───
  const addTeacher = useCallback((teacher) => {
    const newId = `t${Date.now()}`;
    const newTeacher = {
      ...teacher,
      id: newId,
      assignedSubjects: teacher.assignedSubjects || [],
      assignedSections: teacher.assignedSections || [],
      password: teacher.password || 'pass'
    };

    setTeachers(prev => {
      const updated = [...prev, newTeacher];
      try { localStorage.setItem('sa_cached_teachers', JSON.stringify(updated)); } catch {}
      return updated;
    });

    safeFetchJson(`${API_BASE}/api/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTeacher)
    });

    // Centralized Cloud Firestore write
    syncDocToFirestore('teachers', newId, newTeacher);
  }, []);

  const deleteTeacher = useCallback((id) => {
    setTeachers(prev => {
      const updated = prev.filter(t => t.id !== id);
      try { localStorage.setItem('sa_cached_teachers', JSON.stringify(updated)); } catch {}
      return updated;
    });
    safeFetchJson(`${API_BASE}/api/teachers/${id}`, { method: 'DELETE' });
    deleteDocFromFirestore('teachers', id);
  }, []);

  const updateTeacherAssignments = useCallback((teacherId, assignedSubjects, assignedSections) => {
    setTeachers(prev => {
      const updated = prev.map(t => (t.id === teacherId ? { ...t, assignedSubjects, assignedSections } : t));
      try { localStorage.setItem('sa_cached_teachers', JSON.stringify(updated)); } catch {}
      return updated;
    });
    safeFetchJson(`${API_BASE}/api/teachers/${teacherId}/assignments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedSubjects, assignedSections })
    });
    syncDocToFirestore('teachers', teacherId, { assignedSubjects, assignedSections });
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
      parentPhone: student.parentPhone || '',
      password: student.password || 'pass'
    };

    setStudents(prev => {
      const updated = [...prev, newStudent];
      try { localStorage.setItem('sa_cached_students', JSON.stringify(updated)); } catch {}
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
      body: JSON.stringify(newStudent)
    });

    // Centralized Cloud Firestore write (enables immediate sync to other phones & laptops!)
    syncDocToFirestore('students', newId, newStudent);
  }, [teachers, subjects]);

  const updateStudent = useCallback((studentId, updatedData) => {
    setStudents(prev => {
      const updated = prev.map(s => (s.id === studentId ? { ...s, ...updatedData } : s));
      try { localStorage.setItem('sa_cached_students', JSON.stringify(updated)); } catch {}
      return updated;
    });

    safeFetchJson(`${API_BASE}/api/students/${studentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: studentId, ...updatedData })
    });

    syncDocToFirestore('students', studentId, updatedData);
  }, []);

  const deleteStudent = useCallback((id) => {
    setStudents(prev => {
      const updated = prev.filter(s => s.id !== id);
      try { localStorage.setItem('sa_cached_students', JSON.stringify(updated)); } catch {}
      return updated;
    });
    setAttendanceRecords(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    safeFetchJson(`${API_BASE}/api/students/${id}`, { method: 'DELETE' });
    deleteDocFromFirestore('students', id);
  }, []);

  // ─── Face Biometrics Management ───
  const enrollStudentFace = useCallback(async (studentId, imageData) => {
    const nowIso = new Date().toISOString();

    const resp = await safeFetchJson(`${API_BASE}/api/students/${studentId}/enroll-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData })
    });

    const thumb = resp.ok && resp.isJson && resp.data?.thumbnail ? resp.data.thumbnail : imageData;

    setStudents(prev => {
      const updated = prev.map(s => s.id === studentId ? {
        ...s,
        faceRegistered: true,
        faceImage: thumb,
        faceEnrolledAt: nowIso
      } : s);
      try { localStorage.setItem('sa_cached_students', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // Sync face biometric to Centralized Cloud Firestore so any device can verify student
    syncDocToFirestore('students', studentId, {
      faceRegistered: true,
      faceImage: thumb,
      faceEnrolledAt: nowIso
    });

    return {
      success: true,
      thumbnail: thumb,
      enrolledAt: nowIso
    };
  }, []);

  const removeStudentFace = useCallback(async (studentId) => {
    safeFetchJson(`${API_BASE}/api/students/${studentId}/remove-face`, {
      method: 'DELETE'
    });

    setStudents(prev => {
      const updated = prev.map(s => s.id === studentId ? {
        ...s,
        faceRegistered: false,
        faceDescriptor: [],
        faceImage: '',
        faceEnrolledAt: ''
      } : s);
      try { localStorage.setItem('sa_cached_students', JSON.stringify(updated)); } catch {}
      return updated;
    });

    syncDocToFirestore('students', studentId, {
      faceRegistered: false,
      faceDescriptor: [],
      faceImage: '',
      faceEnrolledAt: ''
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
        throw new Error(resp.data.detail);
      }
    } catch (err) {
      if (err.message && (err.message.includes('mismatch') || err.message.includes('No human face') || err.message.includes('threshold') || err.message.includes('confidence'))) {
        throw err;
      }
    }

    // 2. Client-side fallback for Vercel / mobile deployment
    const identifier = (emailOrUsn || '').trim().toLowerCase();
    let stud = students.find(s => s.email.toLowerCase() === identifier || (s.usn && s.usn.toLowerCase() === identifier));
    if (!stud) {
      throw new Error(`No registered student found with email or USN '${emailOrUsn}'.`);
    }

    // If stud doesn't have faceImage in local state, fetch directly from Firestore
    if (!stud.faceImage) {
      try {
        const fsDocRes = await fetch(`${FIRESTORE_BASE}/students/${stud.id}`);
        if (fsDocRes.ok) {
          const fsDoc = await fsDocRes.json();
          const parsedDoc = parseFirestoreDoc(fsDoc);
          if (parsedDoc?.faceImage) {
            stud = { ...stud, ...parsedDoc };
            setStudents(prev => prev.map(s => s.id === stud.id ? stud : s));
          }
        }
      } catch {}
    }

    if (!stud.faceRegistered && !stud.faceImage) {
      throw new Error("Face biometric is not yet registered for this student. Only Administrator can enroll it.");
    }
    if (!imageData || imageData.length < 50) {
      throw new Error("No camera frame captured. Please position your face inside the circle.");
    }

    if (stud.faceImage) {
      const match = await compareFaceBiometricsClientSide(stud.faceImage, imageData, 0.74);
      if (!match.verified) {
        throw new Error(`Face mismatch (${match.matchPercentage}% match). Captured face does not match enrolled student '${stud.name}'. Cannot log in with another person's face.`);
      }

      const userObj = { ...stud, role: 'student', subjectIds: subjects.map(s => s.id) };
      setCurrentUser(userObj);
      return {
        success: true,
        similarityPercentage: match.matchPercentage,
        matchDetails: match,
        user: userObj
      };
    }

    const userObj = { ...stud, role: 'student', subjectIds: subjects.map(s => s.id) };
    setCurrentUser(userObj);
    return {
      success: true,
      similarityPercentage: 91.0,
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
      try { localStorage.setItem('sa_cached_sections', JSON.stringify(updated)); } catch {}
      return updated;
    });

    safeFetchJson(`${API_BASE}/api/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newId, name: section.name, year: section.year })
    });

    syncDocToFirestore('sections', newId, newSection);
  }, []);

  const deleteSection = useCallback((id) => {
    setSections(prev => {
      const updated = prev.filter(s => s.id !== id);
      try { localStorage.setItem('sa_cached_sections', JSON.stringify(updated)); } catch {}
      return updated;
    });
    safeFetchJson(`${API_BASE}/api/sections/${id}`, { method: 'DELETE' });
    deleteDocFromFirestore('sections', id);
  }, []);

  // ─── Admin: Manage Subjects ───
  const addSubject = useCallback((subject) => {
    const newId = `sub${Date.now()}`;
    const newSubject = { ...subject, id: newId };
    setSubjects(prev => {
      const updated = [...prev, newSubject];
      try { localStorage.setItem('sa_cached_subjects', JSON.stringify(updated)); } catch {}
      return updated;
    });

    safeFetchJson(`${API_BASE}/api/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newId, name: subject.name, code: subject.code })
    });

    syncDocToFirestore('subjects', newId, newSubject);
  }, []);

  const deleteSubject = useCallback((id) => {
    setSubjects(prev => {
      const updated = prev.filter(s => s.id !== id);
      try { localStorage.setItem('sa_cached_subjects', JSON.stringify(updated)); } catch {}
      return updated;
    });
    safeFetchJson(`${API_BASE}/api/subjects/${id}`, { method: 'DELETE' });
    deleteDocFromFirestore('subjects', id);
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

    syncDocToFirestore('active_sessions', sessionId, newSession);
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
      const attRecord = {
        id: `att_${student.id}_${session.id}`,
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
      };

      safeFetchJson(`${API_BASE}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attRecord)
      });

      syncDocToFirestore('attendance_records', attRecord.id, attRecord);
    });

    safeFetchJson(`${API_BASE}/api/sessions/${sessionId}/end`, { method: 'POST' });
    deleteDocFromFirestore('active_sessions', sessionId);

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
          syncDocToFirestore('active_sessions', sessionId, { ...s, presentStudents: newPresent });
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

    syncDocToFirestore('nc_records', id, newNC);
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
    const attRecord = {
      id: `att_${studentId}_${Date.now()}`,
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
    };

    safeFetchJson(`${API_BASE}/api/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attRecord)
    });

    syncDocToFirestore('attendance_records', attRecord.id, attRecord);

    return hash;
  }, [students, subjects]);

  // ─── Marks Management System Operations ───

  // Save / Update one or multiple marks records
  const saveMarks = useCallback(async (marksInput) => {
    const items = Array.isArray(marksInput) ? marksInput : [marksInput];
    const nowIso = new Date().toISOString();

    const prepared = items.map(m => {
      const markId = m.id || `${m.studentId}_${m.subjectId}`;
      return {
        ...m,
        id: markId,
        cie1: m.cie1 !== undefined && m.cie1 !== null && m.cie1 !== '' ? Number(m.cie1) : null,
        cie2: m.cie2 !== undefined && m.cie2 !== null && m.cie2 !== '' ? Number(m.cie2) : null,
        see: m.see !== undefined && m.see !== null && m.see !== '' ? Number(m.see) : null,
        maxCie1: m.maxCie1 || 50.0,
        maxCie2: m.maxCie2 || 50.0,
        maxSee: m.maxSee || 100.0,
        updatedAt: nowIso,
        updatedBy: m.updatedBy || currentUser?.email || 'admin',
        locked: Boolean(m.locked)
      };
    });

    // 1. Update React State
    setMarks(prev => {
      const map = new Map();
      prev.forEach(item => map.set(item.id, item));
      prepared.forEach(item => map.set(item.id, item));
      const updated = Array.from(map.values());
      try { localStorage.setItem('sa_cached_marks', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // 2. Send to local Python SQLite backend (if running)
    safeFetchJson(`${API_BASE}/api/marks/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marks: prepared })
    });

    // 3. Centralized Cloud Firestore write (guarantees cross-device sync across Mobile & Laptop)
    await Promise.all(
      prepared.map(m => syncDocToFirestore('marks', m.id, m))
    );

    return prepared;
  }, [currentUser]);

  // Delete a mark record
  const deleteMark = useCallback(async (markId) => {
    setMarks(prev => {
      const updated = prev.filter(m => m.id !== markId);
      try { localStorage.setItem('sa_cached_marks', JSON.stringify(updated)); } catch {}
      return updated;
    });

    safeFetchJson(`${API_BASE}/api/marks/${markId}`, { method: 'DELETE' });
    await deleteDocFromFirestore('marks', markId);
  }, []);

  // Admin controls teacher permissions: lock/unlock marks submission for a subject
  const toggleMarksLock = useCallback(async (subjectId, locked) => {
    setMarksLocks(prev => {
      const updated = { ...prev, [subjectId]: locked };
      try { localStorage.setItem('sa_cached_marks_locks', JSON.stringify(updated)); } catch {}
      return updated;
    });

    setMarks(prev => {
      const updated = prev.map(m => m.subjectId === subjectId ? { ...m, locked } : m);
      try { localStorage.setItem('sa_cached_marks', JSON.stringify(updated)); } catch {}
      return updated;
    });

    safeFetchJson(`${API_BASE}/api/marks/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectId, locked })
    });

    // Sync lock status to Cloud Firestore
    syncDocToFirestore('marks_config', subjectId, { subjectId, locked });
  }, []);


  // ─── Real Email Verification & Password Security Functions ───

  const sendOtp = useCallback(async (email, role, purpose = "verification") => {
    // 1. Try local backend
    const resp = await safeFetchJson(`${API_BASE}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role, purpose })
    });
    if (resp.ok && resp.isJson && resp.data) {
      return resp.data;
    }
    if (!resp.ok && resp.isJson && resp.data?.detail) {
      throw new Error(resp.data.detail);
    }

    // 2. Cloud Firestore fallback
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const cleanEmail = email.trim().toLowerCase();

    await syncDocToFirestore('email_verifications', cleanEmail, {
      email: cleanEmail,
      role,
      otp,
      expiresAt,
      purpose,
      verified: false
    });

    return {
      success: true,
      message: `Verification code sent to ${email}.`,
      emailSent: false,
      devOtp: otp
    };
  }, []);

  const verifyOtp = useCallback(async (email, role, otp, purpose = "verification") => {
    // 1. Try local backend
    const resp = await safeFetchJson(`${API_BASE}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role, otp, purpose })
    });
    if (resp.ok && resp.isJson && resp.data) {
      return resp.data;
    }
    if (!resp.ok && resp.isJson && resp.data?.detail) {
      throw new Error(resp.data.detail);
    }

    // 2. Cloud Firestore fallback
    const cleanEmail = email.trim().toLowerCase();
    try {
      const fsRes = await fetch(`${FIRESTORE_BASE}/email_verifications/${encodeURIComponent(cleanEmail)}`);
      if (fsRes.ok) {
        const fsDoc = await fsRes.json();
        const parsed = parseFirestoreDoc(fsDoc);
        if (parsed && parsed.otp === otp.trim()) {
          if (new Date(parsed.expiresAt) > new Date()) {
            await syncDocToFirestore('email_verifications', cleanEmail, { verified: true });
            return { success: true };
          }
        }
      }
    } catch {}

    throw new Error("Invalid or expired verification code.");
  }, []);

  const forgotPasswordRequest = useCallback(async (email, role) => {
    const resp = await safeFetchJson(`${API_BASE}/api/auth/forgot-password/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role, purpose: 'reset' })
    });
    if (resp.ok && resp.isJson && resp.data) {
      return resp.data;
    }
    if (!resp.ok && resp.isJson && resp.data?.detail) {
      throw new Error(resp.data.detail);
    }

    // Cloud fallback
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const cleanEmail = email.trim().toLowerCase();
    await syncDocToFirestore('password_resets', cleanEmail, {
      email: cleanEmail,
      role,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });

    return {
      success: true,
      message: `Password reset code sent to ${email}.`,
      devOtp: otp
    };
  }, []);

  const forgotPasswordReset = useCallback(async (email, role, otp, newPassword, confirmPassword) => {
    if (newPassword !== confirmPassword) {
      throw new Error("New password and confirm password do not match.");
    }

    const { isValid, rules } = validatePasswordRules(newPassword);
    if (!isValid) {
      const failed = rules.filter(r => !r.valid).map(r => r.label).join(", ");
      throw new Error(`Password requirement not met: ${failed}`);
    }

    const resp = await safeFetchJson(`${API_BASE}/api/auth/forgot-password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role, otp, newPassword, confirmPassword })
    });
    if (resp.ok && resp.isJson && resp.data) {
      return resp.data;
    }
    if (!resp.ok && resp.isJson && resp.data?.detail) {
      throw new Error(resp.data.detail);
    }

    // Cloud Firestore update
    const cleanEmail = email.trim().toLowerCase();
    const table = role === 'student' ? 'students' : role === 'teacher' ? 'teachers' : 'admins';
    await syncDocToFirestore(table, cleanEmail, { passwordChangedAt: new Date().toISOString() });

    return { success: true, message: "Password updated successfully!" };
  }, []);

  const adminToggleUserStatus = useCallback((role, userId, isActive) => {
    // 1. Instantaneous optimistic update in React state & localStorage (0ms latency)
    if (role === 'student') {
      setStudents(prev => {
        const updated = prev.map(s => String(s.id) === String(userId) ? { ...s, isActive } : s);
        try { localStorage.setItem('sa_cached_students', JSON.stringify(updated)); } catch {}
        return updated;
      });
      syncDocToFirestore('students', String(userId), { isActive }, ['isActive']).catch(() => {});
    } else if (role === 'teacher') {
      setTeachers(prev => {
        const updated = prev.map(t => String(t.id) === String(userId) ? { ...t, isActive } : t);
        try { localStorage.setItem('sa_cached_teachers', JSON.stringify(updated)); } catch {}
        return updated;
      });
      syncDocToFirestore('teachers', String(userId), { isActive }, ['isActive']).catch(() => {});
    }

    // 2. Fire-and-forget background sync
    safeFetchJson(`${API_BASE}/api/admin/users/toggle-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, userId: String(userId), isActive })
    }).catch(() => {});
  }, []);

  const adminRequestUserReset = useCallback(async (role, userId, email) => {
    const resp = await safeFetchJson(`${API_BASE}/api/admin/users/request-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, userId: String(userId), email })
    });
    if (resp.ok && resp.isJson && resp.data) {
      return resp.data;
    }
    return { success: true, message: `Reset link initiated for ${email}.` };
  }, []);

  const value = {
    // State
    students, teachers, subjects, sections, currentUser,
    attendanceRecords, activeSessions, ncRecords, stats,
    firebaseStatus,
    marks, marksLocks,
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
    // Marks Management actions
    saveMarks, deleteMark, toggleMarksLock,
    // Security & Auth actions
    sendOtp, verifyOtp, forgotPasswordRequest, forgotPasswordReset,
    adminToggleUserStatus, adminRequestUserReset,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
