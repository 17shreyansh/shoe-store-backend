const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  size: { type: String, required: true },
  color: { type: String, required: true },
  image: { type: String, required: true }
});

const shippingAddressSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, default: 'India' }
});

const paymentDetailsSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  }
});

// New schema for coupon usage tracking
const couponUsageSchema = new mongoose.Schema({
  couponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    required: true
  },
  code: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'],
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  discountAmount: {
    type: Number,
    required: true,
    default: 0
  },
  discountOnDelivery: {
    type: Number,
    default: 0
  }
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  shippingAddress: shippingAddressSchema,
  subtotal: { type: Number, required: true },
  deliveryCharge: { type: Number, default: 0 },
  
  // Coupon-related fields
  couponUsed: {
    type: couponUsageSchema,
    default: null
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  discountedDeliveryCharge: {
    type: Number,
    default: 0
  },
  
  totalAmount: { type: Number, required: true },
  paymentMethod: {
    type: String,
    enum: ['COD', 'Online', 'Card'],
    default: 'COD'
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
    default: 'Pending'
  },
  paymentDetails: {
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  orderStatus: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  trackingNumber: { type: String },
  notes: { type: String },
  placedAt: { type: Date, default: Date.now },
  shippedAt: { type: Date },
  deliveredAt: { type: Date },
  cancelledAt: { type: Date }
}, {
  timestamps: true
});

// Virtual for final delivery charge after coupon discount
orderSchema.virtual('finalDeliveryCharge').get(function() {
  return Math.max(0, this.deliveryCharge - (this.couponUsed?.discountOnDelivery || 0));
});

// Virtual for order amount before discount
orderSchema.virtual('originalTotal').get(function() {
  return this.subtotal + this.deliveryCharge;
});

// Virtual for total savings
orderSchema.virtual('totalSavings').get(function() {
  return (this.discountAmount || 0) + (this.couponUsed?.discountOnDelivery || 0);
});

// Generate order number before saving if not already set
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `ORD${Date.now()}${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ 'couponUsed.couponId': 1 });

module.exports = mongoose.model('Order', orderSchema);