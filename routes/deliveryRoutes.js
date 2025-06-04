const express = require('express');
const router = express.Router();
const {
  getDeliveryCharges,
  getDeliveryChargeById,
  createDeliveryCharge,
  updateDeliveryCharge,
  deleteDeliveryCharge,
  getLocations,
  bulkUploadDeliveryCharges
} = require('../controllers/deliveryController');
const { protect, isAdmin } = require('../middleware/authMiddleware');

// All routes are admin protected
router.use(protect, isAdmin);

router.route('/')
  .get(getDeliveryCharges)
  .post(createDeliveryCharge);

router.get('/locations', getLocations);
router.post('/bulk', bulkUploadDeliveryCharges);

router.route('/:id')
  .get(getDeliveryChargeById)
  .put(updateDeliveryCharge)
  .delete(deleteDeliveryCharge);

module.exports = router;