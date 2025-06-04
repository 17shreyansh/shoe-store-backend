const Coupon = require('../models/Coupon');
const Order = require('../models/Order');
const Product = require('../models/Product');
const mongoose = require('mongoose');

// ADMIN FUNCTIONS

// Get all coupons (Admin)
const getAllCoupons = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      type, 
      search, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    const filter = {};
    
    // Filter by status
    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;
    if (status === 'expired') filter.validUntil = { $lt: new Date() };
    if (status === 'valid') {
      const now = new Date();
      filter.isActive = true;
      filter.validFrom = { $lte: now };
      filter.validUntil = { $gte: now };
    }
    
    // Filter by type
    if (type) filter.type = type;
    
    // Search functionality
    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const coupons = await Coupon.find(filter)
      .populate('createdBy', 'name email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Coupon.countDocuments(filter);

    // Get coupon statistics
    const stats = await Coupon.aggregate([
      {
        $group: {
          _id: null,
          totalCoupons: { $sum: 1 },
          activeCoupons: {
            $sum: {
              $cond: [{ $eq: ['$isActive', true] }, 1, 0]
            }
          },
          expiredCoupons: {
            $sum: {
              $cond: [{ $lt: ['$validUntil', new Date()] }, 1, 0]
            }
          },
          totalUsage: { $sum: '$usageCount' }
        }
      }
    ]);

    res.json({
      coupons,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
      stats: stats[0] || { totalCoupons: 0, activeCoupons: 0, expiredCoupons: 0, totalUsage: 0 }
    });

  } catch (error) {
    console.error('Get all coupons error:', error);
    res.status(500).json({ message: 'Failed to fetch coupons' });
  }
};

// Create new coupon (Admin)
const createCoupon = async (req, res) => {
  try {
    const {
      code,
      name,
      description,
      type,
      value,
      minimumOrderAmount,
      maximumDiscountAmount,
      usageLimit,
      userUsageLimit,
      applicableProducts,
      applicableCategories,
      excludeProducts,
      applicableUserTypes,
      validFrom,
      validUntil,
      isActive,
      isPublic
    } = req.body;

    // Validation
    if (!code || !name || !type || value === undefined || !validUntil) {
      return res.status(400).json({ 
        message: 'Code, name, type, value, and validUntil are required' 
      });
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }

    // Validate percentage value
    if (type === 'PERCENTAGE' && (value < 0 || value > 100)) {
      return res.status(400).json({ 
        message: 'Percentage value must be between 0 and 100' 
      });
    }

    // Validate dates
    const fromDate = new Date(validFrom || Date.now());
    const untilDate = new Date(validUntil);
    
    if (untilDate <= fromDate) {
      return res.status(400).json({ 
        message: 'Valid until date must be after valid from date' 
      });
    }

    const couponData = {
      code: code.toUpperCase(),
      name,
      description,
      type,
      value,
      minimumOrderAmount: minimumOrderAmount || 0,
      maximumDiscountAmount,
      usageLimit,
      userUsageLimit: userUsageLimit || 1,
      applicableProducts: applicableProducts || [],
      applicableCategories: applicableCategories || [],
      excludeProducts: excludeProducts || [],
      applicableUserTypes: applicableUserTypes || 'ALL',
      validFrom: fromDate,
      validUntil: untilDate,
      isActive: isActive !== undefined ? isActive : true,
      isPublic: isPublic !== undefined ? isPublic : true,
      createdBy: req.user._id
    };

    const coupon = new Coupon(couponData);
    await coupon.save();

    res.status(201).json({
      message: 'Coupon created successfully',
      coupon
    });

  } catch (error) {
    console.error('Create coupon error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    res.status(500).json({ message: 'Failed to create coupon' });
  }
};

// Get single coupon (Admin)
const getCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;

    const coupon = await Coupon.findById(couponId)
      .populate('createdBy', 'name email')
      .populate('applicableProducts', 'name price')
      .populate('excludeProducts', 'name price');

    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    // Get usage statistics
    const usageStats = await Order.aggregate([
      { $match: { 'couponUsed.couponId': mongoose.Types.ObjectId(couponId) } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalDiscount: { $sum: '$couponUsed.discountAmount' },
          averageDiscount: { $avg: '$couponUsed.discountAmount' }
        }
      }
    ]);

    res.json({
      coupon,
      usageStats: usageStats[0] || { totalOrders: 0, totalDiscount: 0, averageDiscount: 0 }
    });

  } catch (error) {
    console.error('Get coupon error:', error);
    res.status(500).json({ message: 'Failed to fetch coupon' });
  }
};

