/**
 * AdminLogService — singleton service for audit logging.
 *
 * Provides log(), list(), and getStats() for admin action audit trail.
 * Fire-and-forget: failures are logged to console, never block primary ops.
 */
import { prisma } from '../lib/prisma.js';

class AdminLogService {
  /**
   * Persist an audit log entry.
   * @param {string} adminId  - admin who performed the action
   * @param {string} action   - 'create' | 'update' | 'delete' | 'confirm'
   * @param {string} entity   - 'booklet' | 'course' | 'order' | 'payment' | 'student'
   * @param {string} entityId - ID of the affected entity
   * @param {object|null} [details=null] - optional payload (e.g. { title, changes })
   * @returns {Promise<object>} the created log
   */
  async log(adminId, action, entity, entityId, details = null) {
    try {
      const record = await prisma.adminLog.create({
        data: { adminId, action, entity, entityId, details },
      });
      return record;
    } catch (err) {
      console.error('[AdminLogService] Failed to create audit log:', err.message);
      throw err;
    }
  }

  /**
   * List audit logs with optional filters and pagination.
   * Results ordered by createdAt DESC.
   *
   * @param {object} opts
   * @param {string} [opts.adminId]  - filter by admin
   * @param {string} [opts.action]   - filter by action type
   * @param {string} [opts.entity]   - filter by entity type
   * @param {number} [opts.page=1]   - page number (1-indexed)
   * @param {number} [opts.limit=50] - records per page
   * @returns {Promise<{ logs: object[], total: number, page: number, limit: number }>}
   */
  async list(opts = {}) {
    const { adminId, action, entity, page = 1, limit = 50 } = opts;

    const where = {};
    if (adminId) where.adminId = adminId;
    if (action) where.action = action;
    if (entity) where.entity = entity;

    const [logs, total] = await Promise.all([
      prisma.adminLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adminLog.count({ where }),
    ]);

    return { logs, total, page, limit };
  }

  /**
   * Return aggregated stats: count of logs grouped by action.
   * @returns {Promise<Array<{ action: string, count: number }>>}
   */
  async getStats() {
    const logs = await prisma.adminLog.findMany({ select: { action: true } });
    const map = {};
    for (const log of logs) {
      map[log.action] = (map[log.action] || 0) + 1;
    }
    return Object.entries(map).map(([action, count]) => ({ action, count }));
  }
}

/** Singleton instance */
export const adminLogService = new AdminLogService();

export default adminLogService;
