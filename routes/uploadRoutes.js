const express = require("express");
const { uploadImage } = require("../controllers/uploadController");
const { protect, isAdmin } = require("../middleware/authMiddleware"); // Assuming these exist

const router = express.Router();

// Define the upload route
// This route should be protected if only admins can upload images
router.post("/", protect, isAdmin, uploadImage);

module.exports = router;