import { ProgressService } from '../services/progress.service.js';
import { successJSON, errorJSON } from '../lib/response.js';

const progressService = new ProgressService();

export class ProgressController {
  async getSummary(req, res) {
    try {
      const schoolId = req.query.school_id || undefined;
      const data = await progressService.getProgressSummary({ schoolId });
      return successJSON(res, 200, data);
    } catch (err) {
      console.error('GetProgressSummary error:', err);
      return errorJSON(res, 500, 'PROG_500', 'Internal server error');
    }
  }

  async getBookletDetail(req, res) {
    try {
      const { bookletId } = req.params;
      const data = await progressService.getBookletStudents(bookletId);
      return successJSON(res, 200, data);
    } catch (err) {
      if (err.code === 'PROG_001') {
        return errorJSON(res, 404, err.code, 'Booklet not found');
      }
      console.error('GetBookletDetail error:', err);
      return errorJSON(res, 500, 'PROG_500', 'Internal server error');
    }
  }

  async updateProgress(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const data = await progressService.updateProgress(id, status);
      return successJSON(res, 200, data);
    } catch (err) {
      if (err.code === 'PROG_002') {
        return errorJSON(res, 400, err.code, 'Invalid status value. Must be "pending" or "completed"');
      }
      if (err.code === 'PROG_003') {
        return errorJSON(res, 404, err.code, 'Progress record not found');
      }
      console.error('UpdateProgress error:', err);
      return errorJSON(res, 500, 'PROG_500', 'Internal server error');
    }
  }
}
