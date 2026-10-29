import type { Employee, Project, AttendanceRecord, ApprovalItem, SalaryRuleConfig } from '../types/index.ts';
import { seedEmployees, seedProjects } from './seedData.ts';

export const INITIAL_SALARY_RULES: SalaryRuleConfig = {
  standardWorkDaysPerMonth: 22,
  standardHoursPerDay: 8,
  cutoffTime: "08:30",
  lateGracePeriodMinutes: 10,
  latePenaltyPerBlock: 25000, // Rp 25.000 / 15 menit jika tidak diapprove
  overtimeFormula: {
    firstHourRateMultiplier: 1.5,
    subsequentHourRateMultiplier: 2.0,
    holidayRateMultiplier: 2.5,
    hourlyRateDivisor: 173 // Depnaker RI standard
  },
  bpjsKetenagakerjaanRate: 0.03, // 3%
  bpjsKesehatanRate: 0.01, // 1%
  defaultDailyAllowance: 50000,
  remoteProjectAllowance: 1500000,
  authorizedIpNetworks: [
    {
      ipOrSubnet: "103.31.205.218",
      label: "Gateway Utama PRIME (Biznet Fiber Dedicated)",
      isp: "PT Biznet Gio Nusantara",
      isRegisteredOffice: true
    },
    {
      ipOrSubnet: "103.31.205.0/24",
      label: "Subnet Enterprise Kantor Pusat & Workshop",
      isp: "PT Biznet Gio Nusantara",
      isRegisteredOffice: true
    },
    {
      ipOrSubnet: "180.252.0.0/16",
      label: "Telkom Astinet Dedicated Kantor Pusat Sidoarjo",
      isp: "PT Telkom Indonesia",
      isRegisteredOffice: true
    },
    {
      ipOrSubnet: "192.168.10.0/24",
      label: "Local Intranet Subnet Workshop & Engineering",
      isp: "LAN DHCP Subnet",
      isRegisteredOffice: true
    }
  ],
  officeGeofence: {
    name: "PRIME Enterprise - Kantor Pusat & Innovation Hub",
    lat: -7.395625,
    lng: 112.717574,
    radiusMeters: 350,
    address: "Kawasan Industri Terpadu, Jl. Raya Utama Prime Blok A1-A4, Jawa Timur"
  }
};

export const INITIAL_EMPLOYEES: Employee[] = seedEmployees as unknown as Employee[];

export const INITIAL_PROJECTS: Project[] = seedProjects as unknown as Project[];

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];

export const INITIAL_APPROVALS: ApprovalItem[] = [
  {
    id: "APP-2026-004",
    type: "PERMIT",
    employeeId: "EMP-001",
    employeeName: "Ir. Galih Primananda, S.T., M.T.",
    employeeNik: "PRIME-2022-001",
    department: "Engineering & Digital Transformation",
    title: "Izin Sakit dengan Surat Keterangan Dokter",
    description: "Izin istirahat medis karena flu, surat dokter terlampir.",
    startDate: "2026-08-20",
    endDate: "2026-08-21",
    daysCount: 2,
    proofAttachment: "surat_dokter_galih_aug2026.pdf",
    status: "APPROVED",
    submittedAt: "2026-08-20 07:30:00",
    reviewedBy: "Divisi Medis & HR",
    reviewedAt: "2026-08-20 09:15:00",
    reviewNote: "Disetujui. Semoga lekas pulih."
  },
  {
    id: "APP-2026-005",
    type: "LATE_JUSTIFICATION",
    employeeId: "EMP-001",
    employeeName: "Ir. Galih Primananda, S.T., M.T.",
    employeeNik: "PRIME-2022-001",
    department: "Engineering & Digital Transformation",
    title: "Justifikasi Dispensasi Telat 35 Menit (Inspeksi Lapangan)",
    description: "Keterlambatan masuk akibat inspeksi rute logistik material baja menuju workshop Manyar.",
    startDate: "2026-08-14",
    lateMinutes: 35,
    status: "REJECTED",
    submittedAt: "2026-08-14 09:10:00",
    reviewedBy: "Direksi Operasional PRIME",
    reviewedAt: "2026-08-14 11:30:00",
    reviewNote: "DITOLAK: Jadwal inspeksi vendor seharusnya dijadwalkan setelah briefing pagi shift kerja dan tidak ada surat tugas tertulis pendukung."
  }
];

export const INITIAL_ATTENDANCES = INITIAL_ATTENDANCE;

