// routes/auth.js
const express = require("express");
const {
    register,
    login,
    getProfile,
    logout,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification,
    deactivateAccount,
    reactivateAccount,
    checkAdmin
} = require("../controllers/authController");
const { protect, isAdmin } = require("../middleware/authMiddleware"); // Ensure middleware is correct

const router = express.Router();

// --- Public Routes ---
// User registration
router.post("/register", register);
// User login
router.post("/login", login);
// Request password reset email
router.post("/forgot-password", forgotPassword);
// Reset password using a token
router.put("/reset-password/:token", resetPassword);
// Verify email using a token
router.get("/verify-email/:token", verifyEmail);
// Resend email verification link
router.post("/resend-verification", resendVerification);
// Reactivate a deactivated account
router.post("/reactivate-account", reactivateAccount);


// --- Private Routes (Requires Authentication - 'protect' middleware) ---
// Get current user's profile
router.get("/profile", protect, getProfile);
// Update current user's profile details
router.put("/profile", protect, updateProfile);
// Change current user's password
router.put("/change-password", protect, changePassword);
// Log user out (clears cookie)
router.post("/logout", protect, logout);
// Deactivate current user's account
router.post("/deactivate-account", protect, deactivateAccount);

// --- Admin Routes (Requires Authentication AND Admin role - 'protect', 'isAdmin' middleware) ---
// Check if the current user has admin privileges
router.get("/check-admin", protect, checkAdmin); // Basic check, no full admin dashboard

// If you need basic admin functionality like getting all users (without full stats or complex filters)
// you'd add a simple route and controller function here:

const User = require("../models/User"); // Need User model for this route
router.get("/users", protect, isAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password -passwordResetToken -emailVerificationToken');
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ message: "Server error fetching users." });
    }
});


module.exports = router;