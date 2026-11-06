import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, validatePasswordRules } from '../AppContext';
import { SummitLogo } from '../components/SummitLogo';

const roles = [
  { id: 'student', label: 'Student', icon: '🎓', path: '/student' },
  { id: 'teacher', label: 'Teacher', icon: '👨‍🏫', path: '/teacher' },
  { id: 'admin', label: 'Admin', icon: '🔑', path: '/admin' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const {
    login,
    register,
    sections,
    sendOtp,
    verifyOtp,
    forgotPasswordRequest,
    forgotPasswordReset,
  } = useApp();

  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [selectedRole, setSelectedRole] = useState('student');

  // Sign In fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register fields
  const [verificationMethod, setVerificationMethod] = useState('email'); // 'email' | 'mobile'
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regUsn, setRegUsn] = useState('');
  const [regSectionId, setRegSectionId] = useState('');
  const [regParentName, setRegParentName] = useState('');
  const [regParentPhone, setRegParentPhone] = useState('');
  const [regDept, setRegDept] = useState('Computer Science');

  // Registration OTP Modal state (5-Minute Live Countdown)
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSentIdentifier, setOtpSentIdentifier] = useState('');
  const [otpSentMethod, setOtpSentMethod] = useState('email');
  const [otpTimer, setOtpTimer] = useState(300); // 300 seconds (5 minutes)
  const [devOtpHint, setDevOtpHint] = useState('');

  // Forgot Password Modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = enter email, 2 = enter OTP & new password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotRole, setForgotRole] = useState('student');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotDevOtpHint, setForgotDevOtpHint] = useState('');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);


  // 5-minute (300 seconds) live countdown timer for OTP modal
  useEffect(() => {
    let interval = null;
    if (showOtpModal && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showOtpModal, otpTimer]);

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

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
    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanPwd = regPassword.trim();
    const cleanPhone = regPhone.trim() ? `${countryCode}${regPhone.trim()}` : '';

    if (!cleanName || !cleanPwd) {
      setError('Please fill in your full name and create a password.');
      return;
    }

    if (verificationMethod === 'email') {
      if (!cleanEmail || !cleanEmail.includes('@')) {
        setError('Please enter a valid email address (e.g. name@gmail.com).');
        return;
      }
    } else {
      if (!regPhone.trim() || regPhone.trim().length < 7) {
        setError('Please enter a valid mobile number with country code for SMS verification.');
        return;
      }
    }

    // Strong password validation
    const { isValid, rules } = validatePasswordRules(cleanPwd);
    if (!isValid) {
      const failed = rules.filter((r) => !r.valid).map((r) => r.label).join(', ');
      setError(`Password requirement not met: ${failed}`);
      return;
    }

    if (cleanPwd !== regConfirmPassword.trim()) {
      setError('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    setIsLoading(true);

    try {
      const targetIdentifier = verificationMethod === 'email' ? cleanEmail : cleanPhone;
      const otpRes = await sendOtp(targetIdentifier, selectedRole, 'verification', verificationMethod);
      if (otpRes?.emailSent === false && verificationMethod === 'email') {
        throw new Error(otpRes.errorNotice || `Failed to dispatch verification email to ${targetIdentifier}.`);
      }
      setOtpSentIdentifier(targetIdentifier);
      setOtpSentMethod(verificationMethod);
      setOtpTimer(300); // 5 minutes expiration
      setShowOtpModal(true);
      setSuccessMsg(`Verification code dispatched to ${targetIdentifier}. Valid for 5 minutes.`);
    } catch (err) {
      setError(err.message || 'Failed to dispatch verification code. Please check your details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendRegistrationOtp = async () => {
    if (isLoading) return;
    setError('');
    setIsLoading(true);
    try {
      const otpRes = await sendOtp(otpSentIdentifier, selectedRole, 'verification', otpSentMethod);
      if (otpRes?.emailSent === false && otpSentMethod === 'email') {
        throw new Error(otpRes.errorNotice || `Failed to resend email to ${otpSentIdentifier}.`);
      }
      setOtpTimer(300);
      setSuccessMsg(`New 6-digit code dispatched to ${otpSentIdentifier}!`);
    } catch (err) {
      setError(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Complete registration after verifying OTP
  const handleVerifyOtpAndCreateAccount = async (e) => {
    e.preventDefault();
    setError('');
    if (!otpCode.trim()) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (otpTimer === 0) {
      setError('Verification code has expired. Please tap "Resend Code" to get a fresh code.');
      return;
    }

    setIsLoading(true);
    try {
      await verifyOtp(otpSentIdentifier, selectedRole, otpCode.trim(), 'verification', otpSentMethod);

      const finalEmail = otpSentMethod === 'email' ? otpSentIdentifier : regEmail.trim().toLowerCase();
      const finalPhone = otpSentMethod === 'mobile' ? otpSentIdentifier : (regPhone.trim() ? `${countryCode}${regPhone.trim()}` : '');

      if (selectedRole === 'student') {
        const cleanUsn = regUsn.trim();
        const sectionId = regSectionId || (sections[0] ? sections[0].id : 's1');

        await register('student', {
          name: regName.trim(),
          email: finalEmail,
          phone: finalPhone,
          verificationMethod: otpSentMethod,
          password: regPassword.trim(),
          usn: cleanUsn,
          sectionId: sectionId,
          parentName: regParentName.trim(),
          parentPhone: regParentPhone.trim(),
        });
      } else if (selectedRole === 'teacher') {
        await register('teacher', {
          name: regName.trim(),
          email: finalEmail,
          phone: finalPhone,
          verificationMethod: otpSentMethod,
          password: regPassword.trim(),
          department: regDept.trim() || 'Computer Science',
        });
      }

      setShowOtpModal(false);
      setSuccessMsg(`${otpSentMethod === 'email' ? 'Email' : 'Mobile number'} verified and account activated successfully! You may now sign in.`);
      setAuthMode('login');
      setEmail(otpSentIdentifier);
      setPassword(regPassword.trim());
      setOtpCode('');
    } catch (err) {
      setError(err.message || 'Verification failed. Incorrect OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot password request OTP
  const handleForgotSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your registered email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await forgotPasswordRequest(cleanEmail, forgotRole);
      if (res?.devOtp) setForgotDevOtpHint(res.devOtp);
      setForgotStep(2);
      setSuccessMsg(`Reset code sent to ${cleanEmail}. Enter code and new password.`);
    } catch (err) {
      setError(err.message || 'No account found with this email.');
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot password confirm reset
  const handleForgotResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (!forgotOtp.trim()) {
      setError('Please enter the 6-digit reset code.');
      return;
    }

    const { isValid, rules } = validatePasswordRules(forgotNewPassword);
    if (!isValid) {
      const failed = rules.filter((r) => !r.valid).map((r) => r.label).join(', ');
      setError(`New password requirement not met: ${failed}`);
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await forgotPasswordReset(forgotEmail.trim().toLowerCase(), forgotRole, forgotOtp.trim(), forgotNewPassword, forgotConfirmPassword);
      setShowForgotModal(false);
      setForgotStep(1);
      setSuccessMsg('Password has been securely reset! You can now sign in with your new password.');
      setEmail(forgotEmail.trim().toLowerCase());
      setPassword('');
      setForgotOtp('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Failed to reset password. Verify code and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const regPwdRules = validatePasswordRules(regPassword);
  const forgotPwdRules = validatePasswordRules(forgotNewPassword);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center py-6 px-3 sm:px-6 relative overflow-y-auto font-sans">
      {/* Background Decorative Rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[650px] h-[300px] sm:h-[650px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[200px] sm:w-[400px] h-[200px] sm:h-[400px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10 my-auto">
        {/* Header / Brand */}
        <div className="flex flex-col items-center mb-5 sm:mb-6 text-center">
          <div className="p-2 sm:p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl shadow-xl shadow-blue-500/20 mb-2 sm:mb-3">
            <SummitLogo className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Summit<span className="text-blue-500">Attend</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-[280px] sm:max-w-xs">
            Cryptographic Attendance Ledger & Academic Management Platform
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-2xl border border-slate-100 relative">
          {/* Mode Switcher: Login vs Register */}
          <div className="flex border-b border-slate-100 pb-4 mb-4 sm:mb-5">
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 pb-2 text-center text-xs sm:text-sm font-extrabold transition-all cursor-pointer border-b-2 ${
                authMode === 'login' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('register'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 pb-2 text-center text-xs sm:text-sm font-extrabold transition-all cursor-pointer border-b-2 ${
                authMode === 'register' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Register Account
            </button>
          </div>

          {/* Role Selection Tabs */}
          <div>
            <label className="block text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Select User Role
            </label>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {roles.map((r) => {
                const isSelected = selectedRole === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleRoleChange(r.id)}
                    className={`
                      flex flex-col items-center justify-center py-2 sm:py-2.5 px-1 sm:px-2 rounded-xl text-center transition-all cursor-pointer min-h-[48px]
                      ${
                        isSelected
                          ? 'bg-blue-50/80 border-2 border-blue-600 text-blue-900 shadow-sm'
                          : 'bg-slate-50 border border-slate-200/70 text-slate-600 hover:bg-slate-100/70'
                      }
                    `}
                  >
                    <span className="text-base sm:text-lg mb-0.5">{r.icon}</span>
                    <span className="text-[11px] sm:text-xs font-bold leading-tight">{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {authMode === 'login' ? (
            /* ── Login Form (Quick Credentials Completely Removed) ── */
            <form onSubmit={handleLoginSubmit} className="mt-5 space-y-4">
              {/* Email / Identifier */}
              <div className="space-y-1">
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Email Address {selectedRole === 'student' && '/ College USN'}
                </label>
                <input
                  type="text"
                  placeholder={selectedRole === 'student' ? 'e.g. student@gmail.com or USN' : 'e.g. name@gmail.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs sm:text-sm font-medium min-h-[44px]"
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotRole(selectedRole);
                      setForgotStep(1);
                      setError('');
                      setShowForgotModal(true);
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your account password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs sm:text-sm font-medium pr-10 min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer p-1"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
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
                  w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs sm:text-sm font-extrabold text-white
                  transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/20 cursor-pointer shadow-md min-h-[46px]
                  ${
                    isLoading
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 hover:from-blue-700 hover:to-indigo-900 shadow-blue-100 hover:scale-[1.01]'
                  }
                `}
              >
                {isLoading ? (
                  <span>Verifying Credentials…</span>
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
            /* ── Register Form with Real Email Verification & Strong Password Validation ── */
            <form onSubmit={handleRegisterSubmit} className="mt-5 space-y-3.5">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Suhas Sharma"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs sm:text-sm font-medium min-h-[44px]"
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Valid Email Address (Verification Code will be sent)
                </label>
                <input
                  type="email"
                  placeholder="e.g. yourname@gmail.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs sm:text-sm font-medium min-h-[44px]"
                />
              </div>

              {/* Role Specific Registration Fields */}
              {selectedRole === 'student' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        USN / Roll No
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 123"
                        value={regUsn}
                        onChange={(e) => setRegUsn(e.target.value)}
                        required
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs sm:text-sm font-mono font-medium min-h-[44px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Class Section
                      </label>
                      <select
                        value={regSectionId}
                        onChange={(e) => setRegSectionId(e.target.value)}
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none text-xs sm:text-sm font-medium min-h-[44px]"
                      >
                        {sections.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.year}th Year)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Parent Full Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rajesh Sharma"
                        value={regParentName}
                        onChange={(e) => setRegParentName(e.target.value)}
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs font-medium min-h-[44px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Parent WhatsApp No.
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. +91 9876543210"
                        value={regParentPhone}
                        onChange={(e) => setRegParentPhone(e.target.value)}
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs font-medium min-h-[44px]"
                      />
                    </div>
                  </div>
                </>
              )}

              {selectedRole === 'teacher' && (
                <div className="space-y-1">
                  <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Academic Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Computer Science & Engineering"
                    value={regDept}
                    onChange={(e) => setRegDept(e.target.value)}
                    required
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs sm:text-sm font-medium min-h-[44px]"
                  />
                </div>
              )}

              {/* Password Fields */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Create Password
                    </label>
                    <input
                      type="password"
                      placeholder="Min 8 chars"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs sm:text-sm font-medium min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      placeholder="Repeat password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      required
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none text-xs sm:text-sm font-medium min-h-[44px]"
                    />
                  </div>
                </div>

                {/* Live Password Rules Checklist */}
                {regPassword.length > 0 && (
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[10px] space-y-1 animate-fadeIn">
                    <p className="font-bold text-slate-600 mb-1">Strong Password Requirements:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {regPwdRules.rules.map((r) => (
                        <div key={r.id} className={`flex items-center gap-1.5 ${r.valid ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                          <span>{r.valid ? '✓' : '○'}</span>
                          <span>{r.label}</span>
                        </div>
                      ))}
                      <div className={`flex items-center gap-1.5 ${regPassword && regPassword === regConfirmPassword ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                        <span>{regPassword && regPassword === regConfirmPassword ? '✓' : '○'}</span>
                        <span>Passwords match</span>
                      </div>
                    </div>
                  </div>
                )}
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
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs sm:text-sm font-extrabold text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 transition-all shadow-md min-h-[46px] cursor-pointer"
              >
                {isLoading ? 'Sending Verification Code…' : `Verify with ${verificationMethod === 'email' ? 'Email' : 'Mobile OTP'} & Create Account`}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] sm:text-[11px] text-slate-500 mt-5 sm:mt-6">
          SummitAttend Biometric Security • Powered by OpenCV Deep Learning & Blockchain
        </p>
      </div>

      {/* ── Modal: Email & Mobile Verification OTP Code (5-Minute Expiry) ── */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 text-center relative">
            <button
              onClick={() => setShowOtpModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs cursor-pointer"
            >
              ✕
            </button>

            <span className="text-3xl block mb-2">{otpSentMethod === 'email' ? '✉️' : '📱'}</span>
            <h3 className="font-extrabold text-slate-900 text-base">
              {otpSentMethod === 'email' ? 'Verify Email Address' : 'Verify Mobile Number'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              We sent a 6-digit security code to <span className="font-bold text-slate-800 break-all">{otpSentIdentifier}</span>.
            </p>

            {/* 5-Minute Live Countdown Timer */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold ${otpTimer > 30 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'}`}>
                <span>⏱️</span>
                <span>{otpTimer > 0 ? `Expires in ${formatCountdown(otpTimer)}` : 'Code Expired'}</span>
              </span>
            </div>

            {devOtpHint && (
              <div className="my-3 p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-bold">
                🔑 Verification Code: <span className="font-mono text-base tracking-widest text-blue-700">{devOtpHint}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtpAndCreateAccount} className="mt-4 space-y-3">
              <input
                type="text"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                required
                disabled={otpTimer === 0}
                className="w-full text-center tracking-widest font-mono text-xl font-bold py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none min-h-[46px] disabled:bg-slate-100 disabled:opacity-50"
              />

              {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}

              <button
                type="submit"
                disabled={isLoading || otpCode.length < 6 || otpTimer === 0}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 min-h-[44px]"
              >
                {isLoading ? 'Verifying Code…' : 'Confirm & Activate Account'}
              </button>

              <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100 mt-3">
                <span className="text-slate-400">Didn't receive the code?</span>
                <button
                  type="button"
                  onClick={handleResendRegistrationOtp}
                  disabled={isLoading || (otpTimer > 270)}
                  className="font-bold text-blue-600 hover:text-blue-800 disabled:text-slate-300 cursor-pointer disabled:cursor-not-allowed hover:underline"
                >
                  Resend Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Forgot Password ── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => { setShowForgotModal(false); setError(''); }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs cursor-pointer"
            >
              ✕
            </button>

            <span className="text-3xl block mb-2 text-center">🔐</span>
            <h3 className="font-extrabold text-slate-900 text-base text-center">Password Recovery</h3>
            <p className="text-xs text-slate-500 mt-1 text-center">
              {forgotStep === 1 ? 'Enter your registered email to receive a password reset code.' : 'Enter the code and create a new secure password.'}
            </p>

            {forgotStep === 1 ? (
              <form onSubmit={handleForgotSendOtp} className="mt-4 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Your Role</label>
                  <select
                    value={forgotRole}
                    onChange={(e) => setForgotRole(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-800 focus:outline-none min-h-[40px]"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Registered Email</label>
                  <input
                    type="email"
                    placeholder="e.g. name@gmail.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none min-h-[44px]"
                  />
                </div>

                {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer min-h-[44px]"
                >
                  {isLoading ? 'Dispatching Code…' : 'Send Reset Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgotResetPassword} className="mt-4 space-y-3">
                {forgotDevOtpHint && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-bold text-center">
                    🔑 Reset Code: <span className="font-mono text-sm tracking-widest text-blue-700">{forgotDevOtpHint}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">6-Digit Reset Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter code"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    className="w-full text-center font-mono font-bold tracking-widest rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">New Strong Password</label>
                  <input
                    type="password"
                    placeholder="Min 8 chars, Aa1@ rules"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="Repeat new password"
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none min-h-[44px]"
                  />
                </div>

                {forgotNewPassword.length > 0 && (
                  <div className="p-2 bg-slate-50 rounded-xl text-[10px] space-y-0.5 border border-slate-200">
                    {forgotPwdRules.rules.map((r) => (
                      <div key={r.id} className={r.valid ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                        {r.valid ? '✓' : '○'} {r.label}
                      </div>
                    ))}
                  </div>
                )}

                {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer min-h-[44px]"
                >
                  {isLoading ? 'Updating Password…' : 'Save New Password & Sign In'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
