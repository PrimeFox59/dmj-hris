import React, { useState, useEffect } from 'react';
import { Shield, Clock, Sparkles, Users, ChevronDown, CheckCircle2, Award, ArrowRight, Database, Crown, UserCheck, Lock, Bell, AlertTriangle, X, MapPin, ShieldCheck, Zap, LogOut, Camera, KeyRound, User, Banknote, Search, MessageSquare, Briefcase } from 'lucide-react';
import { Employee, UserRole, SystemRole, getEffectiveSystemRole, AuthUser, Project, isProjectManager } from '../types';
import { rtcService } from '../services/rtcService';
import { ProfileSettingsModal, ProfileTabId } from './ProfileSettingsModal';

interface NavbarProps {
  currentUser: Employee;
  allUsers: Employee[];
  onSwitchUser: (user: Employee) => void;
  onUpdateEmployee?: (user: Employee) => void;
  pendingApprovalsCount: number;
  onStartTour?: () => void;
  onNavigateToTab: (tabId: string) => void;
  onOpenNotificationModal?: () => void;
  authUser?: AuthUser | null;
  onLogout?: () => void;
  isProfileModalOpenControlled?: boolean;
  onOpenProfileModalControlled?: (tab?: ProfileTabId) => void;
  onCloseProfileModalControlled?: () => void;
  profileModalInitialTabControlled?: ProfileTabId;
  realDetectedIp?: string;
  realDetectedIsp?: string;
  realDetectedCity?: string;
  isOfficeNetwork?: boolean;
  impersonatorUser?: Employee | null;
  onExitImpersonation?: () => void;
  projects?: Project[];
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  allUsers,
  onSwitchUser,
  onUpdateEmployee,
  pendingApprovalsCount,
  onStartTour,
  onNavigateToTab,
  onOpenNotificationModal,
  authUser,
  onLogout,
  isProfileModalOpenControlled,
  onOpenProfileModalControlled,
  onCloseProfileModalControlled,
  profileModalInitialTabControlled,
  realDetectedIp = '103.31.205.218',
  realDetectedIsp = 'Biznet Dedicated',
  realDetectedCity = 'Sidoarjo',
  isOfficeNetwork = true,
  impersonatorUser,
  onExitImpersonation,
  projects = []
}) => {
  const isUserPm = isProjectManager(currentUser, projects);
  const [impersonateSearch, setImpersonateSearch] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalInitialTab, setProfileModalInitialTab] = useState<ProfileTabId>('profile');

  const effectiveIsProfileModalOpen = isProfileModalOpenControlled !== undefined ? isProfileModalOpenControlled : isProfileModalOpen;
  const effectiveProfileModalInitialTab = profileModalInitialTabControlled !== undefined ? profileModalInitialTabControlled : profileModalInitialTab;

  const openProfileModal = (tab: ProfileTabId = 'profile') => {
    if (onOpenProfileModalControlled) {
      onOpenProfileModalControlled(tab);
    } else {
      setProfileModalInitialTab(tab);
      setIsProfileModalOpen(true);
    }
    setUserDropdownOpen(false);
  };

  const closeProfileModal = () => {
    if (onCloseProfileModalControlled) {
      onCloseProfileModalControlled();
    } else {
      setIsProfileModalOpen(false);
    }
  };

  const currentRole: SystemRole = getEffectiveSystemRole(currentUser);

  return (
    <>
      <header className="sticky top-0 z-50 glass-nav border-b border-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Brand Logo & System Badge */}
        <div id="tour-brand-logo" className="flex items-center gap-3 select-none cursor-pointer motion-slide-right group" onClick={() => onNavigateToTab('dashboard')}>
          <div className="flex items-center gap-2.5">
            {/* Official PT Dwi Martha Jaya Logo */}
            <div className="flex items-center gap-2.5">
              <div className="h-9 sm:h-10 px-1.5 py-0.5 rounded-xl bg-[#233360] border border-[#2e427b] shadow-xs flex items-center justify-center overflow-hidden shrink-0 transition-transform group-hover:scale-105">
                <img
                  src="/dmj-logo.png"
                  alt="PT Dwi Martha Jaya"
                  className="h-full w-auto object-contain"
                />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs sm:text-sm font-black tracking-wider text-slate-900 font-mono-code leading-none flex items-center gap-1">
                  DMJ<span className="text-[#FF6B00]">HRIS</span>
                </span>
                <span className="text-[8.5px] sm:text-[9px] font-bold tracking-wide text-slate-500 uppercase font-mono-code mt-0.5">
                  PT Dwi Martha Jaya
                </span>
              </div>
            </div>

            <div className="h-5 w-px bg-slate-200/80 mx-1 hidden sm:block"></div>

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-orange-50 border border-orange-200/70 shadow-xs shrink-0">
              <Clock className="w-3.5 h-3.5 text-[#FF6B00] animate-pulse" />
              <span className="text-[10px] sm:text-[11px] font-black tracking-wider text-[#FF6B00] font-mono-code">
                ENTERPRISE
              </span>
            </div>
          </div>
        </div>



        {/* User Switcher Dropdown & Quick Actions */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* WhatsApp Bot & QR Gateway Quick Button (HR / Finance / Superuser only) */}
          {currentRole !== 'staff' && (
            <button
              id="tour-wa-gateway-btn"
              onClick={() => onNavigateToTab('wa_gateway')}
              className="relative px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 transition-colors cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
              title="WhatsApp Bot & Gateway (Scan QR / Status Bot Baileys)"
            >
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline text-[11px] font-bold font-mono-code">WA BOT</span>
            </button>
          )}

          {/* Approvals & Notification Hub Trigger */}
          <button
            id="tour-notification-bell"
            onClick={onOpenNotificationModal}
            className="relative p-2 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[#FF6B00] transition-colors cursor-pointer shadow-xs active:scale-95"
            title={`Pusat Notifikasi & Approval Terpadu (${pendingApprovalsCount} menunggu persetujuan)`}
          >
            <Shield className="w-4 h-4" />
            {pendingApprovalsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#FF6B00] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs animate-pulse font-mono-code">
                {pendingApprovalsCount}
              </span>
            )}
          </button>

          {/* User Profile Selector (Simulate Multiple Personnel & RBAC) */}
          <div className="relative">
            <button
              id="tour-user-switcher"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 rounded-full bg-white/90 hover:bg-white border border-slate-200 shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer text-left"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full object-cover border border-orange-400 shadow-2xs"
              />
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 leading-tight">
                  {currentUser.name.split(',')[0]}
                </span>
                {currentRole === 'superuser' ? (
                  <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1 font-mono-code">
                    <Crown className="w-2.5 h-2.5 text-amber-600" />
                    SUPERUSER
                  </span>
                ) : currentRole === 'finance' ? (
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 font-mono-code">
                    <Banknote className="w-2.5 h-2.5 text-emerald-600" />
                    FINANCE
                  </span>
                ) : (currentRole === 'admin' || currentRole === 'hr') ? (
                  <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1 font-mono-code">
                    <Shield className="w-2.5 h-2.5 text-blue-600" />
                    HR
                  </span>
                ) : isUserPm ? (
                  <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1 font-mono-code">
                    <Briefcase className="w-2.5 h-2.5 text-amber-600" />
                    PROJECT MANAGER
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 font-mono-code">
                    <UserCheck className="w-2.5 h-2.5 text-emerald-600" />
                    STAFF BIASA
                  </span>
                )}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* User Profile Settings Dropdown */}
            {userDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/10 backdrop-blur-2xs"
                  onClick={() => setUserDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-84 max-w-sm rounded-3xl bg-white border border-slate-200 shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2">
                {/* User Identity Banner Card */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white mb-2.5 relative overflow-hidden shadow-md">
                  <div className="absolute -top-6 -right-6 w-28 h-28 bg-[#FF6B00]/20 rounded-full blur-xl pointer-events-none" />
                  
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="relative group cursor-pointer" onClick={() => openProfileModal('photo')}>
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-white/90 shadow-md group-hover:opacity-80 transition-opacity"
                      />
                      <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-black text-white truncate leading-tight">
                        {currentUser.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono-code truncate mt-0.5">
                        {currentUser.nik} • {currentUser.department}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`text-[9px] font-black px-2 py-0.2 rounded-full uppercase tracking-wider font-mono-code ${
                          currentRole === 'superuser'
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                            : currentRole === 'finance'
                            ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                            : (currentRole === 'admin' || currentRole === 'hr')
                            ? 'bg-blue-400/20 text-blue-300 border border-blue-400/30'
                            : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                        }`}>
                          {currentRole === 'superuser' ? '👑 SUPERUSER' : currentRole === 'finance' ? '💰 FINANCE & PAYROLL' : (currentRole === 'admin' || currentRole === 'hr') ? '🛡️ HR' : '👤 STAFF'}
                        </span>
                        <span className="text-[10px] text-slate-300 font-medium truncate max-w-[110px]">
                          {currentUser.position}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profile Actions List */}
                <div className="space-y-1">
                  <div className="px-2 pt-1 pb-0.5">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono-code">
                      Pengaturan Profil & Akun
                    </span>
                  </div>

                  {/* Option 1: Edit Profile */}
                  <button
                    onClick={() => openProfileModal('profile')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200/80 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/70 text-[#FF6B00] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 group-hover:text-[#FF6B00] transition-colors leading-tight">
                          Edit Data Diri & Kontak
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Nama, No. WhatsApp, Email & Rekening
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#FF6B00] group-hover:translate-x-0.5 transition-all" />
                  </button>

                  {/* Option 2: Change Photo */}
                  <button
                    onClick={() => openProfileModal('photo')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200/80 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/70 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Camera className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors leading-tight">
                          Ganti Foto Profil
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Unggah foto baru atau pilih avatar resmi
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  </button>

                  {/* Option 3: Change Password */}
                  <button
                    onClick={() => openProfileModal('password')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200/80 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-600 transition-colors leading-tight">
                          Ganti Kata Sandi (Password)
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Perbarui kredensial keamanan akun Anda
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                  </button>

                  {/* Option 4: Sesi & Keamanan */}
                  <button
                    onClick={() => openProfileModal('security')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200/80 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200/70 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 group-hover:text-purple-600 transition-colors leading-tight">
                          Keamanan & Info Jaringan
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {isOfficeNetwork ? 'WFO Kantor Terverifikasi' : 'Remote Luar Kantor'} • IP {realDetectedIp || '103.31.205.218'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
                  </button>
                </div>

                {/* Persona Switcher / Impersonation Hub: ONLY visible to Superuser or during active Impersonation */}
                {allUsers && allUsers.length > 0 && onSwitchUser && (currentRole === 'superuser' || Boolean(impersonatorUser)) && (
                  <div className="pt-2.5 mt-2 border-t border-slate-100">
                    <div className="px-2 pb-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider font-mono-code flex items-center gap-1">
                        <Crown className="w-3 h-3 text-amber-500" />
                        <span>Impersonasi Akun (Superuser)</span>
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold font-mono-code">
                        154 SDM
                      </span>
                    </div>

                    {/* Active Impersonation Exit Card */}
                    {impersonatorUser && onExitImpersonation && (
                      <div className="mb-2 p-2 bg-amber-50/90 border border-amber-300 rounded-xl">
                        <div className="flex items-center justify-between text-[10.5px] text-amber-950 font-bold mb-1">
                          <span>🎭 Sedang Impersonate:</span>
                          <span className="font-mono text-[9.5px] bg-amber-200/80 px-1 rounded">{currentUser.nik}</span>
                        </div>
                        <p className="text-[10px] text-amber-800 truncate mb-1.5 font-medium">
                          {currentUser.name} ({currentUser.position})
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            onExitImpersonation();
                            setUserDropdownOpen(false);
                          }}
                          className="w-full py-1.5 px-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-extrabold text-[10.5px] rounded-lg cursor-pointer transition flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <span>✕ Kembali ke Akun Superuser</span>
                        </button>
                      </div>
                    )}

                    {/* Instant Search Bar */}
                    <div className="relative mb-2 px-1">
                      <Search className="w-3 h-3 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={impersonateSearch}
                        onChange={(e) => setImpersonateSearch(e.target.value)}
                        placeholder="Cari nama, NIK, divisi..."
                        className="w-full pl-7 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                      {allUsers
                        .filter(u => {
                          if (!impersonateSearch.trim()) return true;
                          const q = impersonateSearch.toLowerCase();
                          return (
                            u.name.toLowerCase().includes(q) ||
                            u.nik.toLowerCase().includes(q) ||
                            (Boolean(u.loginId) && u.loginId!.toLowerCase().includes(q)) ||
                            u.department.toLowerCase().includes(q) ||
                            u.position.toLowerCase().includes(q)
                          );
                        })
                        .slice(0, impersonateSearch.trim() ? 20 : 6)
                        .map(user => {
                          const effRole = getEffectiveSystemRole(user);
                          const isCurrent = user.id === currentUser.id;
                          return (
                            <button
                              key={user.id}
                              onClick={() => {
                                if (window.confirm(`Masuk ke mode impersonasi persona ${user.name} (${user.position})?`)) {
                                  onSwitchUser(user);
                                  setUserDropdownOpen(false);
                                }
                              }}
                              className={`w-full flex items-center justify-between p-1.5 rounded-xl text-left transition-all cursor-pointer ${
                                isCurrent
                                  ? 'bg-amber-50 border border-amber-300'
                                  : 'hover:bg-slate-50 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <img
                                  src={user.avatar}
                                  alt={user.name}
                                  className="w-6 h-6 rounded-full object-cover shrink-0 border border-slate-200"
                                />
                                <div className="truncate">
                                  <p className="text-[11px] font-bold text-slate-900 truncate leading-tight">
                                    {user.name.split(',')[0]}
                                  </p>
                                  <p className="text-[9.5px] text-slate-400 truncate font-mono-code">
                                    {effRole === 'superuser' ? '👑 Direksi' : effRole === 'finance' ? '💰 Finance' : (effRole === 'admin' || effRole === 'hr') ? '🛡️ HR' : '👤 Staff'} • {user.position}
                                  </p>
                                </div>
                              </div>
                              {isCurrent && (
                                <span className="w-2 h-2 rounded-full bg-[#FF6B00] shrink-0 mr-1" />
                              )}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Direct Shortcut to User Performance & Logout */}
                <div className="pt-2 mt-2 border-t border-slate-100 space-y-1.5">
                  <button
                    onClick={() => {
                      onNavigateToTab('user_performance');
                      setUserDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 text-[#FF6B00] font-bold text-xs transition-all cursor-pointer shadow-2xs"
                  >
                    <span className="flex items-center gap-2">
                      <Award className="w-3.5 h-3.5 text-[#FF6B00]" />
                      Buka Portal Kinerja Saya
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#FF6B00]" />
                  </button>

                  {onLogout && (
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                    >
                      <span className="flex items-center gap-2">
                        <LogOut className="w-3.5 h-3.5 text-rose-600" />
                        Keluar dari Sistem (Logout)
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-rose-600" />
                    </button>
                  )}
                </div>
              </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Profile Settings Modal */}
      <ProfileSettingsModal
        isOpen={effectiveIsProfileModalOpen}
        onClose={closeProfileModal}
        currentUser={currentUser}
        authUser={authUser}
        onUpdateEmployee={onUpdateEmployee || (() => {})}
        initialTab={effectiveProfileModalInitialTab}
        realDetectedIp={realDetectedIp}
        realDetectedIsp={realDetectedIsp}
        realDetectedCity={realDetectedCity}
        isOfficeNetwork={isOfficeNetwork}
        onLogout={onLogout}
      />
    </header>

    {/* Floating Tour Demo Button in Bottom-Left Corner (Hidden on narrow mobile screens to avoid dock overlap) */}
    {onStartTour && (
      <div className="fixed bottom-20 md:bottom-6 left-4 sm:left-6 z-40 no-print hidden sm:flex">
        <button
          id="tour-start-button"
          onClick={onStartTour}
          className="group flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-gradient-to-r from-[#FF6B00] to-[#FF8533] hover:from-[#e56000] hover:to-[#ff771a] text-white shadow-xl shadow-orange-500/35 hover:shadow-orange-500/50 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/30 backdrop-blur-md"
          title="Mulai Panduan Tour Demo Interaktif"
        >
          <Sparkles className="w-4 h-4 animate-pulse shrink-0 text-white" />
          <span className="font-bold text-xs tracking-wide font-sans">
            Tour Demo
          </span>
        </button>
      </div>
    )}
  </>
);
};
