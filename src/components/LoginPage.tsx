import React, { useState, useRef, useEffect } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  ShieldCheck,
  Banknote,
  Camera,
  ScanFace,
  CheckCircle2,
  RefreshCw,
  Zap,
  X,
  UserCheck,
  KeyRound,
  Mail,
  Phone,
  Send
} from 'lucide-react';
import { AuthUser } from '../types';
import { api } from '../services/api';
// Lightweight Biometric Verification via Server SFace Engine

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser, token: string) => void;
  onOpenKiosk?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onOpenKiosk }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot Password States
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotIdentifier, setForgotIdentifier] = useState<string>('');
  const [isForgotLoading, setIsForgotLoading] = useState<boolean>(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<any | null>(null);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) {
      setForgotError('Nomor HP, Email, atau ID/Username wajib diisi');
      return;
    }
    setIsForgotLoading(true);
    setForgotError(null);
    try {
      const res = await api.requestForgotPassword(forgotIdentifier.trim());
      setForgotSuccess(res);
    } catch (err: any) {
      setForgotError(err?.message || 'Gagal memproses pemulihan kata sandi');
    } finally {
      setIsForgotLoading(false);
    }
  };

  // Login Mode: PASSWORD (Kata Sandi) or FACE_ID (Biometrik Wajah 1:N)
  const [loginMode, setLoginMode] = useState<'PASSWORD' | 'FACE_ID'>('PASSWORD');

  // Biometric Face ID States
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [enrolledCount, setEnrolledCount] = useState<number>(0);
  const [isIndexingGallery, setIsIndexingGallery] = useState<boolean>(false);
  const [detectedCandidate, setDetectedCandidate] = useState<any | null>(null);
  const [recognitionProgress, setRecognitionProgress] = useState<number>(0);
  const [isFaceAuthenticating, setIsFaceAuthenticating] = useState<boolean>(false);
  const [faceFeedback, setFaceFeedback] = useState<string>('Posisikan Wajah di Depan Kamera');

  // Confirmation state for Face ID Login (anti-wrong-person gate)
  const [pendingLogin, setPendingLogin] = useState<{
    employee: any;
    score: number;
    matchedPose: any;
    countdown: number;
    verifiedToken?: string | null;
    verifiedUser?: AuthUser | null;
  } | null>(null);

  const faceVideoRef = useRef<HTMLVideoElement | null>(null);
  const faceStreamRef = useRef<MediaStream | null>(null);
  const isFaceAuthenticatingRef = useRef<boolean>(false);

  // Audio Chime Helper
  const playTone = (freq: number, type: OscillatorType = 'sine', duration = 0.15) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  };

  const startFaceCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });
      faceStreamRef.current = stream;
      if (faceVideoRef.current) {
        faceVideoRef.current.srcObject = stream;
        await faceVideoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.warn('Face camera error:', err);
      setCameraError('Kamera tidak dapat diakses atau izin ditolak. Harap izinkan akses kamera di browser Anda.');
      setCameraActive(false);
    }
  };

  const stopFaceCamera = () => {
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach(t => t.stop());
      faceStreamRef.current = null;
    }
    if (faceVideoRef.current) {
      faceVideoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setRecognitionProgress(0);
    setDetectedCandidate(null);
    setPendingLogin(null);
  };

  // Manage Camera when switching to FACE_ID (Zero Canvas/CPU Bloat)
  useEffect(() => {
    if (loginMode === 'FACE_ID') {
      isFaceAuthenticatingRef.current = false;
      setIsFaceAuthenticating(false);
      setPendingLogin(null);
      setFaceFeedback('Posisikan Wajah di Depan Kamera');
      startFaceCamera();

      if (enrolledCount === 0) {
        setIsIndexingGallery(true);
        fetch('/api/public-kiosk/employees')
          .then(r => r.json())
          .then(data => {
            const count = (data.employees || []).filter((e: any) => e.hasBiometric || e.biometric?.isEnrolled).length;
            setEnrolledCount(count);
          })
          .catch(() => {})
          .finally(() => setIsIndexingGallery(false));
      }
    } else {
      stopFaceCamera();
    }

    return () => {
      stopFaceCamera();
    };
  }, [loginMode]);

  // Countdown timer for pending biometric login confirmation
  useEffect(() => {
    if (!pendingLogin) return;

    if (pendingLogin.countdown <= 0) {
      const { employee, score, matchedPose, verifiedUser, verifiedToken } = pendingLogin;
      setPendingLogin(null);
      if (verifiedUser && verifiedToken) {
        api.setAuthToken(verifiedToken);
        playTone(1318.51, 'sine', 0.35);
        stopFaceCamera();
        onLoginSuccess(verifiedUser, verifiedToken);
        return;
      }
      executeBiometricLogin(employee, score, matchedPose);
      return;
    }

    const timer = setTimeout(() => {
      setPendingLogin(prev => (prev ? { ...prev, countdown: prev.countdown - 1 } : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [pendingLogin]);

  const handleCancelPendingLogin = () => {
    setPendingLogin(null);
    isFaceAuthenticatingRef.current = false;
    setIsFaceAuthenticating(false);
    setRecognitionProgress(0);
    setDetectedCandidate(null);
    setFaceFeedback('Verifikasi dibatalkan. Posisikan wajah kembali.');
  };

  const handleConfirmLoginNow = () => {
    if (!pendingLogin) return;
    const { employee, score, matchedPose, verifiedUser, verifiedToken } = pendingLogin;
    setPendingLogin(null);
    if (verifiedUser && verifiedToken) {
      api.setAuthToken(verifiedToken);
      playTone(1318.51, 'sine', 0.35);
      stopFaceCamera();
      onLoginSuccess(verifiedUser, verifiedToken);
      return;
    }
    executeBiometricLogin(employee, score, matchedPose);
  };

  // Real-time 1:N Facial Recognition Loop for Login (OpenCV YuNet + SFace 128D)
  useEffect(() => {
    if (loginMode !== 'FACE_ID' || !cameraActive || isFaceAuthenticating || pendingLogin) {
      return;
    }

    let isEvaluating = false;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');

    const interval = setInterval(async () => {
      if (isEvaluating || !faceVideoRef.current || faceVideoRef.current.videoWidth === 0 || isFaceAuthenticatingRef.current || pendingLogin) {
        return;
      }
      isEvaluating = true;

      try {
        if (!ctx || !faceVideoRef.current) return;
        ctx.drawImage(faceVideoRef.current, 0, 0, 320, 240);
        const imageB64 = canvas.toDataURL('image/jpeg', 0.65);

        const resp = await fetch('/api/auth/biometric-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageB64 })
        }).then(r => r.json()).catch(() => null);

        if (!resp) {
          setFaceFeedback('Menghubungi AI Face Engine...');
          return;
        }

        if (resp.status === 'NO_FACE') {
          setFaceFeedback('Posisikan Wajah di Depan Kamera');
          setRecognitionProgress(prev => Math.max(0, prev - 25));
          setDetectedCandidate(null);
          return;
        }

        if (resp.status === 'OCCLUDED') {
          setFaceFeedback(resp.message || '⚠️ Wajah terhalang! Perlihatkan seluruh wajah.');
          setRecognitionProgress(0);
          setDetectedCandidate(null);
          return;
        }

        if (resp.status === 'AMBIGUOUS') {
          setFaceFeedback(resp.message || '⚠️ Kemiripan wajah ambigu! Harap login via Email / NIK.');
          setRecognitionProgress(0);
          setDetectedCandidate(null);
          return;
        }

        if (resp.matched && resp.employee && resp.score >= 70) {
          const emp = resp.employee;
          const match = {
            matchedItem: {
              employee: emp,
              employeeName: emp.name,
              employeeId: emp.id,
              employeeNik: emp.nik,
            },
            score: resp.score,
            matchedPose: 'front'
          };
          setDetectedCandidate(match);
          setFaceFeedback(`Wajah Terverifikasi: ${emp.name} (${resp.score}%)`);
          setRecognitionProgress(prev => {
            const next = prev + 50; // Mengunci dalam ~500ms
            if (next >= 100) {
              isFaceAuthenticatingRef.current = true;
              setIsFaceAuthenticating(true);
              playTone(880, 'sine', 0.18);
              setPendingLogin({
                employee: emp,
                score: resp.score,
                matchedPose: 'front',
                countdown: 4,
                verifiedToken: resp.token,
                verifiedUser: resp.user
              });
              return 100;
            }
            if (prev < 50 && next >= 50) {
              playTone(659.25, 'sine', 0.08);
            }
            return next;
          });
        } else {
          setFaceFeedback(resp.score > 35 ? `Mencocokkan biometrik (${resp.score}%)...` : 'Posisikan Wajah di Depan Kamera');
          setRecognitionProgress(prev => {
            const next = Math.max(0, prev - 20);
            if (next === 0) setDetectedCandidate(null);
            return next;
          });
        }
      } catch (e) {
        console.warn('Biometric verify frame error:', e);
      } finally {
        isEvaluating = false;
      }
    }, 250);

    return () => clearInterval(interval);
  }, [loginMode, cameraActive, isFaceAuthenticating, pendingLogin]);

  // Execute Biometric Login on Server
  const executeBiometricLogin = async (emp: any, matchScore: number, matchedPose: any) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await api.loginWithBiometric(emp.id, {
        matchScore,
        matchedPose,
        isVerified: true
      });
      if (res.success && res.user && res.token) {
        playTone(1318.51, 'sine', 0.35); // Celebration chime
        stopFaceCamera();
        onLoginSuccess(res.user, res.token);
      } else {
        setErrorMessage((res as any).error || 'Autentikasi biometrik gagal');
        isFaceAuthenticatingRef.current = false;
        setIsFaceAuthenticating(false);
        setRecognitionProgress(0);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal login biometrik wajah');
      isFaceAuthenticatingRef.current = false;
      setIsFaceAuthenticating(false);
      setRecognitionProgress(0);
    } finally {
      setIsLoading(false);
    }
  };
  
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay handled by muted property
      });
    }
  }, []);

  const handleLogin = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    const loginUser = customUser !== undefined ? customUser : identifier;
    const loginPass = customPass !== undefined ? customPass : password;

    if (!loginUser.trim()) {
      setErrorMessage('Masukkan email atau username');
      return;
    }
    if (!loginPass) {
      setErrorMessage('Masukkan kata sandi');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await api.login(loginUser.trim(), loginPass);
      if (data.success && data.user && data.token) {
        onLoginSuccess(data.user, data.token);
      } else {
        setErrorMessage((data as any).error || 'Autentikasi gagal');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal terhubung ke server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F4F8FE] flex flex-col justify-between selection:bg-[#0066FF] selection:text-white font-sans text-slate-800 relative">
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER                                                             */}
      {/* ========================================================================= */}
      <header className="w-full px-4 sm:px-8 py-3.5 flex items-center justify-between z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0066FF] text-white flex items-center justify-center font-black text-xl shadow-md shadow-blue-500/20">
            P
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-black text-xl tracking-tight text-slate-900">
              PRIME <span className="text-[#0066FF]">HRIS</span>
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-[#0066FF] border border-blue-200">
              Enterprise v2.4
            </span>
          </div>
        </div>


      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN PROPER SPLIT STAGE                                                */}
      {/* ========================================================================= */}
      <main className="flex-1 w-full max-w-[1540px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-14 my-auto">
        
        {/* ----------------------------------------------------------------------- */}
        {/* LEFT COLUMN: THE 3D ECOSYSTEM OPERATIONAL SHOWCASE (SEAMLESS VIDEO)     */}
        {/* ----------------------------------------------------------------------- */}
        <div className="w-full lg:flex-1 flex items-center justify-center relative select-none">
          {/* Ambient Radial Soft Glow */}
          <div className="absolute inset-0 bg-radial from-blue-100/40 via-blue-50/10 to-transparent -z-10 blur-2xl pointer-events-none" />

          {/* Seamless Video Stage (No border, No shadow, No buttons) */}
          <div className="relative w-full max-w-[960px] aspect-video flex items-center justify-center overflow-hidden">
            {/* Background Base matching page */}
            <div className="absolute inset-0 bg-[#F4F8FE] -z-10" />

            {/* Loop Video with feathered radial mask */}
            <video
              ref={videoRef}
              preload="metadata"
              src="/ecosystem_hero.mp4"
              poster="/ecosystem_hero.png"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-contain pointer-events-none select-none"
              style={{
                maskImage: 'radial-gradient(ellipse 96% 92% at 50% 50%, black 80%, transparent 100%)',
                WebkitMaskImage: 'radial-gradient(ellipse 96% 92% at 50% 50%, black 80%, transparent 100%)',
              }}
            />

            {/* Seamless Edge Dissolves (Direct into page background #F4F8FE) */}
            <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-[#F4F8FE] via-[#F4F8FE]/80 to-transparent pointer-events-none z-10" />
            <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#F4F8FE] via-[#F4F8FE]/80 to-transparent pointer-events-none z-10" />
            <div className="absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-[#F4F8FE] via-[#F4F8FE]/80 to-transparent pointer-events-none z-10" />
            <div className="absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-[#F4F8FE] via-[#F4F8FE]/80 to-transparent pointer-events-none z-10" />

            {/* 4 Seamless Corner Dissolves for 100% borderless blend */}
            <div className="absolute top-0 left-0 w-20 h-20 bg-radial from-[#F4F8FE] to-transparent pointer-events-none z-10" />
            <div className="absolute top-0 right-0 w-20 h-20 bg-radial from-[#F4F8FE] to-transparent pointer-events-none z-10" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-radial from-[#F4F8FE] to-transparent pointer-events-none z-10" />
            <div className="absolute bottom-0 right-0 w-20 h-20 bg-radial from-[#F4F8FE] to-transparent pointer-events-none z-10" />
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* RIGHT COLUMN: DEDICATED PROPER ENTERPRISE LOGIN CARD (GAMBAR 2 DESIGN)  */}
        {/* ----------------------------------------------------------------------- */}
        <div className="w-full lg:w-[420px] xl:w-[450px] shrink-0">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-2xl shadow-blue-900/8">
            
            {/* Card Header Typography (Aligned with Gambar 2 Signature Style) */}
            <div className="flex items-start gap-3 mb-6">
              <div className="w-1.5 h-11 bg-gradient-to-b from-[#0066FF] to-blue-700 rounded-full mt-0.5 shrink-0" />
              <div>
                <div className="text-[21px] sm:text-[23px] font-black tracking-tight text-slate-900 leading-none">
                  PRIME HRIS <span className="text-[#0066FF]">ENTERPRISE</span>
                </div>
                <p className="text-[12.5px] text-slate-500 font-medium mt-1.5 leading-snug">
                  Ekosistem SDM Terintegrasi: Presensi Kamera Watermark &amp; Otomasi Penggajian.
                </p>
              </div>
            </div>

            {/* Error Notification */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Mode Switcher Tabs: KATA SANDI vs FACE ID */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200/90 mb-5">
              <button
                type="button"
                onClick={() => { setLoginMode('PASSWORD'); setErrorMessage(null); }}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  loginMode === 'PASSWORD'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>KATA SANDI</span>
              </button>

              <button
                type="button"
                onClick={() => { setLoginMode('FACE_ID'); setErrorMessage(null); }}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  loginMode === 'FACE_ID'
                    ? 'bg-gradient-to-r from-[#0066FF] to-blue-700 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/30'
                    : 'text-slate-500 hover:text-blue-600'
                }`}
              >
                <ScanFace className="w-3.5 h-3.5" />
                <span>LOGIN WAJAH (FACE ID)</span>
              </button>
            </div>

            {loginMode === 'FACE_ID' ? (
              <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                {/* Active Enrolled Badge */}
                <div className="flex items-center justify-between text-[11px] px-1 text-slate-400 max-w-[280px] mx-auto">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Biometrik: <strong className="text-slate-200">{enrolledCount > 0 ? `${enrolledCount} Terdaftar` : "AI SFace Aktif"}</strong>
                  </span>
                  {isIndexingGallery && (
                    <span className="text-amber-400 text-[10px] animate-pulse">Menyelaraskan...</span>
                  )}
                </div>

                {/* Camera Viewfinder Box */}
                <div className="relative w-full max-w-[280px] aspect-[3/4] mx-auto rounded-3xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-xl flex items-center justify-center select-none">
                  <video
                    ref={faceVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-200 ${
                      cameraActive ? 'block opacity-100' : 'hidden opacity-0'
                    }`}
                  />

                  {/* Anti-Salah Orang Confirmation Overlay Gate */}
                  {pendingLogin && (
                    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-30 flex flex-col items-center justify-between p-4 text-center animate-in fade-in zoom-in-95 duration-200">
                      <div className="w-full flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          Konfirmasi Identitas
                        </span>
                        <span className="text-[11px] font-mono font-bold text-slate-300">
                          {pendingLogin.countdown}s
                        </span>
                      </div>

                      <div className="flex flex-col items-center space-y-2 my-auto">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0066FF] to-cyan-400 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-blue-500/30">
                            {pendingLogin.employee.name.split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-slate-900 shadow">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-black text-white leading-tight">
                            {pendingLogin.employee.name}
                          </h4>
                          <p className="text-[11px] font-mono font-semibold text-slate-400 mt-0.5">
                            {pendingLogin.employee.nik}
                          </p>
                          <p className="text-[10.5px] text-blue-400 font-medium">
                            {pendingLogin.employee.position || pendingLogin.employee.department}
                          </p>
                        </div>

                        <div className="px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[10.5px] font-bold text-emerald-300">
                          Akurasi Biometrik: {pendingLogin.score}%
                        </div>
                      </div>

                      <div className="w-full space-y-2">
                        <button
                          type="button"
                          onClick={handleConfirmLoginNow}
                          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-black shadow-lg shadow-emerald-900/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Ya, Masuk Sekarang ({pendingLogin.countdown}s)</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCancelPendingLogin}
                          className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <X className="w-3 h-3 text-rose-400" />
                          <span>✕ Bukan Saya / Batal</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {!cameraActive && (
                    <div className="text-center p-6 space-y-2">
                      <Camera className="w-8 h-8 text-[#0066FF] mx-auto animate-pulse" />
                      <p className="text-xs font-bold text-white">Menghubungkan Kamera...</p>
                      {cameraError && (
                        <p className="text-[11px] text-rose-400 font-semibold px-2">{cameraError}</p>
                      )}
                    </div>
                  )}

                  {cameraActive && (
                    <>
                      {/* Biometric Oval Reticle with dynamic border glow */}
                      <div className={`absolute w-[68%] h-[74%] rounded-[50%] pointer-events-none transition-all duration-300 ${
                        detectedCandidate
                          ? 'border-[3px] border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.6)]'
                          : 'border-2 border-dashed border-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse'
                      }`} />

                      {/* Scanning Laser Beam */}
                      {!detectedCandidate && (
                        <div className="absolute inset-x-8 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent pointer-events-none shadow-[0_0_8px_#06b6d4] animate-pulse" />
                      )}

                      {/* Bottom Status Overlay */}
                      <div className="absolute bottom-2.5 inset-x-2.5 text-center pointer-events-none">
                        {detectedCandidate ? (
                          <div className="px-3 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-400/60 shadow-lg backdrop-blur-md flex items-center justify-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <span className="text-[11px] font-bold text-emerald-300 truncate max-w-[200px]">
                              {detectedCandidate.matchedItem.employeeName} ({detectedCandidate.score}%)
                            </span>
                          </div>
                        ) : (
                          <div className="px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 shadow-md backdrop-blur-md inline-block">
                            <span className="text-[10px] font-mono font-semibold text-slate-200">
                              {isIndexingGallery ? 'Menyiapkan Model Wajah...' : faceFeedback}
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Lock-on Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[11.5px] font-bold text-slate-600 flex items-center gap-1.5">
                      <ScanFace className="w-3.5 h-3.5 text-blue-600" />
                      <span>Verifikasi Biometrik 1:N</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-blue-600">
                      {recognitionProgress}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200/80">
                    <div
                      className={`h-full transition-all duration-200 ${
                        recognitionProgress >= 100
                          ? 'bg-emerald-500'
                          : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                      }`}
                      style={{ width: `${recognitionProgress}%` }}
                    />
                  </div>
                </div>

                {/* Helper notice */}
                <p className="text-[11px] text-center text-slate-500">
                  Arahkan wajah Anda ke lingkaran. Sistem akan mencocokkan wajah dengan profil terdaftar untuk login otomatis.
                </p>

                {/* Back to password button */}
                <button
                  type="button"
                  onClick={() => { setLoginMode('PASSWORD'); setErrorMessage(null); }}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Gunakan Kata Sandi / NIK</span>
                </button>
              </div>
            ) : (
              /* Login Form */
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-600 mb-1.5">
                    Email atau Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="misal: D001, admin, atau galih"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-[13.5px] text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent focus:bg-white transition"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-600 mb-1.5">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi akun"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-[13.5px] text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent focus:bg-white transition"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end -mt-1.5 mb-1">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotIdentifier(identifier || '');
                      setForgotError(null);
                      setForgotSuccess(null);
                      setShowForgotModal(true);
                    }}
                    className="text-[11.5px] font-semibold text-blue-600 hover:text-blue-700 hover:underline transition cursor-pointer"
                  >
                    Lupa Kata Sandi?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#0066FF] to-blue-700 hover:from-blue-600 hover:to-blue-800 active:scale-[0.99] text-white font-extrabold rounded-xl shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 text-[13px] tracking-wide uppercase transition cursor-pointer disabled:opacity-60 mt-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Memverifikasi Akun...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Masuk ke PRIME HRIS</span>
                    </>
                  )}
                </button>
              </form>
            )}


            {/* Security Guarantee Pill */}
            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-medium text-slate-500">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-semibold text-slate-600">Enkripsi Sesi Aktif</span>
              </div>
              <span className="font-mono text-[10.5px] text-slate-400">10-Tier RBAC Protected</span>
            </div>

          </div>
        </div>

      </main>

      {/* ========================================================================= */}
      {/* 3. FOOTER                                                                 */}
      {/* ========================================================================= */}
      <footer className="w-full py-3.5 px-4 text-center text-[11.5px] text-slate-400 border-t border-slate-200/60 bg-white/50 tracking-tight font-medium">
        &copy; 2026 PRIME HRIS ENTERPRISE • PT PRIME INFINITY SYSTEMS • ALL RIGHTS RESERVED
      </footer>

      {/* ========================================================================= */}
      {/* 4. MODAL PEMULIHAN KATA SANDI (MULTI-IDENTIFIER: HP / EMAIL / USERNAME)   */}
      {/* ========================================================================= */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-scaleIn">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50/50 border-b border-blue-100/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-[#0066FF] flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                    Pemulihan Kata Sandi
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    PRIME HRIS Security Gateway
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isForgotLoading) {
                    setShowForgotModal(false);
                    setForgotSuccess(null);
                    setForgotError(null);
                  }
                }}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/80 transition flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {!forgotSuccess ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-blue-900 text-xs leading-relaxed">
                    Masukkan <strong>Nomor WhatsApp</strong>, <strong>Email</strong>, atau <strong>Username/NIK</strong> Anda. Sistem akan memverifikasi dan langsung mengirimkan kata sandi sementara ke kontak terdaftar.
                  </div>

                  {forgotError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-600 mb-1.5">
                      Nomor HP, Email, atau ID / NIK
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={forgotIdentifier}
                        onChange={(e) => setForgotIdentifier(e.target.value)}
                        placeholder="Contoh: 08123456789, admin, atau email@kantor.com"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13.5px] text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:bg-white transition"
                        disabled={isForgotLoading}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      disabled={isForgotLoading}
                      className="w-1/3 py-2.5 px-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isForgotLoading || !forgotIdentifier.trim()}
                      className="w-2/3 py-2.5 px-4 bg-gradient-to-r from-[#0066FF] to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isForgotLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Memproses...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Kirim Password Sementara</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Success View */
                <div className="text-center py-2 space-y-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100 shadow-sm">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>

                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      Password Sementara Berhasil Dikirim!
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                      {forgotSuccess.message || 'Kata sandi sementara telah dikirimkan ke kontak akun Anda.'}
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-left space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400 font-medium">Username / Akun:</span>
                      <span className="font-mono font-bold text-slate-800">{forgotSuccess.username}</span>
                    </div>
                    {forgotSuccess.targetPhone && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 font-medium flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-500" /> WhatsApp:
                        </span>
                        <span className="font-mono font-semibold text-emerald-700">{forgotSuccess.targetPhone}</span>
                      </div>
                    )}
                    {forgotSuccess.targetEmail && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 font-medium flex items-center gap-1">
                          <Mail className="w-3 h-3 text-blue-500" /> Email:
                        </span>
                        <span className="font-mono font-semibold text-blue-700">{forgotSuccess.targetEmail}</span>
                      </div>
                    )}
                    {forgotSuccess.tempPassword && (
                      <div className="pt-2 border-t border-slate-200 mt-2">
                        <span className="text-slate-500 text-[11px] block mb-1">Password Sementara Anda:</span>
                        <div className="bg-amber-50 border border-amber-200 p-2 rounded-lg text-center font-mono font-extrabold text-amber-900 text-sm tracking-wider">
                          {forgotSuccess.tempPassword}
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 italic">
                    Silakan periksa pesan masuk WhatsApp atau Email Anda, lalu login menggunakan password sementara tersebut.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      if (forgotSuccess.username) {
                        setIdentifier(forgotSuccess.username);
                      }
                      setShowForgotModal(false);
                      setForgotSuccess(null);
                    }}
                    className="w-full py-2.5 px-4 bg-[#0066FF] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition cursor-pointer"
                  >
                    Masuk Sekarang
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
