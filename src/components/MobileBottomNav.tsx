import React, { useState } from 'react';
import {
  LayoutDashboard,
  Camera,
  CheckSquare,
  Briefcase,
  Menu,
  X,
  Users,
  Banknote,
  Sliders,
  History,
  User,
  Shield,
  FileText,
  LogOut,
  Sparkles,
  ChevronRight,
  UserCheck,
  Crown,
  Bell,
  Globe,
  Lock,
  KeyRound,
  HardHat
} from 'lucide-react';
import { Employee, getEffectiveSystemRole, SystemRole, canAccessProjectModule, isProjectManager, Project } from '../types';
import { ProfileTabId } from './ProfileSettingsModal';

interface MobileBottomNavProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  currentUser: Employee;
  pendingApprovalsCount: number;
  onOpenNotificationModal?: () => void;
  onOpenProfileModal?: (tab?: ProfileTabId) => void;
  onStartTour?: () => void;
  onLogout?: () => void;
  realDetectedIp?: string;
  isOfficeNetwork?: boolean;
  projects?: Project[];
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  pendingApprovalsCount,
  onOpenNotificationModal,
  onOpenProfileModal,
  onStartTour,
  onLogout,
  realDetectedIp = '103.31.205.218',
  isOfficeNetwork = true,
  projects = []
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const currentRole: SystemRole = getEffectiveSystemRole(currentUser);
  const isStaff = currentRole === 'staff';
  const isFinanceOrSuper = currentRole === 'finance' || currentRole === 'superuser';
  const isUserPm = isProjectManager(currentUser, projects);
  const canViewProjects = canAccessProjectModule(currentUser, projects);

  const isDashboardActive = ['dashboard', 'dashboard_hris', 'dashboard_finance', 'user_performance'].includes(activeTab);
  const isAttendanceActive = activeTab === 'attendance';
  const isApprovalsActive = activeTab === 'approvals';
  const isProjectsActive = activeTab === 'projects';
  const isPayrollActive = activeTab === 'payroll';
  const isSecondaryActive = isDrawerOpen || ['users', 'audit', 'proposal'].includes(activeTab);

  const handleTabClick = (tabId: string) => {
    onSelectTab(tabId);
    setIsDrawerOpen(false);
  };

  return (
    <>
      {/* =========================================================================
          1. SLIDE-UP DRAWER BOTTOM SHEET (MENU LAINNYA)
         ========================================================================= */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-200">
          {/* Dark Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Drawer Content Card */}
          <div className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-white rounded-t-3xl border-t border-slate-200/90 shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Top Drag Handle */}
            <div className="pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
            </div>

            {/* Header: User Profile Badge & Close */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-10 h-10 rounded-2xl object-cover border-2 border-orange-400 shadow-2xs"
                />
                <div>
                  <h4 className="text-xs font-black text-slate-900 leading-tight">
                    {currentUser.name}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-slate-500 font-mono-code font-bold">
                      {currentUser.nik}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase font-mono-code ${
                      currentRole === 'superuser'
                        ? 'bg-amber-100 text-amber-900'
                        : (currentRole === 'admin' || currentRole === 'hr')
                        ? 'bg-blue-100 text-blue-900'
                        : currentRole === 'finance'
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {currentRole === 'superuser' ? '👑 SUPERUSER' : (currentRole === 'admin' || currentRole === 'hr') ? '🛡️ HR' : currentRole === 'finance' ? '💰 FINANCE' : '👤 STAFF'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Drawer Body */}
            <div className="overflow-y-auto px-5 py-4 space-y-4 pb-24 text-slate-800">
              {/* Profile Shortcut Button */}
              {onOpenProfileModal && (
                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    onOpenProfileModal('profile');
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 border border-orange-200/80 text-orange-950 transition-all cursor-pointer shadow-2xs text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#FF6B00] text-white flex items-center justify-center shadow-xs">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 leading-tight">
                        Pengaturan Profil & Sandi
                      </p>
                      <p className="text-[10.5px] text-slate-500">
                        Edit kontak, foto profil & ganti password
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-orange-600" />
                </button>
              )}

              {/* SECTION: MODULES GRID */}
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono-code block mb-2">
                  Daftar Modul Operasional
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  
                  {/* Tab: Presensi Tukang Lapangan */}
                  <button
                    onClick={() => handleTabClick('casual_attendance')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      activeTab === 'casual_attendance'
                        ? 'bg-orange-50 border-orange-300 shadow-xs'
                        : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-2">
                      <HardHat className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-tight">
                        Tukang Lapangan
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                        Presensi & foto harian
                      </p>
                    </div>
                  </button>

                  {/* Tab: Karyawan / Profil Data Saya */}
                  <button
                    onClick={() => handleTabClick('users')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      activeTab === 'users'
                        ? 'bg-orange-50 border-orange-300 shadow-xs'
                        : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-2">
                      {isStaff ? <UserCheck className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-tight">
                        {isStaff ? 'Profil Data Saya' : 'Data Karyawan'}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                        {isStaff ? 'NIK, kuota cuti & biometrik' : 'Master SDM & rekening'}
                      </p>
                    </div>
                  </button>

                  {/* Tab: Slip Gaji / Payroll */}
                  <button
                    onClick={() => handleTabClick('payroll')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      activeTab === 'payroll'
                        ? 'bg-orange-50 border-orange-300 shadow-xs'
                        : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
                      <Banknote className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-tight">
                        {isFinanceOrSuper ? 'Payroll & Proyek' : 'Slip Gaji Saya'}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                        {isFinanceOrSuper ? 'Rekap gaji & slip resmi' : 'Rincian gaji & cetak slip'}
                      </p>
                    </div>
                  </button>

                  {/* Tab: Audit Trail & Log (Admin only) */}
                  {!isStaff && (
                    <button
                      onClick={() => handleTabClick('audit')}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        activeTab === 'audit'
                          ? 'bg-orange-50 border-orange-300 shadow-xs'
                          : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-2">
                        <History className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 leading-tight">
                          Audit Trail & Log
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                          Log rekaman ISO/IATF
                        </p>
                      </div>
                    </button>
                  )}

                  {/* Tab: Proposal & Spek Sistem */}
                  <button
                    onClick={() => handleTabClick('proposal')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      activeTab === 'proposal'
                        ? 'bg-orange-50 border-orange-300 shadow-xs'
                        : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-tight">
                        Proposal & Spek
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                        Dokumen implementasi
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* SECTION: UTILITY ACTIONS */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono-code block mb-1">
                  Aksi Tambahan
                </span>

                {onOpenNotificationModal && (
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onOpenNotificationModal();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-all text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-orange-100 text-[#FF6B00] flex items-center justify-center">
                        <Bell className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">
                        Pusat Notifikasi & Approval
                      </span>
                    </div>
                    {pendingApprovalsCount > 0 && (
                      <span className="bg-[#FF6B00] text-white text-[10px] font-black px-2 py-0.5 rounded-full font-mono-code">
                        {pendingApprovalsCount} Menunggu
                      </span>
                    )}
                  </button>
                )}

                {onStartTour && (
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onStartTour();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-all text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">
                        Panduan Interaktif (Tour Demo)
                      </span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
              </div>

              {/* Status Footer & Logout */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono-code">
                  <span className="flex items-center gap-1.5">
                    {isOfficeNetwork ? (
                      <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 text-amber-600" />
                    )}
                    <span>{isOfficeNetwork ? 'Area Geofence Kantor' : 'Jaringan Luar / Remote'}</span>
                  </span>
                  <span>IP {realDetectedIp}</span>
                </div>

                {onLogout && (
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-all cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar dari Akun (Logout)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          2. FIXED BOTTOM DOCK (5 THUMB ACTION DESTINATIONS)
         ========================================================================= */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] no-print"
      >
        <div className="flex items-center justify-around">
          {/* Button 1: Beranda / Dashboard */}
          <button
            onClick={() => handleTabClick('dashboard')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all cursor-pointer min-w-[56px] ${
              isDashboardActive
                ? 'text-[#FF6B00] font-black'
                : 'text-slate-400 hover:text-slate-700 font-medium'
            }`}
          >
            <LayoutDashboard className={`w-5 h-5 mb-0.5 ${isDashboardActive ? 'text-[#FF6B00]' : 'text-slate-400'}`} />
            <span className="text-[10px] tracking-tight leading-tight">Beranda</span>
          </button>

          {/* Button 2: Approval Hub */}
          <button
            onClick={() => handleTabClick('approvals')}
            className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all cursor-pointer min-w-[56px] ${
              isApprovalsActive
                ? 'text-[#FF6B00] font-black'
                : 'text-slate-400 hover:text-slate-700 font-medium'
            }`}
          >
            <CheckSquare className={`w-5 h-5 mb-0.5 ${isApprovalsActive ? 'text-[#FF6B00]' : 'text-slate-400'}`} />
            <span className="text-[10px] tracking-tight leading-tight">Approval</span>
            {pendingApprovalsCount > 0 && (
              <span className="absolute top-0 right-2 w-4 h-4 rounded-full bg-[#FF6B00] text-white text-[9px] font-black flex items-center justify-center font-mono-code shadow-xs">
                {pendingApprovalsCount}
              </span>
            )}
          </button>

          {/* Button 3: Presensi HERO Button (Elevated Center) */}
          <button
            onClick={() => handleTabClick('attendance')}
            className="flex flex-col items-center justify-center -mt-5 cursor-pointer group active:scale-95 transition-transform"
            title="Buka Presensi Kamera Pintar"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border-2 border-white transition-all ${
              isAttendanceActive
                ? 'bg-gradient-to-tr from-[#FF6B00] to-amber-500 text-white shadow-orange-500/40 ring-3 ring-orange-300/50 scale-105'
                : 'bg-gradient-to-tr from-[#FF6B00] to-[#FF8533] text-white shadow-orange-500/30 group-hover:scale-105'
            }`}>
              <Camera className="w-5 h-5 animate-pulse" />
            </div>
            <span className={`text-[10px] tracking-tight leading-tight mt-1 ${
              isAttendanceActive ? 'text-[#FF6B00] font-black' : 'text-slate-600 font-bold'
            }`}>
              Presensi
            </span>
          </button>

          {/* Button 4: Proyek & Site (PM / Finance / HR) ATAU Slip Gaji (Staff Biasa) */}
          {canViewProjects ? (
            <button
              onClick={() => handleTabClick('projects')}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all cursor-pointer min-w-[56px] ${
                isProjectsActive
                  ? 'text-[#FF6B00] font-black'
                  : 'text-slate-400 hover:text-slate-700 font-medium'
              }`}
            >
              <Briefcase className={`w-5 h-5 mb-0.5 ${isProjectsActive ? 'text-[#FF6B00]' : 'text-slate-400'}`} />
              <span className="text-[10px] tracking-tight leading-tight">Proyek</span>
            </button>
          ) : (
            <button
              onClick={() => handleTabClick('payroll')}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all cursor-pointer min-w-[56px] ${
                isPayrollActive
                  ? 'text-[#FF6B00] font-black'
                  : 'text-slate-400 hover:text-slate-700 font-medium'
              }`}
            >
              <Banknote className={`w-5 h-5 mb-0.5 ${isPayrollActive ? 'text-[#FF6B00]' : 'text-slate-400'}`} />
              <span className="text-[10px] tracking-tight leading-tight">Slip Gaji</span>
            </button>
          )}

          {/* Button 5: Menu Lainnya Drawer */}
          <button
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all cursor-pointer min-w-[56px] ${
              isSecondaryActive
                ? 'text-[#FF6B00] font-black'
                : 'text-slate-400 hover:text-slate-700 font-medium'
            }`}
          >
            {isDrawerOpen ? (
              <X className="w-5 h-5 mb-0.5 text-[#FF6B00]" />
            ) : (
              <Menu className={`w-5 h-5 mb-0.5 ${isSecondaryActive ? 'text-[#FF6B00]' : 'text-slate-400'}`} />
            )}
            <span className="text-[10px] tracking-tight leading-tight">Menu</span>
          </button>
        </div>
      </nav>
    </>
  );
};
