import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  RotateCcw,
  CheckCircle2,
  Play,
  Pause,
  Layers,
  Shield,
  Camera,
  Users,
  Banknote,
  FileSpreadsheet,
  Zap,
  MousePointerClick,
  Sliders,
  DollarSign,
  Clock,
  Send,
  UserCheck,
  Compass,
  MapPin
} from 'lucide-react';

export interface TourStep {
  id: string;
  tab: string;
  subview?: 'hris' | 'finance' | 'performance';
  targetSelector: string;
  title: string;
  subtitle: string;
  badge: string;
  module: 'Navigasi' | 'Dashboard' | 'Presensi' | 'Karyawan' | 'Payroll' | 'Approval' | 'Proposal';
  text: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const TOUR_STEPS: TourStep[] = [
  // ==========================================
  // MODUL: NAVIGASI & HEADER (Langkah 1 - 4)
  // ==========================================
  {
    id: 'welcome',
    tab: 'dashboard',
    subview: 'hris',
    targetSelector: '#tour-brand-logo',
    title: 'Selamat Datang di DMJ HRIS Enterprise',
    subtitle: 'Human Resource Information System Terpadu & Berstandar Industri',
    badge: 'Platform Enterprise • Overview',
    module: 'Navigasi',
    icon: Sparkles,
    text: 'Selamat datang di DMJ HRIS Enterprise — sistem manajemen kepegawaian dan penggajian terintegrasi rancangan PT Prime Infinity Systems. Sistem ini mengintegrasikan presensi kamera pintar ber-watermark digital, verifikasi biometrik pengenalan wajah 4-pose, satelit GPS Geofence anti-fraud, pusat approval SDM, database master personil terenkripsi, penggajian otomatis formula Depnaker, hingga simulasi proyeksi payroll real-time. Mari kita jelajahi seluruh kapabilitasnya!'
  },
  {
    id: 'rbac-switcher',
    tab: 'dashboard',
    subview: 'hris',
    targetSelector: '#tour-user-switcher',
    title: 'Simulasi Otorisasi Multi-Role (RBAC)',
    subtitle: 'Proteksi Data & Hierarki Hak Akses',
    badge: 'Navigasi • Security',
    module: 'Navigasi',
    icon: Shield,
    text: 'Aplikasi ini menerapkan Role-Based Access Control (RBAC) ketat dalam 3 tingkatan: Superuser (Direksi/Owner dengan akses penuh ke seluruh data & menu rahasia), HR (Kelola database karyawan, verifikasi absensi & rincian gaji), serta Staff Biasa (Hanya dapat mengakses data pribadi, presensi mandiri, dan saldo cuti). Anda dapat berganti persona secara instan di sini untuk menguji simulasi hak akses.'
  },
  {
    id: 'geofence-security',
    tab: 'dashboard',
    subview: 'hris',
    targetSelector: '#tour-notification-bell',
    title: 'Pusat Keamanan & Geofencing Presensi',
    subtitle: 'Validasi Lokasi Fisik Satelit GPS & Biometrik Wajah',
    badge: 'Navigasi • Lokasi & Security',
    module: 'Navigasi',
    icon: Shield,
    text: 'Sistem melindungi integritas presensi melalui validasi ganda: pencocokan koordinat GPS satelit dengan radius resmi kantor (100–350 meter) serta analisis liveness biometrik wajah 4-pose tanpa bergantung pada perangkat keras eksternal.'
  },
  {
    id: 'sidebar-nav',
    tab: 'dashboard',
    subview: 'hris',
    targetSelector: '#tour-sidebar',
    title: 'Bilah Navigasi Utama Aplikasi',
    subtitle: 'Akses Cepat Seluruh Modul Operasional',
    badge: 'Navigasi • Menu',
    module: 'Navigasi',
    icon: Compass,
    text: 'Sidebar navigasi modern di sisi kiri memberikan akses instan ke seluruh menu operasional utama: Dashboard Analitik SDM, Presensi Kamera Cerdas, Manajemen Karyawan & Hardware, Penggajian & Lembur Proyek, hingga Lembar Dokumen Proposal Komersial Resmi.'
  },

  // ==========================================
  // MENU 1: DASHBOARD EKSEKUTIF (Langkah 5 - 7)
  // ==========================================
  {
    id: 'dashboard-hris',
    tab: 'dashboard',
    subview: 'hris',
    targetSelector: '#tour-dashboard-metrics',
    title: 'Menu 1: Metrik Operasional SDM Harian',
    subtitle: 'Monitoring Headcount & Kehadiran Real-Time',
    badge: 'Menu 1 • Dashboard SDM',
    module: 'Dashboard',
    icon: Layers,
    text: 'Kartu metrik eksekutif menampilkan data live hari ini: Total Karyawan Aktif, Jumlah Hadir Tepat Waktu, Staf Terlambat, Pengajuan Izin/Cuti Berjalan, serta persentase rasio kedisiplinan kerja tim kantor maupun workshop lapangan secara real-time.'
  },
  {
    id: 'dashboard-charts',
    tab: 'dashboard',
    subview: 'hris',
    targetSelector: '#tour-dashboard-charts',
    title: 'Tren Kehadiran & Distribusi Tenaga Kerja',
    subtitle: 'Visualisasi Analitik Komparatif Mingguan',
    badge: 'Menu 1 • Tren Analitik',
    module: 'Dashboard',
    icon: Sliders,
    text: 'Visualisasi interaktif menyajikan tren ketepatan waktu vs keterlambatan harian serta diagram komposisi penempatan tenaga kerja di berbagai divisi dan proyek operasional aktif.'
  },
  {
    id: 'dashboard-finance',
    tab: 'dashboard',
    subview: 'finance',
    targetSelector: '#tour-dashboard-subview',
    title: 'Sub-View Analisis Arus Kas & Finansial Proyek',
    subtitle: 'Komparasi Pagu Anggaran vs Realisasi Lembur',
    badge: 'Menu 1 • Finance View',
    module: 'Dashboard',
    icon: Banknote,
    text: 'Peralihan ke modul Finansial memungkinkan pimpinan proyek dan manajemen membedah realisasi biaya upah tenaga kerja dan jam lembur per proyek (seperti Smelter Manyar, Workshop Fabrikasi, dll.), mendeteksi potensi pembengkakan anggaran sedini mungkin.'
  },

  // ==========================================
  // MENU 2: PRESENSI CERDAS (Langkah 8 - 13)
  // ==========================================
  {
    id: 'attendance-camera',
    tab: 'attendance',
    targetSelector: '#tour-attendance-camera',
    title: 'Menu 2: Presensi Kamera Cerdas Ber-Watermark',
    subtitle: 'Validasi Biometrik Wajah & Anti-Titip Absen',
    badge: 'Menu 2 • Kamera Cerdas',
    module: 'Presensi',
    icon: Camera,
    text: 'Fitur unggulan presensi mandiri dengan viewfinder kamera aktif. Sistem secara otomatis menyematkan Watermark Digital Permanen tak terhapuskan langsung pada foto: NIK & Nama Karyawan, Tanggal & Waktu presisi detik (WIB), Koordinat Satelit GPS, dan IP Address jaringan kantor.'
  },
  {
    id: 'attendance-mode',
    tab: 'attendance',
    targetSelector: '#tour-attendance-mode',
    title: 'Mode Presensi: Masuk Kerja vs Pulang',
    subtitle: 'Siklus Shift Otomatis & Perhitungan Toleransi',
    badge: 'Menu 2 • Mode Presensi',
    module: 'Presensi',
    icon: Clock,
    text: 'Karyawan memilih mode "Check In (Masuk)" atau "Check Out (Pulang)". Sistem secara otomatis menghitung selisih menit keterlambatan masuk kerja dan batas toleransi, atau akumulasi pemenuhan jam kerja reguler sebelum jam lembur dimulai.'
  },
  {
    id: 'attendance-biometric',
    tab: 'attendance',
    targetSelector: '#tour-attendance-face',
    title: 'Multi-Pose Biometric & Liveness Verification',
    subtitle: 'Verifikasi Wajah Cerdas 4 Pose Anti-Spoofing',
    badge: 'Menu 2 • Biometric Gate',
    module: 'Presensi',
    icon: Shield,
    text: 'Sistem menganalisis liveness dan geometri wajah karyawan melalui 4 pose dinamis (Hadap Depan, Kedip Mata, Buka Mulut, Tengok Kanan). Presensi diblokir otomatis jika terdeteksi foto statis atau manipulasi digital.'
  },
  {
    id: 'attendance-gps',
    tab: 'attendance',
    targetSelector: '#tour-attendance-gps',
    title: 'Geofencing GPS & Radius Koordinat Lokasi',
    subtitle: 'Kalkulasi Jarak Real-Time Menghindari Absen Palsu',
    badge: 'Menu 2 • Geofencing Satelit',
    module: 'Presensi',
    icon: MapPin,
    text: 'Modul GPS menghitung jarak matematis real-time antara posisi karyawan dengan titik kantor pusat & tech hub PRIME (radius toleransi maksimal 100 meter) atau lokasi proyek yang ditugaskan, memastikan karyawan berada di titik fisik yang sah.'
  },
  {
    id: 'attendance-form',
    tab: 'attendance',
    targetSelector: '#tour-attendance-form',
    title: 'Form Justifikasi Keterlambatan & Izin Dinas',
    subtitle: 'Otomasi Alur Pengajuan ke Atasan Langsung',
    badge: 'Menu 2 • Form Justifikasi',
    module: 'Presensi',
    icon: Zap,
    text: 'Jika karyawan terlambat atau bertugas di luar jangkauan geofence kantor (Dinas Luar mendadak), form ini wajib diisi dengan alasan resmi dan penugasan proyek. Pengajuan justifikasi langsung diteruskan ke Approval Hub untuk disposisi manajer.'
  },
  {
    id: 'attendance-history',
    tab: 'attendance',
    targetSelector: '#tour-attendance-history',
    title: 'Log Riwayat Presensi Terverifikasi',
    subtitle: 'Audit Trail Lengkap dengan Bukti Foto & Status',
    badge: 'Menu 2 • Riwayat Presensi',
    module: 'Presensi',
    icon: UserCheck,
    text: 'Tabel log presensi harian yang transparan: menampilkan jam masuk/pulang, foto selfie ber-watermark, status ketepatan waktu, dan verifikasi jaringan. Data ini terkunci dan menjadi dasar otomatisasi modul penggajian.'
  },

  // ==========================================
  // MENU 3: DATA KARYAWAN (Langkah 14 - 16)
  // ==========================================
  {
    id: 'employee-header',
    tab: 'users',
    targetSelector: '#tour-employee-header',
    title: 'Menu 3: Direktori Master Data Karyawan',
    subtitle: 'Sentralisasi Profil SDM Enterprise',
    badge: 'Menu 3 • Direktori SDM',
    module: 'Karyawan',
    icon: Users,
    text: 'Pusat database kepegawaian resmi. Di panel atas ini, HR dapat menambahkan karyawan baru, melihat ringkasan total personil aktif, dan memantau klasifikasi status kepegawaian (Tetap, Kontrak, PKWT Proyek).'
  },
  {
    id: 'employee-filters',
    tab: 'users',
    targetSelector: '#tour-employee-filters',
    title: 'Pencarian Cepat & Multi-Filter Fleksibel',
    subtitle: 'Penyaringan Cepat Berdasarkan Departemen & Proyek',
    badge: 'Menu 3 • Multi-Filter',
    module: 'Karyawan',
    icon: Sliders,
    text: 'Alat filter interaktif untuk menyaring ratusan karyawan berdasarkan Departemen (Fabrikasi, Engineering, Keuangan, HSE), Penempatan Proyek (Smelter Manyar, Workshop), Status Keaktifan, maupun pencarian cepat berdasarkan NIK atau Nama.'
  },
  {
    id: 'employee-table',
    tab: 'users',
    targetSelector: '#tour-employee-table',
    title: 'Master Tabel: Kompensasi, Cuti & Audit Akun',
    subtitle: 'Struktur Penggajian & Tata Kelola Kepegawaian',
    badge: 'Menu 3 • Master Table',
    module: 'Karyawan',
    icon: Users,
    text: 'Tabel induk menyajikan parameter vital tiap staf: Foto profil, NIK resmi, Nomor Rekening Bank Payroll (BCA/Mandiri), Gaji Pokok & Tunjangan, Kuota Sisa Cuti Tahunan, serta Hak Akses RBAC terdaftar untuk tata kelola perusahaan.'
  },

  // ==========================================
  // MENU 4: PAYROLL & LEMBUR (Langkah 17 - 20)
  // ==========================================
  {
    id: 'payroll-header',
    tab: 'payroll',
    targetSelector: '#tour-payroll-header',
    title: 'Menu 4: Sistem Penggajian Terpadu Proyek',
    subtitle: 'Automasi Perhitungan Gaji & Filter Periode',
    badge: 'Menu 4 • Payroll Proyek',
    module: 'Payroll',
    icon: Banknote,
    text: 'Modul penggajian yang dirancang khusus untuk ritme kerja industri operasional dan engineering enterprise. Admin dapat memilih periode cut-off penggajian dan memfilter data per proyek lapangan secara instan.'
  },
  {
    id: 'payroll-subviews',
    tab: 'payroll',
    targetSelector: '#tour-payroll-subviews',
    title: '3 Sub-View Segmentasi Penggajian',
    subtitle: 'Tim Lapangan, Staf Kantor & Rekapitulasi Pajak',
    badge: 'Menu 4 • Segmentasi Gaji',
    module: 'Payroll',
    icon: Layers,
    text: 'Sistem memisahkan penggajian menjadi 3 sudut pandang: "Gaji Proyek / Lapangan" (dengan tunjangan harian proyek), "Gaji Staf Kantor Pusat" (gaji bulanan tetap), serta "Rekapitulasi & PPh21" untuk keperluan pelaporan pajak dan BPJS.'
  },
  {
    id: 'payroll-kpi',
    tab: 'payroll',
    targetSelector: '#tour-payroll-kpi',
    title: 'Rekap Finansial Payroll & Formula Lembur Depnaker',
    subtitle: 'Kalkulasi Otomatis Jam Lembur 1.5x dan 2.0x',
    badge: 'Menu 4 • Ringkasan Finansial',
    module: 'Payroll',
    icon: DollarSign,
    text: 'Kartu ringkasan finansial otomatis merekap Total Gaji Bruto, Total Jam & Nilai Upah Lembur sesuai regulasi baku Depnaker (1.5x jam pertama, 2x jam berikutnya), Potongan BPJS Ketenagakerjaan/Kesehatan, serta Total Bersih (Take Home Pay) siap transfer.'
  },
  {
    id: 'payroll-table',
    tab: 'payroll',
    targetSelector: '#tour-payroll-table',
    title: 'Tabel Payroll Detail & Tombol Cetak Slip Resmi',
    subtitle: 'Transparansi Komponen Pendapatan & Potongan',
    badge: 'Menu 4 • Slip Gaji',
    module: 'Payroll',
    icon: FileSpreadsheet,
    text: 'Daftar slip penggajian individu lengkap dengan rincian komponen pendapatan dan potongan. Dilengkapi tombol "Cetak Slip" untuk menghasilkan dokumen slip gaji resmi berlogo PRIME lengkap dengan QR Code validasi dokumen.'
  },

  // ==========================================
  // PUSAT APPROVAL (Langkah 21)
  // ==========================================
  {
    id: 'approval-hub',
    tab: 'payroll',
    targetSelector: '#tour-notification-bell',
    title: 'Pusat Notifikasi & Multi-Level Approval Hub',
    subtitle: 'Disposisi Cepat Permohonan Cuti, Lembur & Izin',
    badge: 'Pusat Approval',
    module: 'Approval',
    icon: Shield,
    text: 'Ikon lonceng notifikasi adalah pintu gerbang menuju Pusat Approval Terpadu. Manajer proyek dan direksi dapat memeriksa permohonan cuti tahunan, justifikasi presensi terlambat, pengajuan dinas luar, dan persetujuan lembur proyek dengan opsi Setujui, Tolak, atau Minta Revisi secara terpusat.'
  },

  // ==========================================
  // MENU 5: PROPOSAL KOMERSIAL (Langkah 22 - 25)
  // ==========================================
  {
    id: 'proposal-container',
    tab: 'proposal',
    targetSelector: '#tour-proposal-container',
    title: 'Menu 5: Proposal Penawaran Komersial Resmi',
    subtitle: 'Dokumen Investasi & Implementasi DMJ HRIS',
    badge: 'Menu 5 • Proposal Resmi',
    module: 'Proposal',
    icon: FileSpreadsheet,
    text: 'Dokumen Spesifikasi & Proposal Sistem Resmi yang memuat arsitektur teknis, kepatuhan regulasi Depnaker, model deployment cloud/on-premise, dan panduan implementasi enterprise.'
  },
  {
    id: 'proposal-packages',
    tab: 'proposal',
    targetSelector: '#tour-proposal-packages',
    title: 'Pilihan Paket Lisensi & Modular Add-On',
    subtitle: 'Paket Dasar, Full Enterprise & Pilihan Kustom',
    badge: 'Menu 5 • Paket Layanan',
    module: 'Proposal',
    icon: Layers,
    text: 'Menyajikan 3 pilihan paket implementasi: Paket Standar (Presensi GPS & Payroll dasar), Paket Enterprise Rekomendasi (Kamera Cerdas Watermark + Multi-Site GPS Geofence + Payroll Depnaker), serta Opsi Source Code & Dedicated Server.'
  },
  {
    id: 'proposal-pricing',
    tab: 'proposal',
    targetSelector: '#tour-proposal-pricing',
    title: 'Kalkulator Investasi & Skema Anggaran',
    subtitle: 'Transparansi Biaya & Kalkulasi Otomatis Add-On',
    badge: 'Menu 5 • Kalkulator Biaya',
    module: 'Proposal',
    icon: DollarSign,
    text: 'Simulasi biaya investasi yang transparan. Klien dapat mengaktifkan atau menonaktifkan modul add-on (seperti Multi-Site Geofence kustom, aplikasi mobile, atau domain korporat) dan melihat total nilai investasi yang terupdate secara real-time.'
  },
  {
    id: 'proposal-actions',
    tab: 'proposal',
    targetSelector: '#tour-proposal-pdf',
    title: 'Export Dokumen PDF Resmi & Konsultasi WhatsApp',
    subtitle: 'Format Cetak Korporat Berkop Surat & Akses Langsung',
    badge: 'Tour Selesai • Next Step',
    module: 'Proposal',
    icon: Send,
    text: 'Tour demo interaktif seluruh modul telah selesai! Dokumen proposal ini siap diekspor ke PDF resmi lengkap dengan nomor surat dan stempel digital. Klik tombol WhatsApp di samping untuk konsultasi langsung dengan tim PT Prime Infinity Systems mengenai kick-off implementasi!'
  }
];

export const MODULE_CATEGORIES: { name: string; stepIndex: number; icon: React.ComponentType<{ className?: string }> }[] = [
  { name: 'Navigasi', stepIndex: 0, icon: Compass },
  { name: 'Dashboard', stepIndex: 4, icon: Layers },
  { name: 'Presensi', stepIndex: 7, icon: Camera },
  { name: 'Karyawan', stepIndex: 13, icon: Users },
  { name: 'Payroll', stepIndex: 16, icon: Banknote },
  { name: 'Approval', stepIndex: 20, icon: Shield },
  { name: 'Proposal', stepIndex: 21, icon: FileSpreadsheet }
];

interface TourDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab: (tabId: string) => void;
  onSetDashboardSubView?: (subView: 'hris' | 'finance' | 'performance') => void;
  activeTab: string;
}

