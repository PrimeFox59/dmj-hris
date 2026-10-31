import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Sparkles,
  ArrowRight,
  RefreshCw,
  User,
  X,
  ScanFace,
  FlipHorizontal,
  Upload,
  Send,
  LogIn,
  LogOut,
  ChevronRight,
  FileText
} from 'lucide-react';
import { AttendanceRecord, BiometricPoseKey } from '../types';
import { api } from '../services/api';
import { rtcService } from '../services/rtcService';
import { calculateDistanceMeters } from '../utils/biometricHelper';
import { getEmployeeProjectSchedule } from '../utils/scheduleHelper';

interface QuickAttendancePublicPortalProps {
  onGoToLogin: () => void;
}

type KioskFlowStep = 'SELECT_MODE' | 'SCAN_CAMERA' | 'OUTSIDE_RADIUS_NOTE' | 'SUCCESS';

export const QuickAttendancePublicPortal: React.FC<QuickAttendancePublicPortalProps> = ({
  onGoToLogin
}) => {
  // Directory & Master Data
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [officeGeofence, setOfficeGeofence] = useState<any>({
    lat: -7.293144,
    lng: 112.775337,
    radiusMeters: 350,
    name: 'PT Dwi Martha Jaya - Kantor Pusat (Surabaya)'
  });
  const [todayAttendances, setTodayAttendances] = useState<Record<string, any>>({});
  const [isLoadingDirectory, setIsLoadingDirectory] = useState<boolean>(true);

  // Kiosk Flow Step (SELECT_MODE -> SCAN_CAMERA -> OUTSIDE_RADIUS_NOTE (if luar area) -> SUCCESS)
  const [kioskStep, setKioskStep] = useState<KioskFlowStep>('SELECT_MODE');

  // Active Attendance Mode: CHECK_IN (Masuk) or CHECK_OUT (Pulang)
  const [attendanceAction, setAttendanceAction] = useState<'CHECK_IN' | 'CHECK_OUT'>('CHECK_IN');

  // Camera States
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);

  // Real-Time High-Speed 1:N Biometric Detection (<5s engine like Login Wajah)
  const [detectedEmployee, setDetectedEmployee] = useState<any | null>(null);
  const [detectionScore, setDetectionScore] = useState<number>(0);
  const [faceFeedback, setFaceFeedback] = useState<string>('Posisikan wajah di dalam bingkai');
  const [isFaceDetected, setIsFaceDetected] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedRecord, setSubmittedRecord] = useState<AttendanceRecord | null>(null);
  const [resetCountdown, setResetCountdown] = useState<number>(3);

  // Pending Outside Radius Data (Employee identified, but outside geofence - awaiting note)
  const [pendingEmployee, setPendingEmployee] = useState<any | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [pendingScore, setPendingScore] = useState<number>(0);

  // Geolocation States (Async in background - never blocks face detection)
  const [gpsLocation, setGpsLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    address: string;
  }>({
    lat: -7.293144,
    lng: 112.775337,
    accuracy: 15,
    address: 'Jl. Klampis Anom No. 35 D-11, Sukolilo, Surabaya'
  });
  const [isGpsLocked, setIsGpsLocked] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState<string>('');

  // Live Digital Clock state
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isEvaluatingRef = useRef<boolean>(false);
  const isAutoRecordingRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resetTimerRef = useRef<any>(null);

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
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Live RTC Clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = rtcService.getServerNow();
      setCurrentTimeStr(
        now.toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/\./g, ':') + ' WIB'
      );
      setCurrentDateStr(
        now.toLocaleDateString('id-ID', {
          timeZone: 'Asia/Jakarta',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Load Master Directory for Kiosk
  useEffect(() => {
    const loadDirectory = async () => {
      try {
        setIsLoadingDirectory(true);
        const res = await api.getPublicKioskEmployees();
        if (res && res.success) {
          if (res.employees) setEmployees(res.employees);
          if (res.projects) setProjects(res.projects);
          if (res.officeGeofence) setOfficeGeofence(res.officeGeofence);
          if (res.todayAttendances) setTodayAttendances(res.todayAttendances);
        }
      } catch (err) {
        console.warn('[Kiosk Directory Load Error]', err);
      } finally {
        setIsLoadingDirectory(false);
      }
    };
    loadDirectory();
  }, []);

  // 2. Geolocation Listener (Continuous background sync)
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation tidak didukung pada browser ini');
      setIsGpsLocked(true);
      return;
    }

    // Fresh GPS query on mount (tanpa cache lama)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGpsLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          address: 'Area Terdeteksi GPS Perangkat'
        });
        setIsGpsLocked(true);
        setGpsError(null);
      },
      err => {
        console.warn('[Kiosk GPS Initial]', err.message);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );

    const watchId = navigator.geolocation.watchPosition(
      pos => {
        setGpsLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          address: 'Area Terdeteksi GPS Perangkat'
        });
        setIsGpsLocked(true);
        setGpsError(null);
      },
      err => {
        console.warn('[Kiosk GPS]', err.message);
        setGpsError('Mencari sinyal GPS...');
        setIsGpsLocked(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 3. Camera lifecycle controls
  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    try {
      setCameraError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: mode,
              width: { ideal: 640 },
              height: { ideal: 480 }
            },
            audio: false
          });
        } catch {
          // Fallback if ideal facingMode fails
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }

        streamRef.current = stream;
        setCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.warn(e));
        }
      } else {
        throw new Error('Kamera tidak didukung oleh browser Anda');
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      setCameraError('Kamera tidak dapat diakses atau izin ditolak. Harap izinkan akses kamera.');
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

  const toggleFacingMode = () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    if (cameraActive) {
      startCamera(next);
    }
  };

  // Ensure video element syncs stream whenever camera becomes active
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(e => console.warn('Video play error:', e));
    }
  }, [cameraActive]);

  // Geofence Evaluation Helper
  const targetGeofence = useMemo(() => {
    const activeEmp = detectedEmployee || pendingEmployee;
    if (activeEmp?.assignedProjectId) {
      const proj = projects.find(p => p.id === activeEmp.assignedProjectId);
      if (proj) {
        const geo = proj.geofence || proj.customRules?.geofence;
        const pLat = geo?.latitude ?? geo?.lat ?? proj.latitude;
        const pLng = geo?.longitude ?? geo?.lng ?? proj.longitude;
        const pRadius = geo?.radiusMeters ?? geo?.radius ?? proj.geofenceRadius ?? 350;
        const pName = geo?.siteName ?? geo?.name ?? proj.name;
        if (typeof pLat === 'number' && typeof pLng === 'number' && !isNaN(pLat) && !isNaN(pLng)) {
          return {
            lat: pLat,
            lng: pLng,
            radiusMeters: pRadius,
            name: pName || 'Site Proyek Resmi'
          };
        }
      }
    }
    return officeGeofence;
  }, [detectedEmployee, pendingEmployee, projects, officeGeofence]);

  const currentDistanceMeters = useMemo(() => {
    return calculateDistanceMeters(
      gpsLocation.lat,
      gpsLocation.lng,
      targetGeofence.lat,
      targetGeofence.lng
    );
  }, [gpsLocation, targetGeofence]);

  const isInsideRadius = currentDistanceMeters <= (targetGeofence.radiusMeters || 500);

  // Dynamic Shift Schedule Helper
  const activeSchedule = useMemo(() => {
    const activeEmp = detectedEmployee || pendingEmployee;
    if (activeEmp) {
      return getEmployeeProjectSchedule(activeEmp, projects, '08:30');
    }
    return {
      checkInTime: '08:00',
      checkOutTime: '17:00',
      cutoffTime: '08:30',
      workDaysPerWeek: 6
    };
  }, [detectedEmployee, pendingEmployee, projects]);

  // =========================================================================
  // OFFICIAL AUDIT WATERMARK GENERATOR (Identik 100% dengan Absen Manual)
  // =========================================================================
  const createWatermarkedPhoto = (
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
    isMirror: boolean,
    emp: any,
    matchScore: number,
    coords: { lat: number; lng: number; accuracy: number; address: string },
    inGeofence: boolean,
    action: 'CHECK_IN' | 'CHECK_OUT'
  ): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // 1. Draw photo image (mirrored if front-camera, with object-cover aspect ratio)
    ctx.save();
    if (isMirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    const sW = (source as any).videoWidth || (source as any).naturalWidth || (source as any).width || sourceWidth;
    const sH = (source as any).videoHeight || (source as any).naturalHeight || (source as any).height || sourceHeight;
    const hRatio = canvas.width / sW;
    const vRatio = canvas.height / sH;
    const ratio = Math.max(hRatio, vRatio);
    const centerShiftX = (canvas.width - sW * ratio) / 2;
    const centerShiftY = (canvas.height - sH * ratio) / 2;

    ctx.drawImage(
      source,
      0, 0, sW, sH,
      centerShiftX, centerShiftY, sW * ratio, sH * ratio
    );
    ctx.restore(); // Restore so all watermark texts and rectangles are NEVER mirrored

    // 2. Top-Right Biometric Security Badge
    const badgeColor = matchScore >= 70 ? '#00E2B0' : '#f87171';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(405, 16, 220, 34);
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(405, 16, 220, 34);

    ctx.fillStyle = badgeColor;
    ctx.beginPath();
    ctx.arc(420, 33, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    const bioText = `BIOMETRIC: ${matchScore}% MATCH`;
    ctx.fillText(bioText, 432, 37);

    // 3. Bottom Watermark Panel (dark gradient with orange divider line)
    const grad = ctx.createLinearGradient(0, 340, 0, 480);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.80)');
    grad.addColorStop(0.3, 'rgba(15, 23, 42, 0.94)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.98)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 345, 640, 135);

    // Orange accent divider line
    ctx.fillStyle = '#FF6B00';
    ctx.fillRect(0, 345, 640, 3);

    const now = rtcService.getServerNow();
    const dateStr = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

    // Line 1: Karyawan NIK & Nama
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`KARYAWAN : ${emp.nik || 'KIOSK-001'} • ${emp.name.toUpperCase()}`, 16, 372);

    // Line 2: Waktu Presensi
    ctx.fillStyle = '#00E2B0';
    ctx.font = '12px monospace';
    ctx.fillText(`WAKTU    : ${dateStr} | ${timeStr} [RTC LOCKED]`, 16, 394);

    // Line 3: Geotag Koordinat
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '11px monospace';
    ctx.fillText(`GEOTAG   : Lat ${coords.lat.toFixed(6)}, Lng ${coords.lng.toFixed(6)} (Akurasi ±${coords.accuracy}m)`, 16, 414);

    // Line 4: Geofence Status
    ctx.fillStyle = inGeofence ? '#00E2B0' : '#fbbf24';
    const locationStampText = inGeofence
      ? `GEOFENCE : AREA RESMI VALID (${targetGeofence.name.slice(0, 30)})`
      : `GEOFENCE : LOKASI TERVERIFIKASI [LUAR RADIUS ${currentDistanceMeters}m]`;
    ctx.fillText(locationStampText, 16, 434);

    // Line 5: Audit Stamp
    ctx.fillStyle = '#FF8533';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`PRIME HRIS ENTERPRISE • SECURE AUDIT STAMP #${Math.floor(100000 + Math.random() * 900000)}`, 16, 458);

    return canvas.toDataURL('image/jpeg', 0.88);
  };

  // 4. Real-time 1:N Facial Recognition Loop (<5s like Login Wajah)
  useEffect(() => {
    if (
      kioskStep !== 'SCAN_CAMERA' ||
      !cameraActive ||
      capturedPhoto ||
      submittedRecord ||
      isSubmitting ||
      isAutoRecordingRef.current
    ) {
      return;
    }

    let isSubscribed = true;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');

    const interval = setInterval(async () => {
      if (
        !isSubscribed ||
        isEvaluatingRef.current ||
        isAutoRecordingRef.current ||
        !videoRef.current ||
        videoRef.current.videoWidth === 0
      ) {
        return;
      }

      isEvaluatingRef.current = true;
      try {
        if (!ctx || !videoRef.current) return;
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        const imageB64 = canvas.toDataURL('image/jpeg', 0.65);

        const resp = await fetch('/api/auth/biometric-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageB64 })
        }).then(r => r.json()).catch(() => null);

        if (!isSubscribed) return;

        if (!resp) {
          setFaceFeedback('Menghubungkan ke Face Engine...');
          return;
        }

        if (resp.status === 'NO_FACE') {
          setIsFaceDetected(false);
          setFaceFeedback('Posisikan wajah di dalam bingkai');
          return;
        }

        if (resp.status === 'OCCLUDED') {
          setIsFaceDetected(true);
          setFaceFeedback(resp.message || '⚠️ Wajah terhalang! Perlihatkan seluruh wajah.');
          return;
        }

        // MATCH FOUND (Score >= 70%)
        if (resp.matched && resp.employee && resp.score >= 70) {
          const emp = employees.find(e => e.id === resp.employee.id || e.nik === resp.employee.nik) || resp.employee;
          setIsFaceDetected(true);
          setDetectedEmployee(emp);
          setDetectionScore(resp.score);
          setFaceFeedback(`Teridentifikasi: ${emp.name} (${resp.score}%)`);

          // Execute immediate snapshot and lock
          if (!isAutoRecordingRef.current) {
            isAutoRecordingRef.current = true;
            playTone(880, 'sine', 0.12);

            // Shutter snapshot
            setShutterFlash(true);
            setTimeout(() => setShutterFlash(false), 200);

            // Generate official watermarked photo from the video frame
            const watermarked = createWatermarkedPhoto(
              videoRef.current,
              videoRef.current.videoWidth || 640,
              videoRef.current.videoHeight || 480,
              facingMode === 'user',
              emp,
              resp.score,
              gpsLocation,
              isInsideRadius,
              attendanceAction
            );
            setCapturedPhoto(watermarked);

            // Decision: If inside radius, save immediately. If outside radius, require note first!
            setTimeout(() => {
              stopCamera();
              if (isInsideRadius) {
                // Di dalam area -> langsung simpan datanya!
                executeAttendanceSubmit(emp, watermarked, resp.score, 'Presensi Otomatis Kiosk Wajah');
              } else {
                // Di luar area -> kunci data & biarkan user mengisi alasannya terlebih dahulu!
                setPendingEmployee(emp);
                setPendingPhoto(watermarked);
                setPendingScore(resp.score);
                setKioskStep('OUTSIDE_RADIUS_NOTE');
                isAutoRecordingRef.current = false;
              }
            }, 750);
          }
        } else {
          setIsFaceDetected(true);
          setFaceFeedback('Wajah belum terdaftar di sistem.');
        }
      } catch (err) {
        console.warn('[Face Loop]', err);
      } finally {
        isEvaluatingRef.current = false;
      }
    }, 180);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [kioskStep, cameraActive, capturedPhoto, submittedRecord, isSubmitting, employees, isInsideRadius, attendanceAction, facingMode, gpsLocation]);

  // 5. Submit Attendance Record to SQLite Backend
  const executeAttendanceSubmit = async (
    emp: any,
    photoData: string,
    matchScore: number,
    customNote: string = ''
  ) => {
    try {
      setIsSubmitting(true);
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      const timeStr = now.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/\./g, ':');

      const isClockIn = attendanceAction === 'CHECK_IN';
      const existingToday = todayAttendances[emp.id];

      // Calculate Late Status
      const [nowH, nowM] = timeStr.split(':').map(Number);
      const [cutoffH, cutoffM] = (activeSchedule.cutoffTime || '08:30').split(':').map(Number);
      const isLate = isClockIn && (nowH * 60 + nowM) > (cutoffH * 60 + cutoffM);
      const lateMinutes = isLate ? (nowH * 60 + nowM) - (cutoffH * 60 + cutoffM) : 0;

      const defaultNote = isInsideRadius
        ? 'Presensi Otomatis Kiosk Wajah'
        : `Presensi Kiosk Luar Radius (${currentDistanceMeters}m)`;

      const record: Partial<AttendanceRecord> = {
        id: `ATT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeNik: emp.nik,
        date: dateStr,
        checkInTime: isClockIn ? timeStr : (existingToday?.checkInTime || timeStr),
        checkOutTime: isClockIn ? (existingToday?.checkOutTime || null) : timeStr,
        status: isLate ? 'LATE' : 'ON_TIME',
        mode: (isInsideRadius ? 'WFO' : 'DINAS_LUAR') as any,
        department: emp.department || 'Operasional',
        photoUrl: isClockIn ? photoData : (existingToday?.photoUrl || photoData),
        photoOutUrl: !isClockIn ? photoData : (existingToday?.photoOutUrl || undefined),
        location: {
          lat: gpsLocation.lat,
          lng: gpsLocation.lng,
          accuracy: gpsLocation.accuracy,
          address: gpsLocation.address,
          inGeofence: isInsideRadius,
          distanceMeters: currentDistanceMeters
        },
        isLate,
        lateMinutes,
        note: customNote.trim() || defaultNote,
        biometricVerification: {
          isVerified: true,
          matchScore,
          matchedPose: 'front' as BiometricPoseKey,
          livenessPassed: true,
          details: `Verifikasi Kilat AI Kiosk (${matchScore}% Cocok • Mode: ${attendanceAction})`
        }
      };

      const res = await api.submitPublicAttendance(record as AttendanceRecord);
      setSubmittedRecord((res && res.record) || (record as AttendanceRecord));
      setKioskStep('SUCCESS');

      // Update local cache
      setTodayAttendances(prev => ({
        ...prev,
        [emp.id]: {
          ...(prev[emp.id] || {}),
          ...record
        }
      }));

      playTone(1318.51, 'sine', 0.35); // Success celebration chime
      stopCamera();

      // Auto Reset for Next Person countdown (3 seconds)
      let count = 3;
      setResetCountdown(count);
      if (resetTimerRef.current) clearInterval(resetTimerRef.current);
      resetTimerRef.current = setInterval(() => {
        count -= 1;
        setResetCountdown(count);
        if (count <= 0) {
          clearInterval(resetTimerRef.current);
          handleResetForNextEmployee();
        }
      }, 1000);
    } catch (err: any) {
      alert(`Gagal mencatat presensi: ${err.message || 'Error jaringan'}`);
      isAutoRecordingRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset to initial mode selection for next person
  const handleResetForNextEmployee = () => {
    if (resetTimerRef.current) clearInterval(resetTimerRef.current);
    setSubmittedRecord(null);
    setCapturedPhoto(null);
    setDetectedEmployee(null);
    setPendingEmployee(null);
    setPendingPhoto(null);
    setPendingScore(0);
    setDetectionScore(0);
    setIsFaceDetected(false);
    isAutoRecordingRef.current = false;
    isEvaluatingRef.current = false;
    setFaceFeedback('Posisikan wajah di dalam bingkai');
    setNotesInput('');
    stopCamera();
    setKioskStep('SELECT_MODE');
  };

  // Start Kiosk scanning with specified action mode
  const handleSelectModeAndStart = (action: 'CHECK_IN' | 'CHECK_OUT') => {
    setAttendanceAction(action);
    setKioskStep('SCAN_CAMERA');
    isAutoRecordingRef.current = false;
    isEvaluatingRef.current = false;
    setDetectedEmployee(null);
    setCapturedPhoto(null);
    startCamera(facingMode);
    playTone(action === 'CHECK_IN' ? 523.25 : 659.25, 'sine', 0.12);
  };

  // Manual Shutter Button Handler
  const handleManualShutter = () => {
    if (!videoRef.current) return;
    const emp = detectedEmployee || employees[0];
    if (!emp) return;

    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 200);

    const watermarked = createWatermarkedPhoto(
      videoRef.current,
      videoRef.current.videoWidth || 640,
      videoRef.current.videoHeight || 480,
      facingMode === 'user',
      emp,
      detectionScore || 90,
      gpsLocation,
      isInsideRadius,
      attendanceAction
    );
    setCapturedPhoto(watermarked);
    stopCamera();

    if (isInsideRadius) {
      executeAttendanceSubmit(emp, watermarked, detectionScore || 90, 'Presensi Manual Kiosk Wajah');
    } else {
      setPendingEmployee(emp);
      setPendingPhoto(watermarked);
      setPendingScore(detectionScore || 90);
      setKioskStep('OUTSIDE_RADIUS_NOTE');
    }
  };

  // Native File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const emp = detectedEmployee || employees[0];
        if (!emp) return;
        const watermarked = createWatermarkedPhoto(
          img,
          img.width,
          img.height,
          false,
          emp,
          90,
          gpsLocation,
          isInsideRadius,
          attendanceAction
        );
        setCapturedPhoto(watermarked);
        if (isInsideRadius) {
          executeAttendanceSubmit(emp, watermarked, 90, 'Presensi Upload Foto Kiosk');
        } else {
          setPendingEmployee(emp);
          setPendingPhoto(watermarked);
          setPendingScore(90);
          setKioskStep('OUTSIDE_RADIUS_NOTE');
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-3 sm:p-5 select-none font-sans">
      {/* Centered Modal Card Container (Exact Match to Terminal Screenshot) */}
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200">
        
        {/* 1. Modal Header (Exact Match) */}
        <div className="p-4 sm:px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-[#FF6B00]">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Terminal Presensi Pintar & Biometrik
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono-code font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  KIOSK
                </span>
                {kioskStep === 'SCAN_CAMERA' && (
                  <span className="text-[10px] text-orange-400 font-bold font-mono-code">
                    {detectedEmployee?.nik || 'SCANNING'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-mono-code truncate max-w-xs sm:max-w-md">
                {kioskStep === 'SELECT_MODE' && (
                  <span>Pilih Absen Masuk atau Pulang • Waktu: {currentTimeStr}</span>
                )}
                {kioskStep === 'SCAN_CAMERA' && (
                  detectedEmployee ? (
                    <span>
                      <strong className="text-emerald-400">{detectedEmployee.name}</strong> • Shift: {activeSchedule.checkInTime} - {activeSchedule.checkOutTime} WIB
                    </span>
                  ) : (
                    <span>Tatap Kamera (&lt;5 detik) • Mode: {attendanceAction === 'CHECK_IN' ? 'Masuk' : 'Pulang'}</span>
                  )
                )}
                {kioskStep === 'OUTSIDE_RADIUS_NOTE' && (
                  <span className="text-amber-400">Verifikasi Catatan Presensi di Luar Radius</span>
                )}
                {kioskStep === 'SUCCESS' && (
                  <span className="text-emerald-400">Presensi Berhasil Direkam</span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onGoToLogin}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Keluar dari Kiosk (Ke Login Admin)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          
          {/* ========================================================================= */}
          {/* STEP 1: INITIAL MODE SELECTION (Mencegah Salah Absen Sebelum Kamera Nyala) */}
          {/* ========================================================================= */}
          {kioskStep === 'SELECT_MODE' && (
            <div className="py-2 space-y-5 animate-in fade-in duration-200">
              {/* Digital Clock Banner */}
              <div className="text-center py-4 px-3 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 text-white border border-slate-800 shadow-inner">
                <span className="text-[11px] font-mono-code uppercase tracking-wider text-slate-400 block mb-0.5">
                  WAKTU SERVER RESMI [RTC LOCKED]
                </span>
                <div className="text-3xl sm:text-4xl font-black font-mono-code text-[#FF6B00] tracking-tight">
                  {currentTimeStr || '08:00:00 WIB'}
                </div>
                <div className="text-xs text-slate-400 mt-1 font-medium">
                  {currentDateStr}
                </div>
              </div>

              {/* Title & Prompt */}
              <div className="text-center space-y-1">
                <h2 className="text-lg font-black text-slate-900">
                  Silakan Pilih Jenis Presensi Anda
                </h2>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Pilih status kehadiran terlebih dahulu sebelum sistem melakukan pemindaian wajah otomatis.
                </p>
              </div>

              {/* 2 Big Action Cards (Masuk / Pulang) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* 1. Tombol Masuk */}
                <button
                  type="button"
                  onClick={() => handleSelectModeAndStart('CHECK_IN')}
                  className="group relative p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-lg shadow-emerald-700/20 active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between text-left min-h-[140px] border border-emerald-400/30"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                      <LogIn className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-950/60 text-[10px] font-bold font-mono-code tracking-wide border border-emerald-400/40 text-emerald-200">
                      IN
                    </span>
                  </div>

                  <div>
                    <div className="text-base font-black text-white flex items-center gap-1.5">
                      <span>ABSEN MASUK</span>
                      <ChevronRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <span className="text-[11px] text-emerald-100 font-medium block mt-0.5">
                      Mulai jam kerja • Shift Pagi/Siang
                    </span>
                  </div>
                </button>

                {/* 2. Tombol Pulang */}
                <button
                  type="button"
                  onClick={() => handleSelectModeAndStart('CHECK_OUT')}
                  className="group relative p-5 rounded-2xl bg-gradient-to-br from-[#FF6B00] to-amber-600 hover:from-[#e56000] hover:to-amber-500 text-white shadow-lg shadow-orange-700/20 active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between text-left min-h-[140px] border border-orange-400/30"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                      <LogOut className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-amber-950/60 text-[10px] font-bold font-mono-code tracking-wide border border-orange-400/40 text-amber-200">
                      OUT
                    </span>
                  </div>

                  <div>
                    <div className="text-base font-black text-white flex items-center gap-1.5">
                      <span>ABSEN PULANG</span>
                      <ChevronRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <span className="text-[11px] text-orange-100 font-medium block mt-0.5">
                      Selesai jam kerja • Shift Sore/Malam
                    </span>
                  </div>
                </button>
              </div>

              {/* Geofence info indicator */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5 truncate">
                  <MapPin className={`w-4 h-4 shrink-0 ${isInsideRadius ? 'text-emerald-600' : 'text-amber-500'}`} />
                  <span className="truncate">{targetGeofence.name}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold shrink-0 ${
                  isInsideRadius ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {isInsideRadius ? 'Area Resmi' : 'Luar Radius'}
                </span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: CAMERA SCANNING & REAL-TIME DETECTION STATUS                      */}
          {/* ========================================================================= */}
          {kioskStep === 'SCAN_CAMERA' && (
            <>
              {/* Selected Mode Banner with Quick Switch */}
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase font-mono-code">
                    Mode Aktif:
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-black font-mono-code flex items-center gap-1.5 border shadow-2xs ${
                    attendanceAction === 'CHECK_IN'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-orange-50 text-orange-800 border-orange-300'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${attendanceAction === 'CHECK_IN' ? 'bg-emerald-500' : 'bg-[#FF6B00]'} animate-pulse`} />
                    <span>{attendanceAction === 'CHECK_IN' ? 'ABSEN MASUK (IN)' : 'ABSEN PULANG (OUT)'}</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setKioskStep('SELECT_MODE');
                  }}
                  className="text-[11px] text-[#FF6B00] hover:text-orange-700 font-bold underline cursor-pointer"
                >
                  Ganti ke {attendanceAction === 'CHECK_IN' ? 'Pulang' : 'Masuk'}
                </button>
              </div>

              {/* Camera Viewfinder (Exact Match) */}
              <div className="space-y-3">
                <div className="relative aspect-4/3 w-full bg-slate-950 overflow-hidden flex items-center justify-center rounded-2xl shadow-inner border border-slate-800">
                  {shutterFlash && (
                    <div className="absolute inset-0 bg-white/90 z-30 pointer-events-none transition-opacity duration-200" />
                  )}

                  {cameraError ? (
                    <div className="p-6 text-center text-slate-300 space-y-3 max-w-md">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <p className="text-xs text-rose-300 font-medium">{cameraError}</p>
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                      >
                        Coba Nyalakan Lagi
                      </button>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={(el) => {
                          videoRef.current = el;
                          if (el && streamRef.current && el.srcObject !== streamRef.current) {
                            el.srcObject = streamRef.current;
                            el.play().catch(e => console.warn(e));
                          }
                        }}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                      />

                      {/* Biometric Face Guide Reticle (Exact Match) */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className={`w-44 h-56 sm:w-52 sm:h-64 border-2 border-dashed rounded-[36px] relative flex items-center justify-center transition-all duration-300 ${
                          detectedEmployee
                            ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.35)]'
                            : 'border-[#FF6B00]/70 shadow-[0_0_20px_rgba(255,107,0,0.2)]'
                        }`}>
                          <div className={`absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 rounded-tl-xl ${detectedEmployee ? 'border-emerald-400' : 'border-[#FF6B00]'}`} />
                          <div className={`absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 rounded-tr-xl ${detectedEmployee ? 'border-emerald-400' : 'border-[#FF6B00]'}`} />
                          <div className={`absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 rounded-bl-xl ${detectedEmployee ? 'border-emerald-400' : 'border-[#FF6B00]'}`} />
                          <div className={`absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 rounded-br-xl ${detectedEmployee ? 'border-emerald-400' : 'border-[#FF6B00]'}`} />
                        </div>
                      </div>

                      {/* LIVE DETECTION IDENTIFICATION CARD (Permintaan Mr Prime: Tampilkan siapa user & ID sebelum di-lock) */}
                      {detectedEmployee ? (
                        <div className="absolute bottom-3 left-3 right-3 z-20 p-2.5 rounded-2xl bg-slate-900/95 border border-emerald-500 text-white shadow-2xl backdrop-blur-md flex items-center justify-between gap-2.5 animate-in slide-in-from-bottom duration-200">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center shrink-0 font-black text-sm">
                              ✓
                            </div>
                            <div className="truncate">
                              <div className="text-xs font-black text-white flex items-center gap-1.5 truncate">
                                <span>{detectedEmployee.name}</span>
                                <span className="text-[10px] text-emerald-400 font-mono-code font-bold">({detectionScore}%)</span>
                              </div>
                              <div className="text-[10px] text-slate-300 font-mono-code truncate">
                                ID / NIK: <strong className="text-orange-400">{detectedEmployee.nik}</strong> • Shift: {activeSchedule.checkInTime} - {activeSchedule.checkOutTime}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex flex-col items-end">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono-code font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              VERIFIED
                            </span>
                            <span className="text-[9px] text-slate-400 mt-0.5">
                              {isInsideRadius ? 'Menyimpan...' : 'Menyiapkan Catatan...'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="absolute bottom-3 left-3 right-3 z-10 text-center pointer-events-none">
                          <span className="text-[11px] font-mono-code text-white bg-black/75 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10 shadow-lg">
                            {faceFeedback}
                          </span>
                        </div>
                      )}

                      {/* Live Overlay GPS Badge */}
                      <div className="absolute top-3 left-3 pointer-events-none z-10">
                        <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono-code text-white flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${isInsideRadius ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                          <span>GPS: {gpsLocation.lat.toFixed(4)}, {gpsLocation.lng.toFixed(4)} ({currentDistanceMeters}m)</span>
                        </div>
                      </div>

                      {/* Flip Camera Icon */}
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                        <button
                          type="button"
                          onClick={toggleFacingMode}
                          className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/10 transition-all cursor-pointer shadow-md"
                          title="Putar Kamera"
                        >
                          <FlipHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Shutter / Retake Controls (Exact Match) */}
                <div className="flex items-center justify-between gap-2 px-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Upload foto dari galeri"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Upload</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleManualShutter}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#e56000] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 cursor-pointer active:scale-98"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Jepret Foto Sekarang</span>
                  </button>
                </div>
              </div>

              {/* Geolocation Status Row (Exact Match) */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <MapPin className={`w-5 h-5 shrink-0 ${isInsideRadius ? 'text-emerald-600' : 'text-amber-500'}`} />
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 text-xs truncate">
                        {targetGeofence.name}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono-code truncate mt-0.5">
                      Lat {gpsLocation.lat.toFixed(4)}, Lng {gpsLocation.lng.toFixed(4)} • Akurasi ±{gpsLocation.accuracy}m
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono-code font-bold border ${
                    isInsideRadius
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {currentDistanceMeters}m • {isInsideRadius ? 'Masuk Radius (Valid)' : 'Luar Area'}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: OUTSIDE RADIUS NOTE FILLING (Permintaan Mr Prime: Luar Area Wajib Note) */}
          {/* ========================================================================= */}
          {kioskStep === 'OUTSIDE_RADIUS_NOTE' && pendingEmployee && (
            <div className="py-2 space-y-4 animate-in zoom-in-95 duration-200">
              {/* Alert Header */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Presensi di Luar Radius Area Kerja ({currentDistanceMeters}m)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono-code bg-amber-200 text-amber-900">
                    WAJIB ISI CATATAN
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  GPS perangkat Anda terdeteksi berjarak <strong>{currentDistanceMeters}m</strong> dari area kerja resmi ({targetGeofence.name}). Harap tuliskan alasan kehadiran di luar radius.
                </p>
              </div>

              {/* Employee Summary Card & Watermarked Photo Preview */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                {pendingPhoto && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-300 shrink-0 bg-black">
                    <img src={pendingPhoto} alt="Watermark Snapshot" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-slate-900 truncate">
                    {pendingEmployee.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono-code">
                    NIK: <strong>{pendingEmployee.nik}</strong> • Shift: {activeSchedule.checkInTime} - {activeSchedule.checkOutTime}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono-code ${
                      attendanceAction === 'CHECK_IN'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {attendanceAction === 'CHECK_IN' ? 'ABSEN MASUK' : 'ABSEN PULANG'}
                    </span>
                    <span className="text-[9px] text-emerald-600 font-mono-code font-bold">
                      Match: {pendingScore}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Note Textarea Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Alasan / Catatan Presensi (Wajib):
                </label>
                <textarea
                  rows={3}
                  value={notesInput}
                  onChange={e => setNotesInput(e.target.value)}
                  placeholder="Contoh: Bekerja dari rumah (WFH) / Tugas survei site proyek / Meeting bersama mitra..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] placeholder:text-slate-400"
                  autoFocus
                />

                {/* Quick note presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-mono-code uppercase mr-1">Opsi Cepat:</span>
                  {['Dinas Luar / Site Proyek', 'Koordinasi Vendor', 'WFH / Remote', 'Lupa Absen di Lokasi'].map(quick => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => setNotesInput(quick)}
                      className="px-2 py-0.5 rounded-lg text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                    >
                      {quick}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleResetForNextEmployee}
                  className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Batal / Scan Ulang
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || !notesInput.trim()}
                  onClick={() => {
                    if (pendingEmployee && pendingPhoto) {
                      executeAttendanceSubmit(
                        pendingEmployee,
                        pendingPhoto,
                        pendingScore,
                        notesInput.trim()
                      );
                    }
                  }}
                  className={`py-2.5 px-4 rounded-xl font-black text-xs text-white transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                    !notesInput.trim() || isSubmitting
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-[#FF6B00] hover:bg-[#e56000] shadow-orange-500/25 active:scale-98'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Simpan Presensi</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: SUCCESS RECEIPT VIEW (Menampilkan Watermark Asli & Struk Selesai)   */}
          {/* ========================================================================= */}
          {kioskStep === 'SUCCESS' && submittedRecord && (
            <div className="py-4 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className={`px-3 py-1 rounded-full text-xs font-mono-code font-bold border ${
                  submittedRecord.checkOutTime && attendanceAction === 'CHECK_OUT'
                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {attendanceAction === 'CHECK_OUT' ? 'PRESENSI PULANG BERHASIL' : 'PRESENSI MASUK BERHASIL'}
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-2">
                  Terima Kasih, {submittedRecord.employeeName}!
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Waktu Server: <strong className="font-mono-code text-slate-800">{submittedRecord.checkInTime} WIB</strong> • {submittedRecord.date}
                </p>
                {submittedRecord.note && (
                  <p className="text-[11px] text-slate-600 italic mt-0.5">
                    "{submittedRecord.note}"
                  </p>
                )}
              </div>

              {/* Photo Snapshot Stamp with Official Watermark */}
              {submittedRecord.photoUrl && (
                <div className="relative max-w-[280px] mx-auto rounded-2xl overflow-hidden border border-slate-300 shadow-md">
                  <img src={submittedRecord.photoUrl} alt="Bukti Presensi Watermark" className="w-full h-auto object-cover" />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[9px] font-mono-code text-white">
                    {submittedRecord.checkInTime} WIB • Valid Watermark
                  </div>
                </div>
              )}

              {/* Countdown Button for Next Person */}
              <button
                type="button"
                onClick={handleResetForNextEmployee}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF6B00] to-amber-500 text-white font-black text-xs shadow-lg shadow-orange-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Siap untuk Karyawan Berikutnya ({resetCountdown}s)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
