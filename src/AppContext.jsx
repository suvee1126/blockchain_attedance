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
  // Initialize states to be loaded dynamically from Python Backend / Supabase
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
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
        if (pyData.sections) setSections(pyData.sections);
        if (pyData.subjects) setSubjects(pyData.subjects);
        if (pyData.teachers) setTeachers(pyData.teachers);
        if (pyData.students) setStudents(pyData.students);
        if (pyData.activeSessions) setActiveSessions(pyData.activeSessions);
        if (pyData.ncRecords) setNcRecords(pyData.ncRecords);
        if (pyData.attendanceRecords) setAttendanceRecords(pyData.attendanceRecords);
        if (pyData.firebase) setFirebaseStatus(pyData.firebase);
        return pyData;
      }
    } catch (e) {
      console.warn("Python backend fetch /api/system/data failed, falling back to Supabase/local:", e);
    }

    // Supabase fallback
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

      if (secErr) console.error("Error fetching sections:", secErr.message);
      else if (secData) setSections(secData);

      if (subErr) console.error("Error fetching subjects:", subErr.message);
      else if (subData) setSubjects(subData);

      if (teachErr) console.error("Error fetching teachers:", teachErr.message);
      else if (teachData) {
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

      if (studErr) console.error("Error fetching students:", studErr.message);
      else if (studData) {
        const mappedStudents = studData.map(s => ({
          id: Number(s.id),
          name: s.name,
          usn: s.usn,
          email: s.email,
          sectionId: s.section_id,
          password: s.password || 'pass'
        }));
        setStudents(mappedStudents);
      }

      if (sessErr) console.error("Error fetching sessions:", sessErr.message);
      else if (sessData) {
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

      if (ncErr) console.error("Error fetching NC records:", ncErr.message);
      else if (ncData) {
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
      console.error("Failed to load system data from Supabase:", err);
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
        data.forEach(r => {
          const student = students.find(s => s.usn.toLowerCase() === r.usn.toLowerCase());
          if (!student) return;

          const subject = subjects.find(s => s.code.toLowerCase() === r.subject.toLowerCase() || s.name.toLowerCase() === r.subject.toLowerCase());
          if (!subject) return;

          const studentId = student.id;
          const subjectId = subject.id;

          if (!reconstructed[studentId]) reconstructed[studentId] = {};
          if (!reconstructed[studentId][subjectId]) {
            reconstructed[studentId][subjectId] = {
              records: [],
              totalClasses: 0,
              presentCount: 0,
              absentCount: 0,
              percentage: 0
            };
          }

          reconstructed[studentId][subjectId].records.push({
            id: r.id,
            date: `${r.date}T${r.time || '12:00:00'}`,
            status: r.status,
            hash: r.blockchain_hash,
            verified: r.verified,
            lat: r.location_lat,
            lng: r.location_lng,
            reason: r.reason || ''
          });
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
        console.error("Failed to load records from Supabase:", err);
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
      const student = students.find(s => s.email.toLowerCase() === searchEmail);
      if (!student) throw new Error(`No student found with email '${email}'. Please contact Administrator or Register.`);
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
    } else if (role === 'teacher') {
      const teacher = teachers.find(t => t.email.toLowerCase() === searchEmail);
      if (!teacher) throw new Error(`No teacher found with email '${email}'. Please contact Administrator.`);
      if (teacher.password && teacher.password !== pwd) {
        throw new Error("Incorrect password for this teacher account.");
      }
      const user = { ...teacher, role: 'teacher' };
      setCurrentUser(user);
      return user;
    } else {
      if (searchEmail === 'admin@blockchain.edu' && pwd !== 'admin123') {
        throw new Error("Incorrect administrator password.");
      }
      const user = { id: 'admin', name: 'Administrator', role: 'admin', email: searchEmail };
      setCurrentUser(user);
      return user;
    }
  }, [students, teachers, attendanceRecords, fetchSystemData]);

  const register = useCallback(async (formData) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
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
      if (error) console.error("Error inserting teacher to Supabase:", error.message);
    });
  }, []);

  const deleteTeacher = useCallback((id) => {
    setTeachers(prev => prev.filter(t => t.id !== id));

    fetch(`${API_BASE}/api/teachers/${id}`, { method: 'DELETE' }).catch(e => console.error("Python deleteTeacher error:", e));

    supabase.from('teachers').delete().eq('id', id).then(({ error }) => {
      if (error) console.error("Error deleting teacher:", error.message);
    });
  }, []);

  const updateTeacherAssignments = useCallback((teacherId, assignedSubjects, assignedSections) => {
    setTeachers(prev => prev.map(t =>
      t.id === teacherId ? { ...t, assignedSubjects, assignedSections } : t
    ));

    fetch(`${API_BASE}/api/teachers/${teacherId}/assignments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedSubjects, assignedSections })
    }).catch(e => console.error("Python updateTeacherAssignments error:", e));

    supabase.from('teachers').update({
      assigned_subjects: assignedSubjects,
      assigned_sections: assignedSections
    }).eq('id', teacherId).then(({ error }) => {
      if (error) console.error("Error updating teacher assignments:", error.message);
    });
  }, []);

  // ─── Admin: Manage Students ───
  const addStudent = useCallback((student) => {
    const newId = Date.now();
    const newStudent = { ...student, id: newId };
    setStudents(prev => [...prev, newStudent]);

    fetch(`${API_BASE}/api/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newId,
        name: student.name,
        usn: student.usn,
        email: student.email,
        sectionId: student.sectionId,
        password: student.password || 'pass'
      })
    }).catch(e => console.error("Python addStudent error:", e));

    supabase.from('students').insert([{
      id: newId,
      name: student.name,
      usn: student.usn,
      email: student.email,
      section_id: student.sectionId,
      password: student.password || 'pass'
    }]).then(({ error }) => {
      if (error) console.error("Error inserting student:", error.message);
    });
  }, []);

  const deleteStudent = useCallback((id) => {
    setStudents(prev => prev.filter(s => s.id !== id));

    fetch(`${API_BASE}/api/students/${id}`, { method: 'DELETE' }).catch(e => console.error("Python deleteStudent error:", e));

    supabase.from('students').delete().eq('id', id).then(({ error }) => {
      if (error) console.error("Error deleting student:", error.message);
    });
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

    supabase.from('sections').insert([{
      id: newId,
      name: section.name,
      year: section.year
    }]).then(({ error }) => {
      if (error) console.error("Error inserting section:", error.message);
    });
  }, []);

  const deleteSection = useCallback((id) => {
    setSections(prev => prev.filter(s => s.id !== id));

    fetch(`${API_BASE}/api/sections/${id}`, { method: 'DELETE' }).catch(e => console.error("Python deleteSection error:", e));

    supabase.from('sections').delete().eq('id', id).then(({ error }) => {
      if (error) console.error("Error deleting section:", error.message);
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
      body: JSON.stringify({ id: newId, code: subject.code, name: subject.name })
    }).catch(e => console.error("Python addSubject error:", e));

    supabase.from('subjects').insert([{
      id: newId,
      name: subject.name,
      code: subject.code
    }]).then(({ error }) => {
      if (error) console.error("Error inserting subject:", error.message);
    });
  }, []);

  const deleteSubject = useCallback((id) => {
    setSubjects(prev => prev.filter(s => s.id !== id));

    fetch(`${API_BASE}/api/subjects/${id}`, { method: 'DELETE' }).catch(e => console.error("Python deleteSubject error:", e));

    supabase.from('subjects').delete().eq('id', id).then(({ error }) => {
      if (error) console.error("Error deleting subject:", error.message);
    });
  }, []);

  // ─── Teacher: Start Session ───
  const startSession = useCallback((teacherId, subjectId, sectionId, timerMinutes, lat = 0, lng = 0) => {
    const newId = `sess-${Date.now()}`;
    const session = {
      id: newId,
      teacherId,
      subjectId,
      sectionId,
      timerMinutes,
      startedAt: new Date().toISOString(),
      presentStudents: [],
      hash: generateBlockchainHash(),
      teacherLat: lat,
      teacherLng: lng,
    };
    setActiveSessions(prev => [...prev, session]);

    fetch(`${API_BASE}/api/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId, subjectId, sectionId, timerMinutes, lat, lng })
    }).catch(e => console.error("Python startSession error:", e));

    supabase.from('active_sessions').insert([{
      id: newId,
      teacher_id: teacherId,
      subject_id: subjectId,
      section_id: sectionId,
      timer_minutes: timerMinutes,
      started_at: session.startedAt,
      present_students: [],
      hash: session.hash,
      teacher_lat: lat,
      teacher_lng: lng
    }]).then(({ error }) => {
      if (error) console.error("Error inserting active session:", error.message);
    });

    return session;
  }, []);

  const endSession = useCallback((sessionId) => {
    setActiveSessions(prev => prev.filter(s => s.id !== sessionId));

    fetch(`${API_BASE}/api/sessions/end/${sessionId}`, { method: 'POST' }).catch(e => console.error("Python endSession error:", e));

    supabase.from('active_sessions').delete().eq('id', sessionId).then(({ error }) => {
      if (error) console.error("Error ending active session:", error.message);
    });
  }, []);

  // ─── Teacher: Mark Attendance (simulated student scan) ───
  const markAttendance = useCallback((sessionId, studentId) => {
    const hash = generateBlockchainHash();
    setActiveSessions(prev => prev.map(s => {
      if (s.id === sessionId && !s.presentStudents.find(p => p.studentId === studentId)) {
        const updatedPresent = [...s.presentStudents, {
          studentId,
          markedAt: new Date().toISOString(),
          hash,
        }];

        supabase.from('active_sessions').update({
          present_students: updatedPresent
        }).eq('id', sessionId).then(({ error }) => {
          if (error) console.error("Error updating active session present students:", error.message);
        });

        return {
          ...s,
          presentStudents: updatedPresent,
        };
      }
      return s;
    }));

    // Post to Python API
    fetch(`${API_BASE}/api/sessions/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, studentId })
    }).catch(e => console.error("Python markAttendance error:", e));

    // Update student's attendance records
    setAttendanceRecords(prev => {
      const session = activeSessions.find(s => s.id === sessionId);
      if (!session) return prev;
      const subId = session.subjectId;
      const studentAtt = prev[studentId] || {};
      const subAtt = studentAtt[subId] || { records: [], totalClasses: 0, presentCount: 0, absentCount: 0, percentage: 0 };
      const newRecord = {
        id: `att-${studentId}-${subId}-${Date.now()}`,
        date: new Date().toISOString(),
        status: 'Present',
        hash,
        verified: true,
      };
      const newRecords = [...subAtt.records, newRecord];
      const present = newRecords.filter(r => r.status === 'Present').length;
      
      const studentObj = students.find(s => s.id === studentId);
      const subjectObj = subjects.find(s => s.id === subId);
      if (studentObj && subjectObj) {
        const now = new Date();
        supabase.from('attendance_records').insert([{
          student_name: studentObj.name,
          usn: studentObj.usn,
          subject: subjectObj.code,
          date: now.toISOString().split('T')[0],
          time: now.toTimeString().split(' ')[0],
          status: 'Present',
          blockchain_hash: hash,
          location_lat: session.teacherLat || 0,
          location_lng: session.teacherLng || 0,
          verified: true
        }]).then(({ error }) => {
          if (error) console.error("Error inserting to Supabase:", error);
        });
      }

      return {
        ...prev,
        [studentId]: {
          ...studentAtt,
          [subId]: {
            records: newRecords,
            totalClasses: newRecords.length,
            presentCount: present,
            absentCount: newRecords.length - present,
            percentage: Math.round((present / newRecords.length) * 100),
          },
        },
      };
    });

    return hash;
  }, [activeSessions, students, subjects]);

  // ─── Student: Mark own attendance ───
  const studentMarkAttendance = useCallback((studentId, subjectId) => {
    const hash = generateBlockchainHash();
    
    // Post to Python API
    fetch(`${API_BASE}/api/students/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, subjectId, lat: 0, lng: 0 })
    }).catch(e => console.error("Python studentCheckIn error:", e));

    setAttendanceRecords(prev => {
      const studentAtt = prev[studentId] || {};
      const subAtt = studentAtt[subjectId] || { records: [], totalClasses: 0, presentCount: 0, absentCount: 0, percentage: 0 };
      const newRecord = {
        id: `att-${studentId}-${subjectId}-${Date.now()}`,
        date: new Date().toISOString(),
        status: 'Present',
        hash,
        verified: true,
      };
      const newRecords = [...subAtt.records, newRecord];
      const present = newRecords.filter(r => r.status === 'Present').length;

      const studentObj = students.find(s => s.id === studentId);
      const subjectObj = subjects.find(s => s.id === subjectId);
      if (studentObj && subjectObj) {
        const now = new Date();
        supabase.from('attendance_records').insert([{
          student_name: studentObj.name,
          usn: studentObj.usn,
          subject: subjectObj.code,
          date: now.toISOString().split('T')[0],
          time: now.toTimeString().split(' ')[0],
          status: 'Present',
          blockchain_hash: hash,
          location_lat: 0,
          location_lng: 0,
          verified: true
        }]).then(({ error }) => {
          if (error) console.error("Error inserting student check-in:", error);
        });
      }

      const activeSess = activeSessions.find(s => s.subjectId === subjectId && s.sectionId === studentObj?.sectionId);
      if (activeSess) {
        const updatedPresent = [...activeSess.presentStudents, {
          studentId,
          markedAt: new Date().toISOString(),
          hash,
        }];
        supabase.from('active_sessions').update({
          present_students: updatedPresent
        }).eq('id', activeSess.id).then(({ error }) => {
          if (error) console.error("Error updating active session present students via student check-in:", error.message);
        });

        setActiveSessions(prev => prev.map(s => {
          if (s.id === activeSess.id) {
            return { ...s, presentStudents: updatedPresent };
          }
          return s;
        }));
      }

      return {
        ...prev,
        [studentId]: {
          ...studentAtt,
          [subjectId]: {
            records: newRecords,
            totalClasses: newRecords.length,
            presentCount: present,
            absentCount: newRecords.length - present,
            percentage: Math.round((present / newRecords.length) * 100),
          },
        },
      };
    });
    return hash;
  }, [students, subjects, activeSessions]);

  // ─── Teacher: Mark NC (Not Coming / absent with reason) ───
  const markNC = useCallback((teacherId, studentId, subjectId, reason, customDate) => {
    const targetDate = customDate ? new Date(customDate) : new Date();
    const newId = `nc-${Date.now()}`;
    const record = {
      id: newId,
      teacherId,
      studentId,
      subjectId,
      reason,
      date: targetDate.toISOString(),
      hash: generateBlockchainHash(),
    };
    setNcRecords(prev => [...prev, record]);

    // Send to Python API
    fetch(`${API_BASE}/api/nc-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherId,
        studentId,
        subjectId,
        reason,
        date: record.date
      })
    }).catch(e => console.error("Python markNC error:", e));

    supabase.from('nc_records').insert([{
      id: newId,
      teacher_id: teacherId,
      student_id: studentId,
      subject_id: subjectId,
      reason,
      date: record.date,
      hash: record.hash
    }]).then(({ error }) => {
      if (error) console.error("Error inserting NC record:", error.message);
    });

    // Mark as absent/NC in attendance
    setAttendanceRecords(prev => {
      const studentAtt = prev[studentId] || {};
      const subAtt = studentAtt[subjectId] || { records: [], totalClasses: 0, presentCount: 0, absentCount: 0, percentage: 0 };
      
      let newRecords;
      if (customDate) {
        const matchString = new Date(customDate).toDateString();
        const exists = subAtt.records.some(r => new Date(r.date).toDateString() === matchString);
        if (exists) {
          newRecords = subAtt.records.map(r => {
            if (new Date(r.date).toDateString() === matchString) {
              return {
                ...r,
                status: 'NC',
                reason,
                hash: record.hash,
                verified: true,
              };
            }
            return r;
          });
        } else {
          newRecords = [...subAtt.records, {
            id: `att-${studentId}-${subjectId}-${Date.now()}`,
            date: targetDate.toISOString(),
            status: 'NC',
            reason,
            hash: record.hash,
            verified: true,
          }];
        }
      } else {
        newRecords = [...subAtt.records, {
          id: `att-${studentId}-${subjectId}-${Date.now()}`,
          date: targetDate.toISOString(),
          status: 'NC',
          reason,
          hash: record.hash,
          verified: true,
        }];
      }

      const present = newRecords.filter(r => r.status === 'Present').length;

      const studentObj = students.find(s => s.id === studentId);
      const subjectObj = subjects.find(s => s.id === subjectId);
      if (studentObj && subjectObj) {
        supabase.from('attendance_records').insert([{
          student_name: studentObj.name,
          usn: studentObj.usn,
          subject: subjectObj.code,
          date: targetDate.toISOString().split('T')[0],
          time: targetDate.toTimeString().split(' ')[0],
          status: 'NC',
          blockchain_hash: record.hash,
          location_lat: 0,
          location_lng: 0,
          verified: true
        }]).then(({ error }) => {
          if (error) console.error("Error inserting NC excuse:", error);
        });
      }

      return {
        ...prev,
        [studentId]: {
          ...studentAtt,
          [subjectId]: {
            records: newRecords,
            totalClasses: newRecords.length,
            presentCount: present,
            absentCount: newRecords.length - present,
            percentage: Math.round((present / newRecords.length) * 100),
          },
        },
      };
    });

    return record;
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
    addStudent, deleteStudent,
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
