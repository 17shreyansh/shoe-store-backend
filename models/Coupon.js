const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true, // This implicitly creates an index for 'code'
    uppercase: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'],
    required: true
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  minimumOrderAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  maximumDiscountAmount: {
    type: Number,
    default: null // null means no maximum limit
  },
  usageLimit: {
    type: Number,
    default: null // null means unlimited usage
  },
  usageCount: {
    type: Number,
    default: 0
  },
  userUsageLimit: {
    type: Number,
    default: 1 // How many times a single user can use this coupon
  },
  applicableProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  applicableCategories: [{
    type: String
  }],
  excludeProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  applicableUserTypes: {
    type: String,
    enum: ['ALL', 'NEW_CUSTOMERS', 'EXISTING_CUSTOMERS'],
    default: 'ALL'
  },
  validFrom: {
    type: Date,
    required: true,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: true // If false, coupon won't be displayed in public lists
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  usedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    usageCount: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for better performance
// couponSchema.index({ code: 1 }); // Removed this line as 'unique: true' already creates an index for 'code'
couponSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
couponSchema.index({ type: 1 });
couponSchema.index({ validUntil: 1 });

// Virtual for checking if coupon is expired
couponSchema.virtual('isExpired').get(function() {
  return new Date() > this.validUntil;
});

// Virtual for checking if coupon is currently valid
couponSchema.virtual('isCurrentlyValid').get(function() {
  const now = new Date();
  return this.isActive && now >= this.validFrom && now <= this.validUntil;
});

// Virtual for remaining usage count
couponSchema.virtual('remainingUsage').get(function() {
  if (this.usageLimit === null) return null; // Unlimited
  return Math.max(0, this.usageLimit - this.usageCount);
});

// Method to check if user can use this coupon
couponSchema.methods.canUserUseCoupon = function(userId) {
  if (!this.isCurrentlyValid) return false;

  // Check overall usage limit
  if (this.usageLimit !== null && this.usageCount >= this.usageLimit) {
    return false;
  }

  // Check user-specific usage limit
  const userUsage = this.usedBy.find(usage => usage.userId.toString() === userId.toString());
  if (userUsage && userUsage.usageCount >= this.userUsageLimit) {
    return false;
  }

  return true;
};

// Method to calculate discount for given order
couponSchema.methods.calculateDiscount = function(orderAmount, deliveryCharge = 0, applicableItems = []) {
  if (!this.isCurrentlyValid) return { discount: 0, error: 'Coupon is not valid' };

  // Check minimum order amount
  if (orderAmount < this.minimumOrderAmount) {
    return {
      discount: 0,
      error: `Minimum order amount of ₹${this.minimumOrderAmount} required`
    };
  }

  let discount = 0;
  let discountOnDelivery = 0;

  switch (this.type) {
    case 'FIXED_AMOUNT':
      discount = this.value;
      break;

    case 'PERCENTAGE':
      discount = (orderAmount * this.value) / 100;
      break;

    case 'FREE_SHIPPING':
      discountOnDelivery = deliveryCharge;
      break;
  }

  // Apply maximum discount limit if set
  if (this.maximumDiscountAmount && discount > this.maximumDiscountAmount) {
    discount = this.maximumDiscountAmount;
  }

  // Ensure discount doesn't exceed order amount
  discount = Math.min(discount, orderAmount);

  return {
    discount: Math.round(discount * 100) / 100, // Round to 2 decimal places
    discountOnDelivery: Math.round(discountOnDelivery * 100) / 100,
    appliedValue: this.type === 'PERCENTAGE' ? this.value : discount
  };
};

module.exports = mongoose.model('Coupon', couponSchema);
