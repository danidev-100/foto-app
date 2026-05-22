import { Router } from 'express';
import { CatalogController } from '../controllers/catalog.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { config } from '../config.js';

const router = Router();
const catalog = new CatalogController();

// Student-facing catalog (public)
router.get('/schools', (req, res) => catalog.listSchools(req, res));
router.get('/courses', (req, res) => catalog.listCourses(req, res));
router.get('/courses/:id/divisions', (req, res) => catalog.listDivisionsByCourse(req, res));

// Student-facing catalog (auth required)
const catalogAuth = Router();
catalogAuth.use(authMiddleware);
catalogAuth.get('/booklets', (req, res) => catalog.listBooklets(req, res));
catalogAuth.get('/booklets/:id', (req, res) => catalog.getBooklet(req, res));
router.use('/', catalogAuth);

// Admin catalog routes (auth + admin)
const admin = Router();
admin.use(authMiddleware);
admin.use(adminMiddleware);
admin.get('/courses', (req, res) => catalog.listCoursesAdmin(req, res));
admin.post('/courses', (req, res) => catalog.createCourse(req, res));
admin.put('/courses/:id', (req, res) => catalog.updateCourse(req, res));
admin.delete('/courses/:id', (req, res) => catalog.deleteCourse(req, res));
admin.get('/divisions', (req, res) => catalog.listDivisionsAdmin(req, res));
admin.post('/divisions', (req, res) => catalog.createDivision(req, res));
admin.put('/divisions/:id', (req, res) => catalog.updateDivision(req, res));
admin.delete('/divisions/:id', (req, res) => catalog.deleteDivision(req, res));
admin.get('/booklets', (req, res) => catalog.listBookletsAdmin(req, res));
admin.post('/booklets', (req, res) => catalog.createBooklet(req, res));
admin.put('/booklets/:id', (req, res) => catalog.updateBooklet(req, res));
admin.delete('/booklets/:id', (req, res) => catalog.deleteBooklet(req, res));

// Admin user management
import { UserController } from '../controllers/user.controller.js';
const userController = new UserController();
admin.get('/students', (req, res) => userController.listStudents(req, res));
admin.patch('/students/:id', (req, res) => userController.updateStudent(req, res));

// Admin orders
import { OrderController } from '../controllers/order.controller.js';
const orderController = new OrderController();
admin.get('/orders', (req, res) => orderController.listAllOrders(req, res));
admin.get('/orders/details', (req, res) => orderController.listAllOrdersWithDetails(req, res));
admin.get('/orders/search/by-id', (req, res) => orderController.searchOrderByID(req, res));
admin.get('/orders/search/by-student', (req, res) => orderController.searchOrdersByStudentName(req, res));
admin.get('/orders/search/by-booklet', (req, res) => orderController.searchOrdersByBookletTitle(req, res));
admin.get('/orders/:id', (req, res) => orderController.getOrderAdmin(req, res));
admin.put('/orders/:id/status', (req, res) => orderController.updateOrderStatus(req, res));
admin.post('/orders/:id/pay-cash', (req, res) => {
  import('../controllers/payment.controller.js').then(({ PaymentController }) => {
    const pc = new PaymentController();
    pc.confirmCashPayment(req, res);
  });
});

router.use('/', admin);

export default router;
