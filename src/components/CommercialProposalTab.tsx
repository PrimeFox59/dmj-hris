import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  FileText,
  Printer,
  CheckCircle2,
  Calendar,
  Sparkles,
  Award,
  DollarSign,
  HardDrive,
  MapPin,
  Briefcase,
  Camera,
  Clock,
  ShieldCheck,
  Check,
  ExternalLink,
  Monitor,
  Smartphone,
  Code,
  Server,
  Cloud,
  Globe,
  TrendingUp,
  Users,
  Zap,
  XCircle,
  ArrowRight,
  HelpCircle,
  Lock,
  ChevronRight,
  Copy,
  CopyCheck,
  MessageCircle,
  Share2,
  SlidersHorizontal,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { formatIDR } from '../utils/payrollCalculator';

export const CommercialProposalTab: React.FC = () => {
  // Simulator Interaktif Pilihan Paket & Deployment
  const [includeGeofenceSequence, setIncludeGeofenceSequence] = useState<boolean>(true);
  const [includeMobileVersion, setIncludeMobileVersion] = useState<boolean>(true);
  const [includeSourceCode, setIncludeSourceCode] = useState<boolean>(true);
  const [includeCustomDomain, setIncludeCustomDomain] = useState<boolean>(true);
  const [includeTraining, setIncludeTraining] = useState<boolean>(true);

  // Status Interaktif UI
  const [copied, setCopied] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string>('sec-ringkasan');

  // Nilai Investasi Resmi (One-Time)
  const basicPrice = 2500000; // Paket Dasar (Rp 2.5 Jt)
  const geofencePrice = 1000000;  // Add-on Multi-Site GPS Geofence (+Rp 1 Jt)
  const mobileVersionPrice = 1000000; // Add-on Mobile Version Smartphone (+Rp 1 Jt)
  const sourceCodePrice = 200000; // Opsi Source Code Offline (+Rp 200.000)
  const trainingPrice = 1000000; // Add-on Pelatihan Full Team (+Rp 1 Jt)

  // Biaya Layanan Running Apps Cloud per Bulan
  const baseMonthlyRunning = 35000; // Biaya server cloud berjalan (Rp 35.000/bln)

  // Estimasi Biaya Custom Domain Sendiri (Tahunan / Annual)
  const customDomainAnnualPrice = 250000; // Estimasi domain .com (Rp 250.000/tahun)

  // Cek apakah memilih seluruh paket modul (Full Suite All-in)
  const isFullSuite =
    includeGeofenceSequence &&
    includeMobileVersion &&
    includeSourceCode &&
    includeCustomDomain &&
    includeTraining;

  // Hitung Total Pengadaan One-Time (Bundling Full Suite Paling Hemat Rp 5.500.000)
  const totalInvestment = isFullSuite
    ? 5500000
    : basicPrice +
      (includeGeofenceSequence ? geofencePrice : 0) +
      (includeMobileVersion ? mobileVersionPrice : 0) +
      (includeSourceCode ? sourceCodePrice : 0) +
      (includeTraining ? trainingPrice : 0);

  // Hitung Total Biaya Bulanan Running Apps
  const totalMonthlyRunning = baseMonthlyRunning;

  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Proposal URL - when scanned, redirects straight to ?tab=proposal
  const proposalUrl = typeof window !== 'undefined' && window.location.origin
    ? `${window.location.origin}/?tab=proposal`
    : 'https://hris.primeprojectx.net/?tab=proposal';

  useEffect(() => {
    // Generate high-resolution scannable QR Code
    QRCode.toDataURL(proposalUrl, {
      width: 260,
      margin: 1,
      color: {
        dark: '#0f172a', // slate-900
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('Error generating proposal QR code:', err));
  }, [proposalUrl]);

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = 'PRIME_HRIS_Enterprise_Proposal_2026';
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(proposalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      'Halo Pak Galih, saya dari Manajemen PT Dwi Martha Jaya ingin berkonsultasi lebih lanjut mengenai proposal sistem HRIS & Presensi Digital resmi.'
    );
    window.open(`https://wa.me/6289524257778?text=${text}`, '_blank');
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const applyPreset = (preset: 'komplit' | 'geofence' | 'mobile' | 'dasar' | 'offline') => {
    switch (preset) {
      case 'komplit':
        setIncludeGeofenceSequence(true);
        setIncludeMobileVersion(true);
        setIncludeSourceCode(true);
        setIncludeCustomDomain(true);
        setIncludeTraining(true);
        break;
      case 'geofence':
        setIncludeGeofenceSequence(true);
        setIncludeMobileVersion(false);
        setIncludeSourceCode(false);
        setIncludeCustomDomain(false);
        setIncludeTraining(false);
        break;
      case 'mobile':
        setIncludeGeofenceSequence(false);
        setIncludeMobileVersion(true);
        setIncludeSourceCode(false);
        setIncludeCustomDomain(false);
        setIncludeTraining(false);
        break;
      case 'dasar':
        setIncludeGeofenceSequence(false);
        setIncludeMobileVersion(false);
        setIncludeSourceCode(false);
        setIncludeCustomDomain(false);
        setIncludeTraining(false);
        break;
      case 'offline':
        setIncludeGeofenceSequence(false);
        setIncludeMobileVersion(false);
        setIncludeSourceCode(true);
        setIncludeCustomDomain(false);
        setIncludeTraining(false);
        break;
    }
  };

  const navSections = [
    { id: 'sec-ringkasan', label: 'Ringkasan' },
    { id: 'sec-analisis', label: '1. Masalah & Solusi' },
    { id: 'sec-alur', label: '2. Alur Kerja' },
    { id: 'sec-perangkat', label: '3. Device Guide' },
    { id: 'sec-deployment', label: '4. Deployment' },
    { id: 'sec-paket', label: '5. Paket Investasi' },
    { id: 'sec-timeline', label: '6. Jadwal 5 Minggu' },
    { id: 'sec-sla', label: '7. Garansi & SLA' },
    { id: 'sec-pengesahan', label: '8. Pengesahan & QR' },
  ];

  return (
    <div className="space-y-4 max-w-5xl mx-auto motion-fade-in-up pb-10 print:max-w-none print:w-full print:p-0 print:m-0 print:space-y-0">
      
      {/* ========================================================================= */}
      {/* 1. Executive Action Command Header (Tampil di Web, Sembunyi saat Cetak)   */}
      {/* ========================================================================= */}
      <div id="tour-proposal-container" className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm no-print print:hidden space-y-3.5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF6B00] to-[#E05D00] text-white flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  DOKUMEN PENAWARAN RESMI AKTIF
                </span>
                <span className="text-[10.5px] font-mono-code text-slate-500">
                  No: PIS/PROP/DMJ-HRIS/2026/09
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                Proposal Sistem HRIS, Payroll Depnaker & Presensi Digital Terpadu
              </h1>
              <p className="text-xs text-slate-500">
                Disiapkan khusus untuk Direksi & Manajemen <strong>PT Dwi Martha Jaya</strong> oleh PT Prime Infinity Systems.
              </p>
            </div>
          </div>

          {/* Tombol Interaktif Header */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full lg:w-auto justify-start sm:justify-end shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              title="Salin tautan online proposal ini"
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
            >
              {copied ? (
                <>
                  <CopyCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Link Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-600" />
                  <span>Salin Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              id="tour-proposal-wa"
              onClick={handleWhatsApp}
              title="Hubungi konsultan via WhatsApp"
              className="px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>Konsultasi WA</span>
            </button>

            <button
              type="button"
              id="tour-proposal-pdf"
              onClick={handlePrint}
              title="Cetak atau simpan sebagai dokumen PDF 2 halaman"
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#FF8533] hover:from-[#e56000] text-white text-xs font-bold shadow-md shadow-orange-500/25 flex items-center gap-2 transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Unduh PDF</span>
            </button>
          </div>
        </div>

        {/* Section Quick Jump Navigator Bar */}
        <div className="pt-2 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-medium scrollbar-none">
          <span className="text-[10px] font-mono-code font-bold uppercase text-slate-600 shrink-0 mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3 text-[#FF6B00]" />
            Lompat Bab:
          </span>
          {navSections.map(sec => (
            <button
              key={sec.id}
              type="button"
              onClick={() => scrollToSection(sec.id)}
              className="px-2.5 py-1 rounded-lg whitespace-nowrap bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-[#FF6B00] border border-slate-200 hover:border-orange-200 transition-all cursor-pointer text-[10.5px] font-medium"
            >
              {sec.label}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Toast Notification saat link tersalin */}
      {copied && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs font-bold motion-fade-in-up no-print">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <span>Tautan proposal resmi berhasil disalin ke clipboard!</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Lembar Dokumen Proposal Resmi (Siap Cetak 2 Halaman Seimbang)             */}
      {/* ========================================================================= */}
      <div className="proposal-print-sheet bg-white rounded-3xl p-6 sm:p-12 border border-slate-200/90 shadow-xl space-y-6 print:space-y-3.5 print:p-0 print:border-none print:shadow-none print:rounded-none relative overflow-hidden">
        
        {/* Accent Banner Top Strip (Web Only) */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#FF6B00] via-blue-600 to-emerald-500 rounded-t-3xl -mt-6 -mx-6 sm:-mt-12 sm:-mx-12 mb-4 print:hidden" />

        {/* Kop Surat Dokumen Resmi */}
        <div className="border-b-2 border-slate-900 pb-4 print:pb-3 flex flex-col sm:flex-row print:flex-row items-start sm:items-center print:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 text-white flex items-center justify-center font-mono-code font-black text-xs">
                P<span className="text-[#FF6B00]">X</span>
              </div>
              <span className="text-base font-black tracking-wider text-slate-900 font-mono-code">
                PRIME<span className="text-[#FF6B00]">PROJECTX</span>
              </span>
            </div>
            <p className="text-xs font-bold text-slate-800">PT PRIME INFINITY SYSTEMS</p>
            <p className="text-[11px] text-slate-500">Ecosystem: primeprojectx.net • Email: galih@primeprojectx.net</p>
            <p className="text-[11px] text-slate-500">WhatsApp: +62 895 2425 7778 • Surabaya & Jakarta</p>
          </div>

          <div className="text-left sm:text-right print:text-right">
            <div className="prime-cut-corner bg-slate-900 text-white px-3 py-1 text-[10px] font-mono-code uppercase font-bold inline-block">
              PROPOSAL PENAWARAN RESMI
            </div>
            <p className="text-xs text-slate-500 mt-1.5 font-mono-code">Nomor: PIS/PROP/DMJ-HRIS/2026/09</p>
            <p className="text-xs text-slate-500 font-mono-code">Tanggal: 8 September 2026</p>
            <p className="text-xs font-bold text-slate-900 mt-1">Kepada: Direksi & Manajemen PT Dwi Martha Jaya</p>
          </div>
        </div>

        {/* Ringkasan Eksekutif (Executive Summary Callout) */}
        <div id="sec-ringkasan" className="p-4 print:p-3 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-md space-y-2.5 print:space-y-1.5 print-break-inside-avoid print:bg-slate-900 scroll-mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-2 text-[#FF6B00]">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="text-xs print:text-[12px] font-black uppercase tracking-wider font-mono-code text-white">
                Ringkasan Eksekutif (Executive Summary)
              </span>
            </div>
            <span className="text-[10px] font-mono-code font-bold text-emerald-400 bg-emerald-950 border border-emerald-500/40 px-2 py-0.5 rounded">
              SIAP DIGUNAKAN (READY TO DEPLOY)
            </span>
          </div>

          <p className="text-[11.5px] print:text-[11px] text-slate-100 leading-relaxed font-medium">
            Sistem <strong className="text-white font-bold">Prime HRIS PT Dwi Martha Jaya</strong> dibangun untuk mentransformasi tata kelola absensi, otomatisasi payroll Depnaker, dan kontrol biaya proyek lapangan menjadi <strong className="text-white font-bold">100% otomatis, akurat, dan transparan</strong>. Solusi ini menghilangkan kebocoran jam lembur, memangkas 90% waktu rekap bulanan, dan mencegah praktik titip absen melalui verifikasi biometrik selfie kamera & GPS satelit HP.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-2 pt-0.5 text-center">
            <div className="p-2.5 print:p-1.5 rounded-xl bg-slate-800 border border-slate-700">
              <span className="text-[10px] text-slate-300 block font-mono-code font-bold flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-[#FF6B00]" />
                EFISIENSI WAKTU
              </span>
              <span className="text-sm print:text-[13px] font-black text-[#FF6B00]">Hemat 90% Jam Kerja</span>
              <span className="text-[9.5px] print:text-[9px] text-slate-300 block">Dari 3 hari jadi hitungan detik</span>
            </div>
            <div className="p-2.5 print:p-1.5 rounded-xl bg-slate-800 border border-slate-700">
              <span className="text-[10px] text-slate-300 block font-mono-code font-bold flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                AKURASI PRESENSI
              </span>
              <span className="text-sm print:text-[13px] font-black text-emerald-400">100% Bebas Titip Absen</span>
              <span className="text-[9.5px] print:text-[9px] text-slate-300 block">Selfie Kamera + GPS HP Asli</span>
            </div>
            <div className="p-2.5 print:p-1.5 rounded-xl bg-slate-800 border border-slate-700">
              <span className="text-[10px] text-slate-300 block font-mono-code font-bold flex items-center justify-center gap-1">
                <DollarSign className="w-3 h-3 text-blue-400" />
                INVESTASI EKONOMIS
              </span>
              <span className="text-sm print:text-[13px] font-black text-blue-400">Mulai Rp 2.5 Juta</span>
              <span className="text-[9.5px] print:text-[9px] text-slate-300 block">1x Bayar • Server Rp 35rb/bln</span>
            </div>
          </div>
        </div>

        {/* 1. Analisis Kebutuhan: Perbandingan "Sebelum vs Sesudah" */}
        <div id="sec-analisis" className="space-y-2.5 print:space-y-1.5 print-break-inside-avoid scroll-mt-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
            <TrendingUp className="w-4 h-4 text-[#FF6B00]" />
            <h2 className="text-xs sm:text-sm print:text-[13px] font-black text-slate-900 uppercase tracking-wider font-mono-code">
              1. Analisis Kebutuhan: Kondisi Manual Saat Ini vs Solusi Prime HRIS
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3 print:gap-2 text-xs">
            {/* Sisi Kiri: Cara Lama */}
            <div className="p-3.5 print:p-2.5 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-1.5 print:space-y-1">
              <div className="flex items-center justify-between border-b border-rose-200 pb-1 text-[11.5px] print:text-[11px]">
                <div className="flex items-center gap-1.5 text-rose-800 font-bold">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Kendala Operasional Cara Lama (Manual / Fingerprint)</span>
                </div>
                <span className="text-[9px] font-mono-code font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded no-print print:hidden">
                  RISIKO TINGGI
                </span>
              </div>
              <ul className="space-y-1 text-[11px] print:text-[10.5px] text-rose-900/90 leading-tight">
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-600 font-bold shrink-0">•</span>
                  <span><strong>Antrean Mesin & Rawan Titip Absen:</strong> Karyawan mengantre saat shift pagi; lokasi staf proyek lapangan tidak dapat dipastikan kebenarannya.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-600 font-bold shrink-0">•</span>
                  <span><strong>Rekap Gaji Berhari-hari:</strong> HR & Finance harus menarik data manual, mencocokkan lembur di Excel, rawan selisih jam dan komplain staf.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-600 font-bold shrink-0">•</span>
                  <span><strong>Form Kertas Rawan Hilang:</strong> Surat sakit, permohonan lembur, nota dinas, dan form cuti rawan tercecer sehingga bukti audit tidak rapi.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-600 font-bold shrink-0">•</span>
                  <span><strong>Biaya Proyek Kabur:</strong> Upah kerja dan lembur tidak teralokasi per pekerjaan klien, sehingga laba-rugi tiap proyek sulit dievaluasi.</span>
                </li>
              </ul>
            </div>

            {/* Sisi Kanan: Solusi Prime HRIS */}
            <div className="p-3.5 print:p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1.5 print:space-y-1">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-1 text-[11.5px] print:text-[11px]">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Efisiensi Nyata Bersama Sistem Prime HRIS PT DMJ</span>
                </div>
                <span className="text-[9px] font-mono-code font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded no-print print:hidden">
                  EFISIENSI 100%
                </span>
              </div>
              <ul className="space-y-1 text-[11px] print:text-[10.5px] text-emerald-900/90 leading-tight">
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold shrink-0">•</span>
                  <span><strong>Absen Mandiri di HP (3 Detik):</strong> Karyawan selfie wajah langsung & koordinat GPS satelit otomatis terkunci di radius kantor/proyek.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold shrink-0">•</span>
                  <span><strong>Payroll Depnaker 1 Klik:</strong> Rumus lembur 1.5x & 2x Depnaker, potongan BPJS, dan slip gaji ber-QR Code terbit otomatis seketika.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold shrink-0">•</span>
                  <span><strong>Approval 1 Jendela Tanpa Kertas:</strong> Cuti, izin, dinas luar, dan klaim diajukan dari HP; atasan tinggal klik Setujui/Tolak dalam 1 detik.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold shrink-0">•</span>
                  <span><strong>Kontrol Alokasi Biaya Proyek:</strong> Jam kerja staf terhubung langsung ke kode proyek DMJ untuk memantau serapan anggaran klien.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 2. Alur Operasional Sistem dalam 3 Langkah Praktis */}
        <div id="sec-alur" className="space-y-2.5 print:space-y-1.5 print-break-inside-avoid scroll-mt-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
            <Zap className="w-4 h-4 text-[#FF6B00]" />
            <h2 className="text-xs sm:text-sm print:text-[13px] font-black text-slate-900 uppercase tracking-wider font-mono-code">
              2. Alur Kerja Operasional: 3 Langkah Mudah & Cepat
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-2.5 print:gap-2 text-xs">
            <div className="p-3 print:p-2 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 print:space-y-0.5 relative group hover:border-[#FF6B00] transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono-code font-black text-[#FF6B00] text-xs print:text-[11.5px] bg-orange-100 px-2 py-0.5 rounded">LANGKAH 1</span>
                <Camera className="w-4 h-4 text-[#FF6B00]" />
              </div>
              <h3 className="font-bold text-slate-900 text-[11.5px] print:text-[11px] pt-1">Karyawan Absen Selfie di HP</h3>
              <p className="text-[10.5px] print:text-[10px] text-slate-600 leading-snug">
                Buka link web lewat HP, nyalakan kamera selfie, dan sensor GPS mendeteksi radius kantor. Wajah terverifikasi anti-manipulasi dalam 3 detik.
              </p>
            </div>

            <div className="p-3 print:p-2 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 print:space-y-0.5 relative group hover:border-emerald-500 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono-code font-black text-emerald-700 text-xs print:text-[11.5px] bg-emerald-100 px-2 py-0.5 rounded">LANGKAH 2</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-[11.5px] print:text-[11px] pt-1">Atasan Review & Approval</h3>
              <p className="text-[10.5px] print:text-[10px] text-slate-600 leading-snug">
                Notifikasi masuk real-time jika ada pengajuan cuti, izin, lembur, atau dinas luar mendadak. Pimpinan cukup 1 klik untuk menyetujui.
              </p>
            </div>

            <div className="p-3 print:p-2 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 print:space-y-0.5 relative group hover:border-blue-500 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono-code font-black text-blue-700 text-xs print:text-[11.5px] bg-blue-100 px-2 py-0.5 rounded">LANGKAH 3</span>
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-[11.5px] print:text-[11px] pt-1">HR & Finance Cetak Slip Gaji</h3>
              <p className="text-[10.5px] print:text-[10px] text-slate-600 leading-snug">
                Akhir bulan, seluruh rekap jam kerja, lembur, dan potongan BPJS terhitung otomatis. Slip gaji ber-QR Code siap dicetak atau diunduh format PDF resmi.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Panduan Penggunaan Perangkat (Device Best Experience) */}
        <div id="sec-perangkat" className="p-3.5 print:p-2.5 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-2 print:space-y-1 print-break-inside-avoid scroll-mt-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-[#FF6B00]" />
              <h3 className="text-xs print:text-[12px] font-black uppercase tracking-wider font-mono-code text-white">
                3. Panduan Perangkat & Pengalaman Pengguna (Device Best Experience)
              </h3>
            </div>
            <span className="text-[9.5px] font-mono-code text-slate-400 no-print print:hidden">
              Responsif di semua perangkat
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-2.5 print:gap-2">
            {/* Desktop / Web Card */}
            <div className="p-2.5 print:p-2 rounded-xl bg-slate-800 border border-blue-500/40 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5 text-[11.5px] print:text-[11px]">
                  <Monitor className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  Desktop / Web (Laptop & PC)
                </span>
                <span className="text-[8.5px] print:text-[8.5px] font-mono-code font-bold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Utama (Admin & Manajemen)
                </span>
              </div>
              <p className="text-[10px] print:text-[9.5px] text-slate-200 leading-snug">
                Didesain khusus untuk <strong>HR, Finance, dan Pimpinan</strong>. Menyajikan layar lebar untuk dashboard analitik, rekap absensi, hitung gaji massal Depnaker, cetak slip gaji ber-QR Code, serta manajemen biaya proyek.
              </p>
            </div>

            {/* Mobile Card */}
            <div className="p-2.5 print:p-2 rounded-xl bg-slate-800 border border-emerald-500/40 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5 text-[11.5px] print:text-[11px]">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  Mobile (HP Android & iOS)
                </span>
                <span className="text-[8.5px] print:text-[8.5px] font-mono-code font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Khusus Staf Lapangan
                </span>
              </div>
              <p className="text-[10px] print:text-[9.5px] text-slate-200 leading-snug">
                Sangat ringan dan cepat diakses langsung dari <strong>browser HP staf tanpa perlu install aplikasi berat</strong>. Fokus untuk foto selfie masuk/pulang, deteksi GPS satelit, pengajuan izin/lembur mandiri, dan unduh slip gaji pribadi.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Skema Pilihan Model Deployment */}
        <div id="sec-deployment" className="space-y-2 print:space-y-1 print-break-inside-avoid scroll-mt-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
            <Server className="w-4 h-4 text-[#FF6B00]" />
            <h2 className="text-xs sm:text-sm print:text-[13px] font-black text-slate-900 uppercase tracking-wider font-mono-code">
              4. Skema Pilihan Model Deployment (Cloud, Offline & Custom Domain)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-2.5 print:gap-2 p-3 print:p-2 rounded-2xl bg-slate-50 border border-slate-200">
            {/* Online Cloud */}
            <div className="p-2.5 print:p-2 rounded-xl bg-white border border-blue-200/80 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 flex items-center gap-1.5 text-[11.5px] print:text-[11px]">
                  <Cloud className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  Cloud Online
                </span>
                <span className="text-[9px] font-mono-code font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  Deploy: Gratis
                </span>
              </div>
              <p className="text-[10px] print:text-[9.5px] text-slate-600 leading-snug">
                Pemasangan di server cloud <strong>Gratis (Rp 0)</strong>. DMJ hanya membayar running server bulanan:
              </p>
              <div className="p-1.5 rounded-lg bg-blue-50/60 border border-blue-100 space-y-0.5 text-[9.5px] print:text-[9px] text-slate-700">
                <div className="flex justify-between items-center">
                  <span>• Biaya Server Cloud:</span>
                  <span className="font-mono-code font-bold text-blue-700">Rp 35.000 / Bln</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>• Setup & Deploy:</span>
                  <span className="font-mono-code font-bold text-emerald-700">Gratis (Rp 0)</span>
                </div>
                <span className="text-[8.5px] text-slate-500 italic block pt-0.5">
                  *Subdomain gratis: <span className="font-mono-code text-blue-700">dmj.primeprojectx.net</span>
                </span>
              </div>
            </div>

            {/* Offline Local */}
            <div className="p-2.5 print:p-2 rounded-xl bg-white border border-orange-200/80 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 flex items-center gap-1.5 text-[11.5px] print:text-[11px]">
                  <Server className="w-3.5 h-3.5 text-[#FF6B00]" />
                  Offline (Lokal Kantor)
                </span>
                <span className="text-[9px] font-mono-code font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                  Bulanan: Rp 0
                </span>
              </div>
              <p className="text-[10px] print:text-[9.5px] text-slate-600 leading-snug">
                Dijalankan mandiri di jaringan LAN kantor/workshop DMJ tanpa ketergantungan internet luar:
              </p>
              <div className="p-1.5 rounded-lg bg-orange-50/60 border border-orange-100 space-y-0.5 text-[9.5px] print:text-[9px] text-slate-700">
                <div className="flex justify-between items-center">
                  <span>• Lisensi Source Code:</span>
                  <span className="font-mono-code font-bold text-[#FF6B00]">Rp 200.000 (1x)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>• Biaya Server Luar:</span>
                  <span className="font-mono-code font-bold text-emerald-700">Rp 0 / Bln (Bebas)</span>
                </div>
                <span className="text-[8.5px] text-slate-500 italic block pt-0.5">
                  *Source code diserahkan penuh untuk dijalankan di PC kantor.
                </span>
              </div>
            </div>

            {/* Opsi Custom Domain Sendiri */}
            <div className="p-2.5 print:p-2 rounded-xl bg-white border border-purple-200/80 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 flex items-center gap-1.5 text-[11.5px] print:text-[11px]">
                  <Globe className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  Custom Domain Brand
                </span>
                <span className="text-[9px] font-mono-code font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                  Tahunan
                </span>
              </div>
              <p className="text-[10px] print:text-[9.5px] text-slate-600 leading-snug">
                Jika ingin menggunakan domain nama sendiri (contoh: <strong className="text-slate-900 font-mono-code">DMJhris.com</strong>):
              </p>
              <div className="p-1.5 rounded-lg bg-purple-50/60 border border-purple-100 space-y-0.5 text-[9.5px] print:text-[9px] text-slate-700">
                <div className="flex justify-between items-center">
                  <span>• Domain .com Resmi:</span>
                  <span className="font-mono-code font-bold text-purple-700">± Rp 250.000 / Thn</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>• Setup DNS & SSL:</span>
                  <span className="font-mono-code font-bold text-emerald-700">Gratis (Rp 0)</span>
                </div>
                <span className="text-[8.5px] text-slate-500 italic block pt-0.5">
                  *Biaya fleksibel menyesuaikan harga registrar domain resmi.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Halaman 2: Mulai di lembar baru secara utuh dengan bab resmi             */}
        {/* ========================================================================= */}
        <div className="page-break" />

        {/* 5. Pilihan Paket Investasi & Add-On Modular */}
        <div id="sec-paket" className="space-y-3 print:space-y-2 print-break-inside-avoid scroll-mt-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
            <DollarSign className="w-4 h-4 text-[#FF6B00]" />
            <h2 className="text-xs sm:text-sm print:text-[13px] font-black text-slate-900 uppercase tracking-wider font-mono-code">
              5. Pilihan Paket Investasi & Add-On Modular
            </h2>
          </div>

          <div id="tour-proposal-packages" className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-3 print:gap-2">
            
            {/* Opsi 1: Paket Dasar */}
            <div className={`p-4 print:p-2.5 rounded-3xl print:rounded-2xl border-2 transition-all flex flex-col justify-between space-y-3 print:space-y-1.5 print-break-inside-avoid ${
              !includeGeofenceSequence && !includeMobileVersion && !includeSourceCode && !includeCustomDomain && !includeTraining
                ? 'border-blue-600 bg-blue-50/40 shadow-md ring-2 ring-blue-500/30'
                : 'border-slate-300 bg-slate-50/80'
            }`}>
              <div>
                <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9.5px] print:text-[9px] font-bold font-mono-code uppercase">
                  PAKET DASAR HRIS
                </span>
                <h3 className="text-sm print:text-[12.5px] font-black text-slate-900 mt-1.5 print:mt-1">Paket Dasar HRIS</h3>
                <p className="text-xl print:text-[15px] font-black text-slate-900 font-mono-code mt-0.5">
                  Rp 2.500.000 <span className="text-[10px] font-normal text-slate-500">(1x Bayar)</span>
                </p>

                <div className="mt-2.5 print:mt-1 p-2 print:p-1.5 rounded-xl bg-orange-50 border border-orange-200 text-[10.5px] print:text-[9.5px] text-slate-700 space-y-0.5">
                  <p className="font-bold text-[#FF6B00]">Biaya Cloud Running Apps:</p>
                  <p className="font-mono-code font-bold text-slate-900">
                    Rp 35.000 / Bulan
                  </p>
                  <p className="text-[9.5px] print:text-[8.5px] text-slate-500">
                    Deployment online gratis & auto-backup database berkala.
                  </p>
                </div>

                <div className="mt-2.5 print:mt-1 pt-1.5 print:pt-1 border-t border-slate-200 space-y-0.5 text-[10.5px] print:text-[9.5px] text-slate-600">
                  <p className="font-bold text-slate-900 flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-[#FF6B00]" />
                    Alokasi Penyimpanan:
                  </p>
                  <p>✓ <strong>1 GB</strong> Penyimpanan Aplikasi Aktif</p>
                  <p>✓ <strong>10 GB</strong> Backup Cadangan Otomatis</p>
                </div>

                <div className="mt-2.5 print:mt-1 pt-1.5 print:pt-1 border-t border-slate-200 space-y-0.5 text-[10.5px] print:text-[9.5px] text-slate-600">
                  <p className="font-bold text-slate-900">Fitur Sudah Termasuk:</p>
                  <p>✓ Dashboard HRIS Desktop / Web Lengkap</p>
                  <p>✓ Manajemen Karyawan & Aturan Shift</p>
                  <p>✓ Hitung Gaji/Otomatis & Cetak Slip QR</p>
                  <p>✓ Approval Cuti, Izin & Sakit Online</p>
                  <p>✓ Subdomain Gratis (dmj.primeprojectx.net)</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => applyPreset('dasar')}
                className={`w-full text-center text-xs font-bold font-mono-code py-2 rounded-xl border transition-all cursor-pointer shadow-2xs active:scale-95 no-print print:hidden ${
                  !includeGeofenceSequence && !includeMobileVersion && !includeSourceCode && !includeCustomDomain && !includeTraining
                    ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {!includeGeofenceSequence && !includeMobileVersion && !includeSourceCode && !includeCustomDomain && !includeTraining
                  ? '✔ Terpilih: Paket Dasar'
                  : 'Pilih Paket Dasar (Rp 2.5 Jt)'}
              </button>
            </div>

            {/* Opsi 2: Add-On Modular */}
            <div className="p-4 print:p-2.5 rounded-3xl print:rounded-2xl border-2 border-purple-200 bg-purple-50/20 flex flex-col justify-between space-y-3 print:space-y-1.5 print-break-inside-avoid">
              <div>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[9.5px] print:text-[9px] font-bold font-mono-code uppercase">
                  + FITUR TAMBAHAN (OPTIONAL)
                </span>
                <h3 className="text-sm print:text-[12.5px] font-black text-slate-900 mt-1.5 print:mt-1">Pilihan Add-On</h3>
                <p className="text-[10.5px] print:text-[9.5px] text-slate-500 mt-0.5">
                  Bisa ditambah sesuai kebutuhan spesifik kantor DMJ.
                </p>

                <div className="mt-2.5 print:mt-1 space-y-1.5 print:space-y-1">
                  {/* Addon 1: Geofence Multi-Site */}
                  <div
                    onClick={() => setIncludeGeofenceSequence(prev => !prev)}
                    className={`p-2 print:p-1.5 rounded-xl border shadow-2xs space-y-0.5 transition-all cursor-pointer select-none ${
                      includeGeofenceSequence ? 'bg-blue-50/90 border-blue-400 ring-1 ring-blue-300' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5 text-[10.5px] print:text-[10px]">
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 text-[10px]">
                          <MapPin className="w-3 h-3" />
                        </div>
                        Multi-Site GPS Geofence
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-code font-bold text-[10px] text-blue-700">Rp 1.000.000</span>
                        <div className={`w-7 h-4 rounded-full transition-colors flex items-center p-0.5 ${includeGeofenceSequence ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}>
                          <div className="w-3 h-3 rounded-full bg-white shadow-xs" />
                        </div>
                      </div>
                    </div>
                    <p className="text-[9.5px] print:text-[9px] text-slate-600 leading-tight pl-6.5">
                      Kunci tombol absensi wajib ter-validasi koordinat GPS satelit kantor/site proyek DMJ.
                    </p>
                  </div>

                  {/* Addon 2: Mobile Version */}
                  <div
                    onClick={() => setIncludeMobileVersion(prev => !prev)}
                    className={`p-2 print:p-1.5 rounded-xl border shadow-2xs space-y-0.5 transition-all cursor-pointer select-none ${
                      includeMobileVersion ? 'bg-emerald-50/90 border-emerald-400 ring-1 ring-emerald-300' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5 text-[10.5px] print:text-[10px]">
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 text-[10px]">
                          <Smartphone className="w-3 h-3" />
                        </div>
                        Mobile Version (Smartphone)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-code font-bold text-[10px] text-emerald-700">Rp 1.000.000</span>
                        <div className={`w-7 h-4 rounded-full transition-colors flex items-center p-0.5 ${includeMobileVersion ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'}`}>
                          <div className="w-3 h-3 rounded-full bg-white shadow-xs" />
                        </div>
                      </div>
                    </div>
                    <p className="text-[9.5px] print:text-[9px] text-slate-600 leading-tight pl-6.5">
                      Akses web responsif HP staf: presensi, selfie biometrik, GPS absen native, & cek slip gaji mandiri.
                    </p>
                  </div>

                  {/* Addon 3: Source Code Offline */}
                  <div
                    onClick={() => setIncludeSourceCode(prev => !prev)}
                    className={`p-2 print:p-1.5 rounded-xl border shadow-2xs space-y-0.5 transition-all cursor-pointer select-none ${
                      includeSourceCode ? 'bg-purple-50/90 border-purple-400 ring-1 ring-purple-300' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5 text-[10.5px] print:text-[10px]">
                        <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 text-[10px]">
                          <Code className="w-3 h-3" />
                        </div>
                        Source Code (Offline)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-code font-bold text-[10px] text-purple-700">Rp 200.000</span>
                        <div className={`w-7 h-4 rounded-full transition-colors flex items-center p-0.5 ${includeSourceCode ? 'bg-purple-600 justify-end' : 'bg-slate-300 justify-start'}`}>
                          <div className="w-3 h-3 rounded-full bg-white shadow-xs" />
                        </div>
                      </div>
                    </div>
                    <p className="text-[9.5px] print:text-[9px] text-slate-600 leading-tight pl-6.5">
                      Lisensi source code untuk dijalankan di PC kantor tanpa biaya cloud.
                    </p>
                  </div>

                  {/* Addon 4: Custom Domain Sendiri */}
                  <div
                    onClick={() => setIncludeCustomDomain(prev => !prev)}
                    className={`p-2 print:p-1.5 rounded-xl border shadow-2xs space-y-0.5 transition-all cursor-pointer select-none ${
                      includeCustomDomain ? 'bg-blue-50/90 border-blue-400 ring-1 ring-blue-300' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5 text-[10.5px] print:text-[10px]">
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 text-[10px]">
                          <Globe className="w-3 h-3" />
                        </div>
                        Domain DMJhris.com
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-code font-bold text-[10px] text-blue-700">Rp 250.000/thn</span>
                        <div className={`w-7 h-4 rounded-full transition-colors flex items-center p-0.5 ${includeCustomDomain ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}>
                          <div className="w-3 h-3 rounded-full bg-white shadow-xs" />
                        </div>
                      </div>
                    </div>
                    <p className="text-[9.5px] print:text-[9px] text-slate-600 leading-tight pl-6.5">
                      Gunakan domain brand sendiri. Menyesuaikan tarif registrasi resmi.
                    </p>
                  </div>

                  {/* Addon 5: Pelatihan Full Team */}
                  <div
                    onClick={() => setIncludeTraining(prev => !prev)}
                    className={`p-2 print:p-1.5 rounded-xl border shadow-2xs space-y-0.5 transition-all cursor-pointer select-none ${
                      includeTraining ? 'bg-purple-50/90 border-purple-400 ring-1 ring-purple-300' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5 text-[10.5px] print:text-[10px]">
                        <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 text-[10px]">
                          <Users className="w-3 h-3" />
                        </div>
                        Pelatihan Full Team <span className="bg-amber-400 text-slate-900 text-[8px] font-black px-1.5 py-0.2 rounded uppercase">BARU</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-code font-bold text-[10px] text-purple-700">Rp 1.000.000</span>
                        <div className={`w-7 h-4 rounded-full transition-colors flex items-center p-0.5 ${includeTraining ? 'bg-purple-600 justify-end' : 'bg-slate-300 justify-start'}`}>
                          <div className="w-3 h-3 rounded-full bg-white shadow-xs" />
                        </div>
                      </div>
                    </div>
                    <p className="text-[9.5px] print:text-[9px] text-slate-600 leading-tight pl-6.5">
                      Pelatihan penggunaan sistem untuk seluruh tim (semua divisi).
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-[9.5px] text-center text-slate-500 font-mono-code pt-1 no-print print:hidden">
                *Klik tiap baris add-on di atas untuk aktifkan/nonaktifkan
              </div>
            </div>

            {/* Opsi 3: Paket Komplit (Prime HRIS Enterprise - Paling Hemat) */}
            <div className={`p-4 print:p-2.5 rounded-3xl print:rounded-2xl border-2 flex flex-col justify-between space-y-3 print:space-y-1.5 relative overflow-hidden print-break-inside-avoid transition-all ${
              isFullSuite
                ? 'border-[#FF6B00] bg-orange-50/80 shadow-xl ring-2 ring-orange-400'
                : 'border-orange-300 bg-orange-50/40'
            }`}>
              <div className="absolute top-0 right-0 bg-gradient-to-r from-[#FF6B00] to-amber-500 text-white text-[8.5px] font-black px-3 py-1 rounded-bl-xl font-mono-code uppercase tracking-wider shadow-xs flex items-center gap-1">
                👑 PALING HEMAT
              </div>

              <div>
                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#FF6B00] text-[9.5px] print:text-[9px] font-bold font-mono-code uppercase">
                  PAKET KOMPLIT (FULL SUITE)
                </span>
                <h3 className="text-sm print:text-[12.5px] font-black text-slate-900 mt-1.5 print:mt-1">Prime HRIS Enterprise</h3>
                <p className="text-xl print:text-[15px] font-black text-[#FF6B00] font-mono-code mt-0.5">
                  Rp 5.500.000 <span className="text-[10px] font-normal text-slate-500">(All-in One-Time)</span>
                </p>

                <div className="mt-2.5 print:mt-1 p-2 print:p-1.5 rounded-xl bg-white border border-orange-200 text-[10.5px] print:text-[9.5px] text-slate-700 space-y-1 shadow-2xs">
                  <p className="font-bold text-slate-900 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#FF6B00]" />
                    Mencakup Seluruh Modul:
                  </p>
                  <p className="text-slate-600 text-[10px] leading-snug">
                    Paket Dasar (2,5jt) + Multi-Site Geofence (1jt) + Mobile Version (1jt) + Source Code (200rb) + Domain (250rb/thn) + Pelatihan Full Team (1jt)
                  </p>
                </div>

                <div className="mt-2.5 print:mt-1 space-y-0.5 text-[10.5px] print:text-[9.5px] text-slate-700">
                  <p className="font-bold text-slate-900 flex items-center gap-1">
                    <Award className="w-3 h-3 text-[#FF6B00]" />
                    Keunggulan Lengkap:
                  </p>
                  <p>✓ 1 GB Storage + 10 GB Backup Cadangan</p>
                  <p>✓ Akses Komplit: Desktop Web Admin + Mobile Smartphone</p>
                  <p>✓ Pengamanan Ganda: Selfie Wajah Biometrik + Multi-Site GPS Geofence</p>
                  <p>✓ Penggajian Depnaker Lengkap & Slip Gaji QR</p>
                  <p>✓ Garansi Bebas Masalah & Update 12 Bulan</p>
                  <p>✓ Setup Custom Domain Gratis (DMJhris.com)</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => applyPreset('komplit')}
                className={`w-full text-center text-xs font-mono-code font-bold py-2.5 rounded-xl shadow-md transition-all cursor-pointer active:scale-95 no-print print:hidden ${
                  isFullSuite
                    ? 'bg-gradient-to-r from-[#FF6B00] to-amber-500 text-white shadow-orange-500/30 ring-2 ring-orange-300'
                    : 'bg-white text-[#FF6B00] border-2 border-[#FF6B00] hover:bg-orange-50'
                }`}
              >
                <span className="flex items-center justify-center gap-1">
                  👑 {isFullSuite ? 'Paket Full Komplit Terpilih' : 'Pilih Paket Full Komplit'}
                </span>
                <span className="block text-[8.5px] font-normal opacity-90">
                  Semua fitur, semua kebutuhan, dalam satu paket!
                </span>
              </button>
            </div>

          </div>

          {/* Simulator Interaktif Perhitungan Langsung (Tampil Presisi di Web & Cetak PDF) */}
          <div id="tour-proposal-pricing" className="p-4 print:p-2 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-xl space-y-3 print:space-y-1 print-break-inside-avoid">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FF6B00]" />
                <h4 className="text-xs print:text-[11.5px] font-black uppercase tracking-wider font-mono-code text-white">
                  Rincian Biaya Investasi & Operasional PT Dwi Martha Jaya
                </h4>
              </div>
              <span className="text-[9.5px] text-slate-400 font-mono-code no-print print:hidden">
                Simulasi otomatis pengadaan sistem, server cloud & nama domain
              </span>
            </div>

            {/* Quick Skenario Preset Chips (Web Only) */}
            <div className="flex items-center gap-1.5 flex-wrap no-print print:hidden pt-0.5">
              <span className="text-[9.5px] font-mono-code uppercase font-bold text-slate-400 mr-1">
                Pilih Skenario:
              </span>
              <button
                type="button"
                onClick={() => applyPreset('komplit')}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono-code font-bold transition-all cursor-pointer ${
                  isFullSuite
                    ? 'bg-[#FF6B00] text-white shadow-xs'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                👑 Full Suite Komplit (5.5 Jt)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('mobile')}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono-code font-bold transition-all cursor-pointer ${
                  !includeGeofenceSequence && includeMobileVersion && !includeCustomDomain && !includeSourceCode && !includeTraining
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                📱 Mobile Lapangan (3.5 Jt)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('geofence')}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono-code font-bold transition-all cursor-pointer ${
                  includeGeofenceSequence && !includeMobileVersion && !includeCustomDomain && !includeSourceCode && !includeTraining
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                📍 Kantor Geofence (3.5 Jt)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('dasar')}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono-code font-bold transition-all cursor-pointer ${
                  !includeGeofenceSequence && !includeMobileVersion && !includeCustomDomain && !includeSourceCode && !includeTraining
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                ⚡ Paket Dasar (2.5 Jt)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('offline')}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono-code font-bold transition-all cursor-pointer ${
                  includeSourceCode && !includeGeofenceSequence && !includeMobileVersion
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                💻 Offline Mandiri (2.7 Jt)
              </button>
            </div>

            {/* Visual Formula Strip (Matching Quotation & Proposal) */}
            <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-wrap items-center justify-between gap-1.5 text-xs font-mono-code">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                <span className="text-[10px] font-bold">1. PAKET DASAR HRIS</span>
                <span className="font-black text-[11px]">Rp 2.500.000 (1x)</span>
              </div>
              <span className="text-slate-400 font-bold text-sm">+</span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/60 border border-blue-500/40 text-blue-300">
                <span className="text-[10px] font-bold">2. ADD-ON TERPILIH</span>
                <span className="font-black text-[11px]">(Opsional)</span>
              </div>
              <span className="text-slate-400 font-bold text-sm">+</span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-500/40 text-purple-300">
                <span className="text-[10px] font-bold">3. PELATIHAN FULL TEAM</span>
                <span className="font-black text-[11px]">Rp 1.000.000 (1x)</span>
              </div>
              <span className="text-slate-400 font-bold text-sm">+</span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-300">
                <span className="text-[10px] font-bold">4. CLOUD & INFRASTRUKTUR</span>
                <span className="font-black text-[11px]">Rp 35.000 / Bln</span>
              </div>
              <span className="text-slate-400 font-bold text-sm">=</span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#FF6B00]/30 to-amber-500/30 border border-[#FF6B00] text-amber-300">
                <span className="text-[10px] font-bold">👑 PAKET FULL KOMPLIT</span>
                <span className="font-black text-[11px] text-[#FF6B00]">Rp 5.500.000 (1x)</span>
              </div>
            </div>

            {/* 6 Interactive Selector Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 text-xs no-print print:hidden">
              {/* Opsi Wajib: Paket Dasar */}
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-800/90 border border-emerald-500/40 select-none">
                <div className="w-5 h-5 rounded-lg bg-emerald-500/20 border border-emerald-500 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-white block text-[10.5px] truncate">Paket Dasar HRIS</span>
                  <span className="text-[9.5px] font-mono-code text-[#00E2B0]">Rp 2.500.000 (1x)</span>
                </div>
              </div>

              {/* Tombol Geofence */}
              <button
                type="button"
                onClick={() => setIncludeGeofenceSequence(prev => !prev)}
                className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer text-left select-none active:scale-95 ${
                  includeGeofenceSequence
                    ? 'bg-blue-950/50 border-blue-500 shadow-md shadow-blue-500/15 ring-1 ring-blue-500/40'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600 hover:bg-slate-700/80 opacity-70'
                }`}
              >
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                  includeGeofenceSequence
                    ? 'bg-blue-500 border-blue-500 text-white shadow-xs'
                    : 'bg-slate-800 border-slate-600 text-transparent'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-white block text-[10.5px] truncate">+ Geofence Multi-Site</span>
                  <span className="text-[9.5px] font-mono-code text-blue-400">+ Rp 1.000.000</span>
                </div>
              </button>

              {/* Tombol Mobile Version */}
              <button
                type="button"
                onClick={() => setIncludeMobileVersion(prev => !prev)}
                className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer text-left select-none active:scale-95 ${
                  includeMobileVersion
                    ? 'bg-emerald-950/50 border-emerald-500 shadow-md shadow-emerald-500/15 ring-1 ring-emerald-500/40'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600 hover:bg-slate-700/80 opacity-70'
                }`}
              >
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                  includeMobileVersion
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                    : 'bg-slate-800 border-slate-600 text-transparent'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-white block text-[10.5px] truncate">+ Mobile Version</span>
                  <span className="text-[9.5px] font-mono-code text-emerald-400">+ Rp 1.000.000</span>
                </div>
              </button>

              {/* Tombol Source Code (Offline) */}
              <button
                type="button"
                onClick={() => setIncludeSourceCode(prev => !prev)}
                className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer text-left select-none active:scale-95 ${
                  includeSourceCode
                    ? 'bg-amber-950/50 border-amber-500 shadow-md shadow-amber-500/15 ring-1 ring-amber-500/40'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600 hover:bg-slate-700/80 opacity-70'
                }`}
              >
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                  includeSourceCode
                    ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                    : 'bg-slate-800 border-slate-600 text-transparent'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-white block text-[10.5px] truncate">+ Source Code</span>
                  <span className="text-[9.5px] font-mono-code text-amber-400">+ Rp 200.000</span>
                </div>
              </button>

              {/* Tombol Custom Domain Sendiri */}
              <button
                type="button"
                onClick={() => setIncludeCustomDomain(prev => !prev)}
                className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer text-left select-none active:scale-95 ${
                  includeCustomDomain
                    ? 'bg-blue-950/50 border-blue-500 shadow-md shadow-blue-500/15 ring-1 ring-blue-500/40'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600 hover:bg-slate-700/80 opacity-70'
                }`}
              >
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                  includeCustomDomain
                    ? 'bg-blue-500 border-blue-500 text-white shadow-xs'
                    : 'bg-slate-800 border-slate-600 text-transparent'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-white block text-[10.5px] truncate">+ Domain Brand</span>
                  <span className="text-[9.5px] font-mono-code text-blue-400">± Rp 250.000/Thn</span>
                </div>
              </button>

              {/* Tombol Pelatihan Full Team */}
              <button
                type="button"
                onClick={() => setIncludeTraining(prev => !prev)}
                className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer text-left select-none active:scale-95 ${
                  includeTraining
                    ? 'bg-purple-950/50 border-purple-500 shadow-md shadow-purple-500/15 ring-1 ring-purple-500/40'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600 hover:bg-slate-700/80 opacity-70'
                }`}
              >
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                  includeTraining
                    ? 'bg-purple-500 border-purple-500 text-white shadow-xs'
                    : 'bg-slate-800 border-slate-600 text-transparent'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-white block text-[10.5px] truncate">+ Pelatihan Tim</span>
                  <span className="text-[9.5px] font-mono-code text-purple-400">+ Rp 1.000.000</span>
                </div>
              </button>
            </div>

            {/* Total Nilai Live Calculation Strip (4 Kolom Lengkap) */}
            <div className="pt-1.5 print:pt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-2.5 print:gap-1.5 bg-slate-800 p-3 print:p-1.5 rounded-xl border border-slate-700 font-mono-code">
              <div>
                <span className="text-[9.5px] print:text-[8.5px] text-slate-300 block uppercase font-bold">1. Pengadaan (1x Bayar):</span>
                <span className="text-base print:text-[13.5px] font-black text-[#FF6B00]">{formatIDR(totalInvestment)}</span>
                <span className="text-[8.5px] text-slate-300 block mt-0.5">
                  {includeSourceCode ? 'Termasuk lisensi source code' : 'Lisensi penggunaan sistem DMJ'}
                </span>
              </div>

              <div>
                <span className="text-[9.5px] print:text-[8.5px] text-slate-300 block uppercase font-bold">2. Server Cloud (Bulanan):</span>
                <span className="text-base print:text-[13.5px] font-black text-emerald-400">
                  {formatIDR(totalMonthlyRunning)} <span className="text-[10px] font-normal text-slate-300">/ Bln</span>
                </span>
                <span className="text-[8.5px] text-slate-300 block mt-0.5">
                  Layanan server cloud resmi (Rp 35rb/bln)
                </span>
              </div>

              <div>
                <span className="text-[9.5px] print:text-[8.5px] text-slate-300 block uppercase font-bold">3. Alamat Domain (Tahunan):</span>
                <span className={`text-xs print:text-[11.5px] font-bold block ${includeCustomDomain ? 'text-purple-400' : 'text-slate-200'}`}>
                  {includeCustomDomain ? '± Rp 250.000 / Tahun' : 'Gratis (Rp 0)'}
                </span>
                <span className="text-[8.5px] text-slate-300 block mt-0.5">
                  {includeCustomDomain ? 'Domain pilihan DMJhris.com (.com)' : 'Subdomain dmj.primeprojectx.net'}
                </span>
              </div>

              <div>
                <span className="text-[9.5px] print:text-[8.5px] text-slate-300 block uppercase font-bold">4. Status Setup & Deploy:</span>
                <span className="text-[11px] print:text-[10.5px] font-bold text-blue-400 block">
                  Online Deploy: Gratis (Rp 0)
                </span>
                <span className="text-[8.5px] text-slate-300 block mt-0.5">
                  1 GB Storage • 10 GB Backup Cadangan
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* 6. Jadwal Pemasangan & Serah Terima (5 Minggu) */}
        <div id="sec-timeline" className="space-y-2 print:space-y-1 print-break-inside-avoid mt-2 print:mt-0.5 scroll-mt-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
            <Calendar className="w-4 h-4 text-[#FF6B00]" />
            <h2 className="text-xs sm:text-sm print:text-[13px] font-black text-slate-900 uppercase tracking-wider font-mono-code">
              6. Jadwal Pemasangan & Serah Terima Sistem (5 Minggu)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 print:grid-cols-4 gap-2.5 print:gap-1.5">
            {[
              {
                step: 'Minggu 1',
                title: 'Persiapan & Data Master',
                desc: 'Input data karyawan DMJ, registrasi server cloud & setting koordinat kantor.'
              },
              {
                step: 'Minggu 2-3',
                title: 'Pemasangan Modul',
                desc: 'Setting kamera selfie, rumus lembur Depnaker, serta modul biaya proyek.'
              },
              {
                step: 'Minggu 4',
                title: 'Uji Coba Lapangan',
                desc: 'Karyawan mencoba absen langsung, review bersama direksi & perbaikan akhir.'
              },
              {
                step: 'Minggu 5',
                title: 'Pelatihan & Serah Terima',
                desc: 'Training intensif admin/HR, penyerahan akun pimpinan & siap dipakai penuh.'
              }
            ].map((st, i) => (
              <div key={i} className="p-2.5 print:p-1.5 rounded-xl bg-slate-50 border border-slate-200 space-y-0.5">
                <span className="text-[9.5px] font-mono-code font-black text-[#FF6B00] bg-orange-100 px-1.5 py-0.5 rounded inline-block">
                  {st.step}
                </span>
                <h4 className="text-[11px] print:text-[10.5px] font-black text-slate-900">{st.title}</h4>
                <p className="text-[10px] print:text-[9.5px] text-slate-600 leading-snug">{st.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 7. Jaminan Garansi, Keamanan Data & Layanan Purna Jual */}
        <div id="sec-sla" className="space-y-2 print:space-y-1 print-break-inside-avoid scroll-mt-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs sm:text-sm print:text-[13px] font-black text-slate-900 uppercase tracking-wider font-mono-code">
              7. Jaminan Garansi, Keamanan Data & Layanan Purna Jual (SLA)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 print:grid-cols-4 gap-2.5 print:gap-1.5">
            <div className="p-2.5 print:p-1.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-0.5">
              <span className="text-[9px] font-mono-code font-bold text-emerald-700 uppercase block">
                Garansi Sistem
              </span>
              <h4 className="text-[11px] print:text-[10.5px] font-black text-slate-900">Bebas Kendala 12 Bulan</h4>
              <p className="text-[10px] print:text-[9.5px] text-slate-600 leading-snug">
                Perbaikan bug dan penyesuaian sistem gratis selama 1 tahun penuh.
              </p>
            </div>

            <div className="p-3 print:p-1.5 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-0.5">
              <span className="text-[9px] font-mono-code font-bold text-blue-700 uppercase block">
                Pendampingan
              </span>
              <h4 className="text-[11px] print:text-[10.5px] font-black text-slate-900">Training HR & Admin</h4>
              <p className="text-[10px] print:text-[9.5px] text-slate-600 leading-snug">
                Pelatihan intensif staf HR, Finance & Admin hingga seluruh alur lancar.
              </p>
            </div>

            <div className="p-2.5 print:p-1.5 rounded-xl bg-orange-50/60 border border-orange-200/80 space-y-0.5">
              <span className="text-[9px] font-mono-code font-bold text-[#FF6B00] uppercase block">
                Cadangan Data
              </span>
              <h4 className="text-[11px] print:text-[10.5px] font-black text-slate-900">Backup Berkala 10 GB</h4>
              <p className="text-[10px] print:text-[9.5px] text-slate-600 leading-snug">
                Data presensi & slip gaji tersimpan aman dengan cadangan otomatis.
              </p>
            </div>

            <div className="p-2.5 print:p-1.5 rounded-xl bg-purple-50/60 border border-purple-200/80 space-y-0.5">
              <span className="text-[9px] font-mono-code font-bold text-purple-700 uppercase block">
                Privasi Penuh
              </span>
              <h4 className="text-[11px] print:text-[10.5px] font-black text-slate-900">Data 100% Milik DMJ</h4>
              <p className="text-[10px] print:text-[9.5px] text-slate-600 leading-snug">
                Kerahasiaan gaji karyawan terlindungi penuh tanpa akses pihak ketiga.
              </p>
            </div>
          </div>
        </div>

        {/* 8. Lembar Pengesahan & Bukti Keabsahan Digital */}
        <div id="sec-pengesahan" className="pt-3.5 print:pt-2 border-t-2 border-slate-900 grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-6 print:gap-3 text-xs print-break-inside-avoid scroll-mt-6">
          <div>
            <p className="font-bold text-slate-900 print:text-[11px]">Diajukan Oleh:</p>
            <p className="text-slate-500 font-semibold mt-0.5 print:text-[10px]">PT PRIME INFINITY SYSTEMS</p>
            
            {/* QR Code Bukti Keabsahan Digital */}
            <div className="my-2 print:my-1 p-2.5 print:p-1.5 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center gap-3 print:gap-2 max-w-sm shadow-2xs">
              <a
                href={proposalUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Buka proposal ini secara online"
                className="group relative bg-white p-1 rounded-xl border border-slate-200 shrink-0 shadow-xs hover:border-[#FF6B00] transition-all cursor-pointer"
              >
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR Bukti Keabsahan Proposal"
                    className="w-16 h-16 sm:w-20 sm:h-20 print:w-14 print:h-14 object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 print:w-14 print:h-14 bg-slate-100 flex items-center justify-center text-[9px] text-slate-400">
                    Membuat QR...
                  </div>
                )}
                <div className="absolute inset-0 bg-orange-500/10 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity flex items-center justify-center no-print">
                  <ExternalLink className="w-3.5 h-3.5 text-[#FF6B00]" />
                </div>
              </a>

              <div className="space-y-0.5 text-[10.5px] print:text-[9.5px] leading-tight">
                <div className="flex items-center gap-1 text-emerald-700 font-bold font-mono-code text-[9.5px] print:text-[9px] uppercase">
                  <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Bukti Keabsahan Digital</span>
                </div>
                <p className="text-[9.5px] print:text-[8.5px] text-slate-600 leading-snug">
                  Scan QR via kamera HP untuk memverifikasi keaslian proposal online ini.
                </p>
                <div className="pt-0.5 flex flex-col">
                  <span className="text-[8.5px] font-mono-code text-slate-400">Tautan Langsung:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <a
                      href={proposalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#FF6B00] hover:underline font-mono-code font-bold text-[9.5px] print:text-[8.5px] break-all inline-flex items-center gap-1"
                    >
                      <span>dmj.primeprojectx.net/?tab=proposal</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0 no-print" />
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="text-[9px] font-mono-code text-slate-500 hover:text-slate-800 underline no-print print:hidden cursor-pointer"
                    >
                      (Salin)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-1.5 print:mt-0.5">
              <p className="font-black text-slate-900 font-mono-code underline print:text-[11px]">Galih Primananda, S.E.</p>
              <p className="text-[9.5px] print:text-[8.5px] text-slate-500">Managing Director & Analytics Platform Architect</p>
              <p className="text-[9.5px] print:text-[8.5px] text-orange-600 font-mono-code font-bold">PT Prime Infinity Systems</p>
            </div>
          </div>

          <div className="text-left sm:text-right print:text-right flex flex-col justify-between">
            <div>
              <p className="font-bold text-slate-900 print:text-[11px]">Disetujui & Diterima Oleh:</p>
              <p className="text-slate-500 font-semibold mt-0.5 print:text-[10px]">PT DWI MARTHA JAYA</p>
            </div>

            <div className="h-20 print:h-12 flex items-end justify-start sm:justify-end print:justify-end">
              <div>
                <p className="font-black text-slate-900 font-mono-code underline print:text-[11px]">( ..................................................... )</p>
                <p className="text-[9.5px] print:text-[8.5px] text-slate-600 font-bold">Authorized Director / Management</p>
                <p className="text-[9.5px] print:text-[8.5px] text-orange-600 font-mono-code font-bold">PT Dwi Martha Jaya</p>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
