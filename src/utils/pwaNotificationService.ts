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
  assignedProject?: Project
): void {
  if (!currentUser || typeof window === 'undefined' || Notification.permission !== 'granted') {
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
  const checkOutKey = `prime_hris_remind_out_${currentUser.id}_${todayStr}`;

  // Evaluate Project / Office Shift
  const schedule = assignedProject?.customRules?.workSchedule;
  const shiftCheckInStr = schedule?.checkInTime || '08:00';
  const shiftCheckOutStr = schedule?.checkOutTime || '17:00';

  const [inHour, inMin] = shiftCheckInStr.split(':').map(Number);
  const [outHour, outMin] = shiftCheckOutStr.split(':').map(Number);

  const shiftInMinutes = (isNaN(inHour) ? 8 : inHour) * 60 + (isNaN(inMin) ? 0 : inMin);
  const shiftOutMinutes = (isNaN(outHour) ? 17 : outHour) * 60 + (isNaN(outMin) ? 0 : outMin);

  // 1. PENGINGAT ABSEN MASUK (CHECK-IN)
  // Window: 30 menit sebelum shift hingga 15 menit setelah shift (misal 07:30 - 08:15)
  if (!todayAttendance || !todayAttendance.checkInTime) {
    const isWithinMorningWindow = currentTimeVal >= (shiftInMinutes - 30) && currentTimeVal <= (shiftInMinutes + 45);
    const alreadyRemindedIn = localStorage.getItem(checkInKey);

    if (isWithinMorningWindow && !alreadyRemindedIn) {
      showSystemNotification('⏰ Pengingat Absensi Masuk (DMJ HRIS)', {
        body: `Halo ${currentUser.name}, jangan lupa lakukan presensi masuk hari ini (${assignedProject?.name || 'Kantor'}). Shift dimulai pukul ${shiftCheckInStr} WIB.`,
        tag: 'attendance-checkin-reminder',
        url: '/?tab=attendance',
        vibrate: [300, 150, 300]
      });
      localStorage.setItem(checkInKey, 'true');
    }
  }

  // 2. PENGINGAT ABSEN PULANG (CHECK-OUT)
  // Window: Saat jam pulang hingga 1.5 jam setelah jam pulang (misal 16:55 - 18:30)
  if (todayAttendance && todayAttendance.checkInTime && !todayAttendance.checkOutTime) {
    const isWithinEveningWindow = currentTimeVal >= (shiftOutMinutes - 10) && currentTimeVal <= (shiftOutMinutes + 90);
    const alreadyRemindedOut = localStorage.getItem(checkOutKey);

    if (isWithinEveningWindow && !alreadyRemindedOut) {
      showSystemNotification('🏢 Pengingat Absensi Pulang (DMJ HRIS)', {
        body: `Halo ${currentUser.name}, jam kerja hari ini telah berakhir (${shiftCheckOutStr} WIB). Jangan lupa lakukan presensi pulang sebelum meninggalkan site.`,
        tag: 'attendance-checkout-reminder',
        url: '/?tab=attendance',
        vibrate: [300, 150, 300]
      });
      localStorage.setItem(checkOutKey, 'true');
    }
  }
}
