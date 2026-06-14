/**
 * Audit service — logs admin actions (CREATE / UPDATE / DELETE / CONFIRM) on
 * entities for traceability.
 *
 * This is a fire-and-forget subsystem:
 * callers never await the result.
 */
import { prisma } from '../lib/prisma.js';

export class AuditService {
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
    const record = await prisma.adminLog.create({
      data: { adminId, action, entity, entityId, details },
    });
    return record;
  }

  /**
   * List audit logs with optional filters and pagination.
   * Results are ordered by createdAt DESC (most recent first).
   *
   * @param {object} opts
   * @param {string} [opts.adminId]   - filter by admin
   * @param {string} [opts.action]    - filter by action type
   * @param {string} [opts.entity]    - filter by entity type
   * @param {string} [opts.entityId]  - filter by entity ID
   * @param {number} [opts.page=1]    - page number (1-indexed)
   * @param {number} [opts.limit=50]  - records per page
   * @returns {Promise<{ logs: object[], total: number, page: number, limit: number }>}
   */
  async list(opts = {}) {
    const {
      adminId,
      action,
      entity,
      entityId,
      page = 1,
      limit = 50,
    } = opts;

    const where = {};
    if (adminId) where.adminId = adminId;
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (entityId) where.entityId = entityId;

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
    // Prisma doesn't have GROUP BY natively, so we aggregate in-memory
    const logs = await prisma.adminLog.findMany({ select: { action: true } });
    const map = {};
    for (const log of logs) {
      map[log.action] = (map[log.action] || 0) + 1;
    }
    return Object.entries(map).map(([action, count]) => ({ action, count }));
  }
}

export default AuditService;
