// controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer"); // For email functionality

// Helper function to generate JWT and set it as an HttpOnly cookie
const sendTokenResponse = (user, statusCode, res) => {
    // Sign a JWT token with the user's ID
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE, // Token expiration, e.g., '30d'
    });

    const options = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000), // Cookie expiration
        httpOnly: true, // Makes the cookie inaccessible to client-side scripts
        secure: false, // Set to false for development
        sameSite: 'Lax', // Lax for development
        path: '/' // Ensure cookie is available for all paths
    };

    // Update user's last login timestamp
    user.lastLogin = new Date();
    user.save({ validateBeforeSave: false }); // Save without re-running schema validators for this update

    // Send the response with the token in a cookie and user data
    res.status(statusCode).cookie('token', token, options).json({
        success: true,
        // Send back essential user info, using getSafeData for a clean response
        // Explicitly include isEmailVerified so frontend can check it
        data: {
            ...user.getSafeData(),
            isEmailVerified: user.isEmailVerified
        }
    });
};

// Email transporter setup (configure with your email service environment variables)
const createEmailTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD,
        },
        // 'secure: true' for port 465, 'secure: false' for other ports like 587
        secure: process.env.EMAIL_PORT == 465,
    });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    const { name, email, password, phone, address } = req.body;

    try {
        // Check if a user with this email already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "Email already registered. Please login or use a different email." });
        }

        // Create the new user with 'pending' account status
        const user = await User.create({
            name,
            email,
            password,
            phone,
            address,
            accountStatus: 'pending' // Account is pending until email verification
        });

        // Generate an email verification token for the new user
        const verifyToken = user.getEmailVerificationToken();
        await user.save({ validateBeforeSave: false }); // Save the token to the user document

        // Construct the verification URL
        const verifyURL = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${verifyToken}`;

        // Email message content for verification
        const message = `
            <h1>Welcome to Your Shoe Store!</h1>
            <p>Thank you for registering with us. To activate your account, please verify your email by clicking the link below:</p>
            <a href="${verifyURL}" style="background: #007cba; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Your Email Now</a>
            <p style="margin-top: 20px;">This verification link will expire in 24 hours.</p>
            <p>If you did not create this account, please ignore this email.</p>
            <br>
            <p>Happy Shopping!</p>
            <p>The Your Shoe Store Team</p>
        `;

        // Send the verification email
        try {
            const transporter = createEmailTransporter();
            await transporter.sendMail({
                from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
                to: user.email,
                subject: `Verify Your Email for Your Shoe Store Account`,
                html: message,
            });

            res.status(201).json({
                success: true,
                message: 'Registration successful! Please check your email to verify your account and complete activation.',
            });
        } catch (emailError) {
            console.error('Email sending failed during registration:', emailError);
            // If email fails to send, clear the token so the user can request a resend
            user.emailVerificationToken = undefined;
            user.emailVerificationExpires = undefined;
            await user.save({ validateBeforeSave: false });

            res.status(500).json({
                message: "Registration successful, but the verification email could not be sent. Please request a new verification email later.",
                emailSent: false
            });
        }
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: "Server error during registration." });
    }
};

// @desc    Log user into the system
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
        return res.status(400).json({ message: "Please enter both email and password." });
    }

    try {
        // Find user by email and explicitly select the password hash
        const user = await User.findOne({ email }).select("+password");

        // If no user found or password doesn't match
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        // Check account status
        if (user.accountStatus === 'deactivated') {
            return res.status(403).json({ message: "Your account is currently deactivated. Please reactivate it to log in." });
        }

        // Allow login even if email is not verified.
        // The frontend can check `isEmailVerified` from the response data to prompt for verification.
        sendTokenResponse(user, 200, res);

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error during login." });
    }
};

// @desc    Get current logged-in user profile
// @route   GET /api/auth/profile
// @access  Private
exports.getProfile = async (req, res) => {
    try {
        // req.user is populated from the JWT by the 'protect' middleware
        const user = await User.findById(req.user._id); // Password excluded by default in model
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        res.json({ success: true, data: user.getSafeData() });
    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({ message: "Server error fetching profile." });
    }
};

// @desc    Update user profile details
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
    // Allowed fields to update
    const { name, phone, address } = req.body;
    const fieldsToUpdate = {};

    if (name) fieldsToUpdate.name = name;
    if (phone) fieldsToUpdate.phone = phone;
    if (address) fieldsToUpdate.address = address; // This will overwrite the whole address object

    try {
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $set: fieldsToUpdate }, // Use $set to update only specified fields
            { new: true, runValidators: true } // Return the updated document and run schema validators
        ).select('-password'); // Exclude password from the returned object

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        res.json({
            success: true,
            message: "Profile updated successfully.",
            data: user.getSafeData()
        });
    } catch (error) {
        console.error("Update profile error:", error);
        // Handle validation errors from Mongoose
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: "Server error updating profile." });
    }
};

// @desc    Change user's password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Please provide both current and new passwords." });
    }

    try {
        // Find user and explicitly select password to compare
        const user = await User.findById(req.user._id).select('+password');

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Check if the current password is correct
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ message: "Current password is incorrect." });
        }

        // Update the password field; the pre-save hook will hash it
        user.password = newPassword;
        await user.save(); // This will trigger the password hashing middleware

        res.json({
            success: true,
            message: "Password updated successfully. Please log in with your new password."
        });
    } catch (error) {
        console.error("Change password error:", error);
        // Handle validation errors for the new password (e.g., minlength)
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: "Server error changing password." });
    }
};

// @desc    Request a password reset email
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Please provide an email address." });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            // Return a generic success message to prevent email enumeration attacks
            return res.status(200).json({ message: "If an account with that email exists, a password reset email has been sent." });
        }

        // Generate a password reset token
        const resetToken = user.getResetPasswordToken();
        await user.save({ validateBeforeSave: false }); // Save the token to the user document

        // Construct the reset URL
        const resetURL = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;

        // Email message content for password reset
        const message = `
            <h1>Password Reset Request for Your Shoe Store</h1>
            <p>You have requested to reset your password. Please click the link below to set a new password:</p>
            <a href="${resetURL}" style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset My Password</a>
            <p style="margin-top: 20px;">This password reset link will expire in 15 minutes.</p>
            <p>If you did not request a password reset, please ignore this email.</p>
            <br>
            <p>The Your Shoe Store Team</p>
        `;

        // Send the reset email
        try {
            const transporter = createEmailTransporter();
            await transporter.sendMail({
                from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
                to: user.email,
                subject: 'Password Reset Request',
                html: message,
            });

            res.status(200).json({ success: true, message: 'Password reset email sent. Please check your inbox.' });
        } catch (emailError) {
            console.error('Error sending password reset email:', emailError);
            // If email fails, clear the token to allow retries
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save({ validateBeforeSave: false });

            res.status(500).json({ message: "Failed to send password reset email. Please try again later." });
        }
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ message: "Server error during forgot password process." });
    }
};

// @desc    Reset user's password using the token
// @route   PUT /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res) => {
    // Hash the incoming reset token to compare with the hashed token in DB
    const resetPasswordToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');

    try {
        // Find user by the hashed token and ensure it's not expired
        const user = await User.findOne({
            passwordResetToken: resetPasswordToken,
            passwordResetExpires: { $gt: Date.now() } // Token must be greater than current time
        }).select('+password'); // Explicitly select password to update it

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired password reset token." });
        }

        // Set the new password (will be hashed by pre-save middleware)
        user.password = req.body.password;
        // Clear the reset token fields after successful reset
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save(); // Save the user with the new password

        // Log the user in immediately after resetting password
        sendTokenResponse(user, 200, res);
    } catch (error) {
        console.error("Reset password error:", error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: "Server error during password reset." });
    }
};

// @desc    Verify user's email using a token
// @route   GET /api/auth/verify-email/:token
// @access  Public
exports.verifyEmail = async (req, res) => {
    // Hash the incoming verification token to compare with the hashed token in DB
    const emailVerificationToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');

    try {
        // Find user by the hashed token and ensure it's not expired
        const user = await User.findOne({
            emailVerificationToken,
            emailVerificationExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired email verification link. Please request a new one." });
        }

        // Mark email as verified and update account status
        user.isEmailVerified = true;
        user.accountStatus = 'active'; // Change status from 'pending' to 'active'
        // Clear the verification token fields
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        res.json({
            success: true,
            message: "Email verified successfully! Your account is now active.",
            data: user.getSafeData() // Send updated user data
        });
    } catch (error) {
        console.error("Email verification error:", error);
        res.status(500).json({ message: "Server error during email verification." });
    }
};

// @desc    Resend email verification link
// @route   POST /api/auth/resend-verification
// @access  Public
exports.resendVerification = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email is required to resend verification." });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            // Generic message to prevent email enumeration attacks
            return res.status(200).json({ message: "If an account with that email exists and is not verified, a new verification email has been sent." });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ message: "This email is already verified. No need to resend verification." });
        }

        // Generate a new email verification token
        const verifyToken = user.getEmailVerificationToken();
        await user.save({ validateBeforeSave: false }); // Save the new token

        // Construct the new verification URL
        const verifyURL = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${verifyToken}`;

        // Email message content
        const message = `
            <h1>Resend Email Verification for Your Shoe Store</h1>
            <p>You recently requested to resend your email verification. Please verify your email by clicking the link below:</p>
            <a href="${verifyURL}" style="background: #007cba; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Your Email</a>
            <p style="margin-top: 20px;">This link will expire in 24 hours.</p>
            <p>If you did not request this, please ignore this email.</p>
            <br>
            <p>The Your Shoe Store Team</p>
        `;

        // Send the new verification email
        try {
            const transporter = createEmailTransporter();
            await transporter.sendMail({
                from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
                to: user.email,
                subject: `Resend Email Verification for Your Shoe Store`,
                html: message,
            });

            res.status(200).json({
                success: true,
                message: 'Verification email resent successfully! Please check your email.',
            });
        } catch (emailError) {
            console.error('Error sending resend verification email:', emailError);
            // Clear the token if email sending fails to allow another retry
            user.emailVerificationToken = undefined;
            user.emailVerificationExpires = undefined;
            await user.save({ validateBeforeSave: false });

            res.status(500).json({ message: "Failed to send verification email. Please try again later." });
        }
    } catch (error) {
        console.error("Resend verification error:", error);
        res.status(500).json({ message: "Server error during resend verification process." });
    }
};

