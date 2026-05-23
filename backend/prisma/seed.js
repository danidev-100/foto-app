import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding schools...');

  // Create both schools
  const schoolNames = [
    { name: 'Colegio Don Bosco', shortName: 'Don Bosco' },
    { name: 'Instituto Rodeo del Medio', shortName: 'Rodeo del Medio' },
  ];

  const schoolIds = [];
  for (const s of schoolNames) {
    const existing = await prisma.school.findFirst({ where: { name: s.name } });
    if (existing) {
      console.log(`School already exists: ${s.name} (${existing.id})`);
      schoolIds.push(existing.id);
    } else {
      const created = await prisma.school.create({ data: s });
      console.log(`Created school: ${created.name} (${created.id})`);
      schoolIds.push(created.id);
    }
  }

  // Get all active courses without a school
  const courses = await prisma.course.findMany({ where: { schoolId: null, isActive: true } });
  console.log(`Found ${courses.length} courses without a school`);

  // Assign unassigned courses to the first school
  if (courses.length > 0 && schoolIds.length > 0) {
    await prisma.course.updateMany({
      where: { id: { in: courses.map(c => c.id) } },
      data: { schoolId: schoolIds[0] },
    });
    console.log(`Assigned ${courses.length} courses to first school`);
  }

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
