import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { shortenHash, formatDate, formatTime, getCurrentPosition } from '../utils';
import { QRCodeSVG } from 'qrcode.react';
import { SummitLogo } from '../components/SummitLogo';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const {
    currentUser,
    subjects,
    sections,
    students,
    activeSessions,
    ncRecords,
    startSession,
    endSession,
    markNC,
    attendanceRecords,
  } = useApp();

  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [sessionDuration, setSessionDuration] = useState('5'); // 1, 2, 5, 10, 15 minutes
  const [currentSession, setCurrentSession] = useState(null);
  const [showBlockchainModal, setShowBlockchainModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showNcModal, setShowNcModal] = useState(false);
  const [selectedAbsentStudent, setSelectedAbsentStudent] = useState(null);
  const [ncReason, setNcReason] = useState('');

  // GPS & Projector states
  const [teacherLocation, setTeacherLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [showProjector, setShowProjector] = useState(false);
  const projectorRef = useRef(null);

  // New states for date-wise attendance history
  const [activeTab, setActiveTab] = useState('live'); // 'live' or 'history'
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);
  const [showHistoryNcModal, setShowHistoryNcModal] = useState(false);
  const [selectedHistoryAbsentStudent, setSelectedHistoryAbsentStudent] = useState(null);
  const [historyNcReason, setHistoryNcReason] = useState('');

  // Reset selected history date if subject or section changes
  useEffect(() => {
    setSelectedHistoryDate(null);
  }, [selectedSubjectId, selectedSectionId]);

  // Countdown timer reference
  const countdownIntervalRef = useRef(null);

  // Protect route
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'teacher') {
      navigate('/');
    }
  }, [currentUser, navigate]);

  // Set default subject and section
  useEffect(() => {
    if (currentUser && currentUser.role === 'teacher') {
      if (currentUser.assignedSubjects?.length > 0) {
        setSelectedSubjectId(currentUser.assignedSubjects[0]);
      }
      if (currentUser.assignedSections?.length > 0) {
        setSelectedSectionId(currentUser.assignedSections[0]);
      }
    }
  }, [currentUser]);

  // Handle Session countdown timer
  useEffect(() => {
    if (timeLeft > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            // End active session in context
            if (currentSession) {
              endSession(currentSession.id);
              setCurrentSession(null);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [timeLeft, currentSession, endSession]);



  if (!currentUser || currentUser.role !== 'teacher') return null;

  // Filter teacher's assigned subjects & sections
  const teacherSubjects = subjects.filter(s => currentUser.assignedSubjects?.includes(s.id));
  const teacherSections = sections.filter(s => currentUser.assignedSections?.includes(s.id));

  const handleStartSession = async () => {
    if (!selectedSubjectId || !selectedSectionId) return;

    setFetchingLocation(true);
    setLocationError('');
    setTeacherLocation(null);
    try {
      const loc = await getCurrentPosition();
      setTeacherLocation(loc);

      const duration = parseInt(sessionDuration, 10);
      const session = startSession(currentUser.id, selectedSubjectId, selectedSectionId, duration, loc.lat, loc.lng);
      setCurrentSession(session);
      setTimeLeft(duration * 60);
    } catch (err) {
      console.error(err);
      setLocationError('Please enable location access to use attendance system');
    } finally {
      setFetchingLocation(false);
    }
  };

  const handleEndSession = () => {
    if (currentSession) {
      endSession(currentSession.id);
      setCurrentSession(null);
      setTimeLeft(0);
      setTeacherLocation(null);
    }
  };

  const toggleProjector = () => {
    if (!showProjector) {
      setShowProjector(true);
      setTimeout(() => {
        if (projectorRef.current?.requestFullscreen) {
          projectorRef.current.requestFullscreen().catch(() => {});
        }
      }, 100);
    } else {
      setShowProjector(false);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Listen for fullscreen exit
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && showProjector) {
        setShowProjector(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [showProjector]);

  // Find students in current selected section
  const activeSectionStudents = students.filter(s => s.sectionId === selectedSectionId);

  // Retrieve attendance lists
  const activeSectionRecords = activeSessions.find(s => s.id === currentSession?.id)?.presentStudents || [];
  const presentStudentIds = activeSectionRecords.map(p => p.studentId);

  // Find present/absent students list
  const presentStudentsDetails = activeSectionStudents.map(student => {
    const markInfo = activeSectionRecords.find(r => r.studentId === student.id);
    const studentHistory = attendanceRecords[student.id]?.[selectedSubjectId]?.records || [];
    const isNC = studentHistory.some(r => r.status === 'NC' && new Date(r.date).toDateString() === new Date().toDateString());

    return {
      ...student,
      marked: presentStudentIds.includes(student.id),
      markedAt: markInfo ? markInfo.markedAt : null,
      hash: markInfo ? markInfo.hash : null,
      isNC: isNC,
      ncReason: isNC ? studentHistory.find(r => r.status === 'NC')?.reason : null,
    };
  });

  const presentCount = presentStudentsDetails.filter(s => s.marked).length;
  const ncCount = presentStudentsDetails.filter(s => s.isNC).length;
  const absentStudents = presentStudentsDetails.filter(s => !s.marked && !s.isNC);
  const absentCount = absentStudents.length;

  const totalStudents = activeSectionStudents.length;
  const presentPercentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  // Handle Excusing absent student (NC marking)
  const openNcModal = (student) => {
    setSelectedAbsentStudent(student);
    setNcReason('');
    setShowNcModal(true);
  };

  const submitNC = (e) => {
    e.preventDefault();
    if (!ncReason.trim() || !selectedAbsentStudent) return;

    markNC(currentUser.id, selectedAbsentStudent.id, selectedSubjectId, ncReason.trim());
    setShowNcModal(false);
    setSelectedAbsentStudent(null);
    setNcReason('');
  };

  // ─── Attendance History Logic ───
  // Aggregate all unique dates where attendance has been recorded for this section & subject
  const uniqueHistoryDates = [];
  const seenDates = new Set();

  activeSectionStudents.forEach(student => {
    const records = attendanceRecords[student.id]?.[selectedSubjectId]?.records || [];
    records.forEach(r => {
      const dStr = new Date(r.date).toDateString();
      if (!seenDates.has(dStr)) {
        seenDates.add(dStr);
        uniqueHistoryDates.push({
          dateString: dStr,
          timestamp: new Date(r.date).getTime()
        });
      }
    });
  });

  // Sort chronological descending
  uniqueHistoryDates.sort((a, b) => b.timestamp - a.timestamp);

  // Auto-select newest history date when history tab is clicked
  useEffect(() => {
    if (activeTab === 'history' && !selectedHistoryDate && uniqueHistoryDates.length > 0) {
      setSelectedHistoryDate(uniqueHistoryDates[0].dateString);
    }
  }, [activeTab, selectedHistoryDate, uniqueHistoryDates]);

  // Compute roster status and details for selected historical date
  const historyStudentsDetails = activeSectionStudents.map(student => {
    const studentHistory = attendanceRecords[student.id]?.[selectedSubjectId]?.records || [];
    const record = studentHistory.find(r => new Date(r.date).toDateString() === selectedHistoryDate);

    return {
      ...student,
      status: record?.status || 'Absent',
      marked: record?.status === 'Present',
      isNC: record?.status === 'NC',
      ncReason: record?.reason || null,
      markedAt: record?.date || null,
      hash: record?.hash || null,
    };
  });

  const historyPresentCount = historyStudentsDetails.filter(s => s.marked).length;
  const historyNcCount = historyStudentsDetails.filter(s => s.isNC).length;
  const historyAbsentCount = historyStudentsDetails.filter(s => s.status === 'Absent').length;
  const historyPercentage = totalStudents > 0 ? Math.round((historyPresentCount / totalStudents) * 100) : 0;

  // Handle Excusing absent student from history (retroactive NC marking)
  const openHistoryNcModal = (student) => {
    setSelectedHistoryAbsentStudent(student);
    setHistoryNcReason('');
    setShowHistoryNcModal(true);
  };

  const submitHistoryNC = (e) => {
    e.preventDefault();
    if (!historyNcReason.trim() || !selectedHistoryAbsentStudent || !selectedHistoryDate) return;

    markNC(
      currentUser.id,
      selectedHistoryAbsentStudent.id,
      selectedSubjectId,
      historyNcReason.trim(),
      selectedHistoryDate // Custom retroactive date
    );
    setShowHistoryNcModal(false);
    setSelectedHistoryAbsentStudent(null);
    setHistoryNcReason('');
  };

  // Convert seconds to readable mm:ss format
  const formatTimeLeft = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Blockchain tx view
  const ledgerTransactions = [
    { block: 104521, timestamp: new Date(Date.now() - 60000).toISOString(), method: 'startSession()', hash: currentSession?.hash || '0x3a9f8f2b7d4e6c1a8b9f0e1d2c3b4a5f6e7d8c9b' },
    ...activeSectionRecords.map((r, i) => ({
      block: 104521 + i + 1,
      timestamp: r.markedAt,
      method: 'markAttendance()',
      hash: r.hash,
    })),
    ...ncRecords.map((r, i) => ({
      block: 104535 + i,
      timestamp: r.date,
      method: 'markExcusedAbsence()',
      hash: r.hash,
    })),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-16">
      {/* ── Top Navbar ── */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <SummitLogo className="w-10 h-10" />
              <div className="leading-none">
                <span className="text-lg font-black tracking-wide bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">SummitAttend</span>
                <p className="text-[8px] uppercase font-bold tracking-widest text-slate-400">Faculty Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-slate-500">Faculty Portal</p>
                <p className="text-sm font-bold text-slate-800">{currentUser.name}</p>
              </div>
              <button
                onClick={navigate.bind(null, '/')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-xs font-semibold rounded-lg bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Dashboard Content ── */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-6 flex-1 space-y-6">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 font-heading">Faculty Panel</h1>
            <p className="text-sm text-slate-500 mt-0.5">Control live classrooms, generate QR codes with custom timers, and excuse absences on-chain.</p>
          </div>
          <button
            onClick={() => setShowBlockchainModal(true)}
            className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2 border border-blue-200 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            ⛓️ View Ledger Transactions
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border border-slate-200 bg-white p-1 rounded-xl max-w-md shadow-sm">
          <button
            onClick={() => setActiveTab('live')}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'live'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🔴 Live Session Control
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📅 Attendance History Ledger
          </button>
        </div>

        {activeTab === 'live' ? (
          /* ── Live Session Panel Grid ── */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
            {/* Column 1: QR & Setup Operations */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6 flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800 mb-4">Lecture QR Setup</h2>

                {/* QR Settings Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Subject</label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => {
                        setSelectedSubjectId(e.target.value);
                        handleEndSession();
                      }}
                      disabled={!!currentSession}
                      className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-slate-950 focus:border-blue-500 focus:ring-blue-500 focus:outline-none text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      {teacherSubjects.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Section</label>
                    <select
                      value={selectedSectionId}
                      onChange={(e) => {
                        setSelectedSectionId(e.target.value);
                        handleEndSession();
                      }}
                      disabled={!!currentSession}
                      className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-slate-955 focus:border-blue-500 focus:ring-blue-500 focus:outline-none text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      {teacherSections.map(sec => {
                        const yearString = sec.year === 1 ? '1st Year' : sec.year === 2 ? '2nd Year' : sec.year === 3 ? '3rd Year' : '4th Year';
                        return (
                          <option key={sec.id} value={sec.id}>{yearString} - {sec.name}</option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Set Custom Session Timer</label>
                    <select
                      value={sessionDuration}
                      onChange={(e) => setSessionDuration(e.target.value)}
                      disabled={!!currentSession}
                      className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-slate-900 focus:border-blue-500 focus:ring-blue-500 focus:outline-none text-sm disabled:bg-slate-50"
                    >
                      <option value="2">2 Minutes</option>
                      <option value="5">5 Minutes</option>
                      <option value="10">10 Minutes</option>
                      <option value="15">15 Minutes</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* QR Generation Area */}
              <div className="pt-6 border-t border-slate-100 flex flex-col items-center w-full">
                {locationError && (
                  <div className="w-full mb-4 flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-700 font-semibold leading-relaxed">
                    <span className="text-sm">⚠️</span>
                    <p>{locationError}</p>
                  </div>
                )}

                {!currentSession ? (
                  fetchingLocation ? (
                    <button
                      disabled
                      className="w-full py-3 bg-slate-100 border border-slate-200 text-slate-400 font-extrabold text-sm rounded-xl flex items-center justify-center gap-2"
                    >
                      <svg className="animate-spin h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Detecting GPS Location...
                    </button>
                  ) : (
                    <button
                      onClick={handleStartSession}
                      className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      ⚡ Start Session & Generate QR
                    </button>
                  )
                ) : (
                  <div className="w-full text-center space-y-4">
                    <div className="bg-slate-950 p-4 rounded-3xl inline-block border-4 border-white shadow-lg">
                      <QRCodeSVG
                        value={JSON.stringify({
                          session: subjects.find(s => s.id === currentSession.subjectId)?.code || 'AI-ML-0524',
                          lat: teacherLocation?.lat || 0,
                          lng: teacherLocation?.lng || 0,
                          radius: 70,
                          sessionId: currentSession.id,
                          subjectId: currentSession.subjectId,
                          sectionId: currentSession.sectionId,
                          timestamp: currentSession.startedAt,
                        })}
                        size={180}
                        level="H"
                        bgColor="#ffffff"
                        fgColor="#0f172a"
                      />
                    </div>

                    {teacherLocation && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1 w-full text-left">
                        <p className="font-bold text-slate-700 flex items-center gap-1.5">
                          📍 Location Captured
                        </p>
                        <div className="font-mono text-[10px] text-slate-500 grid grid-cols-2 gap-1 mt-1">
                          <div>Lat: {teacherLocation.lat.toFixed(6)}</div>
                          <div>Lng: {teacherLocation.lng.toFixed(6)}</div>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1">Classroom boundary: 70m radius</p>
                      </div>
                    )}

                    <div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Class Session Active
                      </span>
                      <p className="text-2xl font-black text-slate-800 mt-2 font-mono">{formatTimeLeft(timeLeft)}</p>
                      <p className="text-[10px] text-slate-400 mt-1">Timer counts down to auto-lock session on-chain</p>
                    </div>

                    <button
                      onClick={toggleProjector}
                      className="w-full py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      🖥️ Present on Projector
                    </button>

                    <button
                      onClick={handleEndSession}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                    >
                      ⏹ Force Close Session
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2 & 3: Live Roster & Absent Tracker */}
            <div className="lg:col-span-2 space-y-6">
              {/* Live Lecture Session Statistics */}
              {currentSession && (
                <div className="grid grid-cols-3 gap-4 bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attendance Rate</p>
                    <p className="text-xl font-black text-slate-800 mt-1">{presentPercentage}%</p>
                  </div>
                  <div className="text-center border-x border-slate-100">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Present</p>
                    <p className="text-xl font-black text-emerald-600 mt-1">{presentCount}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Absent / NC</p>
                    <p className="text-xl font-black text-rose-600 mt-1">{absentCount} <span className="text-slate-400 text-xs font-medium">({ncCount} NC)</span></p>
                  </div>
                </div>
              )}

              {/* Roster & NC Administration Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
                  <div>
                    <h3 className="font-extrabold text-slate-800">Classroom Attendance Roster</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Real-time status ledger showing present, absent, and excused students</p>
                  </div>
                  <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-blue-100 uppercase self-start sm:self-auto">
                    Total: {totalStudents} Enrolled
                  </span>
                </div>

                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-6">Student Info</th>
                        <th className="py-3 px-6">USN</th>
                        <th className="py-3 px-6 text-center">Status Score</th>
                        <th className="py-3 px-6 text-right">Excusal Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {presentStudentsDetails.map((student) => (
                        <tr key={student.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="py-3.5 px-6">
                            <div>
                              <p className="font-extrabold text-slate-800">{student.name}</p>
                              <p className="text-[10px] text-slate-400">{student.email}</p>
                            </div>
                          </td>
                          <td className="py-3.5 px-6 font-mono text-xs text-slate-600 font-semibold">{student.usn}</td>
                          <td className="py-3.5 px-6 text-center">
                            {student.marked ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-100">
                                Present
                              </span>
                            ) : student.isNC ? (
                              <span className="inline-flex flex-col items-center">
                                <span className="bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-100">
                                  NC (Excused)
                                </span>
                                {student.ncReason && (
                                  <span className="text-[9px] text-amber-600 font-medium italic mt-1 max-w-[120px] truncate">
                                    "{student.ncReason}"
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-full border border-rose-100">
                                Absent
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-6 text-right">
                            {!student.marked && !student.isNC ? (
                              <button
                                onClick={() => openNcModal(student)}
                                className="px-3 py-1 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                Excuse Absence (NC)
                              </button>
                            ) : student.hash ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-[10px] text-slate-400 font-mono" title={student.hash}>
                                  Tx: {shortenHash(student.hash)}
                                </span>
                                <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full uppercase leading-none">
                                  Verified on Blockchain ✅
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── Historical Sessions Tab View ── */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
            {/* Sidebar list of dates */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col space-y-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800">Recorded Dates</h2>
                <p className="text-xs text-slate-400 mt-0.5">Select a historical lecture date to inspect roster statuses</p>
              </div>

              {uniqueHistoryDates.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <span className="text-3xl">📭</span>
                  <p className="text-sm font-bold mt-2">No History Logged</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto">There are no saved lecture sessions for this section and subject yet.</p>
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
                  {uniqueHistoryDates.map(item => (
                    <button
                      key={item.dateString}
                      onClick={() => setSelectedHistoryDate(item.dateString)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1 ${
                        selectedHistoryDate === item.dateString
                          ? 'border-blue-500 bg-blue-50/50 text-blue-700 shadow-sm'
                          : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50/40 text-slate-700'
                      }`}
                    >
                      <span className="text-sm font-bold">{formatDate(item.dateString)}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{item.dateString}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Roster & Stats detail pane */}
            <div className="lg:col-span-2 space-y-6">
              {selectedHistoryDate ? (
                <>
                  {/* Historical Lecture Session Statistics */}
                  <div className="grid grid-cols-3 gap-4 bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attendance Rate</p>
                      <p className="text-xl font-black text-slate-800 mt-1">{historyPercentage}%</p>
                    </div>
                    <div className="text-center border-x border-slate-100">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Present</p>
                      <p className="text-xl font-black text-emerald-600 mt-1">{historyPresentCount}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Absent / NC</p>
                      <p className="text-xl font-black text-rose-600 mt-1">{historyAbsentCount} <span className="text-slate-400 text-xs font-medium">({historyNcCount} NC)</span></p>
                    </div>
                  </div>

                  {/* Historical Roster Table */}
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
                      <div>
                        <h3 className="font-extrabold text-slate-800">Roster Ledger: {formatDate(selectedHistoryDate)}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Historical verification ledger of student status on this date</p>
                      </div>
                      <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-blue-100 uppercase self-start sm:self-auto">
                        Total Enrolled: {totalStudents}
                      </span>
                    </div>

                    <div className="overflow-x-auto flex-1">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            <th className="py-3 px-6">Student Info</th>
                            <th className="py-3 px-6">USN</th>
                            <th className="py-3 px-6 text-center">Status</th>
                            <th className="py-3 px-6 text-right">Excusal Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {historyStudentsDetails.map((student) => (
                            <tr key={student.id} className="hover:bg-slate-50/40 transition-colors">
                              <td className="py-3.5 px-6">
                                <div>
                                  <p className="font-extrabold text-slate-800">{student.name}</p>
                                  <p className="text-[10px] text-slate-400">{student.email}</p>
                                </div>
                              </td>
                              <td className="py-3.5 px-6 font-mono text-xs text-slate-600 font-semibold">{student.usn}</td>
                              <td className="py-3.5 px-6 text-center">
                                {student.status === 'Present' ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-100">
                                    Present
                                  </span>
                                ) : student.status === 'NC' ? (
                                  <span className="inline-flex flex-col items-center">
                                    <span className="bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-100">
                                      NC (Excused)
                                    </span>
                                    {student.ncReason && (
                                      <span className="text-[9px] text-amber-600 font-medium italic mt-1 max-w-[120px] truncate">
                                        "{student.ncReason}"
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-full border border-rose-100">
                                    Absent
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-6 text-right">
                                {student.status === 'Absent' ? (
                                  <button
                                    onClick={() => openHistoryNcModal(student)}
                                    className="px-3 py-1 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                  >
                                    Excuse Absence (NC)
                                  </button>
                                ) : student.hash ? (
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className="text-[10px] text-slate-400 font-mono" title={student.hash}>
                                      Tx: {shortenHash(student.hash)}
                                    </span>
                                    <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full uppercase leading-none">
                                      Verified on Blockchain ✅
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400">N/A</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center text-slate-400 flex flex-col items-center justify-center min-h-[300px]">
                  <span className="text-4xl">📅</span>
                  <p className="text-sm font-bold mt-3">Select Date from Timeline</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-[250px]">Choose a historical lecture date from the timeline list to review student rosters.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: Enter NC Excuse details ── */}
      {showNcModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200/50 flex flex-col p-6 relative">
            <button
              onClick={() => setShowNcModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <h3 className="font-extrabold text-slate-900 text-lg mt-2">Excused Absence (NC) Registration</h3>
            <p className="text-xs text-slate-500 mt-1">
              Marking <span className="font-bold text-slate-800">{selectedAbsentStudent?.name} ({selectedAbsentStudent?.usn})</span> as NC. This excuse will generate a verified blockchain entry.
            </p>

            <form onSubmit={submitNC} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reason for Absence</label>
                <textarea
                  required
                  rows="3"
                  placeholder="e.g. Medical emergency certificate submitted, Sports representative team meeting, College placement drive interview..."
                  value={ncReason}
                  onChange={(e) => setNcReason(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-950 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 focus:outline-none text-sm"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNcModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  Confirm NC on Blockchain
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Enter NC History Excuse details ── */}
      {showHistoryNcModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200/50 flex flex-col p-6 relative">
            <button
              onClick={() => setShowHistoryNcModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <h3 className="font-extrabold text-slate-900 text-lg mt-2">Retroactive Excused Absence (NC)</h3>
            <p className="text-xs text-slate-500 mt-1">
              Marking <span className="font-bold text-slate-800">{selectedHistoryAbsentStudent?.name} ({selectedHistoryAbsentStudent?.usn})</span> as NC for the lecture on <span className="font-bold text-blue-600">{formatDate(selectedHistoryDate)}</span>. This excuse will generate a verified blockchain entry.
            </p>

            <form onSubmit={submitHistoryNC} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reason for Absence</label>
                <textarea
                  required
                  rows="3"
                  placeholder="e.g. Medical emergency certificate submitted, Sports representative team meeting, College placement drive interview..."
                  value={historyNcReason}
                  onChange={(e) => setHistoryNcReason(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-slate-955 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 focus:outline-none text-sm"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowHistoryNcModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  Confirm NC on Blockchain
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Blockchain Records ── */}
      {showBlockchainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200/50 flex flex-col p-6 relative max-h-[85vh]">
            <button
              onClick={() => setShowBlockchainModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <h3 className="font-extrabold text-slate-900 text-lg mt-2 flex items-center gap-2">
              ⛓️ Verified Blockchain Ledger Explorer
            </h3>
            <p className="text-xs text-slate-500 mt-1">Showing smart contract calls and transaction hashes executed on the local Ganache provider.</p>

            <div className="overflow-y-auto mt-4 pr-1 space-y-3 flex-1">
              {ledgerTransactions.length === 0 ? (
                <p className="text-center py-8 text-slate-400 font-semibold">No transactions deployed in this session.</p>
              ) : (
                ledgerTransactions.map((tx, idx) => (
                  <div key={idx} className="p-3.5 border border-slate-100 rounded-2xl bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono bg-blue-50 text-blue-700 border border-blue-100 rounded px-1 text-[10px] font-black uppercase">
                          {tx.method}
                        </span>
                        <span className="text-[10px] text-slate-400">Block: #{tx.block}</span>
                      </div>
                      <p className="font-mono text-slate-600 mt-1 text-[10px] break-all select-all">{tx.hash}</p>
                    </div>
                    <div className="text-right sm:flex-shrink-0">
                      <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold text-[9px] uppercase border border-emerald-100">
                        Confirmed ✓
                      </span>
                      <p className="text-[9px] text-slate-400 mt-1">{new Date(tx.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowBlockchainModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Close Explorer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Projector Fullscreen Overlay ── */}
      {showProjector && currentSession && (
        <div
          ref={projectorRef}
          className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-8 overflow-y-auto select-none"
          onClick={(e) => { if (e.target === e.currentTarget) toggleProjector(); }}
        >
          <div className="text-center max-w-xl w-full flex flex-col items-center justify-center space-y-8 animate-fadeIn">
            {/* Header: Summit University Title & Session details */}
            <div className="space-y-2">
              <span className="text-[11px] font-black tracking-[0.3em] uppercase text-indigo-500 bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100">
                Summit University — Active Attendance
              </span>
              <h2 className="text-4xl font-black text-slate-900 pt-3">
                {subjects.find(s => s.id === currentSession.subjectId)?.name || 'Lecture Session'}
              </h2>
              <p className="text-base text-slate-500 font-semibold">
                Section: {sections.find(s => s.id === currentSession.sectionId)?.name || 'N/A'} • Subject Code: {subjects.find(s => s.id === currentSession.subjectId)?.code || 'N/A'}
              </p>
            </div>

            {/* Massive QR Code Area */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-2xl inline-block transform hover:scale-[1.01] transition-transform">
              <QRCodeSVG
                value={JSON.stringify({
                  session: subjects.find(s => s.id === currentSession.subjectId)?.code || 'AI-ML-0524',
                  lat: teacherLocation?.lat || 0,
                  lng: teacherLocation?.lng || 0,
                  radius: 70,
                  sessionId: currentSession.id,
                  subjectId: currentSession.subjectId,
                  sectionId: currentSession.sectionId,
                  timestamp: currentSession.startedAt,
                })}
                size={320}
                level="H"
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
            </div>

            {/* Countdown & GPS details */}
            <div className="space-y-4">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Time Remaining</span>
                <p className="text-3xl font-black text-slate-800 font-mono mt-1">{formatTimeLeft(timeLeft)}</p>
              </div>

              {teacherLocation && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-500 font-mono">
                  📍 Coords: {teacherLocation.lat.toFixed(6)}, {teacherLocation.lng.toFixed(6)} | Radius: 70m
                </div>
              )}

              <div>
                <button
                  onClick={toggleProjector}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Exit Presentation
                </button>
              </div>
            </div>
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
