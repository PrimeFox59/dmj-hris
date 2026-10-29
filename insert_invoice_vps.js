const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const adapter = new PrismaBetterSqlite3({ url: '/home/Prime-Projectx/invoice/prisma/dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== MEMULAI PEMBUATAN INVOICE PT DWI MARTHA JAYA (PT DMJ) ===');

  const invoiceNumber = 'INV-008/PIS-DMJ/IX/2026';
  const clientName = 'PT DWI MARTHA JAYA (PT DMJ)';
  const clientEmail = 'direksi@dwimarthajaya.com';
  const clientAddress = 'Jawa Timur, Indonesia';
  const projectName = 'Pengembangan & Implementasi Sistem Prime HRIS Enterprise (Paket Komplit Full Suite)';

  // Check if invoice already exists
  const existing = await prisma.invoice.findUnique({
    where: { invoiceNumber }
  });

  const items = [
    {
      id: 1,
      desc: 'Pembayaran Termin I (Milestone Progress 50%) — Pengadaan & Implementasi Sistem Informasi SDM Terpadu (Prime HRIS Enterprise - Paket Komplit Full Suite). Capaian: Modul Presensi Biometrik Selfie Geotag GPS Satelit Native (Anti-Fake), Live Demo Staging dmj.primeprojectx.net, dan Verifikasi BAP-50. Sesuai PKS No. 008/PKS-IT/PIS-DMJ/IX/2026.',
      qty: 1,
      price: 2750000
    }
  ];

  const subtotal = 2750000;
  const tax = 0;
  const total = 2750000;
  const issueDate = new Date('2026-09-18T00:00:00.000Z');
  
  // Due date: 7 hari kerja sejak penerbitan BAP-50 (25 September 2026)
  const dueDate = new Date('2026-09-25T23:59:59.000Z');

  const paymentNotes = 'Ref PKS: 008/PKS-IT/PIS-DMJ/IX/2026. Termin II (Pelunasan 50% / Rp 2.750.000) ditagihkan setelah seluruh sistem selesai 100%, masa UAT (maksimal 7 hari kerja), 1x sesi pelatihan full team secara offline on-site di kantor/workshop PT DMJ, penyerahan paket aplikasi portable offline (.exe), dan penandatanganan BAST. Biaya cloud running apps shared server Rp 35.000/bulan aktif bulan ke-2. Add-on mulai Rp 100.000 s/d Rp 1.500.000. Garansi 12 bulan bug fixing only (zero financial liability).';

  let invoice;
  if (existing) {
    console.log(`Invoice ${invoiceNumber} sudah ada (ID: ${existing.id}), melakukan pembaruan...`);
    invoice = await prisma.invoice.update({
      where: { id: existing.id },
      data: {
        clientName,
        clientPhone: null, // Strictly no WhatsApp number
        clientEmail,
        clientAddress,
        projectName,
        issueDate,
        dueDate,
        items: JSON.stringify(items),
        subtotal,
        tax,
        total,
        isPaid: false,
        paymentMethod: 'BCA Transfer (3251311097 a/n Galih Primananda)',
        paymentNotes
      }
    });
  } else {
    console.log(`Membuat invoice baru: ${invoiceNumber}...`);
    invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        clientName,
        clientPhone: null, // Strictly no WhatsApp number
        clientEmail,
        clientAddress,
        projectName,
        issueDate,
        dueDate,
        items: JSON.stringify(items),
        subtotal,
        tax,
        total,
        isPaid: false,
        paymentMethod: 'BCA Transfer (3251311097 a/n Galih Primananda)',
        paymentNotes
      }
    });
  }

  console.log('✅ INVOICE BERHASIL DIBUAT/DIPERBARUI DI VPS:');
  console.log({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    total: invoice.total,
    isPaid: invoice.isPaid,
    dueDate: invoice.dueDate,
    url: `https://primeprojectx.net/invoice/${invoice.id}`
  });

  // Hubungkan atau Buat Project di Module Projects
  let project = await prisma.project.findFirst({
    where: { name: 'Prime HRIS Enterprise - PT Dwi Martha Jaya' }
  });

  if (!project) {
    console.log('Membuat Project terkait di database...');
    project = await prisma.project.create({
      data: {
        name: 'Prime HRIS Enterprise - PT Dwi Martha Jaya',
        clientName,
        description: 'Pengembangan & Implementasi Sistem Prime HRIS Enterprise Paket Komplit Full Suite (11 Modul, Cloud Staging & Offline .exe Mandiri). Nilai Kontrak Rp 5.500.000,-.',
        status: 'IN_PROGRESS',
        invoiceId: invoice.id
      }
    });

    // Buat milestone tasks
    const tasks = [
      {
        title: 'Minggu 1: Setup database SQLite WAL, pemetaan divisi PT DMJ, integrasi data NIK & registrasi SSID WiFi',
        status: 'DONE',
        priority: 'HIGH',
        order: 1
      },
      {
        title: 'Minggu 2: Deployment modul presensi biometrik selfie geotag satelit & live demo staging cloud (Milestone 50% / Termin I)',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        order: 2
      },
      {
        title: 'Minggu 3: Implementasi portal approval berjenjang, engine payroll Depnaker 1/173, potongan BPJS & slip gaji QR Code',
        status: 'TODO',
        priority: 'HIGH',
        order: 3
      },
      {
        title: 'Minggu 4: Alokasi upah berbasis proyek (Project Cost Accounting), simulasi anggaran EAC & User Acceptance Test (UAT 7 hari)',
        status: 'TODO',
        priority: 'HIGH',
        order: 4
      },
      {
        title: 'Minggu 5: Pelatihan 1x full team offline on-site di kantor PT DMJ, penyerahan portable offline .exe, penandatanganan BAST & Go-Live',
        status: 'TODO',
        priority: 'URGENT',
        order: 5
      }
    ];

    for (const t of tasks) {
      await prisma.projectTask.create({
        data: {
          title: t.title,
          status: t.status,
          priority: t.priority,
          order: t.order,
          projectId: project.id,
          invoiceId: invoice.id
        }
      });
    }
    console.log('✅ Project & 5 Milestone Tasks berhasil dibuat.');
  } else {
    await prisma.project.update({
      where: { id: project.id },
      data: { invoiceId: invoice.id }
    });
    console.log(`✅ Project ${project.name} diperbarui dengan invoiceId: ${invoice.id}`);
  }

  console.log('=== SELESAI PROSES PEMBUATAN INVOICE ===');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Terjadi kesalahan:', err);
  process.exit(1);
});
