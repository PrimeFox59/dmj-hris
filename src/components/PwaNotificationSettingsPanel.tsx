import React, { useState, useEffect } from 'react';
import {
  Bell,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Smartphone,
  Building2,
  Info,
  Check,
  RotateCcw,
  Sliders,
  Send,
  AlertCircle
} from 'lucide-react';
import { Employee, Project, SystemRole, getEffectiveSystemRole } from '../types';
import {
  PwaNotificationSettings,
  DEFAULT_PWA_NOTIFICATION_SETTINGS,
  getUserNotificationSettings,
  saveUserNotificationSettings,
  getNotificationPermission,
  requestNotificationPermission,
  showSystemNotification,
  isNotificationSupported
} from '../utils/pwaNotificationService';
import { isFinanceEmployee, isHrEmployee } from '../utils/approvalAuthorityHelper';

interface PwaNotificationSettingsPanelProps {
  currentUser: Employee;
  projects?: Project[];
  onSaveNotification?: (msg: string) => void;
}

export const PwaNotificationSettingsPanel: React.FC<PwaNotificationSettingsPanelProps> = ({
  currentUser,
  projects = [],
  onSaveNotification
}) => {
  const [settings, setSettings] = useState<PwaNotificationSettings>(() =>
    getUserNotificationSettings(currentUser.id)
  );
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getNotificationPermission()
  );
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  // Detect user's assigned project
  const userProject = projects.find(
    p => p.id === currentUser.assignedProjectId || p.code === currentUser.assignedProjectId
  );

  const workSchedule = userProject?.customRules?.workSchedule;
  const isFlexibleHours = Boolean(workSchedule?.allowFlexibleHours);
  const shiftIn = workSchedule?.checkInTime || '08:00';
  const shiftOut = workSchedule?.checkOutTime || '17:00';
  const lateGrace = workSchedule?.lateGraceMinutes ?? 15;
  const projectName = userProject?.name || 'Kantor Pusat & Operasional';

  // Role detection
  const sysRole: SystemRole = getEffectiveSystemRole(currentUser);
  const isFin = isFinanceEmployee(currentUser);
  const isHr = isHrEmployee(currentUser);
  const isPm = Boolean(
    currentUser.role === 'Project_Manager' ||
    projects.some(p => p.projectManagerId === currentUser.id)
  );

  const roleTitle = isFin
    ? 'Finance / Keuangan'
    : isHr
    ? 'HR / Personalia'
    : isPm
    ? 'Project Manager (PM)'
    : sysRole === 'superuser' || sysRole === 'admin'
    ? 'Superuser / Administrator'
    : 'Staff / Karyawan Lapangan';

  // Update permission on focus or mount
  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const triggerToast = (msg: string) => {
    setSaveToast(msg);
    if (onSaveNotification) onSaveNotification(msg);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const updateSetting = <K extends keyof PwaNotificationSettings>(
    key: K,
    val: PwaNotificationSettings[K]
  ) => {
    const updated = { ...settings, [key]: val };
    setSettings(updated);
    saveUserNotificationSettings(currentUser.id, updated);
    triggerToast('Pengaturan notifikasi berhasil disimpan');
  };

  const handleResetDefault = () => {
    setSettings(DEFAULT_PWA_NOTIFICATION_SETTINGS);
    saveUserNotificationSettings(currentUser.id, DEFAULT_PWA_NOTIFICATION_SETTINGS);
    triggerToast('Pengaturan dikembalikan ke standar rekomendasi sistem');
  };

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission();
    setPermission(perm);
    if (perm === 'granted') {
      triggerToast('Izin notifikasi HP berhasil diberikan!');
      showSystemNotification('✅ Notifikasi PWA Diaktifkan', {
        body: `Halo ${currentUser.name}, notifikasi status bar HP untuk DMJ HRIS telah aktif.`,
        tag: 'perm-granted-test'
      });
    } else if (perm === 'denied') {
      triggerToast('Izin notifikasi diblokir di browser. Buka setelan browser untuk mengaktifkan.');
    }
  };

  const handleSendTestNotification = async () => {
    if (permission !== 'granted') {
      const perm = await requestNotificationPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setTestStatus('Gagal: Izin notifikasi belum diaktifkan di browser/HP.');
        setTimeout(() => setTestStatus(null), 4000);
        return;
      }
    }

    setTestStatus('Mengirim notifikasi uji coba ke status bar...');
    const nowStr = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date());

    const success = await showSystemNotification('🧪 Uji Coba Notifikasi PWA DMJ HRIS', {
      body: `Pukul ${nowStr} WIB: Notifikasi pengingat & approval HP berfungsi optimal untuk ${currentUser.name} (${projectName}).`,
      tag: `test-pwa-notif-${Date.now()}`,
      vibrate: settings.vibration ? [200, 100, 200, 100, 300] : undefined,
      url: '/?tab=attendance'
    });

    if (success) {
      setTestStatus('Berhasil! Cek notifikasi bar di bagian atas layar HP Anda.');
    } else {
      setTestStatus('Notifikasi dikirim (pastikan mode Jangan Ganggu / DND tidak aktif di HP).');
    }
    setTimeout(() => setTestStatus(null), 5000);
  };

  return (
    <div className="space-y-6 text-slate-800">
      {/* Toast Floating Notification */}
      {saveToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveToast}</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-mono">Tersimpan</span>
        </div>
      )}

      {/* 1. STATUS IZIN NOTIFIKASI PWA / HP */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 text-[#FF6B00] shrink-0 mt-0.5">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-white">Status Izin Notifikasi Perangkat (PWA)</h4>
                {permission === 'granted' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Diizinkan
                  </span>
                ) : permission === 'denied' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Diblokir
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Perlu Izin
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Notifikasi otomatis muncul di bar notifikasi & lockscreen HP saat aplikasi diinstal sebagai PWA atau berjalan di background.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {permission !== 'granted' && isNotificationSupported() && (
              <button
                type="button"
                onClick={handleRequestPermission}
                className="px-3.5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#e05e00] text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                Izinkan Notifikasi
              </button>
            )}
            <button
              type="button"
              onClick={handleSendTestNotification}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/20 cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 text-[#FF6B00]" />
              Uji Coba Notif
            </button>
          </div>
        </div>

        {testStatus && (
          <div className="mt-3 p-2.5 rounded-xl bg-white/10 text-xs text-amber-200 border border-white/10 flex items-center gap-2 animate-in fade-in">
            <Info className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{testStatus}</span>
          </div>
        )}
      </div>

      {/* 2. KARTU JADWAL AKTIF PROYEK USER */}
      <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#FF6B00]" />
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Sinkronisasi Jadwal Kerja Proyek Anda
            </h5>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
            {projectName}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Tipe Jam Kerja</div>
            <div className="font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
              {isFlexibleHours ? (
                <span className="text-emerald-700 font-bold">✨ Fleksibel (Bebas Shift)</span>
              ) : (
                <span className="text-slate-800 font-bold">⏱️ Reguler / Shift Site</span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {isFlexibleHours ? 'Bebas jam masuk & pulang' : `Toleransi telat: ${lateGrace} mnt`}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Jam Masuk (Check-In)</div>
            <div className="font-bold text-slate-800 mt-0.5 text-sm">
              {isFlexibleHours ? 'Bebas (Fleksibel)' : `${shiftIn} WIB`}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Notif pengingat: {isFlexibleHours ? 'Pagi hari' : `H-${settings.checkInLeadMinutes} menit (${shiftIn})`}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Jam Pulang (Check-Out)</div>
            <div className="font-bold text-slate-800 mt-0.5 text-sm">
              {isFlexibleHours ? 'Bebas (Fleksibel)' : `${shiftOut} WIB`}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Alert belum pulang: &gt; {settings.overdueCheckOutHours} jam setelah {shiftOut}
            </div>
          </div>
        </div>
      </div>

      {/* 3. MASTER SWITCH NOTIFIKASI */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
        <div className="space-y-0.5">
          <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#FF6B00]" />
            Aktifkan Semua Notifikasi PWA
          </div>
          <p className="text-xs text-slate-500">
            Saklar utama untuk menerima semua pengingat presensi dan alert approval di perangkat ini.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={e => updateSetting('enabled', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF6B00]"></div>
        </label>
      </div>

      {/* 4. DETAIL PENGATURAN NOTIFIKASI */}
      <div className={`space-y-4 transition-opacity ${settings.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        {/* A. PENGINGAT PRESENSI MASUK (H-30 MENIT) */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-bold text-slate-900">
                  Pengingat Presensi Masuk (Check-In)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  H-{settings.checkInLeadMinutes} Menit
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Kirim notifikasi otomatis sebelum jadwal shift masuk {projectName} dimulai ({shiftIn} WIB).
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.checkInReminder}
                onChange={e => updateSetting('checkInReminder', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {settings.checkInReminder && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Waktu Pengingat Sebelum Masuk:</span>
              <select
                value={settings.checkInLeadMinutes}
                onChange={e => updateSetting('checkInLeadMinutes', Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-[#FF6B00]"
              >
                <option value={15}>H-15 Menit Sebelum Masuk</option>
                <option value={30}>H-30 Menit Sebelum Masuk (Standar Rekomendasi)</option>
                <option value={45}>H-45 Menit Sebelum Masuk</option>
                <option value={60}>H-60 Menit (1 Jam Sebelum Masuk)</option>
              </select>
            </div>
          )}
        </div>

        {/* B. PERINGATAN KETERLAMBATAN */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-bold text-slate-900">
                  Peringatan Keterlambatan Masuk (Late Alert)
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Kirim alert jika jam masuk ({shiftIn} WIB) telah lewat dan karyawan belum melakukan presensi masuk.
                {isFlexibleHours && (
                  <span className="block text-emerald-600 font-semibold mt-0.5">
                    * Dinonaktifkan otomatis untuk mode jam kerja fleksibel (bebas penalti telat).
                  </span>
                )}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.lateWarning}
                disabled={isFlexibleHours}
                onChange={e => updateSetting('lateWarning', e.target.checked)}
                className="sr-only peer disabled:opacity-50"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {settings.lateWarning && !isFlexibleHours && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Batas Kirim Peringatan Telat:</span>
              <select
                value={settings.lateWarningDelayMinutes}
                onChange={e => updateSetting('lateWarningDelayMinutes', Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-[#FF6B00]"
              >
                <option value={5}>5 Menit Setelah Jam Masuk</option>
                <option value={10}>10 Menit Setelah Jam Masuk (Standar)</option>
                <option value={15}>15 Menit Setelah Jam Masuk</option>
                <option value={30}>30 Menit Setelah Jam Masuk</option>
              </select>
            </div>
          )}
        </div>

        {/* C. PENGINGAT JAM PULANG & PERINGATAN OVERDUE > 1 JAM */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-slate-900">
                  Pengingat Presensi Pulang (Check-Out)
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Kirim notifikasi saat jam kerja shift berakhir ({shiftOut} WIB) agar karyawan tidak lupa tap Checkout.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.checkOutReminder}
                onChange={e => updateSetting('checkOutReminder', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span className="text-sm font-bold text-slate-900">
                  Peringatan Belum Absen Pulang (&gt; 1 Jam)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  &gt; {settings.overdueCheckOutHours} Jam Overdue
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Alert intensif jika jam pulang telah lewat lebih dari {settings.overdueCheckOutHours} jam ({shiftOut} WIB) dan status presensi masih belum Checkout.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.overdueCheckOutWarning}
                onChange={e => updateSetting('overdueCheckOutWarning', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
            </label>
          </div>

          {settings.overdueCheckOutWarning && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Batas Waktu Overdue Belum Pulang:</span>
              <select
                value={settings.overdueCheckOutHours}
                onChange={e => updateSetting('overdueCheckOutHours', Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-[#FF6B00]"
              >
                <option value={1}>Lebih dari 1 Jam Lewat Jam Pulang (Rekomendasi)</option>
                <option value={1.5}>Lebih dari 1.5 Jam Lewat Jam Pulang</option>
                <option value={2}>Lebih dari 2 Jam Lewat Jam Pulang</option>
                <option value={3}>Lebih dari 3 Jam Lewat Jam Pulang</option>
              </select>
            </div>
          )}
        </div>

        {/* D. NOTIFIKASI APPROVAL BERDASARKAN ROLE USER */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#FF6B00]" />
                <span className="text-sm font-bold text-slate-900">
                  Notifikasi Pengajuan Tiket (Role: {roleTitle})
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {isFin ? (
                  <span>
                    Menerima notifikasi langsung saat ada staf mengajukan <strong>Kasbon Pribadi</strong> atau <strong>Permohonan Akses Slip Gaji</strong>.
                  </span>
                ) : isPm ? (
                  <span>
                    Menerima notifikasi saat anggota tim proyek Anda mengajukan tiket Cuti, Izin, Lembur, atau Koreksi Absensi.
                  </span>
                ) : isHr ? (
                  <span>
                    Menerima notifikasi untuk review persetujuan SDM (Cuti tahunan, dispensasi, izin khusus).
                  </span>
                ) : sysRole === 'superuser' || sysRole === 'admin' ? (
                  <span>
                    Menerima notifikasi untuk semua permohonan yang membutuhkan otorisasi Administrator / Direksi.
                  </span>
                ) : (
                  <span>
                    Menerima info tiket operasional yang didelegasikan ke Anda.
                  </span>
                )}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.roleApprovalAlerts}
                onChange={e => updateSetting('roleApprovalAlerts', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FF6B00]"></div>
            </label>
          </div>
        </div>

        {/* E. NOTIFIKASI STATUS TIKET PRIBADI & KASBON */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-bold text-slate-900">
                  Notifikasi Status Tiket Pribadi & Pencairan Kasbon
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Kirim alert ke bar HP saat permohonan Cuti, Izin, atau Kasbon Pribadi Anda disetujui, ditolak, atau dicairkan oleh Finance / Atasan.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.personalStatusAlerts}
                onChange={e => updateSetting('personalStatusAlerts', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>

        {/* F. PENGATURAN GETARAN (HARDWARE VIBRATION) */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-slate-700" />
              Getaran Perangkat (Haptic Feedback)
            </div>
            <p className="text-xs text-slate-500">
              Aktifkan getaran ponsel saat notifikasi pengingat presensi atau alert persetujuan tiba.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={settings.vibration}
              onChange={e => updateSetting('vibration', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FF6B00]"></div>
          </label>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200/80">
        <button
          type="button"
          onClick={handleResetDefault}
          className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer py-1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Kembalikan ke Rekomendasi Standar
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSendTestNotification}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5 text-[#FF6B00]" />
            Uji Coba Notif HP
          </button>
        </div>
      </div>
    </div>
  );
};
