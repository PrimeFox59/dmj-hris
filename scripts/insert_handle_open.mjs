import fs from 'fs';

let code = fs.readFileSync('src/components/PresensiCameraTab.tsx', 'utf8').replace(/\r\n/g, '\n');

const target = `    }
  };

  const startCamera = async (customFacing?: 'user' | 'environment') => {`;

const replacement = `    }
  };

  // Handler 2 Tombol Presensi Eksklusif: Absen Masuk & Absen Pulang
  const handleOpenAttendance = (action: 'CHECK_IN' | 'CHECK_OUT') => {
    handleToggleAttendanceAction(action);
    setCapturedPhoto(null);
    if (mode === 'WFO' && !isWithinAnyAuthorizedGeofence) {
      const assignedName = assignedProject ? assignedProject.name : salaryRules.officeGeofence?.name || 'Kantor Pusat & Innovation Hub';
      const effectiveDistance = assignedProjectDist !== null ? assignedProjectDist : realGeofenceDistance;
      const distStr = effectiveDistance >= 1000 ? \`\${(effectiveDistance / 1000).toFixed(1)} km\` : \`\${effectiveDistance} meter\`;
      setSuccessToast(\`📍 Luar Radius Geofence (\${distStr} dari \${assignedName}). Presensi tetap diproses, butuh approval.\`);
      setTimeout(() => setSuccessToast(null), 5000);
    }
    setIsAttendanceModalOpen(true);
  };

  const startCamera = async (customFacing?: 'user' | 'environment') => {`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/PresensiCameraTab.tsx', code, 'utf8');
  console.log('Successfully inserted handleOpenAttendance!');
} else {
  console.error('Target not found in PresensiCameraTab.tsx');
}
