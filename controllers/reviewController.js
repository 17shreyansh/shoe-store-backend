const Review = require('../models/Review');
const Order = require('../models/Order');
const Product = require('../models/Product');
const mongoose = require('mongoose'); // Correctly import mongoose

const reviewController = {
  // Get all reviews for a product (public)
  getProductReviews: async (req, res) => {
    try {
      const { productId } = req.params;
      const { page = 1, limit = 10, sortBy = 'newest' } = req.query;

      let sortCriteria = {};
      switch (sortBy) {
        case 'oldest':
          sortCriteria = { createdAt: 1 };
          break;
        case 'highest':
          sortCriteria = { rating: -1, createdAt: -1 };
          break;
        case 'lowest':
          sortCriteria = { rating: 1, createdAt: -1 };
          break;
        case 'helpful':
          sortCriteria = { helpfulVotes: -1, createdAt: -1 };
          break;
        default: // newest
          sortCriteria = { createdAt: -1 };
      }

      const reviews = await Review.find({
        productId,
        isVisible: true
      })
        .populate('userId', 'name email')
        .sort(sortCriteria)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const totalReviews = await Review.countDocuments({ productId, isVisible: true });

      // Calculate rating distribution
      const ratingStats = await Review.aggregate([
        { $match: { productId: new mongoose.Types.ObjectId(productId), isVisible: true } }, // Fixed here
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 }
          }
        }
      ]);

      const avgRating = await Review.aggregate([
        { $match: { productId: new mongoose.Types.ObjectId(productId), isVisible: true } }, // Fixed here
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          reviews,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalReviews / limit),
            totalReviews,
            hasNext: page < Math.ceil(totalReviews / limit),
            hasPrev: page > 1
          },
          statistics: {
            averageRating: avgRating[0]?.averageRating || 0,
            totalReviews: avgRating[0]?.totalReviews || 0,
            ratingDistribution: ratingStats.reduce((acc, stat) => {
              acc[stat._id] = stat.count;
              return acc;
            }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch reviews',
        error: error.message
      });
    }
  },

  // Check if user can review a product
  canUserReview: async (req, res) => {
    try {
      const { productId } = req.params;
      const userId = req.user.id;

      // Check if user already reviewed this product
      const existingReview = await Review.findOne({ productId, userId });
      if (existingReview) {
        return res.json({
          success: true,
          canReview: false,
          reason: 'already_reviewed',
          message: 'You have already reviewed this product'
        });
      }

      // Check if user has a delivered order with this product
      const deliveredOrder = await Order.findOne({
        userId,
        orderStatus: 'Delivered',
        'items.productId': productId
      });

      if (!deliveredOrder) {
        return res.json({
          success: true,
          canReview: false,
          reason: 'not_purchased',
          message: 'You can only review products you have purchased and received'
        });
      }

      // Get the specific item details from the order
      const orderItem = deliveredOrder.items.find(item =>
        item.productId.toString() === productId
      );

      res.json({
        success: true,
        canReview: true,
        orderDetails: {
          orderId: deliveredOrder._id,
          size: orderItem.size,
          color: orderItem.color,
          deliveredAt: deliveredOrder.deliveredAt
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to check review eligibility',
        error: error.message
      });
    }
  },

  // Create a review (authenticated users only)
  createReview: async (req, res) => {
    try {
      const { productId } = req.params;
      const { rating, title, comment } = req.body;
      const userId = req.user.id;

      // Validation
      if (!rating || !title || !comment) {
        return res.status(400).json({
          success: false,
          message: 'Rating, title, and comment are required'
        });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5'
        });
      }

      // Check if user already reviewed this product
      const existingReview = await Review.findOne({ productId, userId });
      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: 'You have already reviewed this product'
        });
      }

      // Verify user has purchased and received the product
      const deliveredOrder = await Order.findOne({
        userId,
        orderStatus: 'Delivered',
        'items.productId': productId
      });

      if (!deliveredOrder) {
        return res.status(403).json({
          success: false,
          message: 'You can only review products you have purchased and received'
        });
      }

      // Get order item details
      const orderItem = deliveredOrder.items.find(item =>
        item.productId.toString() === productId
      );

      // Create review
      const review = new Review({
        productId,
        userId,
        orderId: deliveredOrder._id,
        rating,
        title,
        comment,
        size: orderItem.size,
        color: orderItem.color
      });

      await review.save();

      // Update product rating (you'll need to add these fields to your Product model)
      await updateProductRating(productId);

      const populatedReview = await Review.findById(review._id)
        .populate('userId', 'name email');

      res.status(201).json({
        success: true,
        message: 'Review created successfully',
        data: populatedReview
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create review',
        error: error.message
      });
    }
  },

  // Update user's own review
  updateReview: async (req, res) => {
    try {
      const { reviewId } = req.params;
      const { rating, title, comment } = req.body;
      const userId = req.user.id;

      const review = await Review.findOne({ _id: reviewId, userId });
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found or you are not authorized to update it'
        });
      }

      // Update fields
      if (rating) review.rating = rating;
      if (title) review.title = title;
      if (comment) review.comment = comment;

      await review.save();

      // Update product rating
      await updateProductRating(review.productId);

      const updatedReview = await Review.findById(reviewId)
        .populate('userId', 'name email');

      res.json({
        success: true,
        message: 'Review updated successfully',
        data: updatedReview
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update review',
        error: error.message
      });
    }
  },

  // Delete user's own review
  deleteReview: async (req, res) => {
    try {
      const { reviewId } = req.params;
      const userId = req.user.id;

      const review = await Review.findOne({ _id: reviewId, userId });
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found or you are not authorized to delete it'
        });
      }

      const productId = review.productId;
      await Review.findByIdAndDelete(reviewId);

      // Update product rating
      await updateProductRating(productId);

      res.json({
        success: true,
        message: 'Review deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete review',
        error: error.message
      });

      
    }
  },

  // Get user's reviews
  getUserReviews: async (req, res) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const reviews = await Review.find({ userId })
        .populate('productId', 'name mainImage slug')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const totalReviews = await Review.countDocuments({ userId });

      res.json({
        success: true,
        data: {
          reviews,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalReviews / limit),
            totalReviews
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user reviews',
        error: error.message
      });
    }
  },

  // Mark review as helpful
  markHelpful: async (req, res) => {
    try {
      const { reviewId } = req.params;

      const review = await Review.findByIdAndUpdate(
        reviewId,
        { $inc: { helpfulVotes: 1 } },
        { new: true }
      );

      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found'
        });
      }

      res.json({
        success: true,
        message: 'Review marked as helpful',
        helpfulVotes: review.helpfulVotes
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to mark review as helpful',
        error: error.message
      });
    }
  }
};

// Helper function to update product rating
async function updateProductRating(productId) {
  try {
    const stats = await Review.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId), isVisible: true } }, // Fixed here
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    const avgRating = stats[0]?.averageRating || 0;
    const reviewCount = stats[0]?.totalReviews || 0;

    await Product.findByIdAndUpdate(productId, {
      rating: parseFloat(avgRating.toFixed(1)),
      reviewsCount: reviewCount
    });
  } catch (error) {
    console.error('Error updating product rating:', error);
  }
}



module.exports = reviewController;

