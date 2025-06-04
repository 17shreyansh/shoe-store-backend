const express = require('express');
const router = express.Router();
const {
  createOrder,
  applyCouponToCart, // New function
  getUserOrders,
  getOrder,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  getDeliveryCharges,
  updateDeliveryCharge,
  getDeliveryCharge,
  processPayment,
  deleteDeliveryCharge,
  bulkUploadDeliveryCharges,
  getDefaultDeliverySettings,
  updateDefaultDeliverySettings
} = require('../controllers/orderController');

const { protect, isAdmin } = require("../middleware/authMiddleware");

// User routes
router.post('/', protect, createOrder);
router.get('/my-orders', protect, getUserOrders);
router.get('/my-orders/:orderId', protect, getOrder);
router.patch('/my-orders/:orderId/cancel', protect, cancelOrder);

// NEW: Apply coupon to cart (before placing order)
router.post('/apply-coupon', protect, applyCouponToCart);

// Delivery charges (user-facing)
router.get('/delivery-charge/:city', getDeliveryCharge);

// Payment processing
router.post('/process-payment', processPayment);

// Admin routes
router.get('/admin/all', protect, isAdmin, getAllOrders);
router.patch('/admin/:orderId/status', protect, isAdmin, updateOrderStatus);

// Admin Delivery charges management routes
router.get('/admin/delivery-charges', protect, isAdmin, getDeliveryCharges);
router.post('/admin/delivery-charges', protect, isAdmin, updateDeliveryCharge);
router.delete('/admin/delivery-charges/:id', protect, isAdmin, deleteDeliveryCharge); // <-- Added DELETE route
router.post('/admin/delivery-charges/bulk', protect, isAdmin, bulkUploadDeliveryCharges); // <-- Added BULK POST route

// Admin Default Delivery Settings routes
router.get('/admin/default-delivery-settings', protect, isAdmin, getDefaultDeliverySettings); // <-- New route
router.put('/admin/default-delivery-settings', protect, isAdmin, updateDefaultDeliverySettings); // <-- New route

module.exports = router;