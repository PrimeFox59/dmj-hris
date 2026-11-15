/**
 * PWA System Notification Service
 * Manages native OS notification bar alerts (Android / iOS / Windows / macOS),
 * Service Worker integration, attendance check-in/out alarms, and real-time approval pushes.
 */

import { Employee, Project, AttendanceRecord } from '../types';

export interface SystemNotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  vibrate?: number[];
  renotify?: boolean;
}

export interface PwaNotificationSettings {
  enabled: boolean;
  // 1. Presensi Masuk (Check-In)
  checkInReminder: boolean;
  checkInLeadMinutes: number; // default: 30 (H-30 menit sebelum shift)
  // 2. Keterlambatan
  lateWarning: boolean; // Jika sudah lewat jam masuk dan belum check-in
  lateWarningDelayMinutes: number; // default: 10 (10 menit setelah jam masuk)
  // 3. Presensi Pulang (Check-Out)
  checkOutReminder: boolean; // Saat jam shift berakhir
  // 4. Peringatan Belum Absen Pulang
  overdueCheckOutWarning: boolean; // Jika > 1 jam lewat jam pulang belum checkout
  overdueCheckOutHours: number; // default: 1 jam
  // 5. Notifikasi Tiket & Approval Berdasarkan Role
  roleApprovalAlerts: boolean; // Notif tiket baru yang butuh persetujuan user
  // 6. Notifikasi Status Tiket Pribadi & Kasbon
  personalStatusAlerts: boolean; // Disetujui / ditolak / revisi / kasbon cair
  // 7. Getaran & Suara
  vibration: boolean;
  sound: boolean;
}

export const DEFAULT_PWA_NOTIFICATION_SETTINGS: PwaNotificationSettings = {
  enabled: true,
  checkInReminder: true,
  checkInLeadMinutes: 30, // H-30 menit
  lateWarning: true,
  lateWarningDelayMinutes: 10, // 10 menit setelah jam masuk
  checkOutReminder: true,
  overdueCheckOutWarning: true,
  overdueCheckOutHours: 1, // > 1 jam setelah jam pulang
  roleApprovalAlerts: true,
  personalStatusAlerts: true,
  vibration: true,
  sound: true
};

export function getUserNotificationSettings(userId: string): PwaNotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_PWA_NOTIFICATION_SETTINGS;
  try {
    const raw = localStorage.getItem(`prime_pwa_notif_settings_${userId}`);
    if (raw) {
      return { ...DEFAULT_PWA_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('[PWA] Failed to load notification settings:', e);
  }
  return DEFAULT_PWA_NOTIFICATION_SETTINGS;
}

export function saveUserNotificationSettings(userId: string, settings: PwaNotificationSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`prime_pwa_notif_settings_${userId}`, JSON.stringify(settings));
  } catch (e) {
    console.warn('[PWA] Failed to save notification settings:', e);
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Send a confirmation system notification to test the native notification bar
      await showSystemNotification('🔔 Notifikasi Bar PWA Berhasil Diaktifkan', {
        body: 'Anda akan menerima pengingat otomatis untuk absensi masuk, absen pulang, dan status persetujuan di bar HP.',
        tag: 'welcome-notification',
        url: '/'
      });
    }
    return permission;
  } catch (error) {
    console.warn('[PWA Notification] Permission request error:', error);
    return Notification.permission;
  }
}

/**
 * Fires a notification directly to the device's native system notification bar / tray
 */
