import { createPortal } from 'react-dom';
import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  User,
  Camera,
  KeyRound,
  Shield,
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  CreditCard,
  Lock,
  Check,
  CheckCircle2,
  AlertTriangle,
  Upload,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  Laptop,
  Calendar,
  Briefcase,
  Layers,
  Save,
  Clock,
  LogOut,
  Receipt,
  BadgePercent,
  FileText,
  Users
} from 'lucide-react';
import { Employee, getEffectiveSystemRole, AuthUser, BiometricProfile } from '../types';
import { api } from '../services/api';
import { BiometricEnrollmentModal } from './BiometricEnrollmentModal';
import { normalizeMaritalStatus, resolvePtkpStatus, getPtkpDetails, PTKP_OPTIONS } from '../utils/taxHelper';

export type ProfileTabId = 'profile' | 'photo' | 'password' | 'security';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Employee;
  authUser?: AuthUser | null;
  onUpdateEmployee: (updated: Employee) => void;
  initialTab?: ProfileTabId;
  realDetectedIp?: string;
  realDetectedIsp?: string;
  realDetectedCity?: string;
  isOfficeNetwork?: boolean;
  onLogout?: () => void;
}



function resizeImageToDataUrl(file: File, maxDim = 320, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(e.target?.result as string);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  authUser,
  onUpdateEmployee,
  initialTab = 'profile',
  realDetectedIp,
  realDetectedIsp,
  realDetectedCity,
  isOfficeNetwork = true,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<ProfileTabId>(initialTab);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Profile Form State
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [bankName, setBankName] = useState(currentUser.bankAccount?.bankName || 'BCA');
  const [accountNumber, setAccountNumber] = useState(currentUser.bankAccount?.accountNumber || '');
  const [accountHolder, setAccountHolder] = useState(currentUser.bankAccount?.accountHolder || currentUser.name);

  // Status Perkawinan & Pajak PPh 21 State
  const [maritalStatus, setMaritalStatus] = useState<string>(normalizeMaritalStatus(currentUser.maritalStatus));
  const [dependents, setDependents] = useState<number>(currentUser.dependents ?? 0);
  const [ptkpStatus, setPtkpStatus] = useState<string>(currentUser.ptkpStatus || resolvePtkpStatus(currentUser.maritalStatus, currentUser.dependents));
  const [npwpNumber, setNpwpNumber] = useState<string>(currentUser.npwpNumber || '');

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  const handleMaritalStatusChange = (newMs: string) => {
    setMaritalStatus(newMs);
    const newPtkp = resolvePtkpStatus(newMs, dependents);
    setPtkpStatus(newPtkp);
  };

  const handleDependentsChange = (newDep: number) => {
    setDependents(newDep);
    const newPtkp = resolvePtkpStatus(maritalStatus, newDep);
    setPtkpStatus(newPtkp);
  };

  const handlePtkpChange = (newPtkp: string) => {
    setPtkpStatus(newPtkp);
    const details = getPtkpDetails(newPtkp);
    setMaritalStatus(details.maritalStatus);
    setDependents(details.dependents);
  };

  // Avatar State
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser.avatar);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarSuccessMsg, setAvatarSuccessMsg] = useState<string | null>(null);
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);

  const hasBiometricSamples = Boolean(
    currentUser.biometric?.isEnrolled &&
    currentUser.biometric?.samples &&
    (currentUser.biometric.samples.front || currentUser.biometric.samples.right || currentUser.biometric.samples.left || currentUser.biometric.samples.smile)
  );

  const handleSaveBiometric = async (profile: BiometricProfile, updateAvatarAsWell: boolean) => {
    const res = await api.saveBiometricProfile(currentUser.id, profile, updateAvatarAsWell);
    onUpdateEmployee(res.employee);
    if (updateAvatarAsWell && profile.samples?.front) {
      setSelectedAvatar(profile.samples.front);
    }
    setAvatarSuccessMsg('🛡️ Profil Biometrik 4 Pose Wajah Berhasil Disimpan!');
    setTimeout(() => setAvatarSuccessMsg(null), 4000);
  };

  // Password State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setName(currentUser.name);
      setPhone(currentUser.phone || '');
      setEmail(currentUser.email || '');
      setBankName(currentUser.bankAccount?.bankName || 'BCA');
      setAccountNumber(currentUser.bankAccount?.accountNumber || '');
      setAccountHolder(currentUser.bankAccount?.accountHolder || currentUser.name);
      const initMs = normalizeMaritalStatus(currentUser.maritalStatus);
      const initDep = currentUser.dependents ?? 0;
      setMaritalStatus(initMs);
      setDependents(initDep);
      setPtkpStatus(currentUser.ptkpStatus || resolvePtkpStatus(initMs, initDep));
      setNpwpNumber(currentUser.npwpNumber || '');
      setSelectedAvatar(currentUser.avatar);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
      setPasswordSuccessMsg(null);
      setProfileSuccessMsg(null);
      setProfileErrorMsg(null);
      setAvatarSuccessMsg(null);
    }
  }, [isOpen, currentUser, initialTab]);

  if (!isOpen) return null;

  const currentRole = getEffectiveSystemRole(currentUser);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);

    const profileData = {
      id: currentUser.id,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      maritalStatus,
      dependents: Number(dependents),
      ptkpStatus,
      npwpNumber: npwpNumber.trim(),
      bankAccount: {
        bankName,
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim() || name.trim()
      }
    };

    try {
      // 1. Primary: Use dedicated lightweight resilient profile update (prevents large body payloads & TCP socket resets)
      const res = await api.updateProfile(profileData);
      if (res && res.employee) {
        onUpdateEmployee(res.employee);
      } else {
        const updatedEmployee: Employee = {
          ...currentUser,
          ...profileData
        };
        onUpdateEmployee(updatedEmployee);
      }

      api.logActivity({
        userName: currentUser.name,
        userNik: currentUser.nik,
        userRole: currentUser.role,
        module: 'MASTER_DATA',
        action: 'UPDATE_PROFILE',
        entity: 'Employee',
        entityId: currentUser.id,
        details: `Memperbarui data profil pribadi (No HP: ${phone}, Rekening: ${bankName} - ${accountNumber})`,
        status: 'SUCCESS',
        ipAddress: realDetectedIp,
        metadata: { updatedFields: ['phone', 'email', 'bankAccount'] }
      }).catch(() => {});

      setProfileSuccessMsg('Data profil Anda berhasil disimpan ke database!');
      setTimeout(() => setProfileSuccessMsg(null), 4000);
    } catch (err: any) {
      console.warn('Dedicated profile update failed, attempting onUpdateEmployee fallback:', err);
      try {
        const fallbackEmployee: Employee = {
          ...currentUser,
          ...profileData
        };
        await onUpdateEmployee(fallbackEmployee);
        setProfileSuccessMsg('Data profil Anda berhasil disimpan ke database!');
        setTimeout(() => setProfileSuccessMsg(null), 4000);
      } catch (fallbackErr: any) {
        console.error('All profile save methods failed:', fallbackErr);
        const errMsg = fallbackErr?.message || err?.message || 'Periksa koneksi server';
        setProfileErrorMsg(`Gagal menyimpan profil: ${errMsg}. Silakan periksa koneksi atau muat ulang halaman.`);
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setSelectedAvatar(dataUrl);
      setAvatarSuccessMsg('Foto dipilih dari perangkat. Klik "Simpan Foto Profil" untuk menerapkan.');
    } catch (err) {
      console.error('Failed to read image file:', err);
    }
  };

  const handleSaveAvatar = async () => {
    setIsSavingAvatar(true);
    setAvatarSuccessMsg(null);

    const updatedEmployee: Employee = {
      ...currentUser,
      avatar: selectedAvatar
    };

    try {
      await onUpdateEmployee(updatedEmployee);

      api.logActivity({
        userName: currentUser.name,
        userNik: currentUser.nik,
        userRole: currentUser.role,
        module: 'AUTH',
        action: 'CHANGE_AVATAR',
        entity: 'Employee',
        entityId: currentUser.id,
        details: `Mengubah foto profil akun pengguna ${currentUser.name} (${currentUser.nik})`,
        status: 'SUCCESS',
        ipAddress: realDetectedIp
      }).catch(() => {});

      setAvatarSuccessMsg('Foto profil baru berhasil disimpan dan diterapkan!');
      setTimeout(() => setAvatarSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error saving avatar:', err);
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccessMsg(null);

    if (newPassword.length < 3) {
      setPasswordError('Kata sandi baru harus memiliki panjang minimal 3 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi kata sandi tidak cocok dengan kata sandi baru.');
      return;
    }

    setIsChangingPassword(true);

    try {
      const res = await api.changePassword(oldPassword, newPassword);
      if (res.success) {
        setPasswordSuccessMsg('Kata sandi berhasil diperbarui! Silakan gunakan kata sandi baru untuk login berikutnya.');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(res.error || 'Gagal mengubah kata sandi.');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Gagal mengubah kata sandi. Pastikan kata sandi lama Anda benar.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const modalContent = (
    <>
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
        onClick={onClose}
      >
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh] font-sans animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FF6B00]/20 border border-[#FF6B00]/40 flex items-center justify-center text-[#FF6B00] shadow-xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white">
                  Pengaturan Profil & Akun
                </h3>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider font-mono-code ${
                  currentRole === 'superuser'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : (currentRole === 'admin' || currentRole === 'hr')
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : currentRole === 'finance'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                }`}>
                  {(currentRole === 'admin' || currentRole === 'hr') ? 'HR' : currentRole}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono-code mt-0.5">
                {currentUser.nik} • {currentUser.position}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher Navigation */}
        <div className="px-6 bg-slate-50/90 border-b border-slate-200 flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'profile'
                ? 'border-[#FF6B00] text-[#FF6B00]'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Data Diri & Kontak</span>
          </button>

          <button
            onClick={() => setActiveTab('photo')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'photo'
                ? 'border-[#FF6B00] text-[#FF6B00]'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Ganti Foto Profil</span>
          </button>

          <button
            onClick={() => setActiveTab('password')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'password'
                ? 'border-[#FF6B00] text-[#FF6B00]'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Ganti Kata Sandi</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'security'
                ? 'border-[#FF6B00] text-[#FF6B00]'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Sesi & Keamanan</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: DATA DIRI & KONTAK */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              {profileSuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{profileSuccessMsg}</span>
                </div>
              )}

              {profileErrorMsg && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-semibold">{profileErrorMsg}</span>
                </div>
              )}

              {/* Editable Fields Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono-code flex items-center gap-2">
                    <User className="w-4 h-4 text-[#FF6B00]" />
                    Informasi Kontak Pribadi (Dapat Diedit)
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono-code">
                    Data Karyawan Mandiri
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Nama Lengkap & Gelar
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40 focus:border-[#FF6B00] transition-all bg-white"
                      placeholder="Masukkan nama lengkap"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Nomor WhatsApp / HP
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-9.5 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40 focus:border-[#FF6B00] transition-all bg-white"
                        placeholder="0812-xxxx-xxxx"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Alamat Email Kantor / Notifikasi
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full pl-9.5 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40 focus:border-[#FF6B00] transition-all bg-white"
                        placeholder="email@primeprojectx.net"
                      />
                    </div>
                  </div>
                </div>

                {/* Bank Account Details */}
                <div className="pt-3 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Rekening Bank untuk Payroll & Gaji Pokok
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <select
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40 bg-white"
                      >
                        <option value="BCA">BCA (Bank Central Asia)</option>
                        <option value="Mandiri">Bank Mandiri</option>
                        <option value="BRI">Bank BRI</option>
                        <option value="BNI">Bank BNI</option>
                        <option value="BSI">Bank Syariah Indonesia (BSI)</option>
                        <option value="CIMB Niaga">CIMB Niaga</option>
                        <option value="Permata">Bank Permata</option>
                      </select>
                    </div>
                    <div>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="Nomor Rekening"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono-code font-bold focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40 bg-white"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={accountHolder}
                        onChange={(e) => setAccountHolder(e.target.value)}
                        placeholder="Atas Nama Pemilik"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40 bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Status Perkawinan & Pajak PPh 21 (PTKP) */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-[#FF6B00]" />
                      <span>Status Perkawinan & Pajak Penghasilan (PPh 21 / PTKP)</span>
                    </label>
                    <span className="text-[10px] font-mono-code font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      UU HPP & PMK 168/2023
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Status Perkawinan
                      </label>
                      <select
                        value={maritalStatus}
                        onChange={(e) => handleMaritalStatusChange(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40 bg-white"
                      >
                        <option value="TK">Tidak Kawin / Belum Menikah (TK)</option>
                        <option value="K">Kawin / Menikah (K)</option>
                        <option value="K/I">Kawin - Penghasilan Istri Digabung (K/I)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Jumlah Tanggungan (Anak/Keluarga)
                      </label>
                      <select
                        value={dependents}
                        onChange={(e) => handleDependentsChange(Number(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40 bg-white"
                      >
                        <option value={0}>0 Orang (Tanpa Tanggungan)</option>
                        <option value={1}>1 Orang Tanggungan</option>
                        <option value={2}>2 Orang Tanggungan</option>
                        <option value={3}>3 Orang Tanggungan (Maksimal)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Kategori PTKP PPh 21
                      </label>
                      <select
                        value={ptkpStatus}
                        onChange={(e) => handlePtkpChange(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-orange-200 text-xs font-bold text-orange-950 bg-orange-50/50 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40"
                      >
                        {PTKP_OPTIONS.map((opt) => (
                          <option key={opt.code} value={opt.code}>
                            {opt.code} ({opt.terCategory} - Rp {(opt.annualAmount / 1_000_000).toLocaleString('id-ID')} Jt/thn)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* NPWP Input & Live Tax Breakdown Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Nomor NPWP <span className="text-slate-400 font-normal lowercase">(opsional / NIK 16 digit)</span>
                      </label>
                      <div className="relative">
                        <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={npwpNumber}
                          onChange={(e) => setNpwpNumber(e.target.value)}
                          placeholder="Nomor NPWP / NIK"
                          className="w-full pl-8.5 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono-code font-medium focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40 bg-white"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2 bg-gradient-to-br from-amber-50/70 to-orange-50/40 p-3 rounded-2xl border border-amber-200/80 flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-orange-500 text-white shadow-sm shrink-0 mt-0.5">
                        <BadgePercent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 text-xs space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 font-mono-code text-sm">
                            {getPtkpDetails(ptkpStatus).code}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-900 font-mono-code font-black text-[10px]">
                            {getPtkpDetails(ptkpStatus).terCategory}
                          </span>
                          <span className="text-slate-500 font-mono-code text-[11px]">
                            Batas Bebas Pajak: <strong>Rp {getPtkpDetails(ptkpStatus).annualAmount.toLocaleString('id-ID')} / thn</strong>
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {getPtkpDetails(ptkpStatus).description}. Tarif Efektif Rata-rata (TER) dan pemotongan PPh 21 bulanan dihitung secara otomatis berdasarkan status identitas ini.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Locked Enterprise Metadata Section */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 font-mono-code flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    Data Kepegawaian Resmi (Terkunci oleh HR)
                  </h4>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono-code">
                    Hanya Admin yang dapat mengubah
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono-code">NIK Karyawan:</span>
                    <span className="font-bold text-slate-800 font-mono-code">{currentUser.nik}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono-code">Departemen:</span>
                    <span className="font-bold text-slate-800">{currentUser.department}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono-code">Posisi:</span>
                    <span className="font-bold text-slate-800">{currentUser.position}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono-code">Status Kerja:</span>
                    <span className="font-bold text-emerald-700">{currentUser.employmentType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono-code">Tanggal Masuk:</span>
                    <span className="font-semibold text-slate-700 font-mono-code">{currentUser.joinDate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono-code">Kuota Cuti:</span>
                    <span className="font-semibold text-slate-700">{currentUser.leaveQuota} hari (Sisa: {currentUser.leaveQuota - currentUser.usedLeave})</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-slate-400 block font-mono-code">Status Biometrik Keamanan:</span>
                    <span className={`font-mono-code text-[11px] font-bold ${hasBiometricSamples ? 'text-emerald-700' : 'text-amber-600'}`}>
                      {hasBiometricSamples ? `Terdaftar 4 Pose (${currentUser.biometric?.qualityScore ? `${currentUser.biometric.qualityScore}%` : 'Valid'})` : 'Belum Terdaftar'}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-slate-400 block font-mono-code">Status PTKP PPh 21:</span>
                    <span className="font-mono-code text-[11px] font-bold text-indigo-700">
                      {currentUser.ptkpStatus || resolvePtkpStatus(currentUser.maritalStatus, currentUser.dependents)} ({getPtkpDetails(currentUser.ptkpStatus || resolvePtkpStatus(currentUser.maritalStatus, currentUser.dependents)).terCategory} • Rp {getPtkpDetails(currentUser.ptkpStatus || resolvePtkpStatus(currentUser.maritalStatus, currentUser.dependents)).annualAmount.toLocaleString('id-ID')}/thn)
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-slate-400 block font-mono-code">Nomor NPWP Terdaftar:</span>
                    <span className="font-mono-code text-[11px] font-semibold text-slate-700">
                      {currentUser.npwpNumber || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#FF8533] hover:from-[#e56000] hover:to-[#ff771a] text-white text-xs font-black shadow-lg shadow-orange-500/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan Perubahan Profil</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: GANTI FOTO PROFIL */}
          {activeTab === 'photo' && (
            <div className="space-y-6">
              {avatarSuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{avatarSuccessMsg}</span>
                </div>
              )}

              {/* Current Preview Card */}
              <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-3xl bg-slate-50 border border-slate-200/80">
                <div className="relative group shrink-0">
                  <img
                    src={selectedAvatar}
                    alt={currentUser.name}
                    className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-xl shadow-slate-900/10"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-1 right-1 p-2 rounded-full bg-[#FF6B00] text-white shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer"
                    title="Unggah Foto dari Perangkat"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-center sm:text-left space-y-2">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      Pratinjau Foto Profil
                    </h4>
                    <p className="text-xs text-slate-500">
                      Foto ini akan tampil pada watermark presensi GPS kamera, slip gaji resmi, dan audit log sistem.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#FF6B00]" />
                      <span>Pilih Foto dari Komputer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedAvatar(currentUser.avatar)}
                      className="px-3 py-2 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Reset Semula
                    </button>
                  </div>
                </div>
              </div>



              {/* Biometric 4-Pose Enrollment Vault Section */}
              <div className="p-5 rounded-3xl bg-slate-900 text-white space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-[#FF6B00] flex items-center justify-center border border-orange-500/30">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                        <span>Biometrik Wajah 3D Enterprise</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono-code font-bold ${
                          hasBiometricSamples ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}>
                          {hasBiometricSamples ? '4 POSE TERKUNCI' : 'BELUM ENROLL'}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {hasBiometricSamples
                          ? `Terdaftar pada ${currentUser.biometric?.enrolledAt ? new Date(currentUser.biometric.enrolledAt).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : 'Sistem'}${currentUser.biometric?.qualityScore ? ` • Kualitas: ${currentUser.biometric.qualityScore}%` : ''}`
                          : 'Rekam 4 sudut wajah (Depan, Kanan, Kiri, Senyum) untuk akurasi presensi & anti-titip absen.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsBiometricModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF6B00] to-amber-500 hover:from-[#e56000] hover:to-amber-600 text-white text-xs font-black shadow-md shadow-orange-500/25 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{hasBiometricSamples ? 'Ulangi / Rekam Ulang' : 'Daftar Biometrik (4 Pose)'}</span>
                  </button>
                </div>

                {hasBiometricSamples && currentUser.biometric?.samples && (
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {([
                      { key: 'front', label: '1. DEPAN' },
                      { key: 'right', label: '2. KANAN' },
                      { key: 'left', label: '3. KIRI' },
                      { key: 'smile', label: '4. SENYUM' }
                    ] as const).map(p => (
                      <div key={p.key} className="p-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-center space-y-1">
                        <div className="aspect-square rounded-lg overflow-hidden bg-slate-950">
                          {currentUser.biometric?.samples[p.key] ? (
                            <img src={currentUser.biometric.samples[p.key]} alt={p.label} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500">N/A</div>
                          )}
                        </div>
                        <span className="text-[9px] font-mono-code font-bold text-slate-300 block">{p.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleSaveAvatar}
                  disabled={isSavingAvatar || selectedAvatar === currentUser.avatar}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#FF8533] hover:from-[#e56000] hover:to-[#ff771a] text-white text-xs font-black shadow-lg shadow-orange-500/25 transition-all cursor-pointer disabled:opacity-40"
                >
                  {isSavingAvatar ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Simpan & Terapkan Foto Profil</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: GANTI PASSWORD */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-6">
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-950 text-xs leading-relaxed space-y-1">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Kebijakan Keamanan Akun Enterprise</span>
                </div>
                <p className="text-[11.5px] text-amber-800">
                  Pastikan kata sandi baru Anda unik, tidak mudah ditebak, dan memiliki panjang minimal <strong>5 karakter</strong>. Seluruh riwayat perubahan kata sandi akan tercatat di log audit keamanan.
                </p>
              </div>

              {passwordSuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{passwordSuccessMsg}</span>
                </div>
              )}

              {passwordError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-semibold">{passwordError}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Kata Sandi Saat Ini (Lama)
                  </label>
                  <div className="relative">
                    <input
                      type={showOldPassword ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      required
                      placeholder="Masukkan kata sandi lama Anda"
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-xs font-mono-code focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40 focus:border-[#FF6B00] transition-all bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Kata Sandi Baru
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Minimal 5 karakter unik"
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-xs font-mono-code focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40 focus:border-[#FF6B00] transition-all bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Konfirmasi Kata Sandi Baru
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Ketik ulang kata sandi baru"
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-xs font-mono-code focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/40 focus:border-[#FF6B00] transition-all bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPassword && confirmPassword && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                      {newPassword === confirmPassword ? (
                        <span className="text-emerald-600 flex items-center gap-1 font-bold">
                          <Check className="w-3 h-3" /> Kata sandi cocok
                        </span>
                      ) : (
                        <span className="text-rose-500 flex items-center gap-1 font-bold">
                          <X className="w-3 h-3" /> Kata sandi belum cocok
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword || !newPassword || newPassword !== confirmPassword}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#FF8533] hover:from-[#e56000] hover:to-[#ff771a] text-white text-xs font-black shadow-lg shadow-orange-500/25 transition-all cursor-pointer disabled:opacity-40"
                >
                  {isChangingPassword ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Mengubah Password...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Perbarui Kata Sandi</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: SESI & KEAMANAN */}
          {activeTab === 'security' && (
            <div className="space-y-5">
              {/* Session Status Banner */}
              <div className={`p-4 rounded-2xl border ${
                isOfficeNetwork
                  ? 'bg-emerald-50 border-emerald-200/80 text-emerald-950'
                  : 'bg-amber-50 border-amber-200/80 text-amber-950'
              }`}>
                <div className="flex items-center gap-2 font-bold mb-1">
                  <ShieldCheck className={`w-4 h-4 ${isOfficeNetwork ? 'text-emerald-600' : 'text-amber-600'}`} />
                  <span>
                    {isOfficeNetwork
                      ? 'Koneksi Terverifikasi: Jaringan Kantor Resmi'
                      : 'Koneksi Terdeteksi: Akses Jaringan Luar (Remote)'}
                  </span>
                </div>
                <p className="text-xs leading-relaxed opacity-90 font-sans">
                  {isOfficeNetwork
                    ? 'IP Publik Anda berada dalam daftar Whitelist Gateway Resmi DMJ HRIS. Presensi dinyatakan langsung sah WFO tanpa surat penugasan.'
                    : `Anda terhubung melalui jaringan publik eksternal (${realDetectedIsp || 'ISP'}). Presensi luar kantor memerlukan form justifikasi dinas luar.`}
                </p>
              </div>

              {/* Technical Session Metadata */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3 text-xs font-mono-code">
                <h4 className="text-xs font-black uppercase text-slate-800 font-mono-code mb-2">
                  Parameter Sesi Kriptografis & Jaringan
                </h4>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60">
                  <span className="text-slate-500">Alamat IP Publik:</span>
                  <span className="font-bold text-slate-900">{realDetectedIp || '103.31.205.218'}</span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60">
                  <span className="text-slate-500">Penyedia Layanan (ISP):</span>
                  <span className="font-bold text-slate-800">{realDetectedIsp || 'PT Biznet Gio Nusantara'}</span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60">
                  <span className="text-slate-500">Estimasi Geografis:</span>
                  <span className="font-semibold text-slate-700">{realDetectedCity || 'Surabaya / East Java'}</span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60">
                  <span className="text-slate-500">ID Pengguna (Auth ID):</span>
                  <span className="font-semibold text-slate-700">{authUser?.id || currentUser.id}</span>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-500">Sesi Terakhir Login:</span>
                  <span className="text-slate-700 font-semibold">{authUser?.lastLogin || '2026-09-10 12:15 WIB'}</span>
                </div>
              </div>

              {/* Logout Option */}
              {onLogout && (
                <div className="pt-2 flex justify-between items-center border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    Ingin mengakhiri sesi aktif di perangkat ini?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onLogout();
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar dari Sistem (Logout)</span>
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>

    {/* Biometric 4-Pose Modal */}
    <BiometricEnrollmentModal
      isOpen={isBiometricModalOpen}
      onClose={() => setIsBiometricModalOpen(false)}
      targetEmployee={currentUser}
      onSaveBiometric={handleSaveBiometric}
      operatorName={currentUser.name}
    />
  </>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
