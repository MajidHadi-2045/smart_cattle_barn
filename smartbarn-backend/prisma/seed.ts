
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Menyiapkan pendaftaran Admin...');

  // 1. Enkripsi Password
  const hashedPassword = await bcrypt.hash('rahasia123', 10);

  // 2. Upsert User Admin (Cek jika sudah ada, jika belum buat baru)
  const admin = await prisma.user.upsert({
    where: { email: 'majid123@example.com' },
    update: {
      name: 'Majid',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      status: 'AKTIF',
    },
    create: {
      id: 'ADM_001',
      name: 'Majid',
      email: 'majid123@example.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      status: 'AKTIF',
    },
  });

  console.log('--- PENDAFTARAN BERHASIL ---');
  console.log(`Email: ${admin.email}`);
  console.log('Role: SUPER_ADMIN');
  console.log('---------------------------');

  // 3. Tambahkan Data Dasar Zona (1, 2, 3) & Section
  const zonesToCreate = [
    {
      name: 'Zona 1',
      description: 'Area Utama Kandang',
      sections: ['Section A1', 'Section A2', 'Section A3']
    },
    {
      name: 'Zona 2',
      description: 'Area Penggemukan',
      sections: ['Section B1', 'Section B2']
    },
    {
      name: 'Zona 3',
      description: 'Area Karantina',
      sections: ['Section C1']
    }
  ];

  for (const z of zonesToCreate) {
    const zone = await prisma.zone.upsert({
      where: { name: z.name },
      update: {},
      create: {
        name: z.name,
        description: z.description,
        sections: {
          create: z.sections.map(s => ({ name: s }))
        }
      },
      include: { sections: true }
    });
    console.log(`Zona: ${zone.name} disiapkan dengan ${zone.sections.length} section.`);

    // Daftarkan sapi C-302 di Section pertama Zona 1
    if (z.name === 'Zona 1') {
      const sectionA1 = zone.sections.find(s => s.name === 'Section A1');
      if (sectionA1) {
        await prisma.livestock.upsert({
          where: { cattleId: 'C-302' },
          update: { sectionId: sectionA1.id },
          create: {
            cattleId: 'C-302',
            breed: 'Brahman',
            gender: 'Jantan',
            birthDate: new Date('2022-01-01'),
            initialWeight: 250,
            sectionId: sectionA1.id,
            status: 'SEHAT'
          }
        });
        console.log('Sapi C-302 telah didaftarkan di Section A1.');
      }
    }
  }

  console.log('Seluruh data Zona (1, 2, 3) dan Section telah disiapkan.');
}

main()
  .catch((e) => {
    console.error('Terjadi kesalahan saat pendaftaran:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
