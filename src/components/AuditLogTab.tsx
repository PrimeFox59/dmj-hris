import { createPortal } from 'react-dom';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  History,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Download,
  User,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  ChevronDown,
  Layers,
  Lock,
  ArrowDown,
  Info,
  Calendar,
  Eye,
  X
} from 'lucide-react';
import { AuditLogItem, AuditModule, AuditStatus, Employee, AuditLogStats } from '../types';
import { api } from '../services/api';
import { rtcService } from '../services/rtcService';

interface AuditLogTabProps {
  currentUser: Employee;
  realDetectedIp?: string;
  onNavigateToTab?: (tabId: string) => void;
}

export const AuditLogTab: React.FC<AuditLogTabProps> = ({
  currentUser,
  realDetectedIp = '103.31.205.218',
  onNavigateToTab
}) => {
  // State for logs and pagination
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [auditStartDate, setAuditStartDate] = useState<string>('');
  const [auditEndDate, setAuditEndDate] = useState<string>('');
  const [auditDatePreset, setAuditDatePreset] = useState<'ALL' | 'TODAY' | 'LAST_7' | 'THIS_MONTH'>('ALL');

  const applyAuditPreset = (preset: 'ALL' | 'TODAY' | 'LAST_7' | 'THIS_MONTH') => {
    setAuditDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (preset === 'ALL') {
      setAuditStartDate('');
      setAuditEndDate('');
    } else if (preset === 'TODAY') {
      setAuditStartDate(todayStr);
      setAuditEndDate(todayStr);
    } else if (preset === 'LAST_7') {
      const d = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      setAuditStartDate(d.toISOString().slice(0, 10));
      setAuditEndDate(todayStr);
    } else if (preset === 'THIS_MONTH') {
      const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      setAuditStartDate(startStr);
      setAuditEndDate(todayStr);
    }
  };

  // Selected Log for Deep Inspection Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  // Global aggregate stats across all database records
  const [auditStats, setAuditStats] = useState<AuditLogStats | null>(null);

  // Sentinel ref for infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Fetch initial or filtered batch (page 1)
  const fetchInitialLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.getAuditLogs({
        page: 1,
        limit: 10, // Exact 10 items per batch requirement
        search: searchQuery,
        module: selectedModule,
        role: selectedRole,
        status: selectedStatus,
        startDate: auditStartDate,
        endDate: auditEndDate
      });
      setLogs(res.logs || []);
      setPage(1);
      setTotalRows(res.pagination?.totalRows || 0);
      setTotalPages(res.pagination?.totalPages || 1);
      setHasMore(res.pagination?.hasMore ?? false);
      if (res.stats) {
        setAuditStats(res.stats);
      }
      setLastRefreshed(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB');
    } catch (err) {
      console.error('Failed to fetch initial audit logs', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedModule, selectedRole, selectedStatus, auditStartDate, auditEndDate]);

  // Fetch next batch of 10 items when user scrolls down
  const loadMoreLogs = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await api.getAuditLogs({
        page: nextPage,
        limit: 10, // Load exactly 10 more
        search: searchQuery,
        module: selectedModule,
        role: selectedRole,
        status: selectedStatus,
        startDate: auditStartDate,
        endDate: auditEndDate
      });
      const newItems = res.logs || [];
      if (newItems.length > 0) {
        setLogs(prev => [...prev, ...newItems]);
        setPage(nextPage);
        setTotalRows(res.pagination?.totalRows || 0);
        setTotalPages(res.pagination?.totalPages || 1);
        setHasMore(res.pagination?.hasMore ?? false);
        if (res.stats) {
          setAuditStats(res.stats);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more audit logs', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, hasMore, isLoadingMore, searchQuery, selectedModule, selectedRole, selectedStatus, auditStartDate, auditEndDate]);

  // Debounced filter trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInitialLogs();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchInitialLogs]);

  // Real-Time Multi-Device Live Stream for Audit Logs
  useEffect(() => {
    const unsub = rtcService.subscribe('AUDIT_LOG_ADDED', (packet) => {
      const newLog = packet.payload;
      if (!newLog) return;
      if (page === 1 && !searchQuery && selectedModule === 'ALL' && selectedRole === 'ALL' && selectedStatus === 'ALL') {
        setLogs(prev => {
          if (prev.some(l => l.id === newLog.id)) return prev;
          return [newLog, ...prev];
        });
        setTotalRows(prev => prev + 1);
      }
    });
    return () => unsub();
  }, [page, searchQuery, selectedModule, selectedRole, selectedStatus]);

  // Infinite Scroll Observer using IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          loadMoreLogs();
        }
      },
      {
        root: null, // viewport or container
        rootMargin: '120px', // trigger slightly before hitting the exact bottom
        threshold: 0.1
      }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, isLoadingMore, loadMoreLogs]);

  // Export Audit Trail to CSV
  const handleExportCsv = () => {
    if (logs.length === 0) return;
    const headers = ['ID', 'Date Time', 'User (Login ID)', 'Role', 'Modul', 'Aksi', 'Status', 'IP Address', 'Keterangan'];
    const rows = logs.map(l => [
      l.id,
      `"${l.timestamp}"`,
      `"${l.userLoginId || (l.userName === 'admin' ? 'admin' : l.userName)}"`,
      `"${l.userRole}"`,
      `"${l.module}"`,
      `"${l.action}"`,
      `"${l.status}"`,
      `"${l.ipAddress || '-'}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Audit_Log_PRIME_Enterprise_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for Status Badge Styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono-code bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Success
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono-code bg-amber-100 text-amber-900 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Warning
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono-code bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono-code bg-slate-100 text-slate-700 border border-slate-200">
            Info
          </span>
        );
    }
  };

  // Helper for Module Tag Styling
  const getModuleBadge = (mod: string) => {
    switch (mod) {
      case 'AUTH':
      case 'AUTH_BIOMETRIC':
      case 'AUTH_SECURITY':
        return <span className="px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase font-mono-code bg-purple-100 text-purple-700 border border-purple-200">Auth & Keamanan</span>;
      case 'ATTENDANCE':
      case 'ATTENDANCE_KIOSK':
      case 'CASUAL_ATTENDANCE':
        return <span className="px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase font-mono-code bg-blue-100 text-blue-700 border border-blue-200">Presensi & Lokasi</span>;
      case 'APPROVAL':
      case 'APPROVALS':
        return <span className="px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase font-mono-code bg-teal-100 text-teal-700 border border-teal-200">Pusat Approval</span>;
      case 'EMPLOYEES':
      case 'BIOMETRIC':
        return <span className="px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase font-mono-code bg-cyan-100 text-cyan-700 border border-cyan-200">Master SDM</span>;
      case 'PROJECTS':
        return <span className="px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase font-mono-code bg-indigo-100 text-indigo-700 border border-indigo-200">Proyek & Geofence</span>;
      case 'PAYROLL':
        return <span className="px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase font-mono-code bg-emerald-100 text-emerald-700 border border-emerald-200">Payroll & Biaya</span>;
      case 'HR_RULES':
      case 'HRIS_CALENDAR':
        return <span className="px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase font-mono-code bg-orange-100 text-[#FF6B00] border border-orange-200">Kebijakan HR</span>;
      case 'SYSTEM':
      default:
        return <span className="px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase font-mono-code bg-slate-100 text-slate-700 border border-slate-200">Sistem Core</span>;
    }
  };

  // Stats calculation
  const totalAuthCount = logs.filter(l => l.module === 'AUTH').length;
  const totalAttCount = logs.filter(l => l.module === 'ATTENDANCE').length;
  const totalApprCount = logs.filter(l => l.module === 'APPROVALS').length;

  return (
    <div className="space-y-3 motion-fade-in-up" ref={scrollContainerRef}>
      {/* =========================================================================
          1. COMPACT EXECUTIVE HEADER & SUMMARY METRICS (FIT WITHIN 1 SCREEN)
         ========================================================================= */}
      <div className="glass-card rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs bg-white/95 space-y-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider font-mono-code bg-[#FF6B00] text-white">
                ISO 27001 & IATF 16949
              </span>
              <span className="text-[10px] text-slate-500 font-mono-code flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Immutable Audit Trail
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 font-mono-code">
              <History className="w-5 h-5 text-[#FF6B00]" />
              Audit Log & Aktivitas Pengguna
            </h1>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={fetchInitialLogs}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              title="Perbarui log aktivitas terbaru"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin text-[#FF6B00]' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCsv}
              disabled={logs.length === 0}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#FF8533] hover:from-[#e56000] hover:to-[#e5752c] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>

        {/* 4 Compact KPI Strip Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 font-mono-code">
          <div className="px-3 py-1 rounded-xl bg-orange-50/70 border border-orange-200/60 flex items-center justify-between">
            <span className="text-[10px] font-bold text-orange-800">Total Log</span>
            <span className="text-xs font-black text-slate-900">
              {auditStats ? auditStats.total : totalRows}
            </span>
          </div>

          <div className="px-3 py-1 rounded-xl bg-purple-50/70 border border-purple-200/60 flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-800">Sesi Auth</span>
            <span className="text-xs font-black text-purple-950">
              {auditStats ? auditStats.auth : totalAuthCount}
            </span>
          </div>

          <div className="px-3 py-1 rounded-xl bg-blue-50/70 border border-blue-200/60 flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-800">Presensi</span>
            <span className="text-xs font-black text-blue-950">
              {auditStats ? auditStats.attendance : totalAttCount}
            </span>
          </div>

          <div className="px-3 py-1 rounded-xl bg-emerald-50/70 border border-emerald-200/60 flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-800">Approval</span>
            <span className="text-xs font-black text-emerald-950">
              {auditStats ? auditStats.approvals : totalApprCount}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. FILTER & SEARCH CONTROL BAR
         ========================================================================= */}
      <div className="glass-card rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs space-y-2 bg-white/95">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari ID login, user, aksi, modul, IP..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8.5 pr-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Module Filter */}
          <div>
            <select
              value={selectedModule}
              onChange={e => setSelectedModule(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 cursor-pointer font-medium"
            >
              <option value="ALL">📁 Semua Modul Sistem</option>
              <option value="AUTH">🔐 Auth & Keamanan Akun</option>
              <option value="ATTENDANCE">📸 Presensi & Biometrik</option>
              <option value="APPROVALS">🛡️ Pusat Approval</option>
              <option value="EMPLOYEES">👥 Master Data SDM</option>
              <option value="PROJECTS">🏗️ Manajemen Proyek</option>
              <option value="PAYROLL">💰 Payroll & Penggajian</option>
              <option value="HR_RULES">⚙️ Kebijakan & Geofence</option>
              <option value="SYSTEM">🖥️ Sistem & Basis Data</option>
            </select>
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 cursor-pointer font-medium"
            >
              <option value="ALL">👤 Semua Hak Akses / Role</option>
              <option value="superuser">⚡ Superuser (Direksi / Lead)</option>
              <option value="admin">🛡️ HR & Proyek</option>
              <option value="staff">👨‍💼 Staf Karyawan</option>
              <option value="system">🤖 System Daemon / Service</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 cursor-pointer font-medium"
            >
              <option value="ALL">✨ Semua Status Event</option>
              <option value="SUCCESS">✅ Berhasil (Success)</option>
              <option value="WARNING">⚠️ Peringatan (Warning)</option>
              <option value="FAILED">❌ Gagal (Failed)</option>
            </select>
          </div>
        </div>

        {/* Date Range Filter Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1 font-mono-code text-[11px]">
              <Calendar className="w-3.5 h-3.5 text-[#FF6B00]" />
              Filter Rentang Waktu:
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={auditStartDate}
                onChange={e => {
                  setAuditStartDate(e.target.value);
                  setAuditDatePreset('ALL');
                }}
                className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono-code text-slate-800 shadow-2xs focus:ring-1 focus:ring-[#FF6B00]"
                title="Tanggal Mulai"
              />
              <span className="text-slate-400 text-xs font-mono-code">s/d</span>
              <input
                type="date"
                value={auditEndDate}
                onChange={e => {
                  setAuditEndDate(e.target.value);
                  setAuditDatePreset('ALL');
                }}
                className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono-code text-slate-800 shadow-2xs focus:ring-1 focus:ring-[#FF6B00]"
                title="Tanggal Akhir"
              />
            </div>
            {(auditStartDate || auditEndDate) && (
              <button
                type="button"
                onClick={() => applyAuditPreset('ALL')}
                className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200/60 transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'ALL', label: 'Semua' },
              { id: 'TODAY', label: 'Hari Ini' },
              { id: 'LAST_7', label: '7 Hari Terakhir' },
              { id: 'THIS_MONTH', label: 'Bulan Ini' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyAuditPreset(p.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold font-mono-code transition-all cursor-pointer ${
                  auditDatePreset === p.id && (!auditStartDate || p.id !== 'ALL')
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Active Filter Bar & Results Count */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">
              Menampilkan {logs.length} dari {totalRows} rekaman
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-mono-code">Batch: 10 data / scroll</span>
          </div>

          {lastRefreshed && (
            <div className="font-mono-code text-[10px] text-slate-400">
              Sinkronisasi Terakhir: {lastRefreshed}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          3. COMPACT AUDIT LOG TABLE (FIT WITHIN 1 SCREENSHOT, NO HORIZONTAL SCROLL)
         ========================================================================= */}
      <div className="glass-card rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden bg-white/95">
        <div className="w-full overflow-x-hidden">
          <table className="w-full text-left text-xs table-fixed border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider text-[10px] font-mono-code select-none">
                <th className="py-2.5 px-3 w-[130px]">Waktu (WIB)</th>
                <th className="py-2.5 px-3 w-[185px]">Pengguna</th>
                <th className="py-2.5 px-3 w-[165px]">Modul & Aksi</th>
                <th className="py-2.5 px-3">Deskripsi Aktivitas</th>
                <th className="py-2.5 px-3 w-[120px]">Alamat IP</th>
                <th className="py-2.5 px-3 w-[95px]">Status</th>
                <th className="py-2.5 px-2 w-[42px] text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <RefreshCw className="w-6 h-6 text-[#FF6B00] animate-spin mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-800">Memuat audit log aktivitas...</p>
                    <p className="text-[11px] text-slate-400 font-mono-code mt-0.5">Menghubungkan ke basis data SQLite WAL...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <History className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-800">Tidak ada audit log yang sesuai filter</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Coba ubah kata kunci pencarian atau reset filter di atas.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedModule('ALL');
                        setSelectedRole('ALL');
                        setSelectedStatus('ALL');
                        applyAuditPreset('ALL');
                      }}
                      className="mt-2.5 px-3 py-1.5 rounded-xl bg-orange-50 text-[#FF6B00] text-xs font-bold hover:bg-orange-100 transition-all cursor-pointer"
                    >
                      Reset Semua Filter
                    </button>
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => {
                  const timeParts = (log.timestamp || '').split(' ');
                  const dateStr = timeParts[0] || '';
                  const timeStr = timeParts[1] || '';

                  return (
                    <tr
                      key={`${log.id}-${index}`}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-orange-50/40 transition-colors cursor-pointer group h-[38px] sm:h-[40px]"
                    >
                      {/* 1. Waktu */}
                      <td className="py-2 px-3 align-middle font-mono-code">
                        <div className="text-[11px] font-bold text-slate-800 leading-tight">
                          {dateStr}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 leading-none mt-0.5">
                          <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          <span>{timeStr}</span>
                        </div>
                      </td>

                      {/* 2. Pengguna & Role */}
                      <td className="py-2 px-3 align-middle">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-slate-100 to-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                            {log.userName ? log.userName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11.5px] font-bold text-slate-900 group-hover:text-[#FF6B00] transition-colors truncate leading-tight">
                              {log.userName}
                            </div>
                            <div className="flex items-center gap-1 text-[9.5px] font-mono-code text-slate-400 leading-none mt-0.5">
                              {log.userNik && (
                                <span className="bg-slate-100 text-slate-600 px-1 rounded font-semibold">
                                  {log.userNik}
                                </span>
                              )}
                              <span className="uppercase text-slate-400">
                                [{log.userRole}]
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 3. Modul & Aksi */}
                      <td className="py-2 px-3 align-middle">
                        <div className="flex flex-col gap-0.5 items-start">
                          {getModuleBadge(log.module)}
                          <span className="text-[9.5px] font-mono-code font-bold text-slate-700 bg-slate-100 px-1 py-0.2 rounded truncate max-w-full">
                            {log.action}
                          </span>
                        </div>
                      </td>

                      {/* 4. Deskripsi Aktivitas (Flexible width, no horizontal overflow) */}
                      <td className="py-2 px-3 align-middle">
                        <p className="text-xs text-slate-700 truncate leading-snug" title={log.details}>
                          {log.details}
                        </p>
                      </td>

                      {/* 5. Alamat IP */}
                      <td className="py-2 px-3 align-middle font-mono-code text-[10.5px] text-slate-600">
                        <div className="flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{log.ipAddress || '-'}</span>
                        </div>
                      </td>

                      {/* 6. Status */}
                      <td className="py-2 px-3 align-middle">
                        {getStatusBadge(log.status)}
                      </td>

                      {/* 7. Aksi (Eye detail) */}
                      <td className="py-2 px-2 align-middle text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="w-6 h-6 rounded-md bg-slate-50 group-hover:bg-orange-100 text-slate-400 group-hover:text-[#FF6B00] inline-flex items-center justify-center transition-colors cursor-pointer"
                          title="Lihat rincian log"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* =========================================================================
            4. AUTOLOAD SENTINEL & BOTTOM STATUS (10 ROWS / SCROLL)
           ========================================================================= */}
        <div ref={sentinelRef} className="py-2 px-4 text-center bg-slate-50/70 border-t border-slate-100 select-none">
          {isLoadingMore && (
            <div className="inline-flex items-center gap-2 py-1 px-3 rounded-full bg-white border border-orange-200 text-xs font-bold text-orange-700 shadow-2xs animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#FF6B00]" />
              <span>Memuat 10 rekaman aktivitas berikutnya...</span>
            </div>
          )}

          {!hasMore && logs.length > 0 && !isLoading && (
            <div className="text-[11px] text-slate-500 font-mono-code flex items-center justify-center gap-1.5 py-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Seluruh {totalRows} rekaman aktivitas telah dimuat lengkap</span>
            </div>
          )}

          {hasMore && !isLoading && !isLoadingMore && (
            <button
              type="button"
              onClick={loadMoreLogs}
              className="px-3 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-600 hover:text-[#FF6B00] transition-colors cursor-pointer shadow-2xs font-mono-code"
            >
              ⬇️ Muat 10 Rekaman Berikutnya
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          5. MODAL DETAIL AUDIT LOG (DEEP INSPECTION DIALOG)
         ========================================================================= */}
      {selectedLog && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setSelectedLog(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative my-auto modal-dialog-animate max-h-[92vh] overflow-y-auto custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-start gap-3 border-b border-slate-100 pb-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF6B00] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-slate-400 block">
                  AUDIT LOG RECORD #{selectedLog.id}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 font-mono-code">
                  Rincian Aktivitas Sistem
                </h3>
              </div>
            </div>

            {/* Details Grid */}
            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 font-mono-code text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Waktu Stempel (WIB)</span>
                  <span className="font-bold text-slate-800">{selectedLog.timestamp}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Status Validasi</span>
                  <div className="mt-0.5">{getStatusBadge(selectedLog.status)}</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">User Pelaksana</span>
                  <span className="font-bold text-slate-800">{selectedLog.userName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">ID Login Pengguna</span>
                  <span className="font-mono-code font-bold text-slate-900 bg-slate-200/80 px-2 py-0.5 rounded inline-block mt-0.5">
                    {selectedLog.userLoginId || (selectedLog.userName === 'admin' ? 'admin' : selectedLog.userName)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Hak Akses (Role)</span>
                  <span className="font-bold text-slate-800">{selectedLog.userRole}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Modul Sistem</span>
                  <div className="mt-0.5">{getModuleBadge(selectedLog.module)}</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Jenis Aksi</span>
                  <span className="font-bold text-orange-700">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Alamat IP Klien</span>
                  <span className="font-bold text-slate-800">{selectedLog.ipAddress || '-'}</span>
                </div>
              </div>

              {/* Description Box */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Deskripsi Narasi Aktivitas:
                </label>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed">
                  {selectedLog.details}
                </div>
              </div>

              {/* Metadata JSON Drawer if exists */}
              {selectedLog.metadata && (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Metadata & Payload JSON:
                  </label>
                  <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 text-[10.5px] font-mono-code overflow-x-auto max-h-40">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedLog.metadata), null, 2);
                      } catch (e) {
                        return selectedLog.metadata;
                      }
                    })()}
                  </pre>
                </div>
              )}

              {/* Security Seal Note */}
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>
                  Catatan ini terproteksi hash kriptografi SQLite WAL dan terarsip otomatis untuk kepatuhan audit internal.
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
