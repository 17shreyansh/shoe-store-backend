const mongoose = require('mongoose');

const deliveryChargeSchema = new mongoose.Schema({
  city: {
    type: String,
    required: true,
    unique: true,
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
  freeDeliveryThreshold: {
    type: Number,
    default: 0 // Free delivery if order amount exceeds this
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better search performance
deliveryChargeSchema.index({ city: 1, state: 1 });

module.exports = mongoose.model('DeliveryCharge', deliveryChargeSchema);