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

const couponUsageSchema = new mongoose.Schema({
  couponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    required: true
  },
  code: { type: String, required: true },
  type: {
    type: String,
    enum: ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'],
    required: true
  },
  value: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  discountOnDelivery: { type: Number, default: 0 }
});

const paymentSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['COD', 'RAZORPAY'],
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
    default: 'PENDING'
  },
  razorpayPaymentId: String,
  razorpayOrderId: String,
  razorpaySignature: String,
  failureReason: String
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  shippingAddress: shippingAddressSchema,
  
  // Pricing
  subtotal: { type: Number, required: true },
  deliveryCharge: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  discountOnDelivery: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  
  // Coupon
  couponUsed: {
    type: couponUsageSchema,
    default: null
  },
  
  // Payment
  payment: paymentSchema,
  
  // Order Status
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
    default: 'PENDING'
  },
  
  // Tracking
  trackingNumber: String,
  notes: String,
  
  // Timestamps
  placedAt: { type: Date, default: Date.now },
  confirmedAt: Date,
  shippedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date
}, {
  timestamps: true
});

// Virtuals
orderSchema.virtual('finalDeliveryCharge').get(function() {
  return Math.max(0, this.deliveryCharge - this.discountOnDelivery);
});

orderSchema.virtual('totalSavings').get(function() {
  return this.discountAmount + this.discountOnDelivery;
});

// Generate order number
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    this.orderNumber = `ORD${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  }
  next();
});

// Indexes
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'payment.razorpayOrderId': 1 });

module.exports = mongoose.model('Order', orderSchema);