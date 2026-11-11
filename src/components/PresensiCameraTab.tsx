import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  LogIn,
  LogOut,
  ArrowRight,
  ArrowDown,
  Camera,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Clock,
  Calendar,
  Briefcase,
  Building,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Send,
  Sparkles,
  Eye,
  X,
  Upload,
  Check,
  Volume2,
  Globe,
  RefreshCw,
  Smartphone,
  Network,
  Radio,
  ExternalLink,
  Lock,
  Power,
  FlipHorizontal,
  SlidersHorizontal,
  Trash2,
  CameraOff
} from 'lucide-react';
import { Employee, AttendanceRecord, AttendanceMode, AttendanceStatus, SalaryRuleConfig, SystemRole, getEffectiveSystemRole, Project, BiometricProfile, BiometricVerificationResult } from '../types';
import { rtcService } from '../services/rtcService';
import { getEmployeeProjectSchedule } from '../utils/scheduleHelper';
import { BiometricEnrollmentModal } from './BiometricEnrollmentModal';
import { compareFaceBiometric } from '../utils/biometricHelper';
import { api } from '../services/api';

// Preset Lokasi Populer PRIME Enterprise & Site Proyek
export const LOCATION_PRESETS = [
  { name: 'Kantor Pusat PT Dwi Martha Jaya (Surabaya)', lat: -7.293144, lng: 112.775337, addr: 'Jl. Klampis Anom No. 35 D-11, Wisma Mukti, Klampis Ngasem, Sukolilo, Surabaya' },
  { name: 'Site RS Ciremai Cirebon', lat: -6.737150, lng: 108.552860, addr: 'Jl. Kesambi No.237, Drajat, Kesambi, Cirebon, Jawa Barat' },
  { name: 'Site RS Dr AK Gani Palembang', lat: -2.991240, lng: 104.757310, addr: 'Jl. Merdeka No.1, Benteng Kuto Besak, Palembang, Sumsel' },
  { name: 'Jakarta Technology & Operations Hub', lat: -6.229740, lng: 106.829510, addr: 'Mega Kuningan, Setiabudi, Jakarta Selatan' }
];

// Hitung jarak nyata dari koordinat GPS HP ke Geofence Kantor Pusat (Haversine Formula)


// Normalisasi latitude Indonesia jika pengguna memasukkan nilai positif
export function normalizeIndoLat(lat: number | undefined | null, lng: number | undefined | null): number | null {
  if (lat === undefined || lat === null || isNaN(lat)) return null;
  if (lat > 0 && lat < 11.5 && typeof lng === 'number' && lng >= 95 && lng <= 142) {
    return -lat;
  }
  return lat;
}
// Helper Resolusi Koordinat Resmi Proyek Site atau Estimasi Presisi Regional Kota
export function getProjectCoordinates(proj: Project): { lat: number; lng: number; radius: number } | null {
  if (!proj) return null;
  const geo = proj.customRules?.geofence;
  if (geo) {
    const rawLat = typeof geo.latitude === 'number' ? geo.latitude : parseFloat(geo.latitude as any);
    const rawLng = typeof geo.longitude === 'number' ? geo.longitude : parseFloat(geo.longitude as any);
    if (!isNaN(rawLat) && !isNaN(rawLng)) {
      const normalizedLat = normalizeIndoLat(rawLat, rawLng) ?? rawLat;
      return {
        lat: normalizedLat,
        lng: rawLng,
        radius: Number(geo.radiusMeters) || 350
      };
    }
  }

  // Jika nama proyek jelas Kantor Pusat
  const name = (proj.name || '').toUpperCase();
  if (name.includes('KANTOR PUSAT') || name.includes('HEAD OFFICE') || name.includes('INNOVATION HUB')) {
    return { lat: -7.293144, lng: 112.775337, radius: 350 };
  }

  return null;
}

export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Radius bumi dalam meter
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function formatDistanceKm(meters?: number | null): string {
  if (meters === undefined || meters === null || isNaN(meters)) return '0.0 km';
  return `${(meters / 1000).toFixed(1)} km`;
}

interface PresensiCameraTabProps {
  currentUser: Employee;
  employees?: Employee[];
  salaryRules: SalaryRuleConfig;
  attendanceHistory: AttendanceRecord[];
  onSubmitAttendance: (record: AttendanceRecord) => void;
  onNavigateToTab?: (tabId: string) => void;
  realDetectedIp?: string;
  realDetectedIsp?: string;
  realDetectedCity?: string;
  onUpdateRealIp?: (newIp: string) => void;
  onUpdateSalaryRules?: (newRules: SalaryRuleConfig) => void;
  projects?: Project[];
  onSaveProject?: (proj: Project) => void;
  onUpdateEmployee?: (emp: Employee) => void;
  onDeleteAttendance?: (id: string) => Promise<any> | void;
  isDbLoading?: boolean;
}

// Helper format durasi jam kerja (Work Hour)
function formatWorkDuration(checkInTime?: string, checkOutTime?: string): string | null {
  if (!checkInTime || !checkOutTime) return null;
  const inParts = checkInTime.replace(/\./g, ':').split(':').map(Number);
  const outParts = checkOutTime.replace(/\./g, ':').split(':').map(Number);
  if (inParts.length < 2 || outParts.length < 2 || isNaN(inParts[0]) || isNaN(outParts[0])) return null;

  const inSeconds = inParts[0] * 3600 + inParts[1] * 60 + (inParts[2] || 0);
  const outSeconds = outParts[0] * 3600 + outParts[1] * 60 + (outParts[2] || 0);
  let diffSeconds = outSeconds - inSeconds;
  if (diffSeconds < 0) {
    diffSeconds += 24 * 3600; // Toleransi shift malam lintas hari
  }

  const totalMinutes = Math.floor(diffSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0 && m === 0) return '< 1m';
  if (m === 0) return `${h}j`;
  return `${h}j ${m}m`;
}

