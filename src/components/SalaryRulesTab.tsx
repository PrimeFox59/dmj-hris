import React, { useState, useEffect } from 'react';
import {
  Sliders,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldCheck,
  MapPin,
  DollarSign,
  Calculator,
  Save,
  Plus,
  Trash2,
  Lock,
  ShieldAlert,
  Eye,
  EyeOff,
  MessageSquare,
  Send,
  Smartphone,
  RefreshCw,
  Bell,
  QrCode,
  LogOut,
  Check,
  Mail,
  Key,
  Info,
  ExternalLink,
  Zap,
  Calendar
} from 'lucide-react';
import {
  SalaryRuleConfig,
  Employee,
  SystemRole,
  getEffectiveSystemRole,
  WhatsAppConfig,
  WaNotificationLog,
  WaOptInRecord,
  SmtpConfig,
  EmailNotificationLog
} from '../types';
import { formatSalaryDisplay } from '../utils/payrollCalculator';
import { api } from '../services/api';

interface SalaryRulesTabProps {
  currentUser?: Employee;
  employees?: Employee[];
  salaryRules: SalaryRuleConfig;
  onUpdateSalaryRules: (rules: SalaryRuleConfig) => void;
  initialFocusSection?: 'whatsapp' | 'email' | 'rules';
}

