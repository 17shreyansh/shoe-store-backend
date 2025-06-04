const express = require("express");
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  updateVariantStock,
  getVariantStock,
} = require("../controllers/productController");
const { protect, isAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Admin-only routes
router.post("/", protect, isAdmin, createProduct);
router.put("/:id", protect, isAdmin, updateProduct);
router.delete("/:id", protect, isAdmin, deleteProduct);
router.patch("/:id/stock", protect, isAdmin, updateVariantStock);

// Public routes
router.get("/", getProducts);
router.get("/:identifier", getProductById);
router.get("/:id/stock/:size/:color", getVariantStock);

module.exports = router;