// middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.protect = async (req, res, next) => {
  let token;

  // Check if token is in cookies
  if (req.cookies.token) {
    token = req.cookies.token;
  }

  // If no token, send unauthorized
  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user from DB to request object (excluding password)
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    next();
  } catch (err) {
    console.error("Token verification error:", err);
    
    // Clear invalid token cookie
    res.clearCookie('token');
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token, please log in again" });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "Token expired, please log in again" });
    }
    
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

exports.isAdmin = (req, res, next) => {
  // This middleware assumes req.user is already populated by 'protect'
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    // If user is not an admin, return 403 Forbidden
    res.status(403).json({ message: "Access denied: Admin privileges required" });
  }
};