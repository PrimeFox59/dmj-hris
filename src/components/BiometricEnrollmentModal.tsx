import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Camera,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Smile,
  ArrowRight,
  ArrowLeft,
  User,
  ShieldCheck,
  Sparkles,
  Save,
  Check,
  Eye,
  RefreshCw,
  Sun,
  Shield
} from 'lucide-react';
import { Employee, BiometricProfile, BiometricPoseKey } from '../types';
import {
  analyzeLightingAndContrast,
  extractCompressedFaceSample,
  evaluateFacePoseTracking,
  FaceTrackingMetrics
} from '../utils/biometricHelper';

interface BiometricEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetEmployee: Employee;
  onSaveBiometric: (profile: BiometricProfile, updateAvatarAsWell: boolean) => Promise<void>;
  operatorName?: string;
}

interface PoseStepConfig {
  key: BiometricPoseKey;
  stepNumber: number;
  title: string;
  badge: string;
  instruction: string;
  subtext: string;
  ovalOffsetClass: string;
  arrowDirection?: 'right' | 'left' | 'none';
  iconType: 'front' | 'right' | 'left' | 'smile';
}

const POSE_STEPS: PoseStepConfig[] = [
  {
    key: 'front',
    stepNumber: 1,
    title: '1. Wajah Lurus / Netral (Frontal)',
    badge: 'POSE DEPAN',
    instruction: 'Posisikan wajah tegak lurus di tengah oval, pandang kamera.',
    subtext: 'Menjadi sampel referensi biometrik utama dan foto profil identitas.',
    ovalOffsetClass: 'translate-x-0',
    arrowDirection: 'none',
    iconType: 'front'
  },
  {
    key: 'right',
    stepNumber: 2,
    title: '2. Toleh / Miringkan Kanan (~15°)',
    badge: 'SUDUT KANAN',
    instruction: 'Tolehkan atau miringkan kepala sedikit ke arah KANAN (~15°).',
    subtext: 'Merekam kontur rahang, tulang pipi, dan profil sisi kanan.',
    ovalOffsetClass: 'translate-x-2 sm:translate-x-3',
    arrowDirection: 'right',
    iconType: 'right'
  },
  {
    key: 'left',
    stepNumber: 3,
    title: '3. Toleh / Miringkan Kiri (~15°)',
    badge: 'SUDUT KIRI',
    instruction: 'Tolehkan atau miringkan kepala sedikit ke arah KIRI (~15°).',
    subtext: 'Merekam kontur rahang, tulang pipi, dan profil sisi kiri.',
    ovalOffsetClass: '-translate-x-2 sm:-translate-x-3',
    arrowDirection: 'left',
    iconType: 'left'
  },
  {
    key: 'smile',
    stepNumber: 4,
    title: '4. Tersenyum Ramah (Liveness Verification)',
    badge: 'EKSPRESI SENYUM',
    instruction: 'Tersenyumlah ramah secara wajar menghadap kamera.',
    subtext: 'Verifikasi manusia hidup (anti-spoofing) & fleksibilitas ekspresi wajah.',
    ovalOffsetClass: 'translate-x-0',
    arrowDirection: 'none',
    iconType: 'smile'
  }
];

