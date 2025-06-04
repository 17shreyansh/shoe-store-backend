const asyncHandler = require('express-async-handler');
const DeliveryCharge = require('../models/DeliveryCharge');

// @desc    Get all delivery charges
// @route   GET /api/delivery-charges
// @access  Private/Admin
const getDeliveryCharges = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.state) {
    filter.state = req.query.state.toUpperCase();
  }
  if (req.query.city) {
    filter.city = req.query.city.toUpperCase();
  }
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }

  const deliveryCharges = await DeliveryCharge.find(filter)
    .sort({ state: 1, city: 1 })
    .skip(skip)
    .limit(limit);

  const total = await DeliveryCharge.countDocuments(filter);

  res.json({
    deliveryCharges,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    total
  });
});

// @desc    Get delivery charge by ID
// @route   GET /api/delivery-charges/:id
// @access  Private/Admin
const getDeliveryChargeById = asyncHandler(async (req, res) => {
  const deliveryCharge = await DeliveryCharge.findById(req.params.id);

  if (!deliveryCharge) {
    res.status(404);
    throw new Error('Delivery charge not found');
  }

  res.json(deliveryCharge);
});

// @desc    Create delivery charge
// @route   POST /api/delivery-charges
// @access  Private/Admin
const createDeliveryCharge = asyncHandler(async (req, res) => {
  const {
    state,
    city,
    charge,
    minimumOrderValue,
    freeDeliveryThreshold,
    estimatedDays,
    isActive
  } = req.body;

  if (!state || !city || charge === undefined) {
    res.status(400);
    throw new Error('State, city, and charge are required');
  }

  // Check if delivery charge already exists for this state-city combination
  const existingCharge = await DeliveryCharge.findOne({
    state: state.toUpperCase(),
    city: city.toUpperCase()
  });

  if (existingCharge) {
    res.status(400);
    throw new Error('Delivery charge already exists for this state and city combination');
  }

  const deliveryCharge = await DeliveryCharge.create({
    state: state.toUpperCase(),
    city: city.toUpperCase(),
    charge,
    minimumOrderValue: minimumOrderValue || 0,
    freeDeliveryThreshold,
    estimatedDays: estimatedDays || 3,
    isActive: isActive !== undefined ? isActive : true
  });

  res.status(201).json(deliveryCharge);
});

// @desc    Update delivery charge
// @route   PUT /api/delivery-charges/:id
// @access  Private/Admin
const updateDeliveryCharge = asyncHandler(async (req, res) => {
  const {
    state,
    city,
    charge,
    minimumOrderValue,
    freeDeliveryThreshold,
    estimatedDays,
    isActive
  } = req.body;

  const deliveryCharge = await DeliveryCharge.findById(req.params.id);

  if (!deliveryCharge) {
    res.status(404);
    throw new Error('Delivery charge not found');
  }

  // Check if the new state-city combination already exists (excluding current record)
  if (state && city) {
    const existingCharge = await DeliveryCharge.findOne({
      state: state.toUpperCase(),
      city: city.toUpperCase(),
      _id: { $ne: req.params.id }
    });

    if (existingCharge) {
      res.status(400);
      throw new Error('Delivery charge already exists for this state and city combination');
    }
  }

  // Update fields
  deliveryCharge.state = state ? state.toUpperCase() : deliveryCharge.state;
  deliveryCharge.city = city ? city.toUpperCase() : deliveryCharge.city;
  deliveryCharge.charge = charge !== undefined ? charge : deliveryCharge.charge;
  deliveryCharge.minimumOrderValue = minimumOrderValue !== undefined ? minimumOrderValue : deliveryCharge.minimumOrderValue;
  deliveryCharge.freeDeliveryThreshold = freeDeliveryThreshold !== undefined ? freeDeliveryThreshold : deliveryCharge.freeDeliveryThreshold;
  deliveryCharge.estimatedDays = estimatedDays !== undefined ? estimatedDays : deliveryCharge.estimatedDays;
  deliveryCharge.isActive = isActive !== undefined ? isActive : deliveryCharge.isActive;

  const updatedDeliveryCharge = await deliveryCharge.save();
  res.json(updatedDeliveryCharge);
});

// @desc    Delete delivery charge
// @route   DELETE /api/delivery-charges/:id
// @access  Private/Admin
const deleteDeliveryCharge = asyncHandler(async (req, res) => {
  const deliveryCharge = await DeliveryCharge.findById(req.params.id);

  if (!deliveryCharge) {
    res.status(404);
    throw new Error('Delivery charge not found');
  }

  await DeliveryCharge.findByIdAndDelete(req.params.id);
  res.json({ message: 'Delivery charge deleted successfully' });
});

// @desc    Get unique states and cities
// @route   GET /api/delivery-charges/locations
// @access  Private/Admin
const getLocations = asyncHandler(async (req, res) => {
  const locations = await DeliveryCharge.aggregate([
    {
      $group: {
        _id: '$state',
        cities: { $addToSet: '$city' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  const states = locations.map(location => ({
    state: location._id,
    cities: location.cities.sort()
  }));

  res.json(states);
});

// @desc    Bulk upload delivery charges
// @route   POST /api/delivery-charges/bulk
// @access  Private/Admin
const bulkUploadDeliveryCharges = asyncHandler(async (req, res) => {
  const { deliveryCharges } = req.body;

  if (!deliveryCharges || !Array.isArray(deliveryCharges)) {
    res.status(400);
    throw new Error('Delivery charges array is required');
  }

  const results = {
    success: [],
    errors: []
  };

  for (let i = 0; i < deliveryCharges.length; i++) {
    const chargeData = deliveryCharges[i];
    
    try {
      const existingCharge = await DeliveryCharge.findOne({
        state: chargeData.state.toUpperCase(),
        city: chargeData.city.toUpperCase()
      });

      if (existingCharge) {
        // Update existing
        Object.assign(existingCharge, {
          charge: chargeData.charge,
          minimumOrderValue: chargeData.minimumOrderValue || 0,
          freeDeliveryThreshold: chargeData.freeDeliveryThreshold,
          estimatedDays: chargeData.estimatedDays || 3,
          isActive: chargeData.isActive !== undefined ? chargeData.isActive : true
        });
        await existingCharge.save();
        results.success.push(`Updated: ${chargeData.state} - ${chargeData.city}`);
      } else {
        // Create new
        await DeliveryCharge.create({
          state: chargeData.state.toUpperCase(),
          city: chargeData.city.toUpperCase(),
          charge: chargeData.charge,
          minimumOrderValue: chargeData.minimumOrderValue || 0,
          freeDeliveryThreshold: chargeData.freeDeliveryThreshold,
          estimatedDays: chargeData.estimatedDays || 3,
          isActive: chargeData.isActive !== undefined ? chargeData.isActive : true
        });
        results.success.push(`Created: ${chargeData.state} - ${chargeData.city}`);
      }
    } catch (error) {
      results.errors.push(`Row ${i + 1}: ${error.message}`);
    }
  }

  res.json(results);
});

module.exports = {
  getDeliveryCharges,
  getDeliveryChargeById,
  createDeliveryCharge,
  updateDeliveryCharge,
  deleteDeliveryCharge,
  getLocations,
  bulkUploadDeliveryCharges
};