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
      setError('Please fill in both your email and password.');
      return;
    }

    setIsLoading(true);

    try {
      await login(selectedRole, cleanEmail, cleanPwd);
      const roleObj = roles.find((r) => r.id === selectedRole);
      navigate(roleObj ? roleObj.path : '/student');
    } catch (err) {
      setError(err.message || 'Login failed. Please verify your email and password.');
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

    if (selectedRole === 'student' && !regUsn.trim()) {
      setError('Student USN / Roll number is required.');
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        role: selectedRole,
        name: cleanName,
        email: cleanEmail,
        password: cleanPwd,
        usn: selectedRole === 'student' ? regUsn.trim().toUpperCase() : undefined,
        sectionId: selectedRole === 'student' ? (regSectionId || (sections[0]?.id || 's1')) : undefined,
        department: selectedRole === 'teacher' ? regDept : undefined,
      };

      const user = await register(payload);
      setSuccessMsg('Account registered successfully! Redirecting...');
      setTimeout(() => {
        const roleObj = roles.find((r) => r.id === selectedRole);
        navigate(roleObj ? roleObj.path : '/student');
      }, 500);
    } catch (err) {
      setError(err.message || 'Registration failed. Please check input values.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6 flex flex-col items-center gap-2">
          <SummitLogo className="w-16 h-16 animate-neon-glow rounded-3xl" />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 font-heading">SummitAttend</h1>
            <p className="text-xs font-semibold text-slate-500">Cryptographic Blockchain & Cloud Database Portal</p>
          </div>
          {/* Cloud Database indicator */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-[11px] font-bold text-blue-700 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Cloud Database: smart-add-f776e</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xl shadow-slate-100/50">
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
              ? 'Select role and log in with your Gmail & password'
              : 'Register your email in the database ledger'}
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

          {/* ── Sign In Form ── */}
          {authMode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Email / Gmail Address
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <svg className="h-4.5 w-4.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="e.g. user@gmail.com"
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
                  <label htmlFor="login-password" className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
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
                      {error.includes('No') && error.includes('found') && (
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

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`
                  w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white
                  transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/20 cursor-pointer
                  ${
                    isLoading
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 hover:from-blue-700 hover:to-indigo-900 shadow-md shadow-blue-100 hover:scale-[1.01]'
                  }
                `}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verifying Credentials in Database…
                  </>
                ) : (
                  <>
                    Sign In to Portal
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
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all text-sm font-medium"
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Email / Gmail Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. yourname@gmail.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all text-sm font-medium"
                />
              </div>

              {/* Role specific: Student USN & Section */}
              {selectedRole === 'student' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      USN / Roll No
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1SI22CS001"
                      value={regUsn}
                      onChange={(e) => setRegUsn(e.target.value)}
                      required
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-sm font-medium uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Section
                    </label>
                    <select
                      value={regSectionId}
                      onChange={(e) => setRegSectionId(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none text-sm font-medium"
                    >
                      {sections.map((sec) => (
                        <option key={sec.id} value={sec.id}>{sec.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Role specific: Teacher Department */}
              {selectedRole === 'teacher' && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Department
                  </label>
                  <select
                    value={regDept}
                    onChange={(e) => setRegDept(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none text-sm font-medium"
                  >
                    <option value="Computer Science">Computer Science & Engineering</option>
                    <option value="Information Science">Information Science & Engineering</option>
                    <option value="Artificial Intelligence">Artificial Intelligence & ML</option>
                    <option value="Electronics">Electronics & Communication</option>
                  </select>
                </div>
              )}

              {/* Passwords */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Min 3 characters"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    placeholder="Repeat password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    required
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-sm font-medium"
                  />
                </div>
              </div>

              {/* Error / Success message */}
              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-semibold animate-fadeIn">
                  ⚠️ {error}
                </div>
              )}
              {successMsg && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700 font-semibold animate-fadeIn">
                  ✅ {successMsg}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`
                  w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white
                  transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/20 cursor-pointer
                  ${
                    isLoading
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-emerald-600 via-teal-700 to-blue-700 hover:from-emerald-700 hover:to-blue-800 shadow-md shadow-emerald-100 hover:scale-[1.01]'
                  }
                `}
              >
                {isLoading ? 'Storing Account in Database…' : 'Register & Enter Dashboard'}
              </button>
            </form>
          )}

          {/* Quick Demo Logins Helper */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => setShowDemoLogins(!showDemoLogins)}
              className="text-xs text-slate-400 hover:text-blue-600 font-semibold cursor-pointer"
            >
              {showDemoLogins ? '▲ Hide Quick Credentials' : '▼ View Administrator Credentials'}
            </button>

            {showDemoLogins && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-left text-xs space-y-2">
                <div className="p-2 bg-white rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-800">Admin Account:</span>
                    <p className="text-[11px] text-slate-500">admin@blockchain.edu / admin123</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('admin');
                      setEmail('admin@blockchain.edu');
                      setPassword('admin123');
                      setAuthMode('login');
                    }}
                    className="text-[10px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-bold hover:bg-blue-100"
                  >
                    Use
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Tip: To use your own Gmail, select &quot;Create Account&quot; above to register with any Gmail and password, which stores directly in the database!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