// Update coupon (Admin)
const updateCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const updates = req.body;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    // If updating code, check for duplicates
    if (updates.code && updates.code.toUpperCase() !== coupon.code) {
      const existingCoupon = await Coupon.findOne({ 
        code: updates.code.toUpperCase(),
        _id: { $ne: couponId }
      });
      if (existingCoupon) {
        return res.status(400).json({ message: 'Coupon code already exists' });
      }
      updates.code = updates.code.toUpperCase();
    }

    // Validate percentage value
    if (updates.type === 'PERCENTAGE' && updates.value && (updates.value < 0 || updates.value > 100)) {
      return res.status(400).json({ 
        message: 'Percentage value must be between 0 and 100' 
      });
    }

    // Validate dates if being updated
    if (updates.validFrom || updates.validUntil) {
      const fromDate = new Date(updates.validFrom || coupon.validFrom);
      const untilDate = new Date(updates.validUntil || coupon.validUntil);
      
      if (untilDate <= fromDate) {
        return res.status(400).json({ 
          message: 'Valid until date must be after valid from date' 
        });
      }
    }

    Object.keys(updates).forEach(key => {
      coupon[key] = updates[key];
    });

    await coupon.save();

    res.json({
      message: 'Coupon updated successfully',
      coupon
    });

  } catch (error) {
    console.error('Update coupon error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    res.status(500).json({ message: 'Failed to update coupon' });
  }
};

// Delete coupon (Admin)
const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    // Check if coupon has been used
    if (coupon.usageCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete coupon that has been used. Consider deactivating it instead.' 
      });
    }

    await Coupon.findByIdAndDelete(couponId);

    res.json({ message: 'Coupon deleted successfully' });

  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ message: 'Failed to delete coupon' });
  }
};

// Toggle coupon status (Admin)
const toggleCouponStatus = async (req, res) => {
  try {
    const { couponId } = req.params;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.json({
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      coupon
    });

  } catch (error) {
    console.error('Toggle coupon status error:', error);
    res.status(500).json({ message: 'Failed to toggle coupon status' });
  }
};

// Bulk operations (Admin)
const bulkCouponOperations = async (req, res) => {
  try {
    const { operation, couponIds } = req.body;

    if (!operation || !couponIds || !Array.isArray(couponIds)) {
      return res.status(400).json({ 
        message: 'Operation and couponIds array are required' 
      });
    }

    let result;

    switch (operation) {
      case 'activate':
        result = await Coupon.updateMany(
          { _id: { $in: couponIds } },
          { isActive: true }
        );
        break;
        
      case 'deactivate':
        result = await Coupon.updateMany(
          { _id: { $in: couponIds } },
          { isActive: false }
        );
        break;
        
      case 'delete':
        // Only delete coupons that haven't been used
        result = await Coupon.deleteMany({
          _id: { $in: couponIds },
          usageCount: 0
        });
        break;
        
      default:
        return res.status(400).json({ message: 'Invalid operation' });
    }

    res.json({
      message: `Bulk ${operation} completed successfully`,
      modifiedCount: result.modifiedCount || result.deletedCount
    });

  } catch (error) {
    console.error('Bulk coupon operations error:', error);
    res.status(500).json({ message: 'Failed to perform bulk operation' });
  }
};

// USER FUNCTIONS

// Validate coupon code (User)
const validateCoupon = async (req, res) => {
  try {
    const { code } = req.params;
    const { orderAmount, items = [] } = req.body;
    const userId = req.user._id;

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    });

    if (!coupon) {
      return res.status(404).json({ message: 'Invalid coupon code' });
    }

    // Check if user can use this coupon
    if (!coupon.canUserUseCoupon(userId)) {
      return res.status(400).json({ 
        message: 'You have reached the usage limit for this coupon' 
      });
    }

    // Calculate discount
    const discountResult = coupon.calculateDiscount(orderAmount, 0, items);

    if (discountResult.error) {
      return res.status(400).json({ message: discountResult.error });
    }

    res.json({
      message: 'Coupon is valid',
      coupon: {
        id: coupon._id,
        code: coupon.code,
        name: coupon.name,
        type: coupon.type,
        value: coupon.value
      },
      discount: discountResult.discount,
      discountOnDelivery: discountResult.discountOnDelivery || 0
    });

  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ message: 'Failed to validate coupon' });
  }
};

// Get public coupons (User)
const getPublicCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const now = new Date();

    const coupons = await Coupon.find({
      isActive: true,
      isPublic: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now }
    })
    .select('code name description type value minimumOrderAmount validUntil')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Coupon.countDocuments({
      isActive: true,
      isPublic: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now }
    });

    res.json({
      coupons,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });

  } catch (error) {
    console.error('Get public coupons error:', error);
    res.status(500).json({ message: 'Failed to fetch coupons' });
  }
};

// Get coupon analytics (Admin)
const getCouponAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case '7d':
        dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case '30d':
        dateFilter = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
        break;
      case '90d':
        dateFilter = { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
        break;
      default:
        dateFilter = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    }

    // Get coupon usage analytics from orders
    const analytics = await Order.aggregate([
      {
        $match: {
          'couponUsed.couponId': { $exists: true },
          createdAt: dateFilter
        }
      },
      {
        $group: {
          _id: '$couponUsed.couponId',
          totalUsage: { $sum: 1 },
          totalDiscount: { $sum: '$couponUsed.discountAmount' },
          averageDiscount: { $avg: '$couponUsed.discountAmount' },
          totalOrderValue: { $sum: '$totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'coupons',
          localField: '_id',
          foreignField: '_id',
          as: 'coupon'
        }
      },
      {
        $unwind: '$coupon'
      },
      {
        $sort: { totalUsage: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({ analytics });

  } catch (error) {
    console.error('Get coupon analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch coupon analytics' });
  }
};

module.exports = {
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
};