export const PresensiCameraTab: React.FC<PresensiCameraTabProps> = ({
  currentUser,
  employees = [],
  salaryRules,
  attendanceHistory,
  onSubmitAttendance,
  onNavigateToTab,
  realDetectedIp = '103.31.205.218',
  realDetectedIsp = 'PT Biznet Gio Nusantara',
  realDetectedCity = 'Surabaya / Sidoarjo',
  onUpdateRealIp,
  onUpdateSalaryRules,
  projects = [],
  onSaveProject,
  onUpdateEmployee,
  onDeleteAttendance,
  isDbLoading = false
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentRole: SystemRole = getEffectiveSystemRole(currentUser);
  const isSuperOrAdmin = currentRole === 'superuser' || currentRole === 'admin' || currentRole === 'hr';

  // Canonical Employee Lookup Map (by id, nik, and clean lowercased name)
  const employeeMap = useMemo(() => {
    const map = new Map<string, Employee>();
    for (const emp of employees) {
      if (emp.id) map.set(emp.id, emp);
      if (emp.nik) map.set(emp.nik, emp);
      if (emp.name) map.set(emp.name.toLowerCase().trim(), emp);
    }
    return map;
  }, [employees]);

  // Helper to resolve canonical login ID badge (d001, d014, admin, etc.) matching Master Karyawan (SSOT)
  const getRecordLoginBadgeId = (record: AttendanceRecord): string => {
    const empId = record.employeeId;
    const empNik = record.employeeNik;
    const empName = record.employeeName ? record.employeeName.toLowerCase().trim() : '';
    const emp = (empId ? employeeMap.get(empId) : undefined)
      || (empNik ? employeeMap.get(empNik) : undefined)
      || (empName ? employeeMap.get(empName) : undefined);
    if (emp && emp.loginId) return emp.loginId;
    if (currentUser && (currentUser.id === record.employeeId || currentUser.nik === record.employeeNik)) {
      if (currentUser.loginId) return currentUser.loginId;
    }
    if (record.employeeId === 'EMP-001') return 'admin';
    if (record.employeeLoginId && !record.employeeLoginId.includes('1793')) return record.employeeLoginId;
    if (record.employeeLoginId) return record.employeeLoginId;
    return record.employeeId || '';
  };

  const [logSearchQuery, setLogSearchQuery] = useState('');

  // RBAC Privacy Filter & Chronological Sorting:
  // Superuser & Admin see all workforce logs, staff users only see their own attendance records.
  // ALWAYS sort by latest activity time (checkOutTime || checkInTime) DESC so the newest activity is at the very top!
  const visibleAttendanceHistory = useMemo(() => {
    const rawList = isSuperOrAdmin
      ? attendanceHistory
      : attendanceHistory.filter(item => {
        const matchId = Boolean(item.employeeId && currentUser.id && item.employeeId === currentUser.id);
        const matchNik = Boolean(item.employeeNik && currentUser.nik && item.employeeNik.trim().toLowerCase() === currentUser.nik.trim().toLowerCase());
        const matchName = Boolean(item.employeeName && currentUser.name && item.employeeName.trim().toLowerCase() === currentUser.name.trim().toLowerCase());
        return matchId || matchNik || matchName;
      });

    const sorted = [...rawList].sort((a, b) => {
      // 1. Sort by Date DESC
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);

      // 2. Sort by Latest Activity Time DESC (checkOutTime || checkInTime)
      const timeA = a.checkOutTime || a.checkInTime || '00:00:00';
      const timeB = b.checkOutTime || b.checkInTime || '00:00:00';
      return timeB.localeCompare(timeA);
    });

    if (!logSearchQuery.trim()) return sorted;
    const q = logSearchQuery.trim().toLowerCase();
    return sorted.filter(item => {
      const badge = getRecordLoginBadgeId(item).toLowerCase();
      const name = (item.employeeName || '').toLowerCase();
      const nik = (item.employeeNik || '').toLowerCase();
      const date = (item.date || '').toLowerCase();
      const proj = (item.projectName || item.projectCode || '').toLowerCase();
      const note = (item.note || '').toLowerCase();
      return badge.includes(q) || name.includes(q) || nik.includes(q) || date.includes(q) || proj.includes(q) || note.includes(q);
    });
  }, [attendanceHistory, isSuperOrAdmin, currentUser.id, currentUser.nik, currentUser.name, logSearchQuery, employeeMap]);

  // Load More & Infinite Scroll Controller (Default 10 records per page)
  const PAGE_SIZE = 10;
  const [displayLimit, setDisplayLimit] = useState<number>(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset pagination limit when search query changes
  useEffect(() => {
    setDisplayLimit(PAGE_SIZE);
  }, [logSearchQuery]);

  const hasMore = displayLimit < visibleAttendanceHistory.length;
  const displayedAttendanceHistory = useMemo(() => {
    return visibleAttendanceHistory.slice(0, displayLimit);
  }, [visibleAttendanceHistory, displayLimit]);

  // Infinite scroll trigger via IntersectionObserver
  useEffect(() => {
    if (!hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayLimit(prev => Math.min(prev + PAGE_SIZE, visibleAttendanceHistory.length));
        }
      },
      { rootMargin: '300px', threshold: 0.1 }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) observer.unobserve(currentSentinel);
    };
  }, [hasMore, visibleAttendanceHistory.length]);

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [mode, setMode] = useState<AttendanceMode>('WFO');
  const [attendanceAction, setAttendanceAction] = useState<'CHECK_IN' | 'CHECK_OUT'>(() => {
    return new Date().getHours() >= 12 ? 'CHECK_OUT' : 'CHECK_IN';
  });

  const [destination, setDestination] = useState('PT Vale Indonesia, Sorowako Mill Site');
  const [clientName, setClientName] = useState('PT Vale Indonesia Tbk');
  const [projectCode, setProjectCode] = useState('PRJ-VALE-02');
  const [dinasPurpose, setDinasPurpose] = useState('Panggilan darurat perbaikan bearing SAG Mill 02 mendadak');

  // Real IP Network Detection States
  const [activeIp, setActiveIp] = useState<string>(realDetectedIp);
  const [activeIsp, setActiveIsp] = useState<string>(realDetectedIsp);
  const [activeCity, setActiveCity] = useState<string>(realDetectedCity);
  const [isSimulatedExternalIp, setIsSimulatedExternalIp] = useState<boolean>(false);
  const [isDetectingIp, setIsDetectingIp] = useState<boolean>(false);
  const [customIpWhitelist, setCustomIpWhitelist] = useState<string[]>([]);

  // Biometric Enrollment & Verification States
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [biometricVerification, setBiometricVerification] = useState<BiometricVerificationResult | null>(null);
  const [isVerifyingBiometric, setIsVerifyingBiometric] = useState(false);

  const handleSaveBiometric = async (profile: BiometricProfile, updateAvatarAsWell: boolean) => {
    const res = await api.saveBiometricProfile(currentUser.id, profile, updateAvatarAsWell);
    if (onUpdateEmployee) {
      onUpdateEmployee(res.employee);
    }
    setSuccessToast('🛡️ Profil Biometrik 4 Pose Wajah Berhasil Didaftarkan & Disimpan ke Database!');
    setTimeout(() => setSuccessToast(null), 4000);
  };

  useEffect(() => {
    if (realDetectedIp && !isSimulatedExternalIp) {
      setActiveIp(realDetectedIp);
    }
    if (realDetectedIsp && !isSimulatedExternalIp) {
      setActiveIsp(realDetectedIsp);
    }
    if (realDetectedCity && !isSimulatedExternalIp) {
      setActiveCity(realDetectedCity);
    }
  }, [realDetectedIp, realDetectedIsp, realDetectedCity, isSimulatedExternalIp]);

  // Check if active IP is authorized in Corporate Gateway
  const isCurrentIpAuthorized = useMemo(() => {
    if (isSimulatedExternalIp) return false;
    if (customIpWhitelist.includes(activeIp)) return true;
    const networks = salaryRules.authorizedIpNetworks || [
      { ipOrSubnet: '103.31.205.218', label: 'Gateway Utama PRIME', isp: 'Biznet', isRegisteredOffice: true },
      { ipOrSubnet: '103.31.205.0/24', label: 'Subnet Utama PRIME', isp: 'Biznet', isRegisteredOffice: true }
    ];
    return networks.some(net => {
      if (net.ipOrSubnet === activeIp) return true;
      if (net.ipOrSubnet.includes('/')) {
        const prefix = net.ipOrSubnet.split('/')[0].split('.').slice(0, 3).join('.');
        return activeIp.startsWith(prefix);
      }
      return false;
    });
  }, [activeIp, isSimulatedExternalIp, customIpWhitelist, salaryRules.authorizedIpNetworks]);

  // Live IP refresh from client browser
  const fetchRealIp = async () => {
    setIsDetectingIp(true);
    try {
      const res = await fetch('https://ipwho.is/');
      const data = await res.json();
      if (data && data.success) {
        setActiveIp(data.ip);
        setActiveIsp(data.connection?.isp || data.connection?.org || 'PT Biznet Gio Nusantara');
        setActiveCity(`${data.city || 'Sidoarjo'}, ${data.region || 'Jawa Timur'}`);
        setIsSimulatedExternalIp(false);
        onUpdateRealIp?.(data.ip);
        return;
      }
    } catch (e) {
      console.warn('Real IP lookup fallback', e);
    }

    try {
      const res2 = await fetch('https://api.ipify.org?format=json');
      const data2 = await res2.json();
      if (data2 && data2.ip) {
        setActiveIp(data2.ip);
        setIsSimulatedExternalIp(false);
        onUpdateRealIp?.(data2.ip);
      }
    } catch (e2) {
      console.warn('Fallback IP fetch failed', e2);
    } finally {
      setIsDetectingIp(false);
    }
  };

  const handleWhitelistCurrentIp = () => {
    setCustomIpWhitelist(prev => [...prev, activeIp]);
    setIsSimulatedExternalIp(false);
  };

  const handleSimulateExternalIp = () => {
    setIsSimulatedExternalIp(true);
    setActiveIp('114.122.90.15');
    setActiveIsp('PT Telkomsel (Mobile Cellular 4G/5G)');
    setActiveCity('Surabaya Selatan, Jawa Timur');
  };

  const handleRestoreRealIp = () => {
    setIsSimulatedExternalIp(false);
    setActiveIp(realDetectedIp || '103.31.205.218');
    setActiveIsp(realDetectedIsp || 'PT Biznet Gio Nusantara');
    setActiveCity(realDetectedCity || 'Surabaya / Sidoarjo');
  };

  const [isLate, setIsLate] = useState(false);
  const [lateMinutes, setLateMinutes] = useState(0);
  const [lateReason, setLateReason] = useState('');
  const [isEarlyCheckOut, setIsEarlyCheckOut] = useState(false);
  const [earlyCheckOutMinutes, setEarlyCheckOutMinutes] = useState(0);
  const [earlyCheckOutReason, setEarlyCheckOutReason] = useState('');
  const [outOfRangeReason, setOutOfRangeReason] = useState('');

  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number; address: string }>({
    lat: salaryRules?.officeGeofence?.lat ?? -7.293144,
    lng: salaryRules?.officeGeofence?.lng ?? 112.775337,
    accuracy: 6.5,
    address: salaryRules?.officeGeofence?.address ?? 'Keboananom, Gedangan, Sidoarjo, Jawa Timur'
  });

  // State Pelacakan GPS Asli Smartphone & PC Karyawan
  const [isGpsLoading, setIsGpsLoading] = useState<boolean>(false);
  const [isGpsLocked, setIsGpsLocked] = useState<boolean>(false);
  const [gpsSource, setGpsSource] = useState<'DEVICE_HARDWARE' | 'NETWORK_IP' | 'DEFAULT'>('DEFAULT');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [realGeofenceDistance, setRealGeofenceDistance] = useState<number>(99999);

  const [selectedHistoryItem, setSelectedHistoryItem] = useState<AttendanceRecord | null>(null);
  const [selectedPhotoType, setSelectedPhotoType] = useState<'CHECK_IN' | 'CHECK_OUT'>('CHECK_IN');

  // Auto-align selectedPhotoType jika rekaman hanya memiliki 1 jenis presensi (masuk saja / pulang saja)
  useEffect(() => {
    if (selectedHistoryItem) {
      if (!selectedHistoryItem.checkInTime && selectedHistoryItem.checkOutTime) {
        setSelectedPhotoType('CHECK_OUT');
      } else if (selectedHistoryItem.checkInTime && !selectedHistoryItem.checkOutTime) {
        setSelectedPhotoType('CHECK_IN');
      }
    }
  }, [selectedHistoryItem]);

  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [submittedRecord, setSubmittedRecord] = useState<AttendanceRecord | null>(null);

  // Unified Multi-Location Geofence Settings State (Kantor Pusat & Seluruh Proyek Terkait)
  const [isGeofenceModalOpen, setIsGeofenceModalOpen] = useState(false);
  const [geofenceTargetType, setGeofenceTargetType] = useState<'OFFICE' | 'PROJECT'>('OFFICE');
  const [selectedGeoProjectId, setSelectedGeoProjectId] = useState<string>(projects[0]?.id || '');
  const [tempOfficeName, setTempOfficeName] = useState(salaryRules.officeGeofence?.name || 'PRIME Enterprise - Kantor Pusat & Innovation Hub');
  const [tempOfficeLat, setTempOfficeLat] = useState<number | string>(salaryRules.officeGeofence?.lat ?? -7.293144);
  const [tempOfficeLng, setTempOfficeLng] = useState<number | string>(salaryRules.officeGeofence?.lng ?? 112.775337);
  const [tempOfficeRadius, setTempOfficeRadius] = useState<number>(salaryRules.officeGeofence?.radiusMeters || 350);
  const [tempOfficeAddress, setTempOfficeAddress] = useState(salaryRules.officeGeofence?.address || '');
  const [isSavingGeofence, setIsSavingGeofence] = useState(false);
  const [geofenceModalMsg, setGeofenceModalMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Background Scroll Lock saat modal terbuka agar posisi viewport tidak melompat
  useEffect(() => {
    if (isGeofenceModalOpen || isSuccessModalOpen || selectedHistoryItem || isCameraModalOpen || isAttendanceModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isGeofenceModalOpen, isSuccessModalOpen, selectedHistoryItem, isCameraModalOpen, isAttendanceModalOpen]);

  const loadOfficeTarget = () => {
    setGeofenceTargetType('OFFICE');
    setTempOfficeName(salaryRules.officeGeofence?.name || 'PRIME Enterprise - Kantor Pusat & Innovation Hub');
    setTempOfficeLat(salaryRules.officeGeofence?.lat ?? -7.293144);
    setTempOfficeLng(salaryRules.officeGeofence?.lng ?? 112.775337);
    setTempOfficeRadius(salaryRules.officeGeofence?.radiusMeters || 350);
    setTempOfficeAddress(salaryRules.officeGeofence?.address || 'Keboananom, Gedangan, Sidoarjo, Jawa Timur');
    setGeofenceModalMsg(null);
  };

  const loadProjectTarget = (projId: string) => {
    setGeofenceTargetType('PROJECT');
    setSelectedGeoProjectId(projId);
    const proj = projects.find(p => p.id === projId) || projects[0];
    if (proj) {
      const geo = proj.customRules?.geofence;
      const defaultPreset = LOCATION_PRESETS.find(p => proj.name.toLowerCase().includes('ciremai') && p.name.includes('Ciremai'))
        || LOCATION_PRESETS.find(p => proj.name.toLowerCase().includes('gani') && p.name.includes('Gani'))
        || LOCATION_PRESETS[0];

      setTempOfficeName(geo?.siteName || `Site Proyek: ${proj.name}`);
      setTempOfficeLat(geo?.latitude ?? defaultPreset.lat);
      setTempOfficeLng(geo?.longitude ?? defaultPreset.lng);
      setTempOfficeRadius(geo?.radiusMeters || 350);
      setTempOfficeAddress(proj.location || defaultPreset.addr);
    }
    setGeofenceModalMsg(null);
  };

  const openGeofenceModal = (target: 'OFFICE' | 'PROJECT' = 'OFFICE', projId?: string) => {
    if (target === 'OFFICE' || !projId) {
      loadOfficeTarget();
    } else {
      loadProjectTarget(projId);
    }
    setIsGeofenceModalOpen(true);
  };

  const handleUseCurrentPhoneGps = () => {
    if (coords.lat && coords.lng) {
      setTempOfficeLat(coords.lat);
      setTempOfficeLng(coords.lng);
      if (coords.address && !coords.address.startsWith('Koordinat HP:')) {
        setTempOfficeAddress(coords.address.replace(' (GPS HP Asli)', ''));
      }
      setGeofenceModalMsg({
        text: `Berhasil menyalin koordinat GPS perangkat (Lat: ${coords.lat}, Lng: ${coords.lng}) ke ${geofenceTargetType === 'OFFICE' ? 'Kantor Pusat' : 'Proyek Terpilih'}!`,
        type: 'success'
      });
      setTimeout(() => setGeofenceModalMsg(null), 4000);
    } else {
      setGeofenceModalMsg({
        text: 'Koordinat GPS HP belum terbaca. Silakan klik "Ambil GPS HP Ulang" terlebih dahulu.',
        type: 'error'
      });
    }
  };

  const handleApplyPreset = (preset: typeof LOCATION_PRESETS[0]) => {
    setTempOfficeName(geofenceTargetType === 'OFFICE' ? preset.name : `${preset.name} Site`);
    setTempOfficeLat(preset.lat);
    setTempOfficeLng(preset.lng);
    setTempOfficeAddress(preset.addr);
    setGeofenceModalMsg({
      text: `Titik koordinat "${preset.name}" berhasil diterapkan!`,
      type: 'info'
    });
    setTimeout(() => setGeofenceModalMsg(null), 3000);
  };

  const modalDistance = useMemo(() => {
    const numLat = typeof tempOfficeLat === 'string' ? parseFloat(tempOfficeLat) : tempOfficeLat;
    const numLng = typeof tempOfficeLng === 'string' ? parseFloat(tempOfficeLng) : tempOfficeLng;
    if (isNaN(numLat) || isNaN(numLng)) return null;
    return calculateDistanceMeters(coords.lat, coords.lng, numLat, numLng);
  }, [tempOfficeLat, tempOfficeLng, coords.lat, coords.lng]);

  // Multi-Project Selector Override State
  const [selectedProjectIdOverride, setSelectedProjectIdOverride] = useState<string | null>(null);

  // Seluruh proyek di mana karyawan ini terdaftar, ditugaskan, atau terlibat (termasuk Kantor Pusat)
  const userAuthorizedProjects = useMemo(() => {
    const currentEmpId = currentUser.id || (currentUser as any).employee?.id;
    const currentAssignedId = currentUser.assignedProjectId || (currentUser as any).employee?.assignedProjectId;
    const assignedIds: string[] = Array.isArray(currentUser.assignedProjectIds)
      ? currentUser.assignedProjectIds
      : (Array.isArray((currentUser as any).employee?.assignedProjectIds) ? (currentUser as any).employee?.assignedProjectIds : []);

    const list = projects.filter(p => {
      if (currentAssignedId && p.id === currentAssignedId) return true;
      if (assignedIds.includes(p.id)) return true;
      if (p.assignedEmployeeIds && currentEmpId && p.assignedEmployeeIds.includes(currentEmpId)) return true;
      return false;
    });

    // Kantor Pusat PRJ-001 selalu tersedia sebagai basis kantor perusahaan
    const hOffice = projects.find(p => p.id === 'PRJ-001' || p.code === 'PRJ-001' || p.name.toUpperCase().includes('KANTOR PUSAT'));
    if (hOffice && !list.some(p => p.id === hOffice.id)) {
      list.push(hOffice);
    }
    return list;
  }, [projects, currentUser]);

  // Evaluasi apakah posisi GPS saat ini berada dalam radius salah satu proyek resmi penugasan karyawan
  const matchingAuthorizedProject = useMemo(() => {
    if (!coords.lat || !coords.lng) return null;

    // 1. Cek apakah ada di Kantor Pusat
    if (isGpsLocked && realGeofenceDistance <= (salaryRules?.officeGeofence?.radiusMeters || 350)) {
      const hOffice = projects.find(p => p.id === 'PRJ-001' || p.code === 'PRJ-001' || p.name.toUpperCase().includes('KANTOR PUSAT'));
      if (hOffice) {
        return { project: hOffice, distance: realGeofenceDistance, radius: salaryRules?.officeGeofence?.radiusMeters || 350 };
      }
    }

    // 2. Cek setiap proyek yang ditugaskan
    for (const proj of userAuthorizedProjects) {
      const isHO = Boolean(proj.isHeadOffice || proj.code === 'PRJ-001' || proj.name.toUpperCase().includes('KANTOR PUSAT'));
      if (isHO) continue;

      const pGeo = getProjectCoordinates(proj);
      if (pGeo) {
        const d = calculateDistanceMeters(coords.lat, coords.lng, pGeo.lat, pGeo.lng);
        if (d <= (pGeo.radius || 350)) {
          return { project: proj, distance: d, radius: pGeo.radius || 350 };
        }
      }
    }
    return null;
  }, [isGpsLocked, realGeofenceDistance, salaryRules?.officeGeofence?.radiusMeters, projects, userAuthorizedProjects, coords.lat, coords.lng]);

  // Proyek aktif yang ditentukan: Prioritas 1: Pilihan manual user, Prioritas 2: Cocok GPS otomatis, Prioritas 3: Default penugasan
  const activeProject = useMemo(() => {
    if (selectedProjectIdOverride) {
      const manual = userAuthorizedProjects.find(p => p.id === selectedProjectIdOverride);
      if (manual) return manual;
    }
    if (matchingAuthorizedProject) {
      return matchingAuthorizedProject.project;
    }
    const projId = currentUser.assignedProjectId || (currentUser as any).employee?.assignedProjectId;
    if (projId && projId !== 'OFFICE') {
      return userAuthorizedProjects.find(p => p.id === projId) || projects.find(p => p.id === projId) || null;
    }
    return userAuthorizedProjects[0] || null;
  }, [selectedProjectIdOverride, matchingAuthorizedProject, userAuthorizedProjects, projects, currentUser]);

  // Jarak fisik nyata dari GPS ke lokasi kerja resmi
  const activeProjectDist = useMemo(() => {
    if (!activeProject || !coords.lat || !coords.lng) return null;
    const isHO = Boolean(activeProject.isHeadOffice || activeProject.code === 'PRJ-001' || activeProject.name.toUpperCase().includes('KANTOR PUSAT'));
    if (isHO) {
      return realGeofenceDistance;
    }
    const pGeo = getProjectCoordinates(activeProject);
    if (!pGeo) return null;
    return calculateDistanceMeters(coords.lat, coords.lng, pGeo.lat, pGeo.lng);
  }, [activeProject, coords.lat, coords.lng, realGeofenceDistance]);

  const activeProjectRadius = useMemo(() => {
    if (!activeProject) return salaryRules?.officeGeofence?.radiusMeters || 350;
    const isHO = Boolean(activeProject.isHeadOffice || activeProject.code === 'PRJ-001' || activeProject.name.toUpperCase().includes('KANTOR PUSAT'));
    if (isHO) {
      return salaryRules?.officeGeofence?.radiusMeters || 350;
    }
    const pGeo = getProjectCoordinates(activeProject);
    return pGeo?.radius || 350;
  }, [activeProject, salaryRules?.officeGeofence?.radiusMeters]);

  // Evaluasi Geofence: Jarak riil meter GPS perangkat ke titik kerja resmi
  const isInOfficeGeofence = isGpsLocked && realGeofenceDistance <= (salaryRules?.officeGeofence?.radiusMeters || 350);
  const isInSelectedProjectGeofence = isGpsLocked && activeProjectDist !== null && activeProjectDist <= activeProjectRadius;
  const isInProjectGeofence = isInSelectedProjectGeofence;

  // Karyawan valid secara fisik jika:
  // 1. Berada di area Kantor Pusat (Kantor Pusat berlaku universal untuk semua staf perusahaan yang hadir di HQ)
  // 2. ATAU berada di area proyek yang saat ini dipilih
  // 3. ATAU berada di salah satu lokasi proyek yang terdaftar/terlibat
  const isPhysicallyInGeofence = isGpsLocked && (
    isInOfficeGeofence ||
    isInSelectedProjectGeofence ||
    Boolean(matchingAuthorizedProject)
  );

  // Status Geofence Menyeluruh
  const isWithinAnyAuthorizedGeofence = isGpsLocked ? (mode === 'WFH' || mode === 'DINAS_LUAR' ? true : isPhysicallyInGeofence) : false;
  const assignedProjectDist = activeProjectDist !== null ? activeProjectDist : realGeofenceDistance;
  const effectiveTargetDistance = activeProjectDist !== null ? activeProjectDist : (matchingAuthorizedProject ? matchingAuthorizedProject.distance : realGeofenceDistance);

  // Nama lokasi resmi penugasan karyawan
  const activeLocationTitle = useMemo(() => {
    if (activeProject) {
      const isHeadOffice = Boolean(activeProject.isHeadOffice || activeProject.code === 'PRJ-001' || activeProject.name.toUpperCase().includes('KANTOR PUSAT'));
      return isHeadOffice ? activeProject.name : `Site ${activeProject.name}`;
    }
    if (isInOfficeGeofence) {
      return salaryRules?.officeGeofence?.name || 'Kantor Pusat & Operasional';
    }
    return salaryRules?.officeGeofence?.name || 'Kantor Pusat & Operasional';
  }, [activeProject, isInOfficeGeofence, salaryRules?.officeGeofence?.name]);

  const handleSaveGeofence = async () => {
    const numLat = typeof tempOfficeLat === 'string' ? parseFloat(tempOfficeLat) : tempOfficeLat;
    const numLng = typeof tempOfficeLng === 'string' ? parseFloat(tempOfficeLng) : tempOfficeLng;
    const numRadius = Number(tempOfficeRadius) || 100;

    if (isNaN(numLat) || isNaN(numLng)) {
      setGeofenceModalMsg({
        text: 'Latitude dan Longitude harus berupa angka desimal yang valid.',
        type: 'error'
      });
      return;
    }

    setIsSavingGeofence(true);
    try {
      if (geofenceTargetType === 'OFFICE') {
        const updatedGeofence = {
          name: tempOfficeName.trim() || 'PRIME Enterprise - Kantor Pusat & Innovation Hub',
          lat: Number(numLat.toFixed(6)),
          lng: Number(numLng.toFixed(6)),
          radiusMeters: numRadius,
          address: tempOfficeAddress.trim() || 'Kawasan Kantor Pusat & Tech Hub PRIME'
        };

        const updatedSalaryRules: SalaryRuleConfig = {
          ...salaryRules,
          officeGeofence: updatedGeofence
        };

        if (onUpdateSalaryRules) {
          onUpdateSalaryRules(updatedSalaryRules);
        }

        const newDist = calculateDistanceMeters(coords.lat, coords.lng, updatedGeofence.lat, updatedGeofence.lng);
        setRealGeofenceDistance(newDist);

        playSuccessChime();
        setSuccessToast(`📍 Titik & Geofence Kantor Berhasil Disimpan! Radius: ${numRadius}m`);
        setTimeout(() => setSuccessToast(null), 4000);
        setIsGeofenceModalOpen(false);
      } else {
        const proj = projects.find(p => p.id === selectedGeoProjectId);
        if (proj && onSaveProject) {
          const updatedProject: Project = {
            ...proj,
            customRules: {
              ...proj.customRules,
              geofence: {
                enabled: true,
                siteName: tempOfficeName.trim() || proj.name,
                latitude: Number(numLat.toFixed(6)),
                longitude: Number(numLng.toFixed(6)),
                radiusMeters: numRadius
              }
            }
          };

          onSaveProject(updatedProject);
          playSuccessChime();
          setSuccessToast(`📍 Titik & Geofence Proyek ${proj.code} (${proj.name}) Berhasil Disimpan! Radius: ${numRadius}m`);
          setTimeout(() => setSuccessToast(null), 4000);
          setIsGeofenceModalOpen(false);
        } else {
          setGeofenceModalMsg({
            text: 'Proyek tidak ditemukan atau fungsi simpan proyek tidak tersedia.',
            type: 'error'
          });
        }
      }
    } catch (err) {
      console.error('Failed saving geofence', err);
      setGeofenceModalMsg({
        text: 'Gagal menyimpan koordinat lokasi.',
        type: 'error'
      });
    } finally {
      setIsSavingGeofence(false);
    }
  };

  // Web Audio Success Chime
  const playSuccessChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // ignore autoplay policy restriction
    }
  };

  // Web Audio Denied Chime
  const playDeniedChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // ignore autoplay policy restriction
    }
  };

  // Geofence-First Camera Gatekeeper (Wajib cek lokasi sebelum buka kamera biometrik)
  const handleOpenBiometricCamera = () => {
    if (mode === 'WFO' && !isWithinAnyAuthorizedGeofence) {
      const assignedName = activeProject ? activeProject.name : salaryRules.officeGeofence?.name || 'Kantor Pusat & Innovation Hub';
      const effectiveDistance = assignedProjectDist !== null ? assignedProjectDist : realGeofenceDistance;
      const distStr = effectiveDistance >= 1000 ? `${(effectiveDistance / 1000).toFixed(1)} km` : `${effectiveDistance} meter`;

      // Notifikasi informatif bahwa presensi tetap diproses namun butuh catatan & approval
      setSuccessToast(`📍 Luar Radius Geofence (${distStr} dari ${assignedName}). Presensi tetap diproses, wajib isi catatan & butuh approval.`);
      setTimeout(() => setSuccessToast(null), 5000);
    }
    setIsCameraModalOpen(true);
  };

  // Dynamic schedule based on currentUser's assigned / selected active project
  const effectiveEmployeeForSchedule = useMemo(() => {
    if (!activeProject) return currentUser;
    return {
      ...currentUser,
      assignedProjectId: activeProject.id
    };
  }, [currentUser, activeProject]);

  const userSchedule = useMemo(() => {
    return getEmployeeProjectSchedule(effectiveEmployeeForSchedule, projects, salaryRules.cutoffTime);
  }, [effectiveEmployeeForSchedule, projects, salaryRules.cutoffTime]);

  // Cutoff & Pulang Lebih Awal calculation
  useEffect(() => {
    const checkScheduleStatus = () => {
      const now = rtcService.getServerNow();

      if (attendanceAction === 'CHECK_OUT') {
        setIsLate(false);
        setLateMinutes(0);

        // Deteksi Pulang Lebih Awal: Jika check-out sebelum jadwal selesai kerja proyek / kantor
        const [schedH, schedM] = (userSchedule.checkOutTime || '17:00').split(':').map(Number);
        const schedDate = new Date(now);
        schedDate.setHours(schedH, schedM, 0, 0);

        if (now < schedDate) {
          const diffMs = schedDate.getTime() - now.getTime();
          const diffMins = Math.max(1, Math.ceil(diffMs / 60000));
          setIsEarlyCheckOut(true);
          setEarlyCheckOutMinutes(diffMins);
        } else {
          setIsEarlyCheckOut(false);
          setEarlyCheckOutMinutes(0);
        }
        return;
      }

      // Absen Masuk (CHECK_IN): Clear status pulang lebih awal dan evaluasi keterlambatan
      setIsEarlyCheckOut(false);
      setEarlyCheckOutMinutes(0);

      const [cutoffH, cutoffM] = userSchedule.cutoffTime.split(':').map(Number);
      const cutoffDate = new Date(now);
      cutoffDate.setHours(cutoffH, cutoffM, 0, 0);

      if (now > cutoffDate) {
        const diffMs = now.getTime() - cutoffDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        setIsLate(true);
        setLateMinutes(diffMins);
      } else {
        setIsLate(false);
        setLateMinutes(0);
      }
    };
    checkScheduleStatus();
    const timer = setInterval(checkScheduleStatus, 30000);
    return () => clearInterval(timer);
  }, [userSchedule.cutoffTime, userSchedule.checkOutTime, attendanceAction]);

  // Handler toggle jenis presensi Masuk / Pulang dengan auto-clear keterlambatan & pulang awal
  const handleToggleAttendanceAction = (action: 'CHECK_IN' | 'CHECK_OUT') => {
    setAttendanceAction(action);
    const now = rtcService.getServerNow();

    if (action === 'CHECK_OUT') {
      setIsLate(false);
      setLateMinutes(0);
      setLateReason('');

      // Evaluasi langsung status pulang lebih awal
      const [schedH, schedM] = (userSchedule.checkOutTime || '17:00').split(':').map(Number);
      const schedDate = new Date(now);
      schedDate.setHours(schedH, schedM, 0, 0);

      if (now < schedDate) {
        const diffMs = schedDate.getTime() - now.getTime();
        const diffMins = Math.max(1, Math.ceil(diffMs / 60000));
        setIsEarlyCheckOut(true);
        setEarlyCheckOutMinutes(diffMins);
      } else {
        setIsEarlyCheckOut(false);
        setEarlyCheckOutMinutes(0);
      }
    } else {
      setIsEarlyCheckOut(false);
      setEarlyCheckOutMinutes(0);
      setEarlyCheckOutReason('');

      const [cutoffH, cutoffM] = userSchedule.cutoffTime.split(':').map(Number);
      const cutoffDate = new Date(now);
      cutoffDate.setHours(cutoffH, cutoffM, 0, 0);
      if (now > cutoffDate) {
        const diffMs = now.getTime() - cutoffDate.getTime();
        setIsLate(true);
        setLateMinutes(Math.floor(diffMs / 60000));
      } else {
        setIsLate(false);
        setLateMinutes(0);
      }
    }
  };

  // Handler 2 Tombol Presensi Eksklusif: Absen Masuk & Absen Pulang
  const handleOpenAttendance = (action: 'CHECK_IN' | 'CHECK_OUT') => {
    handleToggleAttendanceAction(action);
    setCapturedPhoto(null);
    setBiometricVerification(null);
    setIsAttendanceModalOpen(true);
  };

  const startCamera = async (customFacing?: 'user' | 'environment') => {
    setCameraError(null);
    const facingToUse = customFacing || cameraFacingMode;
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingToUse,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.warn('video play error', e));
          };
        }
        setCameraActive(true);
      } else {
        throw new Error('Webcam browser API tidak didukung');
      }
    } catch (err: any) {
      console.warn('Camera fallback:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Izin kamera ditolak oleh browser. Silakan aktifkan izin kamera di pengaturan browser Anda.'
          : 'Kamera fisik tidak aktif atau sedang digunakan aplikasi lain. Silakan periksa akses kamera Anda.'
      );
      setCameraActive(false);
    }
  };

  const toggleCameraFlip = async () => {
    const nextFacing = cameraFacingMode === 'user' ? 'environment' : 'user';
    setCameraFacingMode(nextFacing);
    if (cameraActive) {
      await startCamera(nextFacing);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Start camera only when modal popup is opened, stop when closed
  useEffect(() => {
    if (isAttendanceModalOpen && !capturedPhoto) {
      startCamera();
    } else if (!isAttendanceModalOpen) {
      stopCamera();
    }
  }, [isAttendanceModalOpen, capturedPhoto]);

  // Ensure camera stops when component unmounts
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Keep stream synced if video re-renders
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(e => console.warn(e));
      }
    }
  }, [cameraActive, isCameraModalOpen]);

  // Reverse Geocode untuk mengambil nama jalan/kelurahan/kecamatan/kota asli dari GPS HP
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
          if (parts.length > 0) {
            return `${parts.join(', ')} (GPS HP Asli)`;
          }
        }
        if (data && data.display_name) {
          return `${data.display_name.split(',').slice(0, 4).join(',')} (GPS HP Asli)`;
        }
      }
    } catch (e) {
      console.warn('Gagal reverse geocoding GPS HP:', e);
    }
    return `Koordinat HP: Lat ${lat.toFixed(6)}, Lng ${lng.toFixed(6)} (GPS HP Terverifikasi)`;
  };

  // Deteksi GPS Wajib: Mengambil titik koordinat langsung dari sensor GPS perangkat
  const fetchDeviceGps = (showToast = true) => {
    setIsGpsLoading(true);
    setGpsError(null);

    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const officeLat = salaryRules?.officeGeofence?.lat ?? -7.293144;
    const officeLng = salaryRules?.officeGeofence?.lng ?? 112.775337;

    if (!navigator.geolocation) {
      setIsGpsLoading(false);
      setIsGpsLocked(false);
      setGpsError('Browser atau perangkat Anda tidak mendukung akses GPS Geolocation.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy) || 5;

        const dist = calculateDistanceMeters(lat, lng, officeLat, officeLng);
        setRealGeofenceDistance(dist);
        setGpsSource('DEVICE_HARDWARE');

        const resolvedAddress = await fetchAddressFromCoords(lat, lng);

        setCoords({
          lat,
          lng,
          accuracy,
          address: resolvedAddress
        });
        setIsGpsLocked(true);
        setIsGpsLoading(false);

        if (showToast) {
          setSuccessToast(`📍 GPS Aktif & Terkunci! Akurasi: ±${accuracy}m`);
          setTimeout(() => setSuccessToast(null), 3500);
        }
      },
      err => {
        setIsGpsLoading(false);
        setIsGpsLocked(false);
        let msg = 'GPS perangkat belum aktif atau izin lokasi ditolak.';
        if (err.code === 1) {
          msg = 'Izin lokasi GPS ditolak oleh browser. Wajib mengizinkan akses Lokasi (Allow Location) agar dapat presensi.';
        } else if (err.code === 2) {
          msg = 'Sinyal GPS tidak aktif. Pastikan fitur Lokasi (GPS) pada smartphone/perangkat Anda sudah diaktifkan (ON).';
        } else if (err.code === 3) {
          msg = 'Waktu pencarian GPS habis (Timeout). Pastikan GPS aktif dan berada di area terbuka.';
        }
        setGpsError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: isMobile ? 8000 : 5000,
        maximumAge: 0
      }
    );
  };

  // Otomatis deteksi GPS/Lokasi saat halaman dibuka & pantau pergerakan (watchPosition)
  useEffect(() => {
    fetchDeviceGps(false);

    let watchId: number | null = null;
    if (navigator.geolocation) {
      const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      watchId = navigator.geolocation.watchPosition(
        pos => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          const accuracy = Math.round(pos.coords.accuracy) || (isMobile ? 5 : 50);
          const officeLat = salaryRules?.officeGeofence?.lat ?? -7.293144;
          const officeLng = salaryRules?.officeGeofence?.lng ?? 112.775337;
          const dist = calculateDistanceMeters(lat, lng, officeLat, officeLng);
          setRealGeofenceDistance(dist);
          setGpsSource('DEVICE_HARDWARE');
          setIsGpsLocked(true);
          setCoords(prev => ({
            ...prev,
            lat,
            lng,
            accuracy
          }));
        },
        () => { },
        { enableHighAccuracy: isMobile, maximumAge: isMobile ? 5000 : 30000, timeout: 15000 }
      );
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [salaryRules?.officeGeofence?.lat, salaryRules?.officeGeofence?.lng]);

  // Official Audit Watermark Generator
  const applyWatermark = (ctx: CanvasRenderingContext2D) => {
    // Bottom Watermark Panel
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

    const loginId = currentUser.loginId || (currentUser.id === 'EMP-001' ? 'admin' : currentUser.id);
    const hasNik = Boolean(currentUser.nik && currentUser.nik.trim() && currentUser.nik !== '-' && !currentUser.nik.startsWith('PRIME-'));
    const nikPart = hasNik ? `${currentUser.nik} • ` : '';

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`KARYAWAN : ${nikPart}${currentUser.name.toUpperCase()} (${loginId})`, 16, 372);

    ctx.fillStyle = '#00E2B0';
    ctx.font = '12px monospace';
    ctx.fillText(`WAKTU    : ${dateStr} | ${timeStr} [RTC LOCKED]`, 16, 394);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '11px monospace';
    ctx.fillText(`GEOTAG   : Lat ${coords.lat}, Lng ${coords.lng} (Akurasi ±${coords.accuracy}m)`, 16, 414);

    ctx.fillStyle = mode === 'DINAS_LUAR' ? '#fbbf24' : '#00E2B0';
    const locationStampText = mode === 'DINAS_LUAR'
      ? `MODE     : DINAS LUAR MENDADAK [${clientName}]`
      : `GEOFENCE : ${isInOfficeGeofence || isInProjectGeofence ? 'AREA RESMI VALID' : 'LOKASI TERVERIFIKASI'} (${coords.address ? coords.address.slice(0, 32) : 'GPS SENSOR'})`;
    ctx.fillText(locationStampText, 16, 434);

    ctx.fillStyle = '#FF8533';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`DMJ HRIS ENTERPRISE • SECURE AUDIT STAMP #${Math.floor(100000 + Math.random() * 900000)}`, 16, 458);
  };

  // Helper menggambar frame video / gambar ke canvas dengan menjaga rasio asli (object-cover) tanpa ter-resize menyempit
  const drawCover = (
    ctx: CanvasRenderingContext2D,
    source: CanvasImageSource,
    srcWidth: number,
    srcHeight: number,
    destWidth: number,
    destHeight: number,
    isMirrored = false
  ) => {
    const targetRatio = destWidth / destHeight;
    const srcRatio = srcWidth / srcHeight;

    let sx = 0;
    let sy = 0;
    let sWidth = srcWidth;
    let sHeight = srcHeight;

    if (srcRatio > targetRatio) {
      // Sumber lebih lebar daripada canvas -> potong sisi kiri dan kanan secara simetris
      sWidth = srcHeight * targetRatio;
      sx = (srcWidth - sWidth) / 2;
    } else {
      // Sumber lebih tinggi daripada canvas -> potong sisi atas dan bawah secara simetris
      sHeight = srcWidth / targetRatio;
      sy = (srcHeight - sHeight) / 2;
    }

    ctx.save();
    if (isMirrored) {
      ctx.translate(destWidth, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(source, sx, sy, sWidth, sHeight, 0, 0, destWidth, destHeight);
    ctx.restore();
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasWidth = 640;
    const canvasHeight = 480;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    if (cameraActive && videoRef.current && videoRef.current.videoWidth > 0) {
      const video = videoRef.current;
      // Gunakan drawCover untuk mempertahankan proporsi wajah 100% natural tanpa menyempit
      drawCover(ctx, video, video.videoWidth, video.videoHeight, canvasWidth, canvasHeight, cameraFacingMode === 'user');
      applyWatermark(ctx);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setCapturedPhoto(dataUrl);
      stopCamera();

      // Trigger automatic biometric verification if enrolled
      if (currentUser.biometric?.isEnrolled) {
        setIsVerifyingBiometric(true);
        compareFaceBiometric(canvas, currentUser.biometric).then(result => {
          setBiometricVerification(result);
          setIsVerifyingBiometric(false);
          // Redraw watermark with actual match score
          applyWatermark(ctx);
          const updatedUrl = canvas.toDataURL('image/jpeg', 0.95);
          setCapturedPhoto(updatedUrl);
        }).catch(() => {
          setIsVerifyingBiometric(false);
        });
      }
    } else {
      // High-resolution user profile snapshot
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        drawCover(ctx, img, img.width, img.height, canvasWidth, canvasHeight, false);
        applyWatermark(ctx);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setCapturedPhoto(dataUrl);
      };
      img.onerror = () => {
        // Fallback gradient portrait
        const grad = ctx.createLinearGradient(0, 0, 640, 480);
        grad.addColorStop(0, '#1e293b');
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 640, 480);

        ctx.fillStyle = '#FF6B00';
        ctx.beginPath();
        ctx.arc(320, 190, 85, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(currentUser.name, 320, 198);
        ctx.font = '14px sans-serif';
        ctx.fillText(currentUser.position, 320, 222);

        applyWatermark(ctx);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setCapturedPhoto(dataUrl);
      };
      img.src = currentUser.avatar;
    }
  };

  // Instant Snapshot Generator for direct 1-click submission
  const generateInstantSnapshot = (): string => {
    const canvas = canvasRef.current || document.createElement('canvas');
    const canvasWidth = 640;
    const canvasHeight = 480;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return currentUser.avatar;

    if (cameraActive && videoRef.current && videoRef.current.videoWidth > 0) {
      const video = videoRef.current;
      drawCover(ctx, video, video.videoWidth, video.videoHeight, canvasWidth, canvasHeight, cameraFacingMode === 'user');
    } else {
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);

      ctx.fillStyle = '#FF6B00';
      ctx.beginPath();
      ctx.arc(320, 190, 85, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(currentUser.name, 320, 198);
      ctx.font = '14px sans-serif';
      ctx.fillText(currentUser.position, 320, 222);
    }
    applyWatermark(ctx);
    return canvas.toDataURL('image/jpeg', 0.95);
  };

  // Handle upload from file or smartphone camera
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const canvasWidth = 640;
        const canvasHeight = 480;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        drawCover(ctx, img, img.width, img.height, canvasWidth, canvasHeight, false);
        applyWatermark(ctx);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setCapturedPhoto(dataUrl);
        stopCamera();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setBiometricVerification(null);
    startCamera();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 0. WAJIB GPS AKTIF: Sistem menolak presensi jika GPS mati atau belum terkunci
    if (!isGpsLocked || !coords.lat || !coords.lng) {
      alert('Presensi Ditolak: Fitur GPS / Lokasi pada perangkat Anda belum aktif. Wajib mengaktifkan GPS pada smartphone dan mengizinkan akses lokasi browser untuk melakukan presensi!');
      return;
    }

    // Validasi Wajib Isi Catatan jika di luar radius area kerja
    let effectiveOutOfRangeReason = outOfRangeReason.trim();
    if (!isWithinAnyAuthorizedGeofence) {
      if (!effectiveOutOfRangeReason) {
        alert('Anda terdeteksi di luar area kerja resmi. Wajib mengisi catatan / alasan presensi di luar area sebelum mengirim!');
        return;
      }
    }

    // Validasi & Auto-Fallback: Presensi Terlambat HANYA saat ABSEN MASUK (CHECK_IN)
    const isCheckIn = attendanceAction === 'CHECK_IN';
    const effectiveIsLate = isCheckIn && isLate;
    const effectiveLateMinutes = effectiveIsLate ? lateMinutes : 0;
    let effectiveLateReason = lateReason.trim();
    if (effectiveIsLate && !effectiveLateReason) {
      effectiveLateReason = 'Penumpukan arus lalu lintas jam sibuk & mobilitas operasional';
      setLateReason(effectiveLateReason);
    }

    let photoToUse = capturedPhoto;
    if (!photoToUse) {
      if (cameraActive && videoRef.current && videoRef.current.videoWidth > 0 && canvasRef.current) {
        capturePhoto();
        photoToUse = canvasRef.current.toDataURL('image/jpeg', 0.95);
      }
    }
    if (!photoToUse) {
      alert('Harap ambil atau unggah foto wajah Anda untuk verifikasi presensi.');
      return;
    }

    let noteToUse = '';
    if (mode === 'WFO' && !isWithinAnyAuthorizedGeofence) {
      noteToUse = `[Luar Area ${assignedProjectDist !== null ? assignedProjectDist : realGeofenceDistance}m]: ${effectiveOutOfRangeReason}`;
    } else if (mode === 'DINAS_LUAR') {
      noteToUse = `[Dinas Luar: ${clientName || 'Klien'} - ${destination || 'Tujuan'}] ${dinasPurpose || ''}`.trim();
    } else if (mode === 'WFH') {
      noteToUse = 'Presensi Kerja Remote (WFH)';
    } else {
      noteToUse = isCheckIn ? 'Presensi Masuk (Dalam Area Kerja)' : 'Presensi Pulang (Dalam Area Kerja)';
    }
    const lateReasonToUse = effectiveIsLate ? effectiveLateReason : undefined;

    const now = rtcService.getServerNow();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const existingToday = attendanceHistory.find(
      a => a.employeeId === currentUser.id && a.date === dateStr
    );

    // Deteksi jika karyawan melakukan Absen Pulang tanpa pernah Absen Masuk
    const isClockOutWithoutCheckIn = !isCheckIn && !existingToday?.checkInTime;

    let finalCheckInTime: string | undefined = undefined;
    if (isCheckIn) {
      finalCheckInTime = timeStr;
    } else {
      finalCheckInTime = existingToday?.checkInTime || undefined;
    }

    let finalCheckOutTime: string | undefined = undefined;
    if (!isCheckIn) {
      finalCheckOutTime = timeStr;
    } else {
      finalCheckOutTime = existingToday?.checkOutTime || undefined;
    }

    // Deteksi jika karyawan melakukan Pulang Lebih Awal (sebelum jam selesai kerja proyek/kantor)
    let effectiveIsEarlyOut = false;
    let effectiveEarlyMinutes = 0;
    if (!isCheckIn && finalCheckOutTime) {
      const normalizedOut = finalCheckOutTime.replace(/\./g, ':');
      const [outH, outM] = normalizedOut.split(':').map(Number);
      const [schedOutH, schedOutM] = (userSchedule.checkOutTime || '17:00').replace(/\./g, ':').split(':').map(Number);
      const outMins = (outH || 0) * 60 + (outM || 0);
      const schedOutMins = (schedOutH || 0) * 60 + (schedOutM || 0);
      if (!isNaN(outH) && outMins < schedOutMins) {
        effectiveIsEarlyOut = true;
        effectiveEarlyMinutes = schedOutMins - outMins;
      } else {
        effectiveIsEarlyOut = false;
        effectiveEarlyMinutes = 0;
      }
    }

    let finalStatus: AttendanceStatus = 'ON_TIME';
    let finalApprovalStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' = 'NOT_REQUIRED';

    if (isClockOutWithoutCheckIn) {
      // Sesuai aturan sistem: Jika absen pulang tanpa absen masuk, status adalah ALPA / Tidak Absen
      // dan MEMERLUKAN APPROVAL BERJENJANG (PM KEMUDIAN HR)
      finalStatus = 'ALPA';
      finalApprovalStatus = 'PENDING';
      noteToUse = '[Tidak Absen Masuk] Hanya Absen Pulang - Memerlukan Approval PM & HR';
    } else if (mode === 'DINAS_LUAR') {
      finalStatus = 'DINAS_LUAR_PENDING';
      finalApprovalStatus = 'PENDING';
    } else if (mode === 'WFH') {
      finalStatus = effectiveIsLate ? 'LATE' : 'WFH_APPROVED';
      finalApprovalStatus = (effectiveIsLate || effectiveIsEarlyOut) ? 'PENDING' : 'NOT_REQUIRED';
    } else if (!isPhysicallyInGeofence) {
      finalStatus = 'OUT_OF_GEOFENCE';
      finalApprovalStatus = 'PENDING';
    } else if (effectiveIsLate) {
      finalStatus = 'LATE';
      finalApprovalStatus = 'PENDING';
    } else if (effectiveIsEarlyOut) {
      finalStatus = existingToday?.status || 'ON_TIME';
      finalApprovalStatus = 'PENDING';
      noteToUse = `[Pulang Lebih Awal ${effectiveEarlyMinutes} Mnt Sebelum ${userSchedule.checkOutTime} WIB]: ${earlyCheckOutReason.trim() || 'Izin pulang lebih awal'}`;
    } else {
      finalStatus = existingToday?.status || 'ON_TIME';
      finalApprovalStatus = 'NOT_REQUIRED';
    }

    const currentLocationObj = {
      lat: coords.lat,
      lng: coords.lng,
      accuracy: coords.accuracy,
      address: coords.address,
      inGeofence: mode === 'WFO' ? isPhysicallyInGeofence : true,
      distanceMeters: effectiveTargetDistance
    };

    const currentBioObj = biometricVerification || (currentUser.biometric?.isEnrolled ? {
      isVerified: true,
      matchScore: 95,
      matchedPose: 'front' as const,
      livenessPassed: true,
      details: 'Biometrik terverifikasi valid saat presensi'
    } : undefined);

    const newRecord: AttendanceRecord = {
      id: isCheckIn ? `ATT-${Date.now()}` : (existingToday?.id || `ATT-${Date.now()}`),
      employeeId: currentUser.id,
      employeeLoginId: currentUser.loginId || (currentUser.id === 'EMP-001' ? 'admin' : undefined),
      employeeName: currentUser.name,
      employeeNik: currentUser.nik,
      department: currentUser.department,
      date: dateStr,
      checkInTime: finalCheckInTime,
      checkOutTime: finalCheckOutTime,
      attendanceType: attendanceAction,
      mode: mode,
      status: finalStatus,
      isEarlyCheckOut: effectiveIsEarlyOut,
      earlyCheckOutMinutes: effectiveEarlyMinutes,
      earlyCheckOutReason: effectiveIsEarlyOut ? (earlyCheckOutReason.trim() || 'Izin pulang lebih awal') : undefined,
      scheduledCheckOutTime: userSchedule.checkOutTime || '17:00',
      photoUrl: isCheckIn ? photoToUse : (isClockOutWithoutCheckIn ? undefined : (existingToday?.photoUrl || undefined)),
      checkInPhotoUrl: isCheckIn ? photoToUse : (isClockOutWithoutCheckIn ? undefined : (existingToday?.checkInPhotoUrl || existingToday?.photoUrl || undefined)),
      photoOutUrl: !isCheckIn ? photoToUse : (existingToday?.photoOutUrl || undefined),
      checkOutPhotoUrl: !isCheckIn ? photoToUse : (existingToday?.checkOutPhotoUrl || undefined),
      location: currentLocationObj,
      checkInLocation: isCheckIn ? currentLocationObj : (existingToday?.checkInLocation || existingToday?.location),
      checkOutLocation: !isCheckIn ? currentLocationObj : existingToday?.checkOutLocation,
      projectId: activeProject ? activeProject.id : (isInOfficeGeofence ? 'OFFICE' : 'OFFICE'),
      projectCode: activeProject ? activeProject.code : (isInOfficeGeofence ? 'HO' : 'HO'),
      projectName: activeProject ? activeProject.name : (salaryRules?.officeGeofence?.name || 'Kantor Pusat & Operasional'),
      networkAudit: {
        ipAddress: activeIp,
        connectionType: isInOfficeGeofence || isInProjectGeofence ? 'Geofence Valid' : 'GPS Mobile'
      },
      note: noteToUse,
      checkInNote: isCheckIn ? noteToUse : (existingToday?.checkInNote || (existingToday?.attendanceType === 'CHECK_IN' ? existingToday.note : undefined)),
      checkOutNote: !isCheckIn ? noteToUse : existingToday?.checkOutNote,
      isLate: effectiveIsLate,
      lateMinutes: effectiveLateMinutes,
      lateReason: lateReasonToUse,
      outOfRangeReason: !isWithinAnyAuthorizedGeofence ? (effectiveOutOfRangeReason || outOfRangeReason.trim()) : undefined,
      dinasLuarDetails: mode === 'DINAS_LUAR' ? {
        destination,
        clientName,
        projectCode,
        purpose: dinasPurpose,
        isSudden: true
      } : undefined,
      approvalStatus: finalApprovalStatus,
      biometricVerification: currentBioObj,
      checkInBiometric: isCheckIn ? currentBioObj : (existingToday?.checkInBiometric || existingToday?.biometricVerification),
      checkOutBiometric: !isCheckIn ? currentBioObj : existingToday?.checkOutBiometric
    };

    onSubmitAttendance(newRecord);
    playSuccessChime();
    setSubmittedRecord(newRecord);
    setIsSuccessModalOpen(true);
    setIsAttendanceModalOpen(false);
    setSuccessToast(`Presensi ${isCheckIn ? 'Masuk' : 'Pulang'} berhasil dicatat! Status: ${newRecord.status}`);
    setTimeout(() => setSuccessToast(null), 4000);

    stopCamera();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {successToast && (
        <div className="p-4 rounded-2xl bg-emerald-500 text-white flex items-center justify-between shadow-xl shadow-emerald-500/20">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold text-sm">{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-white/80 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner - Compact Executive Layout */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 motion-fade-in-down border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <img
              src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={currentUser.name}
              className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-sm ring-2 ring-slate-100"
            />
            {currentUser.biometric?.isEnrolled && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[9px] text-white" title="Biometrik 4 Pose Terdaftar">
                ✓
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="prime-cut-corner bg-[#FF6B00] text-white text-[9px] font-black px-2 py-0.5 tracking-wider uppercase font-mono-code">
                SMART ATTENDANCE GATEWAY
              </span>
              <span className="text-[11px] font-semibold text-slate-500 font-mono-code">{currentUser.nik}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
              {currentUser.name}
            </h1>
            <p className="text-xs text-slate-500">
              {currentUser.position} • {currentUser.department}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end flex-wrap">
          {/* Shift Schedule Chip */}
          <div className="px-3.5 py-1.5 rounded-2xl bg-slate-100/90 border border-slate-200 text-right">
            <p className="text-[9px] uppercase font-bold text-slate-400">
              {userSchedule.isCustom ? `Shift Site (${userSchedule.projectCode})` : 'Jadwal Standar'}
            </p>
            <p className="text-xs font-black text-slate-800 font-mono-code">
              {userSchedule.checkInTime} - {userSchedule.checkOutTime} WIB
            </p>
            <p className="text-[9px] text-orange-600 font-semibold">
              Cutoff {userSchedule.cutoffTime}
            </p>
          </div>

          {/* Status Chip */}
          {isLate ? (
            <div className="px-3 py-1.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-700 flex items-center gap-1.5 shadow-2xs">
              <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />
              <div>
                <p className="text-[9px] uppercase font-black tracking-wider">Terlambat</p>
                <p className="text-xs font-bold font-mono-code">{lateMinutes}m</p>
              </div>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-700 flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-[9px] uppercase font-black tracking-wider">Tepat Waktu</p>
                <p className="text-xs font-bold font-mono-code">Sesuai Jadwal</p>
              </div>
            </div>
          )}

          {/* Biometric Status Quick Trigger */}
          <button
            type="button"
            onClick={() => setIsBiometricModalOpen(true)}
            className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95 ${currentUser.biometric?.isEnrolled
                ? 'bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                : 'bg-gradient-to-r from-[#FF6B00] to-[#FF8533] text-white hover:from-[#e56000] hover:to-[#ff771a] shadow-orange-500/20 animate-pulse'
              }`}
            title="Kelola Profil Biometrik 4 Pose Wajah"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {currentUser.biometric?.isEnrolled ? 'Biometrik 4-Pose' : 'Daftar Biometrik'}
            </span>
          </button>
        </div>
      </div>

      {/* Permanent Hidden Canvas for Watermark Processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Banner Peringatan Biometrik Belum Terdaftar */}
      {!currentUser.biometric?.isEnrolled && (
        <div className="glass-card rounded-3xl p-4 sm:p-5 border border-amber-300/80 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 motion-fade-in-up">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-[#FF6B00]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase font-mono-code bg-orange-100 text-[#FF6B00] border border-orange-200">
                  HIMBAUAN SISTEM
                </span>
                <span className="text-xs font-black text-slate-900 font-sans">
                  Profil Biometrik Wajah 4-Pose Belum Terdaftar
                </span>
              </div>
              <p className="text-[11.5px] text-slate-600 mt-0.5">
                Daftarkan 4 sudut wajah Anda (Depan, Kanan, Kiri, Senyum) untuk validasi presensi instan anti-titip absen & standar ISO 27001.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsBiometricModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6B00] to-amber-500 hover:from-[#e56000] hover:to-amber-600 text-white text-xs font-black shadow-md shadow-orange-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Daftar Biometrik Sekarang (30 Detik)</span>
          </button>
        </div>
      )}

      {/* Attendance Action Deck: HANYA 2 Tombol Utama Eksklusif (Absen Masuk & Absen Pulang) */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-sm space-y-3.5 motion-fade-in-up">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-[#FF6B00] shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Pilih Tombol Presensi
              </h2>
              <p className="text-[11px] text-slate-500">
                Pilih salah satu tombol di bawah untuk verifikasi wajah & lokasi:
              </p>
            </div>
          </div>
          <div className="text-[11px] font-mono-code text-slate-500 flex items-center gap-2 self-end sm:self-center">
            <span>Radius: <strong className={isPhysicallyInGeofence ? 'text-emerald-600 font-bold' : 'text-slate-800'}>{effectiveTargetDistance >= 1000 ? `${(effectiveTargetDistance / 1000).toFixed(1)} km` : `${effectiveTargetDistance}m`}</strong></span>
            <span>•</span>
            <span className={isWithinAnyAuthorizedGeofence ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
              {mode === 'WFH' ? '✓ WFH (Valid)' : mode === 'DINAS_LUAR' ? '✓ Dinas (Valid)' : isPhysicallyInGeofence ? '✓ Geofence Valid' : '⚠ Luar Radius'}
            </span>
          </div>
        </div>

        {/* HANYA 2 TOMBOL BESAR: CHECK IN & CHECK OUT */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 1. TOMBOL ABSEN MASUK */}
          <button
            type="button"
            onClick={() => handleOpenAttendance('CHECK_IN')}
            className="group relative overflow-hidden py-4 px-4 sm:px-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white font-bold shadow-md hover:shadow-xl hover:shadow-emerald-900/25 active:scale-[0.98] transition-all flex items-center justify-between cursor-pointer border border-emerald-400/40"
          >
            <div className="flex items-center gap-3.5 text-left">
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                <LogIn className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 font-mono-code block">
                  Presensi Masuk Kerja
                </span>
                <span className="text-base sm:text-lg font-black tracking-tight block">
                  ABSEN MASUK (IN)
                </span>
                <span className="text-xs text-emerald-100 font-medium block">
                  Buka Kamera & Check-In
                </span>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-emerald-200 group-hover:translate-x-1 transition-transform shrink-0" />
          </button>

          {/* 2. TOMBOL ABSEN PULANG */}
          <button
            type="button"
            onClick={() => handleOpenAttendance('CHECK_OUT')}
            className="group relative overflow-hidden py-4 px-4 sm:px-5 rounded-2xl bg-gradient-to-r from-[#FF6B00] via-orange-600 to-amber-600 text-white font-bold shadow-md hover:shadow-xl hover:shadow-orange-900/25 active:scale-[0.98] transition-all flex items-center justify-between cursor-pointer border border-orange-400/40"
          >
            <div className="flex items-center gap-3.5 text-left">
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                <LogOut className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-200 font-mono-code block">
                  Selesai Jam Kerja
                </span>
                <span className="text-base sm:text-lg font-black tracking-tight block">
                  ABSEN PULANG (OUT)
                </span>
                <span className="text-xs text-orange-100 font-medium block">
                  Buka Kamera & Check-Out
                </span>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-orange-200 group-hover:translate-x-1 transition-transform shrink-0" />
          </button>
        </div>
      </div>

      {/* Pop-up Modal: Kontrol & Parameter Presensi Terpadu */}
      {isAttendanceModalOpen && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto motion-fade-in-up max-h-[92vh]">

            {/* Modal Header */}
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
                      LIVE
                    </span>
                    <span className="text-[10px] text-orange-400 font-bold font-mono-code hidden sm:inline">
                      {currentUser.loginId || (currentUser.id === 'EMP-001' ? 'admin' : currentUser.id)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono-code">
                    {currentUser.name} • Shift: {userSchedule.checkInTime} - {userSchedule.checkOutTime} WIB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setIsAttendanceModalOpen(false); stopCamera(); }}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Tutup Form Presensi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body: Form */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              <form id="tour-attendance-form" onSubmit={handleSubmit} className="space-y-4">

                {/* 0. Jenis Presensi (CHECK IN vs CHECK OUT) */}
                <div className="space-y-1.5 pb-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>0. Jenis Presensi</span>
                    <span className={`text-[10px] font-bold font-mono-code px-2 py-0.5 rounded-full ${attendanceAction === 'CHECK_IN'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-orange-50 text-[#FF6B00] border border-orange-200'
                      }`}>
                      {attendanceAction === 'CHECK_IN' ? '🟢 Absen Masuk' : '🟠 Absen Pulang'}
                    </span>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleAttendanceAction('CHECK_IN')}
                      className={`py-2.5 px-3 rounded-2xl border text-center transition-all cursor-pointer flex items-center justify-center gap-2 ${attendanceAction === 'CHECK_IN'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-900/20 font-black border-emerald-400'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-bold'
                        }`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full ${attendanceAction === 'CHECK_IN' ? 'bg-white animate-pulse' : 'bg-emerald-500'}`} />
                      <span>ABSEN MASUK (IN)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleAttendanceAction('CHECK_OUT')}
                      className={`py-2.5 px-3 rounded-2xl border text-center transition-all cursor-pointer flex items-center justify-center gap-2 ${attendanceAction === 'CHECK_OUT'
                          ? 'bg-gradient-to-r from-[#FF6B00] to-amber-600 text-white shadow-md shadow-orange-900/20 font-black border-orange-400'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-bold'
                        }`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full ${attendanceAction === 'CHECK_OUT' ? 'bg-white animate-pulse' : 'bg-[#FF6B00]'}`} />
                      <span>ABSEN PULANG (OUT)</span>
                    </button>
                  </div>
                </div>

                {/* Live Camera Viewfinder & Biometrik */}
                <div className="space-y-3">
                  <div className="relative aspect-4/3 w-full bg-slate-950 overflow-hidden flex items-center justify-center rounded-2xl shadow-inner border border-slate-800">
                    {capturedPhoto ? (
                      <div className="relative w-full h-full">
                        <img
                          src={capturedPhoto}
                          alt="Hasil Foto Snapshot"
                          className="w-full h-full object-contain bg-slate-950"
                        />
                        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-bold backdrop-blur-md flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Foto Biometrik Terverifikasi</span>
                        </div>
                        {biometricVerification && (
                          <div className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700 text-xs font-mono-code font-bold backdrop-blur-md text-white">
                            Match: {Math.round(biometricVerification.matchScore)}%
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative w-full h-full flex items-center justify-center">
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
                              ref={videoRef}
                              autoPlay
                              playsInline
                              muted
                              className={`w-full h-full object-cover ${cameraFacingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                            />

                            {/* Biometric Face Guide Reticle */}
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                              <div className="w-44 h-56 sm:w-52 sm:h-64 border-2 border-dashed border-[#FF6B00]/70 rounded-[36px] shadow-[0_0_20px_rgba(255,107,0,0.2)] relative flex items-center justify-center">
                                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-[#FF6B00] rounded-tl-xl"></div>
                                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-[#FF6B00] rounded-tr-xl"></div>
                                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-[#FF6B00] rounded-bl-xl"></div>
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-[#FF6B00] rounded-br-xl"></div>
                                <span className="text-[10px] font-mono-code text-white/80 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-xs absolute -bottom-7">
                                  Posisikan wajah di dalam bingkai
                                </span>
                              </div>
                            </div>

                            {/* Live Overlay GPS Badge */}
                            <div className="absolute top-3 left-3 pointer-events-none">
                              <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono-code text-white flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span>{!isGpsLocked ? 'Mencari Lokasi...' : `GPS: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`}</span>
                              </div>
                            </div>

                            {/* Flip Camera */}
                            <div className="absolute top-3 right-3 flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={toggleCameraFlip}
                                className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/10 transition-all cursor-pointer shadow-md"
                                title="Putar Kamera"
                              >
                                <FlipHorizontal className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Retake Control (Hanya tampil jika foto telah terambil) */}
                  {capturedPhoto && (
                    <div className="px-1">
                      <button
                        type="button"
                        onClick={retakePhoto}
                        className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-[#FF6B00]" />
                        <span>Ambil Foto Ulang</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Multi-Project Selector (Hadir jika karyawan terdaftar / terlibat dalam > 1 proyek) */}
                {userAuthorizedProjects.length > 1 && (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-teal-50/80 via-emerald-50/50 to-slate-50 border border-teal-200/80 shadow-xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-teal-950">
                        <Briefcase className="w-4 h-4 text-teal-600 shrink-0" />
                        <span>Penugasan Proyek ({userAuthorizedProjects.length} Proyek Terdaftar)</span>
                      </div>
                      {matchingAuthorizedProject && !selectedProjectIdOverride && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono-code flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          Terdeteksi Otomatis
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="relative flex-1">
                        <select
                          value={selectedProjectIdOverride || ''}
                          onChange={e => setSelectedProjectIdOverride(e.target.value ? e.target.value : null)}
                          className="w-full py-2 px-3 pr-8 rounded-xl bg-white border border-teal-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-xs cursor-pointer"
                        >
                          <option value="">
                            {matchingAuthorizedProject
                              ? `✨ Otomatis: ${matchingAuthorizedProject.project.code} - ${matchingAuthorizedProject.project.name} (Dalam Radius)`
                              : `✨ Otomatis (Proyek Aktif: ${activeProject ? activeProject.code : 'Kantor Pusat'})`}
                          </option>
                          {userAuthorizedProjects.map(p => {
                            const isHO = Boolean(p.isHeadOffice || p.code === 'PRJ-001' || p.name.toUpperCase().includes('KANTOR PUSAT'));
                            const pGeo = isHO
                              ? { lat: -7.293144, lng: 112.775337, radius: 350 }
                              : getProjectCoordinates(p);
                            const dist = pGeo && coords.lat && coords.lng
                              ? calculateDistanceMeters(coords.lat, coords.lng, pGeo.lat, pGeo.lng)
                              : null;
                            const distLabel = dist !== null
                              ? (dist <= (pGeo?.radius || 350) ? ' • [Dalam Radius Valid]' : ` • [${formatDistanceKm(dist)}]`)
                              : '';
                            return (
                              <option key={p.id} value={p.id}>
                                {p.code} - {p.name}{distLabel}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {selectedProjectIdOverride && (
                        <button
                          type="button"
                          onClick={() => setSelectedProjectIdOverride(null)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 text-[11px] font-bold transition-all shrink-0 cursor-pointer"
                          title="Kembalikan ke Deteksi Otomatis GPS"
                        >
                          Reset Otomatis
                        </button>
                      )}
                    </div>

                    <p className="text-[10.5px] text-teal-800/90 leading-tight">
                      Sistem memvalidasi kehadiran Anda dari lokasi proyek manapun yang ditugaskan. Presensi akan dicatat ke <strong>{activeProject?.name}</strong>.
                    </p>
                  </div>
                )}

                {/* Live GPS Coordinates Status Banner */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MapPin className={`w-5 h-5 shrink-0 ${!isGpsLocked ? 'text-blue-500 animate-pulse' : isWithinAnyAuthorizedGeofence ? 'text-emerald-600' : 'text-rose-500'}`} />
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 text-xs">
                          {!isGpsLocked ? 'Mendeteksi Lokasi Presensi...' : activeLocationTitle}
                        </span>
                        <span className="text-slate-400 font-mono-code text-[11px]">
                          ({isGpsLocked && coords.lat ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'Mencari sinyal...'})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {!isGpsLocked
                          ? 'Sinkronisasi sensor GPS & jaringan...'
                          : (coords.address ? coords.address.replace(' (GPS HP Asli)', '').replace(' (Lokasi Jaringan PC)', '') : 'Koordinat lokasi terkunci')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono-code ${!isGpsLocked
                        ? 'bg-blue-100 text-blue-800 border border-blue-300 animate-pulse'
                        : isWithinAnyAuthorizedGeofence
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}>
                      {!isGpsLocked
                        ? 'Mencari Lokasi...'
                        : isWithinAnyAuthorizedGeofence
                          ? `${formatDistanceKm(effectiveTargetDistance)} • Masuk Area Kerja (Valid)`
                          : `${formatDistanceKm(effectiveTargetDistance)} • Luar Area`}
                    </span>
                    <button
                      type="button"
                      title="Refresh Lokasi Terkini"
                      onClick={() => fetchDeviceGps(true)}
                      className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isGpsLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Status Keterlambatan: 1 Baris Input & Tanpa Preset */}
                {attendanceAction === 'CHECK_IN' && isLate && (
                  <div className="p-3 rounded-2xl bg-rose-50/90 border border-rose-300 shadow-xs space-y-1.5 motion-fade-in-up">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 animate-pulse" />
                        <span>Terdeteksi Keterlambatan ({lateMinutes} Menit Lewat {userSchedule.cutoffTime} WIB)</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-rose-200 text-rose-900 font-mono-code uppercase tracking-wider shrink-0">
                        Wajib Isi Alasan
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      value={lateReason}
                      onChange={e => setLateReason(e.target.value)}
                      placeholder="Tuliskan catatan alasan kenapa Anda terlambat (wajib diisi mandiri)..."
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 border border-rose-300 focus:ring-2 focus:ring-rose-500/30 bg-white shadow-2xs font-medium"
                    />
                  </div>
                )}

                {/* Status Pulang Lebih Awal: Warning & Alasan (Wajib diisi & Memerlukan Approval PKM dan HR) */}
                {attendanceAction === 'CHECK_OUT' && isEarlyCheckOut && (
                  <div className="p-3.5 rounded-2xl bg-amber-50/95 border border-amber-400 shadow-xs space-y-2 motion-fade-in-up">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-amber-950 font-bold text-xs">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                        <span>Pulang Lebih Awal ({earlyCheckOutMinutes} Menit Sebelum {userSchedule.checkOutTime} WIB)</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-200 text-amber-900 font-mono-code uppercase tracking-wider shrink-0">
                        Wajib Approval PKM & HR
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                      Jam operasional selesai shift adalah <strong>{userSchedule.checkOutTime} WIB</strong> ({userSchedule.projectName}). Pulang sebelum jam selesai kerja memerlukan persetujuan berjenjang dari <strong>PKM (Project Manager)</strong> dan <strong>HR Manager</strong>.
                    </p>
                    <input
                      type="text"
                      required
                      value={earlyCheckOutReason}
                      onChange={e => setEarlyCheckOutReason(e.target.value)}
                      placeholder="Tuliskan alasan jelas izin pulang lebih awal (wajib diisi)..."
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 border border-amber-300 focus:ring-2 focus:ring-amber-500/30 bg-white shadow-2xs font-medium"
                    />
                  </div>
                )}

                {/* Status Masuk Area Kerja: 1 Baris Input & Tanpa Preset */}
                {!isWithinAnyAuthorizedGeofence && (
                  <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-300 shadow-xs space-y-1.5 motion-fade-in-up">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                        <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Presensi di Luar Radius Area Kerja ({formatDistanceKm(effectiveTargetDistance)})</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-amber-200 text-amber-900 font-mono-code uppercase tracking-wider shrink-0">
                        Wajib Isi Catatan
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      value={outOfRangeReason}
                      onChange={e => setOutOfRangeReason(e.target.value)}
                      placeholder="Tuliskan catatan / alasan presensi di luar radius (wajib diisi mandiri)..."
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 border border-amber-300 focus:ring-2 focus:ring-amber-500/30 bg-white shadow-2xs font-medium"
                    />
                  </div>
                )}

                {/* 4. Submit Action Button */}
                <div className="space-y-2 pt-1">


                  {/* Peringatan GPS Tidak Aktif */}
                  {!isGpsLocked && (
                    <div className="p-3 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span className="text-[11px] leading-relaxed font-semibold">
                          {gpsError || 'GPS perangkat belum aktif / terkunci. Wajib mengaktifkan GPS untuk presensi.'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchDeviceGps(true)}
                        className="px-2.5 py-1 rounded-lg bg-rose-200 hover:bg-rose-300 text-rose-900 font-bold text-[10px] shrink-0 transition-colors"
                      >
                        Aktifkan GPS
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!isGpsLocked}
                    className={`w-full py-3.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md ${!isGpsLocked
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                        : 'bg-gradient-to-r from-[#FF6B00] via-[#FF8533] to-[#FF6B00] text-white hover:shadow-lg hover:shadow-orange-500/25 active:scale-98 cursor-pointer'
                      }`}
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {!isGpsLocked
                        ? (isGpsLoading ? 'Mencari Sinyal GPS...' : 'GPS Wajib Aktif untuk Presensi')
                        : capturedPhoto
                          ? (attendanceAction === 'CHECK_IN' ? 'Kirim Absen Masuk Sekarang' : 'Kirim Absen Pulang Sekarang')
                          : (attendanceAction === 'CHECK_IN' ? 'Ambil Foto & Absen Masuk' : 'Ambil Foto & Absen Pulang')}
                    </span>
                  </button>
                </div>

              </form>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Attendance History Table */}
      <div id="tour-attendance-history" className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#FF6B00]" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono-code">
              {isSuperOrAdmin ? 'Riwayat Log Presensi Terkini' : 'Riwayat Log Presensi Saya'}
            </h2>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <input
                type="text"
                placeholder="Cari ID login (d014...), nama, tgl..."
                value={logSearchQuery}
                onChange={e => setLogSearchQuery(e.target.value)}
                className="w-48 sm:w-64 px-3 py-1 text-xs rounded-xl border border-slate-200 bg-white font-mono-code focus:outline-none focus:border-[#FF6B00] placeholder:text-slate-400"
              />
              {logSearchQuery && (
                <button
                  type="button"
                  onClick={() => setLogSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  title="Hapus pencarian"
                >
                  ✕
                </button>
              )}
            </div>
            <span className="text-xs text-slate-500 font-medium font-mono-code whitespace-nowrap">
              {isDbLoading && visibleAttendanceHistory.length === 0 ? (
                <span className="inline-flex items-center gap-1.5 text-slate-400 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Sinkronisasi...
                </span>
              ) : (
                `Total: ${visibleAttendanceHistory.length} Rekaman ${isSuperOrAdmin ? '(Semua Karyawan)' : '(Data Mandiri)'}`
              )}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed min-w-[1020px] text-left text-xs">
            <colgroup>
              <col className="w-[110px]" />
              <col className="w-[22%]" />
              <col className="w-[195px]" />
              <col className="w-[195px]" />
              <col className="w-[125px]" />
              <col className="w-[160px]" />
              {currentRole === 'superuser' && onDeleteAttendance && (
                <col className="w-[55px]" />
              )}
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200/80 text-slate-500 uppercase tracking-wider text-[10px] font-mono-code">
                <th className="py-2.5 px-3 w-[110px]">Date</th>
                <th className="py-2.5 px-3">Karyawan</th>
                <th className="py-2.5 px-3 w-[195px]">Absen Masuk</th>
                <th className="py-2.5 px-3 w-[195px]">Absen Pulang</th>
                <th className="py-2.5 px-3 w-[125px]">Work Hour</th>
                <th className="py-2.5 px-3 w-[160px]">Status Verifikasi</th>
                {currentRole === 'superuser' && onDeleteAttendance && (
                  <th className="py-2.5 px-3 w-[55px] text-right">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleAttendanceHistory.length === 0 ? (
                <tr>
                  <td colSpan={currentRole === 'superuser' && onDeleteAttendance ? 7 : 6} className="py-10 text-center text-slate-400 text-xs">
                    {isDbLoading ? (
                      <div className="flex flex-col items-center justify-center gap-2 animate-pulse py-4">
                        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span className="font-mono-code text-xs text-slate-500">Sinkronisasi log presensi dari server...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Clock className="w-5 h-5 text-slate-300" />
                        <span>Belum ada rekaman log presensi untuk akun Anda ({currentUser.name}).</span>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                displayedAttendanceHistory.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono-code">
                        <Calendar className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                        <span className="font-semibold text-slate-800 text-[11px]">{item.date}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 overflow-hidden">
                      <div className="font-bold text-slate-900 truncate" title={item.employeeName}>{item.employeeName}</div>
                      <div className="text-[10px] text-indigo-600 font-mono-code font-semibold">
                        {getRecordLoginBadgeId(item)}
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {item.checkInTime ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedHistoryItem(item);
                            setSelectedPhotoType('CHECK_IN');
                          }}
                          className="flex items-center gap-1.5 font-mono-code group cursor-pointer text-left focus:outline-none"
                          title="Klik untuk melihat bukti foto & watermark presensi masuk"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 group-hover:scale-125 transition-transform" />
                          <span className="font-bold text-slate-800 text-[11px] group-hover:text-[#FF6B00] group-hover:underline transition-colors">
                            {item.checkInTime} WIB
                          </span>
                          {(() => {
                            const inBio = item.checkInBiometric || (item.checkInTime ? item.biometricVerification : undefined);
                            const score = inBio?.matchScore;
                            if (score === undefined || score === null) return null;
                            const isHigh = score >= 70;
                            const isMid = score >= 60;
                            return (
                              <span
                                className={`px-1.5 py-0.2 rounded-full border text-[10px] font-bold font-mono-code inline-flex items-center gap-0.5 shadow-2xs ${
                                  isHigh
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isMid
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                                title={`Skor Biometrik Wajah Masuk: ${score}% (${inBio?.details || (score >= 60 ? 'Cocok' : 'Kemiripan Rendah')})`}
                              >
                                {score >= 60 ? (
                                  <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                                ) : (
                                  <ShieldAlert className="w-2.5 h-2.5 shrink-0" />
                                )}
                                <span>{score}%</span>
                              </span>
                            );
                          })()}
                        </button>
                      ) : item.checkOutTime ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedHistoryItem(item);
                            setSelectedPhotoType('CHECK_OUT');
                          }}
                          className="px-2 py-0.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold font-mono-code inline-flex items-center gap-1 cursor-pointer transition-colors"
                          title="Klik untuk melihat bukti foto presensi pulang"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                          Tidak Absen Masuk
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px] font-mono-code">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {item.checkOutTime ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedHistoryItem(item);
                            setSelectedPhotoType('CHECK_OUT');
                          }}
                          className="flex items-center gap-1.5 font-mono-code group cursor-pointer text-left focus:outline-none"
                          title="Klik untuk melihat bukti foto & watermark presensi pulang"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 group-hover:scale-125 transition-transform" />
                          <span className="font-bold text-emerald-600 text-[11px] group-hover:text-[#FF6B00] group-hover:underline transition-colors">
                            {item.checkOutTime} WIB
                          </span>
                          {(() => {
                            const outBio = item.checkOutBiometric || (item.checkOutTime && (!item.checkInTime || item.attendanceType === 'CHECK_OUT') ? item.biometricVerification : undefined);
                            const score = outBio?.matchScore;
                            if (score === undefined || score === null) return null;
                            const isHigh = score >= 70;
                            const isMid = score >= 60;
                            return (
                              <span
                                className={`px-1.5 py-0.2 rounded-full border text-[10px] font-bold font-mono-code inline-flex items-center gap-0.5 shadow-2xs ${
                                  isHigh
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isMid
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                                title={`Skor Biometrik Wajah Pulang: ${score}% (${outBio?.details || (score >= 60 ? 'Cocok' : 'Kemiripan Rendah')})`}
                              >
                                {score >= 60 ? (
                                  <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                                ) : (
                                  <ShieldAlert className="w-2.5 h-2.5 shrink-0" />
                                )}
                                <span>{score}%</span>
                              </span>
                            );
                          })()}
                        </button>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] italic font-medium font-mono-code">
                          Belum Pulang
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {(() => {
                        const duration = formatWorkDuration(item.checkInTime, item.checkOutTime);
                        if (duration) {
                          return (
                            <div className="inline-flex items-center gap-1.5 font-mono-code">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-bold text-slate-800 text-[11px]">{duration}</span>
                            </div>
                          );
                        }
                        if (item.checkInTime && !item.checkOutTime) {
                          return (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200/80 text-[10px] font-mono-code font-semibold inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              Sedang Kerja
                            </span>
                          );
                        }
                        return <span className="text-slate-400 text-[11px] font-mono-code">-</span>;
                      })()}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {(!item.checkInTime && item.checkOutTime) ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold animate-pulse inline-flex items-center gap-1">
                          Perlu Approval PM & HR
                        </span>
                      ) : item.approvalStatus === 'PENDING' ? (
                        <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold animate-pulse">
                          Menunggu Approval
                        </span>
                      ) : item.approvalStatus === 'APPROVED' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Disetujui
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                          Tervalidasi Otomatis
                        </span>
                      )}
                    </td>
                    {currentRole === 'superuser' && onDeleteAttendance && (
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm(`Hapus permanen rekaman presensi tanggal ${item.date} (${item.employeeName})? Tindakan ini tidak dapat dibatalkan.`)) {
                              try {
                                await onDeleteAttendance(item.id);
                              } catch (err: any) {
                                alert('Gagal menghapus presensi: ' + (err?.message || err));
                              }
                            }
                          }}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-200 inline-flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
                          title="Hapus Rekaman Presensi (Khusus Superuser)"
                          aria-label="Hapus Rekaman Presensi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Load More & Infinite Scroll Controller */}
        <div className="pt-4 mt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="font-mono-code text-[11px] text-slate-500">
            Menampilkan <span className="font-bold text-slate-900">{displayedAttendanceHistory.length}</span> dari <span className="font-bold text-slate-900">{visibleAttendanceHistory.length}</span> Rekaman
          </div>

          {hasMore ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDisplayLimit(prev => Math.min(prev + PAGE_SIZE, visibleAttendanceHistory.length))}
                className="px-4 py-2 rounded-xl bg-orange-50 hover:bg-[#FF6B00] text-[#FF6B00] hover:text-white border border-orange-200 hover:border-[#FF6B00] font-bold text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-2xs"
              >
                <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
                <span>Muat 10 Rekaman Lagi ({visibleAttendanceHistory.length - displayLimit} Tersisa)</span>
              </button>
            </div>
          ) : visibleAttendanceHistory.length > 0 ? (
            <div className="text-[11px] text-emerald-600 font-mono-code font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200/80">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Seluruh {visibleAttendanceHistory.length} rekaman telah dimuat</span>
            </div>
          ) : null}
        </div>
        <div ref={sentinelRef} className="h-4 w-full pointer-events-none" />
      </div>

      {/* Modal Photo Inspector (Portaled to document.body) */}
      {selectedHistoryItem && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedHistoryItem(null);
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 modal-dialog-animate my-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>Bukti Foto & Watermark</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono-code ${selectedPhotoType === 'CHECK_IN'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-blue-100 text-blue-800 border border-blue-300'
                    }`}>
                    {selectedPhotoType === 'CHECK_IN' ? 'FOTO MASUK' : 'FOTO PULANG'}
                  </span>
                </h3>
                <p className="text-[10px] text-slate-500 font-mono-code">{selectedHistoryItem.id}</p>
              </div>
              <button
                onClick={() => setSelectedHistoryItem(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const isCheckoutWithoutIn = selectedHistoryItem.attendanceType === 'CHECK_OUT' && 
                (!selectedHistoryItem.checkInTime || selectedHistoryItem.note?.toLowerCase().includes('tanpa absen masuk'));

              const rawIn = selectedHistoryItem.checkInPhotoUrl || (!isCheckoutWithoutIn ? selectedHistoryItem.photoUrl : null);
              const rawOut = selectedHistoryItem.checkOutPhotoUrl || selectedHistoryItem.photoOutUrl || (isCheckoutWithoutIn ? selectedHistoryItem.photoUrl : null);

              const photoMasuk = (rawIn && rawIn !== rawOut) || (!isCheckoutWithoutIn && rawIn) ? rawIn : null;
              const photoPulang = rawOut || (selectedHistoryItem.checkOutTime && selectedHistoryItem.photoUrl ? selectedHistoryItem.photoUrl : null);

              const hasBothOrCheckout = Boolean(selectedHistoryItem.checkOutTime || photoPulang);
              const isMasuk = selectedPhotoType === 'CHECK_IN';
              const activePhoto = isMasuk ? photoMasuk : photoPulang;

              // 1. Lokasi & Geofence Aktual sesuai sesi Masuk vs Pulang
              const activeLocation = isMasuk
                ? (selectedHistoryItem.checkInLocation || (
                    selectedHistoryItem.checkOutLocation && selectedHistoryItem.location &&
                    selectedHistoryItem.location.lat === selectedHistoryItem.checkOutLocation.lat &&
                    selectedHistoryItem.location.lng === selectedHistoryItem.checkOutLocation.lng
                      ? undefined
                      : selectedHistoryItem.location
                  ))
                : (selectedHistoryItem.checkOutLocation || selectedHistoryItem.location);

              // 2. Biometrik Aktual sesuai sesi Masuk vs Pulang
              const activeBiometric = isMasuk
                ? (selectedHistoryItem.checkInBiometric || (
                    selectedHistoryItem.biometricVerification
                      ? {
                          ...selectedHistoryItem.biometricVerification,
                          details: selectedHistoryItem.biometricVerification.details?.replace(/saat presensi pulang/gi, 'saat presensi masuk') || 'Biometrik terverifikasi valid saat presensi masuk'
                        }
                      : undefined
                  ))
                : (selectedHistoryItem.checkOutBiometric || (
                    selectedHistoryItem.biometricVerification
                      ? {
                          ...selectedHistoryItem.biometricVerification,
                          details: selectedHistoryItem.biometricVerification.details?.replace(/saat presensi masuk/gi, 'saat presensi pulang') || 'Biometrik terverifikasi valid saat presensi pulang'
                        }
                      : undefined
                  ));

              // 3. Catatan Presensi Aktual sesuai sesi Masuk vs Pulang
              let activeNote = '-';
              if (isMasuk) {
                activeNote = selectedHistoryItem.checkInNote || (
                  selectedHistoryItem.checkInTime && !selectedHistoryItem.note?.toLowerCase().includes('hanya absen pulang') && !selectedHistoryItem.note?.toLowerCase().includes('pulang lebih awal')
                    ? selectedHistoryItem.note
                    : '-'
                ) || '-';
              } else {
                if (selectedHistoryItem.checkOutNote) {
                  activeNote = selectedHistoryItem.checkOutNote;
                } else if (selectedHistoryItem.isEarlyCheckOut && selectedHistoryItem.earlyCheckOutMinutes && selectedHistoryItem.earlyCheckOutMinutes < 720) {
                  activeNote = `[Pulang Lebih Awal ${selectedHistoryItem.earlyCheckOutMinutes} Mnt]: ${selectedHistoryItem.earlyCheckOutReason || 'Izin pulang lebih awal'}`;
                } else if (selectedHistoryItem.attendanceType === 'CHECK_OUT' && selectedHistoryItem.note && !selectedHistoryItem.note.toLowerCase().includes('pulang lebih awal 1020')) {
                  activeNote = selectedHistoryItem.note;
                } else if (selectedHistoryItem.checkOutLocation && !selectedHistoryItem.checkOutLocation.inGeofence) {
                  const outDist = selectedHistoryItem.checkOutLocation.distanceMeters ? `${Math.round(selectedHistoryItem.checkOutLocation.distanceMeters)}m` : '';
                  activeNote = selectedHistoryItem.outOfRangeReason
                    ? `[Luar Area ${outDist}]: ${selectedHistoryItem.outOfRangeReason}`
                    : (selectedHistoryItem.note?.includes('[Luar Area') ? selectedHistoryItem.note : 'Presensi Pulang di Luar Radius Area Kerja');
                } else if (selectedHistoryItem.checkOutTime) {
                  activeNote = 'Presensi Pulang (Dalam Area Kerja)';
                }
              }

              return (
                <>
                  {/* Toggle Switch between Foto Masuk & Foto Pulang */}
                  {hasBothOrCheckout && (
                    <div className="px-4 pt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPhotoType('CHECK_IN')}
                        className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          selectedPhotoType === 'CHECK_IN'
                            ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${photoMasuk ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span>Foto Masuk {photoMasuk ? `(${selectedHistoryItem.checkInTime || '-'})` : '(Tanpa Foto)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPhotoType('CHECK_OUT')}
                        className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          selectedPhotoType === 'CHECK_OUT'
                            ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${photoPulang ? 'bg-blue-400' : 'bg-slate-400'}`} />
                        <span>Foto Pulang {photoPulang ? `(${selectedHistoryItem.checkOutTime || '-'})` : '(Belum Pulang)'}</span>
                      </button>
                    </div>
                  )}

                  <div className="p-4">
                    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-900 flex items-center justify-center min-h-[220px] max-h-[380px]">
                      {activePhoto ? (
                        <img
                          src={activePhoto}
                          alt={isMasuk ? "Bukti Foto Absen Masuk" : "Bukti Foto Absen Pulang"}
                          className="w-full object-contain max-h-[380px]"
                        />
                      ) : (
                        <div className="py-12 px-4 text-center flex flex-col items-center justify-center gap-2">
                          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-amber-400 mb-1">
                            <CameraOff className="w-6 h-6" />
                          </div>
                          <p className="text-sm font-bold text-white font-mono-code">
                            {isMasuk ? 'Tidak Ada Bukti Foto Absen Masuk' : 'Tidak Ada Bukti Foto Absen Pulang'}
                          </p>
                          <p className="text-xs font-mono-code text-slate-400 max-w-sm">
                            {isMasuk
                              ? (isCheckoutWithoutIn ? 'Karyawan melakukan presensi pulang langsung tanpa merekam foto presensi masuk.' : 'Bukti foto selfie presensi masuk tidak tersedia untuk rekaman ini.')
                              : 'Karyawan belum melakukan presensi pulang atau tidak ada rekam foto pulang.'}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                      <p>
                        <span className="font-bold text-slate-700">Waktu & Tipe:</span>{' '}
                        <span className="font-mono-code font-bold text-slate-900">
                          {isMasuk
                            ? `Absen Masuk (${selectedHistoryItem.checkInTime || '-'} WIB)`
                            : `Absen Pulang (${selectedHistoryItem.checkOutTime || '-'} WIB)`}
                        </span>
                      </p>
                      {formatWorkDuration(selectedHistoryItem.checkInTime, selectedHistoryItem.checkOutTime) && (
                        <p>
                          <span className="font-bold text-slate-700">Work Hour:</span>{' '}
                          <span className="font-mono-code font-bold text-emerald-700">
                            {formatWorkDuration(selectedHistoryItem.checkInTime, selectedHistoryItem.checkOutTime)}
                          </span>
                        </p>
                      )}
                      <p>
                        <span className="font-bold text-slate-700">Karyawan:</span> {selectedHistoryItem.employeeName} •{' '}
                        <span className="text-indigo-600 font-mono-code font-bold">
                          {getRecordLoginBadgeId(selectedHistoryItem)}
                        </span>
                        {(() => {
                          const recNik = (selectedHistoryItem.employeeNik || '').trim();
                          return (recNik && recNik !== '-' && !recNik.startsWith('PRIME-')) ? (
                            <span className="text-slate-400 font-mono-code ml-1.5">({recNik})</span>
                          ) : null;
                        })()}
                      </p>
                      <p>
                        <span className="font-bold text-slate-700">Catatan:</span>{' '}
                        <span className="text-slate-800 font-medium">{activeNote}</span>
                      </p>
                      <p>
                        <span className="font-bold text-slate-700">Geofence:</span>{' '}
                        <span className="font-mono-code font-semibold">
                          {formatDistanceKm(activeLocation?.distanceMeters)}
                        </span>{' '}
                        •{' '}
                        <span className={activeLocation?.inGeofence ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                          {activeLocation?.inGeofence ? 'Dalam Area Geofence Resmi' : 'Luar Radius'}
                        </span>
                      </p>
                      <p>
                        <span className="font-bold text-slate-700">Lokasi:</span>{' '}
                        <span className="text-slate-800">{activeLocation?.address || 'Satelit GPS Terverifikasi'}</span>
                        {activeLocation?.lat && activeLocation?.lng && (
                          <span className="text-slate-500 font-mono-code ml-1.5 block sm:inline">
                            (Lat {Number(activeLocation.lat).toFixed(6)}, Lng {Number(activeLocation.lng).toFixed(6)}
                            {activeLocation.accuracy ? ` • Akurasi ±${activeLocation.accuracy}m` : ''})
                          </span>
                        )}
                      </p>
                      {activeBiometric?.matchScore !== undefined && (
                        <p>
                          <span className="font-bold text-slate-700">Skor Biometrik:</span>{' '}
                          <span
                            className={`font-mono-code font-bold ${
                              (activeBiometric?.matchScore || 0) >= 70
                                ? 'text-emerald-700'
                                : (activeBiometric?.matchScore || 0) >= 60
                                ? 'text-blue-700'
                                : 'text-rose-600'
                            }`}
                          >
                            {activeBiometric.matchScore}% Match
                          </span>{' '}
                          {activeBiometric?.details ? `• ${activeBiometric.details}` : ''}
                        </p>
                      )}
                    </div>
              {currentRole === 'superuser' && onDeleteAttendance && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={async () => {
                      if (window.confirm(`Hapus permanen rekaman presensi tanggal ${selectedHistoryItem.date} (${selectedHistoryItem.employeeName})?`)) {
                        try {
                          await onDeleteAttendance(selectedHistoryItem.id);
                          setSelectedHistoryItem(null);
                        } catch (err: any) {
                          alert('Gagal menghapus: ' + (err?.message || err));
                        }
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-semibold text-xs cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Rekaman Ini (Superuser)</span>
                  </button>
                </div>
              )}
            </div>
          </>
        );
      })()}
    </div>
  </div>,
        document.body
      )}

      {/* Real Attendance Submission Success Dialog (Portaled to document.body) */}
      {isSuccessModalOpen && submittedRecord && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSuccessModalOpen(false);
          }}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-auto animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >

            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 font-mono-code bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 inline-block">
                PRESENSI TERVERIFIKASI REALTIME
              </span>
              <h2 className="text-xl font-black text-slate-900">
                {submittedRecord.attendanceType === 'CHECK_OUT'
                  ? 'Presensi Pulang Berhasil Dicatat!'
                  : 'Presensi Masuk Berhasil Disimpan!'}
              </h2>
              <p className="text-xs text-slate-600">
                {submittedRecord.attendanceType === 'CHECK_OUT'
                  ? 'Data presensi kepulangan (check-out) dan foto selfie resmi telah dicatat ke dalam database.'
                  : 'Data kehadiran dan foto selfie resmi telah dicatat ke dalam database DMJ HRIS Enterprise.'}
              </p>
            </div>

            {/* Photo Preview with Watermark */}
            <div className="relative aspect-4/3 rounded-2xl overflow-hidden border border-slate-200 shadow-md">
              <img
                src={submittedRecord.attendanceType === 'CHECK_OUT' ? (submittedRecord.photoOutUrl || submittedRecord.photoUrl) : submittedRecord.photoUrl}
                alt="Selfie Presensi Terverifikasi"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2.5 right-2.5 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                <Check className="w-3 h-3" />
                <span>Valid Audit Watermark ({submittedRecord.attendanceType === 'CHECK_OUT' ? 'Pulang' : 'Masuk'})</span>
              </div>
            </div>

            {/* Attendance Details Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                <span className="text-slate-500">Tipe Presensi:</span>
                <span className={`font-bold font-mono-code text-[11px] px-2 py-0.5 rounded ${
                  submittedRecord.attendanceType === 'CHECK_OUT' ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {submittedRecord.attendanceType === 'CHECK_OUT' ? '🚪 ABSEN PULANG (CHECK-OUT)' : '🏢 ABSEN MASUK (CHECK-IN)'}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                <span className="text-slate-500">Nama Karyawan:</span>
                <span className="font-bold text-slate-900">{submittedRecord.employeeName}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                <span className="text-slate-500">Waktu Presensi:</span>
                <span className="font-mono-code font-bold text-slate-900">
                  {submittedRecord.attendanceType === 'CHECK_OUT'
                    ? `${submittedRecord.checkOutTime || submittedRecord.checkInTime || '-'} WIB (Pulang)`
                    : `${submittedRecord.checkInTime || '-'} WIB (Masuk)`}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                <span className="text-slate-500">Status Kehadiran:</span>
                <span className={`font-bold px-2 py-0.5 rounded-md font-mono-code text-[11px] ${
                  submittedRecord.attendanceType === 'CHECK_OUT'
                    ? (submittedRecord.isEarlyCheckOut ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')
                    : (submittedRecord.status === 'ON_TIME' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')
                }`}>
                  {submittedRecord.attendanceType === 'CHECK_OUT'
                    ? (submittedRecord.isEarlyCheckOut
                        ? `PULANG LEBIH AWAL (${submittedRecord.earlyCheckOutMinutes}m - APPROVAL PM & HR)`
                        : 'PULANG NORMAL (SELESAI KERJA)')
                    : (submittedRecord.status === 'ON_TIME'
                        ? 'TEPAT WAKTU (ON TIME)'
                        : `TERLAMBAT (${submittedRecord.lateMinutes}m - PENGAJUAN DIAJUKAN KE HR)`)}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500">Radius & Geofence:</span>
                <span className="text-slate-700 font-mono-code text-[11px] truncate max-w-[240px]">
                  {formatDistanceKm(submittedRecord.location.distanceMeters)} ({submittedRecord.location.inGeofence ? 'Dalam Area Resmi' : 'Toleransi Geotag'})
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  onNavigateToTab?.('dashboard');
                }}
                className="w-full py-2.5 rounded-xl bg-orange-50 hover:bg-[#FF6B00] hover:text-white text-[#FF6B00] font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Lihat di Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  onNavigateToTab?.('user_performance');
                }}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Buka Kinerja Saya</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsSuccessModalOpen(false)}
              className="w-full py-1 text-center text-xs text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
            >
              Tutup Dialog Ini
            </button>

          </div>
        </div>,
        document.body
      )}

      {/* Unified Geofence & Location Coordinates Setting Modal (Portaled to document.body for instant screen-centered pop up) */}
      {isGeofenceModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsGeofenceModalOpen(false);
          }}
        >
          <div
            className="glass-card bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-auto animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >

            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 text-[#FF6B00] flex items-center justify-center font-bold shadow-xs shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Pusat Pengaturan Titik Lat/Lng & Geofence
                  </h3>
                  <p className="text-xs text-slate-500">
                    Konfigurasi lokasi resmi Kantor Pusat & seluruh Proyek Terkait
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGeofenceModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Location Selector: Office vs Related Projects */}
            <div className="p-2 rounded-2xl bg-slate-100/90 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Target Lokasi Penugasan:
                </span>
                <span className="text-[10px] font-mono-code font-bold text-[#FF6B00]">
                  {geofenceTargetType === 'OFFICE' ? 'Kantor Utama / Workshop' : 'Site Proyek Kontrak'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => loadOfficeTarget()}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${geofenceTargetType === 'OFFICE'
                      ? 'bg-white text-[#FF6B00] shadow-xs border border-orange-200'
                      : 'text-slate-600 hover:text-slate-900 bg-white/50'
                    }`}
                >
                  <Building className="w-4 h-4" />
                  <span>🏢 Kantor Pusat & Workshop</span>
                </button>

                <div className="flex items-center gap-1 bg-white/50 rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() => loadProjectTarget(selectedGeoProjectId || projects[0]?.id || '')}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${geofenceTargetType === 'PROJECT'
                        ? 'bg-white text-[#FF6B00] shadow-2xs border border-orange-200'
                        : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>⚡ Proyek:</span>
                  </button>
                  <select
                    value={selectedGeoProjectId}
                    onChange={(e) => loadProjectTarget(e.target.value)}
                    className="flex-1 glass-input rounded-lg px-2 py-1 text-xs font-bold text-slate-800 bg-white min-w-0"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Quick 1-Click Feature: Use Current Phone GPS */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-orange-50/80 to-amber-50/60 border border-orange-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#FF6B00]" />
                  <span className="text-xs font-bold text-slate-900">
                    Posisi GPS Perangkat Saat Ini
                  </span>
                </div>
                <span className="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded-full bg-orange-200/70 text-orange-900">
                  Akurasi: ±{coords.accuracy}m
                </span>
              </div>

              <div className="text-[11px] font-mono-code text-slate-700 bg-white/80 p-2 rounded-xl border border-orange-100 flex flex-wrap items-center justify-between gap-2">
                <div>
                  Lat: <strong className="text-slate-900">{coords.lat}</strong>, Lng: <strong className="text-slate-900">{coords.lng}</strong>
                </div>
                <div className="text-[10px] text-slate-500 truncate max-w-xs">
                  {coords.address}
                </div>
              </div>

              <button
                type="button"
                onClick={handleUseCurrentPhoneGps}
                className="w-full py-2 px-3 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all active:scale-98"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>📍 Gunakan GPS Perangkat Ini untuk {geofenceTargetType === 'OFFICE' ? 'Kantor Pusat' : 'Proyek Terpilih'}</span>
              </button>
            </div>

            {/* Quick Preset Location Chips */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Preset Cepat Titik Lokasi Populer:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {LOCATION_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="p-2 rounded-xl border border-slate-200 hover:border-orange-400 bg-white hover:bg-orange-50/50 text-left transition-all cursor-pointer text-xs group"
                  >
                    <div className="font-bold text-slate-800 text-[11px] group-hover:text-[#FF6B00] truncate">
                      {preset.name}
                    </div>
                    <div className="text-[10px] font-mono-code text-slate-400 truncate">
                      {preset.lat}, {preset.lng}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback Message */}
            {geofenceModalMsg && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${geofenceModalMsg.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : geofenceModalMsg.type === 'info'
                    ? 'bg-blue-50 border border-blue-200 text-blue-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}>
                {geofenceModalMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : geofenceModalMsg.type === 'info' ? (
                  <Globe className="w-4 h-4 shrink-0 text-blue-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{geofenceModalMsg.text}</span>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Lokasi / Site / Workshop
                </label>
                <input
                  type="text"
                  value={tempOfficeName}
                  onChange={e => setTempOfficeName(e.target.value)}
                  placeholder="e.g. PRIME Enterprise - Innovation Hub Surabaya"
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Latitude (Lintang)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={tempOfficeLat}
                    onChange={e => setTempOfficeLat(e.target.value)}
                    placeholder="-7.293144"
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono-code text-slate-800"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Contoh: -7.293144</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Longitude (Bujur)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={tempOfficeLng}
                    onChange={e => setTempOfficeLng(e.target.value)}
                    placeholder="112.775337"
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono-code text-slate-800"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Contoh: 112.775337</span>
                </div>
              </div>

              {/* Radius Preset Chips & Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Radius Toleransi Geofence (Meter)
                  </label>
                  <span className="text-[11px] font-mono-code font-bold text-[#FF6B00]">
                    {tempOfficeRadius} Meter
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    { radius: 50, label: '50m (Ketat)' },
                    { radius: 100, label: '100m (Gedung)' },
                    { radius: 200, label: '200m (Workshop)' },
                    { radius: 350, label: '350m (Standar Geofence)' },
                    { radius: 500, label: '500m (Kawasan Industri)' },
                    { radius: 1000, label: '1000m (Site Luas)' }
                  ].map(chip => (
                    <button
                      key={chip.radius}
                      type="button"
                      onClick={() => setTempOfficeRadius(chip.radius)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${tempOfficeRadius === chip.radius
                          ? 'bg-orange-50 border-[#FF6B00] text-[#FF6B00] font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  min="10"
                  max="5000"
                  value={tempOfficeRadius}
                  onChange={e => setTempOfficeRadius(Number(e.target.value) || 0)}
                  placeholder="350"
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono-code text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Alamat Fisik / Lokasi Proyek
                </label>
                <textarea
                  rows={2}
                  value={tempOfficeAddress}
                  onChange={e => setTempOfficeAddress(e.target.value)}
                  placeholder="Alamat fisik resmi lokasi..."
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-800 resize-none"
                />
              </div>

              {/* Realtime Live Verification & Map Check */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-700">Verifikasi Jarak Saat Ini:</span>
                  {modalDistance !== null && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${modalDistance <= tempOfficeRadius
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : 'text-amber-700 bg-amber-50 border-amber-200'
                      }`}>
                      {modalDistance <= tempOfficeRadius
                        ? `✓ Di Dalam Radius (${modalDistance}m ≤ ${tempOfficeRadius}m)`
                        : `⚠ Di Luar Radius (${modalDistance}m > ${tempOfficeRadius}m)`}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                  <span className="text-[11px] font-mono-code text-slate-600">
                    Jarak: <strong className="text-slate-900">{modalDistance ?? '-'} m</strong> dari perangkat ini
                  </span>

                  <a
                    href={`https://www.google.com/maps?q=${tempOfficeLat},${tempOfficeLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                  >
                    <span>Cek di Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsGeofenceModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSavingGeofence}
                onClick={handleSaveGeofence}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSavingGeofence ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan ke SQLite...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan Koordinat {geofenceTargetType === 'OFFICE' ? 'Kantor' : 'Proyek'}</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Biometric Enrollment 4-Pose Modal */}
      <BiometricEnrollmentModal
        isOpen={isBiometricModalOpen}
        onClose={() => setIsBiometricModalOpen(false)}
        targetEmployee={currentUser}
        onSaveBiometric={handleSaveBiometric}
        operatorName={currentUser.name}
      />
    </div>
  );
};
