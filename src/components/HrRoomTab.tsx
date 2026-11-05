import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import * as XLSX from 'xlsx';
import {
  Users,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Download,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  UserX,
  Building,
  Briefcase,
  X,
  ExternalLink,
  Eye,
  RefreshCw,
  Award,
  AlertCircle,
  HelpCircle,
  Camera
} from 'lucide-react';
import { Employee, AttendanceRecord, ApprovalItem, Project, SalaryRuleConfig } from '../types';

interface HrRoomTabProps {
  currentUser: Employee;
  employees: Employee[];
  attendances: AttendanceRecord[];
  approvals: ApprovalItem[];
  projects: Project[];
  salaryRules: SalaryRuleConfig;
  onNavigateToTab: (tabId: string) => void;
}

type DatePreset = 'TODAY' | 'LAST_7' | 'THIS_MONTH' | 'LAST_30' | 'ALL' | 'CUSTOM';
type ComplianceFilter = 'ALL' | 'ON_TIME' | 'LATE' | 'LEAVE' | 'ABSENT' | 'OUT_GEOFENCE' | 'FRAUD_BIOMETRIC';

export const HrRoomTab: React.FC<HrRoomTabProps> = ({
  currentUser,
  employees,
  attendances,
  approvals,
  projects,
  salaryRules,
  onNavigateToTab
}) => {
  // =========================================================================
  // 1. DATE RANGE STATE & PRESETS
  // =========================================================================
  const todayStr = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const firstDayOfMonthStr = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}-01`;
  }, []);

  const [datePreset, setDatePreset] = useState<DatePreset>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string>(firstDayOfMonthStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  const handleSelectPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const today = `${yyyy}-${mm}-${dd}`;

    if (preset === 'TODAY') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'LAST_7') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      const sY = d.getFullYear();
      const sM = String(d.getMonth() + 1).padStart(2, '0');
      const sD = String(d.getDate()).padStart(2, '0');
      setStartDate(`${sY}-${sM}-${sD}`);
      setEndDate(today);
    } else if (preset === 'THIS_MONTH') {
      setStartDate(`${yyyy}-${mm}-01`);
      setEndDate(today);
    } else if (preset === 'LAST_30') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      const sY = d.getFullYear();
      const sM = String(d.getMonth() + 1).padStart(2, '0');
      const sD = String(d.getDate()).padStart(2, '0');
      setStartDate(`${sY}-${sM}-${sD}`);
      setEndDate(today);
    } else if (preset === 'ALL') {
      let earliest = '2026-01-01';
      if (attendances.length > 0) {
        const sorted = [...attendances].sort((a, b) => a.date.localeCompare(b.date));
        earliest = sorted[0].date;
      }
      setStartDate(earliest);
      setEndDate(today);
    }
  };

  // =========================================================================
  // 2. SEARCH & ADVANCED FILTERS
  // =========================================================================
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>('ALL');

  // Selected Employee for Detail Modal
  const [inspectedEmployee, setInspectedEmployee] = useState<Employee | null>(null);

  // Photo Inspector Modal State
  const [selectedPhotoItem, setSelectedPhotoItem] = useState<AttendanceRecord | null>(null);
  const [photoType, setPhotoType] = useState<'CHECK_IN' | 'CHECK_OUT'>('CHECK_IN');

  // Pagination / Load More State
  const [visibleRowsCount, setVisibleRowsCount] = useState<number>(15);

  // Departments List
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Employee Login ID Map
  const empLoginMap = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach(e => {
      if (e.id && e.loginId) map.set(e.id, e.loginId);
      if (e.nik && e.loginId) map.set(e.nik, e.loginId);
      if (e.name && e.loginId) map.set(e.name.toLowerCase().trim(), e.loginId);
    });
    return map;
  }, [employees]);

  const getLoginBadge = (item: AttendanceRecord): string => {
    if (item.employeeLoginId) return item.employeeLoginId;
    if (item.employeeId && empLoginMap.has(item.employeeId)) return empLoginMap.get(item.employeeId)!;
    if (item.employeeNik && empLoginMap.has(item.employeeNik)) return empLoginMap.get(item.employeeNik)!;
    if (item.employeeName && empLoginMap.has(item.employeeName.toLowerCase().trim())) {
      return empLoginMap.get(item.employeeName.toLowerCase().trim())!;
    }
    return item.employeeId || '-';
  };

  // Format KM Geofence
  const formatDistanceKm = (meters?: number): string => {
    if (meters === undefined || meters === null || isNaN(meters)) return '0.0 km';
    if (meters < 100) return '0.0 km';
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
  };

  // Format Indo Day Name
  const getDayNameIndo = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        return days[d.getDay()] || '';
      }
    } catch {
      // fallback
    }
    return '';
  };

  // Project Info for Attendance Record
  const getProjectInfo = (item: AttendanceRecord) => {
    let code = item.projectCode || '';
    let name = item.projectName || '';

    if (item.projectId) {
      const proj = projects.find(p => p.id === item.projectId || p.code === item.projectId);
      if (proj) {
        if (!name || name === 'OFFICE') name = proj.name;
        if (!code) code = proj.code;
      }
    }

    if (!name || name === 'OFFICE' || !code) {
      const emp = employees.find(e => e.id === item.employeeId || e.nik === item.employeeNik);
      if (emp?.assignedProjectId) {
        const proj = projects.find(p => p.id === emp.assignedProjectId);
        if (proj) {
          if (!name || name === 'OFFICE') name = proj.name;
          if (!code) code = proj.code;
        }
      }
    }

    if (!name || name === 'OFFICE' || item.projectId === 'OFFICE') {
      return {
        name: salaryRules?.officeGeofence?.name || 'Kantor Pusat & Operasional',
        code: code || 'HO',
        isOffice: true
      };
    }

    return {
      name,
      code: code || 'PROJ',
      isOffice: false
    };
  };

  // Extract Clean User Note
  const extractUserAttendanceNote = (item: AttendanceRecord): { badge?: string; text: string; fullRaw: string } => {
    const raw = (item.note || '').trim();
    const outOfRange = (item.outOfRangeReason || '').trim();
    const late = (item.lateReason || '').trim();

    // 1. Check if raw note has [Luar Area Xm]: <User Note>
    const luarMatch = raw.match(/^\[Luar Area \d+m\]:\s*(.*)$/i);
    if (luarMatch) {
      const userTyped = luarMatch[1].trim();
      return {
        badge: 'Luar Area',
        text: userTyped || outOfRange || 'Presensi di luar geofence',
        fullRaw: raw
      };
    }

    // 2. Check if raw note has [Dinas Luar: ...]: <User Note>
    const dinasMatch = raw.match(/^\[Dinas Luar:[^\]]+\]\s*(.*)$/i);
    if (dinasMatch) {
      const userTyped = dinasMatch[1].trim();
      return {
        badge: 'Dinas Luar',
        text: userTyped || raw,
        fullRaw: raw
      };
    }

    // 3. Explicit outOfRangeReason
    if (outOfRange && !outOfRange.startsWith('[Luar Area')) {
      return {
        badge: 'Luar Area',
        text: outOfRange,
        fullRaw: raw || outOfRange
      };
    }

    // 4. Explicit lateReason
    if (late) {
      return {
        badge: 'Alasan Telat',
        text: late,
        fullRaw: raw || late
      };
    }

    // 5. System boilerplate notes
    if (raw === 'Presensi Masuk (Dalam Area Kerja)' || raw === 'Presensi Pulang (Dalam Area Kerja)') {
      return {
        badge: undefined,
        text: '-',
        fullRaw: raw
      };
    }

    if (raw) {
      return {
        badge: undefined,
        text: raw,
        fullRaw: raw
      };
    }

    return {
      badge: undefined,
      text: '-',
      fullRaw: '-'
    };
  };

  // =========================================================================
  // 3. DATE RANGE DAYS LIST
  // =========================================================================
  const dateRangeDays = useMemo(() => {
    if (!startDate || !endDate) return [];
    const list: string[] = [];
    const curr = new Date(startDate);
    const end = new Date(endDate);
    
    // Guard against inverted dates
    if (curr > end) return [todayStr];

    while (curr <= end) {
      const yyyy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, '0');
      const dd = String(curr.getDate()).padStart(2, '0');
      list.push(`${yyyy}-${mm}-${dd}`);
      curr.setDate(curr.getDate() + 1);
    }
    return list;
  }, [startDate, endDate, todayStr]);

  // Working Days in Range (Excluding Sundays)
  const workingDaysInRange = useMemo(() => {
    return dateRangeDays.filter(dStr => {
      const d = new Date(dStr + 'T12:00:00Z');
      return d.getUTCDay() !== 0; // Exclude Sunday
    });
  }, [dateRangeDays]);

  // =========================================================================
  // 4. FILTERED ATTENDANCE RECORDS (DATE RANGE & PROJECT & SEARCH)
  // =========================================================================
  const scopedAttendances = useMemo(() => {
    return attendances.filter(att => {
      // Date Range Match
      if (att.date < startDate || att.date > endDate) return false;

      // Project Match
      if (selectedProjectId !== 'ALL' && att.projectId !== selectedProjectId) {
        return false;
      }

      // Find Employee Info
      const emp = employees.find(e => e.id === att.employeeId || e.nik === att.employeeNik);

      // Department Match
      if (selectedDepartment !== 'ALL') {
        if (!emp || emp.department !== selectedDepartment) return false;
      }

      // Search Query Match (Name, NIK, ID, LoginID)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const loginId = getLoginBadge(att).toLowerCase();
        const name = (att.employeeName || emp?.name || '').toLowerCase();
        const nik = (att.employeeNik || emp?.nik || '').toLowerCase();
        const id = (att.employeeId || '').toLowerCase();
        if (!name.includes(q) && !nik.includes(q) && !id.includes(q) && !loginId.includes(q)) {
          return false;
        }
      }

      // Compliance Filter Match
      if (complianceFilter === 'ON_TIME') {
        if (att.isLate || (att.lateMinutes && att.lateMinutes > 0)) return false;
      } else if (complianceFilter === 'LATE') {
        if (!att.isLate && (!att.lateMinutes || att.lateMinutes <= 0)) return false;
      } else if (complianceFilter === 'OUT_GEOFENCE') {
        if (att.location?.inGeofence) return false;
      } else if (complianceFilter === 'FRAUD_BIOMETRIC') {
        const score = att.biometricVerification?.matchScore;
        if (score === undefined || score >= 60) return false;
      }

      return true;
    });
  }, [
    attendances,
    startDate,
    endDate,
    selectedProjectId,
    selectedDepartment,
    searchQuery,
    complianceFilter,
    employees
  ]);

  // =========================================================================
  // 5. EMPLOYEE COMPLIANCE & PERFORMANCE AGGREGATION
  // =========================================================================
  const employeePerformanceList = useMemo(() => {
    const totalWorkingDays = Math.max(1, workingDaysInRange.length);

    return employees.map(emp => {
      // Filter attendances for this employee in date range
      const empAtts = attendances.filter(a => {
        const isMatch = a.employeeId === emp.id || a.employeeNik === emp.nik;
        return isMatch && a.date >= startDate && a.date <= endDate;
      });

      // Filter leaves for this employee in date range
      const empLeaves = approvals.filter(ap => {
        if (ap.status !== 'APPROVED') return false;
        if (ap.type !== 'LEAVE') return false;
        if (ap.employeeId !== emp.id) return false;
        // Overlaps with range
        const lEnd = ap.endDate || ap.startDate;
        return ap.startDate <= endDate && lEnd >= startDate;
      });

      const attendedDaysSet = new Set(empAtts.map(a => a.date));
      const attendedDays = attendedDaysSet.size;

      let lateCount = 0;
      let totalLateMinutes = 0;
      let outOfGeofenceCount = 0;
      let biometricMismatchCount = 0;
      let biometricScoresSum = 0;
      let biometricScoresCount = 0;

      empAtts.forEach(a => {
        if (a.isLate || (a.lateMinutes && a.lateMinutes > 0)) {
          lateCount++;
          totalLateMinutes += a.lateMinutes || 0;
        }
        if (a.location && !a.location.inGeofence) {
          outOfGeofenceCount++;
        }
        if (a.biometricVerification?.matchScore !== undefined) {
          biometricScoresSum += a.biometricVerification.matchScore;
          biometricScoresCount++;
          if (a.biometricVerification.matchScore < 60) {
            biometricMismatchCount++;
          }
        }
      });

      const onTimeDays = Math.max(0, attendedDays - lateCount);

      // Estimate absent days (working days where employee didn't attend and had no approved leave)
      let leaveDaysCount = 0;
      const leaveDaysSet = new Set<string>();
      empLeaves.forEach(lv => {
        dateRangeDays.forEach(d => {
          const lEnd = lv.endDate || lv.startDate;
          if (d >= lv.startDate && d <= lEnd) {
            leaveDaysSet.add(d);
          }
        });
      });
      leaveDaysCount = leaveDaysSet.size;

      const absentDays = Math.max(0, totalWorkingDays - attendedDays - leaveDaysCount);

      const attendanceRate = Math.min(100, Math.round((attendedDays / totalWorkingDays) * 100));
      const onTimeComplianceRate = attendedDays > 0 ? Math.round((onTimeDays / attendedDays) * 100) : 0;

      // Disobedience / Infraction Score: (Late * 1) + (Absent * 3) + (OutGeofence * 1) + (BioMismatch * 2)
      const infractionScore = (lateCount * 1) + (absentDays * 3) + (outOfGeofenceCount * 1) + (biometricMismatchCount * 2);

      const avgBiometric = biometricScoresCount > 0 ? Math.round(biometricScoresSum / biometricScoresCount) : null;

      return {
        employee: emp,
        attendedDays,
        onTimeDays,
        lateCount,
        totalLateMinutes,
        absentDays,
        leaveDaysCount,
        outOfGeofenceCount,
        biometricMismatchCount,
        avgBiometric,
        attendanceRate,
        onTimeComplianceRate,
        infractionScore,
        attendances: empAtts
      };
    });
  }, [employees, attendances, approvals, startDate, endDate, workingDaysInRange, dateRangeDays]);

  // Filtered Employee List (by search & department & project)
  const filteredEmployeePerformance = useMemo(() => {
    return employeePerformanceList.filter(item => {
      const emp = item.employee;
      if (selectedProjectId !== 'ALL' && emp.assignedProjectId !== selectedProjectId) {
        return false;
      }
      if (selectedDepartment !== 'ALL' && emp.department !== selectedDepartment) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (emp.name || '').toLowerCase();
        const nik = (emp.nik || '').toLowerCase();
        const id = (emp.id || '').toLowerCase();
        const loginId = (emp.loginId || '').toLowerCase();
        if (!name.includes(q) && !nik.includes(q) && !id.includes(q) && !loginId.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [employeePerformanceList, selectedProjectId, selectedDepartment, searchQuery]);

  // =========================================================================
  // 6. EXECUTIVE KPI SUMMARY METRICS
  // =========================================================================
  const summaryMetrics = useMemo(() => {
    const totalStaff = filteredEmployeePerformance.length;
    if (totalStaff === 0) {
      return {
        avgAttendanceRate: 0,
        avgComplianceRate: 0,
        totalLateIncidents: 0,
        totalLateMinutes: 0,
        totalAbsentDays: 0,
        totalGeofenceViolations: 0,
        totalBiometricAlerts: 0
      };
    }

    let attSum = 0;
    let compSum = 0;
    let lateIncidents = 0;
    let lateMins = 0;
    let absentDays = 0;
    let geofenceViolations = 0;
    let biometricAlerts = 0;

    filteredEmployeePerformance.forEach(item => {
      attSum += item.attendanceRate;
      compSum += item.onTimeComplianceRate;
      lateIncidents += item.lateCount;
      lateMins += item.totalLateMinutes;
      absentDays += item.absentDays;
      geofenceViolations += item.outOfGeofenceCount;
      biometricAlerts += item.biometricMismatchCount;
    });

    return {
      avgAttendanceRate: Math.round(attSum / totalStaff),
      avgComplianceRate: Math.round(compSum / totalStaff),
      totalLateIncidents: lateIncidents,
      totalLateMinutes: lateMins,
      totalAbsentDays: absentDays,
      totalGeofenceViolations: geofenceViolations,
      totalBiometricAlerts: biometricAlerts
    };
  }, [filteredEmployeePerformance]);

  // =========================================================================
  // 7. ECHARTS REFS & OPTIONS
  // =========================================================================
  const trendChartRef = useRef<HTMLDivElement>(null);
  const trendChartInstance = useRef<echarts.ECharts | null>(null);

  const disobedientChartRef = useRef<HTMLDivElement>(null);
  const disobedientChartInstance = useRef<echarts.ECharts | null>(null);

  // Chart 1: Daily Attendance & Compliance Trend
  useEffect(() => {
    if (!trendChartRef.current) return;
    if (!trendChartInstance.current) {
      trendChartInstance.current = echarts.init(trendChartRef.current);
    }

    // Aggregate daily stats across all selected dates
    const dailyStats = dateRangeDays.map(dateStr => {
      const dayAtts = scopedAttendances.filter(a => a.date === dateStr);
      let onTime = 0;
      let late = 0;
      let outGeo = 0;

      dayAtts.forEach(a => {
        if (a.isLate || (a.lateMinutes && a.lateMinutes > 0)) {
          late++;
        } else {
          onTime++;
        }
        if (a.location && !a.location.inGeofence) {
          outGeo++;
        }
      });

      const totalHadir = dayAtts.length;
      const compliancePercent = totalHadir > 0 ? Math.round((onTime / totalHadir) * 100) : 0;

      const formattedLabel = (() => {
        const p = dateStr.split('-');
        return `${p[2]}/${p[1]}`;
      })();

      return {
        dateStr,
        label: formattedLabel,
        onTime,
        late,
        outGeo,
        totalHadir,
        compliancePercent
      };
    });

    const dates = dailyStats.map(s => s.label);
    const onTimeData = dailyStats.map(s => s.onTime);
    const lateData = dailyStats.map(s => s.late);
    const complianceRateData = dailyStats.map(s => s.compliancePercent);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', crossStyle: { color: '#999' } },
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#F8FAFC', fontSize: 11, fontFamily: 'monospace' },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const stat = dailyStats[idx];
          return `
            <div style="font-weight:bold; margin-bottom:4px; color:#FF8533;">${stat.dateStr}</div>
            <div style="display:flex; justify-content:space-between; gap:16px;">
              <span>🟢 Tepat Waktu:</span> <b>${stat.onTime}</b>
            </div>
            <div style="display:flex; justify-content:space-between; gap:16px;">
              <span>🟡 Terlambat:</span> <b>${stat.late}</b>
            </div>
            <div style="display:flex; justify-content:space-between; gap:16px;">
              <span>📍 Luar Geofence:</span> <b>${stat.outGeo}</b>
            </div>
            <div style="border-top:1px solid #475569; margin:4px 0; padding-top:4px; display:flex; justify-content:space-between; gap:16px;">
              <span>⚡ Kepatuhan:</span> <b style="color:#00E2B0;">${stat.compliancePercent}%</b>
            </div>
          `;
        }
      },
      legend: {
        data: ['Tepat Waktu', 'Terlambat', 'Kepatuhan (%)'],
        textStyle: { color: '#64748B', fontSize: 11 },
        top: 0,
        right: 10
      },
      grid: {
        top: 40,
        left: 40,
        right: 45,
        bottom: 30,
        containLabel: true
      },
      xAxis: [
        {
          type: 'category',
          data: dates,
          axisPointer: { type: 'shadow' },
          axisLine: { lineStyle: { color: '#CBD5E1' } },
          axisLabel: { color: '#64748B', fontSize: 10, fontFamily: 'monospace' }
        }
      ],
      yAxis: [
        {
          type: 'value',
          name: 'Personel',
          nameTextStyle: { color: '#64748B', fontSize: 10 },
          splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } },
          axisLabel: { color: '#64748B', fontSize: 10, fontFamily: 'monospace' }
        },
        {
          type: 'value',
          name: '% Patuh',
          min: 0,
          max: 100,
          nameTextStyle: { color: '#64748B', fontSize: 10 },
          splitLine: { show: false },
          axisLabel: { color: '#FF6B00', fontSize: 10, fontFamily: 'monospace', formatter: '{value}%' }
        }
      ],
      series: [
        {
          name: 'Tepat Waktu',
          type: 'bar',
          stack: 'Kehadiran',
          data: onTimeData,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#10B981' },
              { offset: 1, color: '#059669' }
            ]),
            borderRadius: [0, 0, 0, 0]
          }
        },
        {
          name: 'Terlambat',
          type: 'bar',
          stack: 'Kehadiran',
          data: lateData,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#F59E0B' },
              { offset: 1, color: '#D97706' }
            ]),
            borderRadius: [4, 4, 0, 0]
          }
        },
        {
          name: 'Kepatuhan (%)',
          type: 'line',
          yAxisIndex: 1,
          data: complianceRateData,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 3, color: '#FF6B00' },
          itemStyle: { color: '#FF6B00', borderColor: '#FFFFFF', borderWidth: 2 }
        }
      ]
    };

    trendChartInstance.current.setOption(option, true);
  }, [dateRangeDays, scopedAttendances]);

  // Chart 2: Top Non-Compliant Employees (Ranking Infractions)
  useEffect(() => {
    if (!disobedientChartRef.current) return;
    if (!disobedientChartInstance.current) {
      disobedientChartInstance.current = echarts.init(disobedientChartRef.current);
    }

    // Rank employees by infraction score descending
    const sortedDisobedient = [...filteredEmployeePerformance]
      .filter(item => item.infractionScore > 0)
      .sort((a, b) => b.infractionScore - a.infractionScore)
      .slice(0, 8)
      .reverse(); // Reverse so highest appears on top of horizontal bar

    const names = sortedDisobedient.map(item => {
      const login = item.employee.loginId || item.employee.id;
      return `${login} • ${item.employee.name.slice(0, 14)}`;
    });

    const lateData = sortedDisobedient.map(item => item.lateCount);
    const absentData = sortedDisobedient.map(item => item.absentDays);
    const outGeoData = sortedDisobedient.map(item => item.outOfGeofenceCount);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#F8FAFC', fontSize: 11, fontFamily: 'monospace' },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const target = sortedDisobedient[idx];
          return `
            <div style="font-weight:bold; margin-bottom:4px; color:#FF8533;">${target.employee.name} (${target.employee.loginId || target.employee.id})</div>
            <div style="display:flex; justify-content:space-between; gap:16px;">
              <span>🟡 Kasus Terlambat:</span> <b>${target.lateCount}x (${target.totalLateMinutes} mnt)</b>
            </div>
            <div style="display:flex; justify-content:space-between; gap:16px;">
              <span>🔴 Hari Alpa / Tidak Hadir:</span> <b>${target.absentDays} hari</b>
            </div>
            <div style="display:flex; justify-content:space-between; gap:16px;">
              <span>📍 Luar Radius Geofence:</span> <b>${target.outOfGeofenceCount}x</b>
            </div>
            <div style="border-top:1px solid #475569; margin:4px 0; padding-top:4px; color:#FCD34D;">
              💡 <i>Klik bar ini untuk memfilter log karyawan ini</i>
            </div>
          `;
        }
      },
      legend: {
        data: ['Terlambat', 'Alpa / Tidak Hadir', 'Luar Geofence'],
        textStyle: { color: '#64748B', fontSize: 11 },
        top: 0,
        right: 10
      },
      grid: {
        top: 40,
        left: 20,
        right: 35,
        bottom: 10,
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: 'Insiden',
        nameTextStyle: { color: '#64748B', fontSize: 10 },
        splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } },
        axisLabel: { color: '#64748B', fontSize: 10, fontFamily: 'monospace' }
      },
      yAxis: {
        type: 'category',
        data: names,
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisLabel: { color: '#334155', fontSize: 11, fontWeight: 'bold' }
      },
      series: [
        {
          name: 'Terlambat',
          type: 'bar',
          stack: 'Pelanggaran',
          data: lateData,
          itemStyle: { color: '#F59E0B' }
        },
        {
          name: 'Alpa / Tidak Hadir',
          type: 'bar',
          stack: 'Pelanggaran',
          data: absentData,
          itemStyle: { color: '#EF4444' }
        },
        {
          name: 'Luar Geofence',
          type: 'bar',
          stack: 'Pelanggaran',
          data: outGeoData,
          itemStyle: { color: '#8B5CF6', borderRadius: [0, 4, 4, 0] }
        }
      ]
    };

    disobedientChartInstance.current.setOption(option, true);

    // Click handler on bar: filter search box to that employee
    disobedientChartInstance.current.off('click');
    disobedientChartInstance.current.on('click', (params: any) => {
      const idx = params.dataIndex;
      const target = sortedDisobedient[idx];
      if (target) {
        setSearchQuery(target.employee.loginId || target.employee.name);
      }
    });
  }, [filteredEmployeePerformance]);

  // Window Resize Listener for ECharts
  useEffect(() => {
    const handleResize = () => {
      trendChartInstance.current?.resize();
      disobedientChartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Dispose charts on unmount
  useEffect(() => {
    return () => {
      trendChartInstance.current?.dispose();
      trendChartInstance.current = null;
      disobedientChartInstance.current?.dispose();
      disobedientChartInstance.current = null;
    };
  }, []);

  // =========================================================================
  // 8. EXCEL EXPORT HANDLER
  // =========================================================================
  const handleExportExcel = () => {
    const dataToExport = scopedAttendances.map(a => {
      const emp = employees.find(e => e.id === a.employeeId || e.nik === a.employeeNik);
      const loginId = getLoginBadge(a);
      const projInfo = getProjectInfo(a);
      const noteInfo = extractUserAttendanceNote(a);
      const isLateStr = a.isLate ? `Terlambat (${a.lateMinutes || 0} mnt)` : 'Tepat Waktu';
      const geofenceStr = a.location?.inGeofence ? 'Dalam Area' : `Luar Geofence (${formatDistanceKm(a.location?.distanceMeters)})`;
      const bioStr = a.biometricVerification?.matchScore !== undefined ? `${a.biometricVerification.matchScore}% Match` : 'Belum Enroll';

      return {
        'ID Login': loginId,
        'Tanggal': a.date,
        'Nama Karyawan': a.employeeName || emp?.name || '-',
        'NIK': a.employeeNik || emp?.nik || '-',
        'Proyek': projInfo.name,
        'Kode Proyek': projInfo.code,
        'Departemen': emp?.department || '-',
        'Jam Masuk': a.checkInTime ? `${a.checkInTime} WIB` : '-',
        'Jam Pulang': a.checkOutTime ? `${a.checkOutTime} WIB` : '-',
        'Status Kepatuhan': isLateStr,
        'Lokasi & Geofence': geofenceStr,
        'Alamat Presensi': a.location?.address || '-',
        'Skor Biometrik': bioStr,
        'Catatan Absen': noteInfo.text !== '-' ? noteInfo.text : (a.note || '-')
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Log_Presensi_HR_Room');
    const filename = `HR_Room_Presensi_${startDate}_sd_${endDate}`;
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  // Displayed Attendance History (Load More / Pagination)
  const displayedAttendances = useMemo(() => {
    return scopedAttendances.slice(0, visibleRowsCount);
  }, [scopedAttendances, visibleRowsCount]);

  return (
    <div className="space-y-6">
      {/* =====================================================================
          1. HEADER & HERO BANNER (HR ROOM ENTERPRISE)
         ===================================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 sm:p-8 text-white shadow-xl shadow-slate-900/10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF6B00]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[#FF8533] text-xs font-mono-code font-bold uppercase tracking-wider backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#FF6B00] animate-pulse" />
              <span>Superuser Exclusive • HR Room Analytics</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>HR Room</span>
              <span className="text-slate-400 font-light">|</span>
              <span className="text-slate-200 text-lg sm:text-xl font-medium">Pusat Monitoring & Kepatuhan Karyawan</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Pantau performa presensi tiap individu, tren kedisiplinan kerja, analisis keterlambatan, dan audit integritas foto biometrik secara terpusat dengan filter presisi.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 flex items-center gap-2 transition-all cursor-pointer"
              title="Unduh seluruh rekaman log yang terfilter ke format Excel (.xlsx)"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor Excel (.xlsx)</span>
            </button>
            <button
              onClick={() => handleSelectPreset(datePreset)}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 transition-all cursor-pointer"
              title="Segarkan Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Date Preset Selector Toolbar */}
        <div className="relative z-10 mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 font-mono-code flex items-center gap-1.5 mr-1 font-bold">
              <Calendar className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span>Rentang Waktu:</span>
            </span>
            {(['TODAY', 'LAST_7', 'THIS_MONTH', 'LAST_30', 'ALL', 'CUSTOM'] as DatePreset[]).map(p => {
              const labels: Record<DatePreset, string> = {
                TODAY: 'Hari Ini',
                LAST_7: '7 Hari Terakhir',
                THIS_MONTH: 'Bulan Ini',
                LAST_30: '30 Hari Terakhir',
                ALL: 'Semua Data',
                CUSTOM: 'Kustom'
              };
              const isActive = datePreset === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer font-mono-code ${
                    isActive
                      ? 'bg-[#FF6B00] text-white shadow-md shadow-orange-500/30 ring-1 ring-orange-400'
                      : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700'
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>

          {/* Custom Date Pickers */}
          <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs shadow-inner">
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setDatePreset('CUSTOM');
              }}
              className="bg-transparent text-slate-200 font-mono-code focus:outline-none cursor-pointer"
            />
            <span className="text-slate-500 font-mono-code">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setDatePreset('CUSTOM');
              }}
              className="bg-transparent text-slate-200 font-mono-code focus:outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. EXECUTIVE KPI CARDS (PREMIUM REFINED)
         ===================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: Rata-Rata Kehadiran */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4.5 border border-slate-200/90 border-t-4 border-t-emerald-500 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 font-mono-code uppercase tracking-wider">Rata Kehadiran</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 font-mono-code">
              {summaryMetrics.avgAttendanceRate}%
            </div>
            <p className="text-[10px] text-slate-500 mt-1 font-medium">
              {workingDaysInRange.length} hari kerja dalam rentang
            </p>
          </div>
        </div>

        {/* KPI 2: Kepatuhan Tepat Waktu */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4.5 border border-slate-200/90 border-t-4 border-t-[#FF6B00] shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 font-mono-code uppercase tracking-wider">Kepatuhan Waktu</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/60 text-[#FF6B00] flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#FF6B00] font-mono-code">
              {summaryMetrics.avgComplianceRate}%
            </div>
            <p className="text-[10px] text-slate-500 mt-1 font-medium">
              Presensi masuk sebelum cutoff
            </p>
          </div>
        </div>

        {/* KPI 3: Kasus Terlambat */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4.5 border border-slate-200/90 border-t-4 border-t-amber-500 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 font-mono-code uppercase tracking-wider">Total Terlambat</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-600 font-mono-code">
              {summaryMetrics.totalLateIncidents} <span className="text-xs font-normal text-slate-500">kali</span>
            </div>
            <p className="text-[10px] text-amber-700 font-semibold mt-1">
              Akumulasi {summaryMetrics.totalLateMinutes} menit
            </p>
          </div>
        </div>

        {/* KPI 4: Alpa / Tidak Hadir */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4.5 border border-slate-200/90 border-t-4 border-t-rose-500 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 font-mono-code uppercase tracking-wider">Alpa / Tanpa Izin</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200/60 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-600 font-mono-code">
              {summaryMetrics.totalAbsentDays} <span className="text-xs font-normal text-slate-500">hari</span>
            </div>
            <p className="text-[10px] text-rose-700 font-semibold mt-1">
              Tanpa tiket cuti/izin resmi
            </p>
          </div>
        </div>

        {/* KPI 5: Pelanggaran Geofence & Biometrik */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4.5 border border-slate-200/90 border-t-4 border-t-purple-500 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between col-span-2 sm:col-span-1 group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 font-mono-code uppercase tracking-wider">Integritas Audit</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200/60 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-purple-700 font-mono-code">
              {summaryMetrics.totalGeofenceViolations + summaryMetrics.totalBiometricAlerts}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 font-medium">
              {summaryMetrics.totalGeofenceViolations} luar area • {summaryMetrics.totalBiometricAlerts} bio alert
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. INTERACTIVE ECHARTS ANALYTICS (2 CHARTS)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Daily Attendance & Compliance Trend (7 Cols) */}
        <div className="lg:col-span-7 bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#FF6B00]" />
                <span>Tren Kehadiran & Kepatuhan Harian</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Volatilitas rasio tepat waktu vs keterlambatan per tanggal
              </p>
            </div>
            <span className="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {dateRangeDays.length} Hari Terpantau
            </span>
          </div>

          <div ref={trendChartRef} className="w-full h-[280px]" />
        </div>

        {/* Chart 2: Top Non-Compliant Employees Ranking (5 Cols) */}
        <div className="lg:col-span-5 bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Top Karyawan Paling Sering Tidak Patuh</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Akumulasi terlambat, alpa, dan presensi luar geofence
              </p>
            </div>
            <span className="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              Ranking Disiplin
            </span>
          </div>

          <div ref={disobedientChartRef} className="w-full h-[280px]" />
        </div>
      </div>

      {/* =====================================================================
          4. FILTER & SEARCH CONTROL BAR FOR LOGS & EMPLOYEES (PREMIUM COMMAND BAR)
         ===================================================================== */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
        {/* Top Controls: Search & Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Live Search Input */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari nama karyawan, NIK, ID akun (e.g. d014, d025)..."
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-slate-50/80 hover:bg-slate-100/70 focus:bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/25 focus:border-[#FF6B00] transition-all font-mono-code"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded-full hover:bg-slate-200/60 transition-colors"
                title="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Project Selector */}
          <div className="md:col-span-3 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <Building className="w-3.5 h-3.5" />
            </div>
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="w-full pl-8.5 pr-8 py-2.5 rounded-2xl bg-slate-50/80 hover:bg-slate-100/70 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/25 focus:border-[#FF6B00] cursor-pointer font-mono-code appearance-none transition-all"
            >
              <option value="ALL">Semua Proyek ({projects.length})</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Department Selector */}
          <div className="md:col-span-3 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
            <select
              value={selectedDepartment}
              onChange={e => setSelectedDepartment(e.target.value)}
              className="w-full pl-8.5 pr-8 py-2.5 rounded-2xl bg-slate-50/80 hover:bg-slate-100/70 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/25 focus:border-[#FF6B00] cursor-pointer font-mono-code appearance-none transition-all"
            >
              <option value="ALL">Semua Departemen ({departments.length})</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Status Filter & Summary Toolbar */}
        <div className="pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black text-slate-400 font-mono-code uppercase tracking-wider mr-1">
              STATUS:
            </span>
            {([
              { id: 'ALL', label: 'Semua Status', dot: null },
              { id: 'LATE', label: 'Hanya Terlambat', dot: 'bg-amber-500' },
              { id: 'ON_TIME', label: 'Hanya Tepat Waktu', dot: 'bg-emerald-500' },
              { id: 'OUT_GEOFENCE', label: 'Luar Geofence', dot: 'bg-orange-500' },
              { id: 'FRAUD_BIOMETRIC', label: 'Mismatch Biometrik (<60%)', dot: 'bg-rose-500' }
            ] as const).map(tab => {
              const isActive = complianceFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setComplianceFilter(tab.id as ComplianceFilter)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold font-mono-code transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs ring-1 ring-slate-900'
                      : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.dot && <span className={`w-2 h-2 rounded-full ${tab.dot}`} />}
                  <span>{tab.label}</span>
                </button>
              );
            })}

            {/* Reset Filter Button if active */}
            {(searchQuery || selectedProjectId !== 'ALL' || selectedDepartment !== 'ALL' || complianceFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedProjectId('ALL');
                  setSelectedDepartment('ALL');
                  setComplianceFilter('ALL');
                }}
                className="px-2.5 py-1 rounded-full text-[11px] font-bold font-mono-code text-[#FF6B00] hover:bg-orange-50 border border-orange-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                title="Reset semua filter"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>

          {/* Record Counters */}
          <div className="flex items-center gap-2 text-xs font-mono-code text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Menemukan <b>{scopedAttendances.length}</b> rekaman log</span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          5. TABLE LOG RIWAYAT PRESENSI TERPADU (PREMIUM REFINED)
         ===================================================================== */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-6 py-4.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50/70 via-white to-slate-50/70">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FF6B00]" />
              <span>Log Riwayat Presensi Detail</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Rekaman presensi masuk, pulang, durasi kerja, status kepatuhan, serta skor biometrik per individu
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-mono-code font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
              Menampilkan {Math.min(displayedAttendances.length, visibleRowsCount)} dari {scopedAttendances.length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full table-fixed min-w-[860px] text-left text-xs">
            <colgroup>
              <col className="w-[55px]" />
              <col className="w-[80px]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[75px]" />
              <col className="w-[72px]" />
              <col className="w-[58px]" />
              <col className="w-[58px]" />
              <col className="w-[16%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200/90 bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[10px] font-mono-code font-bold">
                <th className="py-2 px-1 w-[55px] text-center whitespace-nowrap">ID</th>
                <th className="py-2 px-1 w-[80px] whitespace-nowrap">Tanggal</th>
                <th className="py-2 px-1.5">Karyawan</th>
                <th className="py-2 px-1.5">Proyek</th>
                <th className="py-2 px-1 w-[75px] whitespace-nowrap">Masuk</th>
                <th className="py-2 px-1 w-[72px] whitespace-nowrap">Pulang</th>
                <th className="py-2 px-1 w-[58px] text-center whitespace-nowrap">Kepatuhan</th>
                <th className="py-2 px-1 w-[58px] text-center whitespace-nowrap">Biometrik</th>
                <th className="py-2 px-1.5">Lokasi & Geofence</th>
                <th className="py-2 px-1.5">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedAttendances.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock className="w-7 h-7 text-slate-300" />
                      <p className="text-xs font-semibold text-slate-500">
                        Tidak ada log presensi yang cocok dengan filter tanggal atau kriteria pencarian.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedAttendances.map(item => {
                  const emp = employees.find(e => e.id === item.employeeId || e.nik === item.employeeNik);
                  const loginId = getLoginBadge(item);
                  const projInfo = getProjectInfo(item);
                  const noteInfo = extractUserAttendanceNote(item);
                  const isLate = item.isLate || (item.lateMinutes && item.lateMinutes > 0);
                  const dayName = getDayNameIndo(item.date);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. ID (Pojok Kiri) */}
                      <td className="py-2 px-1 text-center whitespace-nowrap">
                        <span
                          className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-mono-code font-bold text-[10px] inline-block shadow-2xs truncate max-w-[54px]"
                          title={`ID Login: ${loginId}`}
                        >
                          {loginId}
                        </span>
                      </td>

                      {/* 2. Tanggal */}
                      <td className="py-2 px-1 whitespace-nowrap font-mono-code">
                        <div className="flex flex-col leading-tight">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-800">
                            <Calendar className="w-3 h-3 text-[#FF6B00] shrink-0" />
                            <span>{item.date}</span>
                          </div>
                          {dayName && (
                            <span className="text-[9px] text-slate-400 font-medium ml-4 leading-none mt-0.5">
                              ({dayName})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Karyawan */}
                      <td className="py-2 px-1.5 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            if (emp) setInspectedEmployee(emp);
                          }}
                          className="text-left group cursor-pointer focus:outline-none flex items-center gap-1.5 w-full min-w-0"
                          title={`Lihat profil: ${item.employeeName} (${loginId})`}
                        >
                          {emp?.avatar ? (
                            <img
                              src={emp.avatar}
                              alt={item.employeeName}
                              className="w-5 h-5 rounded-full object-cover border border-slate-200 shrink-0 group-hover:ring-2 group-hover:ring-[#FF6B00]/50 transition-all"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[9px] font-mono-code shrink-0 group-hover:bg-[#FF6B00] transition-colors">
                              {(item.employeeName || 'K')[0].toUpperCase()}
                            </div>
                          )}
                          <span
                            className="font-bold text-slate-900 group-hover:text-[#FF6B00] transition-colors truncate text-[11px] block min-w-0 flex-1"
                            title={item.employeeName}
                          >
                            {item.employeeName}
                          </span>
                        </button>
                      </td>

                      {/* 4. Proyek */}
                      <td className="py-2 px-1.5 overflow-hidden">
                        <div className="flex items-center gap-1.5 min-w-0" title={projInfo.name}>
                          <Building className={`w-3 h-3 shrink-0 ${projInfo.isOffice ? 'text-slate-400' : 'text-[#FF6B00]'}`} />
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-slate-900 text-[10px] truncate block leading-tight">
                              {projInfo.name}
                            </span>
                            <span className="text-[8.5px] font-mono-code font-semibold px-1 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200/60 inline-block leading-none mt-0.5">
                              {projInfo.code}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 5. Masuk */}
                      <td className="py-2 px-1 whitespace-nowrap">
                        {item.checkInTime ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPhotoItem(item);
                              setPhotoType('CHECK_IN');
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/70 font-mono-code text-[10px] font-bold transition-all group cursor-pointer shadow-2xs"
                            title="Klik untuk melihat foto selfie masuk"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 group-hover:scale-125 transition-transform" />
                            <span>{item.checkInTime.replace(/\s*WIB/i, '')}</span>
                            <Camera className="w-2.5 h-2.5 text-emerald-600 group-hover:text-emerald-700 shrink-0" />
                          </button>
                        ) : (
                          <span className="text-slate-400 font-mono-code text-[10px]">-</span>
                        )}
                      </td>

                      {/* 6. Pulang */}
                      <td className="py-2 px-1 whitespace-nowrap">
                        {item.checkOutTime ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPhotoItem(item);
                              setPhotoType('CHECK_OUT');
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200/70 font-mono-code text-[10px] font-bold transition-all group cursor-pointer shadow-2xs"
                            title="Klik untuk melihat foto selfie pulang"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 group-hover:scale-125 transition-transform" />
                            <span>{item.checkOutTime.replace(/\s*WIB/i, '')}</span>
                            <Camera className="w-2.5 h-2.5 text-blue-600 group-hover:text-blue-700 shrink-0" />
                          </button>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400 text-[9px] font-mono-code font-medium border border-slate-200/60 inline-flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span>Belum</span>
                          </span>
                        )}
                      </td>

                      {/* 7. Kepatuhan (Icon & Angka Saja, Tanpa Teks) */}
                      <td className="py-2 px-1 text-center whitespace-nowrap">
                        {isLate ? (
                          <span
                            className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold font-mono-code inline-flex items-center gap-1 shadow-2xs"
                            title={`Terlambat ${item.lateMinutes || 0} menit`}
                          >
                            <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>{item.lateMinutes ? `${item.lateMinutes}m` : '0m'}</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center justify-center p-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                            title="Tepat Waktu"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          </span>
                        )}
                      </td>

                      {/* 8. Biometrik (Icon & Angka Saja, Tanpa Teks) */}
                      <td className="py-2 px-1 text-center whitespace-nowrap">
                        {item.biometricVerification ? (
                          item.biometricVerification.matchScore !== undefined && item.biometricVerification.matchScore !== null ? (
                            item.biometricVerification.matchScore >= 70 ? (
                              <span
                                className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono-code inline-flex items-center gap-1 shadow-2xs"
                                title={`Biometrik Cocok: ${item.biometricVerification.matchScore}%`}
                              >
                                <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>{item.biometricVerification.matchScore}%</span>
                              </span>
                            ) : item.biometricVerification.matchScore >= 60 ? (
                              <span
                                className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold font-mono-code inline-flex items-center gap-1 shadow-2xs"
                                title={`Biometrik Memadai: ${item.biometricVerification.matchScore}%`}
                              >
                                <ShieldCheck className="w-3 h-3 text-blue-600 shrink-0" />
                                <span>{item.biometricVerification.matchScore}%</span>
                              </span>
                            ) : (
                              <span
                                className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold font-mono-code inline-flex items-center gap-1 shadow-2xs"
                                title={item.biometricVerification.details || `Skor Rendah / Tanpa Wajah: ${item.biometricVerification.matchScore || 0}%`}
                              >
                                <ShieldAlert className="w-3 h-3 text-rose-600 shrink-0" />
                                <span>{item.biometricVerification.matchScore || 0}%</span>
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 font-mono-code text-[11px]" title="Non-Biometrik">-</span>
                          )
                        ) : (
                          <span className="text-slate-400 font-mono-code text-[11px]" title="Belum Enroll Biometrik">-</span>
                        )}
                      </td>

                      {/* 9. Lokasi & Geofence */}
                      <td className="py-2 px-1.5 overflow-hidden">
                        <div className="flex items-center gap-1 font-mono-code text-[9px] font-bold leading-tight">
                          <MapPin className={`w-2.5 h-2.5 shrink-0 ${item.location?.inGeofence ? 'text-emerald-500' : 'text-amber-500'}`} />
                          <span
                            className={`px-1 py-0.2 rounded truncate leading-none ${
                              item.location?.inGeofence
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            }`}
                          >
                            {formatDistanceKm(item.location?.distanceMeters)} {item.location?.inGeofence ? '(In)' : '(Luar)'}
                          </span>
                        </div>
                        <div
                          className="text-[9px] text-slate-500 truncate block mt-0.5 leading-tight"
                          title={item.location?.address}
                        >
                          {item.location?.address || '-'}
                        </div>
                      </td>

                      {/* 10. Catatan */}
                      <td className="py-2 px-1.5 overflow-hidden">
                        {noteInfo.text === '-' ? (
                          <span className="text-slate-400 font-mono-code text-[10px]">-</span>
                        ) : (
                          <div className="flex items-center gap-1 min-w-0" title={noteInfo.fullRaw}>
                            {noteInfo.badge && (
                              <span
                                className={`shrink-0 px-1 py-0.2 rounded text-[8.5px] font-bold font-mono-code border leading-none ${
                                  noteInfo.badge === 'Luar Area'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200/70'
                                    : noteInfo.badge === 'Alasan Telat'
                                    ? 'bg-orange-50 text-orange-800 border-orange-200/70'
                                    : 'bg-blue-50 text-blue-800 border-blue-200/70'
                                }`}
                              >
                                {noteInfo.badge}
                              </span>
                            )}
                            <span className="text-slate-800 text-[10px] font-medium truncate block min-w-0 flex-1 leading-tight">
                              {noteInfo.text}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Load More Button */}
        {scopedAttendances.length > visibleRowsCount && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-center bg-slate-50/50">
            <button
              onClick={() => setVisibleRowsCount(prev => prev + 15)}
              className="px-5 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold font-mono-code shadow-2xs hover:shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Muat 15 Log Lainnya...</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* =====================================================================
          6. MODAL 1: INSPEKSI DETAIL PERFORMA KARYAWAN (INDIVIDUAL DEEP DIVE)
         ===================================================================== */}
      {inspectedEmployee && (() => {
        const perfData = employeePerformanceList.find(p => p.employee.id === inspectedEmployee.id);
        const empProj = projects.find(p => p.id === inspectedEmployee.assignedProjectId);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <img
                    src={inspectedEmployee.avatar}
                    alt={inspectedEmployee.name}
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-orange-400 shadow-xs"
                  />
                  <div>
                    <h4 className="text-base font-black text-white">{inspectedEmployee.name}</h4>
                    <p className="text-xs text-orange-400 font-mono-code">
                      {inspectedEmployee.loginId || inspectedEmployee.id} • {inspectedEmployee.position}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setInspectedEmployee(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 font-mono-code text-[11px]">
                  <div>
                    <span className="text-slate-400">NIK:</span> <b className="text-slate-900">{inspectedEmployee.nik}</b>
                  </div>
                  <div>
                    <span className="text-slate-400">Dept:</span> <b className="text-slate-900">{inspectedEmployee.department || '-'}</b>
                  </div>
                  <div>
                    <span className="text-slate-400">Proyek:</span> <b className="text-slate-900">{empProj ? empProj.name : 'Kantor Pusat'}</b>
                  </div>
                  <div>
                    <span className="text-slate-400">Biometrik:</span> <b className={perfData?.avgBiometric && perfData.avgBiometric >= 70 ? 'text-emerald-700' : 'text-slate-700'}>{perfData?.avgBiometric ? `${perfData.avgBiometric}% Match` : 'Belum Enroll'}</b>
                  </div>
                </div>

                {/* Score Gauges */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase font-mono-code">Tingkat Hadir</span>
                    <div className="text-2xl font-black text-emerald-700 font-mono-code mt-1">
                      {perfData?.attendanceRate || 0}%
                    </div>
                    <span className="text-[10px] text-emerald-600 font-mono-code">
                      {perfData?.attendedDays || 0} / {workingDaysInRange.length} hari
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                    <span className="text-[10px] font-bold text-amber-800 uppercase font-mono-code">Kepatuhan Waktu</span>
                    <div className="text-2xl font-black text-amber-700 font-mono-code mt-1">
                      {perfData?.onTimeComplianceRate || 0}%
                    </div>
                    <span className="text-[10px] text-amber-600 font-mono-code">
                      {perfData?.onTimeDays || 0} tepat waktu
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
                    <span className="text-[10px] font-bold text-rose-800 uppercase font-mono-code">Pelanggaran</span>
                    <div className="text-2xl font-black text-rose-700 font-mono-code mt-1">
                      {perfData?.lateCount || 0}x
                    </div>
                    <span className="text-[10px] text-rose-600 font-mono-code">
                      {perfData?.totalLateMinutes || 0} mnt telat
                    </span>
                  </div>
                </div>

                {/* Detailed Log Summary */}
                <div>
                  <h5 className="font-bold text-slate-900 mb-2 font-mono-code text-xs uppercase">
                    Log Presensi Karyawan ({startDate} s/d {endDate}):
                  </h5>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {perfData?.attendances && perfData.attendances.length > 0 ? (
                      perfData.attendances.map(a => (
                        <div key={a.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-mono-code font-bold text-slate-800">{a.date}</span>
                            <span className="text-slate-400 ml-2">Masuk: {a.checkInTime || '-'} • Pulang: {a.checkOutTime || '-'}</span>
                          </div>
                          <div>
                            {a.isLate ? (
                              <span className="text-[10px] font-bold font-mono-code px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                Telat {a.lateMinutes}m
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold font-mono-code px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                Tepat Waktu
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">Belum ada rekaman log hadir pada rentang ini.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery(inspectedEmployee.loginId || inspectedEmployee.name);
                    setInspectedEmployee(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs font-mono-code cursor-pointer transition-colors"
                >
                  Filter Tabel ke Karyawan Ini
                </button>
                <button
                  type="button"
                  onClick={() => setInspectedEmployee(null)}
                  className="px-4 py-1.5 rounded-xl bg-[#FF6B00] text-white font-bold text-xs font-mono-code cursor-pointer shadow-xs hover:bg-[#e56000] transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =====================================================================
          7. MODAL 2: INSPEKSI FOTO & WATERMARK PRESENSI (PREMIUM REFINED)
         ===================================================================== */}
      {selectedPhotoItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Dark Executive Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#FF6B00]">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Bukti Foto & Watermark</h4>
                  <p className="text-[10px] font-mono-code text-slate-400">{selectedPhotoItem.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhotoItem(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Tutup dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Toggle Check-in / Check-out if both photos exist */}
            {(selectedPhotoItem.checkOutTime || selectedPhotoItem.photoOutUrl || (selectedPhotoItem as any).checkOutPhotoUrl) && (
              <div className="px-5 pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPhotoType('CHECK_IN')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold font-mono-code transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    photoType === 'CHECK_IN'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Foto Masuk ({selectedPhotoItem.checkInTime || '-'})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoType('CHECK_OUT')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold font-mono-code transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    photoType === 'CHECK_OUT'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span>Foto Pulang ({selectedPhotoItem.checkOutTime || '-'})</span>
                </button>
              </div>
            )}

            <div className="p-5 space-y-4">
              {(() => {
                const isMasuk = photoType === 'CHECK_IN';
                const activePhoto = isMasuk
                  ? (selectedPhotoItem.photoUrl || (selectedPhotoItem as any).checkInPhotoUrl)
                  : ((selectedPhotoItem as any).checkOutPhotoUrl || selectedPhotoItem.photoOutUrl || selectedPhotoItem.photoUrl);

                return (
                  <>
                    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-900 flex items-center justify-center max-h-[380px]">
                      {activePhoto ? (
                        <img
                          src={activePhoto}
                          alt={isMasuk ? "Foto Absen Masuk" : "Foto Absen Pulang"}
                          className="w-full object-contain max-h-[380px]"
                        />
                      ) : (
                        <div className="py-16 text-slate-500 text-xs font-mono-code text-center">
                          Tidak ada rekaman foto tersedia
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-xs space-y-2">
                      <div className="flex items-start justify-between pb-2 border-b border-slate-200/60">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-mono-code font-bold block">Tipe Presensi</span>
                          <span className="font-mono-code font-bold text-slate-900">
                            {isMasuk ? `Absen Masuk (${selectedPhotoItem.checkInTime} WIB)` : `Absen Pulang (${selectedPhotoItem.checkOutTime || '-'} WIB)`}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-mono-code font-bold block">Karyawan</span>
                          <span className="font-bold text-slate-900">
                            {selectedPhotoItem.employeeName}
                          </span>
                          <span className="ml-1.5 px-1.5 py-0.2 rounded bg-indigo-50 border border-indigo-200/60 text-indigo-700 font-mono-code font-bold text-[10px]">
                            {getLoginBadge(selectedPhotoItem)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 font-mono-code text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Jarak Geofence:</span>
                          <span className="font-bold text-slate-800">
                            {formatDistanceKm(selectedPhotoItem.location?.distanceMeters)} {selectedPhotoItem.location?.inGeofence ? '(Dalam Area)' : '(Luar Area)'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Skor Biometrik:</span>
                          <span className={`font-bold ${
                            (selectedPhotoItem.biometricVerification?.matchScore || 0) >= 70 ? 'text-emerald-700' :
                            (selectedPhotoItem.biometricVerification?.matchScore || 0) >= 60 ? 'text-blue-700' : 'text-rose-600'
                          }`}>
                            {selectedPhotoItem.biometricVerification?.matchScore !== undefined ? `${selectedPhotoItem.biometricVerification.matchScore}% Match` : 'Non-Biometrik'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-1">
                        <span className="text-slate-400 block text-[10px] font-mono-code">Lokasi Presensi:</span>
                        <span className="text-slate-600 text-[11px] leading-relaxed">
                          {selectedPhotoItem.location?.address || '-'}
                        </span>
                      </div>

                      {/* Proyek Presensi */}
                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono-code text-[10px]">Proyek / Lokasi Absen:</span>
                        <span className="font-bold text-slate-900 font-mono-code">
                          {getProjectInfo(selectedPhotoItem).name} ({getProjectInfo(selectedPhotoItem).code})
                        </span>
                      </div>

                      {/* Catatan Presensi Saat Absen */}
                      <div className="pt-2 border-t border-slate-200/60">
                        <span className="text-slate-400 block text-[10px] font-mono-code mb-0.5">Catatan Saat Absen:</span>
                        <div className="p-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-semibold leading-relaxed">
                          {extractUserAttendanceNote(selectedPhotoItem).text !== '-'
                            ? extractUserAttendanceNote(selectedPhotoItem).text
                            : (selectedPhotoItem.note || 'Tidak ada catatan tambahan')}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPhotoItem(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs font-mono-code cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
