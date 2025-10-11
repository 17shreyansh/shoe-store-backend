const mongoose = require('mongoose');

const deliveryChargeSchema = new mongoose.Schema({
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  charge: {
    type: Number,
    required: true,
    min: 0
  },
  minimumOrderValue: {
    type: Number,
    default: 0,
    min: 0
  },
  freeDeliveryThreshold: {
    type: Number,
    default: 0 // Free delivery if order amount exceeds this
  },
  estimatedDays: {
    type: Number,
    default: 3,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Create a compound index for state-city uniqueness
deliveryChargeSchema.index({ state: 1, city: 1 }, { unique: true });

module.exports = mongoose.model('DeliveryCharge', deliveryChargeSchema);