const express = require("express");
const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const { protect, isAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Admin only routes
router.post("/", protect, isAdmin, createCategory);
router.put("/:id", protect, isAdmin, updateCategory);
router.delete("/:id", protect, isAdmin, deleteCategory);

// Public route
router.get("/", getCategories);

module.exports = router;