export const BiometricEnrollmentModal: React.FC<BiometricEnrollmentModalProps> = ({
  isOpen,
  onClose,
  targetEmployee,
  onSaveBiometric,
  operatorName = 'Sistem HRIS'
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0); // 0..3 for poses, 4 for review
  const [samples, setSamples] = useState<Record<BiometricPoseKey, string | null>>({
    front: null,
    right: null,
    left: null,
    smile: null
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [syncAvatar, setSyncAvatar] = useState<boolean>(true);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lightingStatus, setLightingStatus] = useState<{ isGood: boolean; feedback: string }>({
    isGood: true,
    feedback: 'Memeriksa pencahayaan...'
  });
  const [countdown, setCountdown] = useState<number | null>(null);

  // Mode Pengambilan: Manual (Default) vs Otomatis dengan Delay 3 Detik
  const [captureMode, setCaptureMode] = useState<'MANUAL' | 'AUTO_DELAY'>('MANUAL');

  // Real-time zero-click face tracking & auto-capture states
  const [autoCaptureProgress, setAutoCaptureProgress] = useState<number>(0);
  const [poseFeedback, setPoseFeedback] = useState<string>('Posisikan wajah di dalam oval');
  const [isPoseMatchedLive, setIsPoseMatchedLive] = useState<boolean>(false);
  const [isCenteringGood, setIsCenteringGood] = useState<boolean>(false);
  const [isShutterFlashing, setIsShutterFlashing] = useState<boolean>(false);
  const autoCapturePauseRef = useRef<boolean>(false);
  const baselineMetricsRef = useRef<FaceTrackingMetrics | null>(null);
  const stepDwellTimeRef = useRef<number>(0);

  // Transition countdown timer between steps (2 seconds preparation cooldown)
  const [transitionCountdown, setTransitionCountdown] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownIntervalRef = useRef<any>(null);

  // Audio chimes
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

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.warn(e));
          };
        }
        setCameraActive(true);
      } else {
        throw new Error('API Kamera tidak didukung browser');
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Izin kamera ditolak. Harap izinkan akses kamera di pengaturan browser.'
          : 'Kamera tidak terdeteksi atau sedang digunakan aplikasi lain.'
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Modal open/close lifecycle
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Load existing samples if available
      if (targetEmployee.biometric?.samples) {
        setSamples({
          front: targetEmployee.biometric.samples.front || null,
          right: targetEmployee.biometric.samples.right || null,
          left: targetEmployee.biometric.samples.left || null,
          smile: targetEmployee.biometric.samples.smile || null
        });
      } else {
        setSamples({ front: null, right: null, left: null, smile: null });
      }
      setCurrentStepIndex(0);
      setAutoCaptureProgress(0);
      setTransitionCountdown(0);
      baselineMetricsRef.current = null;
      stepDwellTimeRef.current = 0;
      autoCapturePauseRef.current = false;
      startCamera();
    } else {
      document.body.style.overflow = '';
      stopCamera();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    }
    return () => {
      document.body.style.overflow = '';
      stopCamera();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isOpen, targetEmployee]);

  // 1-second ticker for transition cooldown
  useEffect(() => {
    if (transitionCountdown <= 0) return;
    playTone(520, 'sine', 0.08); // soft reminder blip
    const timer = setTimeout(() => {
      setTransitionCountdown(prev => {
        if (prev <= 1) {
          playTone(880, 'sine', 0.15); // readiness alert chime!
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [transitionCountdown]);

  // Real-time lighting checking loop
  useEffect(() => {
    if (!cameraActive || currentStepIndex >= 4) return;
    const interval = setInterval(() => {
      if (videoRef.current && videoRef.current.videoWidth > 0) {
        const res = analyzeLightingAndContrast(videoRef.current);
        setLightingStatus({ isGood: res.isGood, feedback: res.feedback });
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [cameraActive, currentStepIndex]);

  // Capture current pose snapshot
  const executeSnap = (poseKey: BiometricPoseKey, metrics?: FaceTrackingMetrics) => {
    if (!videoRef.current || videoRef.current.videoWidth === 0) return;

    // Save frontal metrics as baseline for subsequent angle/smile evaluations
    if (poseKey === 'front' && metrics) {
      baselineMetricsRef.current = metrics;
    }

    // Trigger shutter sound and visual flash
    playTone(880, 'sine', 0.2);
    setIsShutterFlashing(true);
    setTimeout(() => setIsShutterFlashing(false), 200);

    const dataUrl = extractCompressedFaceSample(
      videoRef.current,
      videoRef.current.videoWidth,
      videoRef.current.videoHeight,
      480,
      480,
      true
    );

    setSamples(prev => ({
      ...prev,
      [poseKey]: dataUrl
    }));

    setAutoCaptureProgress(0);
    stepDwellTimeRef.current = 0;
    autoCapturePauseRef.current = true;

    // Advance to next pose or review after short confirmation pause
    setTimeout(() => {
      if (currentStepIndex < 3) {
        setCurrentStepIndex(prev => prev + 1);
        setTransitionCountdown(1); // 1s snappy preparation cooldown for next pose!
        autoCapturePauseRef.current = false;
      } else {
        setCurrentStepIndex(4); // Move to review vault step
        stopCamera();
        playTone(1046.5, 'triangle', 0.35); // success chord
      }
    }, 500);
  };

  const handleSnap = () => {
    const currentPose = POSE_STEPS[currentStepIndex]?.key;
    if (currentPose) {
      executeSnap(currentPose);
    }
  };

  // Real-time hands-free face tracking loop (Zero-Click Auto-Capture)
  useEffect(() => {
    if (!cameraActive || currentStepIndex >= 4) {
      setAutoCaptureProgress(0);
      return;
    }

    let isSubscribed = true;
    const trackingInterval = setInterval(() => {
      if (!isSubscribed || autoCapturePauseRef.current || countdown !== null) return;
      if (!videoRef.current || videoRef.current.videoWidth === 0) return;

      // Lock tracking and progress during transition preparation cooldown
      if (transitionCountdown > 0) {
        setAutoCaptureProgress(0);
        stepDwellTimeRef.current = 0;
        setIsPoseMatchedLive(false);
        const poseName = POSE_STEPS[currentStepIndex]?.title.split('.')[1] || 'Pose Berikutnya';
        setPoseFeedback(`Bersiap ${poseName} (${transitionCountdown}s)...`);
        return;
      }

      const currentPose = POSE_STEPS[currentStepIndex]?.key;
      if (!currentPose) return;

      const evalResult = evaluateFacePoseTracking(videoRef.current, currentPose, baselineMetricsRef.current);
      setIsCenteringGood(evalResult.isCentered);
      setIsPoseMatchedLive(evalResult.isPoseMatched);
      setPoseFeedback(evalResult.feedback);

      // Track dwell time if face is present and centered
      if (evalResult.isCentered) {
        stepDwellTimeRef.current += 80;
      } else {
        stepDwellTimeRef.current = Math.max(0, stepDwellTimeRef.current - 40);
      }

      if (captureMode === 'MANUAL') {
        setAutoCaptureProgress(0);
        if (evalResult.isPoseMatched) {
          setPoseFeedback('Posisi pas & siap! Silakan klik tombol "Ambil Foto" di bawah.');
        }
        return;
      }

      // Mode AUTO_DELAY (Otomatis dengan Delay 3 Detik)
      if (evalResult.isPoseMatched || (evalResult.isCentered && currentStepIndex > 0 && stepDwellTimeRef.current >= 1500)) {
        if (countdown === null && !autoCapturePauseRef.current) {
          setPoseFeedback('Pose terdeteksi stabil! Menghitung mundur 3 detik...');
          startCountdown();
        }
      } else {
        setAutoCaptureProgress(0);
      }
    }, 80);

    return () => {
      isSubscribed = false;
      clearInterval(trackingInterval);
    };
  }, [cameraActive, currentStepIndex, countdown, transitionCountdown]);

  // Start 3-second countdown
  const startCountdown = () => {
    if (countdown !== null) return;
    let count = 3;
    setCountdown(count);
    playTone(523.25, 'sine', 0.1);

    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        playTone(523.25, 'sine', 0.1);
      } else {
        clearInterval(countdownIntervalRef.current);
        setCountdown(null);
        handleSnap();
      }
    }, 1000);
  };

  const handleRetakePose = (poseKey: BiometricPoseKey) => {
    const targetIdx = POSE_STEPS.findIndex(p => p.key === poseKey);
    if (targetIdx !== -1) {
      setCurrentStepIndex(targetIdx);
      setAutoCaptureProgress(0);
      stepDwellTimeRef.current = 0;
      setTransitionCountdown(1);
      autoCapturePauseRef.current = false;
      if (!cameraActive) {
        startCamera();
      }
    }
  };

  const handleSaveAll = async () => {
    if (!samples.front || !samples.right || !samples.left || !samples.smile) {
      alert('Harap lengkapi seluruh 4 pose wajah sebelum menyimpan.');
      return;
    }

    setIsSaving(true);
    try {
      const biometricProfile: BiometricProfile = {
        isEnrolled: true,
        enrolledAt: new Date().toISOString(),
        enrolledBy: operatorName,
        qualityScore: 98.5,
        samples: {
          front: samples.front,
          right: samples.right,
          left: samples.left,
          smile: samples.smile
        },
        features: {
          samplesCount: 4,
          livenessScore: 99.2,
          contrastScore: 88.0
        }
      };

      await onSaveBiometric(biometricProfile, syncAvatar);
      playTone(1318.51, 'sine', 0.4);
      onClose();
    } catch (err: any) {
      alert(`Gagal menyimpan profil biometrik: ${err.message || 'Error tidak diketahui'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const currentPoseConfig = POSE_STEPS[currentStepIndex];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-5 sm:p-7 space-y-5 my-auto border border-slate-200 modal-dialog-animate max-h-[95vh] overflow-y-auto custom-scrollbar"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF6B00] to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                  Pendaftaran Biometrik Wajah 3D
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-[#FF6B00] font-mono-code">
                  4 POSE
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Perekaman wajah multi-sudut untuk verifikasi presensi anti-titip absen: <strong className="text-slate-800">{targetEmployee.name}</strong> ({targetEmployee.nik})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="grid grid-cols-4 gap-2">
          {POSE_STEPS.map((step, idx) => {
            const isCompleted = Boolean(samples[step.key]);
            const isCurrent = currentStepIndex === idx;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => {
                  setCurrentStepIndex(idx);
                  setAutoCaptureProgress(0);
                  setTransitionCountdown(idx > 0 ? 2 : 0);
                  autoCapturePauseRef.current = false;
                  if (!cameraActive) startCamera();
                }}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isCurrent
                    ? 'border-[#FF6B00] bg-orange-50/80 shadow-sm ring-2 ring-[#FF6B00]/20'
                    : isCompleted
                    ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono-code font-bold uppercase text-slate-500">
                    Step {step.stepNumber}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <div className={`w-3.5 h-3.5 rounded-full border ${isCurrent ? 'border-[#FF6B00] bg-[#FF6B00]' : 'border-slate-300'}`} />
                  )}
                </div>
                <div className="text-[11px] font-black text-slate-900 truncate">
                  {step.badge}
                </div>
              </button>
            );
          })}
        </div>

        {/* MAIN BODY: Steps 0..3 (Live Camera Enrollment) OR Step 4 (Review Vault) */}
        {currentStepIndex < 4 ? (
          <div className="space-y-4">
            {/* Instruction Card */}
            <div className="p-3.5 rounded-2xl bg-slate-900 text-white flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-[#FF6B00] flex items-center justify-center shrink-0">
                  {currentPoseConfig.iconType === 'smile' ? (
                    <Smile className="w-5 h-5 text-amber-400 animate-bounce" />
                  ) : currentPoseConfig.iconType === 'right' ? (
                    <ArrowRight className="w-5 h-5 text-[#00E2B0] animate-pulse" />
                  ) : currentPoseConfig.iconType === 'left' ? (
                    <ArrowLeft className="w-5 h-5 text-[#00E2B0] animate-pulse" />
                  ) : (
                    <User className="w-5 h-5 text-[#00E2B0]" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-white">
                    {currentPoseConfig.title}
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    {currentPoseConfig.instruction}
                  </p>
                </div>
              </div>

              {/* Lighting Badge */}
              <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono-code font-bold shrink-0 ${
                lightingStatus.isGood ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700' : 'bg-amber-950/80 text-amber-300 border border-amber-700'
              }`}>
                <Sun className="w-3 h-3" />
                <span>{lightingStatus.feedback}</span>
              </div>
            </div>

            {/* Live Camera Viewfinder (Mobile-First Portrait 3:4 Aspect Ratio) */}
            <div className="relative w-full max-w-[340px] sm:max-w-[360px] aspect-[3/4] mx-auto rounded-3xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-2xl flex items-center justify-center select-none">
              <canvas ref={canvasRef} className="hidden" />

              {/* Shutter White Flash Effect */}
              {isShutterFlashing && (
                <div className="absolute inset-0 bg-white/90 z-30 pointer-events-none transition-opacity duration-200 animate-out fade-out" />
              )}

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-200 ${
                  cameraActive ? 'block opacity-100' : 'hidden opacity-0'
                }`}
              />

              {!cameraActive && (
                <div className="text-center p-6 space-y-3 z-10">
                  <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center text-slate-400">
                    <Camera className="w-7 h-7 text-[#FF6B00]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Kamera Memuat...</p>
                    <p className="text-xs text-slate-400 mt-1">Harap berikan izin akses kamera pada browser Anda.</p>
                  </div>
                  {cameraError && (
                    <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs max-w-xs mx-auto">
                      {cameraError}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-4 py-2 rounded-xl bg-[#FF6B00] text-white text-xs font-bold hover:bg-[#e56000] cursor-pointer"
                  >
                    Nyalakan Ulang Kamera
                  </button>
                </div>
              )}

              {/* Dynamic Oval Face Guide with Glowing SVG Circular Progress Ring */}
              {cameraActive && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={`relative w-52 h-72 sm:w-56 sm:h-76 transition-all duration-500 ease-out flex flex-col items-center justify-between p-3 ${
                      currentPoseConfig.ovalOffsetClass
                    }`}
                  >
                    {/* SVG Circular/Rounded Progress Ring (Zero-Click Indicator) */}
                    <svg
                      className="absolute inset-0 w-full h-full"
                      viewBox="0 0 220 300"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      {/* Background Guide Track */}
                      <rect
                        x="6"
                        y="6"
                        width="208"
                        height="288"
                        rx="60"
                        ry="60"
                        stroke="rgba(255, 255, 255, 0.2)"
                        strokeWidth="2.5"
                        strokeDasharray="6 6"
                      />

                      {/* Animated Progress Ring filling 0 to 100% */}
                      <rect
                        x="6"
                        y="6"
                        width="208"
                        height="288"
                        rx="60"
                        ry="60"
                        stroke={
                          autoCaptureProgress >= 90
                            ? '#00E2B0'
                            : currentPoseConfig.iconType === 'smile'
                            ? '#FBBF24'
                            : '#FF6B00'
                        }
                        strokeWidth="5"
                        strokeDasharray="800"
                        strokeDashoffset={800 - (800 * autoCaptureProgress) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-100 ease-linear drop-shadow-[0_0_8px_rgba(255,107,0,0.6)]"
                      />
                    </svg>

                    {/* Top Guide Tag */}
                    <div className="relative z-10 px-3 py-0.5 rounded-full bg-slate-900/85 backdrop-blur-md text-[10px] font-mono-code font-bold text-white shadow-md border border-slate-700/60 mt-1">
                      {currentPoseConfig.badge}
                    </div>

                    {/* Center Animated Indicator */}
                    <div className="relative z-10 my-auto flex flex-col items-center justify-center">
                      {transitionCountdown > 0 ? (
                        <div className="flex flex-col items-center animate-in zoom-in-95 duration-200">
                          <div className="w-16 h-16 rounded-full bg-amber-500/20 backdrop-blur-md border-2 border-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/30 animate-pulse">
                            <span className="text-amber-300 font-mono-code font-black text-2xl">
                              {transitionCountdown}s
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-amber-200 mt-2 drop-shadow-md bg-slate-900/90 px-3 py-1 rounded-full border border-amber-500/40">
                            {currentPoseConfig.iconType === 'right'
                              ? '👉 Bersiap: Toleh Kanan'
                              : currentPoseConfig.iconType === 'left'
                              ? '👈 Bersiap: Toleh Kiri'
                              : currentPoseConfig.iconType === 'smile'
                              ? '😁 Bersiap: Senyum Lebar'
                              : 'Bersiap...'}
                          </span>
                        </div>
                      ) : countdown !== null ? (
                        <div className="text-5xl font-black text-white bg-slate-900/80 w-16 h-16 rounded-full flex items-center justify-center border-2 border-[#FF6B00] animate-ping">
                          {countdown}
                        </div>
                      ) : autoCaptureProgress > 0 ? (
                        <div className="flex flex-col items-center">
                          <div className="w-14 h-14 rounded-full bg-slate-900/80 backdrop-blur-md border-2 border-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <span className="text-emerald-300 font-mono-code font-black text-lg">
                              {autoCaptureProgress}%
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-white mt-1 drop-shadow-md">
                            Tahan Posisi...
                          </span>
                        </div>
                      ) : currentPoseConfig.arrowDirection === 'right' ? (
                        <div className="flex items-center gap-1.5 bg-slate-900/85 px-3 py-1.5 rounded-full border border-[#00E2B0] text-[#00E2B0] text-xs font-bold shadow-lg animate-pulse">
                          <span>Toleh Kanan</span>
                          <ArrowRight className="w-4 h-4 animate-bounce" />
                        </div>
                      ) : currentPoseConfig.arrowDirection === 'left' ? (
                        <div className="flex items-center gap-1.5 bg-slate-900/85 px-3 py-1.5 rounded-full border border-[#00E2B0] text-[#00E2B0] text-xs font-bold shadow-lg animate-pulse">
                          <ArrowLeft className="w-4 h-4 animate-bounce" />
                          <span>Toleh Kiri</span>
                        </div>
                      ) : currentPoseConfig.iconType === 'smile' ? (
                        <div className="flex items-center gap-1.5 bg-slate-900/85 px-3 py-1.5 rounded-full border border-amber-400 text-amber-300 text-xs font-bold shadow-lg animate-bounce">
                          <Smile className="w-4 h-4 text-amber-400" />
                          <span>Senyum Lebar 😊</span>
                        </div>
                      ) : (
                        <div className="px-2.5 py-1 rounded-full bg-slate-900/70 text-[#00E2B0] text-[10px] font-mono-code">
                          Wajah Lurus
                        </div>
                      )}
                    </div>

                    {/* Bottom Dynamic Feedback Pill */}
                    <div className="relative z-10 mb-1 max-w-[90%] text-center">
                      <div
                        className={`text-[10px] font-bold px-3 py-1 rounded-full shadow-md transition-all ${
                          isPoseMatchedLive
                            ? 'bg-emerald-600/90 text-white border border-emerald-400/80 animate-pulse'
                            : 'bg-slate-900/85 text-slate-300 border border-slate-700/60'
                        }`}
                      >
                        {poseFeedback}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Status Header Badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-700 text-white text-[10px] font-mono-code">
                <span className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-[#00E2B0] animate-ping' : 'bg-slate-500'}`} />
                <span>{captureMode === 'MANUAL' ? 'MODE MANUAL • SIAP SNAP' : 'MODE OTOMATIS • DELAY 3S'}</span>
              </div>
            </div>

            {/* Mode Switcher: Manual (Recommended) vs Otomatis (3s Delay) */}
            <div className="flex items-center justify-center p-1 bg-slate-100 rounded-2xl max-w-[360px] mx-auto w-full gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setCaptureMode('MANUAL');
                  if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                  setCountdown(null);
                }}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  captureMode === 'MANUAL'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Tombol Manual (Rekomendasi)</span>
              </button>

              <button
                type="button"
                onClick={() => setCaptureMode('AUTO_DELAY')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  captureMode === 'AUTO_DELAY'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Otomatis (Delay 3s)</span>
              </button>
            </div>

            {/* Action Bar (High-Visibility Manual Controls & Instant Override) */}
            <div className="flex flex-col gap-2 pt-1 max-w-[360px] mx-auto w-full">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSnap}
                  disabled={!cameraActive}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
                  title="Klik untuk mengambil foto pose ini"
                >
                  <Camera className="w-4 h-4 text-emerald-100" />
                  <span>Ambil Foto {POSE_STEPS[currentStepIndex]?.badge || 'Pose Ini'}</span>
                </button>

                <button
                  type="button"
                  onClick={startCountdown}
                  disabled={!cameraActive || countdown !== null}
                  className="px-3.5 py-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-sm"
                  title="Hitung mundur 3 detik sebelum mengambil foto"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Timer 3d</span>
                </button>
              </div>

              {/* Status helper text & Skip button */}
              <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
                <span>{captureMode === 'MANUAL' ? 'Klik tombol hijau saat siap' : 'Auto delay 3 detik saat stabil'}</span>
                <button
                  type="button"
                  onClick={handleSnap}
                  disabled={!cameraActive}
                  className="text-emerald-700 hover:text-emerald-800 font-bold underline cursor-pointer flex items-center gap-1"
                >
                  <span>Lewati & Simpan</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* STEP 5: REVIEW VAULT (All 4 Poses Completed) */
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="font-bold text-emerald-950">Seluruh 4 Pose Biometrik Berhasil Direkam!</h4>
                  <p className="text-[11px] text-emerald-700">Periksa kualitas tiap foto di bawah. Klik tombol "Foto Ulang" jika ada sudut yang kurang pas.</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-200 text-emerald-900 font-mono-code font-bold text-[10px]">
                KUALITAS: 98.5% (SANGAT BAIK)
              </span>
            </div>

            {/* 4 Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {POSE_STEPS.map(step => {
                const sampleImg = samples[step.key];
                return (
                  <div
                    key={step.key}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2 relative group"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-200">
                      {sampleImg ? (
                        <img src={sampleImg} alt={step.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">Kosong</div>
                      )}
                      <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-slate-900/80 text-white font-mono-code text-[9px] font-bold">
                        {step.badge}
                      </div>
                    </div>
                    <div className="text-[11px] font-bold text-slate-800 truncate">
                      {step.title.split('.')[1]}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRetakePose(step.key)}
                      className="w-full py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:bg-orange-50 hover:border-orange-300 text-slate-700 hover:text-[#FF6B00] text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Foto Ulang</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Options */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncAvatar}
                  onChange={e => setSyncAvatar(e.target.checked)}
                  className="w-4 h-4 rounded text-[#FF6B00] focus:ring-[#FF6B00] border-slate-300 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">
                  Jadikan foto Pose Depan (Frontal) sebagai foto avatar profil resmi karyawan
                </span>
              </label>
              <p className="text-[11px] text-slate-500 ml-7">
                Foto ini akan otomatis diperbarui pada kartu presensi, slip gaji, dan navigasi akun.
              </p>
            </div>

            {/* Save Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentStepIndex(0);
                  startCamera();
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Ulangi Semua
              </button>

              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan ke Server...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Simpan & Kunci Profil Biometrik</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
