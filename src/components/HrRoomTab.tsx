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
      const isLateStr = a.isLate ? `Terlambat (${a.lateMinutes || 0} mnt)` : 'Tepat Waktu';
      const geofenceStr = a.location?.inGeofence ? 'Dalam Area' : `Luar Geofence (${formatDistanceKm(a.location?.distanceMeters)})`;
      const bioStr = a.biometricVerification?.matchScore !== undefined ? `${a.biometricVerification.matchScore}% Match` : 'Belum Enroll';

      return {
        'Tanggal': a.date,
        'ID Login': loginId,
        'NIK': a.employeeNik || emp?.nik || '-',
        'Nama Karyawan': a.employeeName || emp?.name || '-',
        'Departemen': emp?.department || '-',
        'Proyek': a.projectId || emp?.assignedProjectId || '-',
        'Jam Masuk': a.checkInTime ? `${a.checkInTime} WIB` : '-',
        'Jam Pulang': a.checkOutTime ? `${a.checkOutTime} WIB` : '-',
        'Status Kepatuhan': isLateStr,
        'Lokasi & Geofence': geofenceStr,
        'Alamat Presensi': a.location?.address || '-',
        'Skor Biometrik': bioStr,
        'Catatan Presensi': a.note || '-'
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
        <div className="relative z-10 mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-mono-code flex items-center gap-1.5 mr-1">
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

          {/* Custom Date Pickers */}
          <div className="flex items-center gap-2 ml-auto mt-2 sm:mt-0 bg-slate-800/90 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setDatePreset('CUSTOM');
              }}
              className="bg-transparent text-slate-200 font-mono-code focus:outline-none cursor-pointer"
            />
            <span className="text-slate-500">s/d</span>
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
          2. EXECUTIVE KPI CARDS
         ===================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: Rata-Rata Kehadiran */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 font-mono-code uppercase">Rata Kehadiran</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 font-mono-code">
              {summaryMetrics.avgAttendanceRate}%
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {workingDaysInRange.length} hari kerja dalam rentang
            </p>
          </div>
        </div>

        {/* KPI 2: Kepatuhan Tepat Waktu */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 font-mono-code uppercase">Kepatuhan Waktu</span>
            <div className="w-7 h-7 rounded-lg bg-[#FF6B00]/10 text-[#FF6B00] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#FF6B00] font-mono-code">
              {summaryMetrics.avgComplianceRate}%
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Presensi masuk sebelum cutoff
            </p>
          </div>
        </div>

        {/* KPI 3: Kasus Terlambat */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 font-mono-code uppercase">Total Keterlambatan</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-600 font-mono-code">
              {summaryMetrics.totalLateIncidents} <span className="text-xs font-normal text-slate-500">kali</span>
            </div>
            <p className="text-[10px] text-amber-700 font-semibold mt-0.5">
              Akumulasi {summaryMetrics.totalLateMinutes} menit
            </p>
          </div>
        </div>

        {/* KPI 4: Alpa / Tidak Hadir */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 font-mono-code uppercase">Alpa / Tanpa Izin</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-600 font-mono-code">
              {summaryMetrics.totalAbsentDays} <span className="text-xs font-normal text-slate-500">hari</span>
            </div>
            <p className="text-[10px] text-rose-700 font-semibold mt-0.5">
              Tanpa tiket cuti/izin resmi
            </p>
          </div>
        </div>

        {/* KPI 5: Pelanggaran Geofence & Biometrik */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 font-mono-code uppercase">Integritas Audit</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-purple-700 font-mono-code">
              {summaryMetrics.totalGeofenceViolations + summaryMetrics.totalBiometricAlerts}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
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
          4. FILTER & SEARCH CONTROL BAR FOR LOGS & EMPLOYEES
         ===================================================================== */}
      <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Live Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari nama karyawan, NIK, ID akun (e.g. d014, d025)..."
              className="w-full pl-9 pr-8 py-2 rounded-2xl bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 transition-all font-mono-code"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Project & Department Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Project Filter */}
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 cursor-pointer font-mono-code"
            >
              <option value="ALL">Semua Proyek ({projects.length})</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>

            {/* Department Filter */}
            <select
              value={selectedDepartment}
              onChange={e => setSelectedDepartment(e.target.value)}
              className="px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 cursor-pointer font-mono-code"
            >
              <option value="ALL">Semua Departemen ({departments.length})</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Compliance Filter Pills */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 font-mono-code uppercase mr-1">Status:</span>
          {([
            { id: 'ALL', label: 'Semua Status' },
            { id: 'LATE', label: '🟡 Hanya Terlambat' },
            { id: 'ON_TIME', label: '🟢 Hanya Tepat Waktu' },
            { id: 'OUT_GEOFENCE', label: '📍 Luar Geofence' },
            { id: 'FRAUD_BIOMETRIC', label: '🛡️ Mismatch Biometrik (<60%)' }
          ] as { id: ComplianceFilter; label: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setComplianceFilter(tab.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold font-mono-code transition-all cursor-pointer ${
                complianceFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <span className="text-xs text-slate-400 font-mono-code ml-auto">
            Menemukan <b>{scopedAttendances.length}</b> rekaman log
          </span>
        </div>
      </div>

      {/* =====================================================================
          5. TABLE LOG RIWAYAT PRESENSI TERPADU
         ===================================================================== */}
      <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FF6B00]" />
              <span>Log Riwayat Presensi Detail</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Rekaman presensi masuk, pulang, durasi kerja, status kepatuhan, serta skor biometrik per individu
            </p>
          </div>
          <span className="text-xs font-mono-code font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
            Menampilkan {Math.min(displayedAttendances.length, visibleRowsCount)} dari {scopedAttendances.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 uppercase tracking-wider text-[10px] font-mono-code">
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Karyawan</th>
                <th className="py-2.5 px-3">Masuk</th>
                <th className="py-2.5 px-3">Pulang</th>
                <th className="py-2.5 px-3">Kepatuhan</th>
                <th className="py-2.5 px-3">Skor Biometrik</th>
                <th className="py-2.5 px-3">Lokasi & Geofence</th>
                <th className="py-2.5 px-3">Catatan</th>
                <th className="py-2.5 px-3 text-right">Foto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedAttendances.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
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
                  const isLate = item.isLate || (item.lateMinutes && item.lateMinutes > 0);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Tanggal */}
                      <td className="py-3 px-3 whitespace-nowrap font-mono-code text-[11px] font-semibold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                          <span>{item.date}</span>
                        </div>
                      </td>

                      {/* Karyawan & Login ID */}
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (emp) setInspectedEmployee(emp);
                          }}
                          className="text-left group cursor-pointer focus:outline-none"
                          title="Klik untuk melihat performa detail karyawan ini"
                        >
                          <div className="font-bold text-slate-900 group-hover:text-[#FF6B00] transition-colors flex items-center gap-1.5">
                            <span>{item.employeeName}</span>
                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#FF6B00]" />
                          </div>
                          <div className="text-[10px] text-indigo-600 font-mono-code font-bold">
                            {loginId} {emp?.department ? `• ${emp.department}` : ''}
                          </div>
                        </button>
                      </td>

                      {/* Masuk */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.checkInTime ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPhotoItem(item);
                              setPhotoType('CHECK_IN');
                            }}
                            className="font-mono-code text-[11px] font-bold text-slate-800 hover:text-[#FF6B00] flex items-center gap-1.5 group cursor-pointer"
                            title="Klik untuk melihat foto presensi masuk"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 group-hover:scale-125 transition-transform" />
                            <span>{item.checkInTime} WIB</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 font-mono-code text-[11px]">-</span>
                        )}
                      </td>

                      {/* Pulang */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.checkOutTime ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPhotoItem(item);
                              setPhotoType('CHECK_OUT');
                            }}
                            className="font-mono-code text-[11px] font-bold text-slate-800 hover:text-[#FF6B00] flex items-center gap-1.5 group cursor-pointer"
                            title="Klik untuk melihat foto presensi pulang"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 group-hover:scale-125 transition-transform" />
                            <span>{item.checkOutTime} WIB</span>
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-mono-code font-medium">
                            Belum Pulang
                          </span>
                        )}
                      </td>

                      {/* Status Kepatuhan */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isLate ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold font-mono-code inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Terlambat {item.lateMinutes ? `${item.lateMinutes}m` : ''}</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold font-mono-code inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Tepat Waktu</span>
                          </span>
                        )}
                      </td>

                      {/* Skor Biometrik */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.biometricVerification ? (
                          item.biometricVerification.matchScore !== undefined && item.biometricVerification.matchScore !== null ? (
                            item.biometricVerification.matchScore >= 70 ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono-code inline-flex items-center gap-1" title={item.biometricVerification.details || 'Biometrik Cocok'}>
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span>{item.biometricVerification.matchScore}% Match</span>
                              </span>
                            ) : item.biometricVerification.matchScore >= 60 ? (
                              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold font-mono-code inline-flex items-center gap-1" title={item.biometricVerification.details || 'Biometrik Memadai'}>
                                <ShieldCheck className="w-3 h-3 text-blue-600" />
                                <span>{item.biometricVerification.matchScore}% Match</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold font-mono-code inline-flex items-center gap-1" title={item.biometricVerification.details || 'Kemiripan Rendah / Tanpa Wajah'}>
                                <ShieldAlert className="w-3 h-3 text-rose-600" />
                                <span>{item.biometricVerification.matchScore === 0 ? 'Tanpa Wajah' : `${item.biometricVerification.matchScore}% Mismatch`}</span>
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-mono-code">
                              Non-Biometrik
                            </span>
                          )
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-mono-code">
                            Belum Enroll
                          </span>
                        )}
                      </td>

                      {/* Lokasi & Geofence */}
                      <td className="py-3 px-3 max-w-[220px]">
                        <div className="flex items-center gap-1 font-mono-code text-[10px] font-bold">
                          <MapPin className={`w-3 h-3 ${item.location?.inGeofence ? 'text-emerald-500' : 'text-amber-500'}`} />
                          <span className={item.location?.inGeofence ? 'text-emerald-700' : 'text-amber-700'}>
                            {formatDistanceKm(item.location?.distanceMeters)} {item.location?.inGeofence ? '(Dalam Area)' : '(Luar Area)'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate" title={item.location?.address}>
                          {item.location?.address || '-'}
                        </div>
                      </td>

                      {/* Catatan */}
                      <td className="py-3 px-3 max-w-[150px] text-slate-600 text-[11px] truncate" title={item.note}>
                        {item.note || '-'}
                      </td>

                      {/* Tombol Foto */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPhotoItem(item);
                            setPhotoType('CHECK_IN');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#FF6B00] hover:text-white text-slate-600 transition-colors cursor-pointer text-[10px] font-bold font-mono-code inline-flex items-center gap-1"
                          title="Buka bukti foto selfie & watermark"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Foto</span>
                        </button>
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
          7. MODAL 2: INSPEKSI FOTO & WATERMARK PRESENSI
         ===================================================================== */}
      {selectedPhotoItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-900">Bukti Foto & Watermark</h4>
                <p className="text-[10px] font-mono-code text-slate-500">{selectedPhotoItem.id}</p>
              </div>
              <button
                onClick={() => setSelectedPhotoItem(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Toggle Check-in / Check-out if both photos exist */}
            {(selectedPhotoItem.checkOutTime || selectedPhotoItem.photoOutUrl || (selectedPhotoItem as any).checkOutPhotoUrl) && (
              <div className="px-4 pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPhotoType('CHECK_IN')}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    photoType === 'CHECK_IN'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Foto Masuk ({selectedPhotoItem.checkInTime || '-'})
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoType('CHECK_OUT')}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    photoType === 'CHECK_OUT'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Foto Pulang ({selectedPhotoItem.checkOutTime || '-'})
                </button>
              </div>
            )}

            <div className="p-4">
              {(() => {
                const isMasuk = photoType === 'CHECK_IN';
                const activePhoto = isMasuk
                  ? (selectedPhotoItem.photoUrl || (selectedPhotoItem as any).checkInPhotoUrl)
                  : ((selectedPhotoItem as any).checkOutPhotoUrl || selectedPhotoItem.photoOutUrl || selectedPhotoItem.photoUrl);

                return (
                  <>
                    <img
                      src={activePhoto}
                      alt={isMasuk ? "Foto Absen Masuk" : "Foto Absen Pulang"}
                      className="w-full rounded-2xl border border-slate-200 object-cover shadow-sm max-h-[380px]"
                    />
                    <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <p><span className="font-bold text-slate-700">Waktu & Tipe:</span> <span className="font-mono-code font-bold text-slate-900">{isMasuk ? `Absen Masuk (${selectedPhotoItem.checkInTime} WIB)` : `Absen Pulang (${selectedPhotoItem.checkOutTime || '-'} WIB)`}</span></p>
                      <p><span className="font-bold text-slate-700">Karyawan:</span> {selectedPhotoItem.employeeName} • <span className="text-indigo-600 font-mono-code font-bold">{getLoginBadge(selectedPhotoItem)}</span> ({selectedPhotoItem.employeeNik})</p>
                      <p><span className="font-bold text-slate-700">Geofence:</span> <span className="font-mono-code font-semibold">{formatDistanceKm(selectedPhotoItem.location?.distanceMeters)}</span> • {selectedPhotoItem.location?.inGeofence ? 'Dalam Area Geofence Resmi' : 'Luar Radius'}</p>
                      <p><span className="font-bold text-slate-700">Lokasi:</span> {selectedPhotoItem.location?.address}</p>
                      <p><span className="font-bold text-slate-700">Skor Biometrik:</span> <span className={`font-mono-code font-bold ${
                        (selectedPhotoItem.biometricVerification?.matchScore || 0) >= 70 ? 'text-emerald-700' :
                        (selectedPhotoItem.biometricVerification?.matchScore || 0) >= 60 ? 'text-blue-700' : 'text-rose-600'
                      }`}>
                        {selectedPhotoItem.biometricVerification?.matchScore !== undefined ? `${selectedPhotoItem.biometricVerification.matchScore}% Match` : 'Belum Terdaftar'}
                      </span> {selectedPhotoItem.biometricVerification?.details ? `• ${selectedPhotoItem.biometricVerification.details}` : ''}</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
