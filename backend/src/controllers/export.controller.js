import { prisma } from '../lib/prisma.js';

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCSV(headers, rows) {
  const headerLine = headers.map(csvEscape).join(',');
  const dataLines = rows.map(row =>
    headers.map(h => csvEscape(row[h])).join(',')
  );
  return '\uFEFF' + [headerLine, ...dataLines].join('\n');
}

export class ExportController {
  async exportProgress(req, res) {
    try {
      const booklets = await prisma.booklet.findMany({
        include: {
          course: { include: { school: true } },
        },
      });

      const bookletIds = booklets.map(b => b.id);

      // Get completion counts per booklet
      const completions = await Promise.all(
        bookletIds.map(async (bid) => {
          const [completed, pending] = await Promise.all([
            prisma.studentBookletProgress.count({
              where: { bookletId: bid, status: 'completed' },
            }),
            prisma.studentBookletProgress.count({
              where: { bookletId: bid, status: 'pending' },
            }),
          ]);
          return { bookletId: bid, completed, pending };
        })
      );

      // Build a map: bookletId -> { completed, pending }
      const completionMap = {};
      for (const c of completions) {
        completionMap[c.bookletId] = { completed: c.completed, pending: c.pending };
      }

      // Get total students per course
      const courseStudents = await prisma.student.groupBy({
        by: ['courseId'],
        _count: { id: true },
      });
      const courseStudentMap = {};
      for (const cs of courseStudents) {
        courseStudentMap[cs.courseId] = cs._count.id;
      }

      // Get printed quantities and ordered quantities
      const printedMap = {};
      for (const b of booklets) {
        if (b.printedQuantity) printedMap[b.id] = Number(b.printedQuantity);
      }

      const orderedItems = await Promise.all(
        bookletIds.map(async (bid) => {
          const result = await prisma.orderItem.aggregate({
            where: { bookletId: bid },
            _sum: { quantity: true },
          });
          return { bookletId: bid, quantity: Number(result._sum.quantity) || 0 };
        })
      );
      const orderedMap = {};
      for (const oi of orderedItems) {
        orderedMap[oi.bookletId] = oi.quantity;
      }

      const headers = ['school', 'course', 'booklet', 'total_students', 'completed', 'pending', 'percentage', 'printed', 'ordered', 'faltantes'];
      const rows = [];

      for (const booklet of booklets) {
        const totalStudents = courseStudentMap[booklet.courseId] || 0;
        const completed = completionMap[booklet.id]?.completed || 0;
        const pending = completionMap[booklet.id]?.pending || 0;
        const percentage = totalStudents > 0 ? Math.round((completed / totalStudents) * 100) : 0;
        const printed = printedMap[booklet.id] || 0;
        const ordered = orderedMap[booklet.id] || 0;
        const faltantes = printed - ordered;

        rows.push({
          school: booklet.course?.school?.name || '',
          course: booklet.course?.name || '',
          booklet: booklet.title,
          total_students: totalStudents,
          completed,
          pending,
          percentage,
          printed,
          ordered,
          faltantes,
        });
      }

      const csv = toCSV(headers, rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="progress-export.csv"');
      return res.status(200).send(csv);
    } catch (err) {
      console.error('Export progress error:', err);
      return res.status(500).json({ error: { code: 'INF_001', message: 'failed to export progress' } });
    }
  }

  async exportOrders(req, res) {
    try {
      const orders = await prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            include: {
              course: { include: { school: true } },
            },
          },
        },
      });

      const headers = ['order_id', 'student', 'course', 'school', 'total', 'status', 'payment_method', 'payment_status', 'created_at'];
      const rows = orders.map(order => ({
        order_id: order.id,
        student: order.student?.name || '',
        course: order.student?.course?.name || '',
        school: order.student?.course?.school?.name || '',
        total: Number(order.total),
        status: order.status,
        payment_method: order.paymentMethod,
        payment_status: order.paymentStatus,
        created_at: order.createdAt ? new Date(order.createdAt).toISOString() : '',
      }));

      const csv = toCSV(headers, rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="orders-export.csv"');
      return res.status(200).send(csv);
    } catch (err) {
      console.error('Export orders error:', err);
      return res.status(500).json({ error: { code: 'INF_001', message: 'failed to export orders' } });
    }
  }
}
