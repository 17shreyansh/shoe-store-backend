// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto"); // Needed for token generation

const userSchema = new mongoose.Schema({
    // Core User Information
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/.+\@.+\..+/, 'Please use a valid email address']
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: [6, 'Password must be at least 6 characters long'],
        select: false // Don't return password by default when querying users
    },
    isAdmin: {
        type: Boolean,
        default: false // Set to true for admin accounts
    },

    // Detailed User Profile Fields (for shipping, etc.)
    phone: {
        type: String,
        trim: true,
        validate: {
            validator: function(v) {
                // Allows empty string or valid phone format
                return !v || /^\+?[\d\s\-\(\)]+$/.test(v);
            },
            message: 'Please enter a valid phone number'
        }
    },
    address: {
        street: { type: String, trim: true, default: '' },
        city: { type: String, trim: true, default: '' },
        state: { type: String, trim: true, default: '' },
        zipCode: { type: String, trim: true, default: '' },
        country: { type: String, trim: true, default: '' }
    },

    // Email Verification and Account Status
    isEmailVerified: {
        type: Boolean,
        default: false // New users are unverified by default
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date, // Token expiration for email verification

    // Password Reset
    passwordResetToken: String,
    passwordResetExpires: Date, // Token expiration for password reset

    // Account Status (Simplified: pending verification, active, deactivated)
    accountStatus: {
        type: String,
        enum: ['pending', 'active', 'deactivated'],
        default: 'pending' // Account is 'pending' until email is verified
    },

    // Basic Activity Tracking
    lastLogin: Date,

}, {
    timestamps: true, // Adds createdAt and updatedAt fields automatically
    toJSON: { virtuals: true }, // Include virtuals when converting to JSON
    toObject: { virtuals: true } // Include virtuals when converting to object
});

// --- Schema Middleware & Methods ---

// Hash password before saving the user
userSchema.pre("save", async function (next) {
    // Only hash if the password field is modified (e.g., on registration or password change)
    if (!this.isModified("password")) {
        return next();
    }
    const salt = await bcrypt.genSalt(10); // Generate a salt (cost factor 10)
    this.password = await bcrypt.hash(this.password, salt); // Hash the password
    next();
});

// Method to compare entered password with the hashed password in the database
userSchema.methods.matchPassword = async function (enteredPassword) {
    // Compare the plain text password with the hashed password
    return await bcrypt.compare(enteredPassword, this.password);
};

// Method to generate and hash an email verification token
userSchema.methods.getEmailVerificationToken = function() {
    const verificationToken = crypto.randomBytes(32).toString('hex'); // Generate a random token

    // Hash the token and store it in the schema (for comparison later)
    this.emailVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');

    // Set expiration time for the token (24 hours)
    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
    return verificationToken; // Return the unhashed token to be sent via email
};

// Method to generate and hash a password reset token
userSchema.methods.getResetPasswordToken = function() {
    const resetToken = crypto.randomBytes(20).toString('hex'); // Generate a random token

    // Hash the token and store it in the schema
    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // Set expiration time for the token (15 minutes)
    this.passwordResetExpires = Date.now() + 15 * 60 * 1000;
    return resetToken; // Return the unhashed token to be sent via email
};

// Method to return user data without sensitive fields (e.g., password, tokens)
userSchema.methods.getSafeData = function() {
    const user = this.toObject(); // Convert Mongoose document to plain JavaScript object
    // Remove sensitive fields
    delete user.password;
    delete user.passwordResetToken;
    delete user.passwordResetExpires;
    delete user.emailVerificationToken;
    delete user.emailVerificationExpires;
    // Keep other fields like address, phone, accountStatus
    return user;
};

// Export the User model
module.exports = mongoose.model("User", userSchema);