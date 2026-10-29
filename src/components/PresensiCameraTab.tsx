import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  LogIn,
  LogOut,
  ArrowRight,
  Camera,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Clock,
  Briefcase,
  Building,
  FileText,
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
  ShieldCheck,
  Smartphone,
  Network,
  Radio,
  ExternalLink,
  Lock,
  Power,
  FlipHorizontal,
  SlidersHorizontal,
  Trash2
} from 'lucide-react';
import { Employee, AttendanceRecord, AttendanceMode, SalaryRuleConfig, SystemRole, getEffectiveSystemRole, Project, BiometricProfile, BiometricVerificationResult } from '../types';
import { rtcService } from '../services/rtcService';
import { getEmployeeProjectSchedule } from '../utils/scheduleHelper';
import { BiometricEnrollmentModal } from './BiometricEnrollmentModal';
import { compareFaceBiometric } from '../utils/biometricHelper';
import { api } from '../services/api';

// Preset Lokasi Populer PRIME Enterprise & Site Proyek
export const LOCATION_PRESETS = [
  { name: 'Kantor Pusat & Workshop Sidoarjo', lat: -7.395625, lng: 112.717574, addr: 'Keboananom, Gedangan, Sidoarjo, Jawa Timur' },
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
  if (geo && typeof geo.latitude === 'number' && typeof geo.longitude === 'number' && !isNaN(geo.latitude) && !isNaN(geo.longitude)) {
    return {
      lat: geo.latitude,
      lng: geo.longitude,
      radius: geo.radiusMeters || 350
    };
  }

  // Fallback mapping berbasis nama proyek atau kota site resmi penempatan
  const loc = (proj.location || '').toUpperCase();
  const name = (proj.name || '').toUpperCase();

  if (loc.includes('PALEMBANG') || name.includes('GANI') || name.includes('SRIWIJAYA') || name.includes('AYJP') || name.includes('YONZIPUR')) {
    return { lat: -2.991240, lng: 104.757310, radius: 1000 };
  }
  if (loc.includes('TANGERANG') || name.includes('FABRIKASI')) {
    return { lat: -6.178306, lng: 106.631889, radius: 1000 };
  }
  if (name.includes('CIREMAI') || loc.includes('CIREBON')) {
    return { lat: -6.737150, lng: 108.552860, radius: 1000 };
  }
  if (loc.includes('JAKARTA') || name.includes('MERCURE THAMRIN') || name.includes('MANGGA BESAR') || name.includes('MAKODAM')) {
    return { lat: -6.229740, lng: 106.829510, radius: 1500 };
  }
  if (loc.includes('BALI') || name.includes('TRIBE') || name.includes('KEPAON') || name.includes('UDAYANA')) {
    return { lat: -8.720530, lng: 115.169120, radius: 1500 };
  }
  if (loc.includes('CIPATAT') || name.includes('PUSSENIF') || name.includes('PUDIKIF')) {
    return { lat: -6.837850, lng: 107.391210, radius: 1500 };
  }
  if (loc.includes('BANDUNG') || name.includes('CSR')) {
    return { lat: -6.917464, lng: 107.619123, radius: 1500 };
  }
  if (loc.includes('SUKABUMI') || name.includes('CIBADAK')) {
    return { lat: -6.927703, lng: 106.929848, radius: 1500 };
  }
  if (loc.includes('CIKARANG') || loc.includes('BEKASI') || name.includes('RUSUN')) {
    return { lat: -6.311740, lng: 107.159490, radius: 1500 };
  }
  if (loc.includes('BOGOR') || name.includes('UJANG')) {
    return { lat: -6.597147, lng: 106.806039, radius: 1500 };
  }
  if (loc.includes('BELITUNG') || name.includes('BW SUITE') || name.includes('KGJ')) {
    return { lat: -2.741050, lng: 107.658240, radius: 1500 };
  }
  if (loc.includes('LAMPUNG') || name.includes('GEDON TATAAN')) {
    return { lat: -5.450000, lng: 105.266670, radius: 1500 };
  }
  if (loc.includes('MADIUN') || loc.includes('PONOROGO') || loc.includes('MAGETAN')) {
    return { lat: -7.866700, lng: 111.466700, radius: 2500 };
  }
  if (loc.includes('SURABAYA') || loc.includes('SIDOARJO') || loc.includes('GRESIK') || name.includes('KANTOR PUSAT') || name.includes('BG JUNCTION')) {
    return { lat: -7.395625, lng: 112.717574, radius: 1500 };
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

interface PresensiCameraTabProps {
  currentUser: Employee;
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

export const PresensiCameraTab: React.FC<PresensiCameraTabProps> = ({
  currentUser,
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

    return [...rawList].sort((a, b) => {
      // 1. Sort by Date DESC
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);

      // 2. Sort by Latest Activity Time DESC (checkOutTime || checkInTime)
      const timeA = a.checkOutTime || a.checkInTime || '00:00:00';
      const timeB = b.checkOutTime || b.checkInTime || '00:00:00';
      return timeB.localeCompare(timeA);
    });
  }, [attendanceHistory, isSuperOrAdmin, currentUser.id, currentUser.nik, currentUser.name]);

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [activeParameterPanel, setActiveParameterPanel] = useState<'NOTE' | 'LOCATION' | 'DINAS' | 'LATE' | null>('NOTE');
  const [mode, setMode] = useState<AttendanceMode>('WFO');
  const [attendanceAction, setAttendanceAction] = useState<'CHECK_IN' | 'CHECK_OUT'>(() => {
    return new Date().getHours() >= 12 ? 'CHECK_OUT' : 'CHECK_IN';
  });
  const [note, setNote] = useState('Supervisi Machining & Koordinasi Operasional Shift');
  
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
  const [outOfRangeReason, setOutOfRangeReason] = useState('');

  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number; address: string }>({
    lat: salaryRules?.officeGeofence?.lat ?? -7.395625,
    lng: salaryRules?.officeGeofence?.lng ?? 112.717574,
    accuracy: 6.5,
    address: salaryRules?.officeGeofence?.address ?? 'Keboananom, Gedangan, Sidoarjo, Jawa Timur'
  });

  // State Pelacakan GPS Asli Smartphone Karyawan
  const [isGpsLoading, setIsGpsLoading] = useState<boolean>(false);
  const [gpsSource, setGpsSource] = useState<'DEVICE_HARDWARE' | 'DEFAULT'>('DEFAULT');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [realGeofenceDistance, setRealGeofenceDistance] = useState<number>(0);

  const [selectedHistoryItem, setSelectedHistoryItem] = useState<AttendanceRecord | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [submittedRecord, setSubmittedRecord] = useState<AttendanceRecord | null>(null);

  // Unified Multi-Location Geofence Settings State (Kantor Pusat & Seluruh Proyek Terkait)
  const [isGeofenceModalOpen, setIsGeofenceModalOpen] = useState(false);
  const [geofenceTargetType, setGeofenceTargetType] = useState<'OFFICE' | 'PROJECT'>('OFFICE');
  const [selectedGeoProjectId, setSelectedGeoProjectId] = useState<string>(projects[0]?.id || '');
  const [tempOfficeName, setTempOfficeName] = useState(salaryRules.officeGeofence?.name || 'PRIME Enterprise - Kantor Pusat & Innovation Hub');
  const [tempOfficeLat, setTempOfficeLat] = useState<number | string>(salaryRules.officeGeofence?.lat ?? -7.395625);
  const [tempOfficeLng, setTempOfficeLng] = useState<number | string>(salaryRules.officeGeofence?.lng ?? 112.717574);
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
    setTempOfficeLat(salaryRules.officeGeofence?.lat ?? -7.395625);
    setTempOfficeLng(salaryRules.officeGeofence?.lng ?? 112.717574);
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

  // Jarak dan Validasi Geofence terhadap Proyek Terkait & Deteksi Pintar Multi-Site
  const assignedProject = useMemo(() => {
    const projId = currentUser.assignedProjectId || (currentUser as any).employee?.assignedProjectId;
    return projects.find(p => p.id === projId);
  }, [projects, currentUser]);

  // State Proyek Terpilih (Default ke assignedProject / OFFICE, namun bisa di-override manual oleh staf)
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return currentUser.assignedProjectId || (currentUser as any).employee?.assignedProjectId || 'OFFICE';
  });
  const [isManualProjectOverride, setIsManualProjectOverride] = useState<boolean>(false);

  // Kalkulasi jarak ke semua proyek untuk auto-detection site terdekat / dalam radius
  const projectDistanceList = useMemo<{
    project: Project;
    distance: number;
    inGeofence: boolean;
    geo: { lat: number; lng: number; radius: number } | null;
  }[]>(() => {
    if (!coords.lat || !coords.lng) return [];
    return projects.map(p => {
      const pGeo = getProjectCoordinates(p);
      if (!pGeo) return { project: p, distance: 99999999, inGeofence: false, geo: null };
      const dist = calculateDistanceMeters(coords.lat, coords.lng, pGeo.lat, pGeo.lng);
      return {
        project: p,
        distance: dist,
        inGeofence: dist <= pGeo.radius,
        geo: pGeo
      };
    }).sort((a, b) => a.distance - b.distance);
  }, [projects, coords.lat, coords.lng]);

  // Proyek yang terdeteksi otomatis berada di dalam radius GPS perangkat saat ini
  const autoDetectedMatch = useMemo(() => {
    return projectDistanceList.find(item => item.inGeofence) || null;
  }, [projectDistanceList]);

  // Otomatis sinkronisasi selectedProjectId saat terdeteksi berada di lokasi site proyek tertentu
  useEffect(() => {
    if (autoDetectedMatch && !isManualProjectOverride) {
      setSelectedProjectId(autoDetectedMatch.project.id);
    }
  }, [autoDetectedMatch, isManualProjectOverride]);

  // Proyek aktif yang sedang dituju untuk presensi saat ini
  const activeProject = useMemo(() => {
    if (selectedProjectId === 'OFFICE') return null;
    return projects.find(p => p.id === selectedProjectId) || assignedProject || null;
  }, [selectedProjectId, projects, assignedProject]);

  const activeProjectDist = useMemo(() => {
    if (!activeProject || !coords.lat || !coords.lng) return null;
    const pGeo = getProjectCoordinates(activeProject);
    if (!pGeo) return null;
    return calculateDistanceMeters(coords.lat, coords.lng, pGeo.lat, pGeo.lng);
  }, [activeProject, coords.lat, coords.lng]);

  const activeProjectRadius = useMemo(() => {
    if (!activeProject) return salaryRules?.officeGeofence?.radiusMeters || 350;
    const pGeo = getProjectCoordinates(activeProject);
    return pGeo?.radius || 350;
  }, [activeProject, salaryRules?.officeGeofence?.radiusMeters]);

  // Evaluasi Geofence Kantor & Proyek
  const isInOfficeGeofence = realGeofenceDistance <= (salaryRules?.officeGeofence?.radiusMeters || 350);
  const isInSelectedProjectGeofence = activeProjectDist !== null && activeProjectDist <= activeProjectRadius;
  const isInProjectGeofence = isInSelectedProjectGeofence;
  const isPhysicallyInGeofence = isInOfficeGeofence || isInSelectedProjectGeofence || Boolean(autoDetectedMatch);

  // Status Geofence Menyeluruh: Jika mode WFH atau DINAS_LUAR, batasan geofence TIDAK MENGUNCI (otomatis valid)
  const isWithinAnyAuthorizedGeofence = mode === 'WFH' || mode === 'DINAS_LUAR' ? true : isPhysicallyInGeofence;
  const assignedProjectDist = activeProjectDist;
  const effectiveTargetDistance = activeProjectDist !== null ? activeProjectDist : realGeofenceDistance;

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
      const assignedName = assignedProject ? assignedProject.name : salaryRules.officeGeofence?.name || 'Kantor Pusat & Innovation Hub';
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

  // Cutoff calculation: status keterlambatan hanya berlaku untuk Absen Masuk (CHECK_IN)
  useEffect(() => {
    const checkLateStatus = () => {
      // Absen Pulang (CHECK_OUT) TIDAK PERNAH dianggap terlambat
      if (attendanceAction === 'CHECK_OUT') {
        setIsLate(false);
        setLateMinutes(0);
        return;
      }

      const now = new Date();
      const [cutoffH, cutoffM] = userSchedule.cutoffTime.split(':').map(Number);
      const cutoffDate = new Date();
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
    checkLateStatus();
    const timer = setInterval(checkLateStatus, 30000);
    return () => clearInterval(timer);
  }, [userSchedule.cutoffTime, attendanceAction]);

  // Handler toggle jenis presensi Masuk / Pulang dengan auto-clear keterlambatan
  const handleToggleAttendanceAction = (action: 'CHECK_IN' | 'CHECK_OUT') => {
    setAttendanceAction(action);
    if (action === 'CHECK_OUT') {
      setIsLate(false);
      setLateMinutes(0);
      setLateReason('');
    } else {
      const now = new Date();
      const [cutoffH, cutoffM] = userSchedule.cutoffTime.split(':').map(Number);
      const cutoffDate = new Date();
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
    if (mode === 'WFO' && !isWithinAnyAuthorizedGeofence) {
      const assignedName = activeProject ? activeProject.name : (assignedProject ? assignedProject.name : (salaryRules?.officeGeofence?.name || 'Kantor Pusat & Innovation Hub'));
      const distStr = effectiveTargetDistance >= 1000 ? `${(effectiveTargetDistance / 1000).toFixed(1)} km` : `${effectiveTargetDistance} meter`;
      setSuccessToast(`📍 Luar Radius Geofence (${distStr} dari ${assignedName}). Presensi tetap diproses, butuh approval.`);
      setTimeout(() => setSuccessToast(null), 5000);
    }
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
    if (isCameraModalOpen && !capturedPhoto) {
      startCamera();
    } else if (!isCameraModalOpen) {
      stopCamera();
    }
  }, [isCameraModalOpen, capturedPhoto]);

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

  // Ambil lokasi GPS asli langsung dari chip sensor GPS smartphone/HP user
  const fetchDeviceGps = (showToast = true) => {
    if (!navigator.geolocation) {
      setGpsError('Browser HP Anda tidak mendukung akses Geolocation GPS.');
      return;
    }

    setIsGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy) || 5;

        // Hitung jarak nyata ke titik kantor pusat
        const officeLat = salaryRules?.officeGeofence?.lat ?? -7.395625;
        const officeLng = salaryRules?.officeGeofence?.lng ?? 112.717574;
        const dist = calculateDistanceMeters(lat, lng, officeLat, officeLng);
        setRealGeofenceDistance(dist);
        setGpsSource('DEVICE_HARDWARE');

        // Ambil alamat asli lokasi GPS HP
        const resolvedAddress = await fetchAddressFromCoords(lat, lng);

        setCoords({
          lat,
          lng,
          accuracy,
          address: resolvedAddress
        });
        setIsGpsLoading(false);

        if (showToast) {
          setSuccessToast(`📍 GPS HP Terkunci! Akurasi: ±${accuracy}m (Jarak ke Kantor: ${dist}m)`);
          setTimeout(() => setSuccessToast(null), 4000);
        }
      },
      err => {
        setIsGpsLoading(false);
        let msg = 'Gagal membaca GPS HP.';
        if (err.code === 1) {
          msg = 'Izin lokasi GPS ditolak oleh HP. Mohon izinkan (Allow) akses Lokasi pada browser HP Anda.';
        } else if (err.code === 2) {
          msg = 'Sinyal GPS HP tidak tersedia. Pastikan fitur Lokasi / GPS pada HP Anda sudah diaktifkan (ON).';
        } else if (err.code === 3) {
          msg = 'Waktu pencarian GPS HP habis (Timeout). Silakan ketuk "Ambil GPS HP Ulang".';
        }
        setGpsError(msg);
        console.warn('GPS HP Error:', err);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  // Otomatis deteksi GPS HP saat halaman dibuka & pantau pergerakan (watchPosition)
  useEffect(() => {
    fetchDeviceGps(false);

    let watchId: number | null = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        pos => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          const accuracy = Math.round(pos.coords.accuracy) || 5;
          const officeLat = salaryRules?.officeGeofence?.lat ?? -7.395625;
          const officeLng = salaryRules?.officeGeofence?.lng ?? 112.717574;
          const dist = calculateDistanceMeters(lat, lng, officeLat, officeLng);
          setRealGeofenceDistance(dist);
          setGpsSource('DEVICE_HARDWARE');
          setCoords(prev => ({
            ...prev,
            lat,
            lng,
            accuracy
          }));
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
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
    // Top-Right Biometric Security Badge
    const isEnrolled = Boolean(currentUser.biometric?.isEnrolled);
    const isVerified = biometricVerification ? biometricVerification.isVerified : true;
    const matchScore = biometricVerification ? biometricVerification.matchScore : (isEnrolled ? 95 : 100);
    const badgeColor = isVerified ? '#00E2B0' : '#f87171';

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
    const bioText = isEnrolled
      ? `BIOMETRIC: ${matchScore}% MATCH`
      : 'BIOMETRIC PENDING ENROLL';
    ctx.fillText(bioText, 432, 37);

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

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`KARYAWAN : ${currentUser.nik} • ${currentUser.name.toUpperCase()}`, 16, 372);

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
    ctx.fillText(`PRIME HRIS ENTERPRISE • SECURE AUDIT STAMP #${Math.floor(100000 + Math.random() * 900000)}`, 16, 458);
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

    // Validasi & Auto-Fallback: Presensi di Luar Geofence (Tetap Diterima & Butuh Approval)
    let effectiveOutOfRangeReason = outOfRangeReason.trim();
    if (mode === 'WFO' && !isWithinAnyAuthorizedGeofence) {
      if (!effectiveOutOfRangeReason) {
        effectiveOutOfRangeReason = 'Supervisi Lapangan & Penugasan Luar Radius';
        setOutOfRangeReason(effectiveOutOfRangeReason);
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
      handleOpenBiometricCamera();
      return;
    }

    const userNote = note.trim();
    const noteParts: string[] = [];
    if (userNote) noteParts.push(userNote);
    if (mode === 'WFO' && !isWithinAnyAuthorizedGeofence && effectiveOutOfRangeReason) {
      noteParts.push(`[Luar Area ${assignedProjectDist !== null ? assignedProjectDist : realGeofenceDistance}m: ${effectiveOutOfRangeReason}]`);
    }
    const noteToUse = noteParts.length > 0 ? noteParts.join(' | ') : 'Supervisi Machining & Operasional Shift';
    const lateReasonToUse = effectiveIsLate ? effectiveLateReason : undefined;

    const now = rtcService.getServerNow();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const existingToday = attendanceHistory.find(
      a => a.employeeId === currentUser.id && a.date === dateStr && a.checkInTime
    );

    const newRecord: AttendanceRecord = {
      id: isCheckIn ? `ATT-${Date.now()}` : (existingToday?.id || `ATT-${Date.now()}`),
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      employeeNik: currentUser.nik,
      department: currentUser.department,
      date: dateStr,
      checkInTime: isCheckIn ? timeStr : (existingToday?.checkInTime || '08:00:00'),
      checkOutTime: isCheckIn ? undefined : timeStr,
      attendanceType: attendanceAction,
      mode: mode,
      status: mode === 'DINAS_LUAR'
        ? 'DINAS_LUAR_PENDING'
        : mode === 'WFH'
        ? (effectiveIsLate ? 'LATE' : 'WFH_APPROVED')
        : !isPhysicallyInGeofence
        ? 'OUT_OF_GEOFENCE'
        : effectiveIsLate
        ? 'LATE'
        : 'ON_TIME',
      photoUrl: photoToUse,
      location: {
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
        address: coords.address,
        inGeofence: mode === 'WFO' ? isPhysicallyInGeofence : true,
        distanceMeters: effectiveTargetDistance
      },
      projectId: activeProject?.id,
      projectCode: activeProject?.code,
      projectName: activeProject?.name || (selectedProjectId === 'OFFICE' ? 'Kantor Pusat & Workshop' : undefined),
      networkAudit: {
        ipAddress: activeIp,
        connectionType: isInOfficeGeofence || isInProjectGeofence ? 'Geofence Valid' : 'GPS Mobile'
      },
      note: noteToUse,
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
      approvalStatus: (mode === 'DINAS_LUAR' || effectiveIsLate || !isWithinAnyAuthorizedGeofence) ? 'PENDING' : 'NOT_REQUIRED',
      biometricVerification: biometricVerification || (currentUser.biometric?.isEnrolled ? {
        isVerified: true,
        matchScore: 95,
        matchedPose: 'front',
        livenessPassed: true,
        details: 'Biometrik terverifikasi valid saat presensi'
      } : undefined)
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
            className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95 ${
              currentUser.biometric?.isEnrolled
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
            <span>Radius: <strong className={isPhysicallyInGeofence ? 'text-emerald-600 font-bold' : 'text-slate-800'}>{effectiveTargetDistance >= 1000 ? `${(effectiveTargetDistance/1000).toFixed(1)} km` : `${effectiveTargetDistance}m`}</strong></span>
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
                      {currentUser.nik}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono-code">
                    {currentUser.name} • Shift: {userSchedule.checkInTime} - {userSchedule.checkOutTime} WIB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAttendanceModalOpen(false)}
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
                <span className={`text-[10px] font-bold font-mono-code px-2 py-0.5 rounded-full ${
                  attendanceAction === 'CHECK_IN'
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
                  className={`py-2.5 px-3 rounded-2xl border text-center transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    attendanceAction === 'CHECK_IN'
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
                  className={`py-2.5 px-3 rounded-2xl border text-center transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    attendanceAction === 'CHECK_OUT'
                      ? 'bg-gradient-to-r from-[#FF6B00] to-amber-600 text-white shadow-md shadow-orange-900/20 font-black border-orange-400'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-bold'
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${attendanceAction === 'CHECK_OUT' ? 'bg-white animate-pulse' : 'bg-[#FF6B00]'}`} />
                  <span>ABSEN PULANG (OUT)</span>
                </button>
              </div>
            </div>

            {/* 1. Mode Penugasan Kerja (WFO / DINAS LUAR / WFH) */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>1. Mode Penugasan Kerja</span>
                <span className="text-[10px] font-bold font-mono-code px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {mode === 'WFO' ? '🏢 WFO (Site Resmi)' : mode === 'DINAS_LUAR' ? '🚗 Dinas Luar (Lapangan)' : '🏠 WFH (Remote)'}
                </span>
              </label>

              {/* Segmented Buttons: Dapat diakses & dipilih langsung oleh seluruh karyawan */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'WFO', label: 'WFO', desc: 'Kantor / Site', icon: Building, color: 'emerald' },
                  { id: 'DINAS_LUAR', label: 'Dinas Luar', desc: 'Perjalanan', icon: Briefcase, color: 'amber' },
                  { id: 'WFH', label: 'WFH', desc: 'Kerja Remote', icon: Clock, color: 'blue' }
                ].map(item => {
                  const Icon = item.icon;
                  const isSelected = mode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setMode(item.id as AttendanceMode);
                        if (item.id === 'DINAS_LUAR') setActiveParameterPanel('DINAS');
                      }}
                      className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 active:scale-95 ${
                        isSelected
                          ? 'bg-gradient-to-b from-orange-50 to-orange-100/60 border-[#FF6B00] text-[#FF6B00] shadow-sm font-bold ring-2 ring-orange-500/20'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-bold leading-tight">{item.label}</span>
                      <span className="text-[9px] text-slate-400 font-mono-code">{item.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Status Info Box sesuai Mode yang dipilih */}
              {mode === 'WFH' && (
                <div className="p-2.5 rounded-xl bg-blue-50/90 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                  <p className="text-[11px] leading-relaxed">
                    <b>Mode WFH Aktif:</b> Anda bekerja dari rumah / jarak jauh. Sistem <b>tidak membatasi radius geofence</b> dan langsung memproses presensi Anda.
                  </p>
                </div>
              )}

              {mode === 'DINAS_LUAR' && (
                <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    <p className="text-[11px] leading-relaxed truncate">
                      <b>Dinas Luar Aktif:</b> Bebas geofence site. Silakan isi surat tugas / tujuan di bawah.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveParameterPanel('DINAS')}
                    className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-lg shrink-0 cursor-pointer hover:bg-amber-300"
                  >
                    Edit Surat Tugas
                  </button>
                </div>
              )}
            </div>

            {/* 1b. Pilihan Lokasi Site / Proyek Presensi */}
            <div className="space-y-2 p-3 rounded-2xl bg-slate-50/90 border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>Lokasi Site / Proyek Presensi</span>
                </label>
                {autoDetectedMatch ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 font-mono-code border border-emerald-300">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Auto-Detect Site</span>
                  </span>
                ) : isManualProjectOverride ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualProjectOverride(false);
                      const matched = projectDistanceList.find(item => item.inGeofence);
                      if (matched) setSelectedProjectId(matched.project.id);
                      else if (assignedProject) setSelectedProjectId(assignedProject.id);
                      else setSelectedProjectId('OFFICE');
                    }}
                    className="text-[10px] text-orange-600 hover:text-orange-700 font-bold underline cursor-pointer"
                  >
                    Reset ke Auto-Detect
                  </button>
                ) : null}
              </div>

              {/* Banner jika terdeteksi otomatis berada di dalam radius suatu proyek */}
              {autoDetectedMatch && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate text-[11px]">
                      GPS HP terdeteksi di site <b>{autoDetectedMatch.project.name}</b> ({autoDetectedMatch.distance}m)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full shrink-0 font-mono-code">
                    Geofence Valid
                  </span>
                </div>
              )}

              {/* Dropdown Pemilihan Proyek */}
              <div className="space-y-1">
                <select
                  value={selectedProjectId}
                  onChange={e => {
                    setSelectedProjectId(e.target.value);
                    setIsManualProjectOverride(true);
                  }}
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs font-bold text-slate-800 border border-slate-300 focus:ring-2 focus:ring-orange-500/20 bg-white"
                >
                  <option value="OFFICE">🏢 Kantor Pusat & Workshop Terpadu ({realGeofenceDistance >= 1000 ? `${(realGeofenceDistance/1000).toFixed(1)} km` : `${realGeofenceDistance}m`})</option>
                  {projects.map(p => {
                    const pGeo = getProjectCoordinates(p);
                    const d = pGeo && coords.lat && coords.lng ? calculateDistanceMeters(coords.lat, coords.lng, pGeo.lat, pGeo.lng) : null;
                    const dStr = d !== null ? (d >= 1000 ? `${(d/1000).toFixed(1)} km` : `${d}m`) : 'Regional';
                    const isAssigned = p.id === currentUser.assignedProjectId;
                    return (
                      <option key={p.id} value={p.id}>
                        📍 {p.code} - {p.name} {isAssigned ? '★ [Proyek Penugasan]' : ''} ({p.location} • {dStr})
                      </option>
                    );
                  })}
                </select>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                  <span>* Pilih proyek jika Anda sedang bertugas atau supervisi di site lain.</span>
                  {activeProjectDist !== null && (
                    <span className="font-mono-code font-bold text-slate-700">
                      Jarak: {activeProjectDist >= 1000 ? `${(activeProjectDist/1000).toFixed(1)} km` : `${activeProjectDist}m`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Parameter Control Deck (Grid of Button Icons) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>2. Parameter & Validasi</span>
                <span className="text-[10px] text-slate-400">Klik ikon untuk edit</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Button Icon: Catatan Harian */}
                <button
                  type="button"
                  onClick={() => setActiveParameterPanel(prev => prev === 'NOTE' ? null : 'NOTE')}
                  className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 active:scale-95 ${
                    activeParameterPanel === 'NOTE'
                      ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                  title="Buka Catatan Harian"
                >
                  <div className="relative">
                    <FileText className={`w-4 h-4 ${activeParameterPanel === 'NOTE' ? 'text-[#FF6B00]' : 'text-slate-600'}`} />
                    {note && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500"></span>
                    )}
                  </div>
                  <span className="text-xs font-bold leading-tight">Catatan</span>
                  <span className={`text-[9px] font-mono-code truncate max-w-[80px] ${activeParameterPanel === 'NOTE' ? 'text-slate-300' : 'text-slate-400'}`}>
                    {note ? 'Terisi' : 'Kosong'}
                  </span>
                </button>

                {/* Button Icon: Lokasi & Geofence */}
                <button
                  type="button"
                  onClick={() => setActiveParameterPanel(prev => prev === 'LOCATION' ? null : 'LOCATION')}
                  className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 active:scale-95 ${
                    activeParameterPanel === 'LOCATION'
                      ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                  title="Buka Detail Lokasi & Geofence"
                >
                  <div className="relative">
                    <MapPin className={`w-4 h-4 ${activeParameterPanel === 'LOCATION' ? 'text-[#FF6B00]' : 'text-slate-600'}`} />
                    <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                      realGeofenceDistance <= (salaryRules.officeGeofence.radiusMeters || 350) ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}></span>
                  </div>
                  <span className="text-xs font-bold leading-tight">Lokasi</span>
                  <span className={`text-[9px] font-mono-code ${activeParameterPanel === 'LOCATION' ? 'text-slate-300' : 'text-slate-400'}`}>
                    {realGeofenceDistance}m
                  </span>
                </button>

                {/* Button Icon: Kamera Biometrik (Pop-up Modal Trigger) */}
                <button
                  type="button"
                  onClick={handleOpenBiometricCamera}
                  className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 active:scale-95 ${
                    capturedPhoto
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-800 shadow-sm'
                      : isCameraModalOpen
                      ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                  title="Buka Terminal Kamera Biometrik"
                >
                  <div className="relative">
                    <Camera className={`w-4 h-4 ${capturedPhoto ? 'text-emerald-600' : isCameraModalOpen ? 'text-[#FF6B00]' : 'text-slate-600'}`} />
                    <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${capturedPhoto ? 'bg-emerald-500' : 'bg-orange-500 animate-pulse'}`}></span>
                  </div>
                  <span className="text-xs font-bold leading-tight">Kamera</span>
                  <span className={`text-[9px] font-mono-code ${capturedPhoto ? 'text-emerald-700 font-bold' : isCameraModalOpen ? 'text-slate-300' : 'text-slate-400'}`}>
                    {capturedPhoto ? 'Foto Siap' : 'Buka Pop-up'}
                  </span>
                </button>
              </div>

              {/* Compact Photo Preview & Quick Shutter / Modal Trigger Card */}
              {capturedPhoto ? (
                <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 flex items-center justify-between gap-3 shadow-2xs motion-fade-in-up">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={capturedPhoto}
                        alt="Preview Foto Presensi"
                        className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-500 shadow-sm"
                      />
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold">
                        ✓
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">Foto Biometrik Siap</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono-code">
                          Watermarked
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {biometricVerification?.isVerified ? 'Biometrik Cocok • GPS Terpatri' : 'Snapshot Siap Dikirim'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleOpenBiometricCamera}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                      title="Lihat atau Foto Ulang"
                    >
                      <RefreshCw className="w-3 h-3 text-[#FF6B00]" />
                      <span>Ulang</span>
                    </button>
                    <button
                      type="button"
                      onClick={retakePhoto}
                      className="p-1.5 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 transition-all shadow-2xs cursor-pointer"
                      title="Hapus Foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={handleOpenBiometricCamera}
                  className="p-3 rounded-2xl bg-slate-50/80 hover:bg-orange-50/50 border border-dashed border-slate-300 hover:border-[#FF6B00] transition-all cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 group-hover:border-orange-300 flex items-center justify-center text-[#FF6B00] shadow-2xs transition-colors">
                      <Camera className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-[#FF6B00] transition-colors">
                        Foto Biometrik Belum Diambil
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Klik tombol Kamera atau baris ini untuk buka kamera pop-up
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleOpenBiometricCamera(); }}
                    className="px-3 py-1.5 rounded-xl bg-[#FF6B00] text-white text-xs font-bold hover:bg-[#e56000] shadow-sm flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Buka Kamera</span>
                  </button>
                </div>
              )}

              {/* Mandatory Reason Alert Card: Luar Geofence Area */}
              {mode === 'WFO' && !isWithinAnyAuthorizedGeofence && (
                <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300 shadow-xs space-y-2 motion-fade-in-up">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                      <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Presensi di Luar Radius Area ({assignedProjectDist !== null ? assignedProjectDist : realGeofenceDistance}m)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 font-mono-code uppercase tracking-wider shrink-0">
                      Wajib Diisi
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Sistem tetap menerima presensi Anda. Harap berikan penjelasan / alasan mengapa Anda melakukan presensi di luar area resmi:
                  </p>
                  <textarea
                    rows={2}
                    required
                    value={outOfRangeReason}
                    onChange={e => setOutOfRangeReason(e.target.value)}
                    placeholder="Tulis alasan di luar radius (cth: supervisi vendor lapangan, mobilisasi alat, kendala sinyal GPS)..."
                    className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-800 placeholder-slate-400 resize-none border border-amber-300 focus:ring-2 focus:ring-amber-500/30"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Supervisi Vendor di Luar Site',
                      'Mobilisasi Perjalanan Dinas Lapangan',
                      'Tugas Mendadak Luar Workshop',
                      'Deviasi Akurasi GPS Perangkat'
                    ].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setOutOfRangeReason(preset)}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-white border border-amber-200 hover:border-amber-400 text-amber-800 font-medium transition-colors cursor-pointer"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mandatory Reason Alert Card: Terlambat */}
              {isLate && (
                <div className="p-3.5 rounded-2xl bg-rose-50/90 border border-rose-300 shadow-xs space-y-2 motion-fade-in-up">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs">
                      <Clock className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Keterlambatan Presensi ({lateMinutes} Menit)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-200 text-rose-900 font-mono-code uppercase tracking-wider shrink-0">
                      Wajib Diisi
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    Sistem tetap menerima presensi Anda. Harap berikan alasan / justifikasi keterlambatan:
                  </p>
                  <textarea
                    rows={2}
                    required
                    value={lateReason}
                    onChange={e => setLateReason(e.target.value)}
                    placeholder="Tulis alasan keterlambatan (cth: penumpukan arus lalu lintas jam sibuk, cuaca buruk)..."
                    className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-800 placeholder-slate-400 resize-none border border-rose-300 focus:ring-2 focus:ring-rose-500/30"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Penumpukan arus lalu lintas jam sibuk',
                      'Cuaca ekstrem / hujan lebat perjalanan',
                      'Kendala teknis kendaraan pribadi',
                      'Penyelesaian urusan darurat keluarga'
                    ].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setLateReason(preset)}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-white border border-rose-200 hover:border-rose-400 text-rose-800 font-medium transition-colors cursor-pointer"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Conditional Button Icons: Dinas Luar */}
              {mode === 'DINAS_LUAR' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {mode === 'DINAS_LUAR' && (
                    <button
                      type="button"
                      onClick={() => setActiveParameterPanel(prev => prev === 'DINAS' ? null : 'DINAS')}
                      className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 ${
                        activeParameterPanel === 'DINAS'
                          ? 'bg-amber-600 border-amber-600 text-white shadow-md'
                          : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                      }`}
                    >
                      <Briefcase className="w-4 h-4" />
                      <span className="text-xs font-bold">Surat Tugas Dinas</span>
                    </button>
                  )}
                  {isLate && (
                    <button
                      type="button"
                      onClick={() => setActiveParameterPanel(prev => prev === 'LATE' ? null : 'LATE')}
                      className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 ${
                        activeParameterPanel === 'LATE'
                          ? 'bg-rose-600 border-rose-600 text-white shadow-md'
                          : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4" />
                      <span className="text-xs font-bold">Alasan Telat ({lateMinutes}m)</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 3. Interactive Quick-Drawer / Parameter Panel */}
            {activeParameterPanel && (
              <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-3 animate-in fade-in duration-200">
                
                {/* Panel: Catatan Harian */}
                {activeParameterPanel === 'NOTE' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#FF6B00]" />
                        Catatan & Rencana Kerja Harian
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveParameterPanel(null)}
                        className="text-slate-400 hover:text-slate-600 text-[10px] cursor-pointer"
                      >
                        Tutup ✕
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-800 placeholder-slate-400 resize-none"
                      placeholder="Tuliskan aktivitas atau tugas hari ini..."
                      required
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Supervisi Shift Lapangan',
                        'Machining CNC & QC',
                        'Maintenance Tooling',
                        'Koordinasi Site'
                      ].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setNote(preset)}
                          className="text-[10px] px-2 py-0.5 rounded-lg bg-white border border-slate-200 hover:border-orange-300 hover:text-[#FF6B00] text-slate-600 font-medium transition-colors cursor-pointer"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Panel: Lokasi & Geofence */}
                {activeParameterPanel === 'LOCATION' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" />
                        Lokasi & Geofence Perangkat
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveParameterPanel(null)}
                        className="text-slate-400 hover:text-slate-600 text-[10px] cursor-pointer"
                      >
                        Tutup ✕
                      </button>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs space-y-1">
                      <p className="font-bold text-slate-900">{coords.address}</p>
                      <div className="flex items-center justify-between text-[11px] font-mono-code text-slate-500 pt-1 border-t border-slate-100">
                        <span>Jarak: <strong className="text-slate-800">{realGeofenceDistance}m</strong></span>
                        <span>Akurasi: ±{coords.accuracy}m</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => fetchDeviceGps(true)}
                        disabled={isGpsLoading}
                        className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-orange-300 text-[11px] font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isGpsLoading ? 'animate-spin text-[#FF6B00]' : 'text-slate-500'}`} />
                        <span>{isGpsLoading ? 'Satelit HP...' : 'Perbarui GPS HP'}</span>
                      </button>
                      {isSuperOrAdmin && (
                        <button
                          type="button"
                          onClick={() => openGeofenceModal('OFFICE')}
                          className="px-2.5 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-[#FF6B00] text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer hover:bg-orange-100 active:scale-95"
                        >
                          <MapPin className="w-3 h-3" />
                          <span>Set Titik Geofence</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}


                {/* Panel: Dinas Luar */}
                {activeParameterPanel === 'DINAS' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                        Formulir Tugas Dinas Luar Mendadak
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveParameterPanel(null)}
                        className="text-slate-400 hover:text-slate-600 text-[10px] cursor-pointer"
                      >
                        Tutup ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={clientName}
                        onChange={e => setClientName(e.target.value)}
                        className="glass-input rounded-xl px-2.5 py-1.5 text-xs text-slate-800"
                        placeholder="Nama Klien / Perusahaan"
                        required
                      />
                      <input
                        type="text"
                        value={projectCode}
                        onChange={e => setProjectCode(e.target.value)}
                        className="glass-input rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-mono-code"
                        placeholder="Kode Proyek"
                        required
                      />
                    </div>
                    <input
                      type="text"
                      value={destination}
                      onChange={e => setDestination(e.target.value)}
                      className="w-full glass-input rounded-xl px-2.5 py-1.5 text-xs text-slate-800"
                      placeholder="Alamat / Site Tujuan"
                      required
                    />
                    <textarea
                      rows={2}
                      value={dinasPurpose}
                      onChange={e => setDinasPurpose(e.target.value)}
                      className="w-full glass-input rounded-xl px-2.5 py-1.5 text-xs text-slate-800 resize-none"
                      placeholder="Urgensi dinas mendadak..."
                      required
                    />
                  </div>
                )}

                {/* Panel: Keterlambatan */}
                {activeParameterPanel === 'LATE' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                        Alasan Keterlambatan ({lateMinutes} Menit)
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveParameterPanel(null)}
                        className="text-slate-400 hover:text-slate-600 text-[10px] cursor-pointer"
                      >
                        Tutup ✕
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={lateReason}
                      onChange={e => setLateReason(e.target.value)}
                      className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-800 border-rose-300 focus:border-rose-500 resize-none"
                      placeholder="Sebutkan kendala lalu lintas / cuaca..."
                      required
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Kepadatan arus lalu lintas jalan raya',
                        'Kendala cuaca hujan deras lapangan',
                        'Koordinasi teknis penanganan darurat'
                      ].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setLateReason(preset)}
                          className="text-[10px] px-2 py-0.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-100 text-rose-800 font-medium transition-colors cursor-pointer"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* Live GPS Coordinates Status Banner */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-4 h-4 text-[#FF6B00] shrink-0" />
                <div className="truncate">
                  <span className="font-bold text-slate-800">
                    {mode === 'WFO' ? (assignedProject ? `Site ${assignedProject.name}` : 'Kantor Pusat') : mode === 'DINAS_LUAR' ? 'Lokasi Penugasan Dinas' : 'WFH Remote'}
                  </span>
                  <span className="text-slate-400 font-mono-code text-[11px] ml-1.5">
                    ({coords.lat ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'Mendeteksi GPS...'})
                  </span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 font-mono-code ${
                isInOfficeGeofence || isInProjectGeofence
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}>
                {assignedProjectDist !== null && isInProjectGeofence ? `${assignedProjectDist}m` : `${realGeofenceDistance}m`}
              </span>
            </div>

            {/* 4. Submit Action Button */}
            <div className="space-y-2 pt-1">
              {mode === 'WFO' && !isPhysicallyInGeofence && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-[11px] leading-relaxed">
                      Luar radius ({effectiveTargetDistance >= 1000 ? `${(effectiveTargetDistance/1000).toFixed(1)} km` : `${effectiveTargetDistance}m`}). Presensi otomatis diteruskan dengan status <b>Menunggu Approval</b>.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode('WFH')}
                    className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-lg shrink-0 hover:bg-amber-300 transition-colors cursor-pointer"
                  >
                    Pilih WFH
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer bg-gradient-to-r from-[#FF6B00] via-[#FF8533] to-[#FF6B00] text-white hover:shadow-lg hover:shadow-orange-500/25 active:scale-98"
              >
                <Send className="w-4 h-4" />
                <span>
                  {mode === 'WFH'
                    ? (capturedPhoto 
                        ? (attendanceAction === 'CHECK_IN' ? 'Kirim Absen Masuk WFH Sekarang' : 'Kirim Absen Pulang WFH Sekarang')
                        : (attendanceAction === 'CHECK_IN' ? 'Ambil Foto & Absen Masuk WFH' : 'Ambil Foto & Absen Pulang WFH'))
                    : mode === 'DINAS_LUAR'
                    ? (capturedPhoto 
                        ? (attendanceAction === 'CHECK_IN' ? 'Kirim Absen Masuk Dinas Luar' : 'Kirim Absen Pulang Dinas Luar')
                        : (attendanceAction === 'CHECK_IN' ? 'Ambil Foto & Absen Masuk Dinas' : 'Ambil Foto & Absen Pulang Dinas'))
                    : (capturedPhoto 
                        ? (attendanceAction === 'CHECK_IN' ? 'Kirim Absen Masuk Sekarang' : 'Kirim Absen Pulang Sekarang')
                        : (attendanceAction === 'CHECK_IN' ? 'Ambil Foto & Absen Masuk' : 'Ambil Foto & Absen Pulang'))}
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#FF6B00]" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono-code">
              {isSuperOrAdmin ? 'Riwayat Log Presensi Terkini' : 'Riwayat Log Presensi Saya'}
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium font-mono-code">
            {isDbLoading && visibleAttendanceHistory.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 text-slate-400 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Sinkronisasi data presensi...
              </span>
            ) : (
              `Total: ${visibleAttendanceHistory.length} Rekaman ${isSuperOrAdmin ? '(Semua Karyawan)' : '(Data Mandiri)'}`
            )}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 text-slate-500 uppercase tracking-wider text-[10px] font-mono-code">
                <th className="py-2.5 px-3">Karyawan</th>
                <th className="py-2.5 px-3">Waktu & Tanggal</th>
                <th className="py-2.5 px-3">Mode</th>
                <th className="py-2.5 px-3">Lokasi & Geofence</th>
                <th className="py-2.5 px-3">Catatan / Keterangan</th>
                <th className="py-2.5 px-3">Status Verifikasi</th>
                <th className="py-2.5 px-3 text-right">Foto Snapshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleAttendanceHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
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
                visibleAttendanceHistory.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{item.employeeName}</div>
                      <div className="text-[10px] text-slate-500 font-mono-code">{item.employeeNik} • {item.department}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-0.5 font-mono-code">
                        <div className="font-bold text-slate-800 text-[11px]">
                          Masuk: {item.checkInTime} WIB
                        </div>
                        {item.checkOutTime ? (
                          <div className="font-bold text-emerald-600 text-[11px]">
                            Pulang: {item.checkOutTime} WIB
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic">
                            Belum Pulang
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400">{item.date}</div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.mode === 'DINAS_LUAR'
                          ? 'bg-amber-100 text-amber-800'
                          : item.mode === 'WFH'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.mode.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 text-[11px] truncate max-w-[200px] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#FF6B00] shrink-0" />
                        <span>{item.location.distanceMeters !== undefined ? `${item.location.distanceMeters}m dari Geofence` : 'Geofence Valid'}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[200px]">
                        {item.location.address || 'Satelit GPS Terverifikasi'}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <p className="text-slate-700 max-w-xs line-clamp-1">{item.note}</p>
                      {item.isLate && (
                        <span className="text-[10px] text-rose-600 font-semibold block">
                          Terlambat {item.lateMinutes}m ({item.lateReason})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {item.approvalStatus === 'PENDING' ? (
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
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedHistoryItem(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] cursor-pointer transition-colors"
                          title="Lihat Foto & Watermark Presensi"
                        >
                          <Eye className="w-3 h-3 text-[#FF6B00]" />
                          <span>Lihat Foto</span>
                        </button>
                        {currentRole === 'superuser' && onDeleteAttendance && (
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
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-semibold text-[10px] cursor-pointer transition-colors"
                            title="Hapus Rekaman Presensi (Khusus Superuser)"
                          >
                            <Trash2 className="w-3 h-3 text-rose-600" />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
                <h3 className="font-bold text-slate-900 text-sm">Bukti Foto & Watermark Presensi</h3>
                <p className="text-[10px] text-slate-500 font-mono-code">{selectedHistoryItem.id}</p>
              </div>
              <button
                onClick={() => setSelectedHistoryItem(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <img src={selectedHistoryItem.photoUrl} alt="Bukti Foto" className="w-full rounded-2xl border border-slate-200 object-cover shadow-sm" />
              <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <p><span className="font-bold text-slate-700">Karyawan:</span> {selectedHistoryItem.employeeName} ({selectedHistoryItem.employeeNik})</p>
                <p><span className="font-bold text-slate-700">Catatan:</span> {selectedHistoryItem.note}</p>
                <p><span className="font-bold text-slate-700">Geofence:</span> <span className="font-mono-code font-semibold">{selectedHistoryItem.location.distanceMeters}m</span> • {selectedHistoryItem.location.inGeofence ? 'Dalam Area Geofence Resmi' : 'Luar Radius'}</p>
                <p><span className="font-bold text-slate-700">Lokasi:</span> {selectedHistoryItem.location.address}</p>
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
                Presensi Berhasil Diterima & Disimpan!
              </h2>
              <p className="text-xs text-slate-600">
                Data kehadiran dan foto selfie resmi telah dicatat ke dalam database PRIME HRIS Enterprise.
              </p>
            </div>

            {/* Photo Preview with Watermark */}
            <div className="relative aspect-4/3 rounded-2xl overflow-hidden border border-slate-200 shadow-md">
              <img
                src={submittedRecord.photoUrl}
                alt="Selfie Presensi Terverifikasi"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2.5 right-2.5 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                <Check className="w-3 h-3" />
                <span>Valid Audit Watermark</span>
              </div>
            </div>

            {/* Attendance Details Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                <span className="text-slate-500">Nama Karyawan:</span>
                <span className="font-bold text-slate-900">{submittedRecord.employeeName} ({submittedRecord.employeeNik})</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                <span className="text-slate-500">Waktu Presensi:</span>
                <span className="font-mono-code font-bold text-slate-900">{submittedRecord.checkInTime} WIB</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                <span className="text-slate-500">Status Kehadiran:</span>
                <span className={`font-bold px-2 py-0.2 rounded-md font-mono-code text-[11px] ${
                  submittedRecord.status === 'ON_TIME'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {submittedRecord.status === 'ON_TIME'
                    ? 'TEPAT WAKTU (ON TIME)'
                    : `TERLAMBAT (${submittedRecord.lateMinutes}m - PENGAJUAN DIAJUKAN KE HR)`}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500">Radius & Geofence:</span>
                <span className="text-slate-700 font-mono-code text-[11px] truncate max-w-[240px]">
                  {submittedRecord.location.distanceMeters}m ({submittedRecord.location.inGeofence ? 'Dalam Area Resmi' : 'Toleransi Geotag'})
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
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    geofenceTargetType === 'OFFICE'
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
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                      geofenceTargetType === 'PROJECT'
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
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                geofenceModalMsg.type === 'success'
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
                    placeholder="-7.395625"
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono-code text-slate-800"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Contoh: -7.395625</span>
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
                    placeholder="112.717574"
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono-code text-slate-800"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Contoh: 112.717574</span>
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
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                        tempOfficeRadius === chip.radius
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
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      modalDistance <= tempOfficeRadius
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

      {/* 5. Biometric Camera Pop-up Modal Terminal */}
      {isCameraModalOpen && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto motion-fade-in-up">
            
            {/* Modal Header */}
            <div className="p-4 sm:px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-[#FF6B00]">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      Terminal Kamera Biometrik & AI Liveness
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono-code font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      LIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono-code">
                    {currentUser.name} • NIK: {currentUser.nik}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCameraModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Tutup Modal Kamera"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Viewfinder Video / Photo Display */}
            <div className="relative aspect-4/3 w-full bg-slate-950 overflow-hidden flex items-center justify-center">
              {capturedPhoto ? (
                <div className="relative w-full h-full">
                  <img
                    src={capturedPhoto}
                    alt="Hasil Foto Snapshot"
                    className="w-full h-full object-contain bg-slate-950"
                  />
                  {/* Status Overlay */}
                  <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-bold backdrop-blur-md flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Foto Berhasil Diambil & Ter-watermark</span>
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
                        <div className="w-52 h-64 sm:w-60 sm:h-72 border-2 border-dashed border-[#FF6B00]/70 rounded-[40px] shadow-[0_0_20px_rgba(255,107,0,0.2)] relative flex items-center justify-center">
                          {/* Corner Reticle Accents */}
                          <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-[#FF6B00] rounded-tl-xl"></div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-[#FF6B00] rounded-tr-xl"></div>
                          <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-[#FF6B00] rounded-bl-xl"></div>
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-[#FF6B00] rounded-br-xl"></div>
                          <span className="text-[10px] font-mono-code text-white/70 bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-xs absolute -bottom-7">
                            Posisikan wajah di dalam bingkai
                          </span>
                        </div>
                      </div>

                      {/* Live Overlay Badges */}
                      <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none">
                        <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono-code text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>GPS: {coords.lat ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : 'Scanning...'}</span>
                        </div>
                        <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono-code text-slate-300">
                          Jarak: {realGeofenceDistance}m ({isInOfficeGeofence ? 'Valid WFO' : 'Luar Radius'})
                        </div>
                      </div>

                      <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={toggleCameraFlip}
                          className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/10 transition-all cursor-pointer shadow-md"
                          title="Putar Kamera Depan/Belakang"
                        >
                          <FlipHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Modal Controls & Action Footer */}
            <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />

              {capturedPhoto ? (
                <>
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <RefreshCw className="w-4 h-4 text-[#FF6B00]" />
                    <span>Ambil Foto Ulang</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                    setIsCameraModalOpen(false);
                    setIsAttendanceModalOpen(true);
                  }}
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95 ml-auto"
                  >
                    <Check className="w-4 h-4" />
                    <span>Gunakan Foto Ini & Selesai</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Upload foto dari galeri atau kamera bawaan HP"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="hidden sm:inline">Upload File</span>
                  </button>

                  {/* Main Shutter Trigger */}
                  <div className="flex-1 flex justify-center">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="group relative flex items-center justify-center p-1 cursor-pointer active:scale-95"
                      title="Ambil Foto Sekarang"
                    >
                      <div className="w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center group-hover:border-[#FF6B00] transition-colors">
                        <div className="w-12 h-12 rounded-full bg-[#FF6B00] group-hover:bg-[#ff7d1a] shadow-lg shadow-orange-500/30 flex items-center justify-center text-white transition-all">
                          <Camera className="w-6 h-6" />
                        </div>
                      </div>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCameraModalOpen(false)}
                    className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                  >
                    Tutup
                  </button>
                </>
              )}
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
