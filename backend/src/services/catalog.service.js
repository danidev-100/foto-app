import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';

export class CatalogService {
  // Student-facing
  async listSchools() {
    return prisma.school.findMany({
      where: { isActive: true },
      include: {
        courses: {
          include: {
            course: {
              include: {
                divisions: {
                  where: { isActive: true },
                  orderBy: { name: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async listCourses() {
    return prisma.course.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async listDivisionsByCourse(courseId) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      const err = new Error('course not found');
      err.code = 'CAT_001';
      err.status = 404;
      throw err;
    }
    return prisma.division.findMany({
      where: { courseId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async listActiveBooklets({ courseId, divisionId, page = 1, limit = 20 }) {
    const where = { isActive: true, stock: { gt: 0 } };
    if (courseId) where.courseId = courseId;
    if (divisionId) where.divisionId = divisionId;

    const [booklets, total] = await Promise.all([
      prisma.booklet.findMany({
        where,
        orderBy: { title: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.booklet.count({ where }),
    ]);

    return { booklets, total, page, limit };
  }

  async getBooklet(id) {
    const booklet = await prisma.booklet.findUnique({ where: { id } });
    if (!booklet) {
      const err = new Error('booklet not found');
      err.code = 'CAT_003';
      err.status = 404;
      throw err;
    }
    return booklet;
  }

  // Admin — Courses
  async createCourse({ name, description }) {
    return prisma.course.create({
      data: { name, description, isActive: true },
    });
  }

  async updateCourse(id, { name, description, isActive }) {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      const err = new Error('course not found');
      err.code = 'CAT_001';
      err.status = 404;
      throw err;
    }
    return prisma.course.update({
      where: { id },
      data: {
        name,
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });
  }

  async deleteCourse(id) {
    const result = await prisma.course.deleteMany({ where: { id } });
    if (result.count === 0) {
      const err = new Error('course not found');
      err.code = 'CAT_001';
      err.status = 404;
      throw err;
    }
  }

  // Admin — Divisions
  async listAllDivisions() {
    return prisma.division.findMany({ orderBy: [{ courseId: 'asc' }, { name: 'asc' }] });
  }

  async createDivision({ courseId, name }) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      const err = new Error('course not found');
      err.code = 'CAT_001';
      err.status = 404;
      throw err;
    }
    return prisma.division.create({
      data: { courseId, name, isActive: true },
    });
  }

  async updateDivision(id, { courseId, name, isActive }) {
    const division = await prisma.division.findUnique({ where: { id } });
    if (!division) {
      const err = new Error('division not found');
      err.code = 'CAT_002';
      err.status = 404;
      throw err;
    }
    // Verify course exists
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      const err = new Error('course not found');
      err.code = 'CAT_001';
      err.status = 404;
      throw err;
    }
    return prisma.division.update({
      where: { id },
      data: {
        courseId,
        name,
        ...(isActive !== undefined && { isActive }),
      },
    });
  }

  async deleteDivision(id) {
    const result = await prisma.division.deleteMany({ where: { id } });
    if (result.count === 0) {
      const err = new Error('division not found');
      err.code = 'CAT_002';
      err.status = 404;
      throw err;
    }
  }

  // Admin — Booklets
  async listAllBooklets({ courseId, divisionId, page = 1, limit = 20 }) {
    const where = {};
    if (courseId) where.courseId = courseId;
    if (divisionId) where.divisionId = divisionId;

    const [booklets, total] = await Promise.all([
      prisma.booklet.findMany({
        where,
        orderBy: { title: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          course: {
            include: {
              schools: { include: { school: true } },
            },
          },
        },
      }),
      prisma.booklet.count({ where }),
    ]);

    return { booklets, total, page, limit };
  }

  async createBooklet({ courseId, divisionId, title, description, currentPrice, stock = 0, imageUrl, isActive = true }) {
    if (currentPrice < 0) {
      const err = new Error('price must be non-negative');
      err.code = 'CAT_005';
      err.status = 400;
      throw err;
    }
    if (stock < 0) {
      const err = new Error('stock must be non-negative');
      err.code = 'CAT_006';
      err.status = 400;
      throw err;
    }

    // Verify course and division exist
    const [course, division] = await Promise.all([
      prisma.course.findUnique({ where: { id: courseId } }),
      prisma.division.findUnique({ where: { id: divisionId } }),
    ]);
    if (!course || !division) {
      const err = new Error('invalid course_id or division_id');
      err.code = 'AUTH_004';
      err.status = 400;
      throw err;
    }

    return prisma.booklet.create({
      data: { courseId, divisionId, title, description, currentPrice, stock, imageUrl, isActive },
    });
  }

  async updateBooklet(id, { courseId, divisionId, title, description, currentPrice, stock, imageUrl, isActive }) {
    if (currentPrice !== undefined && currentPrice < 0) {
      const err = new Error('price must be non-negative');
      err.code = 'CAT_005';
      err.status = 400;
      throw err;
    }

    const booklet = await prisma.booklet.findUnique({ where: { id } });
    if (!booklet) {
      const err = new Error('booklet not found');
      err.code = 'CAT_003';
      err.status = 404;
      throw err;
    }

    // Verify course and division exist
    const [course, division] = await Promise.all([
      prisma.course.findUnique({ where: { id: courseId } }),
      prisma.division.findUnique({ where: { id: divisionId } }),
    ]);
    if (!course || !division) {
      const err = new Error('invalid course_id or division_id');
      err.code = 'AUTH_004';
      err.status = 400;
      throw err;
    }

    return prisma.booklet.update({
      where: { id },
      data: {
        courseId,
        divisionId,
        title,
        description,
        currentPrice,
        ...(stock !== undefined && { stock }),
        imageUrl,
        ...(isActive !== undefined && { isActive }),
      },
    });
  }

  async deleteBooklet(id) {
    const result = await prisma.booklet.deleteMany({ where: { id } });
    if (result.count === 0) {
      const err = new Error('booklet not found');
      err.code = 'CAT_003';
      err.status = 404;
      throw err;
    }
  }
}
