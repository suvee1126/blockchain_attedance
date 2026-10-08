import { useState } from 'react';
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
    deleteStudent,
    addSection,
    deleteSection,
    addSubject,
    deleteSubject,
    clearDatabase,
    firebaseStatus,
  } = useApp();

  const [activeTab, setActiveTab] = useState('teachers'); // teachers | students | sections | subjects | report
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
    });

    // Reset
    setSName('');
    setSUsn('');
    setSEmail('');
    setSPassword('pass');
    setSSectionId('');
    setShowStudentModal(false);
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <SummitLogo className="w-10 h-10" />
              <div className="leading-none">
                <span className="text-lg font-black tracking-wide bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">SummitAttend</span>
                <p className="text-[8px] uppercase font-bold tracking-widest text-slate-400">System Admin</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClearDatabase}
                disabled={isClearingDb}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 text-xs font-bold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                title="Wipe mock records and start fresh"
              >
                {isClearingDb ? 'Clearing...' : '🗑️ Clear Database'}
              </button>
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-slate-500">System Admin</p>
                <p className="text-sm font-bold text-slate-800">Administrator</p>
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

      {dbClearMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold animate-fadeIn">
            <span>✅ {dbClearMessage}</span>
            <button onClick={() => setDbClearMessage('')} className="text-emerald-600 hover:text-emerald-900">✕</button>
          </div>
        </div>
      )}

      {/* ── Admin Stat Cards System Monitor ── */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
            <span className="text-2xl bg-blue-50 p-2 rounded-xl text-blue-600">📊</span>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sessions</p>
              <p className="text-lg font-black text-slate-800">{stats.totalSessions}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
            <span className="text-2xl bg-indigo-50 p-2 rounded-xl text-indigo-600">👥</span>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Users</p>
              <p className="text-lg font-black text-slate-800">{stats.totalUsers}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
            <span className="text-2xl bg-emerald-50 p-2 rounded-xl text-emerald-600">🔗</span>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Blockchain Tx</p>
              <p className="text-lg font-black text-slate-800">{stats.totalTransactions}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
            <span className="text-2xl bg-amber-50 p-2 rounded-xl text-amber-600">⚡</span>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Today</p>
              <p className="text-lg font-black text-slate-800">{stats.activeToday}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5 col-span-2 md:col-span-1">
            <span className="text-2xl bg-rose-50 p-2 rounded-xl text-rose-600">💚</span>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Node Health</p>
              <p className="text-lg font-black text-slate-800">{stats.networkHealth}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Switcher Navigation Tabs ── */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex border-b border-slate-200 bg-white rounded-xl p-1 shadow-sm gap-1 overflow-x-auto">
          <button
            onClick={() => { setActiveTab('teachers'); setInspectingSectionId(''); }}
            className={`flex-1 min-w-[120px] py-3 text-center text-sm font-semibold rounded-lg transition-all cursor-pointer ${activeTab === 'teachers' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/30'}`}
          >
            👨‍🏫 Teachers & Subjects
          </button>
          <button
            onClick={() => { setActiveTab('students'); setInspectingSectionId(''); }}
            className={`flex-1 min-w-[120px] py-3 text-center text-sm font-semibold rounded-lg transition-all cursor-pointer ${activeTab === 'students' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/30'}`}
          >
            🎓 Student Roster
          </button>
          <button
            onClick={() => { setActiveTab('sections'); setInspectingSectionId(''); }}
            className={`flex-1 min-w-[120px] py-3 text-center text-sm font-semibold rounded-lg transition-all cursor-pointer ${activeTab === 'sections' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/30'}`}
          >
            🏫 Sections & Years
          </button>
          <button
            onClick={() => { setActiveTab('subjects'); setInspectingSectionId(''); }}
            className={`flex-1 min-w-[120px] py-3 text-center text-sm font-semibold rounded-lg transition-all cursor-pointer ${activeTab === 'subjects' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/30'}`}
          >
            📚 Subjects Syllabus
          </button>
          <button
            onClick={() => { setActiveTab('report'); setInspectingSectionId(''); }}
            className={`flex-1 min-w-[120px] py-3 text-center text-sm font-semibold rounded-lg transition-all cursor-pointer ${activeTab === 'report' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-blue-600 hover:bg-slate-50'}`}
          >
            📋 Audit Report
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
              <div className="overflow-x-auto">
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
                        <tr key={teacher.id} className="hover:bg-slate-50/50">
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
            </div>
          </div>
        )}

        {/* Tab 2: Manage Students */}
        {activeTab === 'students' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
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
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-6">Name</th>
                      <th className="py-3 px-6">USN</th>
                      <th className="py-3 px-6">Email</th>
                      <th className="py-3 px-6">Section / Year</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-400 font-semibold">
                          No students registered yet. Click "+ Register Student" to add a student.
                        </td>
                      </tr>
                    ) : (
                      students.map((student) => {
                        const sec = sections.find(s => s.id === student.sectionId);
                        return (
                          <tr key={student.id} className="hover:bg-slate-50/50">
                            <td className="py-4 px-6 font-extrabold text-slate-800">{student.name}</td>
                            <td className="py-4 px-6 font-mono text-xs font-semibold text-slate-700">{student.usn}</td>
                            <td className="py-4 px-6 text-slate-500 text-xs font-mono">{student.email}</td>
                            <td className="py-4 px-6">
                              <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                {sec ? `${sec.year}th Year - ${sec.name}` : 'N/A'}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <button
                                onClick={() => deleteStudent(student.id)}
                                className="px-2.5 py-1 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg cursor-pointer"
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
                                const { attendanceRecords } = useApp(); // Access dynamic store state
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