export const TourDemoModal: React.FC<TourDemoModalProps> = ({
  isOpen,
  onClose,
  onNavigateToTab,
  onSetDashboardSubView,
  activeTab
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [displayedText, setDisplayedText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isAutoPlay, setIsAutoPlay] = useState<boolean>(true);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number>(0);

  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const step = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];

  // Helper to accurately locate target element
  const locateTarget = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.targetSelector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [step]);

  // Update target bounding box and trigger tab change
  const updateTargetPosition = useCallback(() => {
    if (!step) return;

    if (activeTab !== step.tab) {
      onNavigateToTab(step.tab);
    }

    if (step.subview && onSetDashboardSubView) {
      onSetDashboardSubView(step.subview);
    }

    // Staggered check to adapt to DOM animations and tab switches
    locateTarget();
    const t1 = setTimeout(locateTarget, 100);
    const t2 = setTimeout(locateTarget, 250);
    const t3 = setTimeout(locateTarget, 550);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [step, activeTab, onNavigateToTab, onSetDashboardSubView, locateTarget]);

  // Handle step change & typewriter effect
  useEffect(() => {
    if (!isOpen) return;

    const cleanupPosition = updateTargetPosition();

    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
    }

    setDisplayedText('');
    setIsTyping(true);

    const fullText = step.text;
    let charIndex = 0;
    const speedMs = 12;

    typingTimerRef.current = setInterval(() => {
      charIndex += 1;
      setDisplayedText(fullText.slice(0, charIndex));

      if (charIndex >= fullText.length) {
        if (typingTimerRef.current) {
          clearInterval(typingTimerRef.current);
        }
        setIsTyping(false);
      }
    }, speedMs);

    return () => {
      if (cleanupPosition) cleanupPosition();
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
      }
    };
  }, [currentStepIndex, isOpen, updateTargetPosition]);

  // Window resize/scroll listener to update target highlight rect
  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => {
      if (!step) return;
      const el = document.querySelector(step.targetSelector);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      }
    };

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isOpen, step]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Skip typewriter animation if user clicks text
  const handleFastForwardText = () => {
    if (isTyping && typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      setDisplayedText(step.text);
      setIsTyping(false);
    }
  };

  const handleNext = useCallback(() => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onClose();
    }
  }, [currentStepIndex, onClose]);

  const handlePrev = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const handleRestart = useCallback(() => {
    setCurrentStepIndex(0);
  }, []);

  // Auto-play timer effect: when typing ends and isAutoPlay is active, countdown ~3.8 seconds and advance!
  useEffect(() => {
    if (!isOpen || isTyping || !isAutoPlay) {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      setAutoPlayCountdown(0);
      return;
    }

    if (currentStepIndex >= TOUR_STEPS.length - 1) {
      setAutoPlayCountdown(0);
      return;
    }

    const totalDurationMs = 3800; // 3.8 seconds window to read each step
    const intervalMs = 50;
    const stepIncrement = (intervalMs / totalDurationMs) * 100;
    let currentProgress = 0;
    setAutoPlayCountdown(0);

    autoPlayTimerRef.current = setInterval(() => {
      currentProgress += stepIncrement;
      if (currentProgress >= 100) {
        if (autoPlayTimerRef.current) {
          clearInterval(autoPlayTimerRef.current);
          autoPlayTimerRef.current = null;
        }
        setAutoPlayCountdown(100);
        handleNext();
      } else {
        setAutoPlayCountdown(currentProgress);
      }
    }, intervalMs);

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [isOpen, isTyping, isAutoPlay, currentStepIndex, handleNext]);

  if (!isOpen) return null;

  const IconComponent = step.icon;
  const progressPercent = Math.round(((currentStepIndex + 1) / TOUR_STEPS.length) * 100);

  // Dynamic positioning: if target is in bottom half of screen, place callout at top so it doesn't cover component!
  const isTargetInBottomHalf = targetRect !== null && typeof window !== 'undefined'
    ? (targetRect.top + targetRect.height / 2 > window.innerHeight / 2)
    : false;

  // Hole coordinates with safe padding
  const holePad = 8;
  const holeX = targetRect ? Math.max(0, targetRect.left - holePad) : 0;
  const holeY = targetRect ? Math.max(0, targetRect.top - holePad) : 0;
  const holeW = targetRect ? targetRect.width + holePad * 2 : 0;
  const holeH = targetRect ? targetRect.height + holePad * 2 : 0;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none select-none overflow-hidden font-sans">
      
      {/* 
        =============================================================================
        TRUE SVG CUTOUT OVERLAY:
        Punches a genuine transparent hole right over the spotlighted component.
        ABSOLUTELY NO backdrop-blur on the component!
        The spotlighted component remains 100% crisp, sharp, vibrant, and UNBLURRED!
        =============================================================================
      */}
      <svg 
        className="fixed inset-0 w-full h-full pointer-events-auto transition-opacity duration-300"
        style={{ zIndex: 50 }}
        onClick={onClose}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            {/* White fills the screen: overlay will show here */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black hole punches through with 100% TRANSPARENCY: completely clear, unblurred! */}
            {targetRect && (
              <rect
                x={holeX}
                y={holeY}
                width={holeW}
                height={holeH}
                rx="16"
                ry="16"
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Semi-dark darkened overlay around the transparent cutout */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(10, 15, 30, 0.76)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* Target Element Spotlight Halo Border (Framing the crystal clear hole) */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            top: holeY,
            left: holeX,
            width: holeW,
            height: holeH,
            borderRadius: '1rem',
            border: '2.5px solid #FF6B00',
            boxShadow: '0 0 25px rgba(255, 107, 0, 0.9), inset 0 0 15px rgba(255, 107, 0, 0.25)',
            pointerEvents: 'none',
            zIndex: 52
          }}
          className="animate-pulse"
        >
          {/* Beacon badge on top-right of target */}
          <div className="absolute -top-3.5 -right-3.5 bg-gradient-to-tr from-[#FF6B00] to-[#FF8533] text-white p-1 rounded-full shadow-lg border-2 border-slate-950 animate-bounce">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* 
        =============================================================================
        INTERACTIVE TYPEWRITER CALLOUT DIALOG BOX:
        Dynamically placed at Top or Bottom depending on target position,
        ensuring the callout NEVER overlaps the spotlighted component!
        =============================================================================
      */}
      <div 
        className={`fixed left-1/2 -translate-x-1/2 w-[94vw] max-w-2xl z-55 pointer-events-auto transition-all duration-300 animate-in fade-in ${
          isTargetInBottomHalf 
            ? 'top-3 sm:top-5 slide-in-from-top-6' 
            : 'bottom-3 sm:bottom-5 slide-in-from-bottom-6'
        }`}
      >
        <div className="relative rounded-3xl bg-slate-950/95 backdrop-blur-xl border border-orange-500/40 shadow-2xl shadow-orange-950/60 text-white overflow-hidden p-4 sm:p-5">
          
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Progress Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-[#FF6B00] via-amber-400 to-[#00E2B0] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Quick-Jump Module Navigation Bar */}
          <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-2.5 pt-1 border-b border-slate-800/80 no-scrollbar">
            {MODULE_CATEGORIES.map(cat => {
              const isActiveModule = step.module === cat.name;
              const CatIcon = cat.icon;
              return (
                <button
                  key={cat.name}
                  onClick={() => setCurrentStepIndex(cat.stepIndex)}
                  className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                    isActiveModule
                      ? 'bg-[#FF6B00] text-white shadow-md shadow-orange-600/30'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <CatIcon className="w-3 h-3" />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Header: Step Number, Badge & Action Buttons */}
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono-code bg-[#FF6B00]/20 text-[#FF8533] border border-[#FF6B00]/40">
                <IconComponent className="w-3 h-3" />
                {step.badge}
              </span>
              <span className="text-[11px] font-mono-code text-slate-400">
                Langkah <strong className="text-white">{currentStepIndex + 1}</strong> dari {TOUR_STEPS.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Auto-Play Toggle */}
              <button
                onClick={() => setIsAutoPlay(prev => !prev)}
                className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isAutoPlay
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 shadow-sm shadow-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
                title={isAutoPlay ? 'Jeda Auto-Play (Beralih ke navigasi manual)' : 'Aktifkan Auto-Play otomatis'}
              >
                {isAutoPlay ? (
                  <>
                    <Pause className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>Auto-Play ON</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 text-slate-400" />
                    <span>Jeda</span>
                  </>
                )}
              </button>

              <button
                onClick={handleRestart}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Ulangi Tour dari awal"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="Tutup / Lewati Tour"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Step Title & Subtitle */}
          <div className="mb-2">
            <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              <span>{step.title}</span>
            </h3>
            <p className="text-xs text-orange-400/90 font-medium font-mono-code">
              {step.subtitle}
            </p>
          </div>

          {/* Typewriter Body Text Box (Click to fast-forward) */}
          <div
            onClick={handleFastForwardText}
            className="relative bg-slate-900/80 rounded-2xl p-3 sm:p-3.5 border border-slate-800 text-xs sm:text-[12.5px] text-slate-200 leading-relaxed min-h-[75px] sm:min-h-[80px] cursor-pointer group hover:border-slate-700 transition-all select-text"
            title="Klik untuk langsung menampilkan semua teks"
          >
            <p>
              {displayedText}
              {isTyping && (
                <span className="inline-block w-2 h-3.5 ml-0.5 bg-[#FF6B00] animate-pulse align-middle" />
              )}
            </p>

            {/* Fast-forward hint tooltip */}
            {isTyping && (
              <span className="absolute bottom-1.5 right-2 text-[10px] text-slate-500 font-mono-code flex items-center gap-1 opacity-70 group-hover:opacity-100">
                <MousePointerClick className="w-3 h-3 text-orange-400" />
                Klik untuk percepat
              </span>
            )}
          </div>

          {/* Auto-advance Countdown Bar */}
          {isAutoPlay && !isTyping && currentStepIndex < TOUR_STEPS.length - 1 && (
            <div className="mt-2 flex items-center gap-2 text-[10.5px] text-emerald-400/90 font-mono-code">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 animate-spin text-emerald-400" />
                Otomatis lanjut...
              </span>
              <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-75 ease-linear"
                  style={{ width: `${autoPlayCountdown}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400">
                {Math.max(0, Math.ceil((100 - autoPlayCountdown) / 100 * 3.8))}s
              </span>
            </div>
          )}

          {/* Footer Navigation Buttons */}
          <div className="flex items-center justify-between gap-3 mt-3 pt-2.5 border-t border-slate-800/80">
            {/* Left: Previous Button */}
            <button
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                currentStepIndex === 0
                  ? 'opacity-40 cursor-not-allowed text-slate-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 active:scale-95'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Sebelumnya</span>
            </button>

            {/* Middle: Step Dots Indicator */}
            <div className="hidden sm:flex items-center gap-1 overflow-hidden max-w-[200px]">
              {TOUR_STEPS.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentStepIndex
                      ? 'w-5 bg-[#FF6B00]'
                      : idx < currentStepIndex
                      ? 'w-1.5 bg-emerald-500'
                      : 'w-1.5 bg-slate-700 hover:bg-slate-600'
                  }`}
                  title={s.title}
                />
              ))}
            </div>

            {/* Right: Next / Finish Button */}
            <button
              onClick={handleNext}
              className="px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#FF8533] hover:from-[#e56000] hover:to-[#ff771a] text-white text-xs font-black shadow-lg shadow-orange-500/25 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <span>
                {currentStepIndex === TOUR_STEPS.length - 1 ? 'Selesai Tour 🎉' : 'Lanjut'}
              </span>
              {currentStepIndex === TOUR_STEPS.length - 1 ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};

export default TourDemoModal;
