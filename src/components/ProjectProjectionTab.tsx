import React, { useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  DollarSign,
  Clock,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import { Project } from '../types';
import { formatSalaryDisplay } from '../utils/payrollCalculator';

interface ProjectProjectionTabProps {
  projects: Project[];
}

export const ProjectProjectionTab: React.FC<ProjectProjectionTabProps> = ({ projects }) => {
  const [selectedProject, setSelectedProject] = useState<Project>(projects[0]);
  const [forecastExtraHours, setForecastExtraHours] = useState(150);
  const [showProjectionNominal, setShowProjectionNominal] = useState<boolean>(false);

  // Compute stats for selected project
  const remainingHours = Math.max(0, selectedProject.totalEstimatedHours - selectedProject.actualHoursSpent);
  const hourlyCostRate = selectedProject.actualHoursSpent > 0
    ? Math.round(selectedProject.actualLaborCost / selectedProject.actualHoursSpent)
    : 110000;

  const adjustedProjectedHours = remainingHours + forecastExtraHours;
  const projectedRemainingCost = adjustedProjectedHours * hourlyCostRate;
  const estimateAtCompletion = selectedProject.actualLaborCost + projectedRemainingCost;
  const hasBudget = (selectedProject.allocatedBudget || 0) > 0;
  const budgetVariance = hasBudget ? selectedProject.allocatedBudget - estimateAtCompletion : 0;
  const isOverBudget = hasBudget && budgetVariance < 0;

  const progressPercent = Math.min(
    100,
    Math.round((selectedProject.actualHoursSpent / (selectedProject.totalEstimatedHours || 1)) * 100)
  );

  const budgetConsumptionPercent = hasBudget
    ? Math.min(100, Math.round((selectedProject.actualLaborCost / selectedProject.allocatedBudget) * 100))
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Banner */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="prime-cut-corner bg-[#FF6B00] text-white text-[10px] font-black px-2.5 py-0.5 tracking-wider uppercase font-mono-code">
              LABOR FORECASTING & EAC ENGINE
            </span>
            <span className="text-xs font-semibold text-slate-500">Estimate at Completion Model</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Proyeksi Gaji & Anggaran Tenaga Kerja per Proyek
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Peramalan biaya upah teknisi hingga proyek selesai, analisis burn rate per jam, dan mitigasi pembengkakan budget (Cost Overrun).
          </p>
        </div>

        {/* Project Selector & Privacy Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProjectionNominal(prev => !prev)}
            className={`px-3 py-2 rounded-2xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              showProjectionNominal
                ? 'bg-orange-50 text-[#FF6B00] border-orange-200'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
            title="Toggle sensor nilai proyeksi anggaran tenaga kerja (default: sensor)"
          >
            {showProjectionNominal ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-[#FF6B00]" />}
            <span>{showProjectionNominal ? 'Sembunyikan Nilai' : 'Tampilkan Nilai'}</span>
          </button>

          <select
            value={selectedProject.id}
            onChange={e => {
              const found = projects.find(p => p.id === e.target.value);
              if (found) setSelectedProject(found);
            }}
            className="glass-input rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 font-mono-code"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.code} - {p.name.substring(0, 24)}...</option>
            ))}
          </select>
        </div>
      </div>

      {/* Primary Projection Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Allocated Budget */}
        <div className="glass-card rounded-3xl p-5 border-l-4 border-l-slate-800 space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Anggaran Upah Kontrak</p>
          <p className="text-xl font-black text-slate-900 font-mono-code">
            {hasBudget ? formatSalaryDisplay(selectedProject.allocatedBudget, showProjectionNominal) : 'Belum Ditentukan (TBD)'}
          </p>
          <span className="text-[10px] text-slate-500 font-mono-code">
            Target Jam: {selectedProject.totalEstimatedHours} Jam
          </span>
        </div>

        {/* Actual Labor Spent */}
        <div className="glass-card rounded-3xl p-5 border-l-4 border-l-[#FF6B00] space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Realisasi Upah Terpakai (To Date)</p>
          <p className="text-xl font-black text-[#FF6B00] font-mono-code">
            {formatSalaryDisplay(selectedProject.actualLaborCost, showProjectionNominal)}
          </p>
          <span className="text-[10px] text-orange-600 font-semibold font-mono-code">
            Terpakai: {hasBudget ? `${budgetConsumptionPercent}% Anggaran` : 'TBD'}
          </span>
        </div>

        {/* Projected EAC */}
        <div className="glass-card rounded-3xl p-5 border-l-4 border-l-emerald-500 space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Proyeksi Total Akhir (EAC)</p>
          <p className="text-xl font-black text-emerald-600 font-mono-code">
            {formatSalaryDisplay(estimateAtCompletion, showProjectionNominal)}
          </p>
          <span className="text-[10px] text-slate-500 font-mono-code">
            Burn Rate: {formatSalaryDisplay(hourlyCostRate, showProjectionNominal)} / Jam
          </span>
        </div>

        {/* Variance Status */}
        <div className={`glass-card rounded-3xl p-5 border-l-4 space-y-1 ${
          isOverBudget ? 'border-l-rose-500 bg-rose-50/20' : 'border-l-emerald-500 bg-emerald-50/20'
        }`}>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Variansi Anggaran (Sisa)</p>
          <p className={`text-xl font-black font-mono-code ${isOverBudget ? 'text-rose-600' : 'text-emerald-700'}`}>
            {isOverBudget ? `Over: ${formatSalaryDisplay(Math.abs(budgetVariance), showProjectionNominal)}` : `Surplus: ${formatSalaryDisplay(budgetVariance, showProjectionNominal)}`}
          </p>
          <div className="flex items-center gap-1 text-[10px] font-bold">
            {isOverBudget ? (
              <span className="text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Resiko Pembengkakan Budget
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Aman (Within Planned Budget)
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Main Analysis: Visual Progress & Adjustment Slider */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Progress Gauges & Timeline (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono-code font-bold text-[#FF6B00] uppercase">
                  {selectedProject.code} • {selectedProject.client}
                </span>
                <h2 className="text-base font-black text-slate-900">{selectedProject.name}</h2>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold font-mono-code">
                {selectedProject.status}
              </span>
            </div>

            {/* Progress Hours Bar */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-700">Kemajuan Jam Kerja Aktual vs Target Kontrak:</span>
                <span className="font-mono-code font-bold text-slate-900">
                  {selectedProject.actualHoursSpent} / {selectedProject.totalEstimatedHours} Jam ({progressPercent}%)
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-[#FF6B00] transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Budget Utilization Bar */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-700">Penyerapan Anggaran Gaji Aktual:</span>
                <span className="font-mono-code font-bold text-slate-900">
                  {formatSalaryDisplay(selectedProject.actualLaborCost, showProjectionNominal)} / {hasBudget ? formatSalaryDisplay(selectedProject.allocatedBudget, showProjectionNominal) : 'TBD'} ({hasBudget ? `${budgetConsumptionPercent}%` : 'TBD'})
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    budgetConsumptionPercent > 80
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                      : 'bg-gradient-to-r from-teal-400 to-emerald-500'
                  }`}
                  style={{ width: `${hasBudget ? budgetConsumptionPercent : 0}%` }}
                />
              </div>
            </div>

            {/* Project Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold">Lokasi Site</p>
                <p className="font-semibold text-slate-800">{selectedProject.location}</p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold">Jadwal Pelaksanaan</p>
                <p className="font-semibold text-slate-800 font-mono-code">
                  {selectedProject.startDate} s/d {selectedProject.targetEndDate}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold">Sisa Jam Rencana</p>
                <p className="font-semibold text-slate-800 font-mono-code">{remainingHours} Jam Kerja</p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold">Multiplier Lokasi</p>
                <p className="font-semibold text-orange-600 font-mono-code">{selectedProject.hourlyRateMultiplier}x Base Rate</p>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Interactive Forecasting Simulator (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono-code flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#FF6B00]" />
                <span>Simulasi Perubahan Scope & Jam Tambahan</span>
              </h2>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Sesuaikan estimasi jam kerja ekstra (misal overtime overhaul atau kendala cuaca) untuk melihat proyeksi dampak ke biaya gaji akhir:
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-700 font-semibold mb-1">
                  <span>Estimasi Jam Tambahan:</span>
                  <span className="font-mono-code font-bold text-[#FF6B00]">+{forecastExtraHours} Jam</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={500}
                  step={25}
                  value={forecastExtraHours}
                  onChange={e => setForecastExtraHours(Number(e.target.value))}
                  className="w-full accent-[#FF6B00]"
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2 shadow-lg">
                <p className="text-[10px] uppercase font-bold text-[#FF8533] font-mono-code">
                  HASIL PROYEKSI FORECAST
                </p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Sisa Jam Dibutuhkan:</span>
                    <span className="font-mono-code">{adjustedProjectedHours} Jam</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Proyeksi Biaya Upah Sisa:</span>
                    <span className="font-mono-code text-emerald-400">{formatSalaryDisplay(projectedRemainingCost, showProjectionNominal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Total Proyeksi Akhir (EAC):</span>
                    <span className="font-mono-code text-white font-bold">{formatSalaryDisplay(estimateAtCompletion, showProjectionNominal)}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700 flex justify-between items-center">
                  <span className="text-[11px] text-slate-400">Status Terhadap Budget:</span>
                  <span className={`font-mono-code font-bold text-xs ${isOverBudget ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {isOverBudget ? 'Melebihi Budget' : 'Aman Dalam Budget'}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
