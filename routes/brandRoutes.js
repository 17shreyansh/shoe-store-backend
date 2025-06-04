const express = require("express");
const {
  createBrand,
  getBrands,
  getBrandById,
  updateBrand,
  deleteBrand,
} = require("../controllers/brandController");
const { protect, isAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Admin-only routes
router.post("/", protect, isAdmin, createBrand);
router.put("/:id", protect, isAdmin, updateBrand);
router.delete("/:id", protect, isAdmin, deleteBrand);

// Public routes
router.get("/", getBrands);
router.get("/:id", getBrandById);

module.exports = router;