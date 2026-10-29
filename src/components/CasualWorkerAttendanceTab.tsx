import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Camera,
  Users,
  CheckCircle2,
  MapPin,
  Clock,
  Calendar,
  Search,
  Plus,
  RefreshCw,
  Download,
  AlertCircle,
  X,
  ChevronDown,
  UserCheck,
  ShieldCheck,
  Eye,
  Trash2,
  Sparkles,
  RotateCcw,
  FlipHorizontal,
  Building2,
  FileSpreadsheet
} from 'lucide-react';
import { Employee, Project, getEffectiveSystemRole, isProjectManager, CasualWorker, CasualWorkerAttendance } from '../types';
import { api } from '../services/api';
import { rtcService } from '../services/rtcService';

interface CasualWorkerAttendanceTabProps {
  currentUser: Employee;
  projects: Project[];
}

export const CasualWorkerAttendanceTab: React.FC<CasualWorkerAttendanceTabProps> = ({
  currentUser,
  projects
}) => {
  const currentRole = getEffectiveSystemRole(currentUser);
  const isPm = isProjectManager(currentUser) || currentRole === 'staff';
  const isPrivileged = currentRole === 'admin' || currentRole === 'hr' || currentRole === 'superuser';

  // Identify PM's assigned project
  const pmProjectId = useMemo(() => {
    return (currentUser.assignedProjectId || '').trim();
  }, [currentUser]);

  const assignedProject = useMemo(() => {
    if (!pmProjectId) return projects[0] || null;
    return projects.find(p => p.id === pmProjectId || p.code === pmProjectId) || projects[0] || null;
  }, [pmProjectId, projects]);

  // Selected project for viewing / recording:
  // Strictly locked for PM! For privileged users (HR/Superuser), allows selecting any project.
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    if (isPm && assignedProject) {
      return assignedProject.id;
    }
    return assignedProject ? assignedProject.id : (projects[0]?.id || '');
  });

  const activeProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || assignedProject;
  }, [projects, selectedProjectId, assignedProject]);

  // Navigation tab within this component
  const [activeSubTab, setActiveSubTab] = useState<'record' | 'roster' | 'history'>('record');

  // Master Data & Attendance State
  const [workers, setWorkers] = useState<CasualWorker[]>([]);
  const [attendances, setAttendances] = useState<CasualWorkerAttendance[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Form & Camera States
  const [workerNameInput, setWorkerNameInput] = useState<string>('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState<string>('');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);

  // GPS Location State
  const [gpsLocation, setGpsLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    address: string;
  } | null>(null);
  const [isGpsLoading, setIsGpsLoading] = useState<boolean>(false);

  // History & Filter States
  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  }, []);
  const [historyDate, setHistoryDate] = useState<string>(todayStr);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [previewPhotoModal, setPreviewPhotoModal] = useState<{ url: string; name: string; time: string } | null>(null);

  // Video refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load Data from Server
  const loadData = async (projId: string) => {
    try {
      setIsLoading(true);
      const targetProj = isPm ? (assignedProject?.id || projId) : projId;
      const [workersRes, attRes] = await Promise.all([
        api.getCasualWorkers(targetProj),
        api.getCasualAttendances({ projectId: targetProj, date: historyDate })
      ]);
      if (workersRes && workersRes.success) {
        setWorkers(workersRes.workers || []);
      }
      if (attRes && attRes.success) {
        setAttendances(attRes.attendances || []);
      }
    } catch (err) {
      console.error('[CASUAL WORKER] Failed to load data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(selectedProjectId);
  }, [selectedProjectId, historyDate]);

  // Real-Time Multi-Device Live Sync for Casual Worker & Attendance
  useEffect(() => {
    const unsubRecorded = rtcService.subscribe('CASUAL_ATTENDANCE_RECORDED', (packet) => {
      const rec = packet.payload;
      if (!rec) return;
      const curProj = isPm ? (assignedProject?.id || selectedProjectId) : selectedProjectId;
      if (!curProj || rec.projectId === curProj) {
        setAttendances(prev => {
          const idx = prev.findIndex(a => a.id === rec.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = rec;
            return next;
          }
          return [rec, ...prev];
        });
      }
    });

    const unsubDeleted = rtcService.subscribe('CASUAL_ATTENDANCE_DELETED', (packet) => {
      const { id } = packet.payload || {};
      if (id) {
        setAttendances(prev => prev.filter(a => a.id !== id));
      }
    });

    const unsubWorker = rtcService.subscribe('CASUAL_WORKER_SAVED', (packet) => {
      const worker = packet.payload;
      if (!worker) return;
      const curProj = isPm ? (assignedProject?.id || selectedProjectId) : selectedProjectId;
      if (!curProj || worker.projectId === curProj) {
        setWorkers(prev => {
          const idx = prev.findIndex(w => w.id === worker.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = worker;
            return next;
          }
          return [...prev, worker];
        });
      }
    });

    return () => {
      unsubRecorded();
      unsubDeleted();
      unsubWorker();
    };
  }, [selectedProjectId, assignedProject?.id, isPm]);

  // Request GPS Location
  const requestGps = () => {
    if (!navigator.geolocation) return;
    setIsGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy) || 10;
        let addr = `Lat: ${lat}, Lng: ${lng} (Akurasi ~${accuracy}m)`;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: { 'Accept-Language': 'id' }
          });
          const geoData = await res.json();
          if (geoData && geoData.display_name) {
            addr = geoData.display_name;
          }
        } catch (e) {
          if (activeProject?.location) {
            addr = `${activeProject.location} (${lat}, ${lng})`;
          }
        }
        setGpsLocation({ lat, lng, accuracy, address: addr });
        setIsGpsLoading(false);
      },
      (err) => {
        console.warn('GPS failed:', err);
        if (activeProject?.location) {
          setGpsLocation({ lat: -7.2575, lng: 112.7521, accuracy: 25, address: activeProject.location });
        }
        setIsGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    requestGps();
  }, [activeProject]);

  // Start Camera Stream
  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    setCameraError(null);
    stopCamera();
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode,
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
        throw new Error('Kamera tidak didukung oleh browser');
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Izin kamera ditolak. Harap izinkan akses kamera di browser Anda.'
          : 'Kamera tidak dapat diakses atau sedang digunakan aplikasi lain.'
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

  // Switch Camera Front / Back
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (cameraActive) {
      startCamera(nextMode);
    }
  };

  // Capture Photo
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    setCapturedPhoto(dataUrl);
    stopCamera();
  };

  // Reset Photo & Restart Camera
  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera(facingMode);
  };

  // Submit Casual Attendance
  const handleSubmitAttendance = async () => {
    const name = workerNameInput.trim();
    if (!name) {
      alert('Silakan masukkan nama tukang terlebih dahulu.');
      return;
    }
    if (!capturedPhoto) {
      alert('Harap ambil foto wajah tukang di lapangan untuk bukti verifikasi.');
      return;
    }
    if (!activeProject) {
      alert('Proyek belum terdeteksi. Silakan muat ulang halaman.');
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Save or ensure worker exists in project roster
      let workerId = selectedWorkerId;
      if (!workerId) {
        const existing = workers.find(w => w.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          workerId = existing.id;
        } else {
          const newWorkerRes = await api.saveCasualWorker({
            projectId: activeProject.id,
            name,
            status: 'active',
            createdBy: currentUser.id,
            createdByName: currentUser.name
          });
          if (newWorkerRes && newWorkerRes.worker) {
            const savedW: CasualWorker = newWorkerRes.worker;
            workerId = savedW.id;
            setWorkers(prev => [savedW, ...prev]);
          }
        }
      }

      // 2. Submit attendance record
      const now = new Date();
      const wibTime = now.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/\./g, ':');

      const attPayload: Partial<CasualWorkerAttendance> = {
        workerId: workerId || `CW-${Date.now()}`,
        workerName: name,
        projectId: activeProject.id,
        date: todayStr,
        checkInTime: wibTime,
        photoUrl: capturedPhoto,
        latitude: gpsLocation?.lat,
        longitude: gpsLocation?.lng,
        address: gpsLocation?.address || activeProject.location,
        notes: notesInput.trim() || undefined,
        verifiedByPmId: currentUser.id,
        verifiedByPmName: currentUser.name
      };

      const res = await api.saveCasualAttendance(attPayload);
      if (res && res.success) {
        setSubmitSuccessMsg(`Presensi tukang "${name}" berhasil dicatat pada ${wibTime} WIB!`);
        setTimeout(() => setSubmitSuccessMsg(null), 5000);

        // Reset form
        setWorkerNameInput('');
        setSelectedWorkerId(null);
        setNotesInput('');
        setCapturedPhoto(null);

        // Refresh attendance list
        await loadData(activeProject.id);
      } else {
        throw new Error((res as any)?.error || 'Gagal menyimpan presensi');
      }
    } catch (err: any) {
      alert(`Terjadi kesalahan: ${err.message || 'Gagal menyimpan presensi'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Check-In from Roster
  const handleQuickAbsenFromRoster = (worker: CasualWorker) => {
    setWorkerNameInput(worker.name);
    setSelectedWorkerId(worker.id);
    setActiveSubTab('record');
    setCapturedPhoto(null);
    setTimeout(() => {
      startCamera('environment');
    }, 150);
  };

  // Today's attendances for the active project
  const todayAttendances = useMemo(() => {
    return attendances.filter(a => a.date === todayStr);
  }, [attendances, todayStr]);

  // Map of workerId -> attendance for today
  const todayAttendanceMap = useMemo(() => {
    const map = new Map<string, CasualWorkerAttendance>();
    for (const a of todayAttendances) {
      map.set(a.workerId, a);
      map.set(a.workerName.toLowerCase(), a);
    }
    return map;
  }, [todayAttendances]);

  // Filtered workers in Roster
  const filteredWorkers = useMemo(() => {
    let list = [...workers];
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      list = list.filter(w => w.name.toLowerCase().includes(q));
    }
    return list;
  }, [workers, searchFilter]);

  // Filtered attendances in History
  const filteredHistory = useMemo(() => {
    let list = [...attendances];
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      list = list.filter(a =>
        a.workerName.toLowerCase().includes(q) ||
        (a.projectName && a.projectName.toLowerCase().includes(q)) ||
        (a.verifiedByPmName && a.verifiedByPmName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [attendances, searchFilter]);

  // Auto-complete suggestion for name input
  const nameSuggestions = useMemo(() => {
    if (!workerNameInput || selectedWorkerId) return [];
    const q = workerNameInput.toLowerCase();
    return workers.filter(w => w.name.toLowerCase().includes(q) && w.name.toLowerCase() !== q).slice(0, 5);
  }, [workers, workerNameInput, selectedWorkerId]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Export CSV
  const exportCsv = () => {
    const rows = [
      ['No', 'Nama Tukang', 'Proyek', 'Tanggal', 'Jam Masuk (WIB)', 'Lokasi / Alamat', 'Verifikator (PM)', 'Catatan']
    ];
    filteredHistory.forEach((a, idx) => {
      rows.push([
        String(idx + 1),
        `"${a.workerName.replace(/"/g, '""')}"`,
        `"${(a.projectName || activeProject?.name || '').replace(/"/g, '""')}"`,
        a.date,
        a.checkInTime,
        `"${(a.address || '').replace(/"/g, '""')}"`,
        `"${(a.verifiedByPmName || '').replace(/"/g, '""')}"`,
        `"${(a.notes || '').replace(/"/g, '""')}"`
      ]);
    });
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Presensi_Tukang_${activeProject?.code || 'SITE'}_${historyDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      {/* =========================================================================
          1. HEADER & STRICT PM SCOPE BADGE
         ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-slate-700/60 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 text-[#FF8533] border border-orange-500/40 text-[10.5px] font-black uppercase tracking-wider font-mono-code flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                Presensi Tukang Lapangan
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10.5px] font-bold font-mono-code flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Live Cloud Sync
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Presensi Harian Pekerja / Tukang Lepas
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Pencatatan presensi foto pagi & verifikasi mandiri oleh Project Manager untuk tukang borongan/harian yang tidak terdaftar di aplikasi.
            </p>
          </div>

          {/* Project Badge / Project Selector */}
          <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl p-4 border border-slate-700/80 min-w-[280px]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider font-mono-code flex items-center gap-1">
                <Building2 className="w-3 h-3 text-orange-400" />
                {isPm ? 'Proyek Terisolasi Anda' : 'Pilih Proyek (HR/Direksi)'}
              </span>
              {isPm && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30 font-mono-code">
                  LOCKED TO PM
                </span>
              )}
            </div>

            {isPm ? (
              <div>
                <p className="text-sm font-black text-white leading-snug">
                  {activeProject?.name || 'Proyek Site Lapangan'}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-300 font-mono-code">
                  <span className="text-orange-400 font-bold">{activeProject?.code || 'SITE'}</span>
                  <span>â€¢</span>
                  <span className="truncate max-w-[180px]">{activeProject?.location || 'Lokasi Site'}</span>
                </div>
              </div>
            ) : (
              <div className="relative mt-1">
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-orange-500 cursor-pointer appearance-none pr-8"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats Pill Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-700/60 text-xs">
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <span className="text-slate-400 text-[10.5px] block font-mono-code">TUKANG HADIR HARI INI</span>
            <span className="text-lg font-black text-emerald-400 font-mono-code mt-0.5 block">
              {todayAttendances.length} <span className="text-xs text-slate-400 font-normal">Orang</span>
            </span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <span className="text-slate-400 text-[10.5px] block font-mono-code">TOTAL ROSTER PROYEK</span>
            <span className="text-lg font-black text-orange-400 font-mono-code mt-0.5 block">
              {workers.length} <span className="text-xs text-slate-400 font-normal">Tukang</span>
            </span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <span className="text-slate-400 text-[10.5px] block font-mono-code">VERIFIKATOR PM</span>
            <span className="text-xs font-bold text-slate-200 mt-1 block truncate">
              {currentUser.name}
            </span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <span className="text-slate-400 text-[10.5px] block font-mono-code">AKURASI GEOLOKASI</span>
            <span className="text-xs font-bold text-slate-200 mt-1 block truncate flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              {isGpsLoading ? 'Mengunci GPS...' : (gpsLocation?.address ? 'GPS Terkunci' : 'Standar Proyek')}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. NAVIGATION PILLS
         ========================================================================= */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('record')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'record'
                ? 'bg-gradient-to-r from-[#FF6B00] to-[#FF8533] text-white shadow-md shadow-orange-500/20'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Presensi Wajah Cepat</span>
          </button>

          <button
            onClick={() => setActiveSubTab('roster')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'roster'
                ? 'bg-gradient-to-r from-[#FF6B00] to-[#FF8533] text-white shadow-md shadow-orange-500/20'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Daftar Tukang Proyek ({workers.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-gradient-to-r from-[#FF6B00] to-[#FF8533] text-white shadow-md shadow-orange-500/20'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Rekap & Riwayat Foto</span>
          </button>
        </div>

        <button
          onClick={() => {
            setIsRefreshing(true);
            loadData(selectedProjectId);
          }}
          disabled={isRefreshing}
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all cursor-pointer shadow-2xs"
          title="Segarkan Data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-orange-500' : ''}`} />
        </button>
      </div>

      {/* SUCCESS BANNER NOTIFICATION */}
      {submitSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl p-4 flex items-center justify-between shadow-xs animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase font-mono-code text-emerald-800">
                Presensi Berhasil Dicatat
              </h4>
              <p className="text-xs text-emerald-700 mt-0.5">{submitSuccessMsg}</p>
            </div>
          </div>
          <button onClick={() => setSubmitSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =========================================================================
          TAB 1: RECORD NEW ATTENDANCE (CAMERA & FORM)
         ========================================================================= */}
      {activeSubTab === 'record' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Form: Worker Name & Camera */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                Ambil Foto & Catat Kehadiran Pagi
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Masukkan nama tukang, bidik wajah di depan kamera proyek, dan tekan Simpan.
              </p>
            </div>

            {/* Input Nama Tukang */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nama Tukang / Pekerja Lapangan <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ketik nama tukang (misal: Pak Joko, Supri, Bambang)..."
                  value={workerNameInput}
                  onChange={(e) => {
                    setWorkerNameInput(e.target.value);
                    setSelectedWorkerId(null);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-orange-500 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all shadow-inner"
                />
                {workerNameInput && (
                  <button
                    onClick={() => {
                      setWorkerNameInput('');
                      setSelectedWorkerId(null);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Autocomplete suggestions */}
              {nameSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 overflow-hidden">
                  <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase font-mono-code">
                    Saran Tukang yang Pernah Tercatat di Proyek Ini:
                  </div>
                  {nameSuggestions.map(w => (
                    <button
                      key={w.id}
                      onClick={() => {
                        setWorkerNameInput(w.name);
                        setSelectedWorkerId(w.id);
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-950 flex items-center justify-between border-b border-slate-50 last:border-none transition-colors"
                    >
                      <span>{w.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono-code">Klik untuk pilih</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Camera Viewport / Photo Snapshot */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-orange-500" />
                  Foto Wajah Tukang (Bukti Lapangan) <span className="text-rose-500">*</span>
                </label>

                {cameraActive && (
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="text-xs text-slate-600 hover:text-orange-600 font-bold flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-orange-50 transition-colors"
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" />
                    Putar Kamera ({facingMode === 'environment' ? 'Kamera Belakang' : 'Kamera Depan'})
                  </button>
                )}
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-slate-900 border-2 border-dashed border-slate-300 aspect-video flex flex-col items-center justify-center">
                {/* 1. Captured Photo Preview */}
                {capturedPhoto ? (
                  <div className="relative w-full h-full">
                    <img
                      src={capturedPhoto}
                      alt="Foto Tukang Terverifikasi"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-emerald-400 px-3 py-1 rounded-full text-[11px] font-bold font-mono-code flex items-center gap-1.5 border border-emerald-500/40">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Foto Terambil
                    </div>
                    <button
                      onClick={retakePhoto}
                      className="absolute bottom-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-bold font-mono-code flex items-center gap-1.5 border border-white/20 shadow-lg cursor-pointer transition-transform active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Foto Ulang
                    </button>
                  </div>
                ) : cameraActive ? (
                  /* 2. Live Camera Stream */
                  <div className="relative w-full h-full flex items-center justify-center">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                    />
                    {/* Viewfinder Target Overlay */}
                    <div className="absolute inset-8 border-2 border-orange-400/80 rounded-2xl pointer-events-none flex items-center justify-center">
                      <div className="w-24 h-24 border border-white/40 rounded-full animate-pulse" />
                      <span className="absolute bottom-2 text-[10px] text-white/90 bg-black/60 px-2 py-0.5 rounded font-mono-code">
                        Posisikan Wajah Tukang di Dalam Area
                      </span>
                    </div>

                    {/* Snap Shutter Button */}
                    <button
                      onClick={capturePhoto}
                      className="absolute bottom-4 px-6 py-2.5 rounded-full bg-gradient-to-r from-[#FF6B00] to-amber-500 text-white font-black text-xs shadow-xl shadow-orange-500/50 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer border-2 border-white"
                    >
                      <Camera className="w-4 h-4" />
                      Ambil Foto Wajah
                    </button>
                  </div>
                ) : (
                  /* 3. Camera Idle State */
                  <div className="p-6 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto border border-orange-200">
                      <Camera className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-300">
                        Kamera Lapangan Belum Aktif
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Aktifkan kamera ponsel atau laptop untuk mengambil foto wajah tukang.
                      </p>
                    </div>
                    {cameraError && (
                      <p className="text-xs text-rose-400 bg-rose-950/60 p-2 rounded-xl border border-rose-800">
                        {cameraError}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="px-5 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white font-bold text-xs shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      Buka Kamera Proyek
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Catatan / Keterangan Tambahan (Opsional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Tambahan (Opsional)
              </label>
              <input
                type="text"
                placeholder="Misal: Tukang baru dari Subkon Mandiri, shift lembur, dsb..."
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* Geolocation Tag Preview */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-orange-600 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 font-mono-code block">
                    Lokasi GPS Verifikasi
                  </span>
                  <p className="text-slate-800 font-semibold text-[11px] truncate max-w-sm">
                    {gpsLocation?.address || activeProject?.location || 'Menunggu sinyal GPS...'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={requestGps}
                className="text-[10px] font-bold text-orange-600 hover:text-orange-800 font-mono-code underline cursor-pointer"
              >
                Kunci Ulang
              </button>
            </div>

            {/* Submit Action Button */}
            <button
              type="button"
              onClick={handleSubmitAttendance}
              disabled={isSubmitting || !workerNameInput.trim() || !capturedPhoto}
              className={`w-full py-3.5 rounded-2xl font-black text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 ${
                isSubmitting || !workerNameInput.trim() || !capturedPhoto
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-[#FF6B00] to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/30 cursor-pointer hover:scale-[1.01] active:scale-95'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Presensi & Mengunggah Foto...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>SIMPAN & VERIFIKASI PRESENSI HARI INI</span>
                </>
              )}
            </button>
          </div>

          {/* Right Column: Live Attendance Cards for Today */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Tukang Hadir Hari Ini ({todayAttendances.length})
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono-code mt-0.5">
                    {todayStr} â€¢ {activeProject?.code}
                  </p>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono-code">
                  PROYEK ACTIVE
                </span>
              </div>

              {todayAttendances.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Users className="w-8 h-8 mx-auto opacity-30" />
                  <p className="text-xs font-bold text-slate-500">
                    Belum ada tukang yang diabsen hari ini.
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Masukkan nama tukang pada formulir di sebelah kiri untuk mencatat kehadiran pagi ini.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                  {todayAttendances.map((att, idx) => (
                    <div
                      key={att.id || idx}
                      className="p-3 rounded-2xl bg-slate-50/80 hover:bg-slate-100/90 border border-slate-200/80 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        {/* Worker Photo Thumbnail with click to zoom */}
                        <div
                          onClick={() => att.photoUrl && setPreviewPhotoModal({ url: att.photoUrl, name: att.workerName, time: att.checkInTime })}
                          className="w-12 h-12 rounded-xl bg-slate-200 overflow-hidden shrink-0 border border-slate-300 relative cursor-pointer group"
                        >
                          {att.photoUrl ? (
                            <>
                              <img
                                src={att.photoUrl}
                                alt={att.workerName}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Eye className="w-4 h-4" />
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Users className="w-5 h-5" />
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="text-xs font-black text-slate-900 leading-tight">
                            {att.workerName}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 mt-1 font-mono-code">
                            <Clock className="w-3 h-3 text-orange-500" />
                            <span className="font-bold text-slate-700">{att.checkInTime} WIB</span>
                          </div>
                          {att.notes && (
                            <p className="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-[160px]">
                              "{att.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono-code block">
                          TERVERIFIKASI
                        </span>
                        <span className="text-[9.5px] text-slate-400 font-mono-code block mt-1">
                          oleh {att.verifiedByPmName?.split(' ')[0] || 'PM'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: PROJECT WORKER ROSTER (DAFTAR TUKANG DI PROYEK INI)
         ========================================================================= */}
      {activeSubTab === 'roster' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-500" />
                Roster Tukang & Pekerja Site ({workers.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar tukang yang pernah dicatat pada proyek {activeProject?.name}. Tekan "Absenkan Hari Ini" untuk proses cepat 3 detik.
              </p>
            </div>

            {/* Search Filter */}
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama tukang..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {filteredWorkers.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Users className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm font-bold text-slate-500">
                {searchFilter ? 'Tukang dengan nama tersebut tidak ditemukan.' : 'Belum ada tukang terdaftar pada proyek ini.'}
              </p>
              <button
                onClick={() => setActiveSubTab('record')}
                className="px-4 py-2 rounded-xl bg-[#FF6B00] text-white text-xs font-bold mt-2 cursor-pointer shadow-md"
              >
                Tambah Tukang Baru
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredWorkers.map((worker) => {
                const todayRecord = todayAttendanceMap.get(worker.id) || todayAttendanceMap.get(worker.name.toLowerCase());
                const isPresent = !!todayRecord;

                return (
                  <div
                    key={worker.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                      isPresent
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-white hover:bg-slate-50/80 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400 font-mono-code uppercase">
                          {worker.id}
                        </span>
                        {isPresent ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black font-mono-code flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            HADIR ({todayRecord.checkInTime})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold font-mono-code">
                            BELUM ABSEN
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-black text-slate-900 leading-tight">
                        {worker.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Proyek: {activeProject?.code}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      {isPresent ? (
                        <div className="flex items-center gap-2 text-xs text-emerald-800 font-bold">
                          {todayRecord.photoUrl && (
                            <button
                              onClick={() => setPreviewPhotoModal({ url: todayRecord.photoUrl, name: worker.name, time: todayRecord.checkInTime })}
                              className="text-[11px] text-emerald-700 hover:text-emerald-900 font-mono-code underline flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Lihat Foto
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleQuickAbsenFromRoster(worker)}
                          className="w-full py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#FF6B00] border border-orange-200 hover:border-orange-300 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          Absenkan Hari Ini
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: ATTENDANCE HISTORY & PHOTO AUDIT LOG
         ========================================================================= */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-500" />
                Rekap Riwayat Presensi & Foto Harian
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit visual kehadiran tukang lapangan beserta stempel jam WIB dan identitas Project Manager pemeriksa.
              </p>
            </div>

            {/* Date Selector & Export Actions */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500 font-mono-code cursor-pointer"
              />

              <button
                onClick={exportCsv}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Calendar className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm font-bold text-slate-500">
                Tidak ada data presensi pada tanggal {historyDate}.
              </p>
              <p className="text-xs text-slate-400">
                Ubah tanggal di atas atau pilih proyek lain.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredHistory.map((att, idx) => (
                <div
                  key={att.id || idx}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  {/* Photo Container */}
                  <div
                    onClick={() => att.photoUrl && setPreviewPhotoModal({ url: att.photoUrl, name: att.workerName, time: att.checkInTime })}
                    className="relative aspect-video bg-slate-900 cursor-pointer group"
                  >
                    {att.photoUrl ? (
                      <>
                        <img
                          src={att.photoUrl}
                          alt={att.workerName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1 font-bold text-xs">
                          <Eye className="w-4 h-4" />
                          Perbesar Foto
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <Users className="w-8 h-8" />
                      </div>
                    )}

                    <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white font-mono-code">
                      {att.checkInTime} WIB
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="p-3.5 space-y-2">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 leading-tight">
                        {att.workerName}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-mono-code">
                        {att.projectName || activeProject?.name}
                      </p>
                    </div>

                    {att.address && (
                      <p className="text-[10.5px] text-slate-500 truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-orange-500 shrink-0" />
                        <span>{att.address}</span>
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono-code">
                      <span>PM: {att.verifiedByPmName?.split(' ')[0] || 'PM'}</span>
                      <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                        <ShieldCheck className="w-3 h-3" /> VERIFIED
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          4. PHOTO PREVIEW ZOOM MODAL
         ========================================================================= */}
      {previewPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative max-w-2xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl">
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between text-white">
              <div>
                <h4 className="text-sm font-black">
                  Bukti Foto Wajah: {previewPhotoModal.name}
                </h4>
                <p className="text-[11px] text-slate-400 font-mono-code">
                  Dicatat pada {previewPhotoModal.time} WIB
                </p>
              </div>
              <button
                onClick={() => setPreviewPhotoModal(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Image */}
            <div className="p-4 flex items-center justify-center bg-black/40">
              <img
                src={previewPhotoModal.url}
                alt={previewPhotoModal.name}
                className="max-h-[70vh] rounded-2xl object-contain shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
