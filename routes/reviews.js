const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { protect } = require("../middleware/authMiddleware");

// Public routes
router.get('/product/:productId', reviewController.getProductReviews);

// Protected routes (require authentication)
router.get('/product/:productId/can-review', protect, reviewController.canUserReview);
router.post('/product/:productId', protect, reviewController.createReview);
router.put('/:reviewId', protect, reviewController.updateReview);
router.delete('/:reviewId', protect, reviewController.deleteReview);
router.get('/my-reviews', protect, reviewController.getUserReviews);
router.post('/:reviewId/helpful', reviewController.markHelpful);



module.exports = router;