export async function showSystemNotification(
  title: string,
  options?: SystemNotificationOptions
): Promise<boolean> {
  if (!isNotificationSupported()) {
    console.warn('[PWA Notification] Not supported in this environment');
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const notificationOptions: any = {
    body: options?.body || 'Pemberitahuan dari DMJ HRIS',
    icon: options?.icon || '/icons/icon-192x192.png',
    badge: options?.badge || '/favicon.svg',
    tag: options?.tag || 'dmj-hris-notif',
    renotify: options?.renotify ?? true,
    data: {
      url: options?.url || '/'
    }
  };

  // Add vibration pattern if supported
  if ('vibrate' in navigator) {
    notificationOptions.vibrate = options?.vibrate || [250, 100, 250];
  }

  try {
    // 1. Preferred method: ServiceWorkerRegistration.showNotification (appears in system notification tray & lockscreen)
    const registration = await navigator.serviceWorker.ready;
    if (registration && 'showNotification' in registration) {
      await registration.showNotification(title, notificationOptions);
      return true;
    }
  } catch (swError) {
    console.warn('[PWA Notification] SW showNotification failed, trying fallback:', swError);
  }

  try {
    // 2. Fallback: Standard Window Notification constructor
    const n = new Notification(title, notificationOptions);
    n.onclick = () => {
      window.focus();
      if (options?.url) {
        window.location.href = options.url;
      }
      n.close();
    };
    return true;
  } catch (fallbackError) {
    console.error('[PWA Notification] Notification creation failed:', fallbackError);
    return false;
  }
}

/**
 * Background / In-App Attendance Reminders Checker
 * Runs periodically to evaluate if employee needs a check-in or check-out prompt
 */
export function evaluateAttendanceReminder(
  currentUser: Employee,
  todayAttendance: AttendanceRecord | undefined,
  assignedProject?: Project,
  customSettings?: PwaNotificationSettings
): void {
  if (!currentUser || typeof window === 'undefined' || Notification.permission !== 'granted') {
    return;
  }

  const settings = customSettings || getUserNotificationSettings(currentUser.id);
  if (!settings.enabled) {
    return;
  }

  // Get current WIB time (Asia/Jakarta)
  const now = new Date();
  const timeFormatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const timeParts = timeFormatter.format(now).split(':');
  const currentHour = parseInt(timeParts[0], 10);
  const currentMinute = parseInt(timeParts[1], 10);
  const currentTimeVal = currentHour * 60 + currentMinute; // minutes from midnight

  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta'
  }).format(now);

  const checkInKey = `prime_hris_remind_in_${currentUser.id}_${todayStr}`;
  const lateKey = `prime_hris_remind_late_${currentUser.id}_${todayStr}`;
  const checkOutKey = `prime_hris_remind_out_${currentUser.id}_${todayStr}`;
  const overdueCheckOutKey = `prime_hris_remind_overdue_out_${currentUser.id}_${todayStr}`;

  // Evaluate Project / Office Shift
  const schedule = assignedProject?.customRules?.workSchedule;
  const isFlexible = Boolean(schedule?.allowFlexibleHours);
  const shiftCheckInStr = schedule?.checkInTime || '08:00';
  const shiftCheckOutStr = schedule?.checkOutTime || '17:00';
  const projectName = assignedProject?.name || 'Kantor Pusat & Operasional';

  const [inHour, inMin] = shiftCheckInStr.split(':').map(Number);
  const [outHour, outMin] = shiftCheckOutStr.split(':').map(Number);

  const shiftInMinutes = (isNaN(inHour) ? 8 : inHour) * 60 + (isNaN(inMin) ? 0 : inMin);
  const shiftOutMinutes = (isNaN(outHour) ? 17 : outHour) * 60 + (isNaN(outMin) ? 0 : outMin);

  const leadMinutes = settings.checkInLeadMinutes || 30;
  const lateDelay = settings.lateWarningDelayMinutes || 10;
  const overdueMinutes = (settings.overdueCheckOutHours || 1) * 60;
  const vibratePattern = settings.vibration ? [300, 150, 300] : undefined;
  const urgentVibrate = settings.vibration ? [400, 150, 400, 150, 400] : undefined;

  // 1. PENGINGAT ABSEN MASUK (CHECK-IN) H-30 MENIT (Atau waktu yang diatur user)
  if (settings.checkInReminder && (!todayAttendance || !todayAttendance.checkInTime)) {
    const isWithinLeadWindow = isFlexible
      ? (currentTimeVal >= 420 && currentTimeVal <= 540) // 07:00 - 09:00 WIB
      : (currentTimeVal >= (shiftInMinutes - leadMinutes) && currentTimeVal < shiftInMinutes);
    const alreadyRemindedIn = localStorage.getItem(checkInKey);

    if (isWithinLeadWindow && !alreadyRemindedIn) {
      showSystemNotification(`⏰ Pengingat Presensi Masuk (H-${leadMinutes} Menit)`, {
        body: isFlexible
          ? `Halo ${currentUser.name}, jangan lupa lakukan presensi masuk hari ini (${projectName}). Proyek ini menggunakan jam kerja fleksibel.`
          : `Halo ${currentUser.name}, shift kerja di ${projectName} akan dimulai pukul ${shiftCheckInStr} WIB (${leadMinutes} menit lagi). Siapkan presensi masuk Anda.`,
        tag: 'attendance-checkin-reminder',
        url: '/?tab=attendance',
        vibrate: vibratePattern
      });
      localStorage.setItem(checkInKey, 'true');
    }
  }

  // 2. PERINGATAN KETERLAMBATAN (JIKA LEWAT JAM MASUK BELUM ABSEN)
  // Tidak berlaku untuk proyek fleksibel (karena fleksibel bebas jam masuk tanpa penalti)
  if (settings.lateWarning && !isFlexible && (!todayAttendance || !todayAttendance.checkInTime)) {
    const isLateWindow = currentTimeVal >= (shiftInMinutes + lateDelay) && currentTimeVal <= (shiftInMinutes + 180);
    const alreadyRemindedLate = localStorage.getItem(lateKey);

    if (isLateWindow && !alreadyRemindedLate) {
      const minutesLate = currentTimeVal - shiftInMinutes;
      showSystemNotification('⚠️ Peringatan Keterlambatan Presensi', {
        body: `Halo ${currentUser.name}, jam masuk (${shiftCheckInStr} WIB) telah lewat ${minutesLate} menit di ${projectName} dan Anda belum presensi masuk. Segera lakukan presensi!`,
        tag: 'attendance-late-warning',
        url: '/?tab=attendance',
        vibrate: urgentVibrate
      });
      localStorage.setItem(lateKey, 'true');
    }
  }

  // 3. PENGINGAT ABSEN PULANG (CHECK-OUT) SAAT JAM SHIFT BERAKHIR
  if (settings.checkOutReminder && todayAttendance && todayAttendance.checkInTime && !todayAttendance.checkOutTime) {
    const isWithinEveningWindow = isFlexible
      ? (currentTimeVal >= 1020 && currentTimeVal <= 1140) // 17:00 - 19:00 WIB
      : (currentTimeVal >= shiftOutMinutes && currentTimeVal < (shiftOutMinutes + overdueMinutes));
    const alreadyRemindedOut = localStorage.getItem(checkOutKey);

    if (isWithinEveningWindow && !alreadyRemindedOut) {
      showSystemNotification('🏢 Pengingat Absensi Pulang (DMJ HRIS)', {
        body: isFlexible
          ? `Halo ${currentUser.name}, jangan lupa tap Absen Pulang setelah menyelesaikan aktivitas di ${projectName}.`
          : `Halo ${currentUser.name}, jam kerja hari ini telah berakhir (${shiftCheckOutStr} WIB). Jangan lupa lakukan presensi pulang sebelum meninggalkan ${projectName}.`,
        tag: 'attendance-checkout-reminder',
        url: '/?tab=attendance',
        vibrate: vibratePattern
      });
      localStorage.setItem(checkOutKey, 'true');
    }
  }

  // 4. PERINGATAN BELUM ABSEN PULANG LEBIH DARI 1 JAM (> 1 JAM OVERDUE)
  if (settings.overdueCheckOutWarning && todayAttendance && todayAttendance.checkInTime && !todayAttendance.checkOutTime) {
    const isOverdueWindow = currentTimeVal >= (shiftOutMinutes + overdueMinutes) && currentTimeVal <= (shiftOutMinutes + 360);
    const alreadyRemindedOverdue = localStorage.getItem(overdueCheckOutKey);

    if (isOverdueWindow && !alreadyRemindedOverdue) {
      showSystemNotification(`🚨 Peringatan: Belum Absen Pulang (> ${settings.overdueCheckOutHours} Jam)`, {
        body: isFlexible
          ? `Halo ${currentUser.name}, sesi kerja Anda masih aktif sejak check-in. Jangan lupa lakukan Absen Pulang untuk merekam jam kerja Anda.`
          : `Halo ${currentUser.name}, jam kerja telah berakhir pukul ${shiftCheckOutStr} WIB (lebih dari ${settings.overdueCheckOutHours} jam yang lalu) dan Anda belum absen pulang. Tap untuk checkout sekarang!`,
        tag: 'attendance-overdue-checkout',
        url: '/?tab=attendance',
        vibrate: urgentVibrate
      });
      localStorage.setItem(overdueCheckOutKey, 'true');
    }
  }
}
