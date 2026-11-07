import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Zap, Crown, Lock } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardTab } from './components/DashboardTab';
import { HrRoomTab } from './components/HrRoomTab';
import { PresensiCameraTab } from './components/PresensiCameraTab';
import { ApprovalHubTab } from './components/ApprovalHubTab';
import { EmployeeManagementTab } from './components/EmployeeManagementTab';
import { SalaryRulesTab } from './components/SalaryRulesTab';
import { PayrollTab } from './components/PayrollTab';
import { CommercialProposalTab } from './components/CommercialProposalTab';
import { InvoiceTab } from './components/InvoiceTab';
import { UserPerformanceTab } from './components/UserPerformanceTab';
import { NotificationApprovalModal } from './components/NotificationApprovalModal';
import { TourDemoModal } from './components/TourDemoModal';
import { LoginPage } from './components/LoginPage';
import { AuditLogTab } from './components/AuditLogTab';
import { ProjectManagementTab } from './components/ProjectManagementTab';
import { ProjectDashboardTab } from './components/ProjectDashboardTab';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ProfileTabId } from './components/ProfileSettingsModal';
import { QuickAttendancePublicPortal } from './components/QuickAttendancePublicPortal';
import { AnnualWorkCalendarTab } from './components/AnnualWorkCalendarTab';
import { CasualWorkerAttendanceTab } from './components/CasualWorkerAttendanceTab';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { PwaUpdateToast } from './components/PwaUpdateToast';
import { BiometricDailyReminderModal } from './components/BiometricDailyReminderModal';
import { BiometricEnrollmentModal } from './components/BiometricEnrollmentModal';

import {
  INITIAL_EMPLOYEES,
  INITIAL_PROJECTS,
  INITIAL_ATTENDANCE,
  INITIAL_APPROVALS,
  INITIAL_SALARY_RULES
} from './data/mockData';
import { Employee, AttendanceRecord, AttendanceMode, AttendanceStatus, ApprovalItem, Project, SalaryRuleConfig, getEffectiveSystemRole, isHrEmployee, isFinanceEmployee, AuthUser, canAccessProjectModule, isProjectManager, AnnualWorkCalendarConfig, BiometricProfile } from './types';
import { api } from './services/api';
import { rtcService } from './services/rtcService';

