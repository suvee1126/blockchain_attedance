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

export function AppProvider({ children }) {
  // Initialize states with local cached data so reload never blanks out the screen
  const [students, setStudents] = useState(() => {
    try {
      const c = localStorage.getItem('sa_cached_students');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });
  const [teachers, setTeachers] = useState(() => {
    try {
      const c = localStorage.getItem('sa_cached_teachers');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });
  const [subjects, setSubjects] = useState(() => {
    try {
      const c = localStorage.getItem('sa_cached_subjects');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });
  const [sections, setSections] = useState(() => {
    try {
      const c = localStorage.getItem('sa_cached_sections');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [activeSessions, setActiveSessions] = useState([]);
  const [ncRecords, setNcRecords] = useState([]);

  const [firebaseStatus, setFirebaseStatus] = useState(null);

  // Load system data from Python API on mount (with Supabase fallback)
  const fetchSystemData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/system/data`);
      if (res.ok) {
        const pyData = await res.json();
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
        if (pyData.activeSessions) setActiveSessions(pyData.activeSessions);
        if (pyData.ncRecords) setNcRecords(pyData.ncRecords);
        if (pyData.attendanceRecords) setAttendanceRecords(pyData.attendanceRecords);
        if (pyData.firebase) setFirebaseStatus(pyData.firebase);
        return pyData;
      }
    } catch (e) {
      console.warn("Python backend fetch /api/system/data failed, falling back to cached state/Supabase:", e);
    }

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
      console.warn("Supabase load skipped:", err.message);
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
        console.warn("Supabase record fetch skipped:", err.message);
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
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, email: searchEmail, password: pwd })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Login failed. Please check your credentials.');
      }
      if (data.success && data.user) {
        setCurrentUser(data.user);
        fetchSystemData();
        return data.user;
      }
    } catch (apiErr) {
      if (apiErr.message && !apiErr.message.includes('fetch') && !apiErr.message.includes('Failed to fetch')) {
        throw apiErr;
      }
      console.warn("Backend login fetch error, evaluating local state fallback:", apiErr);
    }

    // 2. Offline / local fallback if backend server is unreachable
    if (role === 'student') {
      const student = students.find(s => s.email.toLowerCase() === searchEmail || (s.usn && s.usn.toLowerCase() === searchEmail));
      if (!student) throw new Error(`No student found with email or USN '${email}'. Please contact Administrator or Register.`);
      if (student.password && student.password !== pwd) {
        throw new Error("Incorrect password for this student account.");
      }
      const studentSubjectIds = teachers
        .filter(t => t.assignedSections.includes(student.sectionId))
        .flatMap(t => t.assignedSubjects);
      const uniqueSubjectIds = [...new Set(studentSubjectIds)];
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
  }, [students, teachers, attendanceRecords, fetchSystemData]);

  const register = useCallback(async (role, userData) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, userData })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Registration failed.');
      }
      if (data.success && data.user) {
        setCurrentUser(data.user);
        await fetchSystemData();
        return data.user;
      }
      throw new Error('Registration failed.');
    } catch (err) {
      console.error("Registration error:", err);
      throw err;
    }
  }, [fetchSystemData]);

  const clearDatabase = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/database/clear`, {
        method: 'POST'
      });
      const data = await res.json();
      await fetchSystemData();
      return data;
    } catch (err) {
      console.error("Clear database error:", err);
      throw err;
    }
  }, [fetchSystemData]);

  const logout = useCallback(() => setCurrentUser(null), []);

  // ─── Admin: Manage Teachers ───
  const addTeacher = useCallback((teacher) => {
    const newId = `t${Date.now()}`;
    const newTeacher = { ...teacher, id: newId };
    setTeachers(prev => [...prev, newTeacher]);

    // Send to Python API
    fetch(`${API_BASE}/api/teachers`, {
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
    }).catch(e => console.error("Python addTeacher error:", e));

    // Supabase sync
    supabase.from('teachers').insert([{
      id: newId,
      name: teacher.name,
      email: teacher.email,
      department: teacher.department,
      assigned_subjects: teacher.assignedSubjects || [],
      assigned_sections: teacher.assignedSections || [],
      password: teacher.password || 'pass'
    }]).then(({ error }) => {
      if (error) console.warn("Supabase insert teacher skipped:", error.message);
    });
  }, []);

  const deleteTeacher = useCallback((id) => {
    setTeachers(prev => prev.filter(t => t.id !== id));

    fetch(`${API_BASE}/api/teachers/${id}`, { method: 'DELETE' }).catch(e => console.error("Python deleteTeacher error:", e));

    supabase.from('teachers').delete().eq('id', id).then(({ error }) => {
      if (error) console.warn("Supabase delete teacher skipped:", error.message);
    });
  }, []);

  const updateTeacherAssignments = useCallback((teacherId, assignedSubjects, assignedSections) => {
    setTeachers(prev =>
      prev.map(t => (t.id === teacherId ? { ...t, assignedSubjects, assignedSections } : t))
    );

    fetch(`${API_BASE}/api/teachers/${teacherId}/assignments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedSubjects, assignedSections })
    }).catch(e => console.error("Python update assignments error:", e));

    supabase.from('teachers').update({
      assigned_subjects: assignedSubjects,
      assigned_sections: assignedSections
    }).eq('id', teacherId).then(({ error }) => {
      if (error) console.warn("Supabase update teacher skipped:", error.message);
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
    setStudents(prev => [...prev, newStudent]);

    // Initialize attendance records for the new student
    const studentSubjectIds = teachers
      .filter(t => t.assignedSections.includes(student.sectionId))
      .flatMap(t => t.assignedSubjects);
    const uniqueSubjectIds = [...new Set(studentSubjectIds)];

    setAttendanceRecords(prev => ({
      ...prev,
      [newId]: generateSubjectAttendance(newId, uniqueSubjectIds),
    }));

    // Send to Python SQLite API
    fetch(`${API_BASE}/api/students`, {
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
    }).catch(e => console.error("Python addStudent error:", e));

    // Supabase sync
    supabase.from('students').insert([{
      id: newId,
      name: student.name,
      usn: student.usn,
      email: student.email,
      section_id: student.sectionId,
      password: student.password || 'pass',
      parent_name: student.parentName || '',
      parent_phone: student.parentPhone || ''
    }]).then(({ error }) => {
      if (error) console.warn("Supabase insert student skipped:", error.message);
    });
  }, [teachers]);

  const updateStudent = useCallback((studentId, updatedData) => {
    setStudents(prev =>
      prev.map(s => (s.id === studentId ? { ...s, ...updatedData } : s))
    );

    fetch(`${API_BASE}/api/students/${studentId}`, {
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
    }).catch(e => console.error("Python updateStudent error:", e));

    supabase.from('students').update({
      name: updatedData.name,
      usn: updatedData.usn,
      email: updatedData.email,
      section_id: updatedData.sectionId,
      parent_name: updatedData.parentName || '',
      parent_phone: updatedData.parentPhone || ''
    }).eq('id', studentId).then(({ error }) => {
      if (error) console.warn("Supabase update student skipped:", error.message);
    });
  }, []);

  const deleteStudent = useCallback((id) => {
    setStudents(prev => prev.filter(s => s.id !== id));
    setAttendanceRecords(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    fetch(`${API_BASE}/api/students/${id}`, { method: 'DELETE' }).catch(e => console.error("Python deleteStudent error:", e));

    supabase.from('students').delete().eq('id', id).then(({ error }) => {
      if (error) console.warn("Supabase delete student skipped:", error.message);
    });
  }, []);

  // ─── Face Biometrics Management ───
  const enrollStudentFace = useCallback(async (studentId, imageData) => {
    const res = await fetch(`${API_BASE}/api/students/${studentId}/enroll-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to enroll face biometric.');
    }

    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          faceRegistered: true,
          faceImage: data.thumbnail || s.faceImage,
          faceEnrolledAt: data.enrolledAt
        };
      }
      return s;
    }));

    return data;
  }, []);

  const removeStudentFace = useCallback(async (studentId) => {
    const res = await fetch(`${API_BASE}/api/students/${studentId}/remove-face`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to remove face biometric.');
    }

    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          faceRegistered: false,
          faceDescriptor: [],
          faceImage: '',
          faceEnrolledAt: ''
        };
      }
      return s;
    }));

    return data;
  }, []);

  const verifyFaceLogin = useCallback(async (emailOrUsn, password, imageData) => {
    const res = await fetch(`${API_BASE}/api/auth/verify-face-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrUsn, password: password || '', imageData })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Face verification failed.');
    }

    if (data.success && data.user) {
      setCurrentUser(data.user);
      fetchSystemData();
      return data;
    }
    throw new Error('Face login response invalid.');
  }, [fetchSystemData]);

  // ─── WhatsApp Absentee Notification ───
  const sendWhatsAppAbsentAlert = useCallback(async ({ studentId, parentPhone, parentName, studentName, subjectName, date, time }) => {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/whatsapp-absent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          parentPhone,
          parentName,
          studentName,
          subjectName,
          date,
          time
        })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error("WhatsApp notification dispatch error:", err);
      throw err;
    }
  }, []);

  // ─── Admin: Manage Sections ───
  const addSection = useCallback((section) => {
    const newId = `s${Date.now()}`;
    const newSection = { ...section, id: newId };
    setSections(prev => [...prev, newSection]);

    fetch(`${API_BASE}/api/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newId, name: section.name, year: section.year })
    }).catch(e => console.error("Python addSection error:", e));

    supabase.from('sections').insert([{ id: newId, name: section.name, year: section.year }]).then(({ error }) => {
      if (error) console.warn("Supabase insert section skipped:", error.message);
    });
  }, []);

  const deleteSection = useCallback((id) => {
    setSections(prev => prev.filter(s => s.id !== id));
    fetch(`${API_BASE}/api/sections/${id}`, { method: 'DELETE' }).catch(e => console.error("Python deleteSection error:", e));
    supabase.from('sections').delete().eq('id', id).then(({ error }) => {
      if (error) console.warn("Supabase delete section skipped:", error.message);
    });
  }, []);

  // ─── Admin: Manage Subjects ───
  const addSubject = useCallback((subject) => {
    const newId = `sub${Date.now()}`;
    const newSubject = { ...subject, id: newId };
    setSubjects(prev => [...prev, newSubject]);

    fetch(`${API_BASE}/api/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newId, name: subject.name, code: subject.code })
    }).catch(e => console.error("Python addSubject error:", e));

    supabase.from('subjects').insert([{ id: newId, name: subject.name, code: subject.code }]).then(({ error }) => {
      if (error) console.warn("Supabase insert subject skipped:", error.message);
    });
  }, []);

  const deleteSubject = useCallback((id) => {
    setSubjects(prev => prev.filter(s => s.id !== id));
    fetch(`${API_BASE}/api/subjects/${id}`, { method: 'DELETE' }).catch(e => console.error("Python deleteSubject error:", e));
    supabase.from('subjects').delete().eq('id', id).then(({ error }) => {
      if (error) console.warn("Supabase delete subject skipped:", error.message);
    });
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

    setActiveSessions(prev => [newSession, ...prev]);

    fetch(`${API_BASE}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSession)
    }).catch(e => console.error("Python startSession error:", e));

    return sessionId;
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

      fetch(`${API_BASE}/api/attendance`, {
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
      }).catch(e => console.error("Python mark attendance error:", e));
    });

    fetch(`${API_BASE}/api/sessions/${sessionId}/end`, { method: 'POST' }).catch(e => console.error("Python endSession error:", e));

    setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
  }, [activeSessions, students, subjects]);

  const markAttendance = useCallback((sessionId, studentId) => {
    const txHash = generateBlockchainHash();
    setActiveSessions(prev =>
      prev.map(s => {
        if (s.id === sessionId && !s.presentStudents.includes(studentId)) {
          return { ...s, presentStudents: [...s.presentStudents, studentId] };
        }
        return s;
      })
    );

    fetch(`${API_BASE}/api/sessions/${sessionId}/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, txHash })
    }).catch(e => console.error("Python mark error:", e));

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

    fetch(`${API_BASE}/api/nc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newNC)
    }).catch(e => console.error("Python markNC error:", e));

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

    fetch(`${API_BASE}/api/attendance`, {
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
    }).catch(e => console.error("Python attendance error:", e));

    return hash;
  }, [students, subjects]);

  const value = {
    // State
    students, teachers, subjects, sections, currentUser,
    attendanceRecords, activeSessions, ncRecords, stats,
    firebaseStatus,
    // Auth & DB operations
    login, logout, register, clearDatabase, fetchSystemData,
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
