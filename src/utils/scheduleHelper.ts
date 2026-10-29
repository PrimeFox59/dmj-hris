import { Employee, Project } from '../types';

export interface EffectiveSchedule {
  checkInTime: string;      // e.g. "07:00"
  checkOutTime: string;     // e.g. "16:30"
  cutoffTime: string;       // e.g. "07:15"
  cutoffDecimal: number;    // e.g. 7.25
  startDecimal: number;     // e.g. 7.0
  endDecimal: number;       // e.g. 16.5
  lateGraceMinutes: number; // e.g. 15
  isCustom: boolean;
  projectName?: string;
  projectCode?: string;
  projectId?: string;
}

// Convert "HH:mm" or "HH:mm:ss" to decimal hours (e.g. "07:30" -> 7.5, "06.19.14" -> 6.32)
export function parseTimeToDecimal(timeStr?: string): number | null {
  if (!timeStr) return null;
  const normalized = timeStr.trim().replace(/\./g, ':');
  const parts = normalized.split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parts[2] ? parseInt(parts[2], 10) : 0;
  if (isNaN(h) || isNaN(m)) return null;
  return h + m / 60 + s / 3600;
}

// Add minutes to a "HH:mm" string and return "HH:mm"
export function addMinutesToTimeString(timeStr: string, minutesToAdd: number): string {
  const normalized = (timeStr || '').trim().replace(/\./g, ':');
  const parts = normalized.split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  const totalMins = h * 60 + m + minutesToAdd;
  const newH = Math.floor(totalMins / 60) % 24;
  const newM = totalMins % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/**
 * Resolves the effective work schedule & attendance cutoff for an employee based on their assigned project.
 * If the project has customRules.workSchedule.enabled, it returns the project's schedule and cutoff.
 * Otherwise, it falls back to standard office hours (default cutoff: 08:30).
 */
export function getEmployeeProjectSchedule(
  employee: Employee | undefined | null,
  projects: Project[] = [],
  defaultCutoffTime: string = '08:30'
): EffectiveSchedule {
  const assignedId = (employee?.assignedProjectId || '').trim();

  // Flexible project lookup supporting PRIME-, DMJ-, code, and id
  let matchedProject: Project | undefined;
  if (assignedId && projects && projects.length > 0) {
    matchedProject = projects.find(p => {
      if (!p) return false;
      const pid = (p.id || '').trim();
      const pcode = (p.code || '').trim();
      if (pid === assignedId || pcode === assignedId) return true;
      if (pid.replace(/^DMJ-/i, 'PRIME-') === assignedId.replace(/^DMJ-/i, 'PRIME-')) return true;
      if (pcode.replace(/^DMJ-/i, 'PRIME-') === assignedId.replace(/^DMJ-/i, 'PRIME-')) return true;
      return false;
    });
  }

  // Check if project has custom work schedule enabled
  const customSched = matchedProject?.customRules?.workSchedule;
  if (customSched && customSched.enabled && customSched.checkInTime) {
    const checkIn = customSched.checkInTime; // e.g. "07:00"
    const checkOut = customSched.checkOutTime || '16:30';
    const grace = typeof customSched.lateGraceMinutes === 'number' ? customSched.lateGraceMinutes : 15;
    const cutoffTime = addMinutesToTimeString(checkIn, grace); // e.g. 07:00 + 15m = 07:15

    const cutoffDecimal = parseTimeToDecimal(cutoffTime) || 7.25;
    const startDecimal = parseTimeToDecimal(checkIn) || 7.0;
    const endDecimal = parseTimeToDecimal(checkOut) || 16.5;

    return {
      checkInTime: checkIn,
      checkOutTime: checkOut,
      cutoffTime,
      cutoffDecimal,
      startDecimal,
      endDecimal,
      lateGraceMinutes: grace,
      isCustom: true,
      projectName: matchedProject?.name || 'Proyek Site',
      projectCode: matchedProject?.code || matchedProject?.id || 'SITE',
      projectId: matchedProject?.id
    };
  }

  // Standard office fallback
  const fallbackCutoffDecimal = parseTimeToDecimal(defaultCutoffTime) || 8.5;
  return {
    checkInTime: '08:00',
    checkOutTime: '17:00',
    cutoffTime: defaultCutoffTime || '08:30',
    cutoffDecimal: fallbackCutoffDecimal,
    startDecimal: 8.0,
    endDecimal: 17.0,
    lateGraceMinutes: 30,
    isCustom: false,
    projectName: matchedProject?.name || 'Kantor Pusat / Umum',
    projectCode: matchedProject?.code || 'OFFICE',
    projectId: matchedProject?.id
  };
}
