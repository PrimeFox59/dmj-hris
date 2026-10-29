import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  FileText,
  Printer,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  Building2,
  Download,
  Copy,
  Check,
  Clock,
  AlertCircle,
  QrCode,
  ExternalLink,
  CreditCard,
  Layers,
  ChevronRight
} from 'lucide-react';

interface InvoiceTabProps {
  onNavigateToTab?: (tab: string) => void;
}

export const InvoiceTab: React.FC<InvoiceTabProps> = ({ onNavigateToTab }) => {
  const [copiedBank, setCopiedBank] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  const invoiceUrl = 'https://primeprojectx.net/invoice?tab=invoices';

  useEffect(() => {
    QRCode.toDataURL(invoiceUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: '#18345E',
        light: '#FFFFFF'
      }
    }).then(url => setQrCodeUrl(url)).catch(err => console.error(err));
  }, [invoiceUrl]);

  const handleCopyBank = () => {
    navigator.clipboard.writeText('BCA - Galih Primananda / PT Prime Infinity Systems');
    setCopiedBank(true);
    setTimeout(() => setCopiedBank(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs no-print">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-[#18345E] rounded-lg border border-blue-100">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
              INVOICE RESMI
              <span className="px-2 py-0.5 text-[10px] uppercase font-black tracking-wider bg-amber-50 text-amber-700 border border-amber-200 rounded-md">
                Termin I • 50%
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-mono-code">
              No: INV-008/PIS-DMJ/IX/2026 • Ref: PKS 008/PKS-IT/PIS-DMJ/IX/2026
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab('proposal')}
              className="flex-1 sm:flex-initial px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Lihat Proposal</span>
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold text-white bg-[#18345E] hover:bg-[#283C5A] rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / Simpan PDF</span>
          </button>
        </div>
      </div>

      {/* Main Invoice Card Paper */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 sm:p-10 space-y-8 relative overflow-hidden print:border-none print:shadow-none print:p-0">
        {/* Accent Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#18345E] via-[#283C5A] to-[#FF6B00] no-print" />

        {/* Header: Vendor & Meta */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 pt-2 border-b border-slate-200/80 pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-[#18345E] tracking-tight">
                PT PRIME INFINITY SYSTEMS
              </span>
            </div>
            <p className="text-xs font-bold text-slate-700">Prime ProjectX Enterprise Technologies</p>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
              Industrial Software Architecture, Cloud Infrastructure & Automated Systems<br />
              Surabaya & Sidoarjo, Jawa Timur, Indonesia<br />
              Website: <a href="https://primeprojectx.net" target="_blank" rel="noreferrer" className="text-[#18345E] font-medium hover:underline">primeprojectx.net</a> • Email: <span className="text-slate-700 font-mono-code">galih@primeprojectx.net</span>
            </p>
          </div>

          <div className="text-left md:text-right space-y-1 w-full md:w-auto">
            <span className="inline-block px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full text-xs font-bold uppercase tracking-wider mb-1">
              Menunggu Pembayaran
            </span>
            <h2 className="text-2xl font-black text-[#18345E] font-mono-code tracking-tight">
              INV-008/PIS-DMJ/IX/2026
            </h2>
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Tanggal Terbit:</span> 18 September 2026
            </p>
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Jatuh Tempo:</span> 7 Hari Kerja sejak Penyerahan BAP-50
            </p>
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Ref. Kontrak:</span> PKS 008/PKS-IT/PIS-DMJ/IX/2026
            </p>
          </div>
        </div>

        {/* Billed To Box */}
        <div className="p-5 bg-slate-50/80 rounded-xl border-l-4 border-l-[#18345E] border border-slate-200/70 flex flex-col sm:flex-row justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Ditujukan Kepada (Billed To):
            </p>
            <h3 className="text-base font-bold text-slate-900">
              PT DWI MARTHA JAYA (PT DMJ)
            </h3>
            <p className="text-xs text-slate-600">
              Integrated Design & Construction Solutions • Kantor & Workshop Jawa Timur
            </p>
            <p className="text-xs text-slate-500">
              Up: Direksi, Manajemen & HR Manager PT Dwi Martha Jaya
            </p>
          </div>
          <div className="text-left sm:text-right self-end sm:self-center">
            <span className="text-xs font-mono-code text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Paket Komplit Full Suite (Rp 5.500.000)
            </span>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#18345E] text-white">
                <th className="py-3 px-4 font-bold text-center w-12">No</th>
                <th className="py-3 px-4 font-bold">Deskripsi Item & Ruang Lingkup Milestone</th>
                <th className="py-3 px-4 font-bold text-center w-28">Tahap</th>
                <th className="py-3 px-4 font-bold text-right w-40">Nominal (IDR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="hover:bg-slate-50/60 transition-colors">
                <td className="py-4 px-4 text-center font-bold text-slate-700 align-top">01</td>
                <td className="py-4 px-4 align-top space-y-2">
                  <div>
                    <span className="text-sm font-bold text-[#18345E]">
                      Pembayaran Termin I (Milestone Progress 50%)
                    </span>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Pengadaan & Implementasi Sistem Prime HRIS Enterprise Paket Komplit Full Suite
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 text-[11px] text-slate-600 space-y-1">
                    <p className="font-bold text-slate-700">Capaian Milestone Terverifikasi (Sesuai Pasal 2 Ayat 2 PKS):</p>
                    <ul className="space-y-0.5 list-disc list-inside text-slate-600">
                      <li>Terselesaikannya modul presensi biometrik selfie & geotag watermark GPS native (anti-fake GPS).</li>
                      <li>Live demonstration fungsionalitas sistem pada server cloud staging: <code className="text-[#18345E] font-bold">https://dmj.primeprojectx.net</code></li>
                      <li>Verifikasi administratif & penandatanganan Berita Acara Progress 50% (BAP-50).</li>
                    </ul>
                  </div>
                </td>
                <td className="py-4 px-4 text-center align-top font-bold text-slate-700">
                  Termin I<br />
                  <span className="text-[10px] text-slate-500 font-normal">(50% Kontrak)</span>
                </td>
                <td className="py-4 px-4 text-right align-top font-mono-code text-sm font-bold text-slate-900">
                  Rp 2.750.000,-
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary & Terbilang */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
          <div className="space-y-2 flex-1">
            <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 text-xs space-y-1">
              <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">Terbilang Total:</span>
              <p className="font-semibold text-blue-950 italic text-sm">
                "Dua Juta Tujuh Ratus Lima Puluh Ribu Rupiah"
              </p>
            </div>
          </div>

          <div className="w-full sm:w-80 space-y-2">
            <div className="flex justify-between text-xs text-slate-600 py-1">
              <span>Subtotal Termin I:</span>
              <span className="font-mono-code font-semibold">Rp 2.750.000,-</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600 py-1 border-b border-slate-200 pb-2">
              <span>Pajak PPh/PPN (Netto):</span>
              <span className="font-mono-code text-slate-500">Rp 0,-</span>
            </div>
            <div className="flex justify-between items-center text-sm py-2 px-3 bg-[#F4F6F9] rounded-lg border border-slate-200">
              <span className="font-bold text-[#18345E]">TOTAL TAGIHAN:</span>
              <span className="font-black text-base text-[#FF6B00] font-mono-code">
                Rp 2.750.000,-
              </span>
            </div>
          </div>
        </div>

        {/* Payment Details & Terms Two-Column */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
          {/* Bank Instructions */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#18345E] uppercase tracking-wider">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>Instruksi Transfer Bank</span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Bank Tujuan:</span>
                <span className="font-bold text-slate-900">BCA (Bank Central Asia)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Atas Nama:</span>
                <span className="font-semibold">Galih Primananda / PT Prime Infinity Systems</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Berita Transfer:</span>
                <span className="font-mono-code font-bold text-[#18345E]">INV-008 DMJ - Termin 1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Konfirmasi Email:</span>
                <span className="font-mono-code text-slate-700">galih@primeprojectx.net</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 text-amber-800">
                <span className="font-semibold">Jatuh Tempo:</span>
                <span className="font-bold">7 Hari Kerja pasca BAP-50</span>
              </div>
            </div>

            <button
              onClick={handleCopyBank}
              className="w-full py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedBank ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedBank ? 'Tersalin ke Clipboard' : 'Salin Detail Rekening'}</span>
            </button>
          </div>

          {/* Contract Notes */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2 text-xs font-bold text-[#18345E] uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Klausul Terkait (PKS No. 008)</span>
            </div>
            <ul className="space-y-1 text-[11px] list-disc list-inside leading-relaxed text-slate-600">
              <li><strong className="text-slate-700">Termin II (Pelunasan 50% / Rp 2.750.000):</strong> Ditagihkan pasca UAT (maks. 7 hari), 1x pelatihan offline on-site di kantor PT DMJ, serah terima .exe, & BAST.</li>
              <li><strong className="text-slate-700">Cloud Running Apps:</strong> Rp 35.000,-/bln (shared server 50–100 user, 1GB storage + 10GB backup) aktif bulan ke-2 pasca Go-Live.</li>
              <li><strong className="text-slate-700">Add-On Modular:</strong> Mulai Rp 100.000,- s/d Rp 1.500.000,- per modul (Addendum PKS).</li>
              <li><strong className="text-slate-700">Garansi 12 Bulan:</strong> Khusus bug fixing tanpa tuntutan ganti rugi finansial (zero liability).</li>
            </ul>
          </div>
        </div>

        {/* Bottom Sign & QR Code Authentication */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-200 items-center">
          {/* Left: QR Verification */}
          <div className="flex items-center gap-4 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="Invoice QR" className="w-20 h-20 rounded-lg border border-slate-200 bg-white p-1 shrink-0" />
            ) : (
              <div className="w-20 h-20 bg-slate-200 rounded-lg animate-pulse shrink-0" />
            )}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-black tracking-wider text-[#18345E] bg-blue-50 px-2 py-0.5 rounded border border-blue-100 inline-block">
                Verifikasi Digital
              </span>
              <p className="text-xs font-bold text-slate-800">Scan Validasi Tagihan</p>
              <p className="text-[10px] text-slate-500 font-mono-code">
                primeprojectx.net/invoice?tab=invoices
              </p>
            </div>
          </div>

          {/* Right: Signature */}
          <div className="text-center sm:text-right space-y-1">
            <p className="text-xs text-slate-500">Surabaya, 18 September 2026</p>
            <p className="text-xs font-bold text-[#18345E]">PT PRIME INFINITY SYSTEMS</p>
            <div className="h-14 flex items-center justify-center sm:justify-end">
              <span className="text-[10px] text-slate-400 font-mono-code italic border-b border-dashed border-slate-300 px-8 pb-1">
                (Otorisasi Digital Terverifikasi)
              </span>
            </div>
            <p className="text-xs font-bold text-slate-900">GALIH PRIMANANDA, S.E.</p>
            <p className="text-[11px] text-slate-500">Director & Lead Platform Architect</p>
          </div>
        </div>
      </div>
    </div>
  );
};
