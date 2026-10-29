import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Camera,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  RotateCcw,
  RefreshCw,
  UserCheck,
  Building2,
  LogIn,
  Sun,
  User,
  ShieldAlert,
  ChevronRight,
  Eye,
  Check,
  X,
  ScanFace,
  AlertOctagon
} from 'lucide-react';
import { AttendanceRecord, BiometricVerificationResult, BiometricPoseKey } from '../types';
import { api } from '../services/api';
import { rtcService } from '../services/rtcService';
import {
  buildGalleryFeatureIndex,
  identifyFaceFromGallery,
  evaluateKiosk1N,
  isHumanFacePresent,
  calculateDistanceMeters,
  HumanFacePresenceResult,
  EnrolledGalleryItem,
  compareFaceBiometric
} from '../utils/biometricHelper';
import { getEmployeeProjectSchedule } from '../utils/scheduleHelper';

interface QuickAttendancePublicPortalProps {
  onGoToLogin: () => void;
}

export const QuickAttendancePublicPortal: React.FC<QuickAttendancePublicPortalProps> = ({
  onGoToLogin
}) => {
  // Directory & 1:N Gallery Index
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [officeGeofence, setOfficeGeofence] = useState<{
    name: string;
    lat: number;
    lng: number;
    radiusMeters: number;
    address?: string;
  } | null>(null);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(true);
  const [galleryIndex, setGalleryIndex] = useState<EnrolledGalleryItem[]>([]);
  const [isIndexingGallery, setIsIndexingGallery] = useState<boolean>(false);

  // Human Face Presence State (Strict Human Gate)
  const [humanPresence, setHumanPresence] = useState<HumanFacePresenceResult | null>(null);

  // Real-Time 1:N Face Recognition State
  const [detectedCandidate, setDetectedCandidate] = useState<{
    matchedItem: EnrolledGalleryItem;
    score: number;
    matchedPose: BiometricPoseKey;
  } | null>(null);
  const [recognitionProgress, setRecognitionProgress] = useState<number>(0);
  const isAutoProcessingRef = useRef<boolean>(false);

  // Geofence Rejection State & Alert Modal
  const [geofenceReject, setGeofenceReject] = useState<{
    isOpen: boolean;
    employeeName: string;
    distanceMeters: number;
    radiusMeters: number;
    targetName: string;
  } | null>(null);

  // Helper: Resolve employee target geofence (Project vs Corporate Office)
  const getEmployeeTargetGeofence = (emp: any) => {
    if (emp?.assignedProjectId && projects.length > 0) {
      const proj = projects.find(p => p.id === emp.assignedProjectId);
      if (proj) {
        const geo = proj.customRules?.geofence || proj.geofence;
        if (geo) {
          const rawLat = geo.lat ?? geo.latitude;
          const rawLng = geo.lng ?? geo.longitude;
          if (typeof rawLat === 'number' && typeof rawLng === 'number') {
            const fitLat = rawLat > 0 && rawLat < 15 ? -rawLat : rawLat;
            return {
              name: geo.siteName || geo.name || proj.name,
              lat: fitLat,
              lng: rawLng,
              radiusMeters: geo.radiusMeters || 350
            };
          }
        }
      }
    }
    if (officeGeofence) {
      return officeGeofence;
    }
    return {
      name: 'PT Dwi Martha Jaya - Kantor Pusat & Workshop Terpadu',
      lat: -7.395625,
      lng: 112.717574,
      radiusMeters: 350
    };
  };

  // Manual Search Modal State (Fallback for un-enrolled users)
  const [isManualSearchOpen, setIsManualSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  // Today's Attendances Directory for Auto-Detecting MASUK vs PULANG
  const [todayAttendances, setTodayAttendances] = useState<Record<string, any>>({});

  // Real-Time Server Clock
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [dayName, setDayName] = useState<string>('');

  // Camera & Viewfinder
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);

  // Biometric Result & Submissions
  const [biometricResult, setBiometricResult] = useState<BiometricVerificationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedRecord, setSubmittedRecord] = useState<AttendanceRecord | null>(null);
  const [resetCountdown, setResetCountdown] = useState<number>(4);

  // Mode Presensi Terpisah: CHECK_IN (Masuk) vs CHECK_OUT (Pulang)
  const [attendanceAction, setAttendanceAction] = useState<'CHECK_IN' | 'CHECK_OUT'>(() => {
    const currentH = new Date().getHours();
    return currentH >= 12 ? 'CHECK_OUT' : 'CHECK_IN';
  });

  // Pending Confirmation State before auto-submitting (Prevents accidental attendance for wrong user)
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    employee: any;
    score: number;
    matchedPose: BiometricPoseKey;
    targetGeofence: any;
    distMeters: number;
    countdown: number;
    actionType: 'CHECK_IN' | 'CHECK_OUT';
  } | null>(null);

  // Live Face Detection & Database Sync Status Indicator
  const [liveSyncStatus, setLiveSyncStatus] = useState<{
    status: 'SEARCHING' | 'DETECTED' | 'DENIED' | 'SYNCED' | 'EMPTY_GALLERY';
    message: string;
    details?: string;
    score?: number;
  }>({
    status: 'SEARCHING',
    message: 'Mencari Orang...'
  });
  const lastDeniedLogTimeRef = useRef<number>(0);

  // GPS & Location (Bersih dari data dummy, menunggu penguncian hardware GPS)
  const [isGpsLocked, setIsGpsLocked] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLocation, setGpsLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    address: string;
    isInsideRadius: boolean;
  }>({
    lat: 0,
    lng: 0,
    accuracy: 0,
    address: 'Mencari sinyal GPS perangkat...',
    isInsideRadius: false
  });

  // Reverse Geocoding Riil menggunakan OpenStreetMap Nominatim
  const fetchAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'id' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.address) {
          const addr = data.address;
          const road = addr.road || addr.street || addr.industrial || '';
          const village = addr.village || addr.suburb || addr.neighbourhood || '';
          const district = addr.municipality || addr.city_district || addr.subdistrict || '';
          const regency = addr.county || addr.city || '';
          const state = addr.state || '';
          const parts = [road, village, district, regency, state].filter(Boolean);
          if (parts.length > 0) return `${parts.join(', ')}`;
        }
        if (data && data.display_name) {
          return `${data.display_name.split(',').slice(0, 4).join(',')}`;
        }
      }
    } catch (e) {
      console.warn('Gagal reverse geocoding GPS Kiosk:', e);
    }
    return `Koordinat GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  };

  // Network IP
  const [clientIp, setClientIp] = useState<string>('103.31.205.218');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const resetTimerRef = useRef<any>(null);

  // Audio Chimes
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

  // Clock Ticker (WIB)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const dateStr = now.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      const dayStr = now.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long'
      });
      setCurrentTime(timeStr);
      setCurrentDate(dateStr);
      setDayName(dayStr);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Public Directory & Pre-index Enrolled Face Gallery for 1:N Recognition
  useEffect(() => {
    const loadDirectory = async () => {
      try {
        setIsLoadingEmployees(true);
        const res = await api.getPublicKioskEmployees();
        if (res.success && res.employees) {
          setEmployees(res.employees);
          if (res.projects) setProjects(res.projects);
          if (res.officeGeofence) setOfficeGeofence(res.officeGeofence);
          if (res.todayAttendances) setTodayAttendances(res.todayAttendances);

          // Fast initialization: 1:N facial recognition is powered by Native Server Face Engine (YuNet + SFace 128D)
          setGalleryIndex(res.employees.map((e: any) => ({
            employeeId: e.id,
            employeeName: e.name,
            employeeNik: e.nik,
            employee: e,
            patches: []
          })));
        }
      } catch (err) {
        console.error('Failed to load kiosk employees:', err);
      } finally {
        setIsLoadingEmployees(false);
      }
    };
    loadDirectory();
  }, []);

  // Real-Time Multi-Device Live Sync for Kiosk Directory & Clock-ins
  useEffect(() => {
    const unsubEmp = rtcService.subscribe('*', (packet) => {
      if (packet.type === 'EMPLOYEE_SAVED' || packet.type === 'EMPLOYEE_UPDATED') {
        const emp = packet.payload;
        if (!emp || !emp.id) return;
        setEmployees(prev => {
          const idx = prev.findIndex(e => e.id === emp.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...emp };
            return next;
          }
          return [...prev, emp];
        });
        setGalleryIndex(prev => {
          const idx = prev.findIndex(g => g.employeeId === emp.id);
          const newItem = {
            employeeId: emp.id,
            employeeName: emp.name,
            employeeNik: emp.nik,
            employee: emp,
            patches: []
          };
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = newItem;
            return next;
          }
          return [...prev, newItem];
        });
      } else if (packet.type === 'ATTENDANCE_SAVED') {
        const rec: AttendanceRecord = packet.payload;
        if (!rec || !rec.employeeId) return;
        setTodayAttendances(prev => ({
          ...prev,
          [rec.employeeId]: rec
        }));
      } else if (packet.type === 'SALARY_RULES_UPDATED') {
        const rules = packet.payload;
        if (rules && rules.officeGeofence) {
          setOfficeGeofence(rules.officeGeofence);
        }
      }
    });

    return () => unsubEmp();
  }, []);

  // Detect Client IP & GPS Geolocation with continuous watch
  useEffect(() => {
    fetch('/api/my-network')
      .then(res => res.json())
      .then(data => {
        if (data.ip) setClientIp(data.ip);
      })
      .catch(() => {});

    let watchId: number | null = null;
    if (navigator.geolocation) {
      const handlePosition = async (pos: GeolocationPosition) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const acc = Math.round(pos.coords.accuracy) || 5;

        setGpsError(null);
        setIsGpsLocked(true);
        setGpsLocation({
          lat,
          lng,
          accuracy: acc,
          address: `Mengunci alamat (${lat.toFixed(5)}, ${lng.toFixed(5)})...`,
          isInsideRadius: true
        });

        const resolvedAddr = await fetchAddressFromCoords(lat, lng);
        setGpsLocation(prev => ({
          ...prev,
          address: resolvedAddr
        }));
      };

      const handleGpsErr = (err: any) => {
        console.warn('GPS live error:', err);
        let msg = 'Gagal membaca GPS perangkat.';
        if (err.code === 1) msg = 'Akses lokasi ditolak. Harap izinkan akses Lokasi (GPS) pada browser Anda.';
        else if (err.code === 2) msg = 'Sinyal GPS tidak ditemukan. Pastikan GPS/Lokasi perangkat telah AKTIF (ON).';
        else if (err.code === 3) msg = 'Waktu pencarian sinyal GPS habis (Timeout).';
        setGpsError(msg);
      };

      navigator.geolocation.getCurrentPosition(
        handlePosition,
        handleGpsErr,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );

      watchId = navigator.geolocation.watchPosition(
        handlePosition,
        handleGpsErr,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      );
    } else {
      setGpsError('Browser tidak mendukung API Geolocation GPS.');
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // Start Camera Function
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
          ? 'Izin kamera ditolak. Harap izinkan akses kamera di browser.'
          : 'Kamera tidak terdeteksi atau sedang aktif di aplikasi lain.'
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

  // Launch camera immediately when Kiosk opens
  useEffect(() => {
    if (!submittedRecord) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [submittedRecord]);

  // Real-Time 1:N Native Server Facial Recognition Loop (OpenCV YuNet + SFace 128D)
  useEffect(() => {
    if (
      !cameraActive ||
      isCapturing ||
      isSubmitting ||
      submittedRecord ||
      pendingConfirmation ||
      isAutoProcessingRef.current ||
      geofenceReject?.isOpen
    ) {
      return;
    }

    let isSubscribed = true;
    let isProcessingFrame = false;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');

    const interval = setInterval(async () => {
      if (
        !isSubscribed ||
        isProcessingFrame ||
        pendingConfirmation ||
        isAutoProcessingRef.current ||
        geofenceReject?.isOpen ||
        !videoRef.current ||
        videoRef.current.videoWidth === 0 ||
        selectedEmployee
      ) {
        return;
      }

      isProcessingFrame = true;
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
          setLiveSyncStatus({
            status: 'SEARCHING',
            message: 'Menghubungi Face Engine...',
            details: 'Sedang menghubungkan ke layanan deteksi wajah cerdas.'
          });
          return;
        }

        // KASUS 1: TIDAK ADA WAJAH DI FRAME KAMERA
        if (resp.status === 'NO_FACE') {
          setHumanPresence({ isPresent: false, skinRatio: 0, contrast: 0, meanLuma: 0, feedback: 'Arahkan wajah ke depan kamera' });
          setRecognitionProgress(prev => Math.max(0, prev - 25));
          setDetectedCandidate(null);
          setLiveSyncStatus({
            status: 'SEARCHING',
            message: 'Mencari Orang...',
            details: 'Posisikan wajah Anda di depan kamera'
          });
          return;
        }

        // KASUS 2: WAJAH TERHALANG (ANTI-OCCLUSION / TANGAN / MASKER)
        if (resp.status === 'OCCLUDED') {
          setHumanPresence({ isPresent: true, skinRatio: 0.25, contrast: 25, meanLuma: 120, feedback: resp.message });
          setRecognitionProgress(0);
          setDetectedCandidate(null);
          setLiveSyncStatus({
            status: 'SEARCHING',
            message: '⚠️ Wajah Terhalang',
            details: resp.message || 'Wajah terhalang tangan / masker! Harap perlihatkan seluruh wajah.'
          });
          return;
        }

        // KASUS 2B: KEMIRIPAN AMBIGU (ANTI-SALAH ORANG)
        if (resp.status === 'AMBIGUOUS') {
          setHumanPresence({ isPresent: true, skinRatio: 0.25, contrast: 25, meanLuma: 120, feedback: resp.message });
          setRecognitionProgress(0);
          setDetectedCandidate(null);
          setLiveSyncStatus({
            status: 'DENIED',
            message: '⚠️ Kemiripan Ambigu',
            details: resp.message || 'Wajah terdeteksi memiliki kemiripan dengan beberapa karyawan. Harap gunakan tombol Cari Nama di bawah.'
          });
          return;
        }

        // KASUS 3: WAJAH TERVERIFIKASI & COCOK (MATCHED >= 70% & COSINE >= 0.52)
        if (resp.matched && resp.employee && resp.score >= 70 && (resp.cosineSimilarity === undefined || resp.cosineSimilarity >= 0.52)) {
          const empData = employees.find(e => e.id === resp.employee.id || e.nik === resp.employee.nik) || resp.employee;
          const targetGeofence = getEmployeeTargetGeofence(empData);
          const distMeters = calculateDistanceMeters(
            gpsLocation.lat,
            gpsLocation.lng,
            targetGeofence.lat,
            targetGeofence.lng
          );

          // 1A. Jika sinyal GPS belum terkunci
          if (!isGpsLocked && navigator.geolocation) {
            setRecognitionProgress(0);
            setDetectedCandidate(null);
            const isGpsOff = !!gpsError;
            setLiveSyncStatus({
              status: isGpsOff ? 'DENIED' : 'SEARCHING',
              message: isGpsOff ? '⚠️ GPS Perangkat Tidak Aktif!' : '⏳ Menunggu Sinyal GPS Terkunci...',
              details: isGpsOff
                ? `Wajah ${empData.name} terverifikasi (${resp.score}%), namun GPS HP belum aktif / izin ditolak. Harap nyalakan GPS di HP Anda.`
                : `Mendeteksi posisi koordinat GPS untuk ${empData.name} sebelum verifikasi wajah.`
            });
            return;
          }

          // 1B. Jika posisi GPS di luar radius geofence
          if (distMeters > targetGeofence.radiusMeters) {
            setRecognitionProgress(0);
            setDetectedCandidate(null);
            playTone(220, 'sawtooth', 0.45);
            setLiveSyncStatus({
              status: 'DENIED',
              message: `⛔ Presensi Ditolak: Di Luar Geofence (${distMeters}m > ${targetGeofence.radiusMeters}m)`,
              details: `${empData.name} berada di luar radius lokasi ${targetGeofence.name}. Verifikasi wajah dibatalkan.`
            });

            if (Date.now() - lastDeniedLogTimeRef.current > 12000) {
              lastDeniedLogTimeRef.current = Date.now();
              api.logActivity({
                action: 'KIOSK_ATTENDANCE_DENIED_GEOFENCE',
                module: 'ATTENDANCE',
                status: 'WARNING',
                details: `Presensi Kiosk DITOLAK (Geofence-First): ${empData.name} (${empData.nik}) berada di luar radius geofence (Jarak: ${distMeters}m, Toleransi: ${targetGeofence.radiusMeters}m di titik ${targetGeofence.name}). Verifikasi wajah diblokir.`,
                userName: empData.name,
                userNik: empData.nik,
                ipAddress: clientIp,
                metadata: { distMeters, radiusMeters: targetGeofence.radiusMeters, targetGeofence: targetGeofence.name, matchScore: resp.score, gps: gpsLocation }
              }).catch(() => {});
            }

            setGeofenceReject({
              isOpen: true,
              employeeName: empData.name,
              distanceMeters: distMeters,
              radiusMeters: targetGeofence.radiusMeters,
              targetName: targetGeofence.name
            });
            return;
          }

          // 2. LOKASI SESUAI & WAJAH COCOK -> LOCK-ON
          const matchCandidate = {
            matchedItem: {
              employee: empData,
              employeeName: empData.name,
              employeeId: empData.id,
              employeeNik: empData.nik,
              role: empData.role,
              department: empData.department,
              position: empData.position,
              loginUsername: empData.loginUsername || null,
              hasBiometric: true,
              biometric: empData.biometric || null,
              patches: []
            },
            score: resp.score,
            matchedPose: 'front' as BiometricPoseKey
          };

          setHumanPresence({ isPresent: true, skinRatio: 0.25, contrast: 25, meanLuma: 120, feedback: `Wajah Terverifikasi: ${empData.name}` });
          setDetectedCandidate(matchCandidate);
          setLiveSyncStatus({
            status: 'DETECTED',
            message: `📍 Lokasi Sesuai (${targetGeofence.name}) • Wajah: ${empData.name}`,
            details: `Jarak GPS ${distMeters}m (Radius ${targetGeofence.radiusMeters}m) • Skor Biometrik: ${resp.score}%`,
            score: resp.score
          });

          setRecognitionProgress(prev => {
            const next = prev + 50; // Mengunci cepat dalam 2 tick (~500ms)
            if (next >= 100) {
              isAutoProcessingRef.current = true;
              setPendingConfirmation({
                employee: empData,
                score: resp.score,
                matchedPose: 'front',
                targetGeofence,
                distMeters,
                countdown: 4,
                actionType: attendanceAction
              });
              return 100;
            }
            if (prev < 50 && next >= 50) {
              playTone(659.25, 'sine', 0.08);
            }
            return next;
          });
        } else {
          // KASUS 4: WAJAH TERDETEKSI TAPI SKOR KURANG / BELUM COCOK
          setHumanPresence({ isPresent: true, skinRatio: 0.25, contrast: 25, meanLuma: 120, feedback: 'Wajah terdeteksi' });
          setLiveSyncStatus({
            status: 'DENIED',
            message: '⚠️ Wajah Belum Cocok',
            details: resp.message || `Wajah belum terdaftar di sistem. Gunakan tombol Cari Nama di bawah.`,
            score: resp.score || 0
          });

          if (Date.now() - lastDeniedLogTimeRef.current > 15000) {
            lastDeniedLogTimeRef.current = Date.now();
            api.logActivity({
              action: 'KIOSK_FACE_UNRECOGNIZED',
              module: 'ATTENDANCE',
              status: 'WARNING',
              details: `Wajah terdeteksi di kamera Kiosk namun belum cocok dengan profil biometrik galeri (Skor: ${resp.score || 0}%).`,
              ipAddress: clientIp,
              metadata: { bestScore: resp.score, gps: gpsLocation }
            }).catch(() => {});
          }

          setRecognitionProgress(prev => {
            const next = Math.max(0, prev - 25);
            if (next === 0) setDetectedCandidate(null);
            return next;
          });
        }
      } catch (err) {
        console.warn('[Kiosk Verify Error]', err);
      } finally {
        isProcessingFrame = false;
      }
    }, 250);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [cameraActive, isCapturing, isSubmitting, submittedRecord, pendingConfirmation, employees, selectedEmployee, geofenceReject, gpsLocation, isGpsLocked, projects, officeGeofence, attendanceAction]);

  // Ticker Countdown Konfirmasi Mandiri sebelum Submit
  useEffect(() => {
    if (!pendingConfirmation) return;

    const timer = setInterval(() => {
      setPendingConfirmation(prev => {
        if (!prev) return null;
        if (prev.countdown <= 1) {
          clearInterval(timer);
          handleAutoSnapAndSubmit(
            prev.employee,
            prev.score,
            prev.matchedPose,
            prev.targetGeofence,
            prev.distMeters,
            prev.actionType
          );
          return null;
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingConfirmation]);

  const handleConfirmPendingNow = () => {
    if (!pendingConfirmation) return;
    const p = pendingConfirmation;
    setPendingConfirmation(null);
    handleAutoSnapAndSubmit(
      p.employee,
      p.score,
      p.matchedPose,
      p.targetGeofence,
      p.distMeters,
      p.actionType
    );
  };

  const handleCancelPendingConfirmation = () => {
    setPendingConfirmation(null);
    isAutoProcessingRef.current = false;
    setRecognitionProgress(0);
    setDetectedCandidate(null);
    setIsManualSearchOpen(true);
  };

  // Filtered employees for manual search modal fallback
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees.slice(0, 10);
    const q = searchQuery.toLowerCase().trim();
    return employees.filter(emp => {
      const matchName = emp.name?.toLowerCase().includes(q);
      const matchNik = emp.nik?.toLowerCase().includes(q);
      const matchLogin = emp.loginUsername?.toLowerCase().includes(q);
      return matchName || matchNik || matchLogin;
    }).slice(0, 10);
  }, [searchQuery, employees]);

  // Execute Snapshot with Executive Digital Watermark & Auto-Submit to Server
  const handleAutoSnapAndSubmit = async (
    emp: any,
    matchScore: number,
    matchedPose: BiometricPoseKey,
    targetGeofence?: any,
    distMeters?: number,
    actionTypeOverride?: 'CHECK_IN' | 'CHECK_OUT'
  ) => {
    if (!videoRef.current || videoRef.current.videoWidth === 0) {
      isAutoProcessingRef.current = false;
      return;
    }

    setIsCapturing(true);
    setShutterFlash(true);
    playTone(880, 'sine', 0.2); // shutter sound
    setTimeout(() => setShutterFlash(false), 200);

    const video = videoRef.current;
    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;

    const outWidth = 640;
    const outHeight = 800; // 4:5 portrait
    const canvas = document.createElement('canvas');
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsCapturing(false);
      isAutoProcessingRef.current = false;
      return;
    }

    // 1. Draw mirrored video frame (center crop)
    const srcRatio = vWidth / vHeight;
    const targetRatio = outWidth / outHeight;
    let sx = 0, sy = 0, sw = vWidth, sh = vHeight;
    if (srcRatio > targetRatio) {
      sw = vHeight * targetRatio;
      sx = (vWidth - sw) / 2;
    } else {
      sh = vWidth / targetRatio;
      sy = (vHeight - sh) / 2;
    }
    ctx.save();
    ctx.translate(outWidth, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outWidth, outHeight);
    ctx.restore();

    // 2. Render Permanent Executive Digital Watermark
    const effectiveGeofence = targetGeofence || getEmployeeTargetGeofence(emp);
    const effectiveDistance = distMeters !== undefined ? distMeters : calculateDistanceMeters(
      gpsLocation.lat,
      gpsLocation.lng,
      effectiveGeofence.lat,
      effectiveGeofence.lng
    );

    const stampY = outHeight - 160;
    ctx.fillStyle = 'rgba(10, 18, 30, 0.88)';
    ctx.fillRect(16, stampY, outWidth - 32, 144);
    ctx.strokeStyle = '#FF6B00';
    ctx.lineWidth = 3;
    ctx.strokeRect(16, stampY, outWidth - 32, 144);

    // Resolve employee schedule & check-in status berdasarkan mode eksplisit
    const schedule = getEmployeeProjectSchedule(emp, projects, '08:30');
    const existingToday = todayAttendances[emp.id];
    const effectiveAction = actionTypeOverride || attendanceAction;
    const isClockIn = effectiveAction === 'CHECK_IN';
    const autoType: 'MASUK' | 'PULANG' = isClockIn ? 'MASUK' : 'PULANG';

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const timeStr = now.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/\./g, ':');
    const [hours, minutes] = timeStr.split(':').map(Number);

    let isLate = false;
    let lateMinutes = 0;
    if (isClockIn) {
      const [cutoffH, cutoffM] = schedule.cutoffTime.replace(/\./g, ':').split(':').map(Number);
      isLate = (hours > cutoffH) || (hours === cutoffH && minutes > cutoffM);
      lateMinutes = isLate ? Math.max(0, (hours * 60 + minutes) - (cutoffH * 60 + cutoffM)) : 0;
    } else {
      isLate = Boolean(existingToday?.isLate);
      lateMinutes = existingToday?.lateMinutes || 0;
    }

    let workDurationText = '';
    if (!isClockIn && existingToday?.checkInTime) {
      const [inH, inM] = existingToday.checkInTime.replace(/\./g, ':').split(':').map(Number);
      const totalInMins = inH * 60 + inM;
      const totalOutMins = hours * 60 + minutes;
      const diffMins = Math.max(0, totalOutMins - totalInMins);
      const durH = Math.floor(diffMins / 60);
      const durM = diffMins % 60;
      workDurationText = `${durH} Jam ${durM} Menit`;
    }

    ctx.fillStyle = '#FF6B00';
    ctx.fillRect(16, stampY, outWidth - 32, 24);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('PRIME HRIS • VERIFIED ATTENDANCE STAMP (AI 1:N RECOGNITION)', 26, stampY + 16);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${emp.name} (${emp.nik})`, 26, stampY + 44);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px sans-serif';
    ctx.fillText(`Departemen : ${emp.department || 'Operasional'} • Shift: ${schedule.checkInTime}-${schedule.checkOutTime} (${schedule.projectName})`, 26, stampY + 62);

    ctx.fillStyle = autoType === 'MASUK' ? '#34D399' : '#FB923C';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`STATUS: ${autoType === 'MASUK' ? 'ABSEN MASUK (CHECK-IN)' : 'ABSEN PULANG (CHECK-OUT)'} • ${currentDate} ${currentTime} WIB`, 26, stampY + 82);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '11px monospace';
    if (autoType === 'MASUK') {
      ctx.fillText(`STATUS MASUK: ${isLate ? `TERLAMBAT (+${lateMinutes}m dari cutoff ${schedule.cutoffTime})` : `TEPAT WAKTU (Batas Cutoff ${schedule.cutoffTime})`}`, 26, stampY + 102);
    } else {
      ctx.fillText(`DURASI KERJA: Masuk ${existingToday?.checkInTime || '-'} -> Pulang ${timeStr} WIB (${workDurationText || '-'})`, 26, stampY + 102);
    }

    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`BIOMETRIK  : TERVERIFIKASI MANUSIA (${matchScore}% MATCH • POSE ${matchedPose.toUpperCase()})`, 26, stampY + 122);

    ctx.fillStyle = '#64748B';
    ctx.font = '9px monospace';
    const fakeHash = `SEC-${Date.now().toString(16).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    ctx.fillText(`IP: ${clientIp} | GPS: ${gpsLocation.lat}, ${gpsLocation.lng} (${effectiveDistance}m) | TOKEN: ${fakeHash}`, 26, stampY + 137);

    const finalDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedPhoto(finalDataUrl);
    setIsCapturing(false);

    // 3. Immediately Submit to Backend
    setIsSubmitting(true);
    try {
      const record: AttendanceRecord = {
        id: isClockIn ? `ATT-KIOSK-${Date.now()}` : (existingToday?.id || `ATT-KIOSK-${Date.now()}`),
        employeeId: emp.id,
        employeeName: emp.name,
        employeeNik: emp.nik,
        department: emp.department || 'Engineering',
        date: dateStr,
        checkInTime: isClockIn ? timeStr : (existingToday?.checkInTime || timeStr),
        checkOutTime: isClockIn ? (existingToday?.checkOutTime || undefined) : timeStr,
        attendanceType: effectiveAction,
        location: {
          lat: gpsLocation.lat,
          lng: gpsLocation.lng,
          accuracy: gpsLocation.accuracy,
          address: `${gpsLocation.address || 'Lokasi GPS Terverifikasi'} [${effectiveGeofence.name}]`,
          inGeofence: true,
          distanceMeters: effectiveDistance
        },
        networkAudit: {
          ipAddress: clientIp,
          connectionType: 'Portal Kiosk Mandiri (Geofence Verified)'
        },
        note: isClockIn
          ? `Presensi Kiosk Mandiri (AI 1:N) - Check-In [Jadwal: ${schedule.checkInTime} - ${schedule.checkOutTime}]`
          : `Presensi Kiosk Mandiri (AI 1:N) - Check-Out [Masuk: ${existingToday?.checkInTime || '-'} WIB, Durasi: ${workDurationText || '-'}]`,
        mode: 'WFO',
        status: isLate ? 'LATE' : 'ON_TIME',
        photoUrl: finalDataUrl,
        isLate,
        lateMinutes,
        lateReason: isLate ? `Presensi Masuk via Kiosk Mandiri (${lateMinutes}m keterlambatan).` : undefined,
        approvalStatus: isLate ? 'PENDING' : 'APPROVED',
        biometricVerification: {
          isVerified: true,
          matchScore,
          matchedPose,
          livenessPassed: true,
          details: `Pengenalan Wajah Otomatis 1:N (${matchScore}% Cocok • Pose ${matchedPose.toUpperCase()} • Mode: ${autoType})`
        }
      };

      const res = await api.submitPublicAttendance(record);
      setSubmittedRecord(res.record || record);

      // Update local todayAttendances so subsequent scans immediately know the new state
      setTodayAttendances(prev => ({
        ...prev,
        [emp.id]: {
          ...(prev[emp.id] || {}),
          id: res.record?.id || record.id,
          employeeId: emp.id,
          date: dateStr,
          checkInTime: isClockIn ? timeStr : (existingToday?.checkInTime || timeStr),
          checkOutTime: isClockIn ? (existingToday?.checkOutTime || null) : timeStr,
          status: isLate ? 'LATE' : 'ON_TIME',
          isLate,
          lateMinutes
        }
      }));

      playTone(1318.51, 'sine', 0.45); // celebration chime

      // 4-second auto-reset timer for the next employee
      let count = 4;
      setResetCountdown(count);
      resetTimerRef.current = setInterval(() => {
        count -= 1;
        setResetCountdown(count);
        if (count <= 0) {
          clearInterval(resetTimerRef.current);
          handleResetToNewEmployee();
        }
      }, 1000);
    } catch (err: any) {
      alert(`Gagal mengirim presensi otomatis: ${err.message || 'Error jaringan'}`);
      isAutoProcessingRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manual Trigger Snapshot for selected employee (Manual Fallback)
  const handleManualSnapshot = async (emp: any, actionTypeOverride?: 'CHECK_IN' | 'CHECK_OUT') => {
    if (!emp || !videoRef.current || videoRef.current.videoWidth === 0) return;

    // Evaluasi Geofence sebelum snap
    const targetGeofence = getEmployeeTargetGeofence(emp);
    const distMeters = calculateDistanceMeters(
      gpsLocation.lat,
      gpsLocation.lng,
      targetGeofence.lat,
      targetGeofence.lng
    );

    if (!isGpsLocked || gpsLocation.lat === 0) {
      alert(gpsError || 'Sedang mengunci sinyal GPS aktual perangkat. Harap pastikan fitur Lokasi aktif dan izinkan browser membaca GPS.');
      return;
    }

    if (distMeters > targetGeofence.radiusMeters) {
      playTone(220, 'sawtooth', 0.45);
      api.logActivity({
        action: 'KIOSK_ATTENDANCE_DENIED_GEOFENCE',
        module: 'ATTENDANCE',
        status: 'WARNING',
        details: `Presensi Kiosk Manual DITOLAK: ${emp.name} (${emp.nik}) berada di luar radius geofence (Jarak: ${distMeters}m, Toleransi: ${targetGeofence.radiusMeters}m di titik ${targetGeofence.name}).`,
        userName: emp.name,
        userNik: emp.nik,
        ipAddress: clientIp,
        metadata: {
          distMeters,
          radiusMeters: targetGeofence.radiusMeters,
          targetGeofence: targetGeofence.name,
          gps: gpsLocation
        }
      }).catch(() => {});

      setGeofenceReject({
        isOpen: true,
        employeeName: emp.name,
        distanceMeters: distMeters,
        radiusMeters: targetGeofence.radiusMeters,
        targetName: targetGeofence.name
      });
      return;
    }

    isAutoProcessingRef.current = true;
    await handleAutoSnapAndSubmit(emp, 90, 'front', targetGeofence, distMeters, actionTypeOverride || attendanceAction);
  };

  const handleResetToNewEmployee = () => {
    if (resetTimerRef.current) clearInterval(resetTimerRef.current);
    setSelectedEmployee(null);
    setSearchQuery('');
    setCapturedPhoto(null);
    setBiometricResult(null);
    setSubmittedRecord(null);
    setDetectedCandidate(null);
    setHumanPresence(null);
    setGeofenceReject(null);
    setRecognitionProgress(0);
    isAutoProcessingRef.current = false;
    setResetCountdown(4);
    if (!cameraActive) {
      startCamera();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white font-sans flex flex-col justify-between selection:bg-[#FF6B00] selection:text-white">
      {/* 1. KIOSK TOP HEADER */}
      <header className="w-full px-4 sm:px-8 py-3.5 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF6B00] to-amber-500 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-orange-500/25">
            P
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base sm:text-lg tracking-tight text-white">
                PRIME <span className="text-[#FF6B00]">HRIS</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-orange-500/20 text-[#FF6B00] border border-orange-500/30">
                KIOSK PRESENSI 1:N
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Pengenalan Wajah Otomatis Langsung • Tanpa Perlu Input ID
            </p>
          </div>
        </div>

        {/* Live RTC Clock & Switch to Admin Login */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end text-right">
            <div className="flex items-center gap-1.5 text-xs font-mono-code font-bold text-white">
              <span className="w-2 h-2 rounded-full bg-[#00E2B0] animate-pulse" />
              <span>{currentTime} WIB</span>
            </div>
            <span className="text-[10px] text-slate-400">{dayName}, {currentDate}</span>
          </div>

          <button
            type="button"
            onClick={onGoToLogin}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden xs:inline">Login Admin</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN KIOSK BODY */}
      <main className="flex-1 max-w-lg w-full mx-auto p-4 sm:p-5 flex flex-col justify-center">
        {/* SUCCESS CONFIRMATION SCREEN */}
        {submittedRecord ? (
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className={`px-3 py-1 rounded-full text-xs font-mono-code font-bold border ${
                submittedRecord.checkOutTime
                  ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                {submittedRecord.checkOutTime ? 'PRESENSI PULANG BERHASIL DITERIMA' : 'PRESENSI MASUK BERHASIL DITERIMA'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-2">
                Terima Kasih, {submittedRecord.employeeName}!
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                {submittedRecord.checkOutTime
                  ? 'Presensi pulang Anda tercatat. Selamat beristirahat!'
                  : 'Presensi masuk Anda tercatat. Selamat bertugas & utamakan K3!'}
              </p>
            </div>

            {/* Photo Preview with Stamp */}
            {submittedRecord.photoUrl && (
              <div className="relative max-w-[280px] mx-auto rounded-2xl overflow-hidden border border-slate-700 shadow-md">
                <img src={submittedRecord.photoUrl} alt="Bukti Presensi" className="w-full h-auto object-cover" />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/80 text-[9px] font-mono-code text-white">
                  {submittedRecord.date} {submittedRecord.checkInTime} WIB
                </div>
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-left text-xs space-y-1.5">
              <div className="flex justify-between text-slate-300">
                <span>NIK & Karyawan:</span>
                <span className="font-bold text-white">{submittedRecord.employeeNik} • {submittedRecord.employeeName}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Jam Masuk:</span>
                <span className="font-mono-code text-[#00E2B0] font-bold">{submittedRecord.checkInTime} WIB</span>
              </div>
              {submittedRecord.checkOutTime && (
                <div className="flex justify-between text-slate-300">
                  <span>Jam Pulang:</span>
                  <span className="font-mono-code text-orange-400 font-bold">{submittedRecord.checkOutTime} WIB</span>
                </div>
              )}
              <div className="flex justify-between text-slate-300">
                <span>Status Kedatangan:</span>
                <span className={`font-bold ${submittedRecord.isLate ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {submittedRecord.isLate ? `Terlambat (${submittedRecord.lateMinutes} menit)` : 'Tepat Waktu'}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Verifikasi 1:N:</span>
                <span className="text-emerald-300 font-bold">
                  {submittedRecord.biometricVerification?.matchScore
                    ? `${submittedRecord.biometricVerification.matchScore}% Match (Terverifikasi Otomatis)`
                    : 'Wajah Cocok'}
                </span>
              </div>
            </div>

            {/* Countdown Auto Reset */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleResetToNewEmployee}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#FF6B00] to-amber-500 hover:from-[#e56000] hover:to-amber-600 text-white font-black text-sm shadow-xl shadow-orange-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Siap untuk Karyawan Berikutnya ({resetCountdown}s)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* PRIMARY VIEW: LIVE CAMERA WITH REAL-TIME 1:N FACE RECOGNITION */
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4 shadow-2xl backdrop-blur-md">
            
            {/* DUAL MODE SELECTOR: CHECK IN (MASUK) vs CHECK OUT (PULANG) */}
            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
              <button
                type="button"
                onClick={() => {
                  setAttendanceAction('CHECK_IN');
                  playTone(523.25, 'sine', 0.1);
                }}
                className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  attendanceAction === 'CHECK_IN'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50 border border-emerald-400/50 scale-[1.01]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${attendanceAction === 'CHECK_IN' ? 'bg-white animate-pulse' : 'bg-emerald-500/60'}`} />
                <span>ABSEN MASUK (CHECK IN)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAttendanceAction('CHECK_OUT');
                  playTone(659.25, 'sine', 0.1);
                }}
                className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  attendanceAction === 'CHECK_OUT'
                    ? 'bg-gradient-to-r from-[#FF6B00] to-amber-600 text-white shadow-lg shadow-orange-900/50 border border-orange-400/50 scale-[1.01]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${attendanceAction === 'CHECK_OUT' ? 'bg-white animate-pulse' : 'bg-orange-500/60'}`} />
                <span>ABSEN PULANG (CHECK OUT)</span>
              </button>
            </div>

            {/* Smart Contextual Header: Reflects Active Action & Target Status */}
            {(() => {
              if (liveSyncStatus.status === 'DENIED' && !detectedCandidate) {
                return (
                  <div className="flex items-center justify-between p-2.5 px-4 rounded-2xl bg-amber-950/70 border border-amber-500/50 text-xs shadow-md">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span className="font-bold text-amber-300 tracking-wide uppercase">Wajah Belum Terdaftar</span>
                        <p className="text-[10px] text-amber-200/90">{liveSyncStatus.details || 'Gunakan tombol Cari Nama di bawah jika belum mendaftarkan wajah.'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsManualSearchOpen(true)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[10px] font-bold shrink-0"
                    >
                      Cari Nama
                    </button>
                  </div>
                );
              }

              if (liveSyncStatus.status === 'EMPTY_GALLERY') {
                return (
                  <div className="flex items-center justify-between p-2.5 px-4 rounded-2xl bg-amber-950/70 border border-amber-500/50 text-xs shadow-md">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span className="font-bold text-amber-300">Galeri Biometrik 0 Terdaftar</span>
                        <p className="text-[10px] text-amber-200/80">Silakan gunakan mode Pencarian Manual di bawah</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono bg-amber-900/80 px-2 py-0.5 rounded text-amber-200 border border-amber-600/40">
                      STANDBY
                    </span>
                  </div>
                );
              }

              const activeEmp = detectedCandidate?.matchedItem?.employee || selectedEmployee;
              if (!activeEmp) {
                return (
                  <div className={`flex items-center justify-between p-2.5 px-4 rounded-2xl border text-xs shadow-inner ${
                    attendanceAction === 'CHECK_IN'
                      ? 'bg-emerald-950/40 border-emerald-500/30'
                      : 'bg-orange-950/40 border-orange-500/30'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Sparkles className={`w-4 h-4 animate-pulse ${attendanceAction === 'CHECK_IN' ? 'text-emerald-400' : 'text-[#FF6B00]'}`} />
                      <span className="font-bold text-slate-200">
                        Mode Aktif: {attendanceAction === 'CHECK_IN' ? '🟢 Presensi Masuk (Check-In)' : '🟠 Presensi Pulang (Check-Out)'}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">Touchless AI • 1:N Kamera</span>
                  </div>
                );
              }

              const sched = getEmployeeProjectSchedule(activeEmp, projects, '08:30');
              const rec = todayAttendances[activeEmp.id];

              if (attendanceAction === 'CHECK_IN') {
                if (rec?.checkInTime) {
                  return (
                    <div className="flex items-center justify-between p-2.5 px-4 rounded-2xl bg-amber-950/80 border border-amber-500/60 text-xs shadow-md">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <span className="font-black text-amber-300 uppercase">SUDAH CHECK-IN</span>
                          <p className="text-[10px] text-amber-200">{activeEmp.name} sudah masuk pukul {rec.checkInTime} WIB</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAttendanceAction('CHECK_OUT');
                          playTone(659.25, 'sine', 0.1);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-[10px] cursor-pointer shadow transition"
                      >
                        Ganti ke Pulang →
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="flex items-center justify-between p-2.5 px-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-xs shadow-md shadow-emerald-900/30">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="font-black text-emerald-300 tracking-wide uppercase">SIAP: ABSEN MASUK • {activeEmp.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-mono font-bold text-emerald-400">
                        Shift: {sched.checkInTime} - {sched.checkOutTime}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1.5">(Cutoff {sched.cutoffTime})</span>
                    </div>
                  </div>
                );
              }

              // AttendanceAction === 'CHECK_OUT'
              if (!rec?.checkInTime) {
                return (
                  <div className="flex items-center justify-between p-2.5 px-4 rounded-2xl bg-amber-950/80 border border-amber-500/60 text-xs shadow-md">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span className="font-black text-amber-300 uppercase">BELUM CHECK-IN</span>
                        <p className="text-[10px] text-amber-200">{activeEmp.name} belum tercatat Masuk hari ini.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAttendanceAction('CHECK_IN');
                        playTone(523.25, 'sine', 0.1);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-[10px] cursor-pointer shadow transition"
                    >
                      Ganti ke Masuk →
                    </button>
                  </div>
                );
              }

              return (
                <div className="flex items-center justify-between p-2.5 px-4 rounded-2xl bg-orange-950/70 border border-orange-500/50 text-xs shadow-md shadow-orange-900/30">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF6B00]"></span>
                    </span>
                    <span className="font-black text-orange-300 tracking-wide uppercase">SIAP: ABSEN PULANG • {activeEmp.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-mono font-bold text-orange-400">
                      Masuk Hari Ini: {rec.checkInTime} WIB
                    </span>
                    {rec.checkOutTime && (
                      <span className="text-[10px] text-amber-300 ml-1.5">(Pembaruan)</span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Mode Presensi Khusus 1:1 Banner jika Karyawan Dipilih */}
            {selectedEmployee && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-orange-950/80 border border-orange-500/60 shadow-lg animate-in fade-in duration-150">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#FF6B00] text-white font-black flex items-center justify-center text-xs shadow-md">
                    {selectedEmployee.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">{selectedEmployee.name}</div>
                    <div className="text-[10px] text-orange-300 font-mono">
                      Mode 1:1 ({attendanceAction === 'CHECK_IN' ? 'Absen Masuk' : 'Absen Pulang'}) • {selectedEmployee.nik}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleManualSnapshot(selectedEmployee, attendanceAction)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md ${
                      attendanceAction === 'CHECK_IN'
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-900/30'
                        : 'bg-gradient-to-r from-[#FF6B00] to-amber-500 text-white shadow-orange-900/30'
                    }`}
                  >
                    {attendanceAction === 'CHECK_IN' ? 'Catat Masuk' : 'Catat Pulang'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedEmployee(null); setRecognitionProgress(0); }}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    title="Kembali ke Mode 1:N Otomatis"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Camera Viewfinder (Smartphone Portrait 3:4) */}
            <div className="relative w-full max-w-[340px] aspect-[3/4] mx-auto rounded-3xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-2xl flex items-center justify-center select-none">
              {shutterFlash && (
                <div className="absolute inset-0 bg-white/90 z-30 pointer-events-none transition-opacity duration-200" />
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
                <div className="text-center p-6 space-y-2">
                  <Camera className="w-8 h-8 text-[#FF6B00] mx-auto animate-pulse" />
                  <p className="text-xs font-bold text-white">Menghubungkan Kamera...</p>
                  {cameraError && (
                    <p className="text-[10px] text-rose-400 max-w-xs">{cameraError}</p>
                  )}
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-bold mt-2"
                  >
                    Nyalakan Ulang
                  </button>
                </div>
              )}

              {/* Dynamic Scanning Reticle & Lock-on Ring */}
              {cameraActive && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={`relative w-64 h-80 rounded-[48px] border-2 transition-all duration-300 flex flex-col items-center justify-between p-3.5 ${
                      liveSyncStatus.status === 'DENIED' && !detectedCandidate
                        ? 'border-amber-500/70 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                        : detectedCandidate
                        ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.35)]'
                        : humanPresence?.isPresent
                        ? 'border-cyan-400 bg-cyan-500/5 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                        : 'border-dashed border-slate-600/70 bg-slate-950/40'
                    }`}
                  >
                    {/* Top Guide / Identified Tag */}
                    <div className="relative z-10 px-3 py-1 rounded-full bg-slate-900/90 backdrop-blur-md text-[10px] font-mono-code font-bold shadow-md border border-slate-700/80 mt-1 max-w-[95%] truncate">
                      {detectedCandidate ? (
                        <span className="text-emerald-300 flex items-center gap-1.5 truncate">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <strong className="text-white truncate">{detectedCandidate.matchedItem.employeeName}</strong>
                          <span className="text-[9px] bg-emerald-950 px-1 py-0.2 rounded border border-emerald-500/40 text-emerald-300">TERVERIFIKASI</span>
                        </span>
                      ) : liveSyncStatus.status === 'DENIED' ? (
                        <span className="text-amber-300 flex items-center gap-1.5 truncate">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <strong className="text-amber-200 truncate">WAJAH BELUM TERDAFTAR</strong>
                        </span>
                      ) : humanPresence?.isPresent ? (
                        <span className="text-cyan-300 flex items-center gap-1.5">
                          <ScanFace className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                          <span>MEMINDAI WAJAH AI...</span>
                        </span>
                      ) : liveSyncStatus.status === 'EMPTY_GALLERY' ? (
                        <span className="text-amber-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span>GALERI KOSONG</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span>ARAHKAN WAJAH KE KAMERA</span>
                        </span>
                      )}
                    </div>

                    {/* Center Lock-on Ring / Progress */}
                    <div className="relative z-10 my-auto flex flex-col items-center justify-center">
                      {liveSyncStatus.status === 'DENIED' && !detectedCandidate ? (
                        <div className="flex flex-col items-center animate-in zoom-in-95 duration-150">
                          <div className="w-16 h-16 rounded-full bg-amber-950/85 backdrop-blur-md border-2 border-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                            <User className="w-8 h-8 text-amber-400" />
                          </div>
                          <span className="text-[10px] font-bold text-amber-300 mt-1.5 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                            Belum Dikenali
                          </span>
                        </div>
                      ) : isSubmitting || isCapturing ? (
                        <div className="w-16 h-16 rounded-full bg-slate-900/80 border-2 border-emerald-400 flex items-center justify-center shadow-lg">
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : detectedCandidate ? (
                        <div className="flex flex-col items-center animate-in zoom-in-95 duration-150">
                          <div className="w-16 h-16 rounded-full bg-slate-900/85 backdrop-blur-md border-2 border-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <span className="text-emerald-300 font-mono-code font-black text-xl">
                              {recognitionProgress}%
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-white mt-1.5 drop-shadow-md bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                            Tahan Posisi...
                          </span>
                        </div>
                      ) : humanPresence?.isPresent ? (
                        <div className="w-14 h-14 rounded-full border-2 border-cyan-400/60 border-t-cyan-400 flex items-center justify-center animate-spin">
                          <div className="w-3 h-3 rounded-full bg-cyan-400" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full border border-slate-700/80 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-slate-600 animate-ping" />
                        </div>
                      )}
                    </div>

                    {/* Bottom Status Pill */}
                    <div className="relative z-10 mb-1 max-w-[95%] text-center">
                      <div
                        className={`text-[10px] font-bold px-3 py-1 rounded-full shadow-md transition-all truncate ${
                          liveSyncStatus.status === 'DENIED'
                            ? 'bg-rose-950/90 text-rose-200 border border-rose-500/80'
                            : detectedCandidate
                            ? 'bg-emerald-600/90 text-white border border-emerald-400/80'
                            : liveSyncStatus.status === 'EMPTY_GALLERY'
                            ? 'bg-amber-950/90 text-amber-300 border border-amber-500/80'
                            : humanPresence?.isPresent
                            ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40'
                            : 'bg-slate-900/85 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {liveSyncStatus.status === 'DENIED'
                          ? `${liveSyncStatus.message} • Log Tercatat di DB`
                          : detectedCandidate
                          ? `Teridentifikasi (${detectedCandidate.score}% Match • NIK ${detectedCandidate.matchedItem.employeeNik}) • Sync DB`
                          : liveSyncStatus.status === 'EMPTY_GALLERY'
                          ? 'Galeri 0 Terdaftar • Gunakan Pencarian Manual'
                          : humanPresence?.isPresent
                          ? 'Wajah manusia terdeteksi • Memeriksa biometrik...'
                          : isIndexingGallery
                          ? 'Memuat indeks biometrik galeri...'
                          : 'Tidak ada orang terdeteksi • Arahkan wajah ke oval'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Interactive Confirmation Card (Anti-Salah Orang Gate) */}
              {pendingConfirmation && (
                <div className="absolute inset-0 z-40 bg-slate-950/92 backdrop-blur-md flex flex-col items-center justify-between p-5 text-center select-auto animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-full">
                    <span className={`px-3 py-1 rounded-full text-[10.5px] font-mono-code font-bold border ${
                      pendingConfirmation.actionType === 'CHECK_IN'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                    }`}>
                      {pendingConfirmation.actionType === 'CHECK_IN' ? '🟢 KONFIRMASI ABSEN MASUK' : '🟠 KONFIRMASI ABSEN PULANG'} • {pendingConfirmation.score}% MATCH
                    </span>
                    <h3 className="text-lg font-black text-white mt-2 leading-tight">
                      {pendingConfirmation.employee.name}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1">
                      NIK: {pendingConfirmation.employee.nik} • {pendingConfirmation.employee.department || 'Operasional'}
                    </p>
                    {pendingConfirmation.actionType === 'CHECK_OUT' && todayAttendances[pendingConfirmation.employee.id]?.checkInTime && (
                      <p className="text-[11px] text-amber-300 font-mono mt-1 font-semibold">
                        Masuk Terdata: {todayAttendances[pendingConfirmation.employee.id].checkInTime} WIB
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center">
                    <div className={`w-16 h-16 rounded-full border-2 text-2xl font-black font-mono flex items-center justify-center shadow-xl animate-pulse ${
                      pendingConfirmation.actionType === 'CHECK_IN'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-emerald-500/25'
                        : 'bg-orange-500/20 border-orange-500 text-orange-400 shadow-orange-500/25'
                    }`}>
                      {pendingConfirmation.countdown}s
                    </div>
                    <span className="text-[11px] text-slate-300 mt-2 font-medium">
                      Otomatis catat {pendingConfirmation.actionType === 'CHECK_IN' ? 'Absen Masuk' : 'Absen Pulang'} dalam {pendingConfirmation.countdown} detik...
                    </span>
                  </div>

                  <div className="w-full space-y-2 pointer-events-auto">
                    <button
                      type="button"
                      onClick={handleConfirmPendingNow}
                      className={`w-full py-2.5 px-4 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg ${
                        pendingConfirmation.actionType === 'CHECK_IN'
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/20'
                          : 'bg-gradient-to-r from-[#FF6B00] to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/25'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ya, Konfirmasi {pendingConfirmation.actionType === 'CHECK_IN' ? 'Absen Masuk' : 'Absen Pulang'}</span>
                    </button>

                    {/* Quick Switch Action Type in Modal */}
                    <button
                      type="button"
                      onClick={() => {
                        const newAction = pendingConfirmation.actionType === 'CHECK_IN' ? 'CHECK_OUT' : 'CHECK_IN';
                        setPendingConfirmation(prev => prev ? ({ ...prev, actionType: newAction }) : null);
                        setAttendanceAction(newAction);
                        playTone(587.33, 'sine', 0.1);
                      }}
                      className="w-full py-1.5 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-cyan-300 hover:text-white border border-cyan-500/30 text-[10.5px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3 h-3 text-cyan-400" />
                      <span>⇄ Ganti Jadi {pendingConfirmation.actionType === 'CHECK_IN' ? 'Absen Pulang' : 'Absen Masuk'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCancelPendingConfirmation}
                      className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-rose-950/80 hover:text-rose-300 text-slate-300 font-bold text-xs border border-slate-700 hover:border-rose-500/50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      <span>Bukan Saya / Ganti Nama</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Status Header Overlay */}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-700 text-white text-[9px] font-mono-code">
                <span className={`w-1.5 h-1.5 rounded-full ${cameraActive ? 'bg-[#00E2B0] animate-ping' : 'bg-slate-500'}`} />
                <span>AI 1:N KIOSK</span>
              </div>
            </div>

            {/* GPS & Network Details Pill */}
            <div className="p-2.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-300 truncate">
                  <MapPin className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                  <span className="truncate">{gpsLocation.address}</span>
                </div>
                <span className={`text-[10px] font-mono-code font-bold shrink-0 ${
                  isGpsLocked && gpsLocation.lat !== 0 ? 'text-emerald-400' : gpsError ? 'text-rose-400' : 'text-amber-400 animate-pulse'
                }`}>
                  {isGpsLocked && gpsLocation.lat !== 0 ? `${gpsLocation.lat}, ${gpsLocation.lng} (?${gpsLocation.accuracy}m)` : gpsError ? 'GPS Tidak Aktif' : 'Mencari GPS...'}
                </span>
              </div>
            </div>

            {/* Quick 1:1 Employee Selector Bar (Pencegah Salah Orang Mutlak) */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span className="font-semibold flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>Presensi Mandiri Terpilih (1:1):</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsManualSearchOpen(true)}
                  className="text-orange-400 hover:underline flex items-center gap-1 cursor-pointer font-bold text-[10.5px]"
                >
                  <Search className="w-3 h-3" />
                  <span>Cari Nama ({employees.length})</span>
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {employees.filter(e => e.hasBiometric || e.id === 'EMP-001').slice(0, 5).map(emp => {
                  const rec = todayAttendances[emp.id];
                  const hasIn = Boolean(rec?.checkInTime);
                  const hasOut = Boolean(rec?.checkOutTime);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => {
                        setSelectedEmployee(emp);
                        setPendingConfirmation(null);
                        setRecognitionProgress(0);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 border ${
                        selectedEmployee?.id === emp.id
                          ? 'bg-[#FF6B00] text-white border-orange-400 shadow-md shadow-orange-500/25'
                          : 'bg-slate-800/90 hover:bg-slate-750 text-slate-200 border-slate-700/80'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${hasOut ? 'bg-orange-400' : hasIn ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
                      <span>{emp.name.split(',')[0]}</span>
                      {attendanceAction === 'CHECK_IN' && hasIn && (
                        <span className="text-[9px] text-emerald-300 font-mono">✓In</span>
                      )}
                      {attendanceAction === 'CHECK_OUT' && hasOut && (
                        <span className="text-[9px] text-orange-300 font-mono">✓Out</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. MANUAL SEARCH MODAL FALLBACK */}
      {isManualSearchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsManualSearchOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-[#FF6B00] flex items-center justify-center mx-auto mb-1">
                <UserCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-white">Pencarian Manual Karyawan</h3>
              <p className="text-xs text-slate-400">Pilih identitas Anda jika wajah belum terdaftar di sistem 1:N:</p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Ketik ID Login (d001..), NIK, atau Nama..."
                autoFocus
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#FF6B00]"
              />
            </div>

            {/* List */}
            <div className="space-y-1.5 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
              {filteredEmployees.map(emp => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    setSelectedEmployee(emp);
                    setIsManualSearchOpen(false);
                    playTone(659.25, 'sine', 0.1);
                    handleManualSnapshot(emp, attendanceAction);
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-orange-500 text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden border border-slate-600 shrink-0">
                      {emp.avatar ? (
                        <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-300">
                          {emp.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-white truncate">{emp.name}</p>
                      <p className="text-[10px] text-slate-400">{emp.nik} • {emp.loginUsername || '-'}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3b. GEOFENCE REJECTION MODAL ALERT */}
      {geofenceReject?.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-rose-500/50 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative text-center">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20 animate-pulse">
              <AlertOctagon className="w-9 h-9" />
            </div>

            <div>
              <span className="px-3 py-1 rounded-full text-xs font-mono-code font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                ⛔ LOKASI PRESENSI DITOLAK
              </span>
              <h3 className="text-lg sm:text-xl font-black text-white mt-2.5">
                Di Luar Zona Toleransi Presensi
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Halo <strong className="text-white">{geofenceReject.employeeName}</strong>, presensi Anda tidak dapat diterima karena posisi GPS Anda terdeteksi di luar radius lokasi resmi yang ditetapkan.
              </p>
            </div>

            {/* Distance Comparison Card */}
            <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700/80 text-left text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-300">
                <span>Titik Lokasi Resmi:</span>
                <span className="font-bold text-white text-right max-w-[200px] truncate">{geofenceReject.targetName}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Batas Radius Toleransi:</span>
                <span className="font-mono-code text-emerald-400 font-bold">{geofenceReject.radiusMeters} Meter</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Jarak Anda Saat Ini:</span>
                <span className="font-mono-code text-rose-400 font-extrabold text-sm">{geofenceReject.distanceMeters} Meter</span>
              </div>
              <div className="pt-2 border-t border-slate-700 flex justify-between items-center">
                <span className="text-slate-400">Status Validasi:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                  DILUAR RADIUS ({geofenceReject.distanceMeters - geofenceReject.radiusMeters}m selisih)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-left flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <p>
                <strong>Peringatan Sistem:</strong> Harap masuk ke dalam zona radius toleransi ({geofenceReject.radiusMeters}m) dari titik resmi atau aktifkan GPS dengan akurasi tinggi, lalu coba kembali.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setGeofenceReject(null);
                  isAutoProcessingRef.current = false;
                }}
                className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-500/25 transition-all cursor-pointer"
              >
                Saya Mengerti & Coba Lagi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. KIOSK FOOTER */}
      <footer className="w-full px-4 py-3 bg-slate-900/60 border-t border-slate-800/80 text-center text-xs text-slate-500">
        <p>Prime HRIS Kiosk Gateway • PT Prime Infinity Systems • Pengenalan Wajah Otomatis 1:N Aktif</p>
      </footer>
    </div>
  );
};
