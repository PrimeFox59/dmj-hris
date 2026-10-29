import React, { useState, useMemo, useEffect } from 'react';
import {
  Briefcase,
  PieChart,
  BarChart3,
  Building,
  Users,
  Calendar,
  DollarSign,
  Download,
  Filter,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Employee, Project, PayrollRecord, SalaryRuleConfig, AttendanceRecord } from '../types';
import { formatSalaryDisplay, calculateEmployeePayroll } from '../utils/payrollCalculator';

interface ProjectPayrollTabProps {
  employees: Employee[];
  projects: Project[];
  attendances: AttendanceRecord[];
  salaryRules: SalaryRuleConfig;
}

export const ProjectPayrollTab: React.FC<ProjectPayrollTabProps> = ({
  employees,
  projects,
  attendances,
  salaryRules
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [showPayrollNominal, setShowPayrollNominal] = useState<boolean>(false);

  // Compute all employee payrolls
  const payrollRecords: PayrollRecord[] = employees.map(emp =>
    calculateEmployeePayroll(emp, attendances, projects, salaryRules)
  );

  // Flatten allocations across all employees
  interface FlattenedAlloc {
    employeeId: string;
    employeeName: string;
    nik: string;
    position: string;
    projectId: string;
    projectCode: string;
    projectName: string;
    allocatedHours: number;
    allocatedCost: number;
    percentage: number;
  }

  const allAllocations: FlattenedAlloc[] = [];
  payrollRecords.forEach(p => {
    p.projectAllocations.forEach(alloc => {
      allAllocations.push({
        employeeId: p.employeeId,
        employeeName: p.employeeName,
        nik: p.nik,
        position: p.position,
        projectId: alloc.projectId,
        projectCode: alloc.projectCode,
        projectName: alloc.projectName,
        allocatedHours: alloc.allocatedHours,
        allocatedCost: alloc.allocatedCost,
        percentage: alloc.percentage
      });
    });
  });

  // Aggregate project totals
  const projectSummaries = projects.map(proj => {
    const allocs = allAllocations.filter(a => a.projectId === proj.id);
    const totalLaborCost = allocs.reduce((sum, a) => sum + a.allocatedCost, 0);
    const totalHours = allocs.reduce((sum, a) => sum + a.allocatedHours, 0);
    const headcount = allocs.length;

    return {
      project: proj,
      totalLaborCost,
      totalHours,
      headcount,
      allocs
    };
  });

  const grandTotalLaborCost = projectSummaries.reduce((sum, p) => sum + p.totalLaborCost, 0);

  const filteredAllocations = selectedProjectId === 'ALL'
    ? allAllocations
    : allAllocations.filter(a => a.projectId === selectedProjectId);

  const [allocDisplayLimit, setAllocDisplayLimit] = useState(15);
  const visibleAllocations = useMemo(() => {
    return filteredAllocations.slice(0, allocDisplayLimit);
  }, [filteredAllocations, allocDisplayLimit]);
  const hasMoreAllocations = allocDisplayLimit < filteredAllocations.length;

  useEffect(() => {
    setAllocDisplayLimit(15);
  }, [selectedProjectId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Banner */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="prime-cut-corner bg-[#FF6B00] text-white text-[10px] font-black px-2.5 py-0.5 tracking-wider uppercase font-mono-code">
              PROJECT LABOR ALLOCATION
            </span>
            <span className="text-xs font-semibold text-slate-500">Cross-Project Cost Accounting</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Penggajian Berbasis Proyek (Project-Based Payroll)
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Distribusi jam kerja & atribusi pembebanan gaji staf teknisi langsung ke masing-masing kode kontrak proyek industri.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPayrollNominal(prev => !prev)}
            className={`px-3 py-2 rounded-2xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              showPayrollNominal
                ? 'bg-orange-50 text-[#FF6B00] border-orange-200'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
            title="Toggle sensor nilai alokasi biaya gaji proyek (default: sensor)"
          >
            {showPayrollNominal ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-[#FF6B00]" />}
            <span>{showPayrollNominal ? 'Sembunyikan Nilai' : 'Tampilkan Nilai'}</span>
          </button>

          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="glass-input rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 font-mono-code"
          >
            <option value="ALL">Semua Proyek Kontrak</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.code} - {p.name.substring(0, 20)}...</option>
            ))}
          </select>
        </div>
      </div>

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {projectSummaries.map(({ project, totalLaborCost, totalHours, headcount }) => {
          const percentageOfGrand = grandTotalLaborCost > 0
            ? Math.round((totalLaborCost / grandTotalLaborCost) * 100)
            : 0;

          return (
            <div
              key={project.id}
              onClick={() => setSelectedProjectId(selectedProjectId === project.id ? 'ALL' : project.id)}
              className={`glass-card rounded-3xl p-5 border transition-all cursor-pointer space-y-3 ${
                selectedProjectId === project.id
                  ? 'border-[#FF6B00] shadow-lg ring-2 ring-orange-400/20'
                  : 'hover:shadow-md border-white/90'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono-code font-black text-[#FF6B00] bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200/60">
                  {project.code}
                </span>
                <span className="text-[11px] font-mono-code font-bold text-slate-500">
                  {percentageOfGrand}% Share
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-xs line-clamp-1">{project.name}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">{project.client}</p>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Alokasi Biaya Gaji:</span>
                  <span className="font-bold font-mono-code text-slate-900">{formatSalaryDisplay(totalLaborCost, showPayrollNominal)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Total Jam Kerja:</span>
                  <span className="font-mono-code text-slate-700">{totalHours} Jam</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Personel Bertugas:</span>
                  <span className="font-bold text-slate-700">{headcount} Engineer</span>
                </div>
              </div>

              {/* Progress Bar of Share */}
              <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#FF6B00] to-orange-400"
                  style={{ width: `${percentageOfGrand}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Allocation Detail Table */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 overflow-hidden space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#FF6B00]" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono-code">
              Matriks Beban Gaji Karyawan per Proyek
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total Alokasi: {filteredAllocations.length} Entri
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 text-slate-500 uppercase tracking-wider text-[10px] font-mono-code">
                <th className="py-2.5 px-3">Karyawan</th>
                <th className="py-2.5 px-3">Kode & Nama Proyek</th>
                <th className="py-2.5 px-3">Porsi Alokasi (%)</th>
                <th className="py-2.5 px-3">Alokasi Jam Kerja</th>
                <th className="py-2.5 px-3 font-mono-code text-right">Biaya Gaji Dibebankan (IDR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleAllocations.map((alloc, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900">{alloc.employeeName}</div>
                    <div className="text-[10px] text-slate-500 font-mono-code">{alloc.nik} • {alloc.position}</div>
                  </td>

                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-800 font-mono-code text-[11px] block">
                      {alloc.projectCode}
                    </span>
                    <span className="text-[10px] text-slate-500">{alloc.projectName}</span>
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-mono-code text-slate-800">{alloc.percentage}%</span>
                      <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${alloc.percentage}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-3 font-mono-code text-slate-800">
                    {alloc.allocatedHours} Jam
                  </td>

                  <td className="py-3 px-3 text-right font-mono-code font-black text-slate-900 text-sm">
                    {formatSalaryDisplay(alloc.allocatedCost, showPayrollNominal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAllocations.length > 15 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/80 border-t border-slate-200/70 text-xs">
            <span className="text-slate-500 font-mono-code text-[11px]">
              Menampilkan <span className="font-bold text-slate-800">{Math.min(allocDisplayLimit, filteredAllocations.length)}</span> dari <span className="font-bold text-slate-800">{filteredAllocations.length}</span> alokasi proyek
            </span>
            <div className="flex items-center gap-2">
              {hasMoreAllocations ? (
                <button
                  type="button"
                  onClick={() => setAllocDisplayLimit(prev => Math.min(prev + 15, filteredAllocations.length))}
                  className="px-3.5 py-1.5 rounded-xl bg-orange-50 hover:bg-[#FF6B00] text-[#FF6B00] hover:text-white border border-orange-200 hover:border-[#FF6B00] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Muat 15 Alokasi Lagi ({filteredAllocations.length - allocDisplayLimit} Tersisa)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAllocDisplayLimit(15)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ciutkan (Tampilkan 15)</span>
                </button>
              )}
              {hasMoreAllocations && (
                <button
                  type="button"
                  onClick={() => setAllocDisplayLimit(filteredAllocations.length)}
                  className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 font-semibold text-xs transition-all cursor-pointer"
                >
                  Tampilkan Semua
                </button>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