// @desc    Log user out / Clear cookie
// @route   POST /api/auth/logout
// @access  Private
exports.logout = (req, res) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000), // Expire cookie almost immediately
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    });

    res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

// @desc    Deactivate user account
// @route   POST /api/auth/deactivate-account
// @access  Private
exports.deactivateAccount = async (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ message: "Please provide your password to deactivate your account." });
    }

    try {
        const user = await User.findById(req.user._id).select('+password'); // Select password to verify

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Verify user's password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: "Incorrect password. Account deactivation failed." });
        }

        // Update account status to 'deactivated'
        user.accountStatus = 'deactivated';
        await user.save();

        // Clear the authentication cookie upon deactivation
        res.cookie('token', 'none', {
            expires: new Date(Date.now() + 10 * 1000),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
        });

        res.json({
            success: true,
            message: "Your account has been successfully deactivated. You have been logged out."
        });
    } catch (error) {
        console.error("Deactivate account error:", error);
        res.status(500).json({ message: "Server error during account deactivation." });
    }
};

// @desc    Reactivate user account
// @route   POST /api/auth/reactivate-account
// @access  Public (Requires email, not protected by token)
exports.reactivateAccount = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email is required to reactivate an account." });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found with this email." });
        }

        if (user.accountStatus !== 'deactivated') {
            return res.status(400).json({ message: "Account is not currently deactivated. Cannot reactivate." });
        }

        // Reactivate the account
        user.accountStatus = 'active';
        user.isEmailVerified = true; // Assume if reactivating, email was already verified
        await user.save();

        res.json({
            success: true,
            message: "Account reactivated successfully. You can now log in."
        });
    } catch (error) {
        console.error("Reactivate account error:", error);
        res.status(500).json({ message: "Server error during account reactivation." });
    }
};

// @desc    Check if current user is an admin
// @route   GET /api/auth/check-admin
// @access  Private (Admin only)
exports.checkAdmin = async (req, res) => {
    try {
        // isAdmin flag is available on req.user from 'protect' middleware
        const isAdmin = req.user?.isAdmin || false;
        res.json({ isAdmin });
    } catch (err) {
        console.error("Error checking admin status:", err);
        res.status(500).json({ message: "Error checking admin status." });
    }
};
