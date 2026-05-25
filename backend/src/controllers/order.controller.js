import { OrderService } from '../services/order.service.js';
import { successJSON, errorJSON, paginatedJSON } from '../lib/response.js';

const orderService = new OrderService();

export class OrderController {
  // Student-facing
  async placeOrder(req, res) {
    const { payment_method: paymentMethod } = req.body;
    if (!paymentMethod) return errorJSON(res, 400, 'AUTH_004', 'payment_method is required');

    try {
      const order = await orderService.placeOrder(req.studentId, { paymentMethod });
      return successJSON(res, 201, order);
    } catch (err) {
      if (err.code === 'CART_002') return errorJSON(res, 400, 'CART_002', 'cart is empty');
      if (err.code === 'CART_001') return errorJSON(res, 400, 'CART_001', 'insufficient stock for one or more items');
      if (err.code === 'PAY_002') return errorJSON(res, 400, 'PAY_002', "invalid payment method, must be 'mercadopago' or 'cash'");
      return errorJSON(res, 500, 'INF_001', 'failed to place order');
    }
  }

  async listOrders(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.per_page, 10) || 10, 1), 50);

      const { orders, total } = await orderService.listOrders(req.studentId, page, limit);
      return paginatedJSON(res, orders, page, limit, total);
    } catch (err) {
      return errorJSON(res, 500, 'INF_001', 'failed to list orders');
    }
  }

  async getOrder(req, res) {
    try {
      const detail = await orderService.getOrder(req.studentId, req.params.id);
      return successJSON(res, 200, detail);
    } catch (err) {
      if (err.code === 'INF_001') return errorJSON(res, 404, 'INF_001', 'order not found');
      return errorJSON(res, 500, 'INF_001', 'failed to get order');
    }
  }

  async cancelOrder(req, res) {
    try {
      const order = await orderService.cancelOrder(req.studentId, req.params.id);
      return successJSON(res, 200, order);
    } catch (err) {
      if (err.code === 'INF_001') return errorJSON(res, 404, 'INF_001', 'order not found');
      if (err.code === 'ORD_002') return errorJSON(res, 409, 'ORD_002', 'order cannot be cancelled in its current status');
      return errorJSON(res, 500, 'INF_001', 'failed to cancel order');
    }
  }

  // Admin
  async listAllOrders(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.per_page, 10) || 10, 1), 50);
      const { status } = req.query;

      const { orders, total } = await orderService.adminListOrders(status, page, limit);
      return paginatedJSON(res, orders, page, limit, total);
    } catch (err) {
      return errorJSON(res, 500, 'INF_001', 'failed to list orders');
    }
  }

  async listAllOrdersWithDetails(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.per_page, 10) || 10, 1), 50);
      const { status } = req.query;

      const { orders, studentNames, total } = await orderService.adminListOrdersWithDetails(status, page, limit);
      return paginatedJSON(res, { orders, student_names: studentNames }, page, limit, total);
    } catch (err) {
      return errorJSON(res, 500, 'INF_001', 'failed to list orders');
    }
  }

  async getOrderAdmin(req, res) {
    try {
      const detail = await orderService.getOrderByAdmin(req.params.id);
      return successJSON(res, 200, detail);
    } catch (err) {
      if (err.code === 'INF_001') return errorJSON(res, 404, 'INF_001', 'order not found');
      return errorJSON(res, 500, 'INF_001', 'failed to get order');
    }
  }

  async updateOrderStatus(req, res) {
    const { status } = req.body;
    if (!status) return errorJSON(res, 400, 'AUTH_004', 'status is required');

    try {
      await orderService.adminUpdateOrderStatus(req.params.id, status);
      return successJSON(res, 200, { message: 'order status updated' });
    } catch (err) {
      if (err.code === 'INF_001') return errorJSON(res, 404, 'INF_001', 'order not found');
      if (err.code === 'ORD_003') return errorJSON(res, 409, 'ORD_003', err.message);
      return errorJSON(res, 500, 'INF_001', 'failed to update order status');
    }
  }

  async searchOrderByID(req, res) {
    const { id } = req.query;
    if (!id) return errorJSON(res, 400, 'AUTH_004', 'id query parameter is required');

    try {
      const result = await orderService.adminSearchOrderByID(id);
      if (!result) return errorJSON(res, 404, 'INF_001', 'order not found');
      return successJSON(res, 200, {
        order: result.order,
        items: result.items,
        student_name: result.studentName,
      });
    } catch (err) {
      return errorJSON(res, 500, 'INF_001', 'failed to search order');
    }
  }

  async searchOrdersByStudentName(req, res) {
    const { name } = req.query;
    if (!name) return errorJSON(res, 400, 'AUTH_004', 'name query parameter is required');

    try {
      const { orders, studentNames } = await orderService.adminSearchOrdersByStudentName(name);
      return successJSON(res, 200, { orders, student_names: studentNames });
    } catch (err) {
      return errorJSON(res, 500, 'INF_001', 'failed to search orders');
    }
  }

  async searchOrdersByBookletTitle(req, res) {
    const { title } = req.query;
    if (!title) return errorJSON(res, 400, 'AUTH_004', 'title query parameter is required');

    try {
      const results = await orderService.adminSearchOrdersByBookletTitle(title);
      return successJSON(res, 200, results);
    } catch (err) {
      return errorJSON(res, 500, 'INF_001', 'failed to search orders');
    }
  }
}