export function App() {
  // Public Kiosk Portal Mode (Tanpa Login)
  const [isKioskPortalActive, setIsKioskPortalActive] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const tab = searchParams.get('tab');
      const view = searchParams.get('view');
      const kiosk = searchParams.get('kiosk');
      const mode = searchParams.get('mode');
      const hash = window.location.hash.replace('#', '');
      return tab === 'kiosk' || view === 'kiosk' || kiosk === 'true' || kiosk === '1' || mode === 'presensi' || hash === 'kiosk';
    }
    return false;
  });

  // Auto-invalidation build ID (Membersihkan cache lama saat versi baru dirilis)
  const APP_BUILD_ID = '20261107_v2_biometric_daily';
  if (typeof window !== 'undefined') {
    try {
      const savedBuild = localStorage.getItem('prime_hris_build_id');
      if (savedBuild !== APP_BUILD_ID) {
        localStorage.setItem('prime_hris_build_id', APP_BUILD_ID);
        localStorage.removeItem('prime_hris_bootstrap_cache');
      }
    } catch (e) {}
  }

  // Helper cache instan lokal 0ms (Stale-While-Revalidate pattern)
  const getInitialBootstrapCache = () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('prime_hris_bootstrap_cache');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.projects) && parsed.projects.length > 0) {
        return parsed;
      }
    } catch (e) {}
    return null;
  };
  const bootCache = getInitialBootstrapCache();

  // Global States (Prioritas: Cache Lokal 0ms -> Persistence -> Seed Data Resmi)
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedAuth = localStorage.getItem('prime_hris_auth_user');
        const token = localStorage.getItem('prime_hris_token');
        const savedAt = localStorage.getItem('prime_hris_session_saved_at');
        const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // Sesi 30 hari penuh

        if (savedAuth) {
          const isFresh = !savedAt || (Date.now() - Number(savedAt) < SESSION_MAX_AGE_MS);
          if (isFresh) {
            if (token) {
              api.setAuthToken(token);
            }
            return JSON.parse(savedAuth);
          }
        }
      } catch (e) {}
    }
    return null;
  });
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [employees, setEmployees] = useState<Employee[]>(() => (bootCache?.employees && bootCache.employees.length > 0) ? bootCache.employees : INITIAL_EMPLOYEES);
  const [currentUser, setCurrentUser] = useState<Employee>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedUser = localStorage.getItem('prime_hris_current_user');
        if (savedUser) return JSON.parse(savedUser);
        const savedAuth = localStorage.getItem('prime_hris_auth_user');
        if (savedAuth) {
          const parsed = JSON.parse(savedAuth);
          if (parsed && parsed.employee) return parsed.employee;
        }
      } catch (e) {}
    }
    const galih = (bootCache?.employees || []).find((e: Employee) => e.id === 'EMP-001') || INITIAL_EMPLOYEES[0];
    return galih;
  });
  const [impersonatorUser, setImpersonatorUser] = useState<Employee | null>(null);
  const [projects, setProjects] = useState<Project[]>(() => (bootCache?.projects && bootCache.projects.length > 0) ? bootCache.projects : INITIAL_PROJECTS);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>(() => (bootCache?.attendances && bootCache.attendances.length > 0) ? bootCache.attendances : INITIAL_ATTENDANCE);
  const [approvals, setApprovals] = useState<ApprovalItem[]>(() => (bootCache?.approvals && bootCache.approvals.length > 0) ? bootCache.approvals : INITIAL_APPROVALS);
  const [salaryRules, setSalaryRules] = useState<SalaryRuleConfig>(() => bootCache?.salaryRules || INITIAL_SALARY_RULES);

  // Notification & Approval Modal Popup State
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState<boolean>(false);
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);

  // Profile Settings Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [profileModalInitialTab, setProfileModalInitialTab] = useState<ProfileTabId>('profile');

  const handleOpenProfileModal = (tab: ProfileTabId = 'profile') => {
    setProfileModalInitialTab(tab);
    setIsProfileModalOpen(true);
  };

  // Biometric Daily Reminder Modal State (1 hari muncul sekali jika belum terdaftar)
  const [isBiometricReminderOpen, setIsBiometricReminderOpen] = useState<boolean>(false);
  const [isDirectBiometricEnrollOpen, setIsDirectBiometricEnrollOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!currentUser || impersonatorUser || isKioskPortalActive) return;

    const isEnrolled = Boolean(
      currentUser.biometric?.isEnrolled &&
      currentUser.biometric?.samples &&
      (currentUser.biometric.samples.front || currentUser.biometric.samples.smile)
    );

    if (isEnrolled) {
      setIsBiometricReminderOpen(false);
      return;
    }

    if (typeof window !== 'undefined') {
      const todayStr = new Date().toISOString().slice(0, 10);
      const storageKey = `prime_hris_biometric_daily_prompt_${currentUser.id}`;
      const lastPromptDate = localStorage.getItem(storageKey);

      if (lastPromptDate !== todayStr) {
        const timer = setTimeout(() => {
          setIsBiometricReminderOpen(true);
          localStorage.setItem(storageKey, todayStr);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [currentUser?.id, currentUser?.biometric?.isEnrolled, impersonatorUser, isKioskPortalActive]);

  // SQLite Database Sync State
  const [isDbLoading, setIsDbLoading] = useState<boolean>(true);
  const [dbInfo, setDbInfo] = useState<any>(null);
  const [workCalendar, setWorkCalendar] = useState<AnnualWorkCalendarConfig | null>(() => bootCache?.workCalendar || null);

  // Active Tab - Default to Presensi Kamera ('attendance') upon app open or login
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const queryTab = searchParams.get('tab');
      if (queryTab) return queryTab;
      const hash = window.location.hash.replace('#', '');
      if (hash) return hash;
    }
    return 'attendance';
  });
  
  // Project Filter state for Payroll
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');

  // Pastikan currentUser selalu terupdate reaktif jika data penugasan proyeknya diubah di tab lain
  useEffect(() => {
    const updated = employees.find(e => e.id === currentUser.id);
    if (updated && updated.assignedProjectId !== currentUser.assignedProjectId) {
      setCurrentUser(updated);
      try { localStorage.setItem('prime_hris_current_user', JSON.stringify(updated)); } catch (e) {}
    }
  }, [employees, currentUser.id, currentUser.assignedProjectId]);

  // SubView state for Unified Dashboard (hris, finance, performance)
  const [dashboardSubView, setDashboardSubView] = useState<'hris' | 'finance' | 'performance'>('hris');
  const [openLeaveModalDirectly, setOpenLeaveModalDirectly] = useState<boolean>(false);

  useEffect(() => {
    const unsub = rtcService.subscribe('WORK_CALENDAR_UPDATED', (packet) => {
      if (packet.payload) {
        setWorkCalendar(packet.payload);
      }
    });
    return () => unsub();
  }, []);

  // Real IP Network Detection & Smart Mapping state (Opsi 2: Status Kantor vs Luar Kantor)
  const [realDetectedIp, setRealDetectedIp] = useState<string>('103.31.205.218');
  const [realDetectedIsp, setRealDetectedIsp] = useState<string>('PT Biznet Gio Nusantara');
  const [realDetectedCity, setRealDetectedCity] = useState<string>('Surabaya / Head Office');
  const [simulatedNetworkMode, setSimulatedNetworkMode] = useState<'auto' | 'office' | 'remote'>('auto');
  const [customIpWhitelist, setCustomIpWhitelist] = useState<string[]>([]);

  // Calculate whether client is inside Office Network based on IP whitelist or simulation
  const isOfficeNetwork = useMemo(() => {
    if (simulatedNetworkMode === 'office') return true;
    if (simulatedNetworkMode === 'remote') return false;

    // 'auto' mode: check custom whitelist first
    if (customIpWhitelist.includes(realDetectedIp)) return true;

    // Check against authorized office IP networks
    const networks = salaryRules?.authorizedIpNetworks || [
      { ipOrSubnet: '103.31.205.218', label: 'Gateway Utama PRIME', isp: 'Biznet', isRegisteredOffice: true },
      { ipOrSubnet: '103.31.205.0/24', label: 'Subnet Enterprise PRIME', isp: 'Biznet', isRegisteredOffice: true },
      { ipOrSubnet: '180.252.0.0/16', label: 'Telkom Astinet Dedicated Site Manyar', isp: 'PT Telkom Indonesia', isRegisteredOffice: true },
      { ipOrSubnet: '192.168.10.0/24', label: 'Local Intranet Subnet Workshop & Engineering', isp: 'LAN DHCP Subnet', isRegisteredOffice: true }
    ];

    return networks.some(net => {
      if (net.ipOrSubnet === realDetectedIp) return true;
      if (net.ipOrSubnet.includes('/')) {
        const prefix = net.ipOrSubnet.split('/')[0].split('.').slice(0, 3).join('.');
        return realDetectedIp.startsWith(prefix);
      }
      return false;
    });
  }, [simulatedNetworkMode, customIpWhitelist, realDetectedIp, salaryRules?.authorizedIpNetworks]);

  const handleWhitelistCurrentIp = () => {
    if (realDetectedIp && !customIpWhitelist.includes(realDetectedIp)) {
      setCustomIpWhitelist(prev => [...prev, realDetectedIp]);
      api.logActivity({
        userName: currentUser.name,
        userNik: currentUser.nik,
        userRole: currentUser.role,
        module: 'SECURITY',
        action: 'IP_WHITELIST_ADD',
        entity: 'NetworkGateway',
        entityId: realDetectedIp,
        details: `Menambahkan IP publik ${realDetectedIp} (${realDetectedIsp || 'ISP'}) ke daftar jaringan resmi kantor`,
        status: 'SUCCESS',
        ipAddress: realDetectedIp
      }).catch(() => {});
    }
  };

  useEffect(() => {
    const detectClientIp = async () => {
      let clientIp = '';
      
      // Step 1: Detect client IP via internal backend (as received by Cloudflare Tunnel)
      try {
        const netRes = await fetch('/api/my-network');
        if (netRes.ok) {
          const netData = await netRes.json();
          if (netData.ip && netData.ip !== '127.0.0.1' && netData.ip !== '::1') {
            clientIp = netData.ip;
            setRealDetectedIp(clientIp);
          }
        }
      } catch (e) {
        console.warn('Backend network lookup fallback', e);
      }

      // Step 2: Query ipwho.is for ISP name and geographic location (with 2.5s strict timeout)
      try {
        const targetUrl = clientIp ? `https://ipwho.is/${clientIp}` : 'https://ipwho.is/';
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 2500);
        const res = await fetch(targetUrl, { signal: ctrl.signal });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (data && data.success) {
          setRealDetectedIp(data.ip);
          setRealDetectedIsp(data.connection?.isp || data.connection?.org || 'Provider Internet');
          setRealDetectedCity(`${data.city || 'Surabaya'}, ${data.region || 'Jawa Timur'}`);
          return;
        }
      } catch (err) {
        console.warn('IP detection primary failed, fallback', err);
      }

      // Step 3: Fallback to ipify if ipwho.is is blocked
      try {
        if (!clientIp) {
          const res2 = await fetch('https://api.ipify.org?format=json');
          const data2 = await res2.json();
          if (data2 && data2.ip) {
            setRealDetectedIp(data2.ip);
          }
        }
      } catch (err2) {
        console.warn('IP detection fallback failed', err2);
      }
    };
    detectClientIp();
  }, []);

  // Check persistent authentication session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = api.getAuthToken();
      if (!token) {
        setIsAuthChecking(false);
        return;
      }
      try {
        const res = await api.getMe();
        if (res.offline) {
          // Mode offline / PWA background cache: Pertahankan sesi lokal 30 hari
          console.info('[DMJ HRIS] Perangkat offline: mempertahankan sesi login 30 hari.');
          return;
        }
        if (res.success && res.user) {
          setAuthUser(res.user);
          if (res.token) {
            api.setAuthToken(res.token);
            try { localStorage.setItem('prime_hris_token', res.token); } catch (e) {}
          }
          try {
            localStorage.setItem('prime_hris_auth_user', JSON.stringify(res.user));
            localStorage.setItem('prime_hris_session_saved_at', String(Date.now()));
            if (res.user.employee) {
              localStorage.setItem('prime_hris_current_user', JSON.stringify(res.user.employee));
            }
          } catch (e) {}
          if (res.user.employee) {
            setCurrentUser(res.user.employee);
          }
        } else if ((res as any).status === 401 || (!res.success && !(res as any).offline)) {
          // Hanya hapus jika server menolak token secara eksplisit (misal akun dinonaktifkan)
          api.setAuthToken(null);
          setAuthUser(null);
          try {
            localStorage.removeItem('prime_hris_auth_user');
            localStorage.removeItem('prime_hris_token');
            localStorage.removeItem('prime_hris_current_user');
            localStorage.removeItem('prime_hris_session_saved_at');
          } catch (e) {}
        }
      } catch (err: any) {
        console.warn('getMe network warning:', err);
        // HANYA bersihkan sesi jika server eksplisit 401 Unauthorized
        // Jika hanya kendala jaringan, offline, atau timeout, sesi 30 hari tetap utuh!
        if (err?.message && (err.message.includes('401') || err.message.includes('Unauthorized') || err.message.includes('Sesi telah berakhir'))) {
          api.setAuthToken(null);
          setAuthUser(null);
          try {
            localStorage.removeItem('prime_hris_auth_user');
            localStorage.removeItem('prime_hris_token');
            localStorage.removeItem('prime_hris_current_user');
            localStorage.removeItem('prime_hris_session_saved_at');
          } catch (e) {}
        }
      } finally {
        setIsAuthChecking(false);
      }
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = (user: AuthUser, token: string) => {
    if (token) {
      api.setAuthToken(token);
    }
    try {
      localStorage.setItem('prime_hris_auth_user', JSON.stringify(user));
      if (token) {
        localStorage.setItem('prime_hris_token', token);
      }
      localStorage.setItem('prime_hris_session_saved_at', String(Date.now()));
      if (user.employee) {
        localStorage.setItem('prime_hris_current_user', JSON.stringify(user.employee));
      }
    } catch (e) {}
    setAuthUser(user);
    if (user.employee) {
      setCurrentUser(user.employee);
      // Immediately merge latest logged-in employee record into employees state
      setEmployees(prev => {
        const exists = prev.some(e => e.id === user.employee!.id);
        if (exists) {
          return prev.map(e => e.id === user.employee!.id ? user.employee! : e);
        }
        return [user.employee!, ...prev];
      });
    }
    // Sesuai instruksi Mr Prime: Saat aplikasi dibuka atau setelah login, langsung arahkan ke menu Presensi Kamera ('attendance')
    setActiveTab('attendance');
    
    // Refresh fresh bootstrap data from SQLite immediately upon login
    api.getBootstrapData().then(data => {
      if (data.employees && data.employees.length > 0) {
        setEmployees(data.employees);
        setCurrentUser(prev => {
          const fresh = data.employees.find((e: Employee) => e.id === prev.id);
          return fresh || prev;
        });
      }
      if (data.projects && data.projects.length > 0) setProjects(data.projects);
      if (Array.isArray(data.attendances)) setAttendances(data.attendances);
      if (data.approvals && data.approvals.length > 0) setApprovals(data.approvals);
      if (data.salaryRules) setSalaryRules(data.salaryRules);
      try {
        localStorage.setItem('prime_hris_bootstrap_cache', JSON.stringify({
          employees: data.employees,
          projects: data.projects,
          attendances: data.attendances,
          approvals: data.approvals,
          salaryRules: data.salaryRules,
          workCalendar: data.workCalendar
        }));
      } catch (e) {}
    }).catch(err => console.warn('Post-login bootstrap sync', err));
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', 'attendance');
        window.history.replaceState({}, '', url.toString());
      } catch (e) {}
    }
    const displayName = user.employee?.name || user.username;
    const displayNik = user.employee?.nik || 'NIK-SYSTEM';
    api.logActivity({
      userName: displayName,
      userNik: displayNik,
      userRole: user.role,
      module: 'AUTH',
      action: 'LOGIN_WEB',
      entity: 'UserSession',
      entityId: user.id,
      details: `Pengguna ${displayName} (${user.role}) berhasil masuk ke DMJ HRIS`,
      status: 'SUCCESS',
      ipAddress: realDetectedIp,
      metadata: { systemRole: user.systemRole, username: user.username }
    }).catch(() => {});
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('prime_hris_auth_user');
      localStorage.removeItem('prime_hris_token');
      localStorage.removeItem('prime_hris_current_user');
      localStorage.removeItem('prime_hris_session_saved_at');
    } catch (e) {}
    try {
      api.logActivity({
        userName: currentUser.name,
        userNik: currentUser.nik,
        userRole: currentUser.role,
        module: 'AUTH',
        action: 'USER_LOGOUT',
        entity: 'UserSession',
        entityId: currentUser.id,
        details: `Sesi login berakhir: ${currentUser.name} (${currentUser.nik}) keluar dari sistem`,
        status: 'SUCCESS',
        ipAddress: realDetectedIp
      }).catch(() => {});
    } catch (e) {
      // ignore
    }
    setImpersonatorUser(null);
    await api.logout();
    setAuthUser(null);
    setActiveTab('attendance');
  };

  // Load initial dataset directly from SQLite Database (only after authenticated or in kiosk mode)
  useEffect(() => {
    if (!authUser && !isKioskPortalActive) {
      setIsDbLoading(false);
      return;
    }

    const loadFromSqlite = async () => {
      setIsDbLoading(true);
      try {
        const data = await api.getBootstrapData();
        if (data.employees && data.employees.length > 0) {
          setEmployees(data.employees);
          // Never overwrite currentUser with data.employees[0]
          setCurrentUser(prev => {
            const fresh = data.employees.find((e: Employee) => e.id === prev.id);
            return fresh || prev;
          });
        }
        if (data.projects && data.projects.length > 0) {
          setProjects(data.projects);
        }
        if (Array.isArray(data.attendances)) {
          setAttendances(data.attendances);
        }
        if (data.approvals && data.approvals.length > 0) {
          setApprovals(data.approvals);
        }
        if (data.salaryRules) {
          setSalaryRules(data.salaryRules);
        }
        if (data.workCalendar) {
          setWorkCalendar(data.workCalendar);
        }
        if (data.dbInfo) {
          setDbInfo(data.dbInfo);
        }

        // Persist fresh bootstrap snapshot to localStorage for instant 0ms hydration
        try {
          localStorage.setItem('prime_hris_bootstrap_cache', JSON.stringify({
            employees: data.employees,
            projects: data.projects,
            attendances: data.attendances,
            approvals: data.approvals,
            salaryRules: data.salaryRules,
            workCalendar: data.workCalendar
          }));
        } catch (cacheErr) {
          console.warn('Failed to cache bootstrap data', cacheErr);
        }
      } catch (err) {
        console.warn('Fallback to local mock data (SQLite loading error)', err);
      } finally {
        setIsDbLoading(false);
      }
    };
    loadFromSqlite();
  }, [authUser?.id, isKioskPortalActive]);

  // Floating Live Notification Toast (SSE Multi-device Sync)
  const [liveToast, setLiveToast] = useState<{ message: string; type?: 'info' | 'success' | 'warn' } | null>(null);
  const liveToastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showLiveToast = (message: string, type: 'info' | 'success' | 'warn' = 'success') => {
    setLiveToast({ message, type });
    if (liveToastTimerRef.current) clearTimeout(liveToastTimerRef.current);
    liveToastTimerRef.current = setTimeout(() => setLiveToast(null), 4500);
  };

  // Keep references to currentUser and authUser for async RTC event handlers (avoid stale closures)
  const currentUserRef = useRef<Employee>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const authUserRef = useRef<AuthUser | null>(authUser);
  useEffect(() => {
    authUserRef.current = authUser;
  }, [authUser]);

  // Universal Bootstrap Cache Synchronization (Eliminates Cross-Device & Reload Desync)
  useEffect(() => {
    if (!authUser && !isKioskPortalActive) return;
    try {
      localStorage.setItem('prime_hris_bootstrap_cache', JSON.stringify({
        employees,
        projects,
        attendances,
        approvals,
        salaryRules,
        workCalendar
      }));
    } catch (e) {}
  }, [employees, projects, attendances, approvals, salaryRules, workCalendar, authUser, isKioskPortalActive]);

  // Real-Time Communication (WebSocket & SSE Engine) multi-device live sync
  useEffect(() => {
    const unsub = rtcService.subscribe('*', (packet) => {
      console.log('[RTC Live Event Received]', packet);
      if (packet.type === 'ATTENDANCE_SAVED') {
        const newAtt: AttendanceRecord = packet.payload;
        if (!newAtt || !newAtt.id) return;
        setAttendances(prev => {
          const existing = prev.find(a => a.id === newAtt.id || (a.employeeId === newAtt.employeeId && a.date === newAtt.date));
          const merged = existing ? { ...existing, ...newAtt } : newAtt;
          const rest = prev.filter(a => a.id !== merged.id && !(a.employeeId === merged.employeeId && a.date === merged.date));
          return [merged, ...rest];
        });

        // Pastikan toast notifikasi absen di pojok kiri bawah hanya muncul untuk user terkait saja
        const activeUser = currentUserRef.current;
        const activeAuth = authUserRef.current;
        const isSelfAttendance = Boolean(
          (activeUser && (newAtt.employeeId === activeUser.id || (activeUser.nik && newAtt.employeeNik === activeUser.nik))) ||
          (activeAuth && (newAtt.employeeId === activeAuth.employeeId || (activeAuth.employee?.nik && newAtt.employeeNik === activeAuth.employee.nik)))
        );

        if (isSelfAttendance) {
          const isCheckout = newAtt.attendanceType === 'CHECK_OUT' || (newAtt.checkOutTime && !newAtt.checkInTime);
          const actionLabel = isCheckout ? 'Absen Pulang' : 'Absen Masuk';
          const displayTime = isCheckout ? (newAtt.checkOutTime || newAtt.checkInTime) : newAtt.checkInTime;
          showLiveToast(`${actionLabel}: ${newAtt.employeeName} (${displayTime || ''} - ${newAtt.mode || 'WFO'})`, 'success');
        }
      } else if (packet.type === 'APPROVAL_DELETED_BATCH') {
        const { ids } = packet.payload || {};
        if (Array.isArray(ids) && ids.length > 0) {
          const idSet = new Set(ids);
          setApprovals(prev => prev.filter(a => !idSet.has(a.id)));
        }
      } else if (packet.type === 'APPROVAL_DELETED') {
        const { id } = packet.payload || {};
        if (id) {
          setApprovals(prev => prev.filter(a => a.id !== id));
        }
      } else if (packet.type === 'APPROVAL_UPDATED') {
        const { id, status, reviewNote, reviewedBy, item } = packet.payload;
        setApprovals(prev => prev.map(a => a.id === id ? { ...a, status, reviewNote, reviewedBy, ...(item || {}) } : a));
        showLiveToast(`Status Pengajuan Diperbarui: ${status} oleh ${reviewedBy || 'Atasan'}`, 'info');
      } else if (packet.type === 'APPROVAL_SUBMITTED') {
        const newItem: ApprovalItem = packet.payload;
        if (newItem && newItem.id) {
          setApprovals(prev => {
            const idx = prev.findIndex(a => a.id === newItem.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], ...newItem };
              return next;
            }
            return [newItem, ...prev];
          });
          showLiveToast(`Pengajuan Baru Masuk: ${newItem.employeeName} (${newItem.type})`, 'info');
        }
      } else if (packet.type === 'EMPLOYEE_SAVED' || packet.type === 'EMPLOYEE_UPDATED') {
        const updatedEmp: Employee = packet.payload;
        if (updatedEmp && updatedEmp.id) {
          setEmployees(prev => {
            const idx = prev.findIndex(e => e.id === updatedEmp.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], ...updatedEmp };
              return next;
            }
            return [updatedEmp, ...prev];
          });
          setCurrentUser(prev => {
            if (prev.id === updatedEmp.id) {
              const next = { ...prev, ...updatedEmp };
              try {
                localStorage.setItem('prime_hris_current_user', JSON.stringify(next));
              } catch (e) {}
              return next;
            }
            return prev;
          });
          setAuthUser(prev => {
            if (prev && prev.employee && prev.employee.id === updatedEmp.id) {
              const next = { ...prev, employee: { ...prev.employee, ...updatedEmp } };
              try {
                localStorage.setItem('prime_hris_auth_user', JSON.stringify(next));
              } catch (e) {}
              return next;
            }
            return prev;
          });
          try {
            const cachedBoot = localStorage.getItem('prime_hris_bootstrap_cache');
            if (cachedBoot) {
              const parsed = JSON.parse(cachedBoot);
              if (parsed.employees) {
                parsed.employees = parsed.employees.map((e: Employee) => e.id === updatedEmp.id ? { ...e, ...updatedEmp } : e);
                localStorage.setItem('prime_hris_bootstrap_cache', JSON.stringify(parsed));
              }
            }
          } catch (e) {}
        }
      } else if (packet.type === 'EMPLOYEE_DELETED') {
        const deletedId = packet.payload?.id || packet.payload;
        if (deletedId) {
          setEmployees(prev => prev.filter(e => e.id !== deletedId));
          try {
            const cachedBoot = localStorage.getItem('prime_hris_bootstrap_cache');
            if (cachedBoot) {
              const parsed = JSON.parse(cachedBoot);
              if (parsed.employees) {
                parsed.employees = parsed.employees.filter((e: Employee) => e.id !== deletedId);
                localStorage.setItem('prime_hris_bootstrap_cache', JSON.stringify(parsed));
              }
            }
          } catch (e) {}
        }
      } else if (packet.type === 'PROJECT_SAVED') {
        const newProj: Project = packet.payload;
        if (newProj && newProj.id) {
          setProjects(prev => {
            const idx = prev.findIndex(p => p.id === newProj.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], ...newProj };
              return next;
            }
            return [newProj, ...prev];
          });
          showLiveToast(`Proyek ${newProj.name || newProj.code} diperbarui`, 'info');
        }
      } else if (packet.type === 'SALARY_RULES_UPDATED') {
        const newRules: SalaryRuleConfig = packet.payload;
        if (newRules) {
          setSalaryRules(newRules);
          showLiveToast('Konfigurasi Geofence & Parameter Sistem Diperbarui', 'info');
        }
      } else if (packet.type === 'WORK_CALENDAR_UPDATED' || packet.type === 'WORK_CALENDAR_PERIOD_TOGGLED') {
        showLiveToast('Kalender Kerja & Periode Cut-off Diperbarui', 'info');
      } else if (packet.type === 'ATTENDANCE_DELETED') {
        const { id, linkedApprovalIds } = packet.payload || {};
        if (id) {
          setAttendances(prev => prev.filter(a => a.id !== id));
          if (Array.isArray(linkedApprovalIds) && linkedApprovalIds.length > 0) {
            setApprovals(prev => prev.filter(a => !linkedApprovalIds.includes(a.id) && a.attendanceRecordId !== id));
          } else {
            setApprovals(prev => prev.filter(a => a.attendanceRecordId !== id));
          }
          showLiveToast(`Data presensi berhasil dihapus`, 'info');
        }
      } else if (packet.type === 'RTC_RECONNECTED') {
        api.getBootstrapData().then(data => {
          if (data.employees && data.employees.length > 0) {
            setEmployees(data.employees);
            setCurrentUser(prev => {
              const fresh = data.employees.find((e: Employee) => e.id === prev.id);
              return fresh || prev;
            });
          }
          if (data.projects && data.projects.length > 0) setProjects(data.projects);
          if (data.attendances && data.attendances.length > 0) setAttendances(data.attendances);
          if (data.approvals && data.approvals.length > 0) setApprovals(data.approvals);
          if (data.salaryRules) setSalaryRules(data.salaryRules);
        }).catch(err => console.warn('[RTC] Background sync error', err));
      } else if (packet.type === 'DATABASE_RESET') {
        api.getBootstrapData().then(data => {
          if (data.employees) setEmployees(data.employees);
          if (data.projects) setProjects(data.projects);
          if (data.attendances) setAttendances(data.attendances);
          if (data.approvals) setApprovals(data.approvals);
          if (data.salaryRules) setSalaryRules(data.salaryRules);
        });
        showLiveToast('Database di-reset ke data awal', 'warn');
      }
    });

    return () => unsub();
  }, []);

  // Only launch Tour Demo if explicitly requested via query parameter (?tour=true)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('tour') === 'true' || searchParams.get('autotour') === '1') {
        const timer = setTimeout(() => {
          setIsTourOpen(true);
        }, 450);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleImpersonateUser = (targetEmp: Employee) => {
    if (targetEmp.id === currentUser.id) return;
    const realAdmin = impersonatorUser || currentUser;
    if (!impersonatorUser) {
      setImpersonatorUser(currentUser);
    }
    setCurrentUser(targetEmp);
    try {
      localStorage.setItem('prime_hris_current_user', JSON.stringify(targetEmp));
    } catch (e) {}

    const targetRole = getEffectiveSystemRole(targetEmp);
    if (targetRole === 'staff') {
      if (activeTab === 'system_settings' || activeTab === 'salary_rules' || activeTab === 'audit' || activeTab === 'wa_gateway' || activeTab === 'email_smtp' || activeTab === 'work_calendar') {
        setActiveTab('dashboard');
        setDashboardSubView('performance');
      } else if (activeTab === 'dashboard') {
        setDashboardSubView('performance');
      }
    }

    // Record impersonation in audit log
    api.logActivity({
      userName: realAdmin.name,
      userNik: realAdmin.nik,
      userRole: 'superuser',
      module: 'AUTH',
      action: 'IMPERSONATE_START',
      entity: 'UserSession',
      entityId: targetEmp.id,
      details: `Superuser ${realAdmin.name} mengimpersonate persona ${targetEmp.name} (${targetEmp.nik} - ${targetEmp.position})`,
      status: 'SUCCESS',
      ipAddress: realDetectedIp,
      metadata: { impersonator: realAdmin.name, target: targetEmp.name, targetNik: targetEmp.nik }
    }).catch(() => {});

    showLiveToast(`Mode Impersonasi: Sedang melihat sebagai ${targetEmp.name} (${targetEmp.nik})`, 'info');
  };

  const handleExitImpersonation = () => {
    if (!impersonatorUser) return;
    const originalUser = impersonatorUser;
    api.logActivity({
      userName: originalUser.name,
      userNik: originalUser.nik,
      userRole: 'superuser',
      module: 'AUTH',
      action: 'IMPERSONATE_EXIT',
      entity: 'UserSession',
      entityId: originalUser.id,
      details: `Superuser ${originalUser.name} keluar dari mode impersonasi, kembali ke akun master`,
      status: 'SUCCESS',
      ipAddress: realDetectedIp
    }).catch(() => {});

    setCurrentUser(originalUser);
    setImpersonatorUser(null);
    try {
      localStorage.setItem('prime_hris_current_user', JSON.stringify(originalUser));
    } catch (e) {}
    showLiveToast(`Keluar dari mode impersonasi. Kembali ke akun Superuser (${originalUser.name})`, 'info');
  };

  const handleSwitchUser = (newEmp: Employee) => {
    handleImpersonateUser(newEmp);
  };

  const handleNavigateToTab = (tabId: string, projectIdFilter?: string) => {
    if (tabId === 'approvals' && (projectIdFilter === 'new-leave' || projectIdFilter === 'new-correction')) {
      setActiveTab('approvals');
      setOpenLeaveModalDirectly(true);
      return;
    }

    // Sync URL with tabId & project query parameter without full reload
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tabId);
        if (projectIdFilter && projectIdFilter !== 'ALL') {
          url.searchParams.set('project', projectIdFilter);
        } else if (projectIdFilter === 'ALL') {
          url.searchParams.delete('project');
        }
        window.history.replaceState({}, '', url.toString());
      } catch (e) {
        // ignore
      }
    }

    if (tabId === 'kiosk') {
      setIsKioskPortalActive(true);
      return;
    } else {
      setIsKioskPortalActive(false);
    }

    const isMasterSuperuser = !impersonatorUser && authUser && (
      authUser.systemRole === 'superuser' ||
      authUser.role === 'Director' ||
      authUser.username === 'admin' ||
      authUser.username === 'galih'
    );

    const role = getEffectiveSystemRole(currentUser);
    if (!isMasterSuperuser && role === 'staff') {
      if (tabId === 'dashboard' || tabId === 'dashboard_hris' || tabId === 'dashboard_finance') {
        setActiveTab('dashboard');
        setDashboardSubView('performance');
        return;
      }
      if (tabId === 'system_settings' || tabId === 'salary_rules' || tabId === 'wa_gateway' || tabId === 'email_smtp' || tabId === 'work_calendar') {
        setActiveTab('dashboard');
        setDashboardSubView('performance');
        return;
      }
      if (tabId === 'audit' || tabId === 'invoices' || tabId === 'invoice') {
        setActiveTab('dashboard');
        setDashboardSubView('performance');
        return;
      }
      if (tabId === 'projects' || tabId === 'project_dashboard' || tabId === 'project_detail') {
        const canProjects = canAccessProjectModule(currentUser, projects);
        if (!canProjects) {
          setActiveTab('dashboard');
          setDashboardSubView('performance');
          return;
        }
      }
    }

    if (tabId === 'system_settings' || tabId === 'salary_rules' || tabId === 'wa_gateway' || tabId === 'email_smtp') {
      setActiveTab(tabId);
      return;
    }

    if (tabId === 'project_dashboard' || tabId === 'project_detail') {
      setActiveTab('project_dashboard');
    } else if (tabId === 'dashboard' || tabId === 'dashboard_hris') {
      setActiveTab('dashboard');
      setDashboardSubView('hris');
    } else if (tabId === 'dashboard_finance') {
      setActiveTab('dashboard');
      setDashboardSubView('finance');
    } else if (tabId === 'user_performance') {
      setActiveTab('dashboard');
      setDashboardSubView('performance');
    } else {
      setActiveTab(tabId);
    }
    if (projectIdFilter) {
      setSelectedProjectId(projectIdFilter);
    }
  };

  // Sync browser back/forward or hash changes
  useEffect(() => {
    const handleUrlSync = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const queryTab = searchParams.get('tab');
      const queryProject = searchParams.get('project') || undefined;
      if (queryTab) {
        handleNavigateToTab(queryTab, queryProject);
      } else if (window.location.hash) {
        handleNavigateToTab(window.location.hash.replace('#', ''), queryProject);
      }
    };
    window.addEventListener('popstate', handleUrlSync);
    window.addEventListener('hashchange', handleUrlSync);
    return () => {
      window.removeEventListener('popstate', handleUrlSync);
      window.removeEventListener('hashchange', handleUrlSync);
    };
  }, [currentUser]);

  // Submit new attendance record (Always promote most recent activity to index 0)
  const handleAttendanceSubmit = async (record: AttendanceRecord) => {
    setAttendances(prev => {
      const existing = prev.find(a => a.id === record.id || (a.employeeId === record.employeeId && a.date === record.date));
      const merged = existing ? { ...existing, ...record } : record;
      const rest = prev.filter(a => a.id !== merged.id && !(a.employeeId === merged.employeeId && a.date === merged.date));
      return [merged, ...rest];
    });

    // Save to authoritative SQLite backend: handles replacement and returns canonical approvals
    try {
      const res = await api.saveAttendance(record);
      if (res && res.record) {
        setAttendances(prev => {
          const existing = prev.find(a => a.id === res.record.id || (a.employeeId === res.record.employeeId && a.date === res.record.date));
          const merged = existing ? { ...existing, ...res.record } : res.record;
          const rest = prev.filter(a => a.id !== merged.id && !(a.employeeId === merged.employeeId && a.date === merged.date));
          return [merged, ...rest];
        });
      }

      // Reconcile approvals from backend Single Source of Truth (SSOT)
      if (res && res.removedApprovalIds && res.removedApprovalIds.length > 0) {
        const removedSet = new Set(res.removedApprovalIds);
        setApprovals(prev => prev.filter(a => !removedSet.has(a.id)));
      }

      if (res && res.approvalItem) {
        const newItem = res.approvalItem;
        setApprovals(prev => {
          const idx = prev.findIndex(a => a.id === newItem.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...newItem };
            return next;
          }
          return [newItem, ...prev];
        });
      }
    } catch (err) {
      console.error('Failed to save attendance to SQLite', err);
    }
  };

  // Handle attendance correction / update from HR Manager
  const handleUpdateAttendance = (record: AttendanceRecord) => {
    setAttendances(prev => {
      const idx = prev.findIndex(a => a.id === record.id || (a.employeeId === record.employeeId && a.date === record.date));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = record;
        return next;
      }
      return [record, ...prev];
    });

    // Save to SQLite asynchronously
    api.saveAttendance(record).catch(err => {
      console.error('Failed to save attendance correction to SQLite', err);
      showLiveToast('Gagal menyimpan koreksi presensi ke server: ' + (err.message || err), 'warn');
    });
  };

  // Handle delete attendance record (Superuser direct deletion for testing/trial)
  const handleDeleteAttendance = async (id: string) => {
    try {
      const res = await api.deleteAttendance(id);
      if (res.success) {
        setAttendances(prev => prev.filter(a => a.id !== id));
        setApprovals(prev => prev.filter(a => a.attendanceRecordId !== id));
        showLiveToast('Rekaman presensi berhasil dihapus oleh Superuser', 'success');
      } else {
        alert(res.error || 'Gagal menghapus rekaman presensi');
      }
    } catch (err: any) {
      alert(`Gagal menghapus: ${err.message}`);
    }
  };

  // Approval actions
  const handleApprove = (id: string, reviewerNote?: string, options?: { waiveLateDeduction?: boolean; deductionWaived?: boolean }) => {
    const targetItem = approvals.find(a => a.id === id);
    const applicantProj = (projects || []).find(p => 
      p.id === targetItem?.projectId || 
      p.code === targetItem?.projectCode ||
      p.id === employees.find(e => e.id === targetItem?.employeeId)?.assignedProjectId
    );
    const projectAdminIds = targetItem?.projectAdminIds || applicantProj?.projectAdminIds || [];
    const isUserProjectAdmin = projectAdminIds.includes(currentUser.id);
    const isPm = targetItem?.projectManagerId === currentUser.id || applicantProj?.projectManagerId === currentUser.id;

    const isPmStage = Boolean(
      targetItem &&
      targetItem.type !== 'SLIP_ACCESS' &&
      targetItem.type !== 'KASBON' &&
      (targetItem.targetApproverRole === 'PM' || targetItem.stage === 'PM' || !targetItem.stage) &&
      !targetItem.pmApprovedBy &&
      (targetItem.projectManagerId || applicantProj?.projectManagerId || projectAdminIds.length > 0)
    );

    const approverTitle = isUserProjectAdmin && !isPm
      ? `${currentUser.name} (Admin Proyek)`
      : `${currentUser.name} (${currentUser.role})`;

    api.updateApproval(id, 'APPROVED', reviewerNote, approverTitle, options)
      .then(res => {
        if (res.item) {
          setApprovals(prev => prev.map(a => a.id === id ? res.item : a));
        }
      })
      .catch(err => {
        console.error('Failed to update approval in SQLite', err);
        showLiveToast('Gagal memproses persetujuan ke server: ' + (err.message || err), 'warn');
      });

    if (isPmStage) {
      const applicant = employees.find(e => e.id === targetItem?.employeeId);
      const isApplicantHr = isHrEmployee(applicant) || targetItem?.employeeId === 'EMP-022';
      const nextTargetRole = isApplicantHr ? 'FINANCE' : 'HR';

      setApprovals(prev =>
        prev.map(item => {
          if (item.id === id) {
            return {
              ...item,
              pmApprovedBy: approverTitle,
              pmApprovedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
              pmReviewNote: reviewerNote,
              targetApproverRole: nextTargetRole,
              stage: nextTargetRole,
              status: 'PENDING',
              requiresHrApproval: !isApplicantHr,
              requiresFinanceApproval: isApplicantHr
            };
          }
          return item;
        })
      );
      showLiveToast(`Persetujuan Tahap 1 (${isUserProjectAdmin && !isPm ? 'Admin Proyek' : 'PM'}) Berhasil. Pengajuan diteruskan ke ${isApplicantHr ? 'Finance Manager' : 'HR Manager'} untuk otorisasi akhir.`, 'success');
      return;
    }

    setApprovals(prev =>
      prev.map(item => {
        if (item.id === id) {
          // If this is a leave request, deduct from employee quota!
          if (item.type === 'LEAVE' && item.daysCount) {
            setEmployees(empList =>
              empList.map(e => {
                if (e.id === item.employeeId) {
                  if (item.leaveType === 'CUTI_ROSTER_NON_LOKAL' && e.nonLokalLeaveConfig) {
                    const cfg = e.nonLokalLeaveConfig;
                    const days = item.daysCount || 1;
                    const lastDate = item.startDate || new Date().toISOString().split('T')[0];
                    let nextEligible = cfg.nextEligibleLeaveDate;
                    try {
                      const [y, m, d] = lastDate.split('-').map(Number);
                      let nextM = m + (cfg.rosterCycleMonths || 3);
                      let nextY = y;
                      if (nextM > 12) {
                        nextY += Math.floor((nextM - 1) / 12);
                        nextM = ((nextM - 1) % 12) + 1;
                      }
                      nextEligible = `${nextY}-${String(nextM).padStart(2, '0')}-${String(Math.min(d, 28)).padStart(2, '0')}`;
                    } catch (err) {}

                    return {
                      ...e,
                      nonLokalLeaveConfig: {
                        ...cfg,
                        usedPeriodLeave: (cfg.usedPeriodLeave || 0) + days,
                        lastLeaveDate: lastDate,
                        nextEligibleLeaveDate: nextEligible
                      }
                    };
                  }
                  return { ...e, usedLeave: e.usedLeave + (item.daysCount || 1) };
                }
                return e;
              })
            );
          }

          // If this is an attendance correction, update or add the attendance record in React state
          if (item.type === 'ATTENDANCE_CORRECTION') {
            const corrDate = item.startDate;
            const reviewerName = `${currentUser.name} (${currentUser.role})`;
            setAttendances(attList => {
              const existingIdx = attList.findIndex(a => a.employeeId === item.employeeId && a.date === corrDate);
              const targetStatus: AttendanceStatus = (item.targetStatus as AttendanceStatus) || 'ON_TIME';
              const targetMode: AttendanceMode = item.targetStatus === 'DINAS_LUAR' ? 'DINAS_LUAR' : 'WFO';
              const isLate = targetStatus === 'LATE';
              const targetLateMinutes = isLate ? 30 : 0;
              if (existingIdx >= 0) {
                const nextList = [...attList];
                nextList[existingIdx] = {
                  ...nextList[existingIdx],
                  checkInTime: item.targetCheckInTime || nextList[existingIdx].checkInTime || '08:00:00',
                  checkOutTime: item.targetCheckOutTime || nextList[existingIdx].checkOutTime,
                  status: targetStatus,
                  mode: targetMode,
                  isLate,
                  lateMinutes: targetLateMinutes,
                  approvalStatus: 'APPROVED',
                  approvedBy: reviewerName,
                  approvalDate: new Date().toISOString().substring(0, 10),
                  approvalNote: reviewerNote || 'Disetujui via koreksi absensi',
                  isHrCorrected: true,
                  hrCorrectedBy: reviewerName,
                  hrCorrectedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
                  hrCorrectionNotes: item.description || reviewerNote
                };
                return nextList;
              } else {
                const newAtt: AttendanceRecord = {
                  id: `ATT-CORR-${item.id}`,
                  employeeId: item.employeeId,
                  employeeLoginId: item.employeeLoginId,
                  employeeName: item.employeeName,
                  employeeNik: item.employeeNik || '',
                  department: item.department || 'Operasional',
                  date: corrDate,
                  checkInTime: item.targetCheckInTime || '08:00:00',
                  checkOutTime: item.targetCheckOutTime,
                  mode: targetMode,
                  status: targetStatus,
                  photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
                  location: {
                    lat: -6.2088,
                    lng: 106.8456,
                    accuracy: 10,
                    address: item.projectName || 'Site Penugasan Proyek',
                    inGeofence: true,
                    distanceMeters: 0
                  },
                  note: `Disetujui koreksi absensi oleh ${reviewerName}`,
                  isLate,
                  lateMinutes: targetLateMinutes,
                  approvalStatus: 'APPROVED',
                  approvedBy: reviewerName,
                  approvalDate: new Date().toISOString().substring(0, 10),
                  approvalNote: reviewerNote || 'Disetujui via koreksi absensi',
                  isHrCorrected: true,
                  hrCorrectedBy: reviewerName,
                  hrCorrectedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
                  hrCorrectionNotes: item.description || reviewerNote
                };
                return [newAtt, ...attList];
              }
            });
          }

          // If this is a late justification, mark the corresponding attendance as approved
          const isLateWaiver = options?.waiveLateDeduction !== undefined 
            ? options.waiveLateDeduction 
            : (options?.deductionWaived !== undefined ? options.deductionWaived : true);

          if (item.attendanceRecordId || (item.employeeId && item.startDate && (item.type === 'LATE_JUSTIFICATION' || (item.lateMinutes && item.lateMinutes > 0)))) {
            setAttendances(attList =>
              attList.map(a => {
                if (a.id === item.attendanceRecordId || (a.employeeId === item.employeeId && a.date === item.startDate)) {
                  return {
                    ...a,
                    approvalStatus: 'APPROVED',
                    deductionWaived: isLateWaiver,
                    isLateDeductionWaived: isLateWaiver
                  };
                }
                return a;
              })
            );
          }

          // If this is SLIP_ACCESS, calculate 10 minutes (600s) active window
          if (item.type === 'SLIP_ACCESS') {
            const expiryIso = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            return {
              ...item,
              status: 'APPROVED',
              stage: 'FINAL',
              slipAccessExpiresAt: expiryIso,
              financeApprovedBy: `${currentUser.name} (${currentUser.role})`,
              financeApprovedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
              reviewedBy: `${currentUser.name} (${currentUser.role})`,
              reviewedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
              reviewNote: reviewerNote || 'Disetujui oleh Finance (Akses Terbuka 10 Menit)'
            };
          }

          const applicant = employees.find(e => e.id === item.employeeId);
          const isApplicantHr = isHrEmployee(applicant) || item.employeeId === 'EMP-022';
          const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

          return {
            ...item,
            status: 'APPROVED',
            stage: 'FINAL',
            hrApprovedBy: isApplicantHr ? item.hrApprovedBy : approverTitle,
            hrApprovedAt: isApplicantHr ? item.hrApprovedAt : nowStr,
            financeApprovedBy: isApplicantHr ? approverTitle : item.financeApprovedBy,
            financeApprovedAt: isApplicantHr ? nowStr : item.financeApprovedAt,
            reviewedBy: approverTitle,
            reviewedAt: nowStr,
            reviewNote: reviewerNote || (isApplicantHr ? 'Disetujui oleh Finance Manager (Otorisasi Silang).' : 'Disetujui.')
          };
        }
        return item;
      })
    );
  };

  const handleReject = (id: string, reviewerNote?: string) => {
    api.updateApproval(id, 'REJECTED', reviewerNote, `${currentUser.name} (${currentUser.role})`)
      .catch(err => {
        console.error('Failed to update approval in SQLite', err);
        showLiveToast('Gagal menolak pengajuan ke server: ' + (err.message || err), 'warn');
      });

    setApprovals(prev =>
      prev.map(item => {
        if (item.id === id) {
          if (item.attendanceRecordId) {
            setAttendances(attList =>
              attList.map(a => {
                if (a.id === item.attendanceRecordId) {
                  return { ...a, approvalStatus: 'REJECTED' };
                }
                return a;
              })
            );
          }
          return {
            ...item,
            status: 'REJECTED',
            reviewedBy: `${currentUser.name} (${currentUser.role})`,
            reviewedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
            reviewNote: reviewerNote || 'Ditolak.'
          };
        }
        return item;
      })
    );
  };

  const handleRequestRevision = (id: string, reviewerNote?: string) => {
    api.updateApproval(id, 'REVISION_REQUESTED', reviewerNote, `${currentUser.name} (${currentUser.role})`)
      .catch(err => {
        console.error('Failed to update approval in SQLite', err);
        showLiveToast('Gagal meminta revisi ke server: ' + (err.message || err), 'warn');
      });

    setApprovals(prev =>
      prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            status: 'REVISION_REQUESTED',
            reviewedBy: `${currentUser.name} (${currentUser.role})`,
            reviewedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
            reviewNote: reviewerNote || 'Mohon melengkapi berkas pendukung.'
          };
        }
        return item;
      })
    );
  };

  const handleSubmitNewLeaveRequest = (item: ApprovalItem) => {
    setApprovals(prev => [item, ...prev]);
    api.submitApproval(item).catch(err => {
      console.error('Failed to submit approval to SQLite', err);
      showLiveToast('Gagal mengirimkan pengajuan ke server: ' + (err.message || err), 'warn');
    });
  };

  // Employee CRUD (User Management)
  const handleAddEmployee = async (emp: Employee) => {
    try {
      const res = await api.saveEmployee(emp);
      const savedEmp = res?.employee || emp;
      setEmployees(prev => [...prev.filter(e => e.id !== savedEmp.id), savedEmp]);
      showLiveToast(`Karyawan ${savedEmp.name} (ID: ${savedEmp.loginId || savedEmp.nik}) berhasil didaftarkan!`, 'success');
      return savedEmp;
    } catch (err: any) {
      console.error('Failed to save employee to SQLite', err);
      showLiveToast('Gagal menambahkan karyawan: ' + (err.message || err), 'warn');
      throw err;
    }
  };

  const handleUpdateEmployee = async (emp: Employee) => {
    setEmployees(prev => prev.map(e => (e.id === emp.id ? { ...e, ...emp } : e)));
    if (currentUser.id === emp.id) {
      setCurrentUser(emp);
      try { localStorage.setItem('prime_hris_current_user', JSON.stringify(emp)); } catch (e) {}
    }
    if (authUser && authUser.employee && authUser.employee.id === emp.id) {
      const updatedAuth: AuthUser = {
        ...authUser,
        role: emp.role,
        systemRole: emp.systemRole || authUser.systemRole,
        employee: emp
      };
      setAuthUser(updatedAuth);
      try { localStorage.setItem('prime_hris_auth_user', JSON.stringify(updatedAuth)); } catch (e) {}
    }

    try {
      const cachedBoot = localStorage.getItem('prime_hris_bootstrap_cache');
      if (cachedBoot) {
        const parsed = JSON.parse(cachedBoot);
        if (parsed.employees) {
          parsed.employees = parsed.employees.map((e: Employee) => e.id === emp.id ? { ...e, ...emp } : e);
          localStorage.setItem('prime_hris_bootstrap_cache', JSON.stringify(parsed));
        }
      }
    } catch (e) {}

    try {
      const res = await api.saveEmployee(emp);
      if (res && res.employee) {
        setEmployees(prev => prev.map(e => (e.id === res.employee.id ? res.employee : e)));
        if (currentUser.id === res.employee.id) {
          setCurrentUser(res.employee);
          try { localStorage.setItem('prime_hris_current_user', JSON.stringify(res.employee)); } catch (e) {}
        }
      }
    } catch (err: any) {
      console.error('Failed to update employee in SQLite:', err);
      showLiveToast(`Gagal menyimpan perubahan ke database: ${err.message || 'Error'}`, 'warn');
      throw err;
    }
  };

  const handleSaveDirectBiometric = async (profile: BiometricProfile, updateAvatarAsWell: boolean) => {
    try {
      const res = await api.saveBiometricProfile(currentUser.id, profile, updateAvatarAsWell);
      handleUpdateEmployee(res.employee);
      setIsDirectBiometricEnrollOpen(false);
      showLiveToast('Profil biometrik wajah 4-pose berhasil didaftarkan!', 'success');
    } catch (err: any) {
      console.error('Failed to save biometric profile:', err);
      showLiveToast(err?.message || 'Gagal menyimpan profil biometrik', 'warn');
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    // 1. Optimistic UI update
    setEmployees(prev => prev.filter(e => e.id !== id));

    // 2. Synchronize localStorage bootstrap cache
    try {
      const cachedBoot = localStorage.getItem('prime_hris_bootstrap_cache');
      if (cachedBoot) {
        const parsed = JSON.parse(cachedBoot);
        if (parsed.employees) {
          parsed.employees = parsed.employees.filter((e: Employee) => e.id !== id);
          localStorage.setItem('prime_hris_bootstrap_cache', JSON.stringify(parsed));
        }
      }
    } catch (e) {}

    // 3. Persist deletion in SQLite database
    try {
      await api.deleteEmployee(id);
      showLiveToast('Karyawan berhasil dihapus permanen dari sistem', 'success');
    } catch (err: any) {
      console.error('Failed to delete employee in SQLite backend:', err);
      showLiveToast(`Gagal menghapus karyawan dari database: ${err.message || 'Error'}`, 'warn');
    }
  };

  const handleUpdateSalaryRules = (newRules: SalaryRuleConfig) => {
    setSalaryRules(newRules);
    api.saveSalaryRules(newRules).catch(err => {
      console.error('Failed to update salary rules in SQLite', err);
      showLiveToast('Gagal memperbarui aturan gaji ke server: ' + (err.message || err), 'warn');
    });
  };

  // Project CRUD & Personnel Placement
  const handleSaveProject = (proj: Project, updatedEmployees?: Employee[]) => {
    setProjects(prev => {
      const idx = prev.findIndex(p => p.id === proj.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = proj;
        return next;
      }
      return [proj, ...prev];
    });

    api.saveProject(proj).catch(err => {
      console.error('Failed to save project to SQLite', err);
      showLiveToast('Gagal menyimpan konfigurasi proyek ke server: ' + (err.message || err), 'warn');
    });

    if (updatedEmployees && updatedEmployees.length > 0) {
      setEmployees(prev => {
        const map = new Map(prev.map(e => [e.id, e]));
        updatedEmployees.forEach(e => {
          map.set(e.id, e);
          api.saveEmployee(e).catch(err => console.error('Failed to save reassigned employee to SQLite', err));
          if (currentUser.id === e.id) {
            setCurrentUser(e);
            try { localStorage.setItem('prime_hris_current_user', JSON.stringify(e)); } catch (err) {}
          }
        });
        return Array.from(map.values());
      });
    }
  };

  const pendingApprovalsCount = approvals.filter(a => a.status === 'PENDING').length;

  const userSystemRole = getEffectiveSystemRole(currentUser);
  const isStaffUser = userSystemRole === 'staff';
  const isUserPm = isProjectManager(currentUser, projects);
  const canAccessProjects = canAccessProjectModule(currentUser, projects);
  const effectiveNotificationCount = isStaffUser
    ? approvals.filter(a => a.employeeId === currentUser.id && (a.status === 'PENDING' || a.status === 'REVISION_REQUESTED' || a.status === 'REJECTED')).length
    : pendingApprovalsCount;

  // Public Kiosk Portal Mode (Tanpa Login)
  if (isKioskPortalActive) {
    return (
      <QuickAttendancePublicPortal
        onGoToLogin={() => {
          setIsKioskPortalActive(false);
          if (typeof window !== 'undefined') {
            try {
              const url = new URL(window.location.href);
              url.searchParams.delete('tab');
              url.searchParams.delete('view');
              url.searchParams.delete('kiosk');
              url.searchParams.delete('mode');
              window.history.replaceState({}, '', url.toString());
            } catch (e) {}
          }
        }}
      />
    );
  }

  // Session verification screen
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-3xl shadow-xl shadow-blue-500/30 mb-4 animate-pulse">
          P
        </div>
        <div className="w-6 h-6 border-2 border-blue-400 border-t-white rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-mono text-slate-400">Memverifikasi Sesi DMJ HRIS...</p>
      </div>
    );
  }

  // Not authenticated: render Login Page
  if (!authUser) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onOpenKiosk={() => setIsKioskPortalActive(true)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col selection:bg-orange-500 selection:text-white w-full max-w-full overflow-x-hidden">
      
      {/* Top Sticky Impersonation Indicator Banner */}
      {impersonatorUser && (
        <aside aria-label="Mode Impersonasi Aktif" className="sticky top-0 z-[100] w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 px-4 py-2 text-xs font-bold shadow-md flex flex-wrap items-center justify-between gap-3 border-b border-amber-600/40 animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-black/20 text-white flex items-center justify-center shrink-0">
              <Crown className="w-3.5 h-3.5 text-amber-200" />
            </div>
            <div>
              <span className="font-black uppercase tracking-wider text-[11px] text-amber-950 mr-1.5">
                👑 Mode Impersonasi Aktif:
              </span>
              <span className="text-white font-extrabold">{currentUser.name}</span>{' '}
              <span className="text-amber-100 font-mono text-[10.5px]">({currentUser.nik} • {currentUser.position})</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[10.5px] text-amber-950 font-semibold hidden md:inline">
              Akun Master: <strong>{impersonatorUser.name}</strong>
            </span>
            <button
              type="button"
              onClick={handleExitImpersonation}
              className="px-3 py-1 rounded-lg bg-slate-950 hover:bg-slate-900 active:scale-95 text-white font-extrabold text-[11px] shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>✕ Keluar & Kembali ke Superuser</span>
            </button>
          </div>
        </aside>
      )}

      {/* Top Glass Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        allUsers={isStaffUser ? [currentUser] : employees}
        onSwitchUser={handleSwitchUser}
        onUpdateEmployee={handleUpdateEmployee}
        pendingApprovalsCount={effectiveNotificationCount}
        onNavigateToTab={handleNavigateToTab}
        onOpenNotificationModal={() => setIsNotificationModalOpen(true)}
        onStartTour={() => setIsTourOpen(true)}
        realDetectedIp={realDetectedIp}
        realDetectedIsp={realDetectedIsp}
        realDetectedCity={realDetectedCity}
        isOfficeNetwork={isOfficeNetwork}
        authUser={authUser}
        onLogout={handleLogout}
        isProfileModalOpenControlled={isProfileModalOpen}
        onOpenProfileModalControlled={handleOpenProfileModal}
        onCloseProfileModalControlled={() => setIsProfileModalOpen(false)}
        profileModalInitialTabControlled={profileModalInitialTab}
        impersonatorUser={impersonatorUser}
        onExitImpersonation={handleExitImpersonation}
        projects={projects}
      />

      {/* Floating Pill Sidebar Dock (Desktop) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleNavigateToTab}
        userRole={currentUser.role}
        systemRole={userSystemRole}
        currentUser={currentUser}
        pendingApprovalsCount={effectiveNotificationCount}
        projects={projects}
      />

      {/* Mobile Bottom Navigation Dock (Screens < 768px) */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={handleNavigateToTab}
        currentUser={currentUser}
        pendingApprovalsCount={effectiveNotificationCount}
        onOpenNotificationModal={() => setIsNotificationModalOpen(true)}
        onOpenProfileModal={handleOpenProfileModal}
        onStartTour={() => setIsTourOpen(true)}
        onLogout={handleLogout}
        realDetectedIp={realDetectedIp}
        isOfficeNetwork={isOfficeNetwork}
        projects={projects}
      />

      {/* Mobile Navigation Tabs (Screens < 768px) */}
      <div className="md:hidden sticky top-16 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-3 py-2 flex items-center gap-2 overflow-x-auto no-print">
        {(userSystemRole === 'staff'
          ? [
              { id: 'dashboard', label: isUserPm ? 'Kinerja & Proyek' : 'Kinerja Saya' },
              { id: 'attendance', label: 'Presensi Kamera' },
              ...(isUserPm ? [
                { id: 'projects', label: 'Proyek & Site' },
                { id: 'casual_attendance', label: 'Presensi Tukang' }
              ] : []),
              { id: 'approvals', label: isUserPm ? 'Approval Proyek' : 'Pengajuan' },
              { id: 'payroll', label: 'Slip Gaji' },
              { id: 'users', label: 'Profil Saya' }
            ]
          : userSystemRole === 'finance'
          ? [
              { id: 'dashboard', label: 'Dashboard Keuangan' },
              { id: 'payroll', label: 'Payroll' },
              { id: 'users', label: 'Data Gaji' },
              { id: 'projects', label: 'Biaya Proyek' },
              { id: 'approvals', label: 'Approval SDM' },
              { id: 'invoice', label: 'Invoice' },
              { id: 'attendance', label: 'Rekap Presensi' },
              { id: 'audit', label: 'Audit Log' }
            ]
          : (userSystemRole === 'admin' || userSystemRole === 'hr')
          ? [
              { id: 'dashboard', label: 'Dashboard SDM' },
              { id: 'payroll', label: 'Payroll' },
              { id: 'attendance', label: 'Presensi' },
              { id: 'approvals', label: 'Approval SDM' },
              { id: 'projects', label: 'Proyek & Site' },
              { id: 'users', label: 'Karyawan' },
              { id: 'audit', label: 'Audit Log' }
            ]
          : userSystemRole === 'superuser'
          ? [
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'hr_room', label: 'HR Room' },
              { id: 'attendance', label: 'Presensi' },
              { id: 'approvals', label: 'Approval SDM' },
              { id: 'projects', label: 'Proyek & Site' },
              { id: 'users', label: 'Karyawan' },
              { id: 'payroll', label: 'Payroll' },
              { id: 'invoice', label: 'Invoice' },
              { id: 'audit', label: 'Audit Log' }
            ]
          : [
              { id: 'dashboard', label: 'Kinerja Saya' },
              { id: 'attendance', label: 'Presensi Kamera' },
              { id: 'approvals', label: 'Pengajuan' },
              { id: 'payroll', label: 'Slip Gaji' },
              { id: 'users', label: 'Profil Saya' }
            ]
        ).map(tab => {
          const isTabActive = activeTab === tab.id || (tab.id === 'projects' && activeTab === 'project_dashboard') || (tab.id === 'dashboard' && (activeTab === 'dashboard_hris' || activeTab === 'dashboard_finance' || activeTab === 'user_performance'));
          return (
            <button
              key={tab.id}
              onClick={() => handleNavigateToTab(tab.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                isTabActive
                  ? 'bg-[#FF6B00] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Area with Dynamic Key for Tab Transition Animation */}
      <main key={activeTab} className="flex-1 max-w-7xl w-full mx-auto pl-4 sm:pl-6 md:pl-24 lg:pl-28 xl:px-8 pr-4 sm:pr-6 lg:pr-8 py-6 pb-28 md:pb-8 transition-all animate-in fade-in duration-200 min-w-0">
        {(activeTab === 'dashboard' || activeTab === 'dashboard_hris' || activeTab === 'dashboard_finance' || activeTab === 'user_performance') && (
          <DashboardTab
            currentUser={currentUser}
            employees={isStaffUser ? [currentUser] : employees}
            projects={projects}
            attendances={isStaffUser ? attendances.filter(a => a.employeeId === currentUser.id) : attendances}
            approvals={isStaffUser ? approvals.filter(a => a.employeeId === currentUser.id) : approvals}
            salaryRules={salaryRules}
            onSubmitNewLeaveRequest={handleSubmitNewLeaveRequest}
            onNavigateToTab={handleNavigateToTab}
            initialSubView={dashboardSubView}
            selectedProjectId={selectedProjectId}
            onSelectProjectId={setSelectedProjectId}
          />
        )}

        {activeTab === 'hr_room' && userSystemRole === 'superuser' && (
          <HrRoomTab
            currentUser={currentUser}
            employees={employees}
            attendances={attendances}
            approvals={approvals}
            projects={projects}
            salaryRules={salaryRules}
            onNavigateToTab={handleNavigateToTab}
          />
        )}

        {activeTab === 'attendance' && (
          <PresensiCameraTab
            currentUser={currentUser}
            employees={employees}
            salaryRules={salaryRules}
            attendanceHistory={attendances}
            onSubmitAttendance={handleAttendanceSubmit}
            onNavigateToTab={handleNavigateToTab}
            realDetectedIp={realDetectedIp}
            realDetectedIsp={realDetectedIsp}
            realDetectedCity={realDetectedCity}
            onUpdateRealIp={setRealDetectedIp}
            onUpdateSalaryRules={handleUpdateSalaryRules}
            projects={projects}
            onSaveProject={handleSaveProject}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteAttendance={handleDeleteAttendance}
            isDbLoading={isDbLoading}
          />
        )}

        {(activeTab === 'approvals' || activeTab === 'leave_gantt') && (
          <ApprovalHubTab
            approvals={approvals}
            employees={employees}
            projects={projects}
            currentUser={currentUser}
            onApprove={handleApprove}
            onReject={handleReject}
            onRequestRevision={handleRequestRevision}
            onSubmitNewLeaveRequest={handleSubmitNewLeaveRequest}
            initialOpenNewRequest={openLeaveModalDirectly}
            onNavigateToTab={handleNavigateToTab}
            onUpdateEmployee={handleUpdateEmployee}
            initialSubTab={activeTab === 'leave_gantt' ? 'gantt' : 'list'}
          />
        )}


        {activeTab === 'casual_attendance' && (
          <CasualWorkerAttendanceTab
            currentUser={currentUser}
            projects={projects}
          />
        )}

        {activeTab === 'projects' && (
          canAccessProjects ? (
            <ProjectManagementTab
              currentUser={currentUser}
              employees={employees}
              projects={projects}
              salaryRules={salaryRules}
              onSaveProject={handleSaveProject}
              onUpdateEmployee={handleUpdateEmployee}
              onNavigateToTab={handleNavigateToTab}
              initialProjectId={selectedProjectId || undefined}
            />
          ) : (
            <div className="glass-card rounded-3xl p-8 text-center space-y-4 max-w-lg mx-auto my-12 border border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900">Akses Terbatas: Khusus Manajemen Proyek</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Modul manajemen proyek dan biaya tenaga kerja hanya dapat diakses oleh Project Manager (PM), Finance, HR Manager, dan Direksi.
              </p>
              <button
                onClick={() => handleNavigateToTab('dashboard')}
                className="px-4 py-2 rounded-xl bg-[#FF6B00] text-white text-xs font-bold cursor-pointer hover:bg-[#e56000] shadow-sm"
              >
                Kembali ke Portal Kinerja
              </button>
            </div>
          )
        )}

        {activeTab === 'project_dashboard' && (
          canAccessProjects ? (
            <ProjectDashboardTab
              project={projects.find(p => p.id === selectedProjectId) || projects[0]}
              allProjects={projects}
              employees={employees}
              attendances={attendances}
              approvals={approvals}
              salaryRules={salaryRules}
              currentUser={currentUser}
              onSelectProject={(id) => {
                setSelectedProjectId(id);
                handleNavigateToTab('project_dashboard', id);
              }}
              onBackToProjects={() => handleNavigateToTab('projects')}
              onNavigateToTab={handleNavigateToTab}
              onUpdateEmployee={handleUpdateEmployee}
            />
          ) : (
            <div className="glass-card rounded-3xl p-8 text-center space-y-4 max-w-lg mx-auto my-12 border border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900">Akses Terbatas: Khusus Manajemen Proyek</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Modul analitik dan manajemen proyek hanya dapat diakses oleh Finance, HR Manager, dan Direksi.
              </p>
              <button
                onClick={() => handleNavigateToTab('dashboard')}
                className="px-4 py-2 rounded-xl bg-[#FF6B00] text-white text-xs font-bold cursor-pointer hover:bg-[#e56000] shadow-sm"
              >
                Kembali ke Beranda
              </button>
            </div>
          )
        )}

        {activeTab === 'users' && (
          <EmployeeManagementTab
            currentUser={currentUser}
            employees={isStaffUser ? [currentUser] : employees}
            projects={projects}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            onImpersonateEmployee={handleImpersonateUser}
          />
        )}

        {activeTab === 'payroll' && (
          <PayrollTab
            currentUser={currentUser}
            employees={isStaffUser ? [currentUser] : employees}
            projects={projects}
            attendances={isStaffUser ? attendances.filter(a => a.employeeId === currentUser.id) : attendances}
            salaryRules={salaryRules}
            workCalendar={workCalendar}
            selectedProjectId={selectedProjectId}
            onSelectProjectId={setSelectedProjectId}
            onUpdateEmployee={handleUpdateEmployee}
            onUpdateAttendance={handleUpdateAttendance}
            approvals={approvals}
            onSubmitApproval={handleSubmitNewLeaveRequest}
            onUpdateApproval={handleApprove}
            onRejectApproval={handleReject}
          />
        )}

        {(activeTab === 'system_settings' || activeTab === 'salary_rules' || activeTab === 'wa_gateway' || activeTab === 'email_smtp') && (
          <SalaryRulesTab
            currentUser={currentUser}
            employees={employees}
            salaryRules={salaryRules}
            onUpdateSalaryRules={handleUpdateSalaryRules}
            initialFocusSection={activeTab === 'email_smtp' ? 'email' : 'whatsapp'}
          />
        )}

        {activeTab === 'work_calendar' && (
          <AnnualWorkCalendarTab
            currentUser={currentUser}
            onUpdateCalendar={(cal) => setWorkCalendar(cal)}
          />
        )}

        {activeTab === 'audit' && (
          <AuditLogTab
            currentUser={currentUser}
            realDetectedIp={realDetectedIp}
            onNavigateToTab={handleNavigateToTab}
          />
        )}

        {activeTab === 'proposal' && (
          <CommercialProposalTab />
        )}

        {activeTab === 'invoice' && (
          <InvoiceTab onNavigateToTab={handleNavigateToTab} />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-slate-200/80 bg-white/40 text-center text-xs text-slate-500 font-mono-code no-print">
        <p>
          DMJ HRIS Enterprise  Production-Grade Human Resource Information System
        </p>
        <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-center gap-3">
          <span>Developed by PT Prime Infinity Systems (Prime ProjectX)</span>
          <span></span>
          <button
            onClick={() => handleNavigateToTab('proposal')}
            className="text-[#FF6B00] hover:underline cursor-pointer"
          >
            Spesifikasi & Proposal Sistem
          </button>
          <span></span>
          <button
            onClick={() => handleNavigateToTab('invoice')}
            className="text-[#18345E] font-bold hover:underline cursor-pointer"
          >
            Invoice Digital (Termin 1)
          </button>
        </p>
      </footer>

      {/* Pop-up Window: Pusat Notifikasi & Approval Terpadu */}

      {/* Interactive Typewriter Tour Demo Modal */}
      <TourDemoModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onNavigateToTab={handleNavigateToTab}
        onSetDashboardSubView={setDashboardSubView}
        activeTab={activeTab}
      />

      <NotificationApprovalModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        approvals={approvals}
        employees={employees}
        projects={projects}
        currentUser={currentUser}
        onApprove={handleApprove}
        onReject={handleReject}
        onRequestRevision={handleRequestRevision}
        onSubmitNewLeaveRequest={handleSubmitNewLeaveRequest}
        onNavigateToTab={handleNavigateToTab}
      />

      {/* Native PWA Mobile Install Banner */}
      <PwaInstallPrompt />

      {/* Live OTA PWA Update Prompt */}
      <PwaUpdateToast />

      {/* Himbauan Pengisian Biometrik Wajah 3D (1 Hari Sekali jika Belum Terdaftar) */}
      <BiometricDailyReminderModal
        isOpen={isBiometricReminderOpen}
        onClose={() => setIsBiometricReminderOpen(false)}
        onOpenEnrollment={() => setIsDirectBiometricEnrollOpen(true)}
        currentUser={currentUser}
      />

      {/* Modal Perekaman 4 Pose Biometrik Langsung dari Himbauan */}
      {isDirectBiometricEnrollOpen && (
        <BiometricEnrollmentModal
          isOpen={isDirectBiometricEnrollOpen}
          onClose={() => setIsDirectBiometricEnrollOpen(false)}
          targetEmployee={currentUser}
          onSaveBiometric={handleSaveDirectBiometric}
          operatorName={currentUser.name}
        />
      )}

      {/* Floating Real-Time Sync Notification Toast */}
      {liveToast && (
        <div className="fixed bottom-20 md:bottom-6 left-4 sm:left-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 max-w-[calc(100vw-2rem)] sm:max-w-sm font-sans no-print">
          <div className={`p-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md ${
            liveToast.type === 'warn' 
              ? 'bg-amber-950/95 text-amber-100 border-amber-500/60'
              : liveToast.type === 'info'
              ? 'bg-slate-900/95 text-slate-100 border-sky-500/50'
              : 'bg-slate-950/95 text-emerald-100 border-emerald-500/60'
          }`}>
            <span className="p-2 rounded-xl bg-white/10 text-emerald-400 shrink-0">
              <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
            </span>
            <div className="flex-1 text-xs">
              <div className="font-mono-code font-black text-[9.5px] text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>RTC LIVE SYNC</span>
              </div>
              <div className="font-semibold text-white leading-tight">{liveToast.message}</div>
            </div>
            <button 
              onClick={() => setLiveToast(null)} 
              className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer text-xs"
            >
              ?
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
