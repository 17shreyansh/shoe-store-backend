// routes/authRoutes.js
const express = require("express");
// Import both protect and isAdmin middleware
const { protect, isAdmin } = require("../middleware/authMiddleware");
const { checkAdmin } = require("../controllers/authController");

const router = express.Router();

// Apply both 'protect' and 'isAdmin' middleware before 'checkAdmin' controller
// 'protect' ensures the user is logged in and populates req.user
// 'isAdmin' then checks if the logged-in user has admin privileges
router.get("/", protect, isAdmin, checkAdmin);

module.exports = router;