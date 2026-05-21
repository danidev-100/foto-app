import { CatalogService } from '../services/catalog.service.js';
import { successJSON, errorJSON, paginatedJSON } from '../lib/response.js';

const catalogService = new CatalogService();

export class CatalogController {
  // Student-facing
  async listCourses(_req, res) {
    try {
      const courses = await catalogService.listCourses();
      return successJSON(res, 200, courses);
    } catch (err) {
      console.error('ListCourses error:', err);
      return errorJSON(res, 500, 'INF_001', 'failed to list courses');
    }
  }

  async listDivisionsByCourse(req, res) {
    try {
      const divisions = await catalogService.listDivisionsByCourse(req.params.id);
      return successJSON(res, 200, divisions);
    } catch (err) {
      if (err.code === 'CAT_001') return errorJSON(res, 404, 'CAT_001', 'course not found');
      return errorJSON(res, 500, 'INF_001', 'failed to list divisions');
    }
  }

  async listBooklets(req, res) {
    try {
      const { course_id: courseId, division_id: divisionId, page = 1, per_page: perPage = 20 } = req.query;
      const limit = Math.min(Math.max(parseInt(perPage, 10) || 20, 1), 100);
      const pageNum = Math.max(parseInt(page, 10) || 1, 1);

      const { booklets, total } = await catalogService.listActiveBooklets({
        courseId, divisionId, page: pageNum, limit,
      });
      return paginatedJSON(res, booklets, pageNum, limit, total);
    } catch (err) {
      return errorJSON(res, 500, 'INF_001', 'failed to list booklets');
    }
  }

  async getBooklet(req, res) {
    try {
      const booklet = await catalogService.getBooklet(req.params.id);
      return successJSON(res, 200, booklet);
    } catch (err) {
      if (err.code === 'CAT_003') return errorJSON(res, 404, 'CAT_003', 'booklet not found');
      return errorJSON(res, 500, 'INF_001', 'failed to get booklet');
    }
  }

  // Admin — Courses
  async listCoursesAdmin(_req, res) {
    try {
      const courses = await catalogService.listCourses();
      return successJSON(res, 200, courses);
    } catch (err) {
      return errorJSON(res, 500, 'INF_001', 'failed to list courses');
    }
  }

  async createCourse(req, res) {
    const { name, description } = req.body;
    if (!name) return errorJSON(res, 400, 'AUTH_004', 'name is required');
    try {
      const course = await catalogService.createCourse({ name, description });
      return successJSON(res, 201, course);
    } catch (err) {
      return errorJSON(res, 500, 'INF_001', 'failed to create course');
    }
  }

  async updateCourse(req, res) {
    const { name, description, is_active: isActive } = req.body;
    if (!name) return errorJSON(res, 400, 'AUTH_004', 'name is required');
    try {
      const course = await catalogService.updateCourse(req.params.id, { name, description, isActive });
      return successJSON(res, 200, course);
    } catch (err) {
      if (err.code === 'CAT_001') return errorJSON(res, 404, 'CAT_001', 'course not found');
      return errorJSON(res, 500, 'INF_001', 'failed to update course');
    }
  }

  async deleteCourse(req, res) {
    try {
      await catalogService.deleteCourse(req.params.id);
      return successJSON(res, 200, { message: 'course deleted' });
    } catch (err) {
      if (err.code === 'CAT_001') return errorJSON(res, 404, 'CAT_001', 'course not found');
      return errorJSON(res, 500, 'INF_001', 'failed to delete course');
    }
  }

  // Admin — Divisions
  async listDivisionsAdmin(_req, res) {
    try {
      const divisions = await catalogService.listAllDivisions();
      return successJSON(res, 200, divisions);
    } catch (err) {
      return errorJSON(res, 500, 'INF_001', 'failed to list divisions');
    }
  }

  async createDivision(req, res) {
    const { course_id: courseId, name } = req.body;
    if (!name || !courseId) return errorJSON(res, 400, 'AUTH_004', 'name and course_id are required');
    try {
      const division = await catalogService.createDivision({ courseId, name });
      return successJSON(res, 201, division);
    } catch (err) {
      if (err.code === 'CAT_001') return errorJSON(res, 404, 'CAT_001', 'course not found');
      return errorJSON(res, 500, 'INF_001', 'failed to create division');
    }
  }

