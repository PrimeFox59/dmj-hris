import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  FileText,
  Clock,
  Users,
  Briefcase,
  Layers,
  Sparkles,
  Info,
  Check,
  X,
  FileUp,
  ShieldCheck,
  Trash2,
  ArrowRight,
  Lock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import { Employee, Project, getEffectiveSystemRole } from '../types';
import { canAccessDatabaseModule, isFinanceEmployee } from '../utils/approvalAuthorityHelper';

interface DatabaseManagementTabProps {
  currentUser?: Employee;
  projects?: Project[];
  employees?: Employee[];
  onRefreshData?: () => void;
  showToast?: (message: string, type?: 'info' | 'success' | 'warn') => void;
}

type DatasetType = 'attendances' | 'employees' | 'projects';
type ImportMode = 'replace' | 'add';

export const DatabaseManagementTab: React.FC<DatabaseManagementTabProps> = ({
  currentUser,
  projects = [],
  employees = [],
  onRefreshData,
  showToast
}) => {
  const effectiveRole = getEffectiveSystemRole(currentUser);
  const isFinanceOrSuper = effectiveRole === 'finance' || effectiveRole === 'superuser' || isFinanceEmployee(currentUser);
  const canAccess = canAccessDatabaseModule(currentUser, effectiveRole);

  // Database Telemetry State
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [isVacuuming, setIsVacuuming] = useState(false);

  // Export State
  const [selectedDataset, setSelectedDataset] = useState<DatasetType>('attendances');
  const [startDate, setStartDate] = useState<string>(() => {
    // Default to first day of current month
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    // Default to today
    return new Date().toISOString().split('T')[0];
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [isExporting, setIsExporting] = useState(false);

  // Dynamic list of actual company departments derived from master employee data
  const departments = React.useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department && typeof e.department === 'string' && e.department.trim()) {
        set.add(e.department.trim());
      }
    });
    // Canonical fallback list if employees array is temporarily empty
    if (set.size === 0) {
      return [
        'Project & Site Operations (DMJ)',
        'Architectural & Engineering Design',
        'Cost Control & Commercial Engineering',
        'Head Office & Management Support',
        'Surveying & Geospatial Engineering',
        'Site Logistics & Equipment Support',
        'Finance, Accounting & Tax',
        'BENGKEL',
        'Engineering & Digital Transformation',
        'Engineering & Mechanical Services',
        'General Affairs & Facility Security',
        'Bengkel',
        'Procurement & Supply Chain',
        'Mechanical, Electrical & Plumbing (MEP)',
        'Human Resources & General Affairs'
      ];
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  // Import State
  const [importMode, setImportMode] = useState<ImportMode>('replace');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [previewAnalysis, setPreviewAnalysis] = useState<{
    total: number;
    toUpdate: number;
    toInsert: number;
    toSkip: number;
    unknownEmployees: number;
    warnings: string[];
  } | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Database Stats on Mount
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await api.getDatabaseStats();
      if (res.success) {
        setStats(res);
      }
    } catch (err: any) {
      console.warn('[DB Stats]', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Quick Preset Handlers
  const handlePresetDate = (type: 'today' | '7days' | 'thisMonth' | 'lastMonth' | 'all') => {
    const today = new Date();
    const formatYMD = (d: Date) => d.toISOString().split('T')[0];

    if (type === 'today') {
      const dStr = formatYMD(today);
      setStartDate(dStr);
      setEndDate(dStr);
    } else if (type === '7days') {
      const past = new Date(today);
      past.setDate(today.getDate() - 6);
      setStartDate(formatYMD(past));
      setEndDate(formatYMD(today));
    } else if (type === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(today));
    } else if (type === 'lastMonth') {
      const firstPrev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastPrev = new Date(today.getFullYear(), today.getMonth(), 0);
      setStartDate(formatYMD(firstPrev));
      setEndDate(formatYMD(lastPrev));
    } else if (type === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Vacuum / Optimize Handler
  const handleVacuumDatabase = async () => {
    if (!window.confirm('Optimalkan database sekarang? Proses ini akan membersihkan ruang penyimpanan kosong (freelist) bekas penghapusan data & foto agar ukuran file mengecil.')) {
      return;
    }
    setIsVacuuming(true);
    try {
      const res = await api.vacuumDatabase();
      if (res.success) {
        if (showToast) {
          showToast(`Optimasi selesai! Ruang terhemat: ${res.savedKb} KB (Ukuran sekarang: ${res.afterSizeKb} KB)`, 'success');
        }
        await fetchStats();
      }
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Gagal mengoptimalkan database', 'warn');
    } finally {
      setIsVacuuming(false);
    }
  };

  // Export Data to Excel
  const handleExportExcel = async (isTemplateOnly: boolean = false) => {
    setIsExporting(true);
    try {
      if (isTemplateOnly) {
        // Generate blank template with header and sample row
        const templateRows = [
          {
            'ID Absensi': 'ATT-CONTOH-01 (Kosongkan jika baris baru)',
            'Tanggal': '2026-11-11',
            'ID Login': 'd163',
            'NIK': '032',
            'Nama Karyawan': 'DEVIRA HERNITA PUTRI',
            'Departemen': 'Project & Site Operations (DMJ)',
            'Kode Proyek': 'DMJ-004',
            'Nama Proyek': 'GUDANG & PUSAT LOGISTIK',
            'Jam Masuk': '08:00:00',
            'Jam Pulang': '17:00:00',
            'Tipe Mode': 'WFO',
            'Status Kehadiran': 'ON_TIME',
            'Status Approval': 'APPROVED',
            'Terlambat (Menit)': 0,
            'Skor Wajah Masuk': '95%',
            'Skor Wajah Pulang': '92%',
            'Alasan / Catatan': 'Contoh format input baru (Hapus baris ini sebelum impor)',
            'Lokasi Masuk': 'Lokasi Proyek',
            'Lokasi Pulang': 'Lokasi Proyek'
          }
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateRows);
        XLSX.utils.book_append_sheet(wb, ws, 'Template Presensi');
        XLSX.writeFile(wb, 'TEMPLATE_INPUT_PRESENSI_DMJ_HRIS.xlsx');
        if (showToast) showToast('Template Excel kosong berhasil diunduh', 'success');
        setIsExporting(false);
        return;
      }

      // Fetch export rows from server
      const res = await api.getExportData({
        table: selectedDataset,
        startDate: selectedDataset === 'attendances' ? (startDate || undefined) : undefined,
        endDate: selectedDataset === 'attendances' ? (endDate || undefined) : undefined,
        projectId: selectedProjectId !== 'ALL' ? selectedProjectId : undefined,
        department: selectedDepartment !== 'ALL' ? selectedDepartment : undefined
      });

      if (!res.success || !res.rows || res.rows.length === 0) {
        alert('Tidak ada data yang ditemukan untuk kriteria filter yang dipilih.');
        setIsExporting(false);
        return;
      }

      // Build Excel Sheet with Auto Column Width
      const wb = XLSX.utils.book_new();
      const cleanRows = res.rows.map(r => {
        const { id, date, loginId, employeeId, nik, name, department, projectCode, projectName, checkInTime, checkOutTime, mode, status, approvalStatus, lateMinutes, note, ...displayOnly } = r;
        return displayOnly;
      });

      const ws = XLSX.utils.json_to_sheet(cleanRows);
      
      // Auto-fit column widths
      const colWidths = Object.keys(cleanRows[0] || {}).map(key => {
        const maxLen = Math.max(
          key.length,
          ...cleanRows.slice(0, 50).map(row => String(row[key] || '').length)
        );
        return { wch: Math.min(Math.max(maxLen + 3, 12), 45) };
      });
      ws['!cols'] = colWidths;

      const sheetTitle = selectedDataset === 'attendances' ? 'Log Presensi' : selectedDataset === 'employees' ? 'Master Karyawan' : 'Master Proyek';
      XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

      const nowStr = new Date().toISOString().split('T')[0];
      const filename = `DMJ_HRIS_${selectedDataset.toUpperCase()}_${startDate ? `${startDate}_sd_${endDate}` : nowStr}.xlsx`;
      XLSX.writeFile(wb, filename);

      if (showToast) showToast(`Berhasil mengunduh ${cleanRows.length} data ke Excel`, 'success');
    } catch (err: any) {
      alert(err.message || 'Gagal mengekspor data ke Excel');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Excel File Selection & Parse
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processSelectedFile(file);
  };

  // Helper to extract values by multiple possible column aliases (case and whitespace-insensitive)
  const getVal = (row: any, aliases: string[]) => {
    if (!row || typeof row !== 'object') return null;
    for (const k of Object.keys(row)) {
      const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const a of aliases) {
        if (cleanK === a.toLowerCase().replace(/[^a-z0-9]/g, '')) {
          const v = row[k];
          if (v !== undefined && v !== null && String(v).trim() !== '') return v;
        }
      }
    }
    return null;
  };

  const processSelectedFile = (file: File) => {
    setImportFile(file);
    setImportResult(null);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false });
        // Filter out completely blank rows
        const rows = rawRows.filter(r => Object.values(r).some(v => v !== null && v !== undefined && String(v).trim() !== ''));

        if (!rows || rows.length === 0) {
          alert('File Excel kosong atau tidak memiliki baris data.');
          setParsedRows([]);
          setPreviewAnalysis(null);
          setIsParsing(false);
          return;
        }

        // Fast client-side analysis
        let toUpdate = 0;
        let toInsert = 0;
        let unknownEmployees = 0;
        const warnings: string[] = [];

        // Build fast employee map
        const empByLogin = new Set(employees.map(e => e.loginId?.toLowerCase()).filter(Boolean));
        const empByNik = new Set(employees.map(e => String(e.nik).trim()).filter(Boolean));
        const empByNikDigits = new Set(employees.map(e => String(e.nik || '').replace(/\D/g, '').replace(/^0+/, '')).filter(Boolean));
        const empByName = new Set(employees.map(e => e.name.toLowerCase().trim()).filter(Boolean));

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const hasId = Boolean(getVal(r, ['id absensi', 'id', 'attendance id']));
          const login = String(getVal(r, ['id login', 'login id', 'username', 'login']) || '').toLowerCase().trim();
          const nik = String(getVal(r, ['nik', 'no nik']) || '').trim();
          const nikDigits = nik.replace(/\D/g, '').replace(/^0+/, '');
          const name = String(getVal(r, ['nama karyawan', 'nama', 'name', 'nama lengkap']) || '').toLowerCase().trim();

          const isKnown = (login && empByLogin.has(login)) || 
                          (nik && empByNik.has(nik)) || 
                          (nikDigits && empByNikDigits.has(nikDigits)) || 
                          (name && empByName.has(name));
          if (!isKnown && (login || nik || name)) {
            unknownEmployees++;
            if (warnings.length < 5) {
              warnings.push(`Baris ${i + 2}: Karyawan (${login || nik || name}) tidak ditemukan di Master Data`);
            }
          }

          if (hasId) {
            toUpdate++;
          } else {
            toInsert++;
          }
        }

        setParsedRows(rows);
        setPreviewAnalysis({
          total: rows.length,
          toUpdate: importMode === 'replace' ? toUpdate : 0,
          toInsert: importMode === 'replace' ? toInsert : rows.length,
          toSkip: importMode === 'add' ? toUpdate : 0,
          unknownEmployees,
          warnings
        });
      } catch (err: any) {
        alert('Gagal membaca file Excel. Pastikan format file adalah .xlsx atau .xls yang valid.');
        console.error(err);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Re-run analysis when mode toggles
  useEffect(() => {
    if (parsedRows.length > 0 && previewAnalysis) {
      let toUpdate = 0;
      let toInsert = 0;
      for (const r of parsedRows) {
        const hasId = Boolean(getVal(r, ['id absensi', 'id', 'attendance id']));
        if (hasId) toUpdate++;
        else toInsert++;
      }
      setPreviewAnalysis(prev => prev ? {
        ...prev,
        toUpdate: importMode === 'replace' ? toUpdate : 0,
        toInsert: importMode === 'replace' ? toInsert : (toInsert),
        toSkip: importMode === 'add' ? toUpdate : 0
      } : null);
    }
  }, [importMode]);

  // Execute Import
  const handleExecuteImport = async () => {
    if (!parsedRows || parsedRows.length === 0) return;

    const confirmMsg = importMode === 'replace'
      ? `Anda akan memperbarui database dengan ${parsedRows.length} baris data dari Excel (Mode Replace). Lanjutkan?`
      : `Anda akan menambahkan data baru dari ${parsedRows.length} baris data Excel (Mode Add - Data lama tidak ditimpa). Lanjutkan?`;

    if (!window.confirm(confirmMsg)) return;

    setIsSubmittingImport(true);
    try {
      const res = await api.importDatabaseBatch({
        table: 'attendances',
        mode: importMode,
        rows: parsedRows
      });

      if (res.success) {
        setImportResult(res.summary);
        if (showToast) {
          showToast(`Sinkronisasi Berhasil! ${res.summary.updated} diperbarui, ${res.summary.inserted} ditambahkan.`, 'success');
        }
        await fetchStats();
        if (onRefreshData) onRefreshData();
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan data ke database');
    } finally {
      setIsSubmittingImport(false);
    }
  };

  const handleResetImport = () => {
    setImportFile(null);
    setParsedRows([]);
    setPreviewAnalysis(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!canAccess) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white/90 backdrop-blur-md rounded-3xl border border-rose-200/80 shadow-xl text-center space-y-4 animate-in fade-in duration-300">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Akses Terbatas</h3>
          <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
            Pusat Database & Sinkronisasi Excel hanya dapat diakses oleh <strong>HR Manager</strong>, <strong>Finance</strong>, dan <strong>Superuser</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      
      {/* HEADER SECTION */}
      <div className="bg-white/85 backdrop-blur-md border border-slate-200/80 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF6B00] to-[#FF8533] text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Pusat Database & Sinkronisasi Excel
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 border border-orange-200 font-mono-code">
                  v2026 Enterprise
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Unduh rekaman sistem ke lembar kerja Microsoft Excel, lakukan penyesuaian atau pengeditan data secara fleksibel, lalu impor kembali ke sistem dengan aman tanpa risiko kehilangan foto atau histori audit.
              </p>
            </div>
          </div>

          {/* Quick Actions (Backup & Vacuum) */}
          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              onClick={handleVacuumDatabase}
              disabled={isVacuuming}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Padatkan database SQLite (buang sisa ruang freelist bekas delete)"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isVacuuming ? 'animate-spin' : ''}`} />
              <span>{isVacuuming ? 'Mengoptimalkan...' : 'Vacuum DB'}</span>
            </button>

            <a
              href={api.getDownloadDbUrl()}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition-all flex items-center gap-2"
              title="Unduh backup database mentah SQLite (.sqlite)"
            >
              <HardDrive className="w-3.5 h-3.5 text-orange-400" />
              <span>Backup .sqlite</span>
            </a>
          </div>
        </div>

        {/* Telemetry Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
          <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold text-slate-500">Ukuran Database</span>
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-lg font-black text-slate-800 mt-1 font-mono-code">
              {stats?.sizeKb ? `${stats.sizeKb.toLocaleString('id-ID')} KB` : '...'}
            </p>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
              <Check className="w-2.5 h-2.5" /> WAL Mode Aktif
            </span>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold text-slate-500">Log Presensi</span>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-lg font-black text-orange-600 mt-1 font-mono-code">
              {stats?.attendancesCount ?? '...'} <span className="text-xs font-normal text-slate-500">rekaman</span>
            </p>
            <span className="text-[10px] text-slate-400">Tersedia untuk export</span>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold text-slate-500">Master Karyawan</span>
              <Users className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-lg font-black text-slate-800 mt-1 font-mono-code">
              {stats?.employeesCount ?? employees.length} <span className="text-xs font-normal text-slate-500">staf</span>
            </p>
            <span className="text-[10px] text-slate-400">Tercatat di sistem</span>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold text-slate-500">Master Proyek</span>
              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-lg font-black text-slate-800 mt-1 font-mono-code">
              {stats?.projectsCount ?? projects.length} <span className="text-xs font-normal text-slate-500">proyek</span>
            </p>
            <span className="text-[10px] text-slate-400">Aktif & operasional</span>
          </div>
        </div>
      </div>

      {/* 2-COLUMN MAIN INTERFACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: EXPORT DATABASE TO EXCEL */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white/85 backdrop-blur-md border border-slate-200/80 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#FF6B00] flex items-center justify-center font-black text-xs font-mono-code">
                1
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 leading-tight">
                  Unduh Data ke Excel
                </h2>
                <p className="text-xs text-slate-500">
                  Filter rentang tanggal & unduh data format .xlsx
                </p>
              </div>
            </div>

            {/* Dataset Selector Tabs */}
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Pilih Tabel / Dataset:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDataset('attendances')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                    selectedDataset === 'attendances'
                      ? 'bg-orange-50 border-orange-400 text-orange-700 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Log Presensi
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDataset('employees')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                    selectedDataset === 'employees'
                      ? 'bg-orange-50 border-orange-400 text-orange-700 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Data Karyawan
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDataset('projects')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                    selectedDataset === 'projects'
                      ? 'bg-orange-50 border-orange-400 text-orange-700 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Data Proyek
                </button>
              </div>
            </div>

            {/* Financial Privacy Notice for Employee Dataset */}
            {selectedDataset === 'employees' && (
              <div className="pt-3 border-t border-slate-100">
                {!isFinanceOrSuper ? (
                  <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-950 text-xs">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-900 leading-tight">Perlindungan Kerahasiaan Finansial (RBAC):</p>
                        <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                          Sesuai kebijakan tata kelola sistem, kolom <strong>Gaji Pokok, Tunjangan Tetap, Tunjangan Harian & Rekening Bank</strong> secara otomatis <strong>disembunyikan</strong> untuk akun HR. Data gaji hanya berwenang diakses, diunduh, dan dikelola oleh tim <strong>Finance</strong> dan <strong>Superuser</strong>.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-950 text-xs flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-[11px] font-semibold text-emerald-900">
                      Otorisasi Finansial Aktif: Data Gaji Pokok, Tunjangan & Rekening Bank akan disertakan dalam file Excel.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Date Range Filter (Visible for Attendances) */}
            {selectedDataset === 'attendances' && (
              <div className="space-y-4 pt-3 border-t border-slate-100">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-orange-500" /> Rentang Tanggal Presensi:
                    </label>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <button
                      type="button"
                      onClick={() => handlePresetDate('today')}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetDate('7days')}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                    >
                      7 Hari Terakhir
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetDate('thisMonth')}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-200 transition-all cursor-pointer"
                    >
                      Bulan Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetDate('lastMonth')}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                    >
                      Bulan Lalu
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetDate('all')}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                    >
                      Semua Data
                    </button>
                  </div>

                  {/* Start & End Inputs */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-1">Tanggal Mulai:</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-1">Tanggal Akhir:</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Optional Filters: Project & Dept */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-600 block mb-1">Filter Proyek:</label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-orange-500 truncate"
                    >
                      <option value="ALL">Semua Proyek</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10.5px] font-bold text-slate-600 block mb-1">Filter Departemen:</label>
                    <select
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-orange-500 truncate"
                      title="Filter Departemen Asli"
                    >
                      <option value="ALL">Semua Departemen</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Export Buttons */}
            <div className="mt-5 space-y-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleExportExcel(false)}
                disabled={isExporting}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#FF6B00] to-[#FF8533] hover:from-[#e56000] hover:to-[#f07b2b] text-white text-xs sm:text-sm font-black shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'Mengekspor ke Excel...' : 'Unduh Data Terpilih (.xlsx)'}</span>
              </button>

              {selectedDataset === 'attendances' && (
                <button
                  type="button"
                  onClick={() => handleExportExcel(true)}
                  disabled={isExporting}
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200/80 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Unduh Format Kosong (Template Baru)</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Layperson Tips Card */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-3xl p-5 text-emerald-950">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-emerald-600 shrink-0" />
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-800">
                Panduan Praktis untuk Pengguna
              </h3>
            </div>
            <ul className="text-xs text-emerald-900/90 space-y-2 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="font-black text-emerald-700 shrink-0">•</span>
                <span><strong>Edit Data:</strong> Anda dapat mengoreksi jam masuk/pulang, status kehadiran, atau catatan langsung di Microsoft Excel.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-black text-emerald-700 shrink-0">•</span>
                <span><strong>Jangan Ubah Kolom ID:</strong> Kolom <code>ID Absensi</code> berfungsi sebagai kunci unik. Jangan ubah ID jika ingin memperbarui data lama.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-black text-emerald-700 shrink-0">•</span>
                <span><strong>Foto Tetap Aman:</strong> Fotonya tidak akan hilang atau nyangkut. Foto selfie yang sudah tersimpan di database tetap utuh saat Anda mengedit jam di Excel.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* RIGHT COLUMN: IMPORT & RE-SYNC TO DATABASE */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white/85 backdrop-blur-md border border-slate-200/80 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs font-mono-code">
                  2
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 leading-tight">
                    Unggah & Perbarui Database
                  </h2>
                  <p className="text-xs text-slate-500">
                    Impor kembali file Excel hasil editan ke dalam sistem
                  </p>
                </div>
              </div>

              {importFile && (
                <button
                  type="button"
                  onClick={handleResetImport}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Ganti File
                </button>
              )}
            </div>

            {/* Mode Selection Cards */}
            <div className="mb-5">
              <label className="text-xs font-bold text-slate-700 block mb-2">
                Pilih Mode Sinkronisasi:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Mode REPLACE */}
                <div
                  onClick={() => setImportMode('replace')}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                    importMode === 'replace'
                      ? 'border-orange-500 bg-orange-50/50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <RefreshCw className={`w-3.5 h-3.5 ${importMode === 'replace' ? 'text-orange-600' : 'text-slate-400'}`} />
                      Mode PERBARUI (Replace)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 font-mono-code">
                      Rekomendasi
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Menimpa data lama yang cocok (jam, status, catatan) dan tetap menambahkan baris baru jika ada. Sangat cocok untuk mengoreksi data.
                  </p>
                </div>

                {/* Mode ADD */}
                <div
                  onClick={() => setImportMode('add')}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                    importMode === 'add'
                      ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <FileUp className={`w-3.5 h-3.5 ${importMode === 'add' ? 'text-blue-600' : 'text-slate-400'}`} />
                      Mode TAMBAH SAJA (Add)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Hanya menambahkan rekaman baru yang belum pernah tercatat. Data lama yang sudah ada dijamin tidak akan diubah atau ditimpa.
                  </p>
                </div>
              </div>
            </div>

            {/* Dropzone Area (Shown if no file or parsing) */}
            {!importFile ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropFile}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-orange-500 rounded-3xl p-8 text-center bg-slate-50/50 hover:bg-orange-50/20 transition-all cursor-pointer group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  Tarik file Excel ke sini, atau klik untuk memilih
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Mendukung file Microsoft Excel (.xlsx, .xls) dan CSV
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* File Info Bar */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 truncate max-w-xs sm:max-w-md">
                        {importFile.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Ukuran: {(importFile.size / 1024).toFixed(1)} KB • {parsedRows.length} baris data terdeteksi
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Siap Diperiksa
                  </span>
                </div>

                {/* Pre-flight Analysis Badges */}
                {previewAnalysis && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200 text-center">
                      <span className="text-[10px] font-bold text-slate-500 block">Total Baris</span>
                      <p className="text-base font-black text-slate-800 font-mono-code">{previewAnalysis.total}</p>
                    </div>

                    <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 text-center">
                      <span className="text-[10px] font-bold text-orange-700 block">Akan Diperbarui</span>
                      <p className="text-base font-black text-orange-600 font-mono-code">{previewAnalysis.toUpdate}</p>
                    </div>

                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                      <span className="text-[10px] font-bold text-emerald-700 block">Akan Ditambahkan</span>
                      <p className="text-base font-black text-emerald-600 font-mono-code">{previewAnalysis.toInsert}</p>
                    </div>

                    <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-center">
                      <span className="text-[10px] font-bold text-blue-700 block">Akan Dilewati</span>
                      <p className="text-base font-black text-blue-600 font-mono-code">{previewAnalysis.toSkip}</p>
                    </div>
                  </div>
                )}

                {/* Warnings / Unknown Check */}
                {previewAnalysis && previewAnalysis.warnings.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    <div className="flex items-center gap-1.5 font-bold mb-1 text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Perhatian ({previewAnalysis.unknownEmployees} Baris Tidak Dikenali):</span>
                    </div>
                    <ul className="space-y-0.5 list-disc list-inside text-[11px] text-amber-800">
                      {previewAnalysis.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Preview Table (First 5 Rows) */}
                {parsedRows.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700">
                        Pratinjau Data (Menampilkan {Math.min(5, parsedRows.length)} dari {parsedRows.length} baris):
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white max-h-56">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 text-[11px] font-bold border-b border-slate-200 sticky top-0">
                          <tr>
                            <th className="py-2 px-3">Tanggal</th>
                            <th className="py-2 px-3">Login ID</th>
                            <th className="py-2 px-3">Nama Karyawan</th>
                            <th className="py-2 px-3">Masuk</th>
                            <th className="py-2 px-3">Pulang</th>
                            <th className="py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-mono-code text-[11px]">
                          {parsedRows.slice(0, 5).map((r, idx) => {
                            const dateVal = getVal(r, ['tanggal', 'date', 'tgl']) || '-';
                            const loginVal = getVal(r, ['id login', 'login id', 'username', 'login']) || '-';
                            const nameVal = getVal(r, ['nama karyawan', 'nama', 'name', 'nama lengkap']) || '-';
                            const inVal = getVal(r, ['jam masuk', 'absen masuk', 'masuk', 'check in', 'in']) || '-';
                            const outVal = getVal(r, ['jam pulang', 'absen pulang', 'pulang', 'check out', 'out']) || '-';
                            const statusVal = getVal(r, ['status kehadiran', 'status']) || 'ON_TIME';

                            return (
                              <tr key={idx} className="hover:bg-slate-50/70">
                                <td className="py-2 px-3 whitespace-nowrap">{dateVal}</td>
                                <td className="py-2 px-3 whitespace-nowrap font-bold text-orange-600">{loginVal}</td>
                                <td className="py-2 px-3 font-sans font-semibold text-slate-900 whitespace-nowrap">{nameVal}</td>
                                <td className="py-2 px-3 whitespace-nowrap">{inVal}</td>
                                <td className="py-2 px-3 whitespace-nowrap">{outVal}</td>
                                <td className="py-2 px-3 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    statusVal === 'LATE'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {statusVal}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Confirm Import Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isSubmittingImport || parsedRows.length === 0}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs sm:text-sm font-black shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className={`w-4 h-4 ${isSubmittingImport ? 'animate-spin' : ''}`} />
                    <span>
                      {isSubmittingImport
                        ? 'Menyimpan & Menyinkronkan ke Database...'
                        : `Konfirmasi & Simpan ke Database (${parsedRows.length} Baris)`}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Success Summary Notification Card */}
            {importResult && (
              <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 font-black text-sm text-emerald-800 mb-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Sinkronisasi Database Berhasil!</span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Total <strong>{importResult.total}</strong> baris data Excel telah berhasil diproses:
                  <br />
                  • <strong>{importResult.updated}</strong> rekaman diperbarui (Update)
                  <br />
                  • <strong>{importResult.inserted}</strong> rekaman baru ditambahkan (Insert)
                  <br />
                  • <strong>{importResult.skipped}</strong> rekaman dilewati (Skip)
                  {importResult.errorsCount > 0 && (
                    <>
                      <br />
                      • <span className="text-rose-600 font-bold">{importResult.errorsCount} baris diabaikan karena error</span>
                    </>
                  )}
                </p>
                <div className="mt-3 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={handleResetImport}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all cursor-pointer"
                  >
                    Selesai & Tutup
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
