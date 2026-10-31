import React, { useState } from 'react';
import {
  LayoutDashboard,
  Camera,
  CheckSquare,
  Users,
  Banknote,
  Sliders,
  FileSpreadsheet,
  ChevronRight,
  UserCheck,
  Shield,
  Crown,
  History,
  Briefcase,
  MessageSquare,
  Mail,
  Settings,
  CalendarDays,
  HardHat
} from 'lucide-react';
import { UserRole, SystemRole, Employee, canAccessProjectModule, isProjectManager } from '../types';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  userRole: UserRole;
  systemRole?: SystemRole;
  currentUser?: Employee;
  pendingApprovalsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  userRole,
  systemRole = 'staff',
  currentUser,
  pendingApprovalsCount
}) => {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const canViewProjects = canAccessProjectModule(currentUser);

  // Build tailored menus based on RBAC role
  const getMenuItems = () => {
    const buildStaffItems = () => {
      const staffItems = [
        {
          id: 'dashboard',
          title: 'PORTAL KINERJA SAYA',
          desc: 'Ringkasan kehadiran pribadi, sisa cuti tahunan, slip gaji & performa kerja Anda',
          icon: LayoutDashboard,
          badge: null
        },
        {
          id: 'attendance',
          title: 'PRESENSI KAMERA SAYA',
          desc: 'Presensi selfie kamera geotag satelit GPS & dinas luar mendadak',
          icon: Camera,
          badge: null
        },
        {
          id: 'approvals',
          title: 'PENGAJUAN & IZIN SAYA',
          desc: 'Formulir & riwayat pengajuan cuti, izin sakit & dispensasi kehadiran',
          icon: CheckSquare,
          badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null
        },
        {
          id: 'payroll',
          title: 'SLIP GAJI SAYA',
          desc: 'Rincian penerimaan gaji pokok, tunjangan kerja, cetak slip resmi PRIME hris',
          icon: Banknote,
          badge: null
        }
      ];

      staffItems.push({
        id: 'users',
        title: 'PROFIL DATA SAYA',
        desc: 'Cek data NIK, departemen, rekening bank payroll, kuota cuti & biometrik wajah',
        icon: UserCheck,
        badge: null
      });


      // Project Manager / Site Manager: Presensi Tukang Lapangan
      if (isProjectManager(currentUser)) {
        staffItems.splice(2, 0, {
          id: 'casual_attendance',
          title: 'PRESENSI TUKANG LAPANGAN',
          desc: 'Presensi cepat harian & foto tukang/pekerja harian lepas di lokasi proyek',
          icon: HardHat,
          badge: null
        });
      }

      return staffItems;
    };

    if (systemRole === 'staff') {
      return buildStaffItems();
    }

    if (systemRole === 'admin' || systemRole === 'hr') {
      return [
        {
          id: 'dashboard',
          title: 'DASHBOARD HRIS & SDM',
          desc: 'Monitoring operasional SDM, headcount workshop & rekapitulasi kehadiran harian',
          icon: LayoutDashboard,
          badge: null
        },
        {
          id: 'attendance',
          title: 'PRESENSI & JAM KERJA',
          desc: 'Verifikasi selfie kamera, validasi IP kantor & pendaftaran presensi dinas luar',
          icon: Camera,
          badge: null
        },
        {
          id: 'approvals',
          title: 'PUSAT APPROVAL SDM',
          desc: 'Otorisasi berjenjang pengajuan cuti, izin & dinas luar',
          icon: CheckSquare,
          badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null
        },
        {
          id: 'casual_attendance',
          title: 'PRESENSI TUKANG LAPANGAN',
          desc: 'Monitoring audit foto harian tukang lepas di seluruh proyek',
          icon: HardHat,
          badge: null
        },
        {
          id: 'projects',
          title: 'MANAJEMEN PROYEK & SITE',
          desc: 'Alokasi teknisi, jam kerja site, roster kerja & aturan cuti proyek',
          icon: Briefcase,
          badge: null
        },
        {
          id: 'users',
          title: 'DATA KARYAWAN',
          desc: 'Manajemen master karyawan, penugasan proyek, kuota cuti & data personel',
          icon: Users,
          badge: null
        },
        {
          id: 'work_calendar',
          title: 'KALENDER KERJA & CUT-OFF',
          desc: 'Kalender kerja 1 tahun, setting libur mingguan & tanggal cut-off presensi',
          icon: CalendarDays,
          badge: null
        },
        {
          id: 'system_settings',
          title: 'SETTING SYSTEM',
          desc: 'Konfigurasi integrasi WhatsApp Bot Gateway & kredensial SMTP Gmail',
          icon: Settings,
          badge: null
        },
        {
          id: 'audit',
          title: 'AUDIT TRAIL & LOG',
          desc: 'Log rekaman kronologis aktivitas sistem, autentikasi, presensi & perubahan data',
          icon: History,
          badge: null
        }
      ];
    }

    if (systemRole === 'finance') {
      return [
        {
          id: 'dashboard',
          title: 'DASHBOARD KEUANGAN & FINANCE',
          desc: 'Monitoring arus kas payroll, burn rate anggaran proyek & alokasi biaya tenaga kerja',
          icon: LayoutDashboard,
          badge: null
        },
        {
          id: 'payroll',
          title: 'PAYROLL & PENGGAJIAN',
          desc: 'Otoritas penggajian per proyek, cetak slip gaji resmi & audit upah',
          icon: Banknote,
          badge: null
        },
        {
          id: 'users',
          title: 'DATA GAJI KARYAWAN',
          desc: 'Master data personel, verifikasi rekening bank payroll, skema gaji pokok & tunjangan',
          icon: Users,
          badge: null
        },
        {
          id: 'projects',
          title: 'BIAYA TENAGA KERJA PROYEK',
          desc: 'Kontrol pagu anggaran, realisasi biaya labor proyek & estimasi EAC selesai',
          icon: Briefcase,
          badge: null
        },
        {
          id: 'approvals',
          title: 'APPROVAL CUTI & DISPENSASI',
          desc: 'Pusat otorisasi permohonan cuti, justifikasi presensi staf',
          icon: CheckSquare,
          badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null
        },
        {
          id: 'attendance',
          title: 'REKAP PRESENSI & JADWAL',
          desc: 'Audit rekapitulasi kehadiran, presensi dinas luar untuk payroll',
          icon: Camera,
          badge: null
        },
        {
          id: 'work_calendar',
          title: 'KALENDER KERJA & CUT-OFF',
          desc: 'Kalender kerja 1 tahun, setting libur mingguan & tanggal cut-off presensi',
          icon: CalendarDays,
          badge: null
        },
        {
          id: 'system_settings',
          title: 'SETTING SYSTEM',
          desc: 'Konfigurasi integrasi WhatsApp Bot Gateway & kredensial SMTP Gmail',
          icon: Settings,
          badge: null
        },
        {
          id: 'audit',
          title: 'AUDIT TRAIL & LOG',
          desc: 'Log rekaman transaksi finansial, perubahan data gaji & aktivitas sistem',
          icon: History,
          badge: null
        },
        {
          id: 'invoice',
          title: 'INVOICE & TAGIHAN RESMI',
          desc: 'Invoice digital resmi Termin I (50%) proyek Prime HRIS PT DMJ & verifikasi QR',
          icon: FileSpreadsheet,
          badge: null
        }
      ];
    }

    if (systemRole === 'superuser') {
      return [
        {
          id: 'dashboard',
          title: 'DASHBOARD TERPADU',
          desc: 'Pusat monitoring terpadu: HRIS SDM, Finance Kas & Kinerja Saya',
          icon: LayoutDashboard,
          badge: null
        },
        {
          id: 'attendance',
          title: 'PRESENSI KAMERA & GEOFENCE',
          desc: 'Presensi selfie kamera, satelit GPS geofence & dinas luar',
          icon: Camera,
          badge: null
        },
        {
          id: 'approvals',
          title: 'APPROVAL & PENGAJUAN',
          desc: 'Pusat otorisasi tiket SDM, persetujuan dispensasi cuti & absensi',
          icon: CheckSquare,
          badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null
        },
        {
          id: 'projects',
          title: 'MANAJEMEN PROYEK & SITE',
          desc: 'Alokasi teknisi, jam kerja site, roster kerja & aturan cuti proyek',
          icon: Briefcase,
          badge: null
        },
        {
          id: 'users',
          title: 'MASTER DATA KARYAWAN',
          desc: 'Manajemen pengguna & staf, jatah cuti, data rekening & biometrik wajah',
          icon: Users,
          badge: null
        },
        {
          id: 'payroll',
          title: 'PAYROLL & PROYEK',
          desc: 'Penggajian rapi dengan filter per proyek & slip gaji resmi PRIME hris',
          icon: Banknote,
          badge: null
        },
        {
          id: 'work_calendar',
          title: 'KALENDER KERJA & CUT-OFF',
          desc: 'Kalender kerja 1 tahun, setting libur mingguan & tanggal cut-off presensi',
          icon: CalendarDays,
          badge: null
        },
        {
          id: 'system_settings',
          title: 'SETTING SYSTEM',
          desc: 'Konfigurasi integrasi WhatsApp Bot Gateway & kredensial SMTP Gmail',
          icon: Settings,
          badge: null
        },
        {
          id: 'audit',
          title: 'AUDIT TRAIL & LOG',
          desc: 'Log rekaman kronologis aktivitas sistem, autentikasi, presensi & perubahan data',
          icon: History,
          badge: null
        },
        {
          id: 'invoice',
          title: 'INVOICE & TAGIHAN RESMI',
          desc: 'Invoice digital resmi Termin I (50%) proyek Prime HRIS PT DMJ & verifikasi QR',
          icon: FileSpreadsheet,
          badge: null
        }
      ];
    }

    // Default Fail-Safe (Zero Trust): Kembalikan menu Staf Biasa!
    return buildStaffItems();
  };

  const menuItems = getMenuItems();

  return (
    <aside className="fixed left-3 sm:left-5 top-1/2 -translate-y-1/2 z-40 select-none hidden md:block">
      {/* Translucent White Glass Pill Container */}
      <div id="tour-sidebar" className="bg-white/85 backdrop-blur-md border border-white/90 rounded-full p-2 flex flex-col items-center gap-2.5 shadow-xl shadow-slate-900/10 motion-slide-left">
        {menuItems.map((item, idx) => {
          const Icon = item.icon;
          const isDashboard = item.id === 'dashboard' && (activeTab === 'dashboard' || activeTab === 'dashboard_hris' || activeTab === 'dashboard_finance' || activeTab === 'user_performance');
          const isProjects = item.id === 'projects' && (activeTab === 'projects' || activeTab === 'project_dashboard');
          const isActive = activeTab === item.id || isDashboard || isProjects;
          const isHovered = hoveredTab === item.id;

          return (
            <div
              key={item.id}
              style={{ animationDelay: `${(idx + 1) * 40}ms` }}
              className="relative motion-scale-in"
              onMouseEnter={() => setHoveredTab(item.id)}
              onMouseLeave={() => setHoveredTab(null)}
            >
              {/* Circular Icon Button */}
              <button
                id={`tour-tab-${item.id}`}
                onClick={() => onSelectTab(item.id)}
                className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-tr from-[#FF6B00] to-[#FF8533] text-white shadow-lg shadow-orange-500/30 scale-110 motion-pulse-glow'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 hover:scale-105 active:scale-95'
                }`}
                title={item.title}
              >
                <Icon className="w-5 h-5 transition-transform" />
                
                {/* Badge for Pending Approvals (Strictly Numeric) */}
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md animate-pulse font-mono-code">
                    {item.badge}
                  </span>
                )}
              </button>

              {/* Flyout Hover Card Tooltip */}
              {isHovered && (
                <div className="absolute left-14 top-1/2 -translate-y-1/2 w-64 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-2xl border border-slate-700/60 pointer-events-none z-50 animate-in fade-in slide-in-from-left-2 duration-150">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-black tracking-wider uppercase text-[#FF8533] font-mono-code">
                      {item.title}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-300 leading-snug">
                    {item.desc}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
