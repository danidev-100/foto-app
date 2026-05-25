import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STANDARD_COURSES = [
  // Primaria
  { name: 'Primaria - Jardín',     divisions: ['A', 'B', 'C'] },
  { name: 'Primaria - 1° Primero', divisions: ['A', 'B', 'C'] },
  { name: 'Primaria - 2° Segundo', divisions: ['A', 'B', 'C'] },
  { name: 'Primaria - 3° Tercero', divisions: ['A', 'B', 'C'] },
  { name: 'Primaria - 4° Cuarto',  divisions: ['A', 'B', 'C'] },
  { name: 'Primaria - 5° Quinto',  divisions: ['A', 'B', 'C'] },
  { name: 'Primaria - 6° Sexto',   divisions: ['A', 'B', 'C'] },
  { name: 'Primaria - 7° Séptimo', divisions: ['A', 'B', 'C'] },
  // Secundaria
  { name: 'Secundaria - 1° Primero', divisions: ['A', 'B', 'C', 'D', 'E'] },
  { name: 'Secundaria - 2° Segundo', divisions: ['A', 'B', 'C', 'D', 'E'] },
  { name: 'Secundaria - 3° Tercero', divisions: ['A', 'B', 'N', 'H'] },
  { name: 'Secundaria - 4° Cuarto',  divisions: ['A', 'B', 'N', 'H'] },
  { name: 'Secundaria - 5° Quinto',  divisions: ['A', 'B', 'N', 'H'] },
];

async function main() {
  console.log('Seeding schools and courses...');

  const schoolNames = [
    { name: 'Colegio Don Bosco', shortName: 'Don Bosco' },
    { name: 'Instituto Rodeo del Medio', shortName: 'Rodeo del Medio' },
  ];

  for (const s of schoolNames) {
    let school = await prisma.school.findFirst({ where: { name: s.name } });
    if (!school) {
      school = await prisma.school.create({ data: s });
      console.log(`Created school: ${school.name}`);
    } else {
      console.log(`School already exists: ${school.name}`);
    }

    // Create standard courses for this school if it has none
    const courseCount = await prisma.course.count({
      where: { schoolId: school.id, isActive: true },
    });
    if (courseCount > 0) {
      console.log(`  ${school.name} already has ${courseCount} courses — skipping`);
      continue;
    }

    console.log(`  Creating standard courses for ${school.name}...`);
    for (const sc of STANDARD_COURSES) {
      const course = await prisma.course.create({
        data: {
          name: sc.name,
          isActive: true,
          schoolId: school.id,
          divisions: {
            create: sc.divisions.map(d => ({
              name: d,
              isActive: true,
            })),
          },
        },
      });
      console.log(`    Created "${course.name}" with ${sc.divisions.length} divisions`);
    }
  }

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
