// server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const isAdmin = require('./routes/isadmin'); // This is likely your route for checking admin status
const uploadRoutes = require('./routes/uploadRoutes'); // <--- NEW: Import the upload routes
const path = require('path'); // <--- NEW: Import the path module
const brand = require('./routes/brandRoutes')
const orders = require('./routes/orderRoutes')
const dummyPayment = require('./routes/paymentDummy');
const wishlist = require('./routes/wishlistRoutes');
const reviews = require('./routes/reviews')
const coupon = require('./routes/CouponRoutes')
const support = require('./routes/supportRoutes'); // Import support ticket routes
const homepageRoutes = require('./routes/homepageRoutes'); // Import homepage routes

dotenv.config();
connectDB();

const app = express();

// Middleware setup
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
}));app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded request bodies

// IMPORTANT: Add cookie-parser middleware BEFORE your routes.
// This middleware parse    s the cookies from the incoming request and populates req.cookies.
app.use(cookieParser());

// Serve static files from the 'uploads' directory
// When a request comes for /uploads, it will look in the actual 'uploads' folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // <--- NEW: Serve static uploaded files

// Route definitions
app.use("/api/auth", authRoutes); // For user authentication (login, register, etc.)
app.use("/api/products", productRoutes); // For product-related API calls
app.use("/api/categories", categoryRoutes); // For category-related API calls
app.use("/api/admin", isAdmin); // Your specific admin check route
app.use("/api/upload", uploadRoutes); // <--- NEW: For image upload API calls
app.use("/api/brands", brand); 
app.use("/api/orders", orders); 
app.use('/api/payment', dummyPayment);
app.use('/api/wishlist', wishlist); // NEW: Wishlist routes
app.use('/api/reviews', reviews); 
app.use('/api/coupons', coupon); 
app.use('/api/tickets', support); // NEW: Support ticket routes
app.use('/api/home', homepageRoutes); // NEW: Homepage content routes




// Basic route for testing API status
app.get("/", (req, res) => {
    res.send("Shoe Store API is running...");
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));