import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, CheckCircle2, Share2, PlusSquare } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if already installed & running in standalone native mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Check if iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 3. Check dismissal memory (suppress if dismissed within last 24 hours)
    const dismissedAt = localStorage.getItem('prime_pwa_prompt_dismissed');
    if (dismissedAt) {
      const hoursAgo = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60);
      if (hoursAgo < 24) {
        return;
      }
    }

    // 4. Capture native Android beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // 5. Handle app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
      console.log('[PWA] DMJ HRIS berhasil diinstal sebagai aplikasi native!');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // If on iOS and not standalone, show prompt after brief delay
    if (isIosDevice && !isStandalone) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) {
      alert('Untuk menginstal di browser ini, silakan ketuk menu titik tiga (⋮) di pojok browser dan pilih "Tambahkan ke Layar Utama" / "Install Aplikasi".');
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsVisible(false);
        setDeferredPrompt(null);
      }
    } catch (err) {
      console.warn('PWA install error:', err);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('prime_pwa_prompt_dismissed', Date.now().toString());
  };

  if (isInstalled || !isVisible) {
    return null;
  }

  return (
    <>
      {/* Floating Bottom PWA Banner */}
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300">
        <div className="bg-slate-900/95 backdrop-blur-xl border border-orange-500/40 rounded-2xl p-4 shadow-2xl shadow-orange-500/10 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FF6B00] to-amber-500 p-0.5 shrink-0 flex items-center justify-center shadow-md shadow-orange-500/30">
              <img
                src="/icons/icon-96x96.png"
                alt="DMJ HRIS Icon"
                className="w-full h-full object-cover rounded-[10px]"
                onError={(e) => {
                  // Fallback icon if image not yet loaded
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black tracking-wide text-white font-mono-code">
                  DMJ HRIS
                </span>
                <span className="text-[9.5px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 font-bold rounded border border-emerald-500/30">
                  PWA Ready
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-tight">
                Pakai aplikasi layaknya Native Android tanpa bilah browser.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FF6B00] to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs shadow-md shadow-orange-500/30 cursor-pointer flex items-center gap-1.5 transition-transform active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Tutup pemberitahuan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Install Instructions Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-orange-400" />
                <h3 className="font-bold text-sm">Pasang di iPhone / iPad</h3>
              </div>
              <button onClick={() => setShowIosGuide(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <ol className="text-xs text-slate-300 space-y-3 font-medium">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                  1
                </span>
                <span>
                  Buka halaman ini di browser <strong>Safari</strong> iPhone.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                  2
                </span>
                <span>
                  Ketuk tombol <strong>Bagikan</strong> (ikon kotak dengan panah atas <Share2 className="w-3.5 h-3.5 inline text-blue-400" />) di bilah bawah.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                  3
                </span>
                <span>
                  Gulir ke bawah dan ketuk <strong>"Tambah ke Layar Utama"</strong> (Add to Home Screen <PlusSquare className="w-3.5 h-3.5 inline text-slate-300" />).
                </span>
              </li>
            </ol>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-xs text-white cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};

