const express = require('express');
const router = express.Router();
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product'); // Assuming your Product model is here
const { protect } = require("../middleware/authMiddleware");

// @route   GET /api/wishlist
// @desc    Get user's wishlist
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user.id }).populate('products.product', 'name price mainImage slug');

    if (!wishlist) {
      // If no wishlist exists for the user, return an empty wishlist
      return res.status(200).json({ products: [] });
    }

    res.json(wishlist);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/wishlist
// @desc    Add product to wishlist
// @access  Private
router.post('/', protect, async (req, res) => {
  const { productId } = req.body;

  try {
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ msg: 'Product not found' });
    }

    let wishlist = await Wishlist.findOne({ user: req.user.id });

    if (wishlist) {
      // Wishlist exists for the user
      const isProductInWishlist = wishlist.products.some(
        (item) => item.product.toString() === productId
      );

      if (isProductInWishlist) {
        return res.status(400).json({ msg: 'Product already in wishlist' });
      }

      wishlist.products.push({ product: productId });
      await wishlist.save();
      res.json(wishlist);
    } else {
      // No wishlist for user, create a new one
      wishlist = new Wishlist({
        user: req.user.id,
        products: [{ product: productId }]
      });
      await wishlist.save();
      res.status(201).json(wishlist);
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/wishlist/:productId
// @desc    Remove product from wishlist
// @access  Private
router.delete('/:productId', protect, async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user.id });

    if (!wishlist) {
      return res.status(404).json({ msg: 'Wishlist not found' });
    }

    // Filter out the product to be removed
    wishlist.products = wishlist.products.filter(
      (item) => item.product.toString() !== req.params.productId
    );

    await wishlist.save();
    res.json(wishlist);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;