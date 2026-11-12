/**
 * Helper Standar Pajak PPh 21 & PTKP (Penghasilan Tidak Kena Pajak)
 * Berdasarkan UU HPP No. 7 Tahun 2021, PP 58 Tahun 2023, & PMK 168/2023.
 */

export type MaritalStatusCode = 'TK' | 'K' | 'K/I';
export type PtkpStatusCode =
  | 'TK/0' | 'TK/1' | 'TK/2' | 'TK/3'
  | 'K/0' | 'K/1' | 'K/2' | 'K/3'
  | 'K/I/0' | 'K/I/1' | 'K/I/2' | 'K/I/3';

export type TerCategory = 'TER A' | 'TER B' | 'TER C';

export interface PtkpItem {
  code: PtkpStatusCode;
  maritalStatus: MaritalStatusCode;
  dependents: number;
  maritalStatusLabel: string;
  dependentsLabel: string;
  label: string;
  annualAmount: number; // in IDR
  monthlyAmount: number; // in IDR
  terCategory: TerCategory;
  description: string;
}

export const PTKP_RATES: Record<PtkpStatusCode, PtkpItem> = {
  'TK/0': {
    code: 'TK/0',
    maritalStatus: 'TK',
    dependents: 0,
    maritalStatusLabel: 'Tidak Kawin (TK)',
    dependentsLabel: '0 Tanggungan',
    label: 'TK/0 (Tidak Kawin, 0 Tanggungan)',
    annualAmount: 54_000_000,
    monthlyAmount: 4_500_000,
    terCategory: 'TER A',
    description: 'Wajib Pajak Sendiri (Tidak Kawin & tanpa tanggungan)'
  },
  'TK/1': {
    code: 'TK/1',
    maritalStatus: 'TK',
    dependents: 1,
    maritalStatusLabel: 'Tidak Kawin (TK)',
    dependentsLabel: '1 Tanggungan',
    label: 'TK/1 (Tidak Kawin, 1 Tanggungan)',
    annualAmount: 58_500_000,
    monthlyAmount: 4_875_000,
    terCategory: 'TER A',
    description: 'Wajib Pajak Sendiri + 1 Orang Tanggungan'
  },
  'TK/2': {
    code: 'TK/2',
    maritalStatus: 'TK',
    dependents: 2,
    maritalStatusLabel: 'Tidak Kawin (TK)',
    dependentsLabel: '2 Tanggungan',
    label: 'TK/2 (Tidak Kawin, 2 Tanggungan)',
    annualAmount: 63_000_000,
    monthlyAmount: 5_250_000,
    terCategory: 'TER B',
    description: 'Wajib Pajak Sendiri + 2 Orang Tanggungan'
  },
  'TK/3': {
    code: 'TK/3',
    maritalStatus: 'TK',
    dependents: 3,
    maritalStatusLabel: 'Tidak Kawin (TK)',
    dependentsLabel: '3 Tanggungan',
    label: 'TK/3 (Tidak Kawin, 3 Tanggungan)',
    annualAmount: 67_500_000,
    monthlyAmount: 5_625_000,
    terCategory: 'TER B',
    description: 'Wajib Pajak Sendiri + 3 Orang Tanggungan (Maksimal)'
  },
  'K/0': {
    code: 'K/0',
    maritalStatus: 'K',
    dependents: 0,
    maritalStatusLabel: 'Kawin (K)',
    dependentsLabel: '0 Tanggungan',
    label: 'K/0 (Kawin, 0 Tanggungan)',
    annualAmount: 58_500_000,
    monthlyAmount: 4_875_000,
    terCategory: 'TER A',
    description: 'Wajib Pajak Kawin (Status Menikah tanpa tanggungan)'
  },
  'K/1': {
    code: 'K/1',
    maritalStatus: 'K',
    dependents: 1,
    maritalStatusLabel: 'Kawin (K)',
    dependentsLabel: '1 Tanggungan',
    label: 'K/1 (Kawin, 1 Tanggungan)',
    annualAmount: 63_000_000,
    monthlyAmount: 5_250_000,
    terCategory: 'TER B',
    description: 'Wajib Pajak Kawin + 1 Orang Tanggungan'
  },
  'K/2': {
    code: 'K/2',
    maritalStatus: 'K',
    dependents: 2,
    maritalStatusLabel: 'Kawin (K)',
    dependentsLabel: '2 Tanggungan',
    label: 'K/2 (Kawin, 2 Tanggungan)',
    annualAmount: 67_500_000,
    monthlyAmount: 5_625_000,
    terCategory: 'TER B',
    description: 'Wajib Pajak Kawin + 2 Orang Tanggungan'
  },
  'K/3': {
    code: 'K/3',
    maritalStatus: 'K',
    dependents: 3,
    maritalStatusLabel: 'Kawin (K)',
    dependentsLabel: '3 Tanggungan',
    label: 'K/3 (Kawin, 3 Tanggungan)',
    annualAmount: 72_000_000,
    monthlyAmount: 6_000_000,
    terCategory: 'TER C',
    description: 'Wajib Pajak Kawin + 3 Orang Tanggungan (Maksimal)'
  },
  'K/I/0': {
    code: 'K/I/0',
    maritalStatus: 'K/I',
    dependents: 0,
    maritalStatusLabel: 'Kawin Istri Gabung (K/I)',
    dependentsLabel: '0 Tanggungan',
    label: 'K/I/0 (Kawin Istri Gabung, 0 Tanggungan)',
    annualAmount: 112_500_000,
    monthlyAmount: 9_375_000,
    terCategory: 'TER B',
    description: 'Kawin dengan Penghasilan Istri Digabung, tanpa tanggungan'
  },
  'K/I/1': {
    code: 'K/I/1',
    maritalStatus: 'K/I',
    dependents: 1,
    maritalStatusLabel: 'Kawin Istri Gabung (K/I)',
    dependentsLabel: '1 Tanggungan',
    label: 'K/I/1 (Kawin Istri Gabung, 1 Tanggungan)',
    annualAmount: 117_000_000,
    monthlyAmount: 9_750_000,
    terCategory: 'TER C',
    description: 'Kawin dengan Penghasilan Istri Digabung + 1 Tanggungan'
  },
  'K/I/2': {
    code: 'K/I/2',
    maritalStatus: 'K/I',
    dependents: 2,
    maritalStatusLabel: 'Kawin Istri Gabung (K/I)',
    dependentsLabel: '2 Tanggungan',
    label: 'K/I/2 (Kawin Istri Gabung, 2 Tanggungan)',
    annualAmount: 121_500_000,
    monthlyAmount: 10_125_000,
    terCategory: 'TER C',
    description: 'Kawin dengan Penghasilan Istri Digabung + 2 Tanggungan'
  },
  'K/I/3': {
    code: 'K/I/3',
    maritalStatus: 'K/I',
    dependents: 3,
    maritalStatusLabel: 'Kawin Istri Gabung (K/I)',
    dependentsLabel: '3 Tanggungan',
    label: 'K/I/3 (Kawin Istri Gabung, 3 Tanggungan)',
    annualAmount: 126_000_000,
    monthlyAmount: 10_500_000,
    terCategory: 'TER C',
    description: 'Kawin dengan Penghasilan Istri Digabung + 3 Tanggungan'
  }
};

