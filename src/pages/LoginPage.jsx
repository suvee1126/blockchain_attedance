import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { SummitLogo } from '../components/SummitLogo';

const roles = [
  { id: 'student', label: 'Student', icon: '🎓', path: '/student' },
  { id: 'teacher', label: 'Teacher', icon: '👨‍🏫', path: '/teacher' },
  { id: 'admin', label: 'Admin', icon: '🔑', path: '/admin' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register, sections, firebaseStatus } = useApp();

  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [selectedRole, setSelectedRole] = useState('student');

  // Sign In fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regUsn, setRegUsn] = useState('');
  const [regSectionId, setRegSectionId] = useState('');
  const [regParentName, setRegParentName] = useState('');
  const [regParentPhone, setRegParentPhone] = useState('');
  const [regDept, setRegDept] = useState('Computer Science');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDemoLogins, setShowDemoLogins] = useState(false);

  const handleRoleChange = (roleId) => {
    setSelectedRole(roleId);
    setError('');
    setSuccessMsg('');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanEmail = email.trim();
    const cleanPwd = password.trim();

    if (!cleanEmail || !cleanPwd) {
      setError('Please fill in both your email/USN and password.');
      return;
    }

    setIsLoading(true);

    try {
      await login(selectedRole, cleanEmail, cleanPwd);
      const roleObj = roles.find((r) => r.id === selectedRole);
      navigate(roleObj ? roleObj.path : '/student');
    } catch (err) {
      setError(err.message || 'Login failed. Please verify your credentials.');
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanName = regName.trim();
    const cleanEmail = regEmail.trim();
    const cleanPwd = regPassword.trim();

    if (!cleanName || !cleanEmail || !cleanPwd) {
      setError('Please fill in all required registration fields.');
      return;
    }

    if (cleanPwd.length < 3) {
      setError('Password must be at least 3 characters.');
      return;
    }

    if (cleanPwd !== regConfirmPassword.trim()) {
      setError('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    setIsLoading(true);

    try {
      if (selectedRole === 'student') {
        const cleanUsn = regUsn.trim();
        const sectionId = regSectionId || (sections[0] ? sections[0].id : 's1');
        if (!cleanUsn) {
          setError('Please provide your College USN / Roll number.');
          setIsLoading(false);
          return;
        }

        await register('student', {
          name: cleanName,
          email: cleanEmail,
          password: cleanPwd,
          usn: cleanUsn,
          sectionId: sectionId,
          parentName: regParentName.trim(),
          parentPhone: regParentPhone.trim()
        });

        setSuccessMsg(`Student account created successfully! Please sign in with your email and password.`);
        setAuthMode('login');
        setEmail(cleanEmail);
        setPassword(cleanPwd);
      } else if (selectedRole === 'teacher') {
        await register('teacher', {
          name: cleanName,
          email: cleanEmail,
          password: cleanPwd,
          department: regDept.trim() || 'Computer Science'
        });

        setSuccessMsg(`Teacher account created successfully! Please sign in.`);
        setAuthMode('login');
        setEmail(cleanEmail);
        setPassword(cleanPwd);
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Email or USN may already exist.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Decorative Rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10">
        {/* Header / Brand */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="flex items-center gap-2 mb-2">
            <SummitLogo className="w-10 h-10" />
            <h1 className="text-2xl font-black tracking-tight text-white font-heading">
              Summit<span className="text-blue-400">Attend</span>
            </h1>
          </div>
          <p className="text-xs font-semibold text-slate-400">
            Smart Attendance Management with Biometrics & Blockchain Ledger
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xl shadow-slate-100/10">
          {/* Mode Switcher: Sign In vs Register */}
          <div className="flex border border-slate-200 rounded-2xl p-1 bg-slate-50 mb-6">
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setError('');
                setSuccessMsg('');
                if (selectedRole === 'admin') setSelectedRole('student');
              }}
              className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                authMode === 'register'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          <h2 className="text-2xl font-black text-slate-800 text-center lg:text-left font-heading">
            {authMode === 'login' ? 'Welcome Back' : 'Create New Account'}
          </h2>
          <p className="mt-1 text-xs text-slate-400 text-center lg:text-left font-medium">
            {authMode === 'login'
              ? 'Select your role and sign in with email and password'
              : 'Register your account in the permanent database'}
          </p>

          {/* ── Role Selector Cards ── */}
          <div className={`grid gap-3 mt-6 ${authMode === 'login' ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {(authMode === 'login' ? roles : roles.filter(r => r.id !== 'admin')).map((role) => {
              const isActive = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleRoleChange(role.id)}
                  className={`
                    relative flex flex-col items-center gap-1.5 rounded-2xl border-2 py-3 px-2
                    transition-all duration-300 cursor-pointer focus:outline-none
                    ${
                      isActive
                        ? 'border-blue-600 bg-blue-50/50 shadow-md shadow-blue-100/40 text-blue-700'
                        : 'border-slate-150 bg-slate-50/50 hover:border-blue-200 hover:bg-blue-50/20 text-slate-600'
                    }
                  `}
                >
                  <span className="text-2xl">{role.icon}</span>
                  <span className="text-[11px] font-extrabold">{role.label}</span>
                  {isActive && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Sign In Form (Email + Password for ALL roles) ── */}
          {authMode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
              {/* Role badge */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">
                    {selectedRole === 'student' ? '🎓' : selectedRole === 'teacher' ? '👨‍🏫' : '🔑'}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {selectedRole === 'student' ? 'Student Portal Login' : selectedRole === 'teacher' ? 'Teacher Portal Login' : 'Admin Portal Login'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {selectedRole === 'student' 
                        ? 'Enter your student email or USN and password'
                        : selectedRole === 'teacher'
                        ? 'Enter your registered teacher email and password'
                        : 'Sign in with administrator credentials'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {selectedRole}
                </span>
              </div>

              {/* Email / USN Input */}
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {selectedRole === 'student' ? 'Student Email or USN / Roll No' : 'Email Address'}
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <svg className="h-4.5 w-4.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <input
                    id="login-email"
                    type="text"
                    placeholder={
                      selectedRole === 'student'
                        ? 'e.g. suhas123@gmail.com or 123'
                        : selectedRole === 'teacher'
                        ? 'e.g. teach1@gmail.com'
                        : 'e.g. admin@summit.edu'
                    }
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    required
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all text-sm font-medium"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="login-password" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Password / Access Key
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <svg className="h-4.5 w-4.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    required
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all text-sm font-medium"
                  />
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-semibold animate-fadeIn">
                  <div className="flex items-start gap-2">
                    <span className="text-base leading-none">⚠️</span>
                    <div className="flex-1">
                      <p>{error}</p>
                      {error.includes('No') && error.includes('found') && selectedRole !== 'admin' && (
                        <button
                          type="button"
                          onClick={() => { setAuthMode('register'); setError(''); }}
                          className="mt-1 text-blue-700 underline font-bold cursor-pointer"
                        >
                          Click here to create a new account with this email
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Success message */}
              {successMsg && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-bold animate-fadeIn">
                  <p className="flex items-center gap-1.5">
                    <span>✅</span>
                    <span>{successMsg}</span>
                  </p>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`
                  w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white
                  transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/20 cursor-pointer shadow-md
                  ${
                    isLoading
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 hover:from-blue-700 hover:to-indigo-900 shadow-blue-100 hover:scale-[1.01]'
                  }
                `}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verifying Credentials…
                  </>
                ) : (
                  <>
                    <span>Sign In as {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* ── Register Form ── */
            <form onSubmit={handleRegisterSubmit} className="mt-6 space-y-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Suhas Sharma"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs font-medium"
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. suhas123@gmail.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs font-medium"
                />
              </div>

              {/* Role Specific Registration Fields */}
              {selectedRole === 'student' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        USN / Roll No
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 123"
                        value={regUsn}
                        onChange={(e) => setRegUsn(e.target.value)}
                        required
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs font-mono font-medium"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Section
                      </label>
                      <select
                        value={regSectionId}
                        onChange={(e) => setRegSectionId(e.target.value)}
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none text-xs font-medium"
                      >
                        {sections.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.year}th Year)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Parent Details */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Parent's Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mr. Rajesh Sharma"
                      value={regParentName}
                      onChange={(e) => setRegParentName(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Parent's WhatsApp Number
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 9353591776"
                      value={regParentPhone}
                      onChange={(e) => setRegParentPhone(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs font-medium"
                    />
                  </div>
                </>
              )}

              {selectedRole === 'teacher' && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Computer Science & Engineering"
                    value={regDept}
                    onChange={(e) => setRegDept(e.target.value)}
                    required
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs font-medium"
                  />
                </div>
              )}

              {/* Password Fields */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Confirm
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    required
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs font-medium"
                  />
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-semibold animate-fadeIn">
                  <p className="flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>{error}</span>
                  </p>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`
                  w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white
                  transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/20 cursor-pointer shadow-md
                  ${
                    isLoading
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'
                  }
                `}
              >
                {isLoading ? 'Creating Account…' : 'Register Account'}
              </button>
            </form>
          )}

          {/* Quick Demo Credentials Toggle */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => setShowDemoLogins(!showDemoLogins)}
              className="text-[11px] font-bold text-slate-500 hover:text-blue-600 transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <span>{showDemoLogins ? '▼ Hide Quick Credentials' : '▶ Show Quick Credentials'}</span>
            </button>

            {showDemoLogins && (
              <div className="mt-3 bg-slate-50 rounded-2xl p-3 border border-slate-200 text-left space-y-2 text-[11px] animate-fadeIn">
                <div 
                  onClick={() => { setSelectedRole('student'); setEmail('suhas123@gmail.com'); setPassword('suhas'); setAuthMode('login'); }}
                  className="p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors"
                >
                  <p className="font-bold text-slate-800">🎓 Student: <span className="font-mono text-blue-600">suhas123@gmail.com</span> (USN: 123)</p>
                  <p className="text-[10px] text-slate-500">Password: <span className="font-mono">suhas</span></p>
                </div>
                <div 
                  onClick={() => { setSelectedRole('student'); setEmail('stu1@gmail.com'); setPassword('pass'); setAuthMode('login'); }}
                  className="p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors"
                >
                  <p className="font-bold text-slate-800">🎓 Student: <span className="font-mono text-blue-600">stu1@gmail.com</span> (USN: 001)</p>
                  <p className="text-[10px] text-slate-500">Password: <span className="font-mono">pass</span> • Face Enrolled</p>
                </div>
                <div 
                  onClick={() => { setSelectedRole('teacher'); setEmail('teach1@gmail.com'); setPassword('pass'); setAuthMode('login'); }}
                  className="p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors"
                >
                  <p className="font-bold text-slate-800">👨‍🏫 Teacher: <span className="font-mono text-blue-600">teach1@gmail.com</span></p>
                  <p className="text-[10px] text-slate-500">Password: <span className="font-mono">pass</span></p>
                </div>
                <div 
                  onClick={() => { setSelectedRole('admin'); setEmail('admin@summit.edu'); setPassword('admin123'); setAuthMode('login'); }}
                  className="p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors"
                >
                  <p className="font-bold text-slate-800">🔑 Admin: <span className="font-mono text-blue-600">admin@summit.edu</span></p>
                  <p className="text-[10px] text-slate-500">Password: <span className="font-mono">admin123</span></p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-500 mt-6">
          SummitAttend Biometric Security • Powered by OpenCV Deep Learning & Blockchain
        </p>
      </div>
    </div>
  );
}