export const SalaryRulesTab: React.FC<SalaryRulesTabProps> = ({
  currentUser,
  employees = [],
  salaryRules,
  onUpdateSalaryRules,
  initialFocusSection = 'whatsapp'
}) => {
  const currentRole: SystemRole = getEffectiveSystemRole(currentUser);
  const isSuperuser = ['superuser', 'admin', 'hr', 'finance'].includes(currentRole);

  const [activeSubTab, setActiveSubTab] = useState<'whatsapp' | 'email' | 'rules'>(initialFocusSection || 'whatsapp');

  useEffect(() => {
    if (initialFocusSection) {
      setActiveSubTab(initialFocusSection);
    }
  }, [initialFocusSection]);

  const [config, setConfig] = useState<SalaryRuleConfig>(salaryRules);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [waSaveSuccess, setWaSaveSuccess] = useState(false);
  const [showSimulationNominal, setShowSimulationNominal] = useState<boolean>(false);

  // Live Simulator State
  const [simBase, setSimBase] = useState(12000000);
  const [simPresentDays, setSimPresentDays] = useState(21);
  const [simLateMinutes, setSimLateMinutes] = useState(30);
  const [simLateApproved, setSimLateApproved] = useState(false);
  const [simOtHours, setSimOtHours] = useState(14);
  const [simIsRemote, setSimIsRemote] = useState(true);

  // WhatsApp Baileys Gateway & Logs State
  // WhatsApp Mandatory Opt-In Verified Contacts State
  const [waOptIns, setWaOptIns] = useState<WaOptInRecord[]>([]);
  const [loadingWaOptIns, setLoadingWaOptIns] = useState(false);

  const fetchWaOptIns = async () => {
    setLoadingWaOptIns(true);
    try {
      const res = await api.getWaOptIns();
      if (res.success && Array.isArray(res.optIns)) {
        setWaOptIns(res.optIns);
      }
    } catch (e) {
      console.warn('Gagal memuat opt-in WA:', e);
    } finally {
      setLoadingWaOptIns(false);
    }
  };

  const [waStatus, setWaStatus] = useState<{
    online: boolean;
    clientInfo?: { pushname?: string; phone?: string } | null;
    clientState?: string;
    hasQr?: boolean;
    qrDataUrl?: string | null;
  } | null>(null);
  const [loadingWaStatus, setLoadingWaStatus] = useState(false);
  const [waLogs, setWaLogs] = useState<WaNotificationLog[]>([]);
  const [waStartDate, setWaStartDate] = useState<string>('');
  const [waEndDate, setWaEndDate] = useState<string>('');
  const [waDatePreset, setWaDatePreset] = useState<'ALL' | 'TODAY' | 'LAST_7' | 'THIS_MONTH'>('ALL');
  const [waDisplayLimit, setWaDisplayLimit] = useState(10);

  const applyWaPreset = (preset: 'ALL' | 'TODAY' | 'LAST_7' | 'THIS_MONTH') => {
    setWaDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (preset === 'ALL') {
      setWaStartDate('');
      setWaEndDate('');
    } else if (preset === 'TODAY') {
      setWaStartDate(todayStr);
      setWaEndDate(todayStr);
    } else if (preset === 'LAST_7') {
      const d = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      setWaStartDate(d.toISOString().slice(0, 10));
      setWaEndDate(todayStr);
    } else if (preset === 'THIS_MONTH') {
      const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      setWaStartDate(startStr);
      setWaEndDate(todayStr);
    }
  };

  const filteredWaLogs = React.useMemo(() => {
    return waLogs.filter(log => {
      const d = log.sentAt ? log.sentAt.slice(0, 10) : '';
      if (waStartDate && d && d < waStartDate) return false;
      if (waEndDate && d && d > waEndDate) return false;
      return true;
    });
  }, [waLogs, waStartDate, waEndDate]);

  const visibleWaLogs = React.useMemo(() => filteredWaLogs.slice(0, waDisplayLimit), [filteredWaLogs, waDisplayLimit]);
  const hasMoreWaLogs = waDisplayLimit < filteredWaLogs.length;

  const [loadingWaLogs, setLoadingWaLogs] = useState(false);
  const [restartingWa, setRestartingWa] = useState(false);
  const [loggingOutWa, setLoggingOutWa] = useState(false);

  // Test Message Modal State
  const [showTestModal, setShowTestModal] = useState(false);
  const [testSelectedEmpId, setTestSelectedEmpId] = useState<string>(currentUser?.id || 'EMP-001');
  const [testPhone, setTestPhone] = useState(currentUser?.phone || '6289524257778');
  const [testMessage, setTestMessage] = useState('Halo! Ini adalah pesan uji coba integrasi WhatsApp Baileys dari sistem PRIME HRIS.');
  const [sendingTest, setSendingTest] = useState(false);
  const [testForceBypass, setTestForceBypass] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Manual Blast State
  const [blasting, setBlasting] = useState(false);
  const [blastResult, setBlastResult] = useState<{
    totalTargeted: number;
    sentCount: number;
    failedCount: number;
  } | null>(null);

  // Email SMTP Gmail State
  const [emailStatus, setEmailStatus] = useState<{
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    user: string;
    fromName: string;
    fromEmail: string;
    verified: boolean;
    statusMessage?: string;
  } | null>(null);
  const [loadingEmailStatus, setLoadingEmailStatus] = useState(false);
  const [emailLogs, setEmailLogs] = useState<EmailNotificationLog[]>([]);
  const [emailStartDate, setEmailStartDate] = useState<string>('');
  const [emailEndDate, setEmailEndDate] = useState<string>('');
  const [emailDatePreset, setEmailDatePreset] = useState<'ALL' | 'TODAY' | 'LAST_7' | 'THIS_MONTH'>('ALL');
  const [emailDisplayLimit, setEmailDisplayLimit] = useState(10);

  const applyEmailPreset = (preset: 'ALL' | 'TODAY' | 'LAST_7' | 'THIS_MONTH') => {
    setEmailDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (preset === 'ALL') {
      setEmailStartDate('');
      setEmailEndDate('');
    } else if (preset === 'TODAY') {
      setEmailStartDate(todayStr);
      setEmailEndDate(todayStr);
    } else if (preset === 'LAST_7') {
      const d = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      setEmailStartDate(d.toISOString().slice(0, 10));
      setEmailEndDate(todayStr);
    } else if (preset === 'THIS_MONTH') {
      const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      setEmailStartDate(startStr);
      setEmailEndDate(todayStr);
    }
  };

  const filteredEmailLogs = React.useMemo(() => {
    return emailLogs.filter(log => {
      const d = log.sent_at ? log.sent_at.slice(0, 10) : '';
      if (emailStartDate && d && d < emailStartDate) return false;
      if (emailEndDate && d && d > emailEndDate) return false;
      return true;
    });
  }, [emailLogs, emailStartDate, emailEndDate]);

  const visibleEmailLogs = React.useMemo(() => filteredEmailLogs.slice(0, emailDisplayLimit), [filteredEmailLogs, emailDisplayLimit]);
  const hasMoreEmailLogs = emailDisplayLimit < filteredEmailLogs.length;
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);
  const [emailSaveSuccess, setEmailSaveSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Verifying SMTP credentials
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [emailVerifyResult, setEmailVerifyResult] = useState<{ success: boolean; message: string } | null>(null);

  // Test Email Modal
  const [showEmailTestModal, setShowEmailTestModal] = useState(false);
  const [testEmailSelectedEmpId, setTestEmailSelectedEmpId] = useState<string>(currentUser?.id || 'EMP-001');
  const [testEmailRecipient, setTestEmailRecipient] = useState(currentUser?.email || 'primetroyxs@gmail.com');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  // Blast Email State
  const [blastingEmail, setBlastingEmail] = useState(false);
  const [blastEmailResult, setBlastEmailResult] = useState<{
    totalTargeted: number;
    sentCount: number;
    failedCount: number;
  } | null>(null);

  const fetchWaStatus = async () => {
    setLoadingWaStatus(true);
    try {
      const res = await api.getWaStatus();
      setWaStatus({
        online: Boolean(res.online),
        clientInfo: res.clientInfo,
        clientState: res.clientState,
        hasQr: Boolean(res.hasQr),
        qrDataUrl: res.qrDataUrl
      });
    } catch (e) {
      setWaStatus({ online: false, clientState: 'error' });
    } finally {
      setLoadingWaStatus(false);
    }
  };

  const fetchWaLogs = async () => {
    setLoadingWaLogs(true);
    try {
      const res = await api.getWaLogs(15);
      if (res.success) {
        setWaLogs(res.logs || []);
      }
    } catch (e) {
      console.warn('Failed to fetch WA logs:', e);
    } finally {
      setLoadingWaLogs(false);
    }
  };

  const fetchEmailStatus = async () => {
    setLoadingEmailStatus(true);
    try {
      const res = await api.getEmailStatus();
      if (res.success) {
        setEmailStatus(res);
      }
    } catch (e) {
      console.warn('Failed to fetch email status:', e);
    } finally {
      setLoadingEmailStatus(false);
    }
  };

  const fetchEmailLogs = async () => {
    setLoadingEmailLogs(true);
    try {
      const res = await api.getEmailLogs(15);
      if (res.success) {
        setEmailLogs(res.logs || []);
      }
    } catch (e) {
      console.warn('Failed to fetch email logs:', e);
    } finally {
      setLoadingEmailLogs(false);
    }
  };

  useEffect(() => {
    fetchWaStatus();
    fetchWaLogs();
    fetchWaOptIns();
    fetchEmailStatus();
    fetchEmailLogs();

    // Auto-poll status every 4 seconds to instantly detect when QR is scanned by phone
    const interval = setInterval(() => {
      fetchWaStatus();
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleVerifySmtp = async () => {
    setVerifyingEmail(true);
    setEmailVerifyResult(null);
    try {
      const res = await api.verifySmtp(config.smtpConfig || {});
      setEmailVerifyResult({
        success: Boolean(res.success),
        message: res.message || res.error || (res.success ? 'Kredensial SMTP Gmail berhasil diverifikasi!' : 'Verifikasi SMTP gagal')
      });
      fetchEmailStatus();
    } catch (err: any) {
      setEmailVerifyResult({
        success: false,
        message: err.message || 'Gagal menghubungi endpoint verifikasi SMTP'
      });
    } finally {
      setVerifyingEmail(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailRecipient) return;
    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await api.sendTestEmail(testEmailRecipient, config.smtpConfig);
      setTestEmailResult({
        success: Boolean(res.success),
        message: res.success ? `Email uji coba berhasil dikirim ke ${testEmailRecipient}!` : (res.error || 'Gagal mengirim email uji coba')
      });
      fetchEmailLogs();
    } catch (err: any) {
      setTestEmailResult({
        success: false,
        message: err.message || 'Gagal mengirim email uji coba'
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleBlastEmail = async () => {
    if (!confirm('Kirim notifikasi email pengingat presensi ke seluruh karyawan aktif yang belum absen hari ini?')) {
      return;
    }
    setBlastingEmail(true);
    setBlastEmailResult(null);
    try {
      const res = await api.blastUnrecordedEmail();
      if (res.success) {
        setBlastEmailResult({
          totalTargeted: res.totalTargeted,
          sentCount: res.sentCount,
          failedCount: res.failedCount
        });
        fetchEmailLogs();
      }
    } catch (err: any) {
      alert(`Gagal blast email: ${err.message}`);
    } finally {
      setBlastingEmail(false);
    }
  };

  const handleSaveEmailConfig = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onUpdateSalaryRules(config);
    setEmailSaveSuccess(true);
    fetchEmailStatus();
    setTimeout(() => setEmailSaveSuccess(false), 3000);
  };

  const applyGmailPreset = () => {
    setConfig(prev => ({
      ...prev,
      smtpConfig: {
        ...(prev.smtpConfig || {}),
        enabled: true,
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        fromName: prev.smtpConfig?.fromName || 'PRIME HRIS Enterprise',
        fromEmail: prev.smtpConfig?.fromEmail || prev.smtpConfig?.user || '',
        user: prev.smtpConfig?.user || '',
        pass: prev.smtpConfig?.pass || '',
        notifyAttendanceSuccess: prev.smtpConfig?.notifyAttendanceSuccess ?? true,
        notifyAttendanceLate: prev.smtpConfig?.notifyAttendanceLate ?? true,
        notifyApprovalSubmitted: prev.smtpConfig?.notifyApprovalSubmitted ?? true,
        notifyApprovalUpdates: prev.smtpConfig?.notifyApprovalUpdates ?? true,
        notifyMorningReminder: prev.smtpConfig?.notifyMorningReminder ?? false,
        morningReminderTime: prev.smtpConfig?.morningReminderTime || '07:30'
      }
    }));
  };

  const handleRestartWa = async () => {
    setRestartingWa(true);
    try {
      await api.restartWaGateway();
      setTimeout(fetchWaStatus, 1500);
    } catch (e: any) {
      alert(`Gagal me-restart gateway: ${e.message}`);
    } finally {
      setRestartingWa(false);
    }
  };

  const handleLogoutWa = async () => {
    if (!confirm('Putuskan koneksi bot WhatsApp PRIME HRIS? Anda dapat menautkan nomor bot baru setelahnya.')) {
      return;
    }
    setLoggingOutWa(true);
    try {
      await api.logoutWaGateway();
      setTimeout(fetchWaStatus, 1500);
    } catch (e: any) {
      alert(`Gagal logout: ${e.message}`);
    } finally {
      setLoggingOutWa(false);
    }
  };

  const updateWaConfig = (updates: Partial<WhatsAppConfig>) => {
    const current = config.whatsappConfig || {
      enabled: true,
      gatewayUrl: 'http://127.0.0.1:9008',
      senderPhone: '6289524257778',
      notifyAttendanceSuccess: true,
      notifyAttendanceLate: true,
      notifyMorningReminder: true,
      morningReminderTime: '07:30',
      notifyApproachingCutoff: true,
      approachingCutoffMinutesBefore: 15,
      notifyApprovalUpdates: true
    };
    const nextConfig = {
      ...config,
      whatsappConfig: {
        ...current,
        ...updates
      }
    };
    setConfig(nextConfig);
    onUpdateSalaryRules(nextConfig);
    setWaSaveSuccess(true);
    setTimeout(() => setWaSaveSuccess(false), 2500);
  };

  const handleSendTestWa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) return;
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await api.sendTestWa(testPhone, testMessage, testForceBypass);
      if (res.success) {
        setTestResult({ success: true, msg: 'Pesan berhasil terkirim ke nomor target!' });
        fetchWaLogs();
      } else {
        setTestResult({ success: false, msg: res.error || 'Gagal mengirim pesan.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, msg: err.message || 'Kesalahan jaringan.' });
    } finally {
      setSendingTest(false);
    }
  };

  const handleBlastUnrecorded = async () => {
    if (!confirm('Kirim blast peringatan WhatsApp sekarang ke seluruh karyawan aktif yang belum check-in hari ini?')) {
      return;
    }
    setBlasting(true);
    setBlastResult(null);
    try {
      const res = await api.blastUnrecordedWa();
      if (res.success) {
        setBlastResult({
          totalTargeted: res.totalTargeted,
          sentCount: res.sentCount,
          failedCount: res.failedCount
        });
        fetchWaLogs();
      }
    } catch (e: any) {
      alert(`Gagal blast: ${e.message}`);
    } finally {
      setBlasting(false);
    }
  };

  // Handle Save
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperuser) return;
    onUpdateSalaryRules(config);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Staff Access Lock Screen
  if (currentRole === 'staff') {
    return (
      <div className="glass-card rounded-3xl p-10 sm:p-14 text-center max-w-lg mx-auto my-12 border border-rose-200 bg-rose-50/30 motion-fade-in-up">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <div className="inline-block px-3 py-1 rounded-full bg-rose-100 text-rose-700 font-mono-code font-bold text-[10px] tracking-wider uppercase mb-3">
          AKSES DITOLAK • RESTRICTED MODULE
        </div>
        <h2 className="text-xl font-black text-slate-900 font-mono-code mb-2">
          Area Khusus Manajemen & Direksi
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed mb-6">
          Modul konfigurasi bot WhatsApp, aturan gaji, persentase BPJS, dan registry IP Gateway kantor hanya dapat diakses oleh level <b>Superuser (Direksi)</b>, <b>Finance</b>, dan <b>HR</b>.
        </p>
        <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200 text-left flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Pengguna Saat Ini</p>
            <p className="text-xs font-bold text-slate-800">{currentUser?.name || 'Staff'}</p>
          </div>
          <span className="text-[10px] font-mono-code font-bold uppercase px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            Role: STAFF BIASA
          </span>
        </div>
      </div>
    );
  }

  // Live calculation based on current config and sim values
  const simHourlyRate = Math.round(simBase / config.overtimeFormula.hourlyRateDivisor);
  const simOtPay = Math.round(simOtHours * config.overtimeFormula.subsequentHourRateMultiplier * simHourlyRate);
  const simDailyTotal = simPresentDays * config.defaultDailyAllowance;
  const simRemoteAllowance = simIsRemote ? config.remoteProjectAllowance : 0;
  
  // Late deduction
  let simLateDeduction = 0;
  if (!simLateApproved && simLateMinutes > config.lateGracePeriodMinutes) {
    const blocks = Math.ceil((simLateMinutes - config.lateGracePeriodMinutes) / 15);
    simLateDeduction = blocks * config.latePenaltyPerBlock;
  }

  const simGross = simBase + simDailyTotal + simRemoteAllowance;
  const simBpjsTk = Math.round(simBase * config.bpjsKetenagakerjaanRate);
  const simBpjsKes = Math.round(simBase * config.bpjsKesehatanRate);
  const simTotalDeduct = simLateDeduction + simBpjsTk + simBpjsKes;
  const simTakeHomePay = simGross - simTotalDeduct;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Banner */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 motion-fade-in-down">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`prime-cut-corner text-white text-[10px] font-black px-2.5 py-0.5 tracking-wider uppercase font-mono-code ${
              activeSubTab === 'whatsapp' ? 'bg-emerald-600' : 'bg-[#18345E]'
            }`}>
              {activeSubTab === 'whatsapp' ? 'WHATSAPP BOT GATEWAY' : 'EMAIL GMAIL SMTP SUITE'}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {activeSubTab === 'whatsapp'
                ? 'Port 9008 Mandiri • Sesi Terisolasi .prime_wa_auth'
                : 'Google Mail SMTP (SSL 465 / TLS 587) • Nodemailer Engine'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {activeSubTab === 'whatsapp'
              ? 'Setting System: WhatsApp Bot & QR Gateway'
              : 'Setting System: Email Gmail SMTP & Notifikasi'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            {activeSubTab === 'whatsapp'
              ? 'Tautkan nomor WhatsApp bot resmi perusahaan via QR Code, uji coba kirim pesan, serta atur saklar broadcast notifikasi presensi otomatis.'
              : 'Konfigurasi akun Gmail SMTP, verifikasi handshake kredensial, uji coba kirim email live, serta atur saklar notifikasi otomatis.'}
          </p>
        </div>

        {saveSuccess && (
          <div className="px-4 py-2 rounded-2xl bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-md animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Aturan Gaji Berhasil Disimpan!</span>
          </div>
        )}

        {waSaveSuccess && (
          <div className="px-4 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 shadow-md animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>Aturan Notifikasi WhatsApp Disimpan!</span>
          </div>
        )}

        {emailSaveSuccess && (
          <div className="px-4 py-2 rounded-2xl bg-[#18345E] text-white text-xs font-bold flex items-center gap-2 shadow-md animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>Aturan Notifikasi Email SMTP Disimpan!</span>
          </div>
        )}
      </div>

      {/* Segmented View Switcher: WhatsApp Bot vs Email SMTP vs Salary Rules */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs max-w-xl">
        <button
          type="button"
          onClick={() => setActiveSubTab('whatsapp')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'whatsapp'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>WhatsApp Bot</span>
          <span className={`w-2 h-2 rounded-full ${waStatus?.online ? 'bg-emerald-300' : 'bg-amber-400 animate-pulse'}`} />
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('email')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'email'
              ? 'bg-[#18345E] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Email Gmail SMTP</span>
          <span className={`w-2 h-2 rounded-full ${emailStatus?.verified ? 'bg-emerald-400' : (config.smtpConfig?.enabled ? 'bg-amber-400 animate-pulse' : 'bg-slate-300')}`} />
        </button>
      </div>

      {/* VIEW 1: WHATSAPP BOT & GATEWAY SUITE */}
      {activeSubTab === 'whatsapp' && (
        <div className="space-y-6 motion-fade-in-up">
          
          {/* Main WhatsApp Card (Grid 12 cols: 7 cols Pairing & Status, 5 cols Automation Switches) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: QR Pairing & Gateway Status (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5 border border-emerald-100 shadow-sm">
                
                {/* Header status bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full shrink-0 ${waStatus?.online ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 uppercase font-mono-code flex items-center gap-2">
                        <span>Status Gateway Baileys:</span>
                        <span className={waStatus?.online ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                          {waStatus?.online ? 'ONLINE (TERHUBUNG)' : 'BELUM TERHUBUNG • SCAN QR'}
                        </span>
                      </h2>
                      <p className="text-[11px] text-slate-500 font-mono-code">
                        Port 9008 • prime-wa • Sesi Mandiri <span className="font-bold text-slate-700">.prime_wa_auth</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                    <button
                      type="button"
                      onClick={fetchWaStatus}
                      disabled={loadingWaStatus}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Perbarui Status Gateway"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingWaStatus ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
                      <span>Cek Status</span>
                    </button>

                    {waStatus?.online ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowTestModal(true)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Tes Pesan</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleBlastUnrecorded}
                          disabled={blasting}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                          title="Blast WhatsApp ke karyawan yang belum hadir hari ini"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>{blasting ? 'Memproses...' : 'Blast Belum Hadir'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleLogoutWa}
                          disabled={loggingOutWa}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          title="Putuskan sesi bot saat ini dan tautkan nomor baru"
                        >
                          <LogOut className="w-3.5 h-3.5 text-rose-600" />
                          <span>Putuskan Sesi</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRestartWa}
                        disabled={restartingWa}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{restartingWa ? 'Memuat QR...' : 'Muat / Refresh QR'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {blastResult && (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
                    <span>Hasil Blast: <b>{blastResult.sentCount}</b> terkirim dari total <b>{blastResult.totalTargeted}</b> target karyawan ({blastResult.failedCount} gagal).</span>
                    <button type="button" onClick={() => setBlastResult(null)} className="text-amber-700 font-bold hover:underline cursor-pointer">Tutup</button>
                  </div>
                )}

                {/* If Online: Connected Card */}
                {waStatus?.online ? (
                  <div className="p-6 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0 text-emerald-600 shadow-sm">
                      <Smartphone className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <div className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono-code font-bold text-[10px] uppercase tracking-wider mb-1">
                        TERHUBUNG DENGAN BAIK
                      </div>
                      <h3 className="text-base font-black text-slate-900 font-mono-code">
                        {waStatus.clientInfo?.phone ? `+${waStatus.clientInfo.phone}` : 'Nomor Bot Terhubung'}
                      </h3>
                      <p className="text-xs text-slate-600">
                        Nama Bot: <b>{waStatus.clientInfo?.pushname || 'PRIME HRIS Bot'}</b>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Bot ini aktif mengirim notifikasi presensi tepat waktu, peringatan terlambat, pengingat pagi, dan status persetujuan tiket karyawan.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* If Not Online: QR Code Box + Pairing Instructions */
                  <div className="p-5 sm:p-6 rounded-2xl bg-amber-50/40 border border-amber-200/80 shadow-xs flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                    {waStatus?.qrDataUrl ? (
                      <div className="shrink-0 flex flex-col items-center">
                        <div className="p-2 bg-white rounded-2xl border border-slate-200 shadow-md">
                          <img
                            src={waStatus.qrDataUrl}
                            alt="WhatsApp QR Code"
                            className="w-52 h-52 rounded-xl object-contain"
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono-code mt-2 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>QR Code Aktif • Scan Sekarang</span>
                        </span>
                      </div>
                    ) : (
                      <div className="w-52 h-52 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center p-4 text-slate-400 shrink-0 shadow-xs">
                        <QrCode className="w-10 h-10 text-slate-400 mb-2 animate-pulse" />
                        <p className="text-xs font-mono-code font-bold text-slate-700">QR Code Belum Tampil</p>
                        <p className="text-[10px] text-slate-500 text-center mt-1">Klik tombol di bawah untuk meminta QR code baru ke gateway:</p>
                        <button
                          type="button"
                          onClick={handleRestartWa}
                          disabled={restartingWa}
                          className="mt-3 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer hover:bg-emerald-700 shadow-sm"
                        >
                          {restartingWa ? 'Memuat...' : 'Klik Muat QR'}
                        </button>
                      </div>
                    )}

                    <div className="space-y-3 text-xs">
                      <div className="flex items-center gap-2 justify-center md:justify-start">
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                          !
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          Langkah Scan QR Code WhatsApp Bot
                        </h4>
                      </div>
                      <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-700 leading-relaxed text-left">
                        <li>Buka aplikasi WhatsApp di HP nomor resmi bot PRIME HRIS.</li>
                        <li>Ketuk menu <b>Titik Tiga (⋮)</b> di pojok kanan atas, lalu pilih <b>Perangkat Tertaut (Linked Devices)</b>.</li>
                        <li>Ketuk tombol <b>Tautkan Perangkat (Link a Device)</b>.</li>
                        <li>Arahkan kamera HP Anda ke gambar QR Code di samping.</li>
                        <li>Tunggu 2–3 detik, sistem akan otomatis beralih menjadi <b>ONLINE</b>.</li>
                      </ol>
                      <div className="pt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleRestartWa}
                          disabled={restartingWa}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${restartingWa ? 'animate-spin' : ''}`} />
                          <span>Refresh QR Baru</span>
                        </button>
                        <span className="text-[11px] text-slate-500 italic">
                          * Sesi disimpan mandiri di <code>.prime_wa_auth</code> (Port 9008).
                        </span>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Right Column: Notification Automation Rules (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4 border border-slate-200 shadow-sm">
                
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 uppercase font-mono-code flex items-center gap-2">
                    <Bell className="w-4 h-4 text-emerald-600" />
                    <span>Saklar Notifikasi Otomatis</span>
                  </h3>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full font-mono-code">
                    Auto-Trigger
                  </span>
                </div>

                <p className="text-xs text-slate-600">
                  Setiap perubahan saklar di bawah langsung otomatis tersimpan ke server backend:
                </p>

                {/* Master Switch */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/50 border border-emerald-200">
                  <div>
                    <p className="font-bold text-slate-900 text-xs">Master Switch WhatsApp</p>
                    <p className="text-[10px] text-slate-500">Aktifkan seluruh pengiriman pesan notifikasi otomatis</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.whatsappConfig?.enabled !== false}
                    onChange={e => updateWaConfig({ enabled: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </div>

                {/* Sub Switches */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors">
                    <div>
                      <p className="font-bold text-slate-800 text-xs">Notifikasi Presensi Masuk Berhasil</p>
                      <p className="text-[10px] text-slate-500">Konfirmasi pesan saat check-in tepat waktu / WFO / DL</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.whatsappConfig?.notifyAttendanceSuccess !== false}
                      onChange={e => updateWaConfig({ notifyAttendanceSuccess: e.target.checked })}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors">
                    <div>
                      <p className="font-bold text-slate-800 text-xs">Notifikasi Keterlambatan Presensi</p>
                      <p className="text-[10px] text-slate-500">Kirim detail menit terlambat + link form dispensasi</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.whatsappConfig?.notifyAttendanceLate !== false}
                      onChange={e => updateWaConfig({ notifyAttendanceLate: e.target.checked })}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors">
                    <div>
                      <p className="font-bold text-slate-800 text-xs">Pengingat Presensi Pagi Hari</p>
                      <p className="text-[10px] text-slate-500">Otomatis pukul 07:30 WIB ke staf yang belum check-in</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.whatsappConfig?.notifyMorningReminder !== false}
                      onChange={e => updateWaConfig({ notifyMorningReminder: e.target.checked })}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors">
                    <div>
                      <p className="font-bold text-slate-800 text-xs">Peringatan 15 Menit Batas Jam Masuk</p>
                      <p className="text-[10px] text-slate-500">Kirim countdown batas cutoff toleransi keterlambatan</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.whatsappConfig?.notifyApproachingCutoff !== false}
                      onChange={e => updateWaConfig({ notifyApproachingCutoff: e.target.checked })}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors">
                    <div>
                      <p className="font-bold text-slate-800 text-xs">Notifikasi Status Approval Tiket & Izin</p>
                      <p className="text-[10px] text-slate-500">Update langsung saat pengajuan disetujui / ditolak</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.whatsappConfig?.notifyApprovalUpdates !== false}
                      onChange={e => updateWaConfig({ notifyApprovalUpdates: e.target.checked })}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer"
                    />
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Mandatory WhatsApp Opt-In Registry & Policy Card */}
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4 motion-fade-in-up border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/20 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider font-mono-code">
                      Daftar Kontak Terverifikasi & Syarat Opt-In WhatsApp
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono-code font-bold">
                      {waOptIns.length} Nomor Terdaftar
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Kebijakan Anti-Spam: Bot hanya mengirim notifikasi ke user yang telah mengetik minimal 1 pesan masuk.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {waStatus?.clientInfo?.phone && (
                  <a
                    href={`https://wa.me/${waStatus.clientInfo.phone}?text=Halo%20PRIME%20HRIS`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
                    title="Kirim pesan aktivasi ke nomor bot"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Kirim Pesan ke Bot (+{waStatus.clientInfo.phone})</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={fetchWaOptIns}
                  disabled={loadingWaOptIns}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingWaOptIns ? 'animate-spin text-emerald-600' : ''}`} />
                  <span>Segarkan</span>
                </button>
              </div>
            </div>

            {/* Informational Policy Banner */}
            <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 leading-relaxed">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950">Aturan Mutlak Aktivasi Notifikasi WhatsApp:</p>
                <p className="text-[11px] text-amber-900/90 mt-0.5">
                  Setiap karyawan/user yang ingin menerima notifikasi otomatis (presensi kehadiran, status persetujuan tiket / approval) <b>wajib mengetik minimal 1 pesan ke nomor bot di atas</b>. Pesan dapat berupa ID Karyawan (contoh: <code className="bg-amber-100/80 px-1 rounded font-mono text-[10px]">EMP-001</code>), NIK, atau sapaan apa pun. Sebelum ada 1 pesan masuk, sistem secara otomatis menahan pengiriman notifikasi (<code className="bg-amber-100/80 px-1 rounded font-mono text-[10px]">OPT_IN_REQUIRED</code>). Sesuai kebijakan manajemen, notifikasi slip gaji/payroll tidak dikirimkan otomatis melalui WA/Email.
                </p>
              </div>
            </div>

            {/* Verified Contacts Table */}
            {waOptIns.length === 0 ? (
              <div className="p-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 text-slate-500">
                <Smartphone className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-60" />
                <p className="text-xs font-bold text-slate-700">Belum Ada Kontak yang Melakukan Opt-In</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                  Arahkan karyawan untuk membuka WhatsApp dan mengirim minimal 1 pesan sapaan atau ID Karyawan ke nomor bot WhatsApp yang terhubung.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 font-mono-code text-[11px] text-slate-600">
                      <th className="py-2 px-3">Nomor WhatsApp</th>
                      <th className="py-2 px-3">Karyawan Terkait</th>
                      <th className="py-2 px-3">Pesan Pertama</th>
                      <th className="py-2 px-3">Pesan Terakhir</th>
                      <th className="py-2 px-3 text-center">Pesan</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono-code text-[11px]">
                    {waOptIns.map(opt => (
                      <tr key={opt.phone} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900">+{opt.phone}</td>
                        <td className="py-2.5 px-3">
                          {opt.employee_name ? (
                            <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              {opt.employee_name} ({opt.employee_id || 'ID'})
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Tamu / Belum Ditautkan</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 truncate max-w-[140px]" title={opt.first_message || '-'}>
                          {opt.first_message || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 truncate max-w-[140px]" title={opt.last_message || '-'}>
                          {opt.last_message || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                          {opt.message_count || 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            <Check className="w-3 h-3 text-emerald-600" />
                            Aktif Notifikasi
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* WhatsApp Logs Table (Full Width) */}
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-3 motion-fade-in-up border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono-code">
                  Riwayat Log Pengiriman Notifikasi WhatsApp Baileys
                </h2>
                {(waStartDate || waEndDate) && (
                  <span className="text-slate-400 font-normal text-xs font-mono-code">
                    ({waStartDate || 'Awal'} s/d {waEndDate || 'Kini'})
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={fetchWaLogs}
                disabled={loadingWaLogs}
                className="px-2.5 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingWaLogs ? 'animate-spin text-emerald-600' : ''}`} />
                <span>Segarkan Log</span>
              </button>
            </div>

            {/* WhatsApp Date Range Filter Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 bg-slate-50/90 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1 font-mono-code text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  Filter Rentang Log WA:
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={waStartDate}
                    onChange={e => {
                      setWaStartDate(e.target.value);
                      setWaDatePreset('ALL');
                    }}
                    className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-mono-code text-slate-800 shadow-2xs focus:ring-1 focus:ring-emerald-500"
                    title="Tanggal Mulai"
                  />
                  <span className="text-slate-400 text-xs font-mono-code">s/d</span>
                  <input
                    type="date"
                    value={waEndDate}
                    onChange={e => {
                      setWaEndDate(e.target.value);
                      setWaDatePreset('ALL');
                    }}
                    className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-mono-code text-slate-800 shadow-2xs focus:ring-1 focus:ring-emerald-500"
                    title="Tanggal Akhir"
                  />
                </div>
                {(waStartDate || waEndDate) && (
                  <button
                    type="button"
                    onClick={() => applyWaPreset('ALL')}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200/60 transition-colors cursor-pointer"
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
                    onClick={() => applyWaPreset(p.id as any)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold font-mono-code transition-all cursor-pointer ${
                      waDatePreset === p.id && (!waStartDate || p.id !== 'ALL')
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredWaLogs.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6 font-mono-code">
                {waStartDate || waEndDate ? 'Tidak ada rekaman log WhatsApp pada rentang tanggal yang dipilih.' : 'Belum ada log pengiriman notifikasi WhatsApp.'}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="text-[10px] uppercase font-mono-code text-slate-400 bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-3">Waktu (WIB)</th>
                      <th className="py-2.5 px-3">Penerima</th>
                      <th className="py-2.5 px-3">Tipe Event</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Ringkasan Pesan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono-code">
                    {visibleWaLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(log.sentAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-2 px-3 text-[11px] font-bold text-slate-800 whitespace-nowrap">
                          {log.recipientName} ({log.recipientPhone})
                        </td>
                        <td className="py-2 px-3 text-[10px]">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {log.eventType}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[10px] whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full font-bold ${
                            log.status === 'SENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-600 truncate max-w-xs font-sans">
                          {log.title || log.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredWaLogs.length > 10 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 font-mono-code text-[11px]">
                    Menampilkan <span className="font-bold text-slate-800">{Math.min(waDisplayLimit, filteredWaLogs.length)}</span> dari <span className="font-bold text-slate-800">{filteredWaLogs.length}</span> log WA
                  </span>
                  <div className="flex items-center gap-2">
                    {hasMoreWaLogs ? (
                      <button
                        type="button"
                        onClick={() => setWaDisplayLimit(prev => Math.min(prev + 10, filteredWaLogs.length))}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span>Muat 10 Log Lagi ({filteredWaLogs.length - waDisplayLimit} Tersisa)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setWaDisplayLimit(10)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                        <span>Ciutkan (Tampilkan 10)</span>
                      </button>
                    )}
                    {hasMoreWaLogs && (
                      <button
                        type="button"
                        onClick={() => setWaDisplayLimit(filteredWaLogs.length)}
                        className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 font-semibold text-xs transition-all cursor-pointer"
                      >
                        Tampilkan Semua
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
            )}
          </div>

        </div>
      )}

      {/* VIEW 2: EMAIL SMTP GMAIL SUITE */}
      {activeSubTab === 'email' && (
        <div className="space-y-6 motion-fade-in-up">
          
          {/* Main Email Card: 12 Cols Grid (7 cols SMTP Settings, 5 cols Automation Switches) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Server Credentials & Handshake (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5 border border-indigo-100 shadow-sm">
                
                {/* Header Status Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full shrink-0 ${
                      emailStatus?.verified
                        ? 'bg-emerald-500 animate-pulse'
                        : (config.smtpConfig?.enabled ? 'bg-amber-500' : 'bg-slate-300')
                    }`} />
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 uppercase font-mono-code flex items-center gap-2">
                        <span>Status SMTP Gmail:</span>
                        <span className={emailStatus?.verified ? 'text-emerald-700 font-bold' : (config.smtpConfig?.enabled ? 'text-amber-700 font-bold' : 'text-slate-500 font-bold')}>
                          {emailStatus?.verified
                            ? 'TERVERIFIKASI • SIAP KIRIM'
                            : (config.smtpConfig?.enabled ? 'KREDENSIAL DISIMPAN • BELUM DIVERIFIKASI' : 'LAYANAN NONAKTIF')}
                        </span>
                      </h2>
                      <p className="text-[11px] text-slate-500 font-mono-code">
                        Host: <span className="font-bold text-slate-700">{config.smtpConfig?.host || 'smtp.gmail.com'}</span> &bull; Port: <span className="font-bold text-slate-700">{config.smtpConfig?.port || 465}</span> ({config.smtpConfig?.secure !== false ? 'SSL' : 'TLS'})
                      </p>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                    <button
                      type="button"
                      onClick={fetchEmailStatus}
                      disabled={loadingEmailStatus}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Perbarui Status SMTP"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingEmailStatus ? 'animate-spin text-[#18345E]' : 'text-slate-500'}`} />
                      <span>Cek Status</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowEmailTestModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-[#18345E] hover:bg-[#0d1e37] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Uji Coba Email</span>
                    </button>

                    <button
                      type="button"
                      onClick={applyGmailPreset}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Isi parameter standar Gmail (smtp.gmail.com:465 SSL)"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Preset Gmail</span>
                    </button>
                  </div>
                </div>

                {/* Form Inputs */}
                <form onSubmit={handleSaveEmailConfig} className="space-y-4">
                  {/* Master Switch */}
                  <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Aktifkan Notifikasi Email (SMTP)</span>
                      <span className="text-[11px] text-slate-500 block">Kirim notifikasi bukti presensi, peringatan keterlambatan & persetujuan cuti via email</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(config.smtpConfig?.enabled)}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          smtpConfig: {
                            ...(prev.smtpConfig || {
                              host: 'smtp.gmail.com',
                              port: 465,
                              secure: true,
                              user: '',
                              pass: '',
                              fromName: 'PRIME HRIS Enterprise',
                              fromEmail: '',
                              notifyAttendanceSuccess: true,
                              notifyAttendanceLate: true,
                              notifyApprovalSubmitted: true,
                              notifyApprovalUpdates: true,
                              notifyMorningReminder: false,
                              morningReminderTime: '07:30'
                            }),
                            enabled: e.target.checked
                          }
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#18345E]"></div>
                    </label>
                  </div>

                  {/* Host and Port */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-8">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        SMTP Host Server
                      </label>
                      <input
                        type="text"
                        value={config.smtpConfig?.host ?? 'smtp.gmail.com'}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          smtpConfig: {
                            ...(prev.smtpConfig || {} as SmtpConfig),
                            enabled: prev.smtpConfig?.enabled ?? false,
                            host: e.target.value,
                            port: prev.smtpConfig?.port || 465,
                            secure: prev.smtpConfig?.secure ?? true,
                            user: prev.smtpConfig?.user || '',
                            pass: prev.smtpConfig?.pass || '',
                            fromName: prev.smtpConfig?.fromName || 'PRIME HRIS Enterprise',
                            fromEmail: prev.smtpConfig?.fromEmail || '',
                            notifyAttendanceSuccess: prev.smtpConfig?.notifyAttendanceSuccess ?? true,
                            notifyAttendanceLate: prev.smtpConfig?.notifyAttendanceLate ?? true,
                            notifyApprovalSubmitted: prev.smtpConfig?.notifyApprovalSubmitted ?? true,
                            notifyApprovalUpdates: prev.smtpConfig?.notifyApprovalUpdates ?? true,
                            notifyMorningReminder: prev.smtpConfig?.notifyMorningReminder ?? false,
                            morningReminderTime: prev.smtpConfig?.morningReminderTime || '07:30'
                          }
                        }))}
                        placeholder="smtp.gmail.com"
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono-code font-bold text-slate-800"
                        required
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Port & Keamanan
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={config.smtpConfig?.port ?? 465}
                          onChange={e => {
                            const p = parseInt(e.target.value, 10) || 465;
                            setConfig(prev => ({
                              ...prev,
                              smtpConfig: {
                                ...(prev.smtpConfig || {} as SmtpConfig),
                                port: p,
                                secure: p === 465
                              }
                            }));
                          }}
                          className="w-20 glass-input rounded-xl px-3 py-2 text-xs font-mono-code font-bold text-slate-800"
                          required
                        />
                        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={config.smtpConfig?.secure !== false}
                            onChange={e => setConfig(prev => ({
                              ...prev,
                              smtpConfig: {
                                ...(prev.smtpConfig || {} as SmtpConfig),
                                secure: e.target.checked
                              }
                            }))}
                            className="rounded border-slate-300 text-[#18345E] focus:ring-[#18345E]"
                          />
                          <span className="font-semibold text-[11px]">SSL (465)</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Gmail User and App Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Email Akun Gmail (Username)
                      </label>
                      <input
                        type="email"
                        value={config.smtpConfig?.user || ''}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          smtpConfig: {
                            ...(prev.smtpConfig || {} as SmtpConfig),
                            user: e.target.value
                          }
                        }))}
                        placeholder="perusahaan@gmail.com"
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono-code font-bold text-slate-800"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center justify-between">
                        <span>Sandi Aplikasi (App Password)</span>
                        <span className="text-[9px] text-[#FF6B00] font-normal lowercase">16 karakter Google</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={config.smtpConfig?.pass || ''}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            smtpConfig: {
                              ...(prev.smtpConfig || {} as SmtpConfig),
                              pass: e.target.value
                            }
                          }))}
                          placeholder="xxxx xxxx xxxx xxxx"
                          className="w-full glass-input rounded-xl pl-3 pr-10 py-2 text-xs font-mono-code font-bold text-slate-800"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Sender Display Name and From Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Nama Pengirim (Sender Display Name)
                      </label>
                      <input
                        type="text"
                        value={config.smtpConfig?.fromName ?? 'PRIME HRIS Enterprise'}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          smtpConfig: {
                            ...(prev.smtpConfig || {} as SmtpConfig),
                            fromName: e.target.value
                          }
                        }))}
                        placeholder="PRIME HRIS Enterprise"
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Email Pengirim (Opsional Custom From)
                      </label>
                      <input
                        type="text"
                        value={config.smtpConfig?.fromEmail || ''}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          smtpConfig: {
                            ...(prev.smtpConfig || {} as SmtpConfig),
                            fromEmail: e.target.value
                          }
                        }))}
                        placeholder={config.smtpConfig?.user || 'Sama dengan email login'}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Verify Alert Feedback */}
                  {emailVerifyResult && (
                    <div className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                      emailVerifyResult.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}>
                      {emailVerifyResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />}
                      <span>{emailVerifyResult.message}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleVerifySmtp}
                      disabled={verifyingEmail || !config.smtpConfig?.user || !config.smtpConfig?.pass}
                      className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Key className="w-3.5 h-3.5 text-[#18345E]" />
                      <span>{verifyingEmail ? 'Memverifikasi Handshake...' : 'Uji Handshake Kredensial'}</span>
                    </button>

                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-[#18345E] hover:bg-[#0d1e37] text-white font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer active:scale-95"
                    >
                      <Save className="w-4 h-4" />
                      <span>Simpan Pengaturan SMTP</span>
                    </button>
                  </div>
                </form>

                {/* Instruction / Help Box */}
                <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100/80 text-xs text-slate-700 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-[#18345E]">
                    <Info className="w-4 h-4 text-[#18345E]" />
                    <span>Panduan Mendapatkan App Password 16-Digit Gmail:</span>
                  </div>
                  <ol className="list-decimal pl-5 space-y-1 text-[11px] text-slate-600 leading-relaxed">
                    <li>Buka Akun Google di <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="font-bold text-[#18345E] underline inline-flex items-center gap-0.5">myaccount.google.com/security <ExternalLink className="w-2.5 h-2.5 inline" /></a>.</li>
                    <li>Pastikan fitur <b>Verifikasi 2 Langkah (2-Step Verification)</b> telah berstatus aktif.</li>
                    <li>Ketik <b>"Sandi Aplikasi"</b> (App Passwords) pada bilah pencarian Akun Google.</li>
                    <li>Beri nama aplikasi, misal <b>PRIME HRIS</b>, lalu klik <b>Buat</b>.</li>
                    <li>Salin kode 16 digit yang muncul (spasi akan otomatis dibersihkan saat dikirim).</li>
                  </ol>
                </div>

              </div>
            </div>

            {/* Right Column: Notification Automation Triggers & Blast (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Automation Switches Card */}
              <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4 border border-indigo-100 shadow-sm">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase font-mono-code flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#18345E]" />
                    <span>Saklar Otomasi Notifikasi Email</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Pilih event yang otomatis memicu pengiriman email resmi ke karyawan & atasan
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Switch 1: Attendance Success */}
                  <label className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-all">
                    <div className="pr-2">
                      <span className="text-xs font-bold text-slate-900 block">Bukti Presensi Check-In</span>
                      <span className="text-[10px] text-slate-500 block">Kirim konfirmasi kehadiran resmi setelah selfie valid</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.smtpConfig?.notifyAttendanceSuccess !== false}
                      onChange={e => setConfig(prev => ({
                        ...prev,
                        smtpConfig: {
                          ...(prev.smtpConfig || {} as SmtpConfig),
                          notifyAttendanceSuccess: e.target.checked
                        }
                      }))}
                      className="rounded border-slate-300 text-[#18345E] focus:ring-[#18345E] w-4 h-4"
                    />
                  </label>

                  {/* Switch 2: Attendance Late */}
                  <label className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-all">
                    <div className="pr-2">
                      <span className="text-xs font-bold text-slate-900 block">Peringatan Keterlambatan</span>
                      <span className="text-[10px] text-slate-500 block">Notifikasi telat melebihi cutoff + estimasi penalti</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.smtpConfig?.notifyAttendanceLate !== false}
                      onChange={e => setConfig(prev => ({
                        ...prev,
                        smtpConfig: {
                          ...(prev.smtpConfig || {} as SmtpConfig),
                          notifyAttendanceLate: e.target.checked
                        }
                      }))}
                      className="rounded border-slate-300 text-[#18345E] focus:ring-[#18345E] w-4 h-4"
                    />
                  </label>

                  {/* Switch 3: Approval Submitted */}
                  <label className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-all">
                    <div className="pr-2">
                      <span className="text-xs font-bold text-slate-900 block">Pengajuan Permohonan Baru</span>
                      <span className="text-[10px] text-slate-500 block">Email review ke Approver & konfirmasi ke pemohon</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.smtpConfig?.notifyApprovalSubmitted !== false}
                      onChange={e => setConfig(prev => ({
                        ...prev,
                        smtpConfig: {
                          ...(prev.smtpConfig || {} as SmtpConfig),
                          notifyApprovalSubmitted: e.target.checked
                        }
                      }))}
                      className="rounded border-slate-300 text-[#18345E] focus:ring-[#18345E] w-4 h-4"
                    />
                  </label>

                  {/* Switch 4: Approval Decision */}
                  <label className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-all">
                    <div className="pr-2">
                      <span className="text-xs font-bold text-slate-900 block">Keputusan Review (Disetujui/Ditolak)</span>
                      <span className="text-[10px] text-slate-500 block">Konfirmasi status cuti/izin ke pemohon</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.smtpConfig?.notifyApprovalUpdates !== false}
                      onChange={e => setConfig(prev => ({
                        ...prev,
                        smtpConfig: {
                          ...(prev.smtpConfig || {} as SmtpConfig),
                          notifyApprovalUpdates: e.target.checked
                        }
                      }))}
                      className="rounded border-slate-300 text-[#18345E] focus:ring-[#18345E] w-4 h-4"
                    />
                  </label>

                  {/* Switch 5: Morning Reminder */}
                  <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-2">
                    <div className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Pengingat Presensi Pagi</span>
                        <span className="text-[10px] text-slate-500 block">Broadcast otomatis sebelum jam kerja dimulai</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(config.smtpConfig?.notifyMorningReminder)}
                        onChange={e => setConfig(prev => ({
                          ...prev,
                          smtpConfig: {
                            ...(prev.smtpConfig || {} as SmtpConfig),
                            notifyMorningReminder: e.target.checked
                          }
                        }))}
                        className="rounded border-slate-300 text-[#18345E] focus:ring-[#18345E] w-4 h-4"
                      />
                    </div>
                    {config.smtpConfig?.notifyMorningReminder && (
                      <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-600">Jam Pengingat:</span>
                        <input
                          type="time"
                          value={config.smtpConfig?.morningReminderTime || '07:30'}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            smtpConfig: {
                              ...(prev.smtpConfig || {} as SmtpConfig),
                              morningReminderTime: e.target.value
                            }
                          }))}
                          className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono-code font-bold text-slate-800"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveEmailConfig}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Terapkan Perubahan Saklar</span>
                </button>
              </div>

              {/* Blast Email Action Card */}
              <div className="glass-card rounded-3xl p-5 border border-amber-200/80 bg-amber-50/40 space-y-3">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Aksi Cepat: Blast Pengingat Email Hari Ini</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Kirim email pengingat presensi serentak kepada seluruh staf aktif yang terdaftar belum melakukan absensi check-in untuk hari ini.
                </p>

                {blastEmailResult && (
                  <div className="p-2.5 rounded-xl bg-white border border-amber-200 text-xs font-mono-code space-y-1">
                    <p className="text-slate-700 font-bold">Hasil Pengiriman Blast:</p>
                    <p className="text-emerald-700">Terkirim: {blastEmailResult.sentCount} dari {blastEmailResult.totalTargeted} karyawan</p>
                    {blastEmailResult.failedCount > 0 && (
                      <p className="text-rose-600">Gagal: {blastEmailResult.failedCount}</p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleBlastEmail}
                  disabled={blastingEmail}
                  className="w-full py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{blastingEmail ? 'Mengirimkan Email...' : 'Kirim Blast Email Sekarang'}</span>
                </button>
              </div>

            </div>

          </div>

          {/* Bottom Table: Real-Time Email Notification Logs */}
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4 border border-indigo-100 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase font-mono-code flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#18345E]" />
                  <span>Audit Trail Riwayat Pengiriman Email (Live SQLite)</span>
                  {(emailStartDate || emailEndDate) && (
                    <span className="text-slate-400 font-normal text-xs font-mono-code lowercase">
                      ({emailStartDate || 'Awal'} s/d {emailEndDate || 'Kini'})
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Rekaman transaksi pengiriman pesan notifikasi via SMTP Gmail (maksimal 50 log terbaru)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono-code bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full">
                  Total Log: {filteredEmailLogs.length}
                </span>
                <button
                  type="button"
                  onClick={fetchEmailLogs}
                  disabled={loadingEmailLogs}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingEmailLogs ? 'animate-spin text-[#18345E]' : 'text-slate-500'}`} />
                  <span>Segarkan</span>
                </button>
              </div>
            </div>

            {/* Email Date Range Filter Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 bg-slate-50/90 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1 font-mono-code text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  Filter Rentang Log Email:
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={emailStartDate}
                    onChange={e => {
                      setEmailStartDate(e.target.value);
                      setEmailDatePreset('ALL');
                    }}
                    className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-mono-code text-slate-800 shadow-2xs focus:ring-1 focus:ring-blue-500"
                    title="Tanggal Mulai"
                  />
                  <span className="text-slate-400 text-xs font-mono-code">s/d</span>
                  <input
                    type="date"
                    value={emailEndDate}
                    onChange={e => {
                      setEmailEndDate(e.target.value);
                      setEmailDatePreset('ALL');
                    }}
                    className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-mono-code text-slate-800 shadow-2xs focus:ring-1 focus:ring-blue-500"
                    title="Tanggal Akhir"
                  />
                </div>
                {(emailStartDate || emailEndDate) && (
                  <button
                    type="button"
                    onClick={() => applyEmailPreset('ALL')}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200/60 transition-colors cursor-pointer"
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
                    onClick={() => applyEmailPreset(p.id as any)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold font-mono-code transition-all cursor-pointer ${
                      emailDatePreset === p.id && (!emailStartDate || p.id !== 'ALL')
                        ? 'bg-blue-700 text-white shadow-2xs'
                        : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredEmailLogs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-mono-code">
                {emailStartDate || emailEndDate ? 'Tidak ada rekaman log email pada rentang tanggal yang dipilih.' : 'Belum ada rekaman email yang dikirim melalui SMTP server.'}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 text-[10px] uppercase font-mono-code text-slate-500 border-b border-slate-200">
                      <th className="py-2.5 px-3">Waktu (WIB)</th>
                      <th className="py-2.5 px-3">Penerima & Email</th>
                      <th className="py-2.5 px-3">Event Notifikasi</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Subjek Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono-code">
                    {visibleEmailLogs.map((log: EmailNotificationLog, idx) => (
                      <tr key={log.id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                          {log.sent_at ? new Date(log.sent_at).toLocaleString('id-ID', {
                            timeZone: 'Asia/Jakarta',
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          }) : '-'}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-sans">
                          <span className="font-bold text-slate-900 block text-xs">{log.recipient_name || 'Karyawan'}</span>
                          <span className="text-[11px] text-slate-500 font-mono-code">{log.recipient_email}</span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {log.event_type}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {log.status === 'SENT' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              SENT
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title={log.error_msg || 'Gagal'}>
                              FAILED
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-700 truncate max-w-sm font-sans" title={log.subject}>
                          {log.subject}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredEmailLogs.length > 10 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 font-mono-code text-[11px]">
                    Menampilkan <span className="font-bold text-slate-800">{Math.min(emailDisplayLimit, filteredEmailLogs.length)}</span> dari <span className="font-bold text-slate-800">{filteredEmailLogs.length}</span> log email
                  </span>
                  <div className="flex items-center gap-2">
                    {hasMoreEmailLogs ? (
                      <button
                        type="button"
                        onClick={() => setEmailDisplayLimit(prev => Math.min(prev + 10, filteredEmailLogs.length))}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-blue-600 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span>Muat 10 Log Lagi ({filteredEmailLogs.length - emailDisplayLimit} Tersisa)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEmailDisplayLimit(10)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                        <span>Ciutkan (Tampilkan 10)</span>
                      </button>
                    )}
                    {hasMoreEmailLogs && (
                      <button
                        type="button"
                        onClick={() => setEmailDisplayLimit(filteredEmailLogs.length)}
                        className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 font-semibold text-xs transition-all cursor-pointer"
                      >
                        Tampilkan Semua
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
            )}
          </div>

        </div>
      )}


      {/* Test WhatsApp Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 max-w-md w-full bg-white shadow-2xl border border-slate-200 motion-fade-in-up space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Kirim Pesan Uji Coba WhatsApp</h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowTestModal(false); setTestResult(null); }}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendTestWa} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                  Pilih Akun / ID Karyawan Penerima (Mengikuti Data Tiap ID)
                </label>
                <select
                  value={testSelectedEmpId}
                  onChange={e => {
                    const selId = e.target.value;
                    setTestSelectedEmpId(selId);
                    if (selId === 'CUSTOM') return;
                    const found = employees.find(emp => emp.id === selId || (emp as any).loginId === selId);
                    if (found) {
                      if (found.phone) setTestPhone(found.phone);
                      const displayId = (found as any).loginId || found.id;
                      setTestMessage(`Halo ${found.name}! Ini pesan uji coba notifikasi WhatsApp resmi PRIME HRIS untuk ID ${displayId}.`);
                    }
                  }}
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                >
                  {employees.map(emp => {
                    const displayId = (emp as any).loginId || emp.id;
                    return (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} (ID: {displayId}) • {emp.phone || 'Tanpa No WA'}
                      </option>
                    );
                  })}
                  <option value="CUSTOM">-- Masukkan Nomor WhatsApp Manual --</option>
                </select>
                {testSelectedEmpId !== 'CUSTOM' && (
                  <span className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>Mengikuti data nomor WhatsApp resmi dari ID terpilih</span>
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                  Nomor WhatsApp Penerima
                </label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="08123456789 atau 62895..."
                  className="w-full glass-input rounded-xl px-3 py-2 font-mono-code font-bold text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                  Isi Pesan Uji Coba
                </label>
                <textarea
                  value={testMessage}
                  onChange={e => setTestMessage(e.target.value)}
                  rows={3}
                  className="w-full glass-input rounded-xl px-3 py-2 text-slate-800 font-sans"
                  required
                />
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  id="testForceBypass"
                  checked={testForceBypass}
                  onChange={e => setTestForceBypass(e.target.checked)}
                  className="w-3.5 h-3.5 accent-emerald-600 cursor-pointer"
                />
                <label htmlFor="testForceBypass" className="text-[11px] text-slate-700 font-medium cursor-pointer">
                  Bypass Syarat Opt-In <span className="text-[10px] text-slate-400">(Paksa kirim meski nomor belum pernah chat bot)</span>
                </label>
              </div>

              {testResult && (
                <div className={`p-2.5 rounded-xl text-xs font-semibold ${
                  testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {testResult.msg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowTestModal(false); setTestResult(null); }}
                  className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingTest ? 'Mengirim...' : 'Kirim Sekarang'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {showEmailTestModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#18345E] flex items-center justify-center font-bold">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Uji Coba Pengiriman Email SMTP</h3>
                  <p className="text-[11px] text-slate-500">Kirim email diagnostik live via SMTP Gmail</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowEmailTestModal(false); setTestEmailResult(null); }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSendTestEmail(); }} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                  Pilih Akun / ID Karyawan Penerima (Mengikuti Data Tiap ID)
                </label>
                <select
                  value={testEmailSelectedEmpId}
                  onChange={e => {
                    const selId = e.target.value;
                    setTestEmailSelectedEmpId(selId);
                    if (selId === 'CUSTOM') return;
                    const found = employees.find(emp => emp.id === selId || (emp as any).loginId === selId);
                    if (found && found.email) {
                      setTestEmailRecipient(found.email);
                    }
                  }}
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                >
                  {employees.map(emp => {
                    const displayId = (emp as any).loginId || emp.id;
                    return (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} (ID: {displayId}) • {emp.email || 'Tanpa Email'}
                      </option>
                    );
                  })}
                  <option value="CUSTOM">-- Masukkan Alamat Email Manual --</option>
                </select>
                {testEmailSelectedEmpId !== 'CUSTOM' && (
                  <span className="text-[10px] text-indigo-600 font-semibold mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>Mengikuti data alamat email resmi dari ID terpilih</span>
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                  Email Penerima Uji Coba
                </label>
                <input
                  type="email"
                  value={testEmailRecipient}
                  onChange={e => setTestEmailRecipient(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full glass-input rounded-xl px-3 py-2 font-mono-code font-bold text-slate-800"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Email diagnostik resmi berisi rincian host, timestamp WIB, dan status server akan dikirimkan ke alamat ini.
                </span>
              </div>

              {testEmailResult && (
                <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  testEmailResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {testEmailResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />}
                  <span>{testEmailResult.message}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowEmailTestModal(false); setTestEmailResult(null); }}
                  className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={sendingTestEmail || !testEmailRecipient}
                  className="px-4 py-2 rounded-xl bg-[#18345E] hover:bg-[#0d1e37] text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingTestEmail ? 'Mengirim Email...' : 'Kirim Uji Coba'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