export const PTKP_OPTIONS = Object.values(PTKP_RATES);

/**
 * Normalizes raw marital status into canonical 'TK' | 'K' | 'K/I'
 */
export function normalizeMaritalStatus(raw?: string): MaritalStatusCode {
  if (!raw) return 'TK';
  const clean = String(raw).trim().toUpperCase();
  if (clean === 'K/I' || clean.includes('ISTRI') || clean.includes('GABUNG')) return 'K/I';
  if (clean === 'K' || clean === 'KAWIN' || clean === 'MENIKAH' || clean === 'MARRIED') return 'K';
  return 'TK';
}

/**
 * Returns canonical PTKP code from marital status and number of dependents.
 */
export function resolvePtkpStatus(maritalStatus?: string, dependents?: number): PtkpStatusCode {
  // If maritalStatus is already a full PTKP code (e.g. 'K/1', 'TK/0')
  if (maritalStatus && maritalStatus.trim().toUpperCase() in PTKP_RATES) {
    return maritalStatus.trim().toUpperCase() as PtkpStatusCode;
  }

  const normStatus = normalizeMaritalStatus(maritalStatus);
  const dep = Math.min(3, Math.max(0, Number(dependents ?? 0)));
  const code = `${normStatus}/${dep}` as PtkpStatusCode;
  return PTKP_RATES[code] ? code : 'TK/0';
}

/**
 * Resolves full PTKP item details with fallback to TK/0.
 */
export function getPtkpDetails(statusOrCode?: string, fallbackDependents: number = 0): PtkpItem {
  if (!statusOrCode) return PTKP_RATES['TK/0'];
  const clean = String(statusOrCode).trim().toUpperCase();
  if (clean in PTKP_RATES) {
    return PTKP_RATES[clean as PtkpStatusCode];
  }
  const resolved = resolvePtkpStatus(clean, fallbackDependents);
  return PTKP_RATES[resolved] || PTKP_RATES['TK/0'];
}

/**
 * Formats PTKP as concise status badge for tables and payslips.
 */
export function formatPtkpBadge(ptkpCode?: string): string {
  const item = getPtkpDetails(ptkpCode);
  return `${item.code} (${item.terCategory} • Rp ${(item.annualAmount / 1_000_000).toLocaleString('id-ID')} Jt/thn)`;
}