  async updateDivision(req, res) {
    const { course_id: courseId, name, is_active: isActive } = req.body;
    if (!name || !courseId) return errorJSON(res, 400, 'AUTH_004', 'name and course_id are required');
    try {
      const division = await catalogService.updateDivision(req.params.id, { courseId, name, isActive });
      return successJSON(res, 200, division);
    } catch (err) {
      if (err.code === 'CAT_002') return errorJSON(res, 404, 'CAT_002', 'division not found');
      return errorJSON(res, 500, 'INF_001', 'failed to update division');
    }
  }

  async deleteDivision(req, res) {
    try {
      await catalogService.deleteDivision(req.params.id);
      return successJSON(res, 200, { message: 'division deleted' });
    } catch (err) {
      if (err.code === 'CAT_002') return errorJSON(res, 404, 'CAT_002', 'division not found');
      return errorJSON(res, 500, 'INF_001', 'failed to delete division');
    }
  }

  // Admin — Booklets
  async listBookletsAdmin(req, res) {
    try {
      const { course_id: courseId, division_id: divisionId, page = 1, per_page: perPage = 20 } = req.query;
      const limit = Math.min(Math.max(parseInt(perPage, 10) || 20, 1), 100);
      const pageNum = Math.max(parseInt(page, 10) || 1, 1);

      const { booklets, total } = await catalogService.listAllBooklets({
        courseId, divisionId, page: pageNum, limit,
      });
      return paginatedJSON(res, booklets, pageNum, limit, total);
    } catch (err) {
      return errorJSON(res, 500, 'INF_001', 'failed to list booklets');
    }
  }

  async createBooklet(req, res) {
    const { course_id: courseId, division_id: divisionId, title, description, current_price: currentPrice, stock, image_url: imageUrl, is_active: isActive } = req.body;
    if (!title || !courseId || !divisionId) return errorJSON(res, 400, 'AUTH_004', 'title, course_id, and division_id are required');
    try {
      const booklet = await catalogService.createBooklet({
        courseId, divisionId, title, description, currentPrice, stock, imageUrl, isActive,
      });
      return successJSON(res, 201, booklet);
    } catch (err) {
      if (err.code === 'CAT_005') return errorJSON(res, 400, 'CAT_005', 'price must be non-negative');
      if (err.code === 'CAT_006') return errorJSON(res, 400, 'CAT_006', 'stock must be non-negative');
      return errorJSON(res, 500, 'INF_001', 'failed to create booklet');
    }
  }

  async updateBooklet(req, res) {
    const { course_id: courseId, division_id: divisionId, title, description, current_price: currentPrice, stock, image_url: imageUrl, is_active: isActive } = req.body;
    if (!title || !courseId || !divisionId) return errorJSON(res, 400, 'AUTH_004', 'title, course_id, and division_id are required');
    try {
      const booklet = await catalogService.updateBooklet(req.params.id, {
        courseId, divisionId, title, description, currentPrice, stock, imageUrl, isActive,
      });
      return successJSON(res, 200, booklet);
    } catch (err) {
      if (err.code === 'CAT_003') return errorJSON(res, 404, 'CAT_003', 'booklet not found');
      if (err.code === 'CAT_005') return errorJSON(res, 400, 'CAT_005', 'price must be non-negative');
      if (err.code === 'CAT_006') return errorJSON(res, 400, 'CAT_006', 'stock must be non-negative');
      return errorJSON(res, 500, 'INF_001', 'failed to update booklet');
    }
  }

  async deleteBooklet(req, res) {
    try {
      await catalogService.deleteBooklet(req.params.id);
      return successJSON(res, 200, { message: 'booklet deleted' });
    } catch (err) {
      if (err.code === 'CAT_003') return errorJSON(res, 404, 'CAT_003', 'booklet not found');
      return errorJSON(res, 500, 'INF_001', 'failed to delete booklet');
    }
  }
}
