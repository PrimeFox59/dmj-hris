# DMJ HRIS Enterprise — PT Dwi Martha Jaya
### Attendance, Project Payroll & Workforce Management Platform

A modern, high-precision Enterprise Human Resource Information System (HRIS) custom-tailored for **PT Dwi Martha Jaya**. Built by **PT Prime Infinity Systems (Prime ProjectX)**.

---

## 🚀 Key Modules & Capabilities

1. **Native Satellite GPS & Geotagged Camera Selfie Attendance:**
   - Geofence radius validation against PT DMJ office/workshop coordinates using spherical Haversine formula.
   - Dual ISP network gateway identification and physical satellite GPS chip tracking.
   - Zero-distortion `drawCover` camera capture with anti-cheat live timestamp and geotag watermarks.
   - Zero-Trust Multi-Site Geofence tracking with instant geocoding and tamper-proof audit trails.

2. **Automated Depnaker Payroll & Project Cost Allocation:**
   - Real-time gross salary, overtime calculation according to Indonesian Ministry of Manpower (Depnaker) official regulations.
   - Automated BPJS Ketenagakerjaan (JHT, JP) and BPJS Kesehatan statutory deductions.
   - Project hour logs and labor expense tracking per client project.
   - Official cryptographic QR Code-certified digital payslips (Slip Gaji Digital).

3. **Integrated Approvals & Notification Center:**
   - Unified approval hub for Annual Leave (Cuti Tahunan), Sick Leaves (Sakit), Permits (Izin), and Overtime.
   - Multi-role permission architecture: Management/Director, HR & General Affairs, Finance, Project Supervisor, and Staff.

4. **Commercial Proposal & Cost Simulator:**
   - Transparent pricing model: Cloud Deployment (Rp 25.000/month standard + Rp 20.000/month WhatsApp bot) vs Offline On-Premise Source Code license (Rp 200.000 one-time).
   - Corporate Custom Domain options (`DMJhris.com`).
   - High-fidelity executive 3-page A4 print/PDF engine with dark-mode preservation and anti-slice protection.
   - Scannable digital authenticity verification QR Code.

---

## 🛠️ Technology Stack

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS, Lucide Icons, Canvas API, QRCode.
- **Backend:** Node.js, Express, SQLite (`better-sqlite3` with WAL mode).
- **Deployment & Infra:** PM2 Process Manager, POCO Edge Node, Cloudflare Edge Tunnels with SSL.

---

## 📦 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Development Mode
```bash
# Start backend API (Port 3028)
node server/index.js

# Start frontend dev server
npm run dev
```

### 3. Production Build
```bash
npm run build
```

---

## 📄 License & Attribution

Designed & Architected by **Galih Primananda, S.E.**  
**PT PRIME INFINITY SYSTEMS**  
Ecosystem: [primeprojectx.net](https://primeprojectx.net)
