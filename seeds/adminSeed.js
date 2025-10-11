const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        // Delete existing admin users
        await User.deleteMany({ isAdmin: true });
        console.log('Existing admin users deleted');

        // Create new admin user
        const admin = await User.create({
            name: 'Admin',
            email: 'admin@mellotoes.com',
            password: 'admin123',
            isAdmin: true,
            isEmailVerified: true,
            accountStatus: 'active'
        });

        console.log('New admin user created:', admin.email);
        console.log('Password: admin123');
        process.exit(0);
    } catch (error) {
        console.error('Error creating admin:', error);
        process.exit(1);
    }
};

seedAdmin();