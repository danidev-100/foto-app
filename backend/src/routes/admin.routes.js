import { Router } from 'express';
import { CatalogController } from '../controllers/catalog.controller.js';
import { UserController } from '../controllers/user.controller.js';
import { OrderController } from '../controllers/order.controller.js';
import { ProgressController } from '../controllers/progress.controller.js';
import { ExportController } from '../controllers/export.controller.js';
import { AuditController } from '../controllers/audit.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);
router.use(adminMiddleware);

const catalog = new CatalogController();
const userController = new UserController();
const orderController = new OrderController();
const progressController = new ProgressController();
const exportController = new ExportController();
const auditController = new AuditController();

// Schools
router.get('/schools', (req, res) => catalog.listSchools(req, res));

// Courses
router.get('/courses', (req, res) => catalog.listCoursesAdmin(req, res));
router.post('/courses', (req, res) => catalog.createCourse(req, res));
router.put('/courses/:id', (req, res) => catalog.updateCourse(req, res));
router.get('/courses/:id/usage', (req, res) => catalog.getCourseUsage(req, res));
router.delete('/courses/:id', (req, res) => catalog.deleteCourse(req, res));

// Divisions
router.get('/divisions', (req, res) => catalog.listDivisionsAdmin(req, res));
router.post('/divisions', (req, res) => catalog.createDivision(req, res));
router.put('/divisions/:id', (req, res) => catalog.updateDivision(req, res));
router.delete('/divisions/:id', (req, res) => catalog.deleteDivision(req, res));

// Booklets
router.get('/booklets', (req, res) => catalog.listBookletsAdmin(req, res));
router.post('/booklets', (req, res) => catalog.createBooklet(req, res));
router.put('/booklets/:id', (req, res) => catalog.updateBooklet(req, res));
router.delete('/booklets/:id', (req, res) => catalog.deleteBooklet(req, res));

// Progress
router.get('/progress', (req, res) => progressController.getSummary(req, res));
router.get('/progress/:bookletId', (req, res) => progressController.getBookletDetail(req, res));
router.patch('/progress/:id', (req, res) => progressController.updateProgress(req, res));
router.put('/progress/:bookletId/printed-quantity', (req, res) => progressController.setPrintedQuantity(req, res));

// Students
router.get('/students', (req, res) => userController.listStudents(req, res));
router.patch('/students/:id', (req, res) => userController.updateStudent(req, res));

// Orders
router.get('/orders', (req, res) => orderController.listAllOrders(req, res));
router.get('/orders/details', (req, res) => orderController.listAllOrdersWithDetails(req, res));
router.get('/orders/search/by-id', (req, res) => orderController.searchOrderByID(req, res));
router.get('/orders/search/by-student', (req, res) => orderController.searchOrdersByStudentName(req, res));
router.get('/orders/search/by-booklet', (req, res) => orderController.searchOrdersByBookletTitle(req, res));
router.get('/orders/:id', (req, res) => orderController.getOrderAdmin(req, res));
router.put('/orders/:id/status', (req, res) => orderController.updateOrderStatus(req, res));
router.put('/orders/:orderId/items/:itemId/status', (req, res) => orderController.updateOrderItemStatus(req, res));
router.post('/orders/:id/pay-cash', (req, res) => {
  import('../controllers/payment.controller.js').then(({ PaymentController }) => {
    const pc = new PaymentController();
    pc.confirmCashPayment(req, res);
  });
});
router.post('/orders/:id/confirm-transfer', (req, res) => {
  import('../controllers/payment.controller.js').then(({ PaymentController }) => {
    const pc = new PaymentController();
    pc.confirmTransfer(req, res);
  });
});

// Export
router.get('/export/progress', (req, res) => exportController.exportProgress(req, res));
router.get('/export/orders', (req, res) => exportController.exportOrders(req, res));

// Audit Logs
router.get('/audit-logs', (req, res) => auditController.listLogs(req, res));
router.get('/audit-logs/stats', (req, res) => auditController.getStats(req, res));

export default router;
