import subprocess
import os

pdf_local = r"C:\Users\PRIMA\Desktop\Report\PRIME_HRIS_Direktori_Kredensial_User_Default.pdf"
key_path = r"C:\Users\PRIMA\.ssh\primeprojectx16.pem"
remote_user = "Prime-Projectx"
remote_host = "103.31.205.218"
vps_dest = "/home/Prime-Projectx/PRIME_HRIS_Direktori_Kredensial_User_Default.pdf"
file_name = "PRIME_HRIS_Direktori_Kredensial_User_Default.pdf"
phone = "6289524257778"

# 1. SCP PDF to VPS
print(f"[1/2] SCP PDF to Central VPS ({remote_host})...")
scp_cmd = [
    "scp",
    "-i", key_path,
    "-o", "StrictHostKeyChecking=no",
    pdf_local,
    f"{remote_user}@{remote_host}:{vps_dest}"
]
subprocess.run(scp_cmd, check=True)
print("[OK] PDF transferred to VPS.")

# 2. Dispatch via send_wa.py on VPS
caption = """[PRIME PROJECTX // DIREKTORI KREDENSIAL PENGGUNA PRIME HRIS (REVISI)]
Yth. Mr Prime,

Berikut kami kirimkan ulang dokumen resmi "Direktori Resmi Kredensial Pengguna & Login Default" (PRIME HRIS Enterprise — PT Dwi Martha Jaya) setelah diperbaiki sesuai arahan Mr Prime:

📑 Pembaruan Sesuai Arahan:
1. Eliminasi Data Superuser: Seluruh kredensial superuser ('admin' dan 'galih') telah dikeluarkan secara total dari dokumen dan tabel laporan direktori.
2. Purge Akun 'galih': Akun login ID 'galih' telah dihapus permanen dari basis data produksi (POCO Edge Node & lokal). Akun superuser resmi kini tunggal menggunakan 'admin'.
3. Ruang Lingkup Dokumen:
   • Total Akun Karyawan: 153 Akun Staf & Manajemen (d001 s/d d153)
   • Password Default: 'zzz' untuk seluruh staf & manajemen
   • Portal Web: https://hris.primeprojectx.net
   • Host Node: POCO X3 NFC Edge Node (Port 3000 / PM2 ID 7)
   • Multi-Identifier Auth: Mendukung Login ID (d001), NIK KTP/Kantor, atau Email resmi.

4. Kepatuhan Standar Dokumen:
   • Format resmi Prime Projectx: ZERO signature box & ZERO human approver names.
   • Segel Telemetri Kriptografis: PX-SEC SHA-256 terverifikasi.

Dokumen revisi lengkap (PDF 7 Halaman) terlampir resmi."""

print(f"[2/2] Dispatching to WhatsApp {phone} via VPS gateway...")
ssh_cmd = [
    "ssh",
    "-i", key_path,
    "-o", "StrictHostKeyChecking=no",
    f"{remote_user}@{remote_host}",
    f"python3 /home/Prime-Projectx/scripts/send_wa.py {phone} {vps_dest} {file_name}"
]

proc = subprocess.Popen(ssh_cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8')
stdout, stderr = proc.communicate(input=caption)

print("STDOUT:", stdout)
if stderr:
    print("STDERR:", stderr)
