import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  await prisma.$connect();

  const students = await prisma.student.findMany({
    take: 5,
    select: { id: true, name: true, email: true, isAdmin: true },
  });
  console.log('Students:', JSON.stringify(students, null, 2));

  const schools = await prisma.school.count();
  const courses = await prisma.course.count();
  const divisions = await prisma.division.count();
  const booklets = await prisma.booklet.count({ where: { isActive: true, stock: { gt: 0 } } });
  console.log(`Schools: ${schools}, Courses: ${courses}, Divisions: ${divisions}, Booklets with stock: ${booklets}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
