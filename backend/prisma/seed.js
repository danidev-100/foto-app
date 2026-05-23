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

  // Get all active courses
  const courses = await prisma.course.findMany({ where: { isActive: true } });
  console.log(`Found ${courses.length} active courses`);

  // Link all courses to both schools
  let linked = 0;
  for (const schoolId of schoolIds) {
    for (const course of courses) {
      const exists = await prisma.schoolCourse.findUnique({
        where: { schoolId_courseId: { schoolId, courseId: course.id } },
      });
      if (!exists) {
        await prisma.schoolCourse.create({ data: { schoolId, courseId: course.id } });
        linked++;
      }
    }
  }

  console.log(`Created ${linked} new school-course links`);
  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
