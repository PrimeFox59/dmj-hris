import React, { useState, useEffect } from 'react';
import { RefreshCw, Sparkles, X, ArrowUpCircle } from 'lucide-react';

export const PwaUpdateToast: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // 1. Check if window.__PRIME_SW_REG__ already has a waiting worker
    const reg = (window as any).__PRIME_SW_REG__ as ServiceWorkerRegistration | undefined;
    if (reg?.waiting) {
      setWaitingWorker(reg.waiting);
      setHasUpdate(true);
    }

    // 2. Listen to custom event dispatched by index.html or Service Worker
    const handleUpdateAvailable = (e: Event) => {
      const customEvent = e as CustomEvent<{ registration?: ServiceWorkerRegistration }>;
      const targetReg = customEvent.detail?.registration || (window as any).__PRIME_SW_REG__;
      if (targetReg?.waiting) {
        setWaitingWorker(targetReg.waiting);
      }
      setHasUpdate(true);
    };

    window.addEventListener('pwa-update-available', handleUpdateAvailable);

    // 3. Fallback: Check if serviceWorker has a waiting worker on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((activeReg) => {
          if (activeReg?.waiting) {
            setWaitingWorker(activeReg.waiting);
            setHasUpdate(true);
          }
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleApplyUpdate = () => {
    setIsUpdating(true);

    // Send SKIP_WAITING to waiting worker if present
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      const reg = (window as any).__PRIME_SW_REG__ as ServiceWorkerRegistration | undefined;
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }

    // Fallback reload after brief delay if controllerchange hasn't fired yet
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  const handleDismiss = () => {
    setHasUpdate(false);
  };

  if (!hasUpdate) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 max-w-[calc(100vw-2rem)] sm:max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300 font-sans no-print">
      <div className="p-4 rounded-2xl shadow-2xl bg-slate-900/95 backdrop-blur-md text-white border border-orange-500/50 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center shrink-0 text-orange-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white tracking-tight">Pembaruan Sistem Tersedia</h4>
                <span className="text-[9px] font-mono font-bold bg-orange-500 text-white px-1.5 py-0.2 rounded uppercase">
                  Live OTA
                </span>
              </div>
              <p className="text-[11.5px] text-slate-300 mt-0.5 leading-snug">
                Versi terbaru PRIME HRIS telah dirilis di server. Muat ulang sekarang untuk menerapkan fitur & perbaikan terbaru.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Tutup pemberitahuan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action button row */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
          <button
            onClick={handleDismiss}
            disabled={isUpdating}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/60 transition cursor-pointer"
          >
            Nanti Saja
          </button>
          <button
            onClick={handleApplyUpdate}
            disabled={isUpdating}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md shadow-orange-500/25 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'Memuat Ulang...' : 'Muat Ulang Sekarang'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
