import subprocess
import json

phone = "6289524257778"
vps_file_path = "/home/Prime-Projectx/Laporan_Analisis_Biometrik_Wajah_HRIS_POCO.pdf"
file_name = "Laporan_Analisis_Biometrik_Wajah_HRIS_POCO.pdf"

caption = """[PRIME PROJECTX // UPDATE RESOLUSI BIOMETRIK USER WILDAN]
Yth. Mr Prime,

Laporan PDF Biometrik HRIS telah diperbarui secara resmi (Bab 6: Tabel Telemetri Master Aktif kini telah mencakup user Wildan Ramdani Ahmad / EMP-161).

🔍 Penjelasan Detail Investigasi:
1. Penyebab di Tabel Laporan Awal:
   • Laporan versi sebelumnya adalah snapshot per 19 Oktober 2026.
   • User Wildan baru menyelesaikan registrasi 4 pose hari ini (21 Okt 2026 pukul 07:44 WIB, Kualitas: 98.5%). Di database SQLite POCO, data wajah Wildan sebenarnya sudah 100% tersimpan aman.

2. Penyebab Kamera 'Seperti Tidak Mendeteksi' Saat Login:
   • Pada LoginPage peramban, galeri biometrik di-cache dalam memori klien dan sebelumnya hanya dimuat saat halaman pertama kali dibuka (hanya memuat 4 karyawan lama).
   • Saat berpindah ke mode Face ID, peramban tidak me-refresh daftar galeri, sehingga wajah Wildan belum ada di memori pencocokan sesi tersebut.

🛠️ Perbaikan yang Telah Aktif di Server POCO:
• Auto-Refresh Galeri Klien: Setiap kali mode Face ID dibuka, sistem otomatis menarik pembaruan galeri terkini di latar belakang.
• Status Telemetri Live: Ditambahkan indikator 'Biometrik: 5 Terdaftar' di atas kotak kamera.
• Live Deploy POCO: Build produksi terbaru telah aktif di https://hris.primeprojectx.net.

Dokumen PDF pembaruan resmi terlampir."""

ssh_cmd = [
    "ssh",
    "-i", r"C:\Users\PRIMA\.ssh\primeprojectx16.pem",
    "Prime-Projectx@103.31.205.218",
    f"python3 /home/Prime-Projectx/scripts/send_wa.py {phone} {vps_file_path} {file_name}"
]

print(f"Dispatching updated PDF to WA {phone} via VPS...")
proc = subprocess.Popen(ssh_cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8')
stdout, stderr = proc.communicate(input=caption)

print("STDOUT:", stdout)
print("STDERR:", stderr)
