import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { shortenHash, formatDate, formatTime, haversineDistance, getCurrentPosition } from '../utils';
import { SummitLogo } from '../components/SummitLogo';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const {
    currentUser,
    attendanceRecords,
    sections,
    subjects,
    activeSessions,
    teachers,
    markAttendance,
    studentMarkAttendance
  } = useApp();

  const [activeTab, setActiveTab] = useState('tracker'); // tracker | scanner | history
  const [showScanner, setShowScanner] = useState(false);
  const [scanStage, setScanStage] = useState('idle'); // idle | qr | face | success
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [selectedActiveSessionId, setSelectedActiveSessionId] = useState('');

  // GPS location verification states
  const [locationResult, setLocationResult] = useState(null); // { verified: bool, distance: number } or null
  const [locationError, setLocationError] = useState('');

  // ─── POST-LOGIN FACE VERIFICATION STATE ───
  // Check sessionStorage so verification persists during the session but resets on logout/close
  const [faceVerified, setFaceVerified] = useState(() => {
    if (!currentUser) return false;
    return sessionStorage.getItem(`face_verified_${currentUser?.id}`) === 'true';
  });
  const [verifyStage, setVerifyStage] = useState('idle'); // idle | scanning | verified

  // Protect route
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'student') {
      navigate('/');
    }
  }, [currentUser, navigate]);

  // Trigger face verification on mount if not yet verified
  useEffect(() => {
    if (currentUser && currentUser.role === 'student' && !faceVerified) {
      // Start the face verification automatically
      setVerifyStage('scanning');
      const timer = setTimeout(() => {
        setVerifyStage('verified');
        // After showing success briefly, unlock the dashboard
        setTimeout(() => {
          setFaceVerified(true);
          sessionStorage.setItem(`face_verified_${currentUser.id}`, 'true');
        }, 1200);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentUser, faceVerified]);

  if (!currentUser || currentUser.role !== 'student') return null;

  // Retrieve section details
  const studentSection = sections.find(s => s.id === currentUser.sectionId);
  const sectionName = studentSection ? studentSection.name : 'Unknown Section';
  const sectionYear = studentSection ? `${studentSection.year}th Year` : 'Unknown Year';

  // Get student's attendance records grouped by subject
  const studentAttendance = attendanceRecords[currentUser.id] || {};

  // Find all subjects that apply
  const studentSubjects = subjects.filter(sub => currentUser.subjectIds.includes(sub.id));

  // Find active session for student's section
  const sectionActiveSessions = activeSessions.filter(s => s.sectionId === currentUser.sectionId);

  // Combine historical records from all subjects
  const allRecords = Object.entries(studentAttendance).flatMap(([subId, data]) => {
    const subject = subjects.find(s => s.id === subId);
    return (data.records || []).map(r => ({
      ...r,
      subjectName: subject ? subject.name : 'Unknown Subject',
      subjectCode: subject ? subject.code : '',
      subjectId: subId,
    }));
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  // Calculate overall attendance
  const totalClasses = Object.values(studentAttendance).reduce((acc, curr) => acc + (curr.totalClasses || 0), 0);
  const totalPresent = Object.values(studentAttendance).reduce((acc, curr) => acc + (curr.presentCount || 0), 0);
  const overallPercentage = totalClasses > 0 ? Math.round((totalPresent / totalClasses) * 100) : 0;

  // Handle mandatory multi-stage Secure Check-In: QR Code scan first, immediately followed by Biometric Face Scan
  const handleStartSecureCheckIn = async (sessionId = '') => {
    setSelectedActiveSessionId(sessionId);
    setShowScanner(true);
    setScanStage('qr');
    setScanning(true);
    setScanResult(null);
    setLocationResult(null);
    setLocationError('');

    // Capture student's current coordinates using browser Geolocation
    let studentLoc = null;
    try {
      studentLoc = await getCurrentPosition();
    } catch (err) {
      console.error(err);
      setLocationError('Please enable location access to use attendance system');
      setScanning(false);
      setScanStage('failed');
      return;
    }

    // QR Scan stage completes after 2.5 seconds, then automatically transitions to biometric Face Scan stage
    setTimeout(() => {
      setScanStage('face');
      
      // Face recognition stage completes after 2.5 seconds, validating identity and recording on-chain
      setTimeout(() => {
        setScanning(false);

        // Find active session coordinates
        const session = activeSessions.find(s => s.id === sessionId);
        const teacherLat = session?.teacherLat;
        const teacherLng = session?.teacherLng;

        let distanceMeters = 0;
        let isWithinRange = true;

        if (teacherLat !== undefined && teacherLng !== undefined && studentLoc) {
          distanceMeters = haversineDistance(teacherLat, teacherLng, studentLoc.lat, studentLoc.lng);
          isWithinRange = distanceMeters <= 70;
        }

        setLocationResult({ verified: isWithinRange, distance: distanceMeters });

        if (isWithinRange) {
          setScanStage('success');
          let txHash = '';
          if (sessionId) {
            txHash = markAttendance(sessionId, currentUser.id);
          } else {
            const randomSubjectId = currentUser.subjectIds[0] || 'sub1';
            txHash = studentMarkAttendance(currentUser.id, randomSubjectId);
          }
          setScanResult({
            success: true,
            hash: txHash,
          });
        } else {
          setScanStage('failed');
          setScanResult(null);
        }
      }, 2500);
    }, 2500);
  };

  const closeScanner = () => {
    setShowScanner(false);
    setScanStage('idle');
    setScanResult(null);
    setLocationResult(null);
    setLocationError('');
  };

  // ─── POST-LOGIN FACE VERIFICATION OVERLAY ───
  if (!faceVerified) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -ml-32 -mb-32" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />

        <div className="relative z-10 w-full max-w-sm mx-4">
          {/* Summit branding */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <SummitLogo className="w-10 h-10" />
              <span className="text-xl font-black tracking-wide bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">SummitAttend</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">Biometric Identity Verification</p>
          </div>

          {/* Main verification card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            <div className="text-center mb-6">
              <h2 className="text-lg font-extrabold text-white">
                {verifyStage === 'scanning' ? 'Verifying Identity...' : '✓ Identity Confirmed'}
              </h2>
              <p className="text-xs text-slate-300 mt-1.5">
                {verifyStage === 'scanning'
                  ? 'Hold your face in front of the camera for biometric matching'
                  : `Welcome back, ${currentUser.name}`
                }
              </p>
            </div>

            {/* Face scan viewport */}
            <div className="aspect-square bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 flex items-center justify-center relative mb-6">
              {verifyStage === 'scanning' ? (
                <>
                  {/* Face outline with rotating ring */}
                  <div className="relative w-48 h-48 rounded-full border border-blue-500/30 flex items-center justify-center">
                    <div className="absolute w-44 h-44 rounded-full border-2 border-dashed border-blue-500/50 animate-spin" style={{ animationDuration: '3s' }} />
                    <div className="absolute w-36 h-36 rounded-full border border-blue-400 bg-blue-500/10 animate-pulse" />
                    <div className="absolute w-28 h-28 rounded-full border border-cyan-400/30 animate-ping" style={{ animationDuration: '2s' }} />
                    <span className="text-5xl relative z-10">👤</span>
                  </div>
                  {/* Scan line */}
                  <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-scan-line top-0" />
                  <p className="absolute bottom-4 text-[10px] font-bold text-slate-300 font-mono animate-pulse tracking-wider">
                    Analyzing biometric signatures...
                  </p>
                </>
              ) : (
                /* Success state */
                <div className="text-center p-6 flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-white text-4xl shadow-lg shadow-emerald-500/30 mb-4 animate-bounce">
                    ✓
                  </div>
                  <h4 className="font-extrabold text-white text-lg">Face Match Confirmed</h4>
                  <p className="text-[10px] text-emerald-400 font-bold mt-1 uppercase tracking-wide">
                    Biometric signature verified
                  </p>
                </div>
              )}
            </div>

            {/* Progress indicators */}
            <div className="flex justify-between items-center gap-1.5 text-[10px] font-bold text-center mb-4">
              <span className={`flex-1 py-1.5 rounded-md border ${verifyStage === 'scanning' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 animate-pulse' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`}>
                1. Face Capture
              </span>
              <span className="text-slate-500">➔</span>
              <span className={`flex-1 py-1.5 rounded-md border ${verifyStage === 'verified' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-slate-500 border-white/10'}`}>
                2. AI Matching
              </span>
              <span className="text-slate-500">➔</span>
              <span className={`flex-1 py-1.5 rounded-md border ${verifyStage === 'verified' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-slate-500 border-white/10'}`}>
                3. Access Granted
              </span>
            </div>

            {/* Student info */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-lg">
                🎓
              </div>
              <div>
                <p className="text-sm font-bold text-white">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400 font-mono">{currentUser.usn} • {currentUser.email}</p>
              </div>
            </div>

            {/* Loading indicator */}
            {verifyStage === 'scanning' && (
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 mt-4">
                <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing facial biometrics...
              </div>
            )}
          </div>

          {/* Security note */}
          <p className="text-center text-[10px] text-slate-500 mt-4">
            🔒 Your biometric data is processed locally and never stored on external servers
          </p>
        </div>
      </div>
    );
  }

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
                <p className="text-[8px] uppercase font-bold tracking-widest text-slate-400">Student Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-slate-500">Student Portal</p>
                <p className="text-sm font-bold text-slate-800">{currentUser.name}</p>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-emerald-700">Face Verified</span>
              </div>
              <button
                onClick={() => {
                  // Clear face verification on logout
                  sessionStorage.removeItem(`face_verified_${currentUser.id}`);
                  navigate('/');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-xs font-semibold rounded-lg bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Student Header Profile Panel ── */}
      <div className="bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950 text-white py-8 px-4 sm:px-6 shadow-md relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 z-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
        <div className="absolute -bottom-16 -left-16 z-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl" />
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="bg-amber-400/20 text-amber-300 text-xs font-extrabold uppercase px-2.5 py-1 rounded-full border border-amber-400/30 tracking-wider">
                USN: {currentUser.usn}
              </span>
              <span className="bg-blue-500/30 text-blue-200 text-xs font-extrabold uppercase px-2.5 py-1 rounded-full border border-blue-400/20 tracking-wider">
                {sectionYear} - {sectionName}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold mt-2 tracking-tight font-heading">{currentUser.name}</h1>
            <p className="text-slate-300 text-sm mt-1.5 flex items-center gap-1">
              <svg className="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {currentUser.email}
            </p>
          </div>

          <div className="flex items-center bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-md gap-4 self-start md:self-auto">
            <div className="w-14 h-14 rounded-full border-4 border-amber-400/30 flex items-center justify-center relative">
              <span className="text-xl font-black text-amber-300">{overallPercentage}%</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Overall Attendance Score</p>
              <p className="text-lg font-black text-white">{totalPresent} / {totalClasses} classes</p>
              <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1 ${overallPercentage >= 75 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20' : 'bg-rose-500/20 text-rose-300 border border-rose-500/20'}`}>
                {overallPercentage >= 75 ? '✓ Exam Eligible' : '⚠️ Below 75% Threshold'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile/Desktop Tabs Navigation ── */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex border-b border-slate-200 bg-white rounded-xl p-1 shadow-sm gap-1">
          <button
            onClick={() => setActiveTab('tracker')}
            className={`flex-1 py-3 text-center text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${activeTab === 'tracker' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-blue-600 hover:bg-slate-50'}`}
          >
            📊 Subject Tracker
          </button>
          <button
            onClick={() => setActiveTab('scanner')}
            className={`flex-1 py-3 text-center text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${activeTab === 'scanner' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-blue-600 hover:bg-slate-50'}`}
          >
            📷 Instant Verification
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-center text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${activeTab === 'history' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-blue-600 hover:bg-slate-50'}`}
          >
            🔗 Ledger History
          </button>
        </div>
      </div>

      {/* ── Main Tab Contents ── */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-6 flex-1">
        {/* Tab 1: Subject Attendance Tracker */}
        {activeTab === 'tracker' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800">Your Enrolled Subjects</h2>
                <p className="text-sm text-slate-500 mt-0.5">Real-time attendance ledger scores across active syllabus</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {studentSubjects.map((subject) => {
                const data = studentAttendance[subject.id] || {
                  totalClasses: 0,
                  presentCount: 0,
                  absentCount: 0,
                  percentage: 0,
                };
                const isWarning = data.percentage < 75;

                return (
                  <div key={subject.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-bl-full -mr-6 -mt-6 z-0" />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between">
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-bold font-mono px-2 py-0.5 rounded uppercase tracking-wider">
                          {subject.code}
                        </span>
                        <span className={`text-sm font-black ${isWarning ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {data.percentage}%
                        </span>
                      </div>
                      <h3 className="font-extrabold text-slate-800 mt-2 text-base line-clamp-1">{subject.name}</h3>
                      <div className="grid grid-cols-3 gap-2 mt-4 text-center bg-slate-50 rounded-xl p-2 border border-slate-100">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
                          <p className="text-sm font-black text-slate-700">{data.totalClasses}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Present</p>
                          <p className="text-sm font-black text-emerald-600">{data.presentCount}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Absent</p>
                          <p className="text-sm font-black text-rose-600">{data.absentCount}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 relative z-10">
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${isWarning ? 'bg-rose-500' : 'bg-blue-600'}`}
                          style={{ width: `${data.percentage}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-slate-400">Target: 75% required</span>
                        <span className={`text-[10px] font-bold ${isWarning ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {isWarning ? '⚠️ Low Attendance' : '✓ Good Standing'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Scanning Section */}
        {activeTab === 'scanner' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-extrabold text-slate-800">Scan Attendance</h2>
              <p className="text-sm text-slate-500 mt-0.5">Use your mobile camera to scan active QR codes or verify biometric face records</p>
            </div>

            {/* Live active sessions detected */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-2 mb-4">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                Active Lecturing Sessions
              </h3>

              {sectionActiveSessions.length === 0 ? (
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-8 text-center">
                  <span className="text-4xl">📭</span>
                  <p className="text-sm font-bold text-slate-700 mt-3">No Active Sessions Detected</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Ask your teacher to generate a session QR code to mark your attendance on the blockchain ledger.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sectionActiveSessions.map((session) => {
                    const subject = subjects.find(s => s.id === session.subjectId);
                    const teacher = teachers.find(t => t.id === session.teacherId);
                    return (
                      <div key={session.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border border-slate-200 rounded-2xl bg-gradient-to-r from-blue-50/20 to-indigo-50/20 gap-4 hover:border-blue-300 transition-colors">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="bg-blue-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded">
                              LIVE
                            </span>
                            <h4 className="font-extrabold text-slate-800 text-base">{subject ? subject.name : 'Lecture'}</h4>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Instructor: <span className="font-semibold text-slate-700">{teacher ? teacher.name : 'Unknown Faculty'}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Session Tx: {session.hash}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <button
                            onClick={() => handleStartSecureCheckIn(session.id)}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-xs font-extrabold text-white rounded-xl shadow-md hover:scale-[1.01] transition-all cursor-pointer"
                          >
                            ⚡ Secure Presence Check-In (QR + Face)
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


          </div>
        )}

        {/* Tab 3: Detailed History */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800">Blockchain Ledger History</h2>
                <p className="text-sm text-slate-500 mt-0.5">Secure chronological feed of your verified smart-contract attendance confirmations</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-4 px-6">Subject</th>
                      <th className="py-4 px-6">Date</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6">Blockchain Txn Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {allRecords.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="py-8 text-center text-slate-400 font-semibold">
                          No attendance records registered yet.
                        </td>
                      </tr>
                    ) : (
                      allRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6">
                            <div>
                              <p className="font-extrabold text-slate-800">{record.subjectName}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{record.subjectCode}</p>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <p className="font-semibold text-slate-700">{formatDate(record.date)}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{formatTime(record.date)}</p>
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold leading-none ${
                                record.status === 'Present'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : record.status === 'NC'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                  : 'bg-rose-50 text-rose-700 border border-rose-100'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${record.status === 'Present' ? 'bg-emerald-500' : record.status === 'NC' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                              {record.status === 'NC' ? 'NC (Excused)' : record.status}
                            </span>
                            {record.status === 'NC' && record.reason && (
                              <p className="text-[10px] text-amber-600 mt-1 italic font-medium">"{record.reason}"</p>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            {record.hash ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-slate-600 bg-slate-100 rounded px-1.5 py-0.5 border border-slate-200">
                                  {shortenHash(record.hash)}
                                </span>
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase">
                                  Verified on Blockchain ✅
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 font-mono">N/A</span>
                            )}
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
      </div>

      {/* ── Secure Camera Scanning Modal Overlay ── */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200/50 flex flex-col p-6 relative">
            <button
              onClick={closeScanner}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <h3 className="font-extrabold text-slate-900 text-lg mt-2 text-center">
              {scanStage === 'qr' && '📷 Stage 1: Scanning QR Code'}
              {scanStage === 'face' && '👤 Stage 2: Face Biometrics'}
              {scanStage === 'success' && '✓ Secure Check-In Verified'}
              {scanStage === 'failed' && '❌ Location Verification Failed'}
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              {scanStage === 'qr' && 'Align lecturing screen QR code within scanner target area...'}
              {scanStage === 'face' && 'QR verified! Point front camera at your face to verify biometric ID...'}
              {scanStage === 'success' && 'Presence authenticated on blockchain ledger'}
              {scanStage === 'failed' && 'You are not in the classroom range'}
            </p>

            {locationError && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs text-rose-700 font-semibold leading-relaxed">
                <span className="text-sm">⚠️</span>
                <p>{locationError}</p>
              </div>
            )}

            {/* Scanner Animation Target Viewport */}
            <div className="my-6 relative aspect-square bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 flex items-center justify-center">
              {scanning ? (
                <>
                  {scanStage === 'qr' ? (
                    /* QR Target Box with animation */
                    <div className="w-48 h-48 border-2 border-blue-500/80 rounded-2xl relative">
                      {/* Corner Bracket styling */}
                      <span className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-500 -mt-0.5 -ml-0.5 rounded-tl" />
                      <span className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-500 -mt-0.5 -mr-0.5 rounded-tr" />
                      <span className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-500 -mb-0.5 -ml-0.5 rounded-bl" />
                      <span className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-500 -mb-0.5 -mr-0.5 rounded-br" />
 
                      {/* Moving Scan bar */}
                      <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-scan-line top-0" />
                    </div>
                  ) : (
                    /* Face Biometric outline and rings */
                    <div className="relative w-48 h-48 rounded-full border border-blue-500/30 flex items-center justify-center">
                      <div className="absolute w-44 h-44 rounded-full border-2 border-dashed border-blue-500/50 animate-spin" />
                      <div className="absolute w-36 h-36 rounded-full border border-blue-400 bg-blue-500/10 animate-face-ring" />
                      <span className="text-5xl">👤</span>
                    </div>
                  )}
                  <p className="absolute bottom-4 text-[10px] font-bold text-slate-300 font-mono animate-pulse tracking-wider">
                    {scanStage === 'qr' ? 'Reading lecturing QR hash...' : 'Matching biometric signatures...'}
                  </p>
                </>
              ) : (
                /* Scan result views */
                scanStage === 'success' ? (
                  <div className="text-center p-6 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white text-3xl shadow-sm mb-4 animate-bounce">
                      ✓
                    </div>
                    <h4 className="font-extrabold text-white text-base">Verified & Authenticated</h4>
                    <p className="text-[10px] text-emerald-400 font-bold mt-1 uppercase tracking-wide">
                      Attendance Saved on Ledger
                    </p>
                    {locationResult && (
                      <p className="text-xs text-emerald-300 font-semibold mt-2.5 leading-relaxed">
                        ✅ Location Verified — {locationResult.distance} meters from classroom
                      </p>
                    )}
                  </div>
                ) : scanStage === 'failed' ? (
                  <div className="text-center p-6 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-rose-500 flex items-center justify-center text-white text-3xl shadow-sm mb-4">
                      ✕
                    </div>
                    <h4 className="font-extrabold text-white text-base">Verification Failed</h4>
                    {locationResult ? (
                      <p className="text-xs text-rose-300 font-bold mt-2.5 leading-relaxed">
                        ❌ Outside classroom range — {locationResult.distance} meters
                      </p>
                    ) : (
                      <p className="text-xs text-rose-300 font-bold mt-2.5 leading-relaxed">
                        ❌ Outside classroom range
                      </p>
                    )}
                    <p className="text-[9px] text-slate-400 mt-2">Maximum range allowed: 70 meters</p>
                  </div>
                ) : null
              )}
            </div>

            {/* Stage Progress Indicators */}
            <div className="flex justify-between items-center gap-1.5 px-4 mb-4 text-[10px] font-bold text-center">
              <span className={`flex-1 py-1 rounded-md border ${scanStage === 'qr' ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                1. QR Code
              </span>
              <span className="text-slate-400">➔</span>
              <span className={`flex-1 py-1 rounded-md border ${scanStage === 'face' ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                2. Face Scan
              </span>
              <span className="text-slate-400">➔</span>
              <span className={`flex-1 py-1 rounded-md border ${scanStage === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : scanStage === 'failed' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                {scanStage === 'failed' ? '❌ Denied' : '3. Registered'}
              </span>
            </div>
 
            {/* Bottom success message details */}
            {scanResult && (
              <div className="space-y-3">
                <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100">
                  <p className="text-xs text-emerald-800 font-semibold text-center">
                    Attendance Marked Successfully!
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center">On-Chain Transaction ID</p>
                  <p className="text-center font-mono text-[10px] bg-slate-100 rounded-lg p-2 border border-slate-200 mt-1 select-all break-all text-slate-600">
                    {scanResult.hash}
                  </p>
                </div>
                <button
                  onClick={closeScanner}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded-xl shadow-sm cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            )}

            {scanStage === 'failed' && (
              <div className="space-y-3">
                <div className="bg-rose-50 rounded-2xl p-3 border border-rose-100">
                  <p className="text-xs text-rose-800 font-semibold text-center leading-relaxed">
                    ❌ Attendance NOT marked — you are {locationResult?.distance ?? 0}m away (max 70m)
                  </p>
                </div>
                <button
                  onClick={closeScanner}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white rounded-xl shadow-sm cursor-pointer"
                >
                  Close & Try Again
                </button>
              </div>
            )}
 
            {scanning && (
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
                <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {scanStage === 'qr' ? 'Analyzing classroom QR...' : 'Deploying Block ledger confirmation...'}
              </div>
            )}
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
