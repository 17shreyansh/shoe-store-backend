const express = require('express');
const router = express.Router();
const {
  // Admin functions
  getAllCoupons,
  createCoupon,
  getCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  bulkCouponOperations,
  getCouponAnalytics,
  
  // User functions
  validateCoupon,
  getPublicCoupons
} = require('../controllers/couponController');

const { protect, isAdmin } = require("../middleware/authMiddleware");

// PUBLIC ROUTES (for users)

// Get all public/active coupons
router.get('/public', getPublicCoupons);

// USER ROUTES (require authentication)

// Validate a coupon code
router.post('/validate/:code', protect, validateCoupon);

// ADMIN ROUTES (require admin authentication)

// Get all coupons with filters and pagination
router.get('/admin', protect, isAdmin, getAllCoupons);

// Create a new coupon
router.post('/admin', protect, isAdmin, createCoupon);

// Get coupon analytics
router.get('/admin/analytics', protect, isAdmin, getCouponAnalytics);

// Get single coupon by ID
router.get('/admin/:couponId', protect, isAdmin, getCoupon);

// Update a coupon
router.put('/admin/:couponId', protect, isAdmin, updateCoupon);

// Delete a coupon
router.delete('/admin/:couponId', protect, isAdmin, deleteCoupon);

// Toggle coupon status (activate/deactivate)
router.patch('/admin/:couponId/toggle-status', protect, isAdmin, toggleCouponStatus);

// Bulk operations on multiple coupons
router.post('/admin/bulk-operations', protect, isAdmin, bulkCouponOperations);

module.exports = router;