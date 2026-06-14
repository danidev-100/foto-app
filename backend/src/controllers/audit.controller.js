/**
 * Audit controller — API layer for audit logs.
 */
import { AuditService } from '../services/audit.service.js';
import { successJSON, errorJSON, paginatedJSON } from '../lib/response.js';

const auditService = new AuditService();

export class AuditController {
  async listLogs(req, res) {
    try {
      const { entity, action, admin_id: adminId, page = 1, limit = 50 } = req.query;
      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

      const result = await auditService.list({
        entity, action, adminId,
        page: pageNum, limit: limitNum,
      });

      return paginatedJSON(res, { logs: result.logs }, pageNum, limitNum, result.total);
    } catch (err) {
      console.error('Audit list error:', err);
      return errorJSON(res, 500, 'INF_001', 'failed to list audit logs');
    }
  }

  async getStats(_req, res) {
    try {
      const stats = await auditService.getStats();
      return successJSON(res, 200, { stats });
    } catch (err) {
      console.error('Audit stats error:', err);
      return errorJSON(res, 500, 'INF_001', 'failed to get audit stats');
    }
  }